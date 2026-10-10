import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { budgetKiB } from "./check-bundle-size.mjs";
import { shardTests } from "./browser-tests.mjs";
import { classifyFile, plan as changePlan, gateCommands } from "./classify-changes.mjs";
import { missingPages, missingSections, routePatterns } from "./verify-pages.mjs";
import {
  migrationPlan,
  publish,
  productionReadiness,
  assertResume,
  digestDirectory,
  assertAppliedMigrations,
  receiptArtifact,
  readReceipt,
  releaseIdentity,
  retryReadback,
} from "./release.mjs";
import { releaseNotes, assertBrowserEvidence } from "./release-notes.mjs";
import { knownPagePath } from "../e2e/page-cases.ts";
import { checkReceipt, evaluate, identity, verifiedMutationOrigin } from "./mutation.mjs";
import { lastDeployed } from "./find-deployed.mjs";
import { compareEbayTax } from "./compare-ebay-tax.mjs";
import { jsonObjects, summarize as summarizeInvocations } from "./watch-invocations.mjs";
import {
  checkActionPins,
  checkFixtures,
  checkImports,
  checkPlanCodes,
  checkToolPins,
} from "./verify-repo.mjs";

// Le sigle sono composte a runtime: scritte per intero farebbero fallire il controllo su questo file.
const milestone = "M" + "3";
const task = `${milestone}-06`;
const gate = "G-" + "EBAY";
const plan = (files) => {
  const { gate, e2e, unclassified } = changePlan(files);
  return { gate, e2e, unclassified };
};

describe("sigle di piano", () => {
  it("ammette le sigle nella documentazione e nelle migration già applicate", () => {
    assert.deepEqual(
      checkPlanCodes([
        { path: "docs/MASTER_PLAN.md", text: task },
        { path: "docs/MASTER_PLAN.md", text: gate },
        { path: "migrations/0001_m0_slice.sql", text: "create table orders (id text);" },
      ]),
      [],
    );
  });

  it("rifiuta sigle in codice, test, log e nomi di file", () => {
    const errors = checkPlanCodes([
      { path: "app/orders.ts", text: `// completa ${task}` },
      { path: "test/orders.spec.ts", text: `describe("${milestone} sync")` },
      { path: "app/errors.ts", text: `console.log("${gate}")` },
      { path: "migrations/0009_m3_sync.sql", text: "" },
    ]);
    assert.equal(errors.length, 4);
  });
});

describe("fixture", () => {
  it("ammette host `.invalid` e origini del sistema", () => {
    assert.deepEqual(
      checkFixtures([
        {
          path: "test/orders.spec.ts",
          text: 'fetch("https://api.ebay.com/x"); const email = "a@esempio.invalid"; "https://negozio.invalid"',
        },
      ]),
      [],
    );
  });

  it("rifiuta host ed email reali soltanto nelle fixture", () => {
    const text = 'const url = "https://www.ebay.it/itm/1"; const email = "mario@gmail.com";';
    assert.equal(checkFixtures([{ path: "e2e/orders.spec.ts", text }]).length, 2);
    assert.equal(checkFixtures([{ path: "app/preview/scenarios.server.ts", text }]).length, 2);
    assert.deepEqual(checkFixtures([{ path: "app/integrations/stripe.server.ts", text }]), []);
  });
});

describe("import applicativi", () => {
  const entries = [
    { path: "app/routes.ts", text: 'index("routes/home.tsx")' },
    { path: "app/root.tsx", text: "" },
  ];

  it("accetta un grafo aciclico con i moduli server raggiungibili", () => {
    const files = [
      ...entries,
      { path: "app/routes/home.tsx", text: 'import { load } from "../domain/orders.server";' },
      { path: "app/domain/orders.server.ts", text: 'import { t } from "~/i18n";' },
      { path: "app/i18n.ts", text: "" },
    ];
    assert.deepEqual(checkImports(files, new Map()), []);
  });

  it("rifiuta un ciclo, anche attraverso un import dinamico", () => {
    const files = [
      ...entries,
      { path: "app/routes/home.tsx", text: 'import { a } from "../a";' },
      { path: "app/a.ts", text: 'export { b } from "./b";' },
      { path: "app/b.ts", text: 'const a = await import("./a");' },
    ];
    assert.match(
      checkImports(files, new Map()).join("\n"),
      /import ciclico: app\/a\.ts → app\/b\.ts → app\/a\.ts/u,
    );
  });

  it("rifiuta un modulo server senza consumatore e una voce in attesa superata", () => {
    const files = [
      ...entries,
      { path: "app/routes/home.tsx", text: 'import { load } from "../domain/orders.server";' },
      { path: "app/domain/orders.server.ts", text: "" },
      { path: "app/domain/export.server.ts", text: "" },
      { path: "app/routes/unused.ts", text: "" },
    ];
    const errors = checkImports(files, new Map([["app/domain/orders.server.ts", "motivo"]]));
    assert.equal(errors.length, 3);
  });
});

describe("versioni degli strumenti", () => {
  const files = (
    workflow,
    manifest = { engines: { node: "26.10.0" }, packageManager: "pnpm@12.6.0" },
  ) => [
    { path: "mise.toml", text: '[tools]\nnode = "26.10.0"\npnpm = "12.6.0"\n' },
    { path: "package.json", text: JSON.stringify(manifest) },
    { path: ".github/workflows/ci.yml", text: workflow },
  ];
  const workflow = (node, pnpm) =>
    `steps:\n  - uses: pnpm/action-setup@x\n    with:\n      version: ${pnpm}\n  - uses: actions/setup-node@x\n    with:\n      node-version: ${node}\n  - uses: other/action@x\n    with:\n      version: \${{ steps.v.outputs.doctor }}\n`;

  it("accetta versioni coincidenti ed espressioni lette dal manifest", () => {
    assert.deepEqual(checkToolPins(files(workflow("26.10.0", "12.6.0"))), []);
  });

  it("rifiuta divergenze fra mise, manifest e workflow", () => {
    assert.equal(checkToolPins(files(workflow("26.9.0", "12.5.0"))).length, 2);
    assert.equal(
      checkToolPins(
        files(workflow("26.10.0", "12.6.0"), {
          engines: { node: "26" },
          packageManager: "pnpm@12",
        }),
      ).length,
      2,
    );
  });
});

describe("Action fissate", () => {
  const sha = "3d3c42e5aac5ba805825da76410c181273ba90b1";

  it("accetta SHA completo con versione e Action locali", () => {
    const text = `      - uses: actions/checkout@${sha} # v7.0.1\n      - uses: ./.github/actions/setup\n`;
    assert.deepEqual(checkActionPins([{ path: ".github/workflows/ci.yml", text }]), []);
  });

  it("rifiuta tag mobili, SHA abbreviati e SHA senza versione", () => {
    const text = `      - uses: actions/checkout@v7\n        uses: actions/setup-node@3d3c42e\n      - uses: actions/checkout@${sha}\n`;
    assert.equal(checkActionPins([{ path: ".github/workflows/ci.yml", text }]).length, 3);
  });
});

describe("classificazione dei file modificati", () => {
  it("copre sicurezza, isolamento, integrazioni e suite funzionali dai titoli generici", () => {
    for (const file of [
      "app/auth.server.ts",
      "app/domain/sessions.server.ts",
      "app/domain/stores.server.ts",
      "app/domain/export.server.ts",
      "app/domain/order-acquisition.server.ts",
      "app/integrations/ebay/store-link.server.ts",
    ])
      assert.ok(changePlan([file]).mutation.includes(file));
    const sources = [{ path: "app/routes/stores.tsx", text: "" }];
    const selected = new RegExp(changePlan([sources[0].path], sources).browserGrep);
    assert.ok(
      selected.test(
        "chromium app-shell.spec.ts il salvataggio automatico fallito ripristina il valore",
      ),
    );
    assert.ok(selected.test("stores: /negozi/collega"));
    assert.equal(selected.test("profile: /anteprima/profilo"), false);
  });
  it("segue i consumatori transitivi e allarga la selezione quando ne arriva uno nuovo", () => {
    const files = [
      { path: "app/domain/stores.server.ts", text: "" },
      {
        path: "app/routes/store-link.tsx",
        text: 'import { load } from "../domain/stores.server";',
      },
    ];
    assert.deepEqual(changePlan([files[0].path], files).areas, ["stores"]);
    files.push({
      path: "app/routes/home.tsx",
      text: 'import { load } from "../domain/stores.server";',
    });
    assert.deepEqual(changePlan([files[0].path], files).areas, ["auth", "orders", "stores"]);
    files.push({ path: "app/routes/site.tsx", text: "" });
    assert.deepEqual(changePlan(["app/routes/site.tsx"], files).areas, ["public"]);
    assert.equal(changePlan(["app/new-module.ts"], files).mode, "full");
  });

  it("limita le mutation ai moduli critici modificati e ai loro consumatori critici", () => {
    const files = [
      { path: "app/i18n.ts", text: "" },
      { path: "app/domain/stores.server.ts", text: 'import { t } from "../i18n";' },
      {
        path: "app/auth.server.ts",
        text: 'import { t } from "./i18n";\nimport { load } from "./domain/stores.server";',
      },
    ];
    assert.deepEqual(changePlan(["app/i18n.ts"], files).mutation, []);
    assert.deepEqual(changePlan(["app/domain/stores.server.ts"], files).mutation.sort(), [
      "app/auth.server.ts",
      "app/domain/stores.server.ts",
    ]);
  });

  it("ripete mutation Auth quando cambiano le sue prove veloci o il loro runtime", () => {
    for (const file of [
      "test/auth-route.unit.ts",
      "test/worker-context.ts",
      "vitest.unit.config.ts",
    ])
      assert.deepEqual(changePlan([file]).mutation, ["app/auth-route.server.ts"]);
    assert.equal(classifyFile("vitest.cloudflare.config.ts"), "tooling");
  });

  it("seleziona una route circoscritta ma forza il completo sulla tabella delle route", () => {
    const sources = [{ path: "app/routes/stores.tsx", text: "export default function Page() {}" }];
    assert.equal(changePlan([sources[0].path], sources).mode, "targeted");
    assert.equal(changePlan([sources[0].path], sources).browsers, "chromium,webkit");
    assert.equal(changePlan(["app/routes.ts"], sources).mode, "full");
    const deleted = changePlan(["app/domain/sessions.server.ts"], sources);
    assert.equal(deleted.mode, "full");
    assert.deepEqual(deleted.mutation, []);
  });

  it("non distribuisce un aggiornamento actionlint e forza il completo sul candidato", () => {
    const files = [".github/workflows/actionlint.yml"];
    assert.equal(changePlan(files).mode, "tooling");
    assert.equal(changePlan(files).deploy, false);
    assert.equal(changePlan(files, [], true).mode, "full");
    assert.equal(changePlan(["app/integrations/stripe.server.ts"]).mutation.length, 1);
    assert.equal(changePlan([".github/workflows/publish.yml"]).promotionReuse, false);
    assert.equal(changePlan([".github/workflows/mutation.yml"]).promotionReuse, false);
    assert.equal(changePlan(["app/routes/stores.tsx"]).promotionReuse, true);
  });
  it("assegna le categorie note", () => {
    assert.equal(classifyFile("README.md"), "documentation");
    assert.equal(classifyFile("test/orders.spec.ts"), "test");
    assert.equal(classifyFile("app/root.tsx"), "runtime");
    assert.equal(classifyFile(".github/workflows/ci.yml"), "tooling");
    assert.equal(classifyFile("AGENTS.md"), "tooling");
    assert.equal(classifyFile("docs/engineering/AGENT_SETUP.md"), "tooling");
    assert.equal(classifyFile("docs/brand/logo/fiscalbay-logo.svg"), undefined);
  });

  it("distingue documentazione ordinaria e governo senza browser o distribuzione", () => {
    assert.deepEqual(plan(["README.md", "docs/DECISION_REGISTER.md"]), {
      gate: "docs",
      e2e: false,
      unclassified: [],
    });
    assert.equal(plan(["README.md", "AGENTS.md"]).gate, "tooling");
  });

  it("separa controlli, browser, build, deploy e React nei diff misti", () => {
    const tools = [
      "AGENTS.md",
      "docs/MASTER_PLAN.md",
      "docs/engineering/RELEASE.md",
      "scripts/release.mjs",
      "scripts/classify-changes.mjs",
      "scripts/guardrails.test.mjs",
      ".github/workflows/ci.yml",
      ".github/workflows/publish.yml",
      ".github/workflows/react-doctor.yml",
      ".oxfmtrc.json",
    ];
    for (const files of tools.map((file) => [file, "README.md"]).concat([tools])) {
      const selected = changePlan(files);
      assert.equal(selected.gate, "tooling");
      for (const flag of ["e2e", "build", "deploy", "doctor"]) assert.equal(selected[flag], false);
    }
    for (const file of [
      "wrangler.jsonc",
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "scripts/unknown.mjs",
      "new.bin",
    ]) {
      const selected = changePlan([...tools, file]);
      assert.equal(selected.gate, "full");
      assert.equal(selected.build, true);
      assert.equal(selected.deploy, true);
      assert.equal(selected.e2e, true);
    }
    const runtime = changePlan([...tools, "app/root.tsx"]);
    for (const flag of ["e2e", "build", "deploy", "doctor"]) assert.equal(runtime[flag], true);
    const route = "app/routes/stores.tsx";
    const targeted = changePlan([...tools, route], [{ path: route, text: "" }]);
    assert.equal(targeted.mode, "targeted");
    assert.deepEqual(targeted.areas, ["stores"]);
    const browserTests = changePlan(["e2e/pages.spec.ts"]);
    assert.equal(browserTests.e2e, true);
    assert.equal(browserTests.build, true);
    assert.equal(browserTests.deploy, false);
    const unitTests = changePlan([...tools, "test/orders.spec.ts"]);
    assert.equal(unitTests.mode, "unit");
    assert.equal(unitTests.e2e, false);
    assert.equal(unitTests.deploy, false);
    const candidate = changePlan(tools, [], true);
    for (const flag of ["e2e", "build", "doctor"]) assert.equal(candidate[flag], true);
    assert.equal(candidate.deploy, false);
    assert.equal(changePlan(["doctor.config.json"]).doctor, true);
    assert.equal(changePlan(["docs/MASTER_PLAN.md"]).promotionReuse, true);
    assert.equal(changePlan(["scripts/release.mjs"]).promotionReuse, false);
  });

  it("espone alla CI tutti i controlli quando il confronto non identifica modifiche", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "classification-"));
    const output = path.join(directory, "outputs");
    try {
      const result = spawnSync(
        process.execPath,
        ["scripts/classify-changes.mjs", "--base", "HEAD", "--head", "HEAD", "--github-output"],
        {
          encoding: "utf8",
          env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: "" },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const fields = Object.fromEntries(
        readFileSync(output, "utf8")
          .trim()
          .split("\n")
          .map((line) => line.split(/=(.*)/u).slice(0, 2)),
      );
      assert.equal(fields.gate, "full");
      for (const flag of ["e2e", "build", "deploy", "doctor"]) assert.equal(fields[flag], "true");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("applica React Doctor nel gate e riserva browser e mutation ai job separati", () => {
    const commands = (files, sources = [], complete = false) =>
      gateCommands(changePlan(files, sources, complete)).map(([, args]) => args[0]);
    assert.deepEqual(commands(["scripts/release.mjs"]), ["verify:tooling"]);
    assert.deepEqual(commands(["doctor.config.json"]), ["verify:tooling", "doctor:react"]);
    assert.deepEqual(commands(["test/orders.spec.ts"]), [
      "verify:tooling",
      "verify:pages",
      "typecheck",
      "test",
      "build",
    ]);
    for (const files of [["app/new-module.ts"], ["scripts/unknown.mjs"], []]) {
      assert.equal(changePlan(files).doctor, true);
      assert.ok(commands(files).includes("doctor:react"));
    }
    assert.ok(commands(["scripts/release.mjs"], [], true).includes("doctor:react"));

    const directory = mkdtempSync(path.join(tmpdir(), "gate-run-"));
    const log = path.join(directory, "commands");
    const runner = `#!${process.execPath}\nconst fs = require("node:fs");\nif (require("node:path").basename(process.argv[1]) === "node") process.exit(77);\nfs.appendFileSync(process.env.GATE_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\n`;
    try {
      for (const name of ["pnpm", "node"])
        writeFileSync(path.join(directory, name), runner, { mode: 0o700 });
      const result = spawnSync(
        process.execPath,
        [
          "scripts/classify-changes.mjs",
          "--base",
          "HEAD",
          "--head",
          "HEAD",
          "--run",
          "--gate-only",
        ],
        {
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            PATH: `${directory}${path.delimiter}${process.env.PATH}`,
            GATE_TEST_LOG: log,
            GITHUB_OUTPUT: "",
            GITHUB_STEP_SUMMARY: "",
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), [
        "verify:tooling",
        "verify:pages",
        "typecheck",
        "test",
        "build",
        "doctor:react",
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("esegue il gate completo con E2E per un file non classificato o un diff vuoto", () => {
    assert.deepEqual(plan(["README.md", "nuovo/file.bin"]), {
      gate: "full",
      e2e: true,
      unclassified: ["nuovo/file.bin"],
    });
    assert.deepEqual(plan([]), { gate: "full", e2e: true, unclassified: [] });
  });

  it("salta le prove browser soltanto per i test unitari", () => {
    assert.deepEqual(plan(["test/orders.spec.ts"]), { gate: "full", e2e: false, unclassified: [] });
    assert.equal(plan(["e2e/app-components.spec.ts"]).e2e, true);
    assert.equal(plan(["app/root.tsx"]).e2e, true);
  });
});

describe("catalogo delle pagine", () => {
  it("rifiuta collegamenti a route assenti ma ammette parametri opzionali e endpoint", () => {
    for (const pathname of [
      "/",
      "/en",
      "/anteprima/ordini",
      "/en/anteprima/ordini/ord-02",
      "/api/auth/get-session",
    ])
      assert.ok(knownPagePath(pathname), pathname);
    assert.equal(knownPagePath("/pagina-che-non-esiste"), false);
    assert.equal(knownPagePath("/anteprima/ordini/ord-02/extra"), false);
  });
  it("segnala anche nuove sezioni e una lingua dimenticata", () => {
    assert.deepEqual(
      missingSections(["aspetto", "nuova"], [{ path: "/anteprima/impostazioni/aspetto" }]),
      [
        "/en/anteprima/impostazioni/aspetto",
        "/anteprima/impostazioni/nuova",
        "/en/anteprima/impostazioni/nuova",
      ],
    );
  });
  it("richiede scenari anche per route annidate e nuove route", () => {
    const patterns = routePatterns([{ path: "app", children: [{ path: "orders/:id" }] }]);
    assert.deepEqual(patterns, ["/app", "/app/orders/:id"]);
    assert.deepEqual(missingPages(patterns, [{ pattern: "/app" }]), ["/app/orders/:id"]);
  });
});

describe("pubblicazione riprendibile", () => {
  const manifest = { sha: "a".repeat(40), tree: "tree", digest: "artifact", environment: "test" };
  const harness = () => {
    let current = { version: "old", identity: "old" };
    const calls = [];
    const receipts = [];
    const io = {
      assertCurrent: async () => calls.push("current"),
      preflight: async () => calls.push("preflight"),
      migrations: async () => ({ pending: [], rollbackCompatible: true }),
      migrate: async () => calls.push("migration"),
      schema: async () => [],
      current: async () => current,
      canRollback: async () => true,
      deploy: async (identity) => {
        calls.push("deploy");
        current = { version: "new", identity };
      },
      readback: async () => calls.push("readback"),
      save: async (state) => receipts.push(structuredClone(state)),
    };
    return { io, calls, receipts };
  };

  it("non ridistribuisce dopo un'interruzione successiva al deploy", async () => {
    const { io, calls, receipts } = harness();
    const readback = io.readback;
    io.readback = async () => {
      throw new Error("interruzione");
    };
    await assert.rejects(publish(manifest, io), /interruzione/u);
    io.readback = readback;
    const result = await publish(manifest, io, receipts.at(-1));
    assert.equal(calls.filter((call) => call === "deploy").length, 1);
    assert.equal(result.readback, true);
    assert.equal(result.previous, "old");
  });

  it("rifiuta candidato superato e ricevuta di un altro artefatto prima degli effetti", async () => {
    const { io, calls } = harness();
    io.assertCurrent = async () => {
      throw new Error("superato");
    };
    await assert.rejects(publish(manifest, io), /superato/u);
    assert.deepEqual(calls, []);
    assert.throws(() => assertResume({ ...manifest, digest: "other" }, manifest), /diverso/u);
  });

  it("conserva il blocco del rollback dopo una migration e una ripresa", async () => {
    const { io, receipts } = harness();
    let applied = false;
    io.migrations = async () => ({
      pending: applied ? [] : [{ name: "new.sql" }],
      rollbackCompatible: applied,
    });
    io.migrate = async () => {
      applied = true;
      throw new Error("interruzione dopo schema");
    };
    await assert.rejects(publish(manifest, io), /interruzione/u);
    const result = await publish(manifest, io, receipts.at(-1));
    assert.equal(result.readback, true);
    assert.equal(result.rollbackCompatible, false);
  });

  it("attende la propagazione della versione entro una finestra limitata", async () => {
    let calls = 0;
    await retryReadback(
      async () => {
        if (++calls < 3) throw new Error("Readback della versione non riuscito: /.");
      },
      5,
      0,
    );
    assert.equal(calls, 3);
    calls = 0;
    await assert.rejects(
      retryReadback(
        async () => {
          calls++;
          throw new Error("Readback della versione non riuscito: /en.");
        },
        4,
        0,
      ),
      /\/en/u,
    );
    assert.equal(calls, 4);
  });

  it("non dichiara readback riuscito se il provider distribuisce un'altra identità", async () => {
    const { io, receipts } = harness();
    io.deploy = async () => {};
    await assert.rejects(publish(manifest, io), /diversa/u);
    assert.notEqual(receipts.at(-1).readback, true);
  });

  it("riconcilia un deploy riuscito sul provider anche se la CLI perde la risposta", async () => {
    const { io, receipts, calls } = harness();
    const deploy = io.deploy;
    io.deploy = async (identity) => {
      await deploy(identity);
      throw new Error("risposta persa");
    };
    await assert.rejects(publish(manifest, io), /risposta persa/u);
    assert.equal(receipts.at(-1).deployed, true);
    assert.equal(receipts.at(-1).version, "new");
    assert.equal(receipts.at(-1).readback, false);
    io.deploy = deploy;
    await publish(manifest, io, receipts.at(-1));
    assert.equal(calls.filter((call) => call === "deploy").length, 1);
  });

  it("rifiuta una ricostruzione diversa di un commit già distribuito", async () => {
    const { io, calls } = harness();
    io.current = async () => ({ version: "new", identity: `${manifest.sha}:different` });
    io.migrations = async () => ({ pending: [{ name: "change.sql" }], rollbackCompatible: false });
    await assert.rejects(publish(manifest, io), /artefatto diverso/u);
    assert.equal(calls.includes("deploy"), false);
    assert.equal(calls.includes("migration"), false);
  });

  it("ricontrolla il candidato prima delle migration e rifiuta un deploy esterno durante il preflight", async () => {
    const { io, calls } = harness();
    let checks = 0;
    io.assertCurrent = async () => {
      if (++checks > 1) throw new Error("superato");
    };
    io.migrations = async () => ({ pending: [{ name: "change.sql" }], rollbackCompatible: false });
    await assert.rejects(publish(manifest, io), /superato/u);
    assert.equal(calls.includes("migration"), false);
    const next = harness();
    let reads = 0;
    next.io.current = async () => ({
      version: ++reads === 1 ? "old" : "external",
      identity: "old",
    });
    await assert.rejects(publish(manifest, next.io), /Stato remoto cambiato/u);
    assert.equal(next.calls.includes("deploy"), false);
  });

  it("riprende un piano approvato parzialmente applicato senza autorizzare SQL diverso", () => {
    const entries = ["a.sql", "b.sql"].map((name) => ({
      name,
      digest: name,
      sql: "DROP TABLE example;",
    }));
    let digest;
    try {
      migrationPlan(entries, []);
    } catch (error) {
      digest = error.message.split("Digest ")[1];
    }
    const approved = { digest, pending: entries.map(({ name, digest }) => ({ name, digest })) };
    assert.equal(migrationPlan(entries, ["a.sql"], digest, approved).pending.length, 1);
    assert.throws(
      () =>
        migrationPlan(
          [{ ...entries[1], digest: "changed" }, entries[0]],
          ["a.sql"],
          digest,
          approved,
        ),
      /approvare/u,
    );
    assert.throws(() => migrationPlan(entries, ["a.sql"], "unapproved", approved), /approvare/u);
  });

  it("recupera solo la ricevuta non scaduta del tentativo precedente della stessa run", () => {
    const artifacts = [
      { name: "deployed-123-1", expired: false },
      { name: "deployed-123-2", expired: false },
      { name: "deployed-123-3", expired: false },
      { name: "deployed-124-2", expired: false },
      { name: "deployed-123-4", expired: true },
    ];
    assert.equal(receiptArtifact(artifacts, "deployed", "123", 3).name, "deployed-123-2");
    assert.equal(receiptArtifact(artifacts, "release-receipt", "123", 3), undefined);
  });

  it("la release richiede un collaudo eseguito sul candidato e sull'ambiente Production", () => {
    const evidence = {
      status: "passed",
      partial: false,
      counts: { passed: 1 },
      sha: manifest.sha,
      environment: "production",
      dirty: false,
      baseURL: "https://fiscalbay.it",
    };
    assert.doesNotThrow(() => assertBrowserEvidence(evidence, manifest.sha));
    for (const change of [
      { counts: { passed: 0 } },
      { partial: true },
      { dirty: true },
      { sha: "other" },
      { baseURL: "https://test.fiscalbay.it" },
      { environment: "local" },
    ])
      assert.throws(
        () => assertBrowserEvidence({ ...evidence, ...change }, manifest.sha),
        /Collaudo/u,
      );
  });

  it("verifica la ricevuta estratta dall'artefatto prima di ripristinare lo stato", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "receipt-"));
    assert.equal(readReceipt(directory, manifest), null);
    mkdirSync(path.join(directory, "reports"));
    const file = path.join(directory, "reports/release.json");
    const receipt = { ...manifest, previous: "old", schemaChanged: true };
    writeFileSync(file, JSON.stringify(receipt));
    assert.deepEqual(readReceipt(directory, manifest), receipt);
    writeFileSync(file, JSON.stringify({ ...receipt, digest: "other" }));
    assert.throws(() => readReceipt(directory, manifest), /diverso/u);
  });

  it("blocca migration distruttive non approvate e schema remoto estraneo", () => {
    const migrations = [{ name: "change.sql", digest: "hash", sql: "DROP TABLE orders;" }];
    assert.throws(() => migrationPlan(migrations, []), /Digest/u);
    assert.throws(() => migrationPlan(migrations, ["unknown.sql"]), /assenti/u);
    assert.equal(migrationPlan(migrations, ["change.sql"]).pending.length, 0);
    const additive = [
      "ALTER TABLE ebay_stores ADD COLUMN paused_at TEXT;",
      'ALTER TABLE "session" ADD "passkeyVerified" INTEGER;',
      "CREATE TABLE child (id TEXT REFERENCES parent(id) ON DELETE CASCADE ON UPDATE CASCADE);",
    ];
    for (const sql of additive)
      assert.equal(migrationPlan([{ ...migrations[0], sql }], []).pending.length, 1);
    for (const sql of [
      "ALTER TABLE orders RENAME TO archived;",
      "ALTER TABLE orders DROP COLUMN status;",
      "ALTER TABLE orders ADD COLUMN status TEXT; UPDATE orders SET status = 'open';",
    ])
      assert.throws(() => migrationPlan([{ ...migrations[0], sql }], []), /Digest/u);
    assert.equal(
      migrationPlan([{ ...migrations[0], sql: "CREATE TABLE example (id TEXT);" }], [])
        .rollbackCompatible,
      false,
    );
  });

  it("rifiuta una modifica SQL di una migration già applicata", () => {
    const current = [{ name: "schema.sql", digest: "new" }];
    const previous = [{ name: "schema.sql", digest: "old" }];
    assert.throws(() => assertAppliedMigrations(current, previous, ["schema.sql"]), /modificata/u);
    assert.doesNotThrow(() => assertAppliedMigrations(current, current, ["schema.sql"]));
    assert.doesNotThrow(() => assertAppliedMigrations(current, previous, []));
  });

  it("registra un'identità di versione entro il limite del messaggio Cloudflare", () => {
    const identity = releaseIdentity({ sha: "a".repeat(40), digest: "b".repeat(64) });
    assert.ok(identity.length <= 100);
    assert.ok(identity.startsWith(`${"a".repeat(40)}:`));
  });

  it("rileva la manomissione dell'artefatto", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "release-"));
    writeFileSync(path.join(directory, "worker.js"), "original");
    const original = digestDirectory(directory);
    writeFileSync(path.join(directory, "worker.js"), "modified");
    assert.notEqual(digestDirectory(directory), original);
  });

  it("non anticipa i checkpoint e ricava le note dalla versione dichiarata", () => {
    assert.throws(() => productionReadiness(""), /Checkpoint/u);
    assert.equal(
      releaseNotes(
        "## [2.0.0-rc.1]\n\nCorrezione verificata.\n\n## 2.0.0-alpha.1\nPrima versione.",
        "2.0.0-rc.1",
      ),
      "Correzione verificata.",
    );
    assert.throws(() => releaseNotes("## 2.0.0\n", "2.0.0"), /vuota/u);
  });

  it("richiede tutti i gate Production del piano, senza duplicati e con prove", () => {
    const heading = "### Gate per la pubblicazione Production\n\n";
    const rows = ["commerciale", "ripristino", "operativita"].map(
      (gate) => `| ${gate} | COMPLETATO | [Prova](https://example.invalid/prova) |`,
    );
    const complete = heading + rows.join("\n") + "\n";
    assert.doesNotThrow(() => productionReadiness(complete));
    const pending = complete
      .replaceAll("COMPLETATO", "DA COMPLETARE")
      .replaceAll("[Prova](https://example.invalid/prova)", "-");
    assert.doesNotThrow(() => productionReadiness(pending, false));
    assert.throws(() => productionReadiness(pending), /Checkpoint/u);
    for (const invalid of [
      pending + rows[0],
      pending.replace("DA COMPLETARE", "SCONOSCIUTO"),
      complete.replace("[Prova](https://example.invalid/prova)", "-"),
    ])
      assert.throws(() => productionReadiness(invalid, false), /Checkpoint/u);
    for (const row of rows) {
      for (const invalid of [
        complete.replace(row, ""),
        complete.replace(row, row.replace("COMPLETATO", "DA COMPLETARE")),
        complete.replace(row, row.replace("COMPLETATO", "COMPLETATO PARZIALMENTE")),
        complete.replace(row, row.replace("[Prova](https://example.invalid/prova)", "")),
        complete.replace(row, row.replace("[Prova](https://example.invalid/prova)", "-")),
        complete + row,
        complete.replace(row, row.slice(0, -1)),
      ])
        assert.throws(() => productionReadiness(invalid), /Checkpoint/u);
    }
    assert.throws(() => productionReadiness(complete + complete), /Checkpoint/u);
    assert.throws(() => productionReadiness(rows.join("\n")), /Checkpoint/u);
    assert.throws(
      () => productionReadiness(heading + "### Altra sezione\n" + rows.join("\n")),
      /Checkpoint/u,
    );
    assert.throws(
      () => productionReadiness(heading + '<a id="altro"></a>\n' + rows.join("\n")),
      /Checkpoint/u,
    );
  });
});

describe("integrità dei documenti", () => {
  it("verifica link, tabelle e decisioni senza un tracker separato", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "docs-")));
    const check = (text) => {
      writeFileSync(path.join(directory, "README.md"), text);
      const result = spawnSync(
        process.execPath,
        ["scripts/verify-docs.mjs", "--root", directory, "--json"],
        { encoding: "utf8" },
      );
      return { status: result.status, ...JSON.parse(result.stdout) };
    };
    try {
      assert.equal(check("# Piano\n\n[Sezione](#piano)\n").status, 0);
      for (const [text, code] of [
        ["[Assente](mancante.md)", "LINK_MISSING"],
        ["[Assente](#mancante)", "LINK_ANCHOR"],
        ['<a id="stato"></a>\n<a id="stato"></a>', "ANCHOR_DUPLICATE"],
        ["| Uno | Due |\n| Uno |\n", "TABLE"],
        ["| D999 | Scelta |\n| D999 | Duplicata |\n", "DECISION_DUPLICATE"],
        ["Riferimento a D999.", "DECISION_REFERENCE"],
      ]) {
        const result = check(text);
        assert.equal(result.status, 1);
        assert.ok(result.errors.some((error) => error.code === code));
      }
      mkdirSync(path.join(directory, "docs"));
      const planFile = path.join(directory, "docs/MASTER_PLAN.md");
      const pending =
        "### Gate per la pubblicazione Production\n\n" +
        ["commerciale", "ripristino", "operativita"]
          .map((gate) => `| ${gate} | DA COMPLETARE | - |`)
          .join("\n");
      writeFileSync(planFile, pending);
      assert.equal(check("# Piano\n").status, 0);
      for (const invalid of [
        "",
        pending.replace("commerciale", "assente"),
        pending.replace("DA COMPLETARE", "COMPLETATO"),
        pending + "\n| commerciale | DA COMPLETARE | - |",
      ]) {
        writeFileSync(planFile, invalid);
        const result = check("# Piano\n");
        assert.equal(result.status, 1);
        assert.ok(result.errors.some((error) => error.code === "PRODUCTION_GATES"));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("base del confronto sui push", () => {
  it("parte dall'ultimo deploy test riuscito, saltando run annullate, fallite e senza deploy", () => {
    const jobs = {
      docs: [{ name: "Deploy test", conclusion: "skipped" }],
      cancelled: [{ name: "Deploy test", conclusion: "cancelled" }],
      failed: [{ name: "Deploy test", conclusion: "failure" }],
      foreign: [{ name: "Deploy test", conclusion: "success" }],
      deployed: [{ name: "Deploy test", conclusion: "success" }],
    };
    const runs = [
      { event: "pull_request", head_sha: "pr" },
      ...Object.keys(jobs).map((sha) => ({ event: "push", head_sha: sha })),
    ];
    const visited = [];
    const sha = lastDeployed(
      runs,
      (run) => (visited.push(run.head_sha), jobs[run.head_sha]),
      (commit) => commit !== "foreign",
    );
    assert.equal(sha, "deployed");
    assert.equal(visited.includes("pr"), false);
    assert.equal(
      lastDeployed(
        runs.slice(0, 4),
        (run) => jobs[run.head_sha] ?? [],
        () => true,
      ),
      undefined,
    );
  });
});

describe("invocazioni osservate durante il collaudo remoto", () => {
  it("riporta solo percorso e tempi, e segnala le invocazioni lente o fallite", () => {
    const request = (url) => ({ url, method: "GET", headers: { cookie: "sessione" } });
    const summary = summarizeInvocations([
      {
        outcome: "ok",
        wallTime: 120,
        cpuTime: 4,
        event: { request: request("https://test.example/?token=x"), response: { status: 200 } },
      },
      {
        outcome: "ok",
        wallTime: 58_000,
        cpuTime: 6,
        event: { request: request("https://test.example/negozi"), response: { status: 200 } },
      },
      {
        outcome: "canceled",
        wallTime: 30,
        cpuTime: 1,
        logs: [{ message: ['{"event":"phase","phase":"start"}', "altro"] }],
        event: { request: request("https://test.example/profilo") },
      },
      { outcome: "ok", event: { scheduledTime: 1 } },
    ]);
    assert.equal(summary.total, 3);
    assert.deepEqual(
      summary.anomalies.map(({ path }) => path),
      ["/negozi", "/profilo"],
    );
    assert.deepEqual(summary.anomalies[1].phases, ["start"]);
    assert.equal(JSON.stringify(summary).includes("sessione"), false);
    assert.equal(JSON.stringify(summary).includes("token"), false);
  });
});

describe("esito dei mutation test", () => {
  it("allinea ID, nomi annidati e filtro del runner a Vitest 5", async () => {
    const runner = import.meta.resolve("@stryker-mutator/vitest-runner");
    const { collectTestName, toRawTestId } = await import(new URL("./test-helpers.js", runner));
    const { convertTestToTestResult, fromTestId } = await import(
      new URL("./vitest-helpers.js", runner)
    );
    const test = {
      name: "somma [2 + 3]",
      suite: { name: "add", suite: { name: "math (numbers)" } },
      file: { filepath: path.resolve("test/runner.spec.ts") },
      mode: "run",
      result: { state: "pass", duration: 1 },
    };
    const name = "math (numbers) > add > somma [2 + 3]";
    const result = convertTestToTestResult(test, " > ");
    assert.equal(collectTestName(test, " > "), name);
    assert.equal(toRawTestId(test, " > "), `${test.file.filepath}#${name}`);
    assert.deepEqual(fromTestId(result.id), { file: "test/runner.spec.ts", test: name });
    assert.equal(result.name, name);
    assert.equal(collectTestName(test), "math (numbers) add somma [2 + 3]");
  });

  const mutant = (status, statusReason) => ({
    mutatorName: "ConditionalExpression",
    status,
    statusReason,
    location: { start: { line: 3, column: 4 } },
  });
  const report = (...mutants) => ({ files: { "app/grants.server.ts": { mutants } } });

  it("accetta mutanti uccisi ed equivalenze motivate", () => {
    assert.deepEqual(
      evaluate(report(mutant("Killed"), mutant("Ignored", "equivalente: ordine irrilevante"))),
      [],
    );
  });

  it("non considera successo sopravvissuti, timeout, errori o esclusioni senza motivo", () => {
    const statuses = ["Survived", "NoCoverage", "Timeout", "RuntimeError", "CompileError"];
    assert.equal(
      evaluate(report(...statuses.map((status) => mutant(status)), mutant("Ignored"))).length,
      6,
    );
    assert.deepEqual(evaluate(report(mutant("Timeout"))), [
      "app/grants.server.ts:3:5: ConditionalExpression Timeout",
    ]);
  });

  it("fallisce se non viene generato alcun mutante", () => {
    assert.deepEqual(evaluate({ files: {} }), ["nessun mutante generato"]);
  });

  it("riusa il contesto solo quando dipendenze, test, fixture, configurazione e runtime coincidono", () => {
    const target = "app/grants.server.ts";
    const files = [
      { path: target, text: "return true" },
      { path: "app/helper.ts", text: "helper" },
      { path: "test/grants.spec.ts", text: "assertion" },
      { path: "test/setup.ts", text: "fixture" },
      { path: "pnpm-lock.yaml", text: "dependencies" },
      { path: "vitest.config.ts", text: "config" },
      { path: "docs/brand/logo.svg", text: "asset" },
      { path: "docs/MASTER_PLAN.md", text: "stato" },
    ];
    const base = identity(target, files, "node|linux|x64");
    for (const path of [
      "app/helper.ts",
      "test/grants.spec.ts",
      "test/setup.ts",
      "pnpm-lock.yaml",
      "vitest.config.ts",
      "docs/brand/logo.svg",
    ]) {
      const changed = files.map((file) =>
        file.path === path ? { ...file, text: "changed" } : file,
      );
      assert.notEqual(identity(target, changed, "node|linux|x64").prefix, base.prefix);
    }
    assert.notEqual(identity(target, files, "other-runtime").prefix, base.prefix);
    const changedSource = identity(
      target,
      files.map((file) => (file.path === target ? { ...file, text: "return false" } : file)),
      "node|linux|x64",
    );
    assert.notEqual(changedSource.prefix, base.prefix);
    assert.notEqual(changedSource.key, base.key);
    // Il mutante può restare uguale mentre cambia un helper nello stesso file.
    const helperBefore = [{ path: target, text: "const helper = true; return helper || false" }];
    const helperAfter = [{ path: target, text: "const helper = false; return helper || false" }];
    assert.notEqual(
      identity(target, helperBefore, "node|linux|x64").prefix,
      identity(target, helperAfter, "node|linux|x64").prefix,
    );
    assert.deepEqual(identity(target, [...files].reverse(), "node|linux|x64"), base);
    assert.deepEqual(
      identity(
        target,
        files.map((file) => (file.path.endsWith(".md") ? { ...file, text: "nuovo stato" } : file)),
        "node|linux|x64",
      ),
      base,
    );
    assert.throws(() => identity("missing", files));
  });

  it("rifiuta ricevute incompatibili, parziali, vuote o con mutanti non uccisi", () => {
    const target = "app/grants.server.ts";
    const expected = { target, key: "verified-inputs" };
    const source = "source";
    const complete = { files: { [target]: { source, mutants: [mutant("Killed")] } } };
    const receipt = {
      ...expected,
      passed: true,
      reportDigest: createHash("sha256").update(JSON.stringify(complete)).digest("hex"),
    };
    assert.doesNotThrow(() => checkReceipt(expected, receipt, complete, source));
    for (const invalid of [
      { ...receipt, key: "old-inputs" },
      { ...receipt, target: "other" },
      { ...receipt, passed: false },
    ])
      assert.throws(() => checkReceipt(expected, invalid, complete, source));
    assert.throws(() => checkReceipt(expected, receipt, complete, "changed-source"));
    assert.throws(() =>
      checkReceipt(expected, { ...receipt, reportDigest: "changed" }, complete, source),
    );
    assert.throws(() => checkReceipt(expected, receipt, { files: {} }, source));
    assert.throws(() =>
      checkReceipt(expected, receipt, { files: { [target]: { source, mutants: [] } } }, source),
    );
    assert.throws(() =>
      checkReceipt(
        expected,
        receipt,
        { files: { [target]: { source, mutants: [mutant("Survived")] } } },
        source,
      ),
    );
  });

  it("riusa solo artefatti non scaduti del modulo verificato nello stesso repository", () => {
    const candidate = { expired: false, workflow_run: { repository_id: 1, head_repository_id: 1 } };
    const run = { path: ".github/workflows/ci.yml", conclusion: "failure" };
    const target = "app/auth-route.server.ts";
    const job = { name: `Mutation / ${target}`, conclusion: "success" };
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 1, target), true);
    assert.equal(
      verifiedMutationOrigin({ ...candidate, expired: true }, run, [job], 1, target),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 2, target), false);
    assert.equal(
      verifiedMutationOrigin(
        { ...candidate, workflow_run: { repository_id: 1, head_repository_id: 2 } },
        run,
        [job],
        1,
        target,
      ),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, { path: "other.yml" }, [job], 1, target), false);
    assert.equal(
      verifiedMutationOrigin(candidate, run, [{ ...job, conclusion: "failure" }], 1, target),
      false,
    );
    assert.equal(
      verifiedMutationOrigin(candidate, run, [{ ...job, conclusion: "cancelled" }], 1, target),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 1, "app/other.server.ts"), false);
  });
});

describe("budget del JavaScript client", () => {
  const run = (bytes) => {
    const directory = mkdtempSync(path.join(tmpdir(), "bundle-"));
    // Byte casuali: gzip non li comprime, quindi la dimensione misurata è nota.
    writeFileSync(path.join(directory, "entry.js"), randomBytes(bytes));
    return spawnSync(process.execPath, ["scripts/check-bundle-size.mjs", directory]).status;
  };

  it("accetta un bundle entro budget", () => assert.equal(run(100 * 1024), 0));
  it("fa fallire la build oltre budget", () => assert.equal(run((budgetKiB + 10) * 1024), 1));
});

describe("prove browser divise fra macchine", () => {
  const listing = {
    suites: [
      {
        file: "lente.spec.ts",
        specs: ["a", "b", "c"].map((title) => ({ title, tests: [{ projectName: "chromium" }] })),
        suites: [
          {
            title: "gruppo",
            specs: [{ title: "d", tests: [{ projectName: "webkit" }] }],
          },
        ],
      },
      {
        file: "rapide.spec.ts",
        specs: ["e", "f"].map((title) => ({ title, tests: [{ projectName: "chromium" }] })),
      },
    ],
  };

  it("assegna le prove a turno, ciascuna a un solo shard", () => {
    assert.deepEqual(shardTests(listing, 1, 2), [
      "[chromium] › lente.spec.ts › a",
      "[chromium] › lente.spec.ts › c",
      "[chromium] › rapide.spec.ts › e",
    ]);
    assert.deepEqual(shardTests(listing, 2, 2), [
      "[chromium] › lente.spec.ts › b",
      "[webkit] › lente.spec.ts › gruppo › d",
      "[chromium] › rapide.spec.ts › f",
    ]);
  });
});

describe("eventi di wrangler tail", () => {
  it("separa gli oggetti JSON anche spezzati fra più blocchi", () => {
    const parse = jsonObjects();
    assert.deepEqual(parse('{"a":"}{"}\n{"b":'), [{ a: "}{" }]);
    assert.deepEqual(parse("{}}\n"), [{ b: {} }]);
  });
});

describe("confronto fiscale eBay senza dati privati", () => {
  const tax = { type: "CODICE_FISCALE", value: "VALORE-PRIVATO-SINTETICO", issuingCountry: "IT" };
  function fixture({
    marketplaces = ["EBAY_IT"],
    fulfillment = [tax],
    trading = [tax],
    orderFound = true,
    failure,
    change = false,
  } = {}) {
    const access = {
      configuration: { apiOrigin: "https://api.ebay.com" },
      accessToken: "TOKEN-PRIVATO",
      fetcher: async () => {},
    };
    const client = {
      async readFulfillmentOrder(measured, id, options) {
        await measured.fetcher(`https://api.ebay.com/sell/fulfillment/v1/order/${id}`);
        if (failure) throw { failure, message: tax.value };
        return {
          orderId: id,
          creationDate: "2026-09-01T00:00:00Z",
          lastModifiedDate:
            options.marketplaceId && change ? "2026-09-02T00:00:00Z" : "2026-09-01T00:00:00Z",
          lineItems: marketplaces.map((listingMarketplaceId) => ({ listingMarketplaceId })),
          tax: options.marketplaceId ? fulfillment : [],
        };
      },
      fulfillmentTaxIdentifiers: (payload) => payload.tax,
      async readTradingTaxObservation(measured) {
        await measured.fetcher("https://api.ebay.com/ws/api.dll");
        return { orderFound, values: trading };
      },
    };
    return (ids = ["ORDINE-PRIVATO"]) =>
      compareEbayTax(
        { environment: "production", orderIds: ids },
        access,
        client,
        Date.parse("2026-10-09T00:00:00Z"),
      );
  }

  it("confronta tipo, valore e Paese, deduplica e misura le chiamate senza riportare valori o ID", async () => {
    const report = await fixture({ trading: [tax, tax] })();
    assert.deepEqual(report.calls, { fulfillment: 2, trading: 1 });
    assert.deepEqual(report.rows, [
      {
        sample: 1,
        marketplace: "EBAY_IT",
        age: "15-90",
        outcome: "equal",
        withoutHeader: 0,
        fulfillment: 1,
        trading: 1,
        countryComplete: true,
      },
    ]);
    assert.equal(report.supportsReview, true);
    for (const secret of [tax.value, "ORDINE-PRIVATO", "TOKEN-PRIVATO"])
      assert.ok(!JSON.stringify(report).includes(secret));
    for (const other of [
      { ...tax, value: "ALTRO" },
      { ...tax, type: "VAT_ID" },
      { ...tax, issuingCountry: "ES" },
    ]) {
      assert.equal((await fixture({ trading: [other] })()).rows[0].outcome, "different");
    }
    const unknownCountry = await fixture({ trading: [{ ...tax, issuingCountry: null }] })();
    assert.equal(unknownCountry.rows[0].countryComplete, false);
  });

  it("non dichiara equivalenza da assenze, ordini non restituiti o marketplace ambigui", async () => {
    for (const [options, outcome] of [
      [{ fulfillment: [], trading: [] }, "both_absent"],
      [{ fulfillment: [], orderFound: false }, "trading_order_unavailable"],
      [{ marketplaces: [] }, "marketplace_unresolved"],
      [{ marketplaces: [null] }, "marketplace_unresolved"],
      [{ marketplaces: ["EBAY_IT", null] }, "marketplace_unresolved"],
      [{ marketplaces: ["EBAY_IT", "EBAY_ES"] }, "marketplace_unresolved"],
      [{ fulfillment: [] }, "different"],
    ]) {
      const report = await fixture(options)();
      assert.equal(report.rows[0].outcome, outcome);
      assert.equal(report.supportsReview, false);
      if (outcome === "marketplace_unresolved")
        assert.deepEqual(report.calls, { fulfillment: 1, trading: 0 });
    }
  });

  it("ferma il campione per errori globali e non espone il messaggio del provider", async () => {
    for (const failure of [
      "credentials",
      "rate_limited",
      "unavailable",
      "invalid_response",
      "rejected",
      "INATTESO-PRIVATO",
    ]) {
      const report = await fixture({ failure })(["uno", "due"]);
      const stops = ["credentials", "rate_limited", "unavailable"].includes(failure);
      assert.equal(report.rows[1].outcome, stops ? "not_read" : "error");
      assert.equal(report.calls.fulfillment, stops ? 1 : 2);
      assert.ok(!JSON.stringify(report).includes(tax.value));
      assert.ok(!JSON.stringify(report).includes("INATTESO-PRIVATO"));
    }
    assert.equal((await fixture({ change: true })()).rows[0].outcome, "error");
  });

  it("rifiuta campioni vuoti, duplicati, troppo grandi e ambiente discordante prima della rete", async () => {
    for (const ids of [[], ["uno", "uno"], Array.from({ length: 51 }, (_, i) => String(i))])
      await assert.rejects(fixture()(ids));
    await assert.rejects(
      compareEbayTax(
        { environment: "sandbox", orderIds: ["uno"] },
        { configuration: { apiOrigin: "https://api.ebay.com" } },
        {},
      ),
    );
  });

  it("esegue la CLI e gli adapter reali con rete sintetica, senza persistenza né dati nell'output", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fiscalbay-tax-"));
    try {
      const preload = path.join(dir, "fetch.mjs");
      writeFileSync(
        preload,
        `globalThis.fetch = async (url, init) => {
        if (String(url).endsWith('/ws/api.dll')) return new Response('<GetOrdersResponse><Ack>Success</Ack><Order><OrderID>ordine-privato</OrderID><BuyerTaxIdentifier><ID>valore-privato</ID><Type>CODICE_FISCALE</Type></BuyerTaxIdentifier></Order></GetOrdersResponse>');
        const header = new Headers(init.headers).get('X-EBAY-C-MARKETPLACE-ID');
        if (new URL(url).search !== '?fieldGroups=TAX_BREAKDOWN') throw Error('campo mancante');
        return Response.json({ orderId: 'ordine-privato', creationDate: '2026-09-01T00:00:00Z', lastModifiedDate: '2026-09-01T00:00:00Z', lineItems: [{ listingMarketplaceId: 'EBAY_IT' }], buyer: header === 'EBAY_IT' ? { taxIdentifier: { taxpayerId: 'valore-privato', taxIdentifierType: 'CODICE_FISCALE' } } : {} });
      };`,
      );
      const result = spawnSync(
        process.execPath,
        ["--import", preload, "scripts/compare-ebay-tax.mjs"],
        {
          input: JSON.stringify({ environment: "production", orderIds: ["ordine-privato"] }),
          env: { ...process.env, EBAY_ACCESS_TOKEN: "token-privato" },
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).rows[0].outcome, "equal");
      for (const value of ["ordine-privato", "valore-privato", "token-privato"])
        assert.ok(!(result.stdout + result.stderr).includes(value));
      const invalid = spawnSync(process.execPath, ["scripts/compare-ebay-tax.mjs"], {
        input: '{"ordine":"privato"}',
        encoding: "utf8",
        timeout: 10_000,
      });
      assert.equal(invalid.status, 1);
      assert.ok(!invalid.stderr.includes('"ordine"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
