import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
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
  browserNarrowing,
  browserUnaffected,
  mainProcessChange,
  changelogDayOnly,
  sameNews,
  configFile,
  dependencyChange,
  scriptsChange,
  editedMigrations,
  fileImpact,
  fileLevel,
  levelScripts,
  ciGateScript,
  moduleAreas,
  plan,
  sharedModules,
  testVariablesOnly,
  undeclaredModules,
} from "./classify-changes.mjs";

const config = readFileSync(configFile, "utf8");
const configChange = (after) => ({ [configFile]: { before: config, after } });
// Il prezzo del Worker test: anche quello live è un valore testuale, ma di Production.
const testValue = config.replace(
  /(domain: "test\.fiscalbay\.it",[\s\S]*?STRIPE_PRICE_MONTHLY: bindings\.text\()"price_[^"]+"/u,
  '$1"price_other"',
);

describe("livello del gate dai file modificati", () => {
  it("conserva i controlli del gate senza ricompilare la build test già prodotta", () => {
    assert.equal(ciGateScript("full", true), "verify:gate");
    assert.equal(ciGateScript("build", true), "verify:unit");
    for (const level of Object.keys(levelScripts))
      assert.equal(ciGateScript(level), levelScripts[level]);
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    assert.equal(
      scripts[ciGateScript("full", true)],
      "pnpm verify:unit && pnpm doctor:react && pnpm build:live",
    );
  });
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
      "docs/decisions/DECISION_REGISTER.md",
      "docs/brand/README.md",
      "docs/ROADMAP.md",
      "docs/product/PRODUCT.md",
      "docs/engineering/ARCHITECTURE.md",
      "docs/operations/RELEASE.md",
      "docs/archive/screenshot.png",
    ])
      assert.equal(fileLevel(file), "docs", file);
    // Il changelog porta le Novità dell'app: prove unitarie, build e deploy, senza browser.
    assert.deepEqual(fileImpact("CHANGELOG.md"), { level: "build", e2e: false, deploy: true });
    for (const file of [
      "AGENTS.md",
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
    assert.equal(plan(["README.md", "docs/decisions/DECISION_REGISTER.md"]).gate, "docs");
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

describe("dipendenze per tipo", () => {
  const manifest = {
    dependencies: { "react-router": "8.0.0" },
    devDependencies: { vitest: "5.0.0", vite: "8.0.0" },
    scripts: { build: "cf build" },
  };
  const change = (edit) => {
    const after = structuredClone(manifest);
    edit(after);
    return { before: JSON.stringify(manifest), after: JSON.stringify(after) };
  };
  const tools = change((next) => (next.devDependencies.vitest = "5.0.1"));
  const build = change((next) => (next.devDependencies.vite = "8.0.1"));
  const runtime = change((next) => (next.dependencies["react-router"] = "8.0.1"));
  const scripts = change((next) => (next.scripts.build = "cf build --mode live"));

  it("distingue gli strumenti di sviluppo da ciò che entra nell'artefatto", () => {
    assert.equal(dependencyChange(tools.before, tools.after), "tools");
    assert.equal(dependencyChange(build.before, build.after), "build");
    assert.equal(dependencyChange(runtime.before, runtime.after), "build");
    assert.equal(dependencyChange(scripts.before, scripts.after), undefined);
    assert.equal(dependencyChange(undefined, tools.after), undefined);
  });

  it("gli script del manifest prendono il gate che li esegue", () => {
    const base = {
      scripts: {
        build: "cf build && pnpm bundle:check",
        "bundle:check": "node scripts/check-bundle-size.mjs",
        postinstall: "pnpm typegen",
        typegen: "react-router typegen",
        "verify:documents": "pnpm verify:copy",
        "verify:copy": "node scripts/verify-copy.mjs",
        "verify:tooling": "pnpm verify:documents && pnpm lint",
        lint: "oxlint .",
        "verify:unit": "pnpm verify:tooling && pnpm test",
        test: "vitest run",
        "verify:build": "pnpm verify:unit && pnpm build",
        verify: "pnpm verify:build",
      },
    };
    const edit = (apply) => {
      const after = structuredClone(base);
      apply(after);
      return [JSON.stringify(base), JSON.stringify(after)];
    };
    assert.equal(
      scriptsChange(...edit((next) => (next.scripts.lint = "oxlint --deny-warnings ."))),
      "tooling",
    );
    assert.equal(
      scriptsChange(...edit((next) => (next.scripts.test = "vitest run --bail 1"))),
      "unit",
    );
    assert.equal(
      scriptsChange(...edit((next) => (next.scripts["verify:copy"] += " --strict"))),
      "docs",
    );
    assert.equal(
      scriptsChange(...edit((next) => (next.scripts["verify:gate"] = "pnpm verify:unit"))),
      "tooling",
    );
    // Build, installazione e ciò che richiamano restano al livello completo, con il deploy.
    for (const name of ["build", "bundle:check", "postinstall", "typegen"])
      assert.equal(
        scriptsChange(...edit((next) => (next.scripts[name] += " --x"))),
        undefined,
        name,
      );
    assert.equal(scriptsChange(...edit((next) => (next.scripts.predeploy = "true"))), undefined);
    assert.equal(
      scriptsChange(...edit((next) => ((next.scripts.lint += " -q"), (next.private = true)))),
      undefined,
    );
    assert.equal(scriptsChange("{", "{}"), undefined);
    const [before, after] = edit((next) => (next.scripts.lint += " -q"));
    assert.deepEqual(fileImpact("package.json", { before, after }), {
      level: "tooling",
      e2e: false,
      deploy: false,
    });
    assert.deepEqual(fileImpact(".gitignore"), { level: "tooling", e2e: false, deploy: false });
  });

  it("gli strumenti di sviluppo non aprono browser né deploy, il gate resta completo", () => {
    const selected = plan(["package.json", "pnpm-lock.yaml"], [], false, {
      "package.json": tools,
    });
    assert.deepEqual([selected.gate, selected.e2e, selected.deploy], ["full", false, false]);
  });

  it("le dipendenze dell'artefatto provano il nucleo essenziale", () => {
    for (const manifestChange of [build, runtime]) {
      const selected = plan(["package.json", "pnpm-lock.yaml"], [], false, {
        "package.json": manifestChange,
      });
      assert.deepEqual(
        [selected.gate, selected.browserGrep, selected.browsers, selected.deploy],
        ["full", "@smoke", "chromium,webkit", true],
      );
    }
    assert.equal(plan(["pnpm-lock.yaml"]).browserGrep, "@smoke");
  });

  it("un manifest non classificato o con altri campi prova tutto", () => {
    assert.equal(plan(["package.json"]).browserGrep, ".");
    assert.equal(plan(["package.json"], [], false, { "package.json": scripts }).browserGrep, ".");
  });
});

describe("giorno della versione", () => {
  const undated =
    "## [2.0.3]\n\n### Novità\n\n#### Correzioni\n\n- voce\n\n## [2.0.1] - 2026-11-01\n";
  const dated = undated.replace("## [2.0.3]", "## [2.0.3] - 2026-11-02");

  it("il solo giorno non distribuisce e non prova nulla", () => {
    assert.equal(changelogDayOnly(undated, dated), true);
    assert.equal(changelogDayOnly(undated, `${dated}- altro\n`), false);
    assert.equal(changelogDayOnly(undefined, dated), false);
    const change = { "CHANGELOG.md": { before: undated, after: dated } };
    const selected = plan(["CHANGELOG.md"], [], false, change);
    assert.deepEqual([selected.gate, selected.deploy, selected.e2e], ["docs", false, false]);
  });

  it("un frammento di changes/ distribuisce, e riunito nel changelog con il giorno no", () => {
    const fragment = "changes/filtro.md";
    const merged = { before: undated, after: undated.replace("- voce", "- voce\n- nuova") };
    const added = plan([fragment], [], false, { [fragment]: merged });
    assert.deepEqual([added.gate, added.deploy, added.e2e], ["build", true, false]);
    // Il giorno riunisce i frammenti: il changelog completo resta lo stesso, con il giorno.
    const day = { before: undated, after: dated };
    const folded = plan(["CHANGELOG.md", fragment], [], false, {
      "CHANGELOG.md": day,
      [fragment]: day,
    });
    assert.deepEqual([folded.gate, folded.deploy], ["docs", false]);
    // Un frammento con le sole decisioni non cambia il changelog: resta un documento.
    const same = { before: undated, after: undated };
    assert.deepEqual(plan([fragment], [], false, { [fragment]: same }).gate, "docs");
  });

  it("distribuisce soltanto un cambio di ciò che la pagina Novità mostra", () => {
    const fragment = "changes/sito.md";
    const other = `${undated}### Altre modifiche\n\n- sito\n`;
    // Altre modifiche, versioni senza Novità aperte o richiuse: la pagina resta la stessa.
    for (const after of [
      undated.replace("- voce", "- voce\n\n### Altre modifiche\n\n- sito"),
      `## [2.0.4]\n\n${undated}`,
      undated.replace("## [2.0.1] - 2026-11-01", "## [2.0.2] - 2026-11-01\n\n- interna"),
    ]) {
      assert.equal(sameNews(undated, after), true, after);
      const selected = plan([fragment], [], false, { [fragment]: { before: undated, after } });
      assert.deepEqual([selected.gate, selected.deploy], ["docs", false]);
    }
    assert.equal(sameNews(other, other.replace("- sito", "- console")), true);
    // Una Novità nuova, cambiata o il giorno di una versione con Novità cambiano la pagina.
    assert.equal(sameNews(undated, undated.replace("- voce", "- altra")), false);
    assert.equal(sameNews(undated, undated.replace("[2.0.3]", "[2.0.4]")), false);
    assert.equal(sameNews(undefined, undated), false);
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
    assert.deepEqual([selected.areas, selected.browsers], [["orders"], "chromium"]);
    assert.match(selected.browserGrep, /^@smoke\|@pages-orders\|/u);
    const chosen = new RegExp(selected.browserGrep);
    assert.equal(chosen.test("public: /privacy @pages @pages-public"), false);
    assert.equal(chosen.test("public: /ordini-guida @pages @pages-public"), false);
    assert.ok(chosen.test("orders: /anteprima/ordini @pages @pages-orders"));
    assert.ok(chosen.test("chromium orders.spec.ts gli ordini si filtrano"));
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

  it("dichiara ogni modulo: un'area, nessuna pagina o la suite completa", () => {
    const tracked = spawnSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "app", "workers"],
      { encoding: "utf8" },
    )
      .stdout.split("\n")
      .filter((file) => /\.(?:tsx?|css)$/u.test(file) && existsSync(file));
    assert.deepEqual(undeclaredModules(tracked), []);
    assert.deepEqual(undeclaredModules(["app/new-module.ts", "app/domain/nuovo.server.ts"]), [
      "app/new-module.ts",
      "app/domain/nuovo.server.ts",
    ]);
    assert.ok(tracked.some((file) => sharedModules.test(file)));
  });

  it("non apre browser per i moduli che nessuna pagina mostra", () => {
    const files = [
      { path: "app/service-activity.server.ts", text: "" },
      { path: "app/domain/scheduled-work.server.ts", text: "" },
      { path: "app/routes/orders.tsx", text: "" },
    ];
    const quiet = plan([files[0].path, files[1].path], files);
    assert.deepEqual([quiet.e2e, quiet.browsers, quiet.deploy], [false, "", true]);
    const mixed = plan([files[0].path, files[2].path], files);
    assert.deepEqual([mixed.e2e, mixed.areas], [true, ["orders"]]);
    files.push({
      path: "app/routes/stores.tsx",
      text: 'import { a } from "../service-activity.server";',
    });
    assert.deepEqual(plan([files[0].path], files).areas, ["stores"]);
  });

  it("riserva WebKit a ciò che il browser disegna o esegue", () => {
    const files = [
      { path: "app/domain/orders.server.ts", text: "" },
      { path: "app/components/orders/list.tsx", text: "" },
      { path: "app/routes/orders.tsx", text: "" },
    ];
    assert.equal(plan([files[0].path], files).browsers, "chromium");
    assert.equal(plan([files[0].path, files[1].path], files).browsers, "chromium,webkit");
    assert.equal(plan([files[2].path], files).browsers, "chromium,webkit");
    assert.equal(plan([files[0].path, "e2e/orders.spec.ts"], files).browsers, "chromium,webkit");
    assert.equal(plan(["app/root.tsx"], files).browsers, "chromium,webkit");
  });

  it("visita il catalogo con una sola combinazione quando cambia la sua spec", () => {
    assert.equal(plan(["e2e/pages.spec.ts"], [{ path: "app/x.ts", text: "" }]).matrix, "single");
    assert.equal(plan(["e2e/orders.spec.ts"], [{ path: "app/x.ts", text: "" }]).matrix, "");
    assert.equal(plan(["e2e/pages.spec.ts"], [{ path: "app/x.ts", text: "" }], true).matrix, "");
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
    assert.ok(selected.test("chromium stores.spec.ts il negozio si rinomina"));
    assert.ok(selected.test("stores: /negozi/collega @pages @pages-stores"));
    assert.equal(selected.test("profile: /anteprima/profilo @pages @pages-profile"), false);
    assert.equal(selected.test("chromium public.spec.ts la home risponde"), false);
    assert.ok(selected.test("chromium public.spec.ts la home risponde @smoke"));
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
    assert.match(selected.browserGrep, /^@smoke\|@pages-stores\|/u);
    assert.equal(plan(["package.json", "e2e/stores.spec.ts"], sources).browserGrep, ".");
  });

  it("esegue tutto per gli strumenti condivisi delle prove browser", () => {
    for (const file of ["e2e/fixtures.ts", "e2e/page-cases.ts", "playwright.config.ts"])
      assert.equal(plan([file, "e2e/stores.spec.ts"], sources).browserGrep, ".", file);
    assert.equal(plan(["e2e/stores.spec.ts"], sources, true).browserGrep, ".");
  });

  it("prova runner, anteprima e D1 locale con il nucleo nei due browser", () => {
    for (const file of [
      "scripts/browser-tests.mjs",
      "scripts/local-preview.mjs",
      "scripts/local-d1.mjs",
    ]) {
      const selected = plan([file], sources);
      assert.deepEqual(
        [selected.gate, selected.e2e, selected.browserGrep, selected.browsers, selected.deploy],
        ["build", true, "@smoke", "chromium,webkit", false],
        file,
      );
    }
    assert.equal(
      plan(["scripts/browser-tests.mjs", "e2e/stores.spec.ts"], sources).browserGrep,
      "@smoke|stores.spec",
    );
    assert.equal(plan(["scripts/browser-evidence.mjs"], sources).e2e, false);
  });
});

describe("prove browser invariate fra due commit", () => {
  it("dopo un'unione con la base ripete soltanto le aree toccate sia dai cambi sia dalla PR", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "browser-narrowing-"));
    const before = process.cwd();
    const git = (...args) =>
      spawnSync("git", args, { cwd: directory, encoding: "utf8" }).stdout.trim();
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      writeFileSync(path.join(directory, file), text);
    };
    const commit = (file, text) => {
      write(file, text);
      git("add", "--all");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", file);
      return git("rev-parse", "HEAD");
    };
    // Unione della PR nella base, come il commit che la CI della PR prova.
    const merge = (base, head) => {
      git("checkout", "--quiet", "--detach", base);
      git("-c", "user.name=t", "-c", "user.email=t@t", "merge", "--quiet", "--no-edit", head);
      return git("rev-parse", "HEAD");
    };
    const files = {
      stores: "app/components/stores/a.tsx",
      storesOther: "app/components/stores/c.tsx",
      settings: "app/components/settings/b.tsx",
      shared: "app/root.tsx",
    };
    const sources = Object.values(files).map((file) => ({ path: file, text: "export {};\n" }));
    try {
      git("init", "--quiet", "--initial-branch", "develop");
      for (const file of Object.values(files)) write(file, "export {};\n");
      const start = commit("README.md", "base\n");
      git("checkout", "--quiet", "-b", "pr");
      const green = commit(files.stores, "export const a = 1;\n");
      process.chdir(directory);
      const narrowing = (base, extra) => {
        const head = merge(base, extra ?? green);
        return browserNarrowing(green, head, base, sources);
      };
      // La base cambia un'area che la PR non tocca: basta il nucleo.
      git("checkout", "--quiet", "develop");
      const settings = commit(files.settings, "export const b = 1;\n");
      assert.deepEqual(narrowing(settings), { grep: "@smoke" });
      // La base cambia la stessa area della PR, in un altro file: si ripete quell'area.
      git("checkout", "--quiet", "develop");
      const stores = commit(files.storesOther, "export const c = 1;\n");
      assert.match(narrowing(stores).grep, /^@smoke\|@pages-stores\|/u);
      assert.doesNotMatch(narrowing(stores).grep, /settings/u);
      // Un modulo che ogni pagina attraversa chiede la selezione intera.
      git("checkout", "--quiet", "develop");
      const shared = commit(files.shared, "export const r = 1;\n");
      assert.equal(narrowing(shared), null);
      // Soli documenti nella base: nessuna prova da ripetere.
      git("checkout", "--quiet", start);
      git("checkout", "--quiet", "-b", "docs");
      const docs = commit("docs/nota.md", "nota\n");
      assert.deepEqual(narrowing(docs), { reuse: true });
      // Un nuovo cambio della PR ripete la sua area anche senza cambi della base.
      git("checkout", "--quiet", "pr");
      const again = commit(files.stores, "export const a = 2;\n");
      assert.match(narrowing(start, again).grep, /@pages-stores/u);
      // Un commit non disponibile non prova nulla.
      assert.equal(
        browserNarrowing("0123456789abcdef0123456789abcdef01234567", green, start, sources),
        null,
      );
    } finally {
      process.chdir(before);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("documenti e strumenti non cambiano le prove browser, il codice e le spec sì", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "browser-unaffected-"));
    const before = process.cwd();
    const git = (...args) =>
      spawnSync("git", args, { cwd: directory, encoding: "utf8" }).stdout.trim();
    const commit = (file, text) => {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      writeFileSync(path.join(directory, file), text);
      git("add", "--all");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", file);
      return git("rev-parse", "HEAD");
    };
    try {
      git("init", "--quiet", "--initial-branch", "develop");
      const base = commit("README.md", "base\n");
      process.chdir(directory);
      const docs = commit("docs/nota.md", "nota\n");
      assert.ok(browserUnaffected(base, docs));
      const tooling = commit("scripts/mutation.mjs", "// strumento\n");
      assert.ok(browserUnaffected(base, tooling));
      const unitTest = commit("test/a.spec.ts", "// prova\n");
      assert.ok(browserUnaffected(docs, unitTest));
      const spec = commit("e2e/a.spec.ts", "// prova browser\n");
      assert.ok(!browserUnaffected(unitTest, spec));
      const app = commit("app/a.ts", "export const a = 1;\n");
      assert.ok(!browserUnaffected(spec, app));
      assert.ok(browserUnaffected(app, app));
      assert.ok(!browserUnaffected("0123456789abcdef0123456789abcdef01234567", app));
    } finally {
      process.chdir(before);
      rmSync(directory, { recursive: true, force: true });
    }
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
    // Né la pubblicazione, né il classificatore, né gli strumenti della mutation la ripetono.
    for (const file of [
      "scripts/release/release.mjs",
      "scripts/classify-changes.mjs",
      "scripts/mutation.mjs",
      ".github/workflows/mutation.yml",
      "stryker.config.json",
    ])
      assert.deepEqual(plan([file], files, true).mutation, [], file);
  });

  it("attende il candidato senza deploy soltanto se cambia la procedura che gira da main", () => {
    for (const file of [
      ".github/workflows/publish.yml",
      ".github/workflows/qualify.yml",
      ".github/actions/setup/action.yml",
      "scripts/release/release.mjs",
      "e2e/pages.spec.ts",
      "playwright.config.ts",
    ])
      assert.ok(mainProcessChange([file]), file);
    for (const file of [
      ".github/workflows/ci.yml",
      ".github/workflows/candidate.yml",
      "scripts/release/release.test.mjs",
      "docs/operations/RELEASE.md",
      "AGENTS.md",
      "test/orders.spec.ts",
    ])
      assert.ok(!mainProcessChange([file]), file);
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
    // Ogni gate locale parte dal controllo della versione di `Verify`.
    const version = "scripts/release/release.mjs version-step --base origin/develop\n";
    const repo = path.join(directory, "repo");
    const runner = `#!${process.execPath}\nrequire("node:fs").appendFileSync(process.env.GATE_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\n`;
    const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    try {
      mkdirSync(bin);
      writeFileSync(path.join(bin, "pnpm"), runner, { mode: 0o700 });
      writeFileSync(path.join(bin, "node"), runner, { mode: 0o700 });
      mkdirSync(path.join(repo, "scripts/release"), { recursive: true });
      mkdirSync(path.join(repo, "scripts/lib"));
      for (const file of [
        "classify-changes.mjs",
        "mutation.mjs",
        "mutation-reuse.mjs",
        "verify-repo.mjs",
        "release/release.mjs",
        "release/records.mjs",
        "lib/provider.mjs",
        "lib/critical-modules.mjs",
      ])
        cpSync(path.join("scripts", file), path.join(repo, "scripts", file));
      mkdirSync(path.join(repo, "app"));
      cpSync("app/changelog-fragments.mjs", path.join(repo, "app/changelog-fragments.mjs"));
      writeFileSync(path.join(repo, "README.md"), "base\n");
      git("init", "--quiet", "--initial-branch", "develop");
      git("add", "--all");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "base");
      git("update-ref", "refs/remotes/origin/develop", "HEAD");
      const classify = (flag = "--run") => {
        writeFileSync(log, "");
        const result = spawnSync(process.execPath, ["scripts/classify-changes.mjs", flag], {
          cwd: repo,
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
            GATE_TEST_LOG: log,
            GITHUB_OUTPUT: "",
            GITHUB_STEP_SUMMARY: "",
            VERIFIED_TEST_BUILD: "",
          },
        });
        assert.equal(result.status, 0, result.stderr);
        return { output: result.stdout, commands: readFileSync(log, "utf8").trim() };
      };
      writeFileSync(path.join(repo, "AGENTS.md"), "regole\n");
      assert.equal(classify().commands, `${version}verify:tooling`);
      assert.match(classify().output, /Nessuna modifica dall'ultimo verde locale/u);
      assert.equal(classify().commands, "");
      writeFileSync(path.join(repo, "notes.md"), "nota\n");
      const incremental = classify();
      assert.equal(incremental.commands, `${version}verify:documents`);
      assert.match(incremental.output, /ultimo verde locale/u);
      assert.doesNotMatch(incremental.output, /tooling: AGENTS\.md/u);
      mkdirSync(path.join(repo, "app/routes"), { recursive: true });
      // In locale il livello completo esegue i controlli statici e i test collegati al diff:
      // copertura e build restano alla CI.
      writeFileSync(path.join(repo, "app/routes/stores.tsx"), "export const stores = 1;\n");
      assert.equal(
        classify().commands,
        `${version}verify:static:full\ntest:related app/routes/stores.tsx`,
      );
      writeFileSync(path.join(repo, "app/routes/settings.tsx"), "export const settings = 1;\n");
      assert.equal(
        classify().commands,
        `${version}verify:static:full\ntest:related app/routes/settings.tsx`,
      );
      const browser = classify("--browser");
      assert.match(browser.commands, /scripts\/browser-tests\.mjs/u);
      assert.match(browser.commands, /--browsers chromium(?!,)/u);
      assert.match(browser.commands, /@pages-stores/u);
      assert.match(browser.commands, /@pages-settings/u);
      assert.equal(classify("--browser").commands, "");
      writeFileSync(path.join(repo, "app/routes/settings.tsx"), "export const settings = 2;\n");
      classify();
      const selected = classify("--browser");
      assert.match(selected.commands, /@pages-settings/u);
      assert.doesNotMatch(selected.commands, /@pages-stores/u);
      // Un modulo server cambia soltanto ciò che Chromium proverebbe: i browser restano alla CI.
      mkdirSync(path.join(repo, "app/domain"), { recursive: true });
      writeFileSync(path.join(repo, "app/domain/stores.server.ts"), "export const load = 1;\n");
      writeFileSync(
        path.join(repo, "app/routes/stores.tsx"),
        'import { load } from "../domain/stores.server";\nexport const stores = load;\n',
      );
      classify();
      classify("--browser");
      writeFileSync(path.join(repo, "app/domain/stores.server.ts"), "export const load = 2;\n");
      classify();
      const server = classify("--browser");
      assert.equal(server.commands, "");
      assert.match(server.output, /Prove browser lasciate alla CI/u);
      // Un file che i test leggono fuori da `app/`, `workers/` e `test/` esegue l'intera suite.
      writeFileSync(path.join(repo, "package.json"), '{"name":"prova"}\n');
      assert.equal(classify().commands, `${version}verify:static:full\ntest`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("esegue lo script del livello e lascia i browser al loro job", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "gate-run-"));
    const log = path.join(directory, "commands");
    const runner = `#!${process.execPath}\nconst fs = require("node:fs");\nif (require("node:path").basename(process.argv[1]) === "node") process.exit(77);\nfs.appendFileSync(process.env.GATE_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\n`;
    try {
      for (const name of ["pnpm", "node"])
        writeFileSync(path.join(directory, name), runner, { mode: 0o700 });
      const result = spawnSync(
        process.execPath,
        ["scripts/classify-changes.mjs", "--base", "HEAD", "--head", "HEAD", "--run"],
        {
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            PATH: `${directory}${path.delimiter}${process.env.PATH}`,
            GATE_TEST_LOG: log,
            GITHUB_OUTPUT: "",
            GITHUB_STEP_SUMMARY: "",
            VERIFIED_TEST_BUILD: "",
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
