import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  checkActionPins,
  checkCopy,
  checkFixtures,
  checkGateJobs,
  checkImports,
  checkPlanCodes,
  checkPrivateAddresses,
  checkSecurityTxt,
  checkSelfHostedRunners,
  checkToolPins,
} from "./verify-repo.mjs";

const milestone = "M" + "3";
const task = `${milestone}-06`;
const gate = "G-" + "EBAY";

describe("sigle di piano", () => {
  it("ammette le sigle nella documentazione e nelle migration già applicate", () => {
    assert.deepEqual(
      checkPlanCodes([
        { path: "docs/decisions/DECISION_REGISTER.md", text: task },
        { path: "docs/decisions/DECISION_REGISTER.md", text: gate },
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
    const text = 'const url = "https://www.ebay.de/itm/1"; const email = "mario@gmail.com";';
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

  it("accetta i moduli server raggiungibili dalle route, anche tramite alias", () => {
    const files = [
      ...entries,
      { path: "app/routes/home.tsx", text: 'import { load } from "../domain/orders.server";' },
      { path: "app/domain/orders.server.ts", text: 'import { t } from "~/i18n";' },
      { path: "app/i18n.ts", text: "" },
    ];
    assert.deepEqual(checkImports(files, new Map()), []);
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
  const files = (manifest) => [
    { path: "mise.toml", text: '[tools]\nnode = "26.10.0"\npnpm = "12.6.0"\n' },
    { path: "package.json", text: JSON.stringify(manifest) },
  ];

  it("allinea mise.toml al manifest letto dalla CI", () => {
    assert.deepEqual(
      checkToolPins(files({ engines: { node: "26.10.0" }, packageManager: "pnpm@12.6.0" })),
      [],
    );
    assert.equal(
      checkToolPins(files({ engines: { node: "26" }, packageManager: "pnpm@12" })).length,
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
    assert.equal(checkActionPins([{ path: ".github/actions/setup/action.yml", text }]).length, 3);
  });
});

describe("em dash", () => {
  const dash = String.fromCodePoint(0x2014);
  it("rifiuta il carattere e le sue codifiche in ogni file di testo", () => {
    assert.deepEqual(
      checkCopy([
        { path: "docs/piano.md", text: `riga\nprima ${dash} dopo` },
        { path: "app/copy.ts", text: `"&md${"ash;"}"` },
        { path: "test/titolo.spec.ts", text: `"&#${"8212;"}" + "&#X${"2014;"}"` },
        { path: "scripts/a.mjs", text: `"\\u${"2014"}" + "\\u{${"2014"}}"` },
      ]),
      [
        "docs/piano.md:2: em dash non consentito (U+2014)",
        "app/copy.ts:1: em dash non consentito (U+2014)",
        "test/titolo.spec.ts:1: em dash non consentito (U+2014)",
        "scripts/a.mjs:1: em dash non consentito (U+2014)",
      ],
    );
  });

  it("ammette trattino, en dash e separatore dei titoli", () => {
    assert.deepEqual(
      checkCopy([{ path: "app/root.tsx", text: "Ordini | FiscalBay - 2026\u2013" }]),
      [],
    );
  });
});

describe("runner del Mac", () => {
  const workflow = (path) => ({
    path,
    text: "jobs:\n  a:\n    runs-on: [self-hosted, fiscalbay-coordinator]\n",
  });

  it("ammette il runner soltanto nei coordinatori", () => {
    assert.deepEqual(checkSelfHostedRunners([workflow(".github/workflows/cycle.yml")]), []);
    assert.match(checkSelfHostedRunners([workflow(".github/workflows/ci.yml")])[0], /ci\.yml:3/u);
    assert.equal(checkSelfHostedRunners([workflow(".github/actions/setup/action.yml")]).length, 1);
  });
});

describe("job dopo Node 26", () => {
  const ci = (condition) => [
    {
      path: ".github/workflows/ci.yml",
      text: `name: CI\n\njobs:\n  gate:\n    name: Node 26\n    needs: verify\n  after:\n    needs: [verify, gate]\n    ${condition}\n`,
    },
  ];

  it("rifiuta un job che GitHub salterebbe con un job saltato a monte", () => {
    assert.equal(checkGateJobs(ci("if: needs.gate.result == 'success'")).length, 1);
    assert.match(checkGateJobs(ci("runs-on: ubuntu"))[0], /«after»/u);
  });

  it("accetta la condizione esplicita", () => {
    assert.deepEqual(
      checkGateJobs(ci("if: ${{ !cancelled() && needs.gate.result == 'success' }}")),
      [],
    );
  });
});

describe("indirizzi privati", () => {
  it("riconosce dall'impronta l'indirizzo di un account delle verifiche live", () => {
    const hashes = new Set([createHash("sha256").update("prova@example.invalid").digest("hex")]);
    assert.deepEqual(
      checkPrivateAddresses(
        [
          { path: "docs/a.md", text: "Scrivi a\nProva@Example.invalid per l'audit." },
          { path: "test/b.ts", text: "altro@example.invalid" },
        ],
        hashes,
      ),
      ["docs/a.md:2: indirizzo di un account delle verifiche live"],
    );
  });
});

describe("security.txt", () => {
  const file = (expires) => ({
    path: "public/.well-known/security.txt",
    text: `Contact: mailto:info@example.invalid\nExpires: ${expires}\nCanonical: https://example.invalid/.well-known/security.txt\n`,
  });
  const now = new Date("2026-11-03T00:00:00Z");

  it("accetta una scadenza fra trenta giorni e un anno", () => {
    assert.deepEqual(checkSecurityTxt([file("2027-11-01T00:00:00.000Z")], now), []);
  });

  it("chiede il rinnovo vicino alla scadenza e rifiuta file incompleti", () => {
    assert.deepEqual(checkSecurityTxt([file("2026-11-20T00:00:00.000Z")], now), [
      "public/.well-known/security.txt: Expires entro 30 giorni, da rinnovare",
    ]);
    assert.deepEqual(checkSecurityTxt([file("2028-11-20T00:00:00.000Z")], now), [
      "public/.well-known/security.txt: Expires oltre un anno",
    ]);
    assert.deepEqual(
      checkSecurityTxt([{ path: "public/.well-known/security.txt", text: "Expires: x" }], now),
      [
        "public/.well-known/security.txt: campo Contact assente",
        "public/.well-known/security.txt: campo Canonical assente",
        "public/.well-known/security.txt: campo Expires assente o non valido",
      ],
    );
    assert.deepEqual(checkSecurityTxt([], now), ["public/.well-known/security.txt: file assente"]);
  });
});
