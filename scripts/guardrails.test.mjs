import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import { budgetKiB } from "./check-bundle-size.mjs";
import { evaluate as evaluateCapacity, jsonObjects, percentile95 } from "./check-capacity.mjs";
import { classifyFile, plan } from "./classify-changes.mjs";
import { evaluate } from "./mutation.mjs";
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

describe("sigle di piano", () => {
  it("ammette le sigle nella documentazione e nelle migration già applicate", () => {
    assert.deepEqual(
      checkPlanCodes([
        { path: "BACKLOG.md", text: task },
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
  it("assegna le categorie note", () => {
    assert.equal(classifyFile("README.md"), "documentation");
    assert.equal(classifyFile("test/orders.spec.ts"), "test");
    assert.equal(classifyFile("app/root.tsx"), "runtime");
    assert.equal(classifyFile(".github/workflows/ci.yml"), "tooling");
    assert.equal(classifyFile("AGENTS.md"), "tooling");
    assert.equal(classifyFile("docs/engineering/AGENT_SETUP.md"), "tooling");
    assert.equal(classifyFile("docs/brand/logo/fiscalbay-logo.svg"), undefined);
  });

  it("riduce il gate soltanto per la documentazione ordinaria", () => {
    assert.deepEqual(plan(["README.md", "docs/DECISION_REGISTER.md"]), {
      gate: "docs",
      e2e: false,
      unclassified: [],
    });
    assert.equal(plan(["README.md", "AGENTS.md"]).gate, "full");
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
    assert.equal(plan(["e2e/visual.spec.ts"]).e2e, true);
    assert.equal(plan(["app/root.tsx"]).e2e, true);
  });
});

describe("esito dei mutation test", () => {
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

describe("capacità al deploy", () => {
  const event = (cpuTime, overrides = {}) => ({
    cpuTime,
    outcome: "ok",
    exceptions: [],
    event: { response: { status: 200 } },
    ...overrides,
  });

  it("separa gli oggetti JSON anche spezzati fra più blocchi", () => {
    const parse = jsonObjects();
    assert.deepEqual(parse('{"a":"}{"}\n{"b":'), [{ a: "}{" }]);
    assert.deepEqual(parse("{}}\n"), [{ b: {} }]);
  });

  it("calcola il p95 con rango più vicino", () => {
    assert.equal(percentile95([...Array.from({ length: 19 }, () => 1), 50]), 1);
    assert.equal(percentile95([...Array.from({ length: 18 }, () => 1), 50, 60]), 50);
  });

  it("supera la soglia con eventi completi e senza errori", () => {
    assert.deepEqual(evaluateCapacity([event(2), event(4)], { sent: 2, maxP95: 5 }).failures, []);
  });

  it("fallisce oltre soglia, con errori o con eventi mancanti", () => {
    const failures = (events, sent = events.length) =>
      evaluateCapacity(events, { sent, maxP95: 5 }).failures.length;
    assert.equal(failures([event(6)]), 1);
    assert.equal(failures([event(1, { outcome: "exception" })]), 1);
    assert.equal(failures([event(1, { exceptions: [{ name: "Error" }] })]), 1);
    assert.equal(failures([event(1, { event: { response: { status: 503 } } })]), 1);
    assert.equal(failures([event(1)], 2), 1);
    assert.equal(failures([]), 1);
  });
});
