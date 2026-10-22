import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { budgetKiB } from "./check-bundle-size.mjs";
import { coverageSummary } from "./coverage-report.mjs";
import { benchmarkSummary, comparableDependencies, extractBenchmarkSources } from "./benchmark.mjs";
import { shardTests, listedTestIds, assertCandidateReports } from "./browser-tests.mjs";
import {
  changedLines,
  classifyFile,
  plan as changePlan,
  gateCommands,
} from "./classify-changes.mjs";
import { missingPages, missingSections, routePatterns } from "./verify-pages.mjs";
import {
  declaredReview,
  migrationPlan,
  reviewAdded,
  publish,
  productionReadiness,
  assertResume,
  digestDirectory,
  assertAppliedMigrations,
  receiptArtifact,
  readReceipt,
  releaseIdentity,
  retryReadback,
} from "./release/release.mjs";
import { releaseNotes, assertBrowserEvidence } from "./release/release-notes.mjs";
import { expectedPageError, knownPagePath } from "../e2e/page-cases.ts";
import {
  checkReceipt,
  evaluate,
  identity,
  mutationInputs,
  mutationConcurrency,
  parseTarget,
  verifiedMutationOrigin,
} from "./mutation.mjs";
import { verifiedBuildOrigin } from "./find-build.mjs";
import { strykerPlugins as mutationPlugins } from "./mutation-vitest.mjs";
import {
  assertBase,
  waitUpdatedHead,
  candidateRef,
  runTimings,
  assertCycleReceipt,
  checkCycleJobs,
  assertRemoteEvidence,
  assertPublishedRelease,
  squashIntegrated,
  cleanup,
  effectiveProductionVariable,
} from "./release/release-cycle.mjs";
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

describe("report di qualità", () => {
  it("estrae i sorgenti benchmark oltre un MiB senza il buffer stdout", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "benchmark-sources-"));
    try {
      const repository = path.join(directory, "repository");
      const output = path.join(directory, "output");
      mkdirSync(path.join(repository, "app"), { recursive: true });
      mkdirSync(output);
      const source = "x".repeat(2 * 1024 * 1024);
      writeFileSync(path.join(repository, "app/source.txt"), source);
      const git = (...args) => {
        const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      };
      git("init", "-q");
      git("add", "app");
      const tree = git("write-tree");
      extractBenchmarkSources(repository, tree, output);
      assert.equal(readFileSync(path.join(output, "app/source.txt"), "utf8"), source);
      assert.throws(() => readFileSync(path.join(output, "sources.tar")), { code: "ENOENT" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rifiuta copertura vuota, conteggi incoerenti e sorgenti omessi", () => {
    const metric = { total: 10, covered: 4, pct: 40 };
    const total = Object.fromEntries(
      ["lines", "branches", "functions", "statements"].map((name) => [name, metric]),
    );
    assert.match(coverageSummary({ total }), /4 \/ 10/u);
    assert.throws(() => coverageSummary({}), /Copertura incompleta/u);
    assert.throws(
      () => coverageSummary({ total: { ...total, lines: { ...metric, covered: 11 } } }),
      /Copertura incompleta/u,
    );
    assert.throws(() => coverageSummary({ total }, ["app/missing.ts"]), /File assenti/u);
    assert.doesNotThrow(() =>
      coverageSummary({ total, [path.resolve("app/included.ts")]: {} }, ["app/included.ts"]),
    );
  });

  it("confronta misure valide e rifiuta raccolte mancanti o incompatibili", () => {
    assert.match(benchmarkSummary({ csv: [2, 3, 1] }, { csv: [1, 1, 1] }), /100\.0%/u);
    assert.match(
      benchmarkSummary({ csv: [1, 2, 3] }, undefined, "toolchain diversa"),
      /toolchain diversa/u,
    );
    for (const samples of [{}, { csv: [] }, { csv: [NaN] }, { csv: [0] }])
      assert.throws(() => benchmarkSummary(samples), /Misure benchmark/u);
    assert.throws(() => benchmarkSummary({ csv: [1] }, { zip: [1] }), /Misure benchmark/u);
    assert.throws(() => benchmarkSummary({ csv: [1] }, { csv: [Infinity] }), /Misure benchmark/u);
    const base = {
      dependencies: { a: "1", b: "2" },
      devDependencies: { vitest: "5" },
      engines: { node: "26" },
    };
    assert.equal(comparableDependencies(base, { ...base, dependencies: { b: "2", a: "1" } }), true);
    assert.equal(comparableDependencies(base, { ...base, dependencies: { a: "2" } }), false);
    assert.equal(
      comparableDependencies(base, { ...base, devDependencies: { vitest: "6" } }),
      false,
    );
    assert.equal(comparableDependencies(base, { ...base, engines: { node: "27" } }), false);
  });

  it("seleziona benchmark per consumatori, fixture e toolchain senza attivare deploy", () => {
    for (const file of [
      "benchmarks/orders.bench.ts",
      "scripts/benchmark.mjs",
      "vitest.benchmark.config.ts",
      "knip.json",
    ]) {
      const result = changePlan([file]);
      assert.equal(result.deploy, false);
      assert.equal(result.build, false);
      assert.equal(result.gate, "tooling");
      assert.equal(result.benchmark, file !== "knip.json");
    }
    assert.equal(changePlan(["README.md"]).benchmark, false);
    assert.equal(changePlan(["package.json"]).benchmark, true);
    const sources = [
      { path: "app/shared.ts", text: "export const value = 1;" },
      {
        path: "app/money.ts",
        text: 'import { value } from "./shared"; export const money = value;',
      },
      {
        path: "benchmarks/orders.bench.ts",
        text: 'import { money } from "../app/money"; console.log(money);',
      },
    ];
    assert.equal(changePlan(["app/shared.ts"], sources).benchmark, true);
    assert.equal(changePlan(["test/orders.spec.ts"]).benchmark, false);
    assert.ok(
      gateCommands(changePlan(["test/orders.spec.ts"])).some(
        ([, args]) => args[0] === "test:coverage",
      ),
    );
  });
});

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
      "app/domain/order-sync.server.ts",
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

  it("limita le mutation ai moduli critici modificati e, nel candidato, ai consumatori critici", () => {
    const files = [
      { path: "app/i18n.ts", text: "" },
      { path: "app/domain/stores.server.ts", text: 'import { t } from "../i18n";' },
      {
        path: "app/auth.server.ts",
        text: 'import { t } from "./i18n";\nimport { load } from "./domain/stores.server";',
      },
    ];
    assert.deepEqual(changePlan(["app/i18n.ts"], files).mutation, []);
    assert.deepEqual(changePlan(["app/domain/stores.server.ts"], files).mutation, [
      "app/domain/stores.server.ts",
    ]);
    assert.deepEqual(changePlan(["app/domain/stores.server.ts"], files, true).mutation.sort(), [
      "app/auth.server.ts",
      "app/domain/stores.server.ts",
    ]);
  });

  it("muta nelle PR le sole righe cambiate e nel candidato il modulo intero", () => {
    const file = "app/domain/stores.server.ts";
    assert.deepEqual(
      changePlan([file], [], false, {
        [file]: [
          [3, 5],
          [10, 12],
        ],
      }).mutation,
      [`${file}:3-5,10-12`],
    );
    assert.deepEqual(changePlan([file], [], false, { [file]: [] }).mutation, []);
    assert.deepEqual(changePlan([file], [], true, { [file]: [[3, 5]] }).mutation, [file]);
  });
  it("include il controllo fiscale fra i moduli critici e usa le sue prove unitarie", () => {
    const target = "app/tax-quality.ts";
    const files = [
      { path: target, text: "export const taxQuality = () => true;" },
      {
        path: "test/ebay-adapters.unit.ts",
        text: 'import { taxQuality } from "../app/tax-quality";',
      },
      { path: "test/orders.spec.ts", text: 'import { taxQuality } from "../app/tax-quality";' },
    ];
    assert.deepEqual(changePlan([target], files).mutation, [target]);
    assert.deepEqual(mutationInputs(target, files).tests, ["test/ebay-adapters.unit.ts"]);
  });

  it("ricava le righe cambiate da un diff senza contesto", () => {
    const diff = [
      "@@ -10,2 +10,3 @@ a",
      "@@ -20 +21 @@ b",
      "@@ -40,3 +41,0 @@ c",
      "@@ -60,0 +60,1 @@ d",
    ].join("\n");
    assert.deepEqual(changedLines(diff), [
      [10, 12],
      [21, 21],
      [41, 42],
      [60, 60],
    ]);
    assert.deepEqual(changedLines("@@ -1,1 +0,0 @@"), [[1, 1]]);
    assert.deepEqual(changedLines("@@ -5 +5 @@\n@@ -8 +8,2 @@"), [[5, 9]]);
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
    assert.deepEqual(changePlan(["app/integrations/webhooks.server.ts"]).mutation, [
      "app/integrations/webhooks.server.ts",
    ]);
    assert.deepEqual(changePlan(["app/integrations/ebay/notifications.server.ts"]).mutation, [
      "app/integrations/ebay/notifications.server.ts",
    ]);
    for (const file of ["workers/app.ts", "cloudflare.config.ts", "test/webhooks.spec.ts"])
      assert.deepEqual(changePlan([file]).mutation, [
        "app/integrations/webhooks.server.ts",
        "app/integrations/ebay/notifications.server.ts",
      ]);
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
      "scripts/release/release.mjs",
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
      "cloudflare.config.ts",
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
    assert.equal(changePlan(["scripts/release/release.mjs"]).promotionReuse, false);
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
    assert.deepEqual(commands(["scripts/release/release.mjs"]), ["verify:tooling"]);
    assert.deepEqual(commands(["doctor.config.json"]), ["verify:tooling", "doctor:react"]);
    assert.deepEqual(commands(["test/orders.spec.ts"]), [
      "verify:tooling",
      "verify:pages",
      "typecheck",
      "test:coverage",
      "build",
    ]);
    for (const files of [["app/new-module.ts"], ["scripts/unknown.mjs"], []]) {
      assert.equal(changePlan(files).doctor, true);
      assert.ok(commands(files).includes("doctor:react"));
    }
    assert.ok(commands(["scripts/release/release.mjs"], [], true).includes("doctor:react"));

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
        "test:coverage",
        "build:placeholder",
        "build:live",
        "build",
        "doctor:react",
        "benchmark",
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("ricompila la pagina provvisoria solo per i suoi input o un perimetro completo", () => {
    assert.equal(changePlan(["app/domain/orders.server.ts"]).placeholder, false);
    assert.equal(changePlan(["test/orders.spec.ts"]).live, false);
    for (const file of [
      "placeholder/cloudflare.config.ts",
      "package.json",
      "pnpm-lock.yaml",
      "scripts/unknown.mjs",
      "new.bin",
    ])
      assert.equal(changePlan([file]).placeholder, true);
    assert.equal(changePlan(["README.md"], [], true).placeholder, true);
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
  it("ignora errori HTTP attesi solo del documento corrente o dei suoi dati", () => {
    const page = new URL("https://test.example.invalid/non-esiste?x=1");
    const message = "Failed to load resource: the server responded with a status of 404";
    for (const resource of [page.href, `${page.origin}/non-esiste.data?x=2`])
      assert.equal(expectedPageError(message, resource, 404, page), true);
    for (const [text, resource, status] of [
      [message, page.href, 200],
      [message, "https://external.example.invalid/non-esiste", 404],
      [message, `${page.origin}/non-esiste.data-other`, 404],
      [message, "", 404],
      [message, "not a URL", 404],
      ["Failed to load resource: status of 500", page.href, 404],
      [message, page.href, 500],
    ])
      assert.equal(expectedPageError(text, resource, status, page), false);
  });

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

  it("chiede nella PR il digest delle migration non additive aggiunte", () => {
    const additive = { name: "a.sql", digest: "a", sql: "CREATE TABLE example (id TEXT);" };
    const unsafe = { name: "b.sql", digest: "b", sql: "UPDATE example SET id = 1;" };
    assert.equal(reviewAdded([additive], ""), "");
    let digest;
    try {
      reviewAdded([additive, unsafe], "");
    } catch (error) {
      assert.match(error.message, /b\.sql/u);
      digest = error.message.match(/reviewed-migrations: ([0-9a-f]{64})/u)[1];
    }
    // Lo stesso digest sblocca il deploy test quando restano pendenti le sole migration della PR.
    assert.throws(() => migrationPlan([additive, unsafe], []), new RegExp(`Digest ${digest}`, "u"));
    const body = `Descrizione\n\nreviewed-migrations: ${digest}\n`;
    assert.equal(declaredReview(body), digest);
    assert.equal(reviewAdded([additive, unsafe], body), digest);
    assert.equal(migrationPlan([additive, unsafe], [], declaredReview(body)).pending.length, 2);
    assert.throws(
      () => reviewAdded([additive, { ...unsafe, digest: "changed" }], body),
      /approvare prima del merge/u,
    );
    assert.equal(declaredReview(undefined), "");
    assert.equal(declaredReview(`testo reviewed-migrations: ${digest}`), "");
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
  it("esclude repository e worktree annidati dalla scansione", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "docs-nested-")));
    try {
      writeFileSync(path.join(directory, "README.md"), "# Piano\n");
      for (const name of ["repository", "worktree"]) {
        const nested = path.join(directory, ".claude", "worktrees", name);
        mkdirSync(nested, { recursive: true });
        if (name === "repository") mkdirSync(path.join(nested, ".git"));
        else writeFileSync(path.join(nested, ".git"), "gitdir: /tmp/example.invalid\n");
        writeFileSync(path.join(nested, "README.md"), "[Assente](mancante.md)\n");
      }
      const result = spawnSync(
        process.execPath,
        ["scripts/verify-docs.mjs", "--root", directory, "--json"],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(JSON.parse(result.stdout).stats.markdown_files, 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
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
  it("limita i runner alle CPU e alla memoria senza azzerare l'esecuzione", () => {
    const gib = 1024 ** 3;
    assert.equal(mutationConcurrency(4, 8, 8 * gib), 2);
    assert.equal(mutationConcurrency(4, 4, 16 * gib), 4);
    assert.equal(mutationConcurrency(4, 2, 16 * gib), 2);
    assert.equal(mutationConcurrency(4, 8, 2 * gib), 1);
    assert.equal(mutationConcurrency(1, 8, 32 * gib), 1);
  });
  it("usa il fallback nativo per ricaricare i runner e conserva il contratto di injection", () => {
    const plugin = mutationPlugins[0];
    const runner = { capabilities: () => ({ reloadEnvironment: true }), marker: "native" };
    const injector = { provideValue: () => ({ injectClass: () => runner }) };
    assert.equal(plugin.factory(injector), runner);
    assert.deepEqual(runner.capabilities(), { reloadEnvironment: false });
    assert.equal(runner.marker, "native");
    assert.equal(plugin.factory.inject.length, 1);
  });
  it("firma sorgente completo, consumatori, fixture e strumenti senza invalidare per moduli estranei", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: 'import { value } from "./helper"; export const grant = () => value;' },
      { path: "app/domain/helper.ts", text: "export const value = true;" },
      { path: "test/grants.spec.ts", text: 'import { grant } from "../app/domain/grants.server";' },
      { path: "test/setup.ts", text: "fixture" },
      { path: "test/other.spec.ts", text: 'import { other } from "../app/other";' },
      { path: "app/other.ts", text: "export const other = true;" },
      { path: "scripts/mutation.mjs", text: "runner" },
      { path: "pnpm-lock.yaml", text: "dependencies" },
      { path: "migrations/example.sql", text: "CREATE TABLE example (id TEXT);" },
      { path: "docs/MASTER_PLAN.md", text: "stato" },
    ];
    assert.equal(mutationInputs(target, files).mode, "targeted");
    assert.deepEqual(mutationInputs(target, files).tests, ["test/grants.spec.ts"]);
    const base = identity(target, files, "runtime");
    for (const changed of [
      target,
      "app/domain/helper.ts",
      "test/grants.spec.ts",
      "test/setup.ts",
      "scripts/mutation.mjs",
      "pnpm-lock.yaml",
      "migrations/example.sql",
    ]) {
      assert.notEqual(
        identity(
          target,
          files.map((file) =>
            file.path === changed ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
        changed,
      );
    }
    for (const changed of ["app/other.ts", "test/other.spec.ts", "docs/MASTER_PLAN.md"]) {
      assert.equal(
        identity(
          target,
          files.map((file) =>
            file.path === changed ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
        changed,
      );
    }
    const newConsumer = {
      path: "test/another.spec.ts",
      text: 'import { grant } from "../app/domain/grants.server";',
    };
    assert.notEqual(identity(target, [...files, newConsumer], "runtime").key, base.key);
    const indirectConsumer = {
      path: "app/facade.ts",
      text: 'export { grant } from "./domain/grants.server";',
    };
    assert.deepEqual(
      mutationInputs(target, [
        ...files,
        indirectConsumer,
        { path: "test/facade.spec.ts", text: 'import { grant } from "../app/facade";' },
      ]).tests,
      ["test/facade.spec.ts", "test/grants.spec.ts"],
    );
    assert.equal(
      mutationInputs(
        target,
        files.filter((file) => file.path !== "app/domain/helper.ts"),
      ).mode,
      "full",
    );
    for (const text of [
      "const module = await import(name);",
      "const module = require(name);",
      'const modules = import.meta.glob("./*.ts");',
    ])
      assert.equal(
        mutationInputs(target, [...files, { path: "test/dynamic.spec.ts", text }]).mode,
        "full",
      );
  });

  it("conserva alias e mock locali nella firma mutation", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: 'import { value } from "~/helper";' },
      { path: "app/helper.ts", text: "export const value = true;" },
      { path: "test/grants.spec.ts", text: 'vi.mock("../app/domain/grants.server", () => ({}));' },
    ];
    assert.deepEqual(mutationInputs(target, files).tests, ["test/grants.spec.ts"]);
    assert.ok(mutationInputs(target, files).files.some((file) => file.path === "app/helper.ts"));
    assert.equal(
      mutationInputs(target, [
        ...files,
        { path: "test/dynamic.spec.ts", text: "vi.mock(moduleName, () => ({}));" },
      ]).mode,
      "full",
    );
    assert.equal(
      mutationInputs(target, [
        ...files,
        {
          path: "tsconfig.json",
          text: JSON.stringify({ compilerOptions: { paths: { "@/*": ["app/*"] } } }),
        },
      ]).mode,
      "full",
    );
    const types = files.map((file) =>
      file.path === target
        ? {
            ...file,
            text: 'import type { Unknown } from "./+types/grants";\n// import type is unrelated to runtime imports\nimport { value } from "~/helper";',
          }
        : file,
    );
    assert.equal(mutationInputs(target, types).mode, "targeted");
    assert.ok(mutationInputs(target, types).files.some((file) => file.path === "app/helper.ts"));
  });

  it("firma anche le dipendenze transitive del setup e dei file di configurazione", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: "export const grant=true;" },
      { path: "test/grants.spec.ts", text: 'import {grant} from "../app/domain/grants.server";' },
      { path: "test/apply-migrations.ts", text: 'import {seed} from "../app/seed";' },
      { path: "app/seed.ts", text: 'export {fixture} from "./fixture";' },
      { path: "app/fixture.ts", text: "export const fixture=true;" },
      {
        path: "vitest.unit.config.ts",
        text: 'import {settings} from "./scripts/test-settings.mjs";',
      },
      { path: "scripts/test-settings.mjs", text: 'import {config} from "../app/config";' },
      { path: "app/config.ts", text: "export const config=true;" },
    ];
    const base = identity(target, files, "runtime");
    for (const path of ["app/seed.ts", "app/fixture.ts", "app/config.ts"]) {
      assert.ok(mutationInputs(target, files).files.some((file) => file.path === path));
      assert.notEqual(
        identity(
          target,
          files.map((file) =>
            file.path === path ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
      );
    }
  });

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

  it("fallisce se non viene generato alcun mutante, salvo righe cambiate senza codice", () => {
    assert.deepEqual(evaluate({ files: {} }), ["nessun mutante generato"]);
    assert.deepEqual(evaluate({ files: {} }, true), []);
    assert.equal(evaluate(report(mutant("Survived")), true).length, 1);
  });

  it("traduce gli intervalli in voci Stryker senza ricevute del modulo intero", () => {
    assert.deepEqual(parseTarget("app/grants.server.ts"), {
      file: "app/grants.server.ts",
      ranged: false,
      mutate: ["app/grants.server.ts"],
    });
    assert.deepEqual(parseTarget("app/grants.server.ts:3-5,9-9"), {
      file: "app/grants.server.ts",
      ranged: true,
      mutate: ["app/grants.server.ts:3-5", "app/grants.server.ts:9-9"],
    });
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

describe("coordinamento e provenienza della pubblicazione", () => {
  it("rilegge le variabili effettive senza usare un fallback per errori di accesso", () => {
    const calls = [];
    const read = (endpoint) => {
      calls.push(endpoint);
      if (endpoint.includes("environments/"))
        throw Object.assign(new Error("not found"), { stderr: "HTTP 404" });
      return "approved";
    };
    assert.equal(
      effectiveProductionVariable(read, "example/project", "OWNER_APPROVED_SHA"),
      "approved",
    );
    assert.deepEqual(calls, [
      "repos/example/project/environments/production/variables/OWNER_APPROVED_SHA",
      "repos/example/project/actions/variables/OWNER_APPROVED_SHA",
    ]);
    assert.equal(
      effectiveProductionVariable(() => "environment", "example/project", "OWNER_APPROVED_SHA"),
      "environment",
    );
    let count = 0;
    assert.throws(() =>
      effectiveProductionVariable(
        () => {
          count++;
          throw new Error("HTTP 403");
        },
        "example/project",
        "OWNER_APPROVED_SHA",
      ),
    );
    assert.equal(count, 1);
  });

  it("prova l'integrazione squash sul tree completo preservando differenze e lavoro aggiunto", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-git-"));
    const run = (...args) => {
      const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run("init", "-q", "--initial-branch=develop");
      run("config", "user.name", "Synthetic test");
      run("config", "user.email", "test@example.invalid");
      writeFileSync(path.join(directory, "value.js"), "export const value=false;\n");
      run("add", ".");
      run("commit", "-qm", "base");
      run("switch", "-c", "codex/feature");
      writeFileSync(path.join(directory, "value.js"), "export const value=true;\n");
      run("add", ".");
      run("commit", "-qm", "feature");
      const head = run("rev-parse", "HEAD");
      run("switch", "develop");
      writeFileSync(path.join(directory, "concurrent.js"), "export const other=true;\n");
      run("add", ".");
      run("commit", "-qm", "independent change");
      run("merge", "--squash", "codex/feature");
      run("commit", "-qm", "squash");
      const merged = run("rev-parse", "HEAD");
      assert.equal(squashIntegrated(head, merged, directory), true);
      run("switch", "codex/feature");
      writeFileSync(path.join(directory, "pending.js"), "export const pending=true;\n");
      run("add", ".");
      run("commit", "-qm", "not integrated");
      assert.equal(squashIntegrated(run("rev-parse", "HEAD"), merged, directory), false);
      run("switch", "develop");
      writeFileSync(path.join(directory, "value.js"), "export const value = true;\n");
      run("add", ".");
      run("commit", "--amend", "--no-edit", "-q");
      assert.equal(squashIntegrated(head, run("rev-parse", "HEAD"), directory), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("pulisce da un worktree dedicato mentre la base è attiva nel checkout principale", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "cycle-worktree-")));
    const origin = path.join(directory, "origin.git");
    const main = path.join(directory, "main");
    const dedicated = path.join(directory, "dedicated");
    const run = (cwd, ...args) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run(directory, "init", "-q", "--bare", "--initial-branch=develop", origin);
      run(directory, "clone", "-q", origin, main);
      run(main, "config", "user.name", "Synthetic test");
      run(main, "config", "user.email", "test@example.invalid");
      writeFileSync(path.join(main, "value.js"), "export const value=false;\n");
      run(main, "add", ".");
      run(main, "commit", "-qm", "base");
      run(main, "push", "-q", "origin", "develop");
      run(main, "worktree", "add", "-q", "-b", "codex/feature", dedicated);
      writeFileSync(path.join(dedicated, "value.js"), "export const value=true;\n");
      run(dedicated, "add", ".");
      run(dedicated, "commit", "-qm", "feature");
      run(dedicated, "push", "-q", "origin", "codex/feature");
      const head = run(dedicated, "rev-parse", "HEAD");
      run(main, "merge", "--squash", "codex/feature");
      run(main, "commit", "-qm", "squash");
      run(main, "push", "-q", "origin", "develop");
      const merged = run(main, "rev-parse", "HEAD");
      run(dedicated, "fetch", "-q", "origin", "develop");
      const pr = {
        headRefName: "codex/feature",
        headRefOid: head,
        baseRefName: "develop",
        mergeCommit: { oid: merged },
      };
      writeFileSync(path.join(dedicated, "pending.js"), "export const pending=true;\n");
      assert.throws(() => cleanup(pr, dedicated), /Checkout modificato/u);
      assert.equal(run(dedicated, "branch", "--show-current"), "codex/feature");
      rmSync(path.join(dedicated, "pending.js"));
      cleanup(pr, dedicated);
      assert.equal(run(dedicated, "branch", "--show-current"), "");
      assert.equal(run(dedicated, "rev-parse", "HEAD"), merged);
      assert.equal(run(main, "branch", "--show-current"), "develop");
      assert.equal(run(main, "for-each-ref", "refs/heads/codex/feature"), "");
      assert.equal(run(main, "ls-remote", "origin", "refs/heads/codex/feature"), "");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("ammette develop soltanto per la qualifica senza deploy", () => {
    assert.equal(candidateRef("candidate", "develop"), "develop");
    assert.equal(candidateRef("candidate"), "main");
    assert.equal(candidateRef("production"), "main");
    assert.throws(() => candidateRef("production", "develop"), /Production richiede main/u);
    assert.throws(() => candidateRef("candidate", "feature"), /sola prova/u);
    const workflow = readFileSync(".github/workflows/publish.yml", "utf8");
    assert.match(workflow, /!inputs\.prova && github\.ref == 'refs\/heads\/main'/u);
  });

  it("esegue status in sola lettura, conserva modifiche e riconcilia una qualifica riusata", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-cli-"));
    const calls = path.join(directory, "calls");
    const at = (seconds) => new Date(seconds * 1000).toISOString();
    const run = {
      created_at: at(0),
      updated_at: at(100),
      run_attempt: 2,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/example/project/actions/runs/123",
    };
    const jobs = {
      jobs: [
        { conclusion: "success", started_at: at(5), completed_at: at(25) },
        { conclusion: "success", started_at: at(10), completed_at: at(30) },
      ],
    };
    const executable = `#!${process.execPath}\nconst fs = require("node:fs"); const args = process.argv.slice(2); fs.appendFileSync(process.env.CYCLE_CALLS, JSON.stringify(args) + "\\n"); if(args[0] === "repo") console.log(JSON.stringify({nameWithOwner:"example/project"})); else if(args.includes("--slurp")) console.log(${JSON.stringify(JSON.stringify([jobs]))}); else console.log(${JSON.stringify(JSON.stringify(run))});\n`;
    try {
      writeFileSync(path.join(directory, "gh"), executable, { mode: 0o700 });
      const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, CYCLE_CALLS: calls };
      const status = spawnSync(
        process.execPath,
        ["scripts/release/release-cycle.mjs", "status", "123"],
        {
          encoding: "utf8",
          env,
        },
      );
      assert.equal(status.status, 0, status.stderr);
      const output = JSON.parse(status.stdout);
      assert.equal(output.activeSeconds, 25);
      assert.equal(output.waitingSeconds, 75);
      assert.ok(
        readFileSync(calls, "utf8")
          .split("\n")
          .filter(Boolean)
          .every((line) => ["repo", "api"].includes(JSON.parse(line)[0])),
      );
      const checkout = path.join(directory, "checkout");
      mkdirSync(checkout);
      assert.equal(spawnSync("git", ["init", "-q", checkout]).status, 0);
      writeFileSync(path.join(checkout, "pending"), "owner work");
      const pr = spawnSync(
        process.execPath,
        [path.resolve("scripts/release/release-cycle.mjs"), "pr", "123"],
        { encoding: "utf8", env, cwd: checkout },
      );
      assert.notEqual(pr.status, 0);
      assert.match(pr.stderr, /checkout pulito/u);
      assert.equal(readFileSync(path.join(checkout, "pending"), "utf8"), "owner work");
      assert.equal(readFileSync(calls, "utf8").includes('"merge"'), false);
      const runGit = (...args) => {
        const result = spawnSync("git", args, { cwd: checkout, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit("config", "user.name", "Synthetic test");
      runGit("config", "user.email", "test@example.invalid");
      runGit("add", ".");
      runGit("commit", "-qm", "local source");
      const sha = "a".repeat(40);
      const tree = "b".repeat(40);
      const proof = {
        name: `candidate-${tree}`,
        expired: false,
        workflow_run: { id: 123, repository_id: 1, head_repository_id: 1 },
      };
      const cycleJobs = {
        jobs: [
          { name: "Distribuisci e verifica", conclusion: "skipped" },
          { name: "Qualifica candidato / Candidate qualified", conclusion: "success" },
        ],
      };
      const candidateGh = `#!${process.execPath}\nconst fs=require("node:fs");const a=process.argv.slice(2);fs.appendFileSync(process.env.CYCLE_CALLS,JSON.stringify(a)+"\\n");let value;if(a[0]==="repo")value={nameWithOwner:"example/project"};else if(a[0]==="run")value=[{databaseId:124,headSha:${JSON.stringify(sha)},status:"completed",conclusion:"success"}];else if(a[0]==="workflow")process.exit(99);else if(a.includes("--slurp"))value=${JSON.stringify([jobs])};else if(a[1].includes("git/ref/")){console.log(${JSON.stringify(sha)});process.exit(0);}else if(a[1].includes("git/commits/"))value={tree:{sha:${JSON.stringify(tree)}}};else if(a[1].includes("/artifacts?"))value={artifacts:[{...${JSON.stringify(proof)},expired:process.env.CANDIDATE_EXPIRED==="1"}]};else if(a[1].includes("/jobs?"))value=${JSON.stringify(cycleJobs)};else if(a[1].includes("/actions/runs/"))value={...${JSON.stringify(run)},path:".github/workflows/publish.yml"};else value={id:1};console.log(JSON.stringify(value));\n`;
      writeFileSync(path.join(directory, "gh"), candidateGh, { mode: 0o700 });
      writeFileSync(calls, "");
      const candidate = (expired) =>
        spawnSync(
          process.execPath,
          [path.resolve("scripts/release/release-cycle.mjs"), "candidate", "--sha", sha],
          {
            encoding: "utf8",
            cwd: checkout,
            env: { ...env, CANDIDATE_EXPIRED: expired ? "1" : "0" },
          },
        );
      const reused = candidate(false);
      assert.equal(reused.status, 0, reused.stderr);
      assert.match(reused.stdout, /nessun nuovo dispatch/u);
      assert.equal(readFileSync(calls, "utf8").includes('"workflow"'), false);
      assert.equal(candidate(true).status, 1);
      assert.ok(readFileSync(calls, "utf8").includes('"workflow","run","publish.yml"'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("certifica tutte le partizioni browser solo con prove coerenti e complete", () => {
    const parts = ["source", "production"].flatMap((kind) =>
      [1, 2, 3, 4].map((shard) => ({
        kind,
        shard,
        attempt: 1,
        report: {
          sha: "commit",
          status: "passed",
          partial: false,
          dirty: false,
          environment: kind === "source" ? "local" : "production",
          baseURL: "locale",
          counts: { passed: 1 },
          rows: [{ id: `${kind}-${shard}`, status: "passed" }],
        },
      })),
    );
    const expected = Object.fromEntries(
      ["source", "production"].map((kind) => [
        kind,
        [1, 2, 3, 4].map((shard) => `${kind}-${shard}`),
      ]),
    );
    assert.doesNotThrow(() => assertCandidateReports(parts, "commit", expected));
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          source: [...expected.source, "source-omitted"],
        }),
      /inventario/u,
    );
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          production: expected.production.slice(1),
        }),
      /inventario/u,
    );
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          production: ["production-unknown", ...expected.production.slice(1)],
        }),
      /inventario/u,
    );
    assert.throws(() => assertCandidateReports(parts, "commit"), /inventario/u);
    assert.throws(() => assertCandidateReports(parts.slice(1), "commit", expected));
    for (const change of [
      { sha: "other" },
      { partial: true },
      { dirty: true },
      { status: "failed" },
      { counts: { passed: 0 } },
      { rows: [] },
      { counts: { passed: 2 } },
      { rows: [{ id: "failed-row", status: "failed" }] },
      { partial: undefined },
    ]) {
      const invalid = [
        ...parts.slice(0, 7),
        { ...parts[7], report: { ...parts[7].report, ...change } },
      ];
      assert.throws(() => assertCandidateReports(invalid, "commit", expected));
    }
    assert.throws(() =>
      assertCandidateReports(
        [...parts, { ...parts[0], attempt: 2, report: { ...parts[0].report, status: "failed" } }],
        "commit",
        expected,
      ),
    );
    assert.throws(() =>
      assertCandidateReports(
        parts.map((part) =>
          part.kind === "source"
            ? { ...part, report: { ...part.report, rows: [{ id: "duplicate", status: "passed" }] } }
            : part,
        ),
        "commit",
        expected,
      ),
    );
  });

  it("rifiuta qualifiche su una base superata", () => {
    const sha = "a".repeat(40);
    assert.doesNotThrow(() => assertBase(sha, sha));
    assert.throws(() => assertBase(sha, "b".repeat(40)), /base/u);
    assert.throws(() => assertBase("", ""), /base/u);
  });

  it("dopo l'aggiornamento della base attende la nuova testa della PR", async () => {
    const [old, merged] = ["a".repeat(40), "c".repeat(40)];
    // GitHub risponde prima di creare il merge: le prime letture mostrano ancora la testa vecchia.
    const heads = [old, old, merged];
    const reads = [];
    const pr = await waitUpdatedHead(
      () => {
        const head = heads[Math.min(reads.length, heads.length - 1)];
        reads.push(head);
        return { headRefOid: head };
      },
      old,
      (head) => head === merged,
      5,
      0,
    );
    assert.equal(pr.headRefOid, merged);
    assert.deepEqual(reads, [old, old, merged]);
    // Una testa cambiata ma senza la base non basta; senza aggiornamento il ciclo si ferma.
    await assert.rejects(
      waitUpdatedHead(
        () => ({ headRefOid: merged }),
        old,
        () => false,
        3,
        0,
      ),
      /non aggiornata/u,
    );
  });

  it("non chiude un ciclo con browser parziali o un tag di un altro commit", () => {
    const report = {
      status: "passed",
      partial: false,
      dirty: false,
      sha: "commit",
      environment: "test",
      baseURL: "https://test.fiscalbay.it",
      counts: { passed: 1 },
    };
    assert.doesNotThrow(() => assertRemoteEvidence(report, "commit", "test"));
    for (const change of [
      { partial: true },
      { dirty: true },
      { sha: "other" },
      { counts: { passed: 0 } },
      { environment: "local" },
    ])
      assert.throws(() => assertRemoteEvidence({ ...report, ...change }, "commit", "test"));
    const release = {
      tagName: "v2.0.0",
      isDraft: false,
      url: "https://github.com/example/repo/releases/tag/v2.0.0",
    };
    assert.doesNotThrow(() => assertPublishedRelease(release, "commit", "commit", "2.0.0"));
    assert.throws(() => assertPublishedRelease(release, "other", "commit", "2.0.0"));
    assert.throws(() =>
      assertPublishedRelease({ ...release, isDraft: true }, "commit", "commit", "2.0.0"),
    );
  });

  it("misura una sola volta job paralleli e distingue la pausa fra tentativi", () => {
    const at = (seconds) => new Date(seconds * 1000).toISOString();
    const run = { created_at: at(0), updated_at: at(100), run_attempt: 2 };
    const jobs = [
      { conclusion: "success", started_at: at(5), completed_at: at(25) },
      { conclusion: "success", started_at: at(10), completed_at: at(30) },
      { conclusion: "success", started_at: at(80), completed_at: at(95) },
      { conclusion: "skipped", started_at: at(0), completed_at: at(100) },
      { conclusion: "success", started_at: at(90), completed_at: at(85) },
    ];
    assert.deepEqual(runTimings(run, jobs), {
      attempts: 2,
      elapsedSeconds: 100,
      activeSeconds: 40,
      waitingSeconds: 60,
    });
  });

  it("richiede il deploy quando pertinente e rifiuta una ricevuta parziale o diversa", () => {
    const gate = { name: "Node 26", conclusion: "success" };
    const deploy = { name: "Deploy test", conclusion: "skipped" };
    assert.equal(checkCycleJobs([gate, deploy], false), false);
    assert.throws(() => checkCycleJobs([gate, deploy], true));
    assert.equal(checkCycleJobs([gate, { ...deploy, conclusion: "success" }], true), true);
    assert.throws(() => checkCycleJobs([{ ...gate, conclusion: "failure" }], false));
    const receipt = {
      sha: "commit",
      environment: "test",
      deployed: true,
      readback: true,
      digest: "digest",
      version: "version",
    };
    assert.doesNotThrow(() => assertCycleReceipt(receipt, "commit", "test"));
    for (const change of [
      { sha: "other" },
      { environment: "production" },
      { readback: false },
      { rolledBack: true },
      { deployed: false },
    ])
      assert.throws(() => assertCycleReceipt({ ...receipt, ...change }, "commit", "test"));
  });

  it("riusa una qualifica completa anche dopo un errore del deploy, mai un artefatto grezzo", () => {
    const artifact = { expired: false, workflow_run: { repository_id: 1, head_repository_id: 1 } };
    const run = { path: ".github/workflows/publish.yml", conclusion: "failure" };
    const job = { name: "Qualifica candidato / Candidate qualified", conclusion: "success" };
    assert.equal(verifiedBuildOrigin(artifact, run, [job], 1, "candidate"), true);
    for (const conclusion of ["failure", "cancelled", "skipped", "in_progress"])
      assert.equal(
        verifiedBuildOrigin(artifact, run, [{ ...job, conclusion }], 1, "candidate"),
        false,
      );
    assert.equal(
      verifiedBuildOrigin(artifact, run, [{ ...job, name: "production" }], 1, "candidate"),
      false,
    );
    assert.equal(
      verifiedBuildOrigin({ ...artifact, expired: true }, run, [job], 1, "candidate"),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        { ...artifact, workflow_run: { repository_id: 1, head_repository_id: 2 } },
        run,
        [job],
        1,
        "candidate",
      ),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        artifact,
        { ...run, path: ".github/workflows/ci.yml" },
        [job],
        1,
        "candidate",
      ),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        artifact,
        { path: ".github/workflows/ci.yml", conclusion: "success" },
        [],
        1,
      ),
      true,
    );
  });
});

describe("budget del JavaScript client", () => {
  // KiB di ogni file della build sintetica; `lazy` non è nel manifest, come un import dinamico.
  const run = ({ entry = 10, site = 10, orders = 10, lazy = 0 }) => {
    const directory = mkdtempSync(path.join(tmpdir(), "bundle-"));
    mkdirSync(path.join(directory, "assets"));
    // Byte casuali: gzip non li comprime, quindi la dimensione misurata è nota.
    for (const [name, kib] of Object.entries({ entry, site, orders, lazy }))
      writeFileSync(path.join(directory, "assets", `${name}.js`), randomBytes(kib * 1024));
    const route = (id, routePath, parentId, module) => ({
      id,
      path: routePath,
      parentId,
      hasDefaultExport: true,
      module,
      imports: [],
    });
    const manifest = {
      entry: { module: "/assets/entry.js", imports: [] },
      routes: {
        root: { ...route("root", "", undefined, "/assets/entry.js"), parentId: undefined },
        site: route("site", undefined, "root", "/assets/site.js"),
        orders: route("orders", "en/app/ordini/:ordine?", "root", "/assets/orders.js"),
      },
    };
    writeFileSync(
      path.join(directory, "assets", "manifest-abc.js"),
      `window.__reactRouterManifest=${JSON.stringify(manifest)};`,
    );
    return spawnSync(process.execPath, ["scripts/check-bundle-size.mjs", directory]).status;
  };

  it("accetta pagine entro le soglie della loro classe", () =>
    assert.equal(
      run({ entry: 100, site: budgetKiB.public - 110, orders: budgetKiB.app - 110 }),
      0,
    ));
  it("fa fallire una pagina pubblica oltre la sua soglia", () =>
    assert.equal(run({ entry: 100, site: budgetKiB.public - 90 }), 1));
  it("fa fallire una pagina riservata oltre la sua soglia", () =>
    assert.equal(run({ entry: 100, orders: budgetKiB.app - 90 }), 1));
  it("ignora per il budget i file caricati dopo e il totale della build", () =>
    assert.equal(run({ entry: 100, lazy: budgetKiB.app + 10 }), 0));
  it("fallisce senza manifest", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "bundle-"));
    writeFileSync(path.join(directory, "entry.js"), randomBytes(1024));
    assert.equal(
      spawnSync(process.execPath, ["scripts/check-bundle-size.mjs", directory]).status,
      1,
    );
  });
});

describe("copia locale dell'artefatto", () => {
  it("conserva l'origine Production e riscrive solo quella test, senza cambiare l'originale", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "local-preview-"));
    const relative = ".cloudflare/output/v0/workers/default/worker.config.json";
    const source = path.join(directory, relative);
    const script = path.resolve("scripts/local-preview.mjs");
    mkdirSync(path.dirname(source), { recursive: true });
    try {
      for (const production of [false, true]) {
        const origin = production ? "https://fiscalbay.it" : "https://test.fiscalbay.it";
        const original = JSON.stringify({ env: { APP_ORIGIN: { type: "text", value: origin } } });
        writeFileSync(source, original);
        const result = spawnSync(process.execPath, [script], {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...process.env,
            E2E_BASE_URL: "",
            E2E_PRODUCTION: production ? "1" : "",
            E2E_PORT: "5193",
          },
        });
        assert.equal(result.status, 0, result.stderr);
        const copy = JSON.parse(
          readFileSync(path.join(directory, ".cloudflare/preview", relative), "utf8"),
        );
        assert.equal(copy.env.APP_ORIGIN.value, production ? origin : "http://localhost:5193");
        assert.equal(readFileSync(source, "utf8"), original);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("prove browser divise fra macchine", () => {
  it("raccoglie ogni scenario funzionale in Chromium e WebKit", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "playwright", "test", "--list", "--reporter", "json"],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, E2E_BASE_URL: "", E2E_PRODUCTION: "", E2E_MATRIX: "single" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const scenarios = new Map();
    const visit = (suite) => {
      for (const spec of suite.specs ?? []) {
        const key = `${spec.file}:${spec.line}:${spec.column}:${spec.title}`;
        const projects = scenarios.get(key) ?? new Set();
        for (const test of spec.tests) projects.add(test.projectName);
        scenarios.set(key, projects);
      }
      for (const child of suite.suites ?? []) visit(child);
    };
    visit(JSON.parse(result.stdout));
    assert.ok(scenarios.size > 0);
    for (const [scenario, projects] of scenarios)
      assert.deepEqual([...projects].sort(), ["chromium", "webkit"], scenario);
  });

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

  it("ricava le identità dall'inventario JSON Playwright anche nei gruppi annidati", () => {
    assert.deepEqual(
      listedTestIds({
        suites: [
          {
            specs: [{ id: "chromium-a", tests: [{ projectName: "chromium" }] }],
            suites: [{ specs: [{ id: "webkit-b", tests: [{ projectName: "webkit" }] }] }],
          },
        ],
      }),
      ["chromium-a", "webkit-b"],
    );
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
    const officialType = await fixture({
      trading: [{ ...tax, type: "CodiceFiscale", issuingCountry: null }],
    })();
    assert.equal(officialType.rows[0].outcome, "equal");
    assert.equal(officialType.rows[0].countryComplete, false);
    assert.equal(officialType.supportsReview, true);
    for (const type of ["codice_fiscale", "CODICEFISCALE", "VATIN"])
      assert.equal((await fixture({ trading: [{ ...tax, type }] })()).rows[0].outcome, "different");
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
