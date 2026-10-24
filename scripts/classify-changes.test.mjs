import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { classifyFile, plan as changePlan, gateCommands } from "./classify-changes.mjs";

const plan = (files) => {
  const { gate, e2e, unclassified } = changePlan(files);
  return { gate, e2e, unclassified };
};

describe("report di qualità", () => {
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
      assert.ok(changePlan([file], [], true).mutation.includes(file));
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

  it("esegue mutation soltanto nel candidato, sui moduli critici e i consumatori critici", () => {
    const files = [
      { path: "app/i18n.ts", text: "" },
      { path: "app/domain/stores.server.ts", text: 'import { t } from "../i18n";' },
      {
        path: "app/auth.server.ts",
        text: 'import { t } from "./i18n";\nimport { load } from "./domain/stores.server";',
      },
    ];
    assert.deepEqual(changePlan(["app/i18n.ts"], files).mutation, []);
    assert.deepEqual(changePlan(["app/domain/stores.server.ts"], files).mutation, []);
    assert.deepEqual(changePlan(["app/domain/stores.server.ts"], files, true).mutation.sort(), [
      "app/auth.server.ts",
      "app/domain/stores.server.ts",
    ]);
  });

  it("include il controllo fiscale fra i moduli critici", () => {
    const target = "app/tax-quality.ts";
    const files = [
      { path: target, text: "export const taxQuality = () => true;" },
      {
        path: "test/ebay-adapters.unit.ts",
        text: 'import { taxQuality } from "../app/tax-quality";',
      },
      { path: "test/orders.spec.ts", text: 'import { taxQuality } from "../app/tax-quality";' },
    ];
    assert.deepEqual(changePlan([target], files, true).mutation, [target]);
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
      "scripts/classify-changes.test.mjs",
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

  it("applica React Doctor nel gate e riserva i browser ai job separati", () => {
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
