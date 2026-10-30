import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  declaredSecrets,
  parseRegistry,
  registrySql,
  report,
  review,
} from "./credential-expiries.mjs";

const registry = JSON.stringify({
  test: [
    { name: "EBAY_CLIENT_SECRET", expires: "2026-12-01" },
    { name: "Token «FiscalBay metriche test»", expires: "2027-06-30" },
    { name: "STRIPE_SECRET_KEY", expires: null },
    { name: "BETTER_AUTH_SECRET", expires: "never" },
    { name: "GOOGLE_CLIENT_SECRET", expires: "2026-10-29" },
  ],
  live: [],
});

describe("registro delle scadenze", () => {
  it("legge le voci dell'ambiente e rifiuta il registro con una voce non valida", () => {
    assert.equal(parseRegistry(registry, "test").length, 5);
    assert.deepEqual(parseRegistry(registry, "live"), []);
    assert.throws(() => parseRegistry("{", "test"), /JSON valido/u);
    assert.throws(() => parseRegistry("{}", "test"), /elenco «test»/u);
    const one = (entry) => JSON.stringify({ test: [entry] });
    assert.throws(() => parseRegistry(one({ name: "", expires: null }), "test"), /nome logico/u);
    assert.throws(
      () => parseRegistry(one({ name: "x; DROP TABLE", expires: null }), "test"),
      /nome logico/u,
    );
    assert.throws(
      () => parseRegistry(one({ name: "A", expires: "2026-02-30" }), "test"),
      /scadenza non valida/u,
    );
    assert.throws(() => parseRegistry(one({ name: "A", expires: 5 }), "test"), /scadenza/u);
    assert.throws(
      () =>
        parseRegistry(
          JSON.stringify({
            test: [
              { name: "A", expires: null },
              { name: "A", expires: null },
            ],
          }),
          "test",
        ),
      /due volte/u,
    );
  });

  it("classifica le voci a 45 giorni e segnala i segreti del Worker senza voce", () => {
    const entries = parseRegistry(registry, "test");
    const result = review(
      entries,
      ["BETTER_AUTH_SECRET", "EBAY_RUNAME"],
      new Date("2026-10-29T15:00:00Z"),
    );
    assert.deepEqual(
      result.rows.map((row) => [row.name, row.state, row.days]),
      [
        ["EBAY_CLIENT_SECRET", "expiring", 33],
        ["Token «FiscalBay metriche test»", "valid", 244],
        ["STRIPE_SECRET_KEY", "undated", undefined],
        ["BETTER_AUTH_SECRET", "never", undefined],
        ["GOOGLE_CLIENT_SECRET", "expired", 0],
      ],
    );
    assert.deepEqual(result.missing, ["EBAY_RUNAME"]);
    const text = report("test", result);
    assert.match(text, /1 scadute, 1 entro 45 giorni, 2 senza data/u);
    assert.doesNotMatch(text, /secret_value/u);
  });

  it("sostituisce il registro senza le voci che non scadono e con i segreti mancanti senza data", () => {
    const entries = parseRegistry(
      JSON.stringify({
        test: [
          { name: "Token dell'owner", expires: "2027-01-01" },
          { name: "BETTER_AUTH_SECRET", expires: "never" },
        ],
      }),
      "test",
    );
    assert.equal(
      registrySql(entries, ["EBAY_RUNAME"], new Date("2026-10-29T00:00:00.000Z")),
      [
        "DELETE FROM credential_expiries;",
        "INSERT INTO credential_expiries (name, expires_on, recorded_at) VALUES ('Token dell''owner', '2027-01-01', '2026-10-29T00:00:00.000Z');",
        "INSERT INTO credential_expiries (name, expires_on, recorded_at) VALUES ('EBAY_RUNAME', NULL, '2026-10-29T00:00:00.000Z');",
      ].join("\n"),
    );
  });

  it("legge i segreti dichiarati per ciascun ambiente", () => {
    for (const mode of ["test", "live"]) {
      const secrets = declaredSecrets(mode);
      assert.ok(secrets.includes("BETTER_AUTH_SECRET"));
      assert.ok(secrets.includes("EBAY_CLIENT_SECRET"));
      assert.ok(!secrets.includes("APP_ORIGIN"));
      // Anche i facoltativi: senza la voce la loro scadenza non aprirebbe un incidente.
      assert.ok(secrets.includes("STRIPE_SECRET_KEY"));
      assert.equal(secrets.includes("EBAY_SANDBOX_CLIENT_SECRET"), mode !== "live");
    }
  });
});
