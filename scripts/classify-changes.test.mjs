import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  configFile,
  editedMigrations,
  fileImpact,
  fileLevel,
  levelScripts,
  moduleAreas,
  plan,
  testVariablesOnly,
} from "./classify-changes.mjs";

const config = readFileSync(configFile, "utf8");
const configChange = (after) => ({ [configFile]: { before: config, after } });
// Il prezzo del Worker test: anche quello live è un valore testuale, ma di Production.
const testValue = config.replace(
  /(domain: "test\.fiscalbay\.it",[\s\S]*?STRIPE_PRICE_MONTHLY: bindings\.text\()"price_[^"]+"/u,
  '$1"price_other"',
);

describe("livello del gate dai file modificati", () => {
  it("ferma le migration già presenti modificate o eliminate, non quelle nuove", () => {
    const base = {
      "migrations/0001_a.sql": "-- commento\nCREATE TABLE a (id TEXT);",
      "migrations/0002_b.sql": "CREATE TABLE b (id TEXT);",
      "migrations/0003_c.sql": "CREATE TABLE c (id TEXT);",
    };
    const head = {
      "migrations/0001_a.sql": "-- commento corretto\nCREATE TABLE a (id TEXT);",
      "migrations/0002_b.sql": base["migrations/0002_b.sql"],
      "migrations/0004_d.sql": "CREATE TABLE d (id TEXT);",
    };
    const files = [...Object.keys(base), "migrations/0004_d.sql", "app/root.tsx"];
    assert.deepEqual(
      editedMigrations(
        files,
        (file) => base[file],
        (file) => head[file],
      ),
      ["migrations/0001_a.sql", "migrations/0003_c.sql"],
    );
  });

  it("assegna documenti, strumenti, test, build e prodotto ai cinque livelli", () => {
    for (const file of [
      "README.md",
      "docs/DECISION_REGISTER.md",
      "docs/brand/README.md",
      "docs/archive/screenshot.png",
    ])
      assert.equal(fileLevel(file), "docs", file);
    // Il changelog porta le Novità dell'app: prove unitarie, build e deploy, senza browser.
    assert.deepEqual(fileImpact("CHANGELOG.md"), { level: "build", e2e: false, deploy: true });
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
      "benchmarks/capacity.spec.ts",
      "scripts/capacity.mjs",
      "vitest.capacity.config.ts",
      "knip.json",
    ])
      assert.equal(fileLevel(file), "tooling", file);
    for (const file of ["test/orders.spec.ts", "vitest.config.ts", "vitest.cloudflare.config.ts"])
      assert.equal(fileLevel(file), "unit", file);
    for (const file of [
      "e2e/pages.spec.ts",
      "playwright.config.ts",
      "scripts/browser-tests.mjs",
      "scripts/check-bundle-size.mjs",
    ])
      assert.equal(fileLevel(file), "build", file);
    for (const file of [
      "app/root.tsx",
      "cloudflare.config.ts",
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "doctor.config.json",
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
      unit: "verify:unit",
      build: "verify:build",
      full: "verify",
    });
    assert.match(scripts[levelScripts.tooling], /pnpm verify:documents\b/u);
    // Il catalogo delle pagine è Node puro: lo prova chi modifica il suo script.
    assert.match(scripts[levelScripts.tooling], /&& pnpm verify:pages &&/u);
    assert.match(scripts[levelScripts.unit], /pnpm verify:tooling\b/u);
    for (const level of ["build", "full"]) {
      assert.match(scripts[levelScripts[level]], /^pnpm verify:unit\b/u, level);
      assert.doesNotMatch(scripts[levelScripts[level]], /verify:pages/u, level);
      // La build test resta l'ultima: è l'artefatto caricato e distribuito.
      assert.match(scripts[levelScripts[level]], /&& pnpm build$/u, level);
    }
    assert.equal(plan(["README.md"]).script, levelScripts.docs);
    assert.equal(plan(["AGENTS.md"]).script, levelScripts.tooling);
    for (const file of [".mcp.json", ".codex/config.toml", ".agents/skills/x.yaml"])
      assert.equal(plan([file]).script, levelScripts.tooling, file);
    assert.equal(plan([]).script, levelScripts.full);
  });

  it("classifica ogni script senza farlo ricadere nel livello completo", () => {
    // Uno script nuovo fuori dagli elenchi provocherebbe build, browser e deploy a ogni modifica.
    const scripts = readdirSync("scripts", { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".mjs") && !file.endsWith(".test.mjs"))
      .map((file) => `scripts/${file.split(path.sep).join("/")}`);
    assert.ok(scripts.length > 0);
    for (const file of scripts) assert.notEqual(fileLevel(file), "full", file);
    assert.deepEqual(fileImpact("scripts/third-party-notices.mjs"), {
      level: "build",
      e2e: false,
      deploy: true,
    });
  });

  it("separa prove unitarie, prove browser e prodotto distribuito", () => {
    const unit = plan(["AGENTS.md", "test/orders.spec.ts"]);
    assert.deepEqual([unit.gate, unit.e2e, unit.build, unit.deploy], ["unit", false, false, false]);
    const browser = plan(["e2e/pages.spec.ts"]);
    assert.deepEqual(
      [browser.gate, browser.e2e, browser.build, browser.deploy],
      ["build", true, true, false],
    );
    const bundle = plan(["scripts/check-bundle-size.mjs"]);
    assert.deepEqual(
      [bundle.gate, bundle.e2e, bundle.build, bundle.deploy],
      ["build", false, true, false],
    );
    const mixed = plan(["test/orders.spec.ts", "app/root.tsx"]);
    assert.deepEqual([mixed.gate, mixed.e2e, mixed.deploy], ["full", true, true]);
    for (const file of ["app/root.tsx", "package.json", "new.bin"]) {
      const selected = plan([file]);
      assert.deepEqual([selected.e2e, selected.build, selected.deploy], [true, true, true], file);
    }
    assert.equal(plan([]).deploy, true);
    const candidate = plan(["AGENTS.md"], [], true);
    assert.deepEqual([candidate.e2e, candidate.deploy], [true, false]);
  });
});

describe("variabili del Worker test", () => {
  it("distribuisce i soli valori testuali del test senza prove browser della PR", () => {
    assert.equal(testVariablesOnly(config, testValue), true);
    const selected = plan([configFile], [], false, configChange(testValue));
    assert.deepEqual(
      [selected.gate, selected.script, selected.e2e, selected.build, selected.deploy],
      ["build", "verify:build", false, true, true],
    );
    assert.equal(selected.browserGrep, ".");
    assert.deepEqual(plan([configFile], [], true, configChange(testValue)).gate, "full");
  });

  it("resta completo per Production, binding, nomi, righe nuove, file misti o confronti assenti", () => {
    const live = config.replace(
      'APP_ORIGIN: bindings.text("https://fiscalbay.it")',
      'APP_ORIGIN: bindings.text("https://www.fiscalbay.it")',
    );
    const binding = testValue.replace(
      'REGISTRATION_MODE: bindings.text("approval"),',
      'REGISTRATION_MODE: bindings.text("approval"),\n            EXTRA: bindings.secret(),',
    );
    const added = testValue.replace(
      'REGISTRATION_MODE: bindings.text("approval"),',
      'REGISTRATION_MODE: bindings.text("approval"),\n            EXTRA: bindings.text("on"),',
    );
    const renamed = testValue.replace(
      "STRIPE_PRICE_ANNUAL: bindings",
      "STRIPE_PRICE_YEARLY: bindings",
    );
    const comment = testValue.replace("// Spenta su richiesta", "// Spenta per scelta");
    const resource = testValue.replace(
      'queue: "fiscalbay-test-webhooks"',
      'queue: "fiscalbay-test-jobs"',
    );
    const domain = testValue.replace('domain: "test.fiscalbay.it"', 'domain: "beta.fiscalbay.it"');
    for (const [name, after] of Object.entries({
      live,
      binding,
      added,
      renamed,
      comment,
      resource,
      domain,
    })) {
      assert.equal(testVariablesOnly(config, after), false, name);
      assert.equal(plan([configFile], [], false, configChange(after)).gate, "full", name);
    }
    assert.notEqual(live, config);
    for (const change of [{}, { [configFile]: { before: undefined, after: testValue } }])
      assert.equal(plan([configFile], [], false, change).gate, "full");
    assert.equal(testVariablesOnly(config, config), false);
    const mixed = plan([configFile, "app/root.tsx"], [], false, configChange(testValue));
    assert.deepEqual([mixed.gate, mixed.e2e, mixed.deploy], ["full", true, true]);
    const withTests = plan(
      [configFile, "test/stripe-billing.spec.ts"],
      [],
      false,
      configChange(testValue),
    );
    assert.deepEqual([withTests.gate, withTests.e2e, withTests.deploy], ["build", false, true]);
  });
});

describe("prove browser per area", () => {
  it("sceglie l'area dal percorso del modulo, non dagli import transitivi", () => {
    const files = [
      { path: "app/domain/orders.server.ts", text: "" },
      { path: "app/account-area.server.ts", text: 'import { a } from "./domain/orders.server";' },
      { path: "app/routes/site.tsx", text: 'import { a } from "../account-area.server";' },
      { path: "app/routes/orders.tsx", text: 'import { a } from "../domain/orders.server";' },
    ];
    const selected = plan([files[0].path], files);
    assert.deepEqual([selected.areas, selected.browsers], [["orders"], "chromium,webkit"]);
    assert.match(selected.browserGrep, /^app-shell\.spec\|@smoke\|ordini/u);
    assert.equal(new RegExp(selected.browserGrep).test("public: /privacy"), false);
    files.push(
      { path: "app/domain/billing.server.ts", text: "" },
      { path: "app/components/stores/list.tsx", text: "" },
    );
    assert.deepEqual(
      plan(["app/domain/billing.server.ts", "app/components/stores/list.tsx"], files).areas,
      ["orders", "public", "settings", "stores"],
    );
  });

  it("dichiara aree soltanto per moduli esistenti", () => {
    const tracked = spawnSync("git", ["ls-files", "app"], { encoding: "utf8" }).stdout.split("\n");
    for (const [pattern] of moduleAreas)
      assert.ok(
        tracked.some((file) => pattern.test(file)),
        pattern.source,
      );
  });

  it("aggiunge l'area di una route che importa direttamente il modulo", () => {
    const files = [
      { path: "app/domain/stores.server.ts", text: "" },
      { path: "app/routes/settings.tsx", text: 'import { a } from "../domain/stores.server";' },
    ];
    assert.deepEqual(plan([files[0].path], files).areas, ["settings", "stores"]);
    files.push({
      path: "app/routes/new-page.tsx",
      text: 'import { a } from "../domain/stores.server";',
    });
    assert.equal(plan([files[0].path], files).browserGrep, ".");
  });

  it("prova tutto per shell, copy, componenti comuni e moduli senza area", () => {
    const files = [
      "app/components/account-shell.tsx",
      "app/components/shell-links.ts",
      "app/copy/copy-it.ts",
      "app/components/ui/button.tsx",
      "app/account-area.server.ts",
      "app/auth.server.ts",
      "app/preferences.ts",
      "app/root.tsx",
      "workers/app.ts",
      "app/new-module.ts",
    ].map((path) => ({ path, text: "" }));
    for (const { path } of files) {
      assert.equal(plan([path], files).browserGrep, ".", path);
      assert.equal(plan(["app/domain/orders.server.ts", path], files).browserGrep, ".", path);
    }
    assert.equal(plan(["app/domain/orders.server.ts"], []).browserGrep, ".");
    assert.equal(plan(["app/domain/orders.server.ts"], files, true).browserGrep, ".");
    for (const file of ["migrations/0100_example.sql", "package.json", "vite.config.ts"])
      assert.equal(plan(["app/domain/orders.server.ts", file], files).browserGrep, ".", file);
  });

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

  it("seleziona una route circoscritta ma prova tutto per moduli condivisi o non risolti", () => {
    const sources = [{ path: "app/routes/stores.tsx", text: "export default function Page() {}" }];
    assert.notEqual(plan([sources[0].path], sources).browserGrep, ".");
    assert.equal(plan([sources[0].path], sources).browsers, "chromium,webkit");
    for (const files of [["app/routes.ts"], ["app/routes/stores.tsx", "package.json"], []])
      assert.equal(plan(files, sources).browserGrep, ".");
    assert.equal(plan(["app/routes/stores.tsx"], []).browserGrep, ".");
  });
});

describe("spec browser modificate", () => {
  const sources = [{ path: "app/routes/stores.tsx", text: "export default function Page() {}" }];

  it("seleziona per nome le sole spec modificate, in entrambi i browser", () => {
    const selected = plan(["e2e/settings.spec.ts", "test/stripe-billing.spec.ts"], sources);
    assert.deepEqual(
      [selected.gate, selected.browserGrep, selected.browsers, selected.deploy],
      ["build", "settings.spec", "chromium,webkit", false],
    );
    assert.equal(
      plan(["e2e/stores.spec.ts", "e2e/orders.spec.ts"], sources).browserGrep,
      "stores.spec|orders.spec",
    );
  });

  it("unisce le spec alle aree dei moduli applicativi modificati", () => {
    const selected = plan(["app/routes/stores.tsx", "e2e/stores.spec.ts"], sources);
    assert.equal(selected.browserGrep.split("|").at(-1), "stores.spec");
    assert.match(selected.browserGrep, /^app-shell\.spec\|@smoke\|negozi/u);
    assert.equal(plan(["package.json", "e2e/stores.spec.ts"], sources).browserGrep, ".");
  });

  it("esegue tutto per gli strumenti condivisi delle prove browser", () => {
    for (const file of [
      "e2e/fixtures.ts",
      "e2e/page-cases.ts",
      "playwright.config.ts",
      "scripts/browser-tests.mjs",
    ])
      assert.equal(plan([file, "e2e/stores.spec.ts"], sources).browserGrep, ".", file);
    assert.equal(plan(["e2e/stores.spec.ts"], sources, true).browserGrep, ".");
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
      "scripts/mutation-reuse.mjs",
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

  it("in locale ripete soltanto ciò che è cambiato dall'ultimo verde", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "local-green-"));
    const bin = path.join(directory, "bin");
    const log = path.join(directory, "commands");
    const repo = path.join(directory, "repo");
    const runner = `#!${process.execPath}\nrequire("node:fs").appendFileSync(process.env.GATE_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\n`;
    const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    try {
      mkdirSync(bin);
      writeFileSync(path.join(bin, "pnpm"), runner, { mode: 0o700 });
      mkdirSync(path.join(repo, "scripts/release"), { recursive: true });
      mkdirSync(path.join(repo, "scripts/lib"));
      for (const file of [
        "classify-changes.mjs",
        "mutation.mjs",
        "verify-repo.mjs",
        "release/release.mjs",
        "lib/provider.mjs",
      ])
        cpSync(path.join("scripts", file), path.join(repo, "scripts", file));
      writeFileSync(path.join(repo, "README.md"), "base\n");
      git("init", "--quiet", "--initial-branch", "develop");
      git("add", "--all");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "base");
      git("update-ref", "refs/remotes/origin/develop", "HEAD");
      const classify = () => {
        writeFileSync(log, "");
        const result = spawnSync(process.execPath, ["scripts/classify-changes.mjs", "--run"], {
          cwd: repo,
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
            GATE_TEST_LOG: log,
            GITHUB_OUTPUT: "",
            GITHUB_STEP_SUMMARY: "",
          },
        });
        assert.equal(result.status, 0, result.stderr);
        return { output: result.stdout, commands: readFileSync(log, "utf8").trim() };
      };
      writeFileSync(path.join(repo, "AGENTS.md"), "regole\n");
      assert.equal(classify().commands, "verify:tooling");
      assert.match(classify().output, /Nessuna modifica dall'ultimo verde locale/u);
      assert.equal(classify().commands, "");
      writeFileSync(path.join(repo, "notes.md"), "nota\n");
      const incremental = classify();
      assert.equal(incremental.commands, "verify:documents");
      assert.match(incremental.output, /ultimo verde locale/u);
      assert.doesNotMatch(incremental.output, /tooling: AGENTS\.md/u);
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
