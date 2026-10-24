import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileLevel, levelScripts, plan } from "./classify-changes.mjs";

describe("livello del gate dai file modificati", () => {
  it("assegna documenti, strumenti e prodotto ai tre livelli", () => {
    for (const file of ["README.md", "docs/DECISION_REGISTER.md", "docs/brand/README.md"])
      assert.equal(fileLevel(file), "docs", file);
    for (const file of [
      "AGENTS.md",
      "docs/MASTER_PLAN.md",
      "docs/engineering/RELEASE.md",
      "scripts/classify-changes.mjs",
      "scripts/classify-changes.test.mjs",
      "scripts/release/release.mjs",
      "scripts/mutation.mjs",
      ".github/workflows/ci.yml",
      ".github/actions/setup/action.yml",
      "benchmarks/orders.bench.ts",
      "knip.json",
    ])
      assert.equal(fileLevel(file), "tooling", file);
    for (const file of [
      "app/root.tsx",
      "test/orders.spec.ts",
      "e2e/pages.spec.ts",
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "doctor.config.json",
      "scripts/browser-tests.mjs",
      "scripts/unknown.mjs",
      "docs/brand/logo/fiscalbay-logo.svg",
      "new.bin",
    ])
      assert.equal(fileLevel(file), "full", file);
  });

  it("sceglie il livello più alto del diff e il completo senza confronto o nel candidato", () => {
    assert.equal(plan(["README.md", "docs/DECISION_REGISTER.md"]).gate, "docs");
    assert.equal(plan(["README.md", "AGENTS.md"]).gate, "tooling");
    assert.equal(plan(["AGENTS.md", "app/root.tsx"]).gate, "full");
    assert.equal(plan([]).gate, "full");
    assert.equal(plan(["README.md"], [], true).gate, "full");
    for (const files of [["README.md"], ["AGENTS.md"]])
      for (const flag of ["e2e", "build", "deploy"]) assert.equal(plan(files)[flag], false);
  });

  it("esegue per ogni livello uno script di package.json che contiene il livello inferiore", () => {
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    assert.deepEqual(levelScripts, {
      docs: "verify:documents",
      tooling: "verify:tooling",
      full: "verify",
    });
    assert.match(scripts[levelScripts.tooling], /pnpm verify:documents\b/u);
    assert.match(scripts[levelScripts.full], /pnpm verify:tooling\b/u);
    assert.equal(plan(["README.md"]).script, levelScripts.docs);
    assert.equal(plan(["AGENTS.md"]).script, levelScripts.tooling);
    assert.equal(plan([]).script, levelScripts.full);
  });

  it("separa prove unitarie, prove browser e prodotto distribuito", () => {
    const unit = plan(["AGENTS.md", "test/orders.spec.ts"]);
    assert.deepEqual([unit.gate, unit.e2e, unit.build, unit.deploy], ["full", false, true, false]);
    const browser = plan(["e2e/pages.spec.ts"]);
    assert.deepEqual([browser.e2e, browser.deploy], [true, false]);
    for (const file of ["app/root.tsx", "package.json", "new.bin"]) {
      const selected = plan([file]);
      assert.deepEqual([selected.e2e, selected.build, selected.deploy], [true, true, true], file);
    }
    assert.equal(plan([]).deploy, true);
    const candidate = plan(["AGENTS.md"], [], true);
    assert.deepEqual([candidate.e2e, candidate.deploy], [true, false]);
  });
});

describe("prove browser per area", () => {
  it("copre sicurezza, isolamento, integrazioni e suite funzionali dai titoli generici", () => {
    const sources = [{ path: "app/routes/stores.tsx", text: "" }];
    const selected = new RegExp(plan([sources[0].path], sources).browserGrep);
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
    assert.deepEqual(plan([files[0].path], files).areas, ["stores"]);
    files.push({
      path: "app/routes/home.tsx",
      text: 'import { load } from "../domain/stores.server";',
    });
    assert.deepEqual(plan([files[0].path], files).areas, ["auth", "orders", "stores"]);
    files.push({ path: "app/routes/site.tsx", text: "" });
    assert.deepEqual(plan(["app/routes/site.tsx"], files).areas, ["public"]);
    assert.equal(plan(["app/new-module.ts"], files).browserGrep, ".");
  });

  it("seleziona una route circoscritta ma prova tutto per moduli condivisi o non risolti", () => {
    const sources = [{ path: "app/routes/stores.tsx", text: "export default function Page() {}" }];
    assert.notEqual(plan([sources[0].path], sources).browserGrep, ".");
    assert.equal(plan([sources[0].path], sources).browsers, "chromium,webkit");
    for (const files of [["app/routes.ts"], ["app/routes/stores.tsx", "package.json"], []])
      assert.equal(plan(files, sources).browserGrep, ".");
    assert.equal(plan(["app/routes/stores.tsx"], []).browserGrep, ".");
  });
});

describe("mutation e riuso nel candidato", () => {
  it("esegue mutation soltanto nel candidato, sui moduli critici e i consumatori critici", () => {
    const files = [
      { path: "app/i18n.ts", text: "" },
      { path: "app/domain/stores.server.ts", text: 'import { t } from "../i18n";' },
      {
        path: "app/auth.server.ts",
        text: 'import { t } from "./i18n";\nimport { load } from "./domain/stores.server";',
      },
      { path: "app/tax-quality.ts", text: "export const taxQuality = () => true;" },
    ];
    assert.deepEqual(plan(["app/domain/stores.server.ts"], files).mutation, []);
    assert.deepEqual(plan(["app/i18n.ts"], files, true).mutation, []);
    assert.deepEqual(plan(["app/domain/stores.server.ts"], files, true).mutation.sort(), [
      "app/auth.server.ts",
      "app/domain/stores.server.ts",
    ]);
    assert.deepEqual(plan(["app/tax-quality.ts"], files, true).mutation, ["app/tax-quality.ts"]);
  });

  it("non riusa la build verificata quando cambia la procedura di promozione", () => {
    for (const file of [
      "scripts/release/release.mjs",
      ".github/workflows/publish.yml",
      ".github/workflows/mutation.yml",
      ".github/actions/setup/action.yml",
    ])
      assert.equal(plan([file]).promotionReuse, false, file);
    for (const file of ["docs/MASTER_PLAN.md", "app/routes/stores.tsx"])
      assert.equal(plan([file]).promotionReuse, true, file);
  });
});

describe("esecuzione del classificatore", () => {
  it("espone alla CI il gate completo quando il confronto non identifica modifiche", () => {
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
      for (const flag of ["e2e", "build", "deploy"]) assert.equal(fields[flag], "true");
      assert.equal(fields["mutation-matrix"], '{"target":[]}');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("esegue lo script del livello e lascia i browser al loro job con --gate-only", () => {
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
      assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["verify"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
