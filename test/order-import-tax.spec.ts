import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { readDetail } from "../app/domain/order-acquisition-details.server";
import { openBudget } from "./fixtures/ebay-client-fixtures";

import { listVisibleOrders } from "../app/domain/orders.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { type OrderObservation } from "../app/domain/order-observation.server";

import { ebayConfiguration } from "../app/integrations/ebay/environment.server";

import { insertStorePause, now, resetOrderFixtures } from "./fixtures/database-fixtures";

import {
  grantedAt,
  target,
  line,
  observation,
  provisional,
  orders,
  setupScenarios,
} from "./fixtures/order-import-scenarios";

setupScenarios();

it("conserva ogni variazione fiscale effettiva e mostra solo il dato corrente", async () => {
  const tax = (complete: boolean, ...values: string[]) =>
    observation({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete,
        values: values.map((value) => ({
          type: "CODICE_FISCALE",
          issuingCountry: "IT",
          value,
        })),
      },
    });
  const changes = async (input: OrderObservation, observedAt: string) =>
    (
      (await recordOrderObservation(env.DB, target("s-a", observedAt), input)) as {
        taxChanges: number;
      }
    ).taxChanges;
  expect(
    await changes(tax(true, "RSSMRA80A01H501U", "RSSMRA80A01H501U"), "2026-09-11T00:00:00.000Z"),
  ).toBe(1);
  expect(await changes(tax(true, "RSSMRA80A01H501U"), "2026-09-12T00:00:00.000Z")).toBe(0);
  expect(await changes(tax(true, "BNCLGU80A01H501Z"), "2026-09-13T00:00:00.000Z")).toBe(2);
  // Una lettura che non prova l'assenza non chiude il valore corrente.
  expect(await changes(tax(false), "2026-09-14T00:00:00.000Z")).toBe(0);
  expect(await changes(tax(true, "RSSMRA80A01H501U"), "2026-09-15T00:00:00.000Z")).toBe(2);
  const { results: history } = await env.DB.prepare(
    "SELECT value, observed_at, removed_at FROM tax_identifiers ORDER BY rowid",
  ).all<{ value: string; observed_at: string; removed_at: string | null }>();
  expect(history).toMatchObject([
    { value: "RSSMRA80A01H501U", removed_at: expect.any(String) },
    { value: "BNCLGU80A01H501Z", removed_at: expect.any(String) },
    { value: "RSSMRA80A01H501U", removed_at: null },
  ]);
  for (const index of [0, 1]) {
    expect(history[index]!.observed_at <= history[index]!.removed_at!).toBe(true);
    expect(history[index]!.removed_at! <= history[index + 1]!.observed_at).toBe(true);
  }
  const [order] = await orders();
  await env.DB.prepare(
    `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
       VALUES ('g-1', 'w-a', ?, 'admin', ?)`,
  )
    .bind(order!.id, now)
    .run();
  expect((await listVisibleOrders(env.DB, "u-a"))[0]?.taxIdentifiers).toMatchObject([
    { value: "RSSMRA80A01H501U", observedAt: history[2]!.observed_at },
  ]);
});

it("distingue verifica, disponibilità e diritto senza esporre il valore bloccato", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const view = async () => (await listVisibleOrders(env.DB, "u-a"))[0]!;
  expect(await view()).toMatchObject({
    fiscalState: "checking",
    taxVerification: "checking",
    taxAvailability: "unknown",
    taxCheckedAt: null,
    firstTaxAvailableAt: null,
  });
  const check = (
    availability: "absent" | "not_included" | "masked" | "removed",
    complete = false,
  ) =>
    observation({
      taxIdentifiers: { source: "ebay_fulfillment", complete, availability, values: [] },
    });
  for (const availability of ["not_included", "masked", "absent", "removed"] as const) {
    await recordOrderObservation(env.DB, target(), check(availability, availability === "removed"));
    await env.DB.prepare("UPDATE order_source_refs SET detail_for = last_modified_time").run();
    expect(await view()).toMatchObject({
      taxVerification: "completed",
      taxAvailability: availability,
      taxCheckedAt: now,
      fiscalState: "missing",
    });
  }
  const withTax = observation({
    taxIdentifiers: {
      source: "ebay_fulfillment",
      complete: false,
      values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U", issuingCountry: "IT" }],
    },
  });
  const databaseTime = async () =>
    (await env.DB.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS at").first<{
      at: string;
    }>())!.at;
  const beforeAvailable = await databaseTime();
  await recordOrderObservation(env.DB, target(), withTax);
  const firstAvailable = (await view()).firstTaxAvailableAt!;
  expect(firstAvailable >= beforeAvailable && firstAvailable <= (await databaseTime())).toBe(true);
  expect(firstAvailable).not.toBe(now);
  expect(await view()).toMatchObject({
    fiscalState: "locked",
    lockedShownAs: "CF",
    taxAvailability: "present",
    taxIdentifiers: [],
    firstTaxAvailableAt: firstAvailable,
  });
  expect(JSON.stringify(await view())).not.toContain("RSSMRA80A01H501U");
  await env.DB.prepare(
    "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('tax-grant', 'w-a', ?, 'admin', ?)",
  )
    .bind((await view()).id, now)
    .run();
  await env.DB.prepare("UPDATE order_source_refs SET detail_error = 'rejected'").run();
  expect(await view()).toMatchObject({
    fiscalState: "available",
    taxVerification: "error",
    taxIdentifiers: [{ value: "RSSMRA80A01H501U", quality: "valid" }],
  });
  await recordOrderObservation(env.DB, target(), check("masked"));
  expect(await view()).toMatchObject({
    taxAvailability: "masked",
    taxIdentifiers: [{ value: "RSSMRA80A01H501U" }],
  });
  await recordOrderObservation(env.DB, target(), check("removed", true));
  expect(await view()).toMatchObject({ taxIdentifiers: [], firstTaxAvailableAt: firstAvailable });
  expect(await env.DB.prepare("SELECT count(*) AS total FROM order_grants").first()).toEqual({
    total: 1,
  });
  const removed = await env.DB.prepare("SELECT removed_at FROM tax_identifiers").first<{
    removed_at: string;
  }>();
  expect(removed!.removed_at >= firstAvailable).toBe(true);
});

it("prima dello sblocco nomina la Partita IVA solo quando l'ordine ha soltanto quella", async () => {
  const tax = (values: Array<{ type: string; issuingCountry: string; value: string }>) =>
    observation({ taxIdentifiers: { source: "ebay_fulfillment", complete: false, values } });
  await recordOrderObservation(
    env.DB,
    target(),
    tax([{ type: "VAT_ID", issuingCountry: "IT", value: "12345678903" }]),
  );
  const view = async () => (await listVisibleOrders(env.DB, "u-a"))[0]!;
  expect(await view()).toMatchObject({ fiscalState: "locked", lockedShownAs: "PIVA" });
  expect(JSON.stringify(await view())).not.toContain("12345678903");
  await recordOrderObservation(
    env.DB,
    target(),
    tax([
      { type: "VAT_ID", issuingCountry: "IT", value: "12345678903" },
      { type: "CODICE_FISCALE", issuingCountry: "IT", value: "RSSMRA80A01H501U" },
    ]),
  );
  expect(await view()).toMatchObject({ fiscalState: "locked", lockedShownAs: "CF" });
});

it("prima dello sblocco nomina Partita IVA il numero che eBay riporta come Codice Fiscale", async () => {
  const tax = (value: string) =>
    observation({
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: true,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value }],
      },
    });
  const view = async () => (await listVisibleOrders(env.DB, "u-a"))[0]!;
  await recordOrderObservation(env.DB, target(), tax("0123 4567 897"));
  expect(await view()).toMatchObject({ fiscalState: "locked", lockedShownAs: "PIVA" });
  // Il codice numerico di un ente e ogni altra forma restano Codice Fiscale.
  for (const value of [
    "80012345678",
    "97012345678",
    "012345678978",
    "0123456789A",
    "A1234567897",
  ]) {
    await recordOrderObservation(env.DB, target(), tax(value));
    expect(await view(), value).toMatchObject({ fiscalState: "locked", lockedShownAs: "CF" });
  }
  // Un codice estero non cambia il nome: conta soltanto se c'è un Codice Fiscale italiano.
  const values = (...entries: Array<[string, string, string]>) =>
    observation({
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: true,
        values: entries.map(([type, issuingCountry, value]) => ({ type, issuingCountry, value })),
      },
    });
  await recordOrderObservation(
    env.DB,
    target(),
    values(["CODICE_FISCALE", "IT", "01234567897"], ["VAT", "DE", "DE123456789"]),
  );
  expect(await view()).toMatchObject({ fiscalState: "locked", lockedShownAs: "PIVA" });
  await recordOrderObservation(env.DB, target(), values(["VAT", "DE", "DE123456789"]));
  expect(await view()).toMatchObject({ lockedShownAs: "CF" });
});

it("normalizza le riletture, aggiorna il tipo presente e conserva gli altri identificativi", async () => {
  const value = { type: "CODICE_FISCALE", issuingCountry: null, value: " rssmra80a01h501u " };
  const fiscal = (values: NonNullable<OrderObservation["taxIdentifiers"]>["values"]) =>
    observation({
      taxIdentifiers: { source: "ebay_trading_get_orders", complete: false, values },
    });
  await recordOrderObservation(
    env.DB,
    target(),
    fiscal([value, { type: "VAT_ID", issuingCountry: "IT", value: "12345678903" }]),
  );
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      fiscal([{ type: "CodiceFiscale", value: "RSSMRA80A01H501U", issuingCountry: undefined }]),
    ),
  ).toMatchObject({ taxChanges: 0 });
  const updated = await recordOrderObservation(
    env.DB,
    target("s-a", "2026-09-14T00:00:00Z"),
    fiscal([{ ...value, type: "CodiceFiscale", value: "BNCLGU80A01H501Z" }]),
  );
  expect(updated).toMatchObject({ taxChanges: 2 });
  expect(
    await env.DB.prepare(
      "SELECT identifier_type, value FROM tax_identifiers WHERE removed_at IS NULL ORDER BY identifier_type",
    ).all(),
  ).toMatchObject({
    results: [
      { identifier_type: "CodiceFiscale", value: "BNCLGU80A01H501Z" },
      { identifier_type: "VAT_ID", value: "12345678903" },
    ],
  });
  expect(
    await recordOrderObservation(
      env.DB,
      target("s-a", "2026-09-14T01:00:00Z"),
      fiscal([{ ...value, value: "BNCLGU80A01H501Z" }]),
    ),
  ).toMatchObject({ taxChanges: 0 });
  expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual({
    total: 3,
  });
  const [visible] = await listVisibleOrders(env.DB, "u-a");
  await env.DB.prepare(
    "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('changed-tax', 'w-a', ?, 'admin', ?)",
  )
    .bind(visible!.id, now)
    .run();
  expect((await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers).toMatchObject([
    { type: "CodiceFiscale", updated: true },
    { type: "VAT_ID", updated: false },
  ]);
  expect(
    await recordOrderObservation(
      env.DB,
      target("s-a", "2026-09-14T02:00:00Z"),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", issuingCountry: null, value: "BNCLGU80A01H501Z" }],
        },
      }),
    ),
  ).toMatchObject({ taxChanges: 0 });
  expect((await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers).toMatchObject([
    { type: "CODICE_FISCALE", source: "ebay_fulfillment", updated: true },
    { type: "VAT_ID", updated: false },
  ]);
});

it("scarta una risposta fiscale tardiva anche con la stessa versione dell'ordine", async () => {
  const fiscal = (modified: string, value: string) =>
    observation({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        lastModifiedTime: modified,
        complete: true,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value }],
      },
    });
  const newer = fiscal("2026-09-10T12:00:00Z", "NUOVO-SINTETICO");
  await recordOrderObservation(env.DB, target("s-a", "2026-09-14T00:00:00Z"), newer);
  for (const [input, at] of [
    [fiscal("2026-09-10T11:00:00Z", "VECCHIO-SINTETICO"), "2026-09-15T00:00:00Z"],
    [newer, "2026-09-13T00:00:00Z"],
    [
      { ...newer, taxIdentifiers: { ...newer.taxIdentifiers!, lastModifiedTime: undefined } },
      "2026-09-15T00:00:00Z",
    ],
  ] as const) {
    expect(await recordOrderObservation(env.DB, target("s-a", at), input)).toEqual({
      outcome: "stale",
    });
  }
  expect(await env.DB.prepare("SELECT value FROM tax_identifiers").all()).toMatchObject({
    results: [{ value: "NUOVO-SINTETICO" }],
  });
  expect(await env.DB.prepare("SELECT observed_at FROM order_tax_checks").first()).toEqual({
    observed_at: "2026-09-14T00:00:00.000Z",
  });
});

it("la sola provenienza non genera un cambiamento fiscale o una seconda prima disponibilità", async () => {
  const value = { type: "CodiceFiscale", issuingCountry: null, value: " rssmra80a01h501u " };
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      taxIdentifiers: { source: "ebay_trading_get_orders", complete: false, values: [value] },
    }),
  );
  const firstAvailable = (await listVisibleOrders(env.DB, "u-a"))[0]!.firstTaxAvailableAt;
  expect(
    await recordOrderObservation(
      env.DB,
      target("s-a", "2026-09-14T00:00:00Z"),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [
            { ...value, type: "CODICE_FISCALE", issuingCountry: "IT", value: "RSSMRA80A01H501U" },
          ],
        },
      }),
    ),
  ).toMatchObject({ taxChanges: 0 });
  expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual({
    total: 2,
  });
  expect((await listVisibleOrders(env.DB, "u-a"))[0]).toMatchObject({
    firstTaxAvailableAt: firstAvailable,
    taxIdentifiers: [],
  });
});

it("mantiene distinti tipo e Paese degli identificativi esteri", async () => {
  const fiscal = (values: NonNullable<OrderObservation["taxIdentifiers"]>["values"]) =>
    observation({
      taxIdentifiers: { source: "ebay_trading_get_orders", complete: false, values },
    });
  await recordOrderObservation(
    env.DB,
    target(),
    fiscal([
      { type: "NIF", issuingCountry: "ES", value: "A" },
      { type: "TIN", issuingCountry: "ES", value: "B" },
    ]),
  );
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      fiscal([{ type: "NIF", issuingCountry: "ES", value: "C" }]),
    ),
  ).toMatchObject({ taxChanges: 2 });
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      fiscal([{ type: "NIF", issuingCountry: "FR", value: "C" }]),
    ),
  ).toMatchObject({ taxChanges: 1 });
  expect(
    await env.DB.prepare(
      "SELECT identifier_type, issuing_country, value FROM tax_identifiers WHERE removed_at IS NULL ORDER BY identifier_type, issuing_country",
    ).all(),
  ).toMatchObject({
    results: [
      { identifier_type: "NIF", issuing_country: "ES", value: "C" },
      { identifier_type: "NIF", issuing_country: "FR", value: "C" },
      { identifier_type: "TIN", issuing_country: "ES", value: "B" },
    ],
  });
});

it("un provvisorio tardivo non rimuove il dato fiscale del definitivo", async () => {
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: true,
        lastModifiedTime: "2026-09-10T10:00:00Z",
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "DEFINITIVO" }],
      },
    }),
  );
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      lastModifiedTime: "2026-09-10T12:00:00Z",
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: false,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "PROVVISORIO" }],
      },
    }),
  );
  expect(
    await env.DB.prepare(
      "SELECT value FROM tax_identifiers WHERE removed_at IS NULL ORDER BY value",
    ).all(),
  ).toMatchObject({ results: [{ value: "DEFINITIVO" }, { value: "PROVVISORIO" }] });
  expect((await orders())[0]).toMatchObject({ ebay_order_id: "D-1", is_provisional: 0 });
});

it("il guard transazionale tratta gli identificativi esterni come dati", async () => {
  const input = observation({ externalOrderId: "ordine' OR 1=1 --" });
  await recordOrderObservation(env.DB, target(), input);
  expect(await recordOrderObservation(env.DB, target(), input)).toMatchObject({
    outcome: "unchanged",
  });
  expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first()).toEqual({
    total: 1,
  });
});

it("l'indicazione di modifica resta legata al tipo di identificativo", async () => {
  const fiscal = (values: NonNullable<OrderObservation["taxIdentifiers"]>["values"]) =>
    observation({
      taxIdentifiers: { source: "ebay_trading_get_orders", complete: false, values },
    });
  await recordOrderObservation(
    env.DB,
    target(),
    fiscal([
      { type: "NIF", issuingCountry: "ES", value: "A" },
      { type: "TIN", issuingCountry: "ES", value: "B" },
    ]),
  );
  await recordOrderObservation(
    env.DB,
    target(),
    fiscal([{ type: "TIN", issuingCountry: "ES", value: "C" }]),
  );
  const [order] = await orders();
  await env.DB.prepare(
    "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('foreign-updated', 'w-a', ?, 'admin', ?)",
  )
    .bind(order!.id, now)
    .run();
  expect((await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers).toMatchObject([
    { type: "NIF", updated: false },
    { type: "TIN", updated: true },
  ]);
});

it("l'indicazione di modifica considera gli ordini assorbiti e il CF senza Paese", async () => {
  const cf = (externalOrderId: string, issuingCountry: string | null, value: string) =>
    observation({
      externalOrderId,
      items: [line(externalOrderId)],
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: false,
        values: [{ type: "CODICE_FISCALE", issuingCountry, value }],
      },
    });
  await recordOrderObservation(env.DB, target(), cf("D-1", "IT", "RSSMRA80A01H501U"));
  await recordOrderObservation(env.DB, target(), cf("D-2", null, "RSSMRA80A41H501Y"));
  const [kept, absorbed] = await orders();
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET merged_into = ?1 WHERE id = ?2").bind(kept!.id, absorbed!.id),
    env.DB.prepare(
      "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('merged-updated', 'w-a', ?, 'admin', ?)",
    ).bind(kept!.id, now),
  ]);
  const updated = async () =>
    (await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers.map(({ value, updated }) => [
      value,
      updated,
    ]);
  // Un CF ancora valido nell'ordine assorbito non è una modifica di eBay.
  expect(await updated()).toEqual([["RSSMRA80A01H501U", false]]);
  await env.DB.prepare(
    "UPDATE tax_identifiers SET removed_at = '2026-09-01T00:00:00.000Z' WHERE order_id = ?",
  )
    .bind(absorbed!.id)
    .run();
  expect(await updated()).toEqual([["RSSMRA80A01H501U", true]]);
  // Un altro tipo rimosso nell'ordine assorbito non riguarda il CF.
  await env.DB.prepare(
    "UPDATE tax_identifiers SET identifier_type = 'VAT_ID', issuing_country = 'IT' WHERE order_id = ?",
  )
    .bind(absorbed!.id)
    .run();
  expect(await updated()).toEqual([["RSSMRA80A01H501U", false]]);
});

it("un'osservazione Trading coincidente non cancella l'indicazione di modifica Fulfillment", async () => {
  for (const value of ["PRECEDENTE", "RSSMRA80A01H501U"]) {
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value }],
        },
      }),
    );
  }
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: false,
        values: [{ type: "CODICE_FISCALE", issuingCountry: null, value: "RSSMRA80A01H501U" }],
      },
    }),
  );
  const [order] = await orders();
  await env.DB.prepare(
    "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('fulfillment-updated', 'w-a', ?, 'admin', ?)",
  )
    .bind(order!.id, now)
    .run();
  expect((await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers).toMatchObject([
    { source: "ebay_fulfillment", updated: true },
  ]);
});

it.each(["CODICE_FISCALE", "CodiceFiscale"])(
  "mostra una sola volta i CF Trading coincidenti: %s",
  async (knownType) => {
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          values: [{ type: knownType, issuingCountry: "IT", value: "PRECEDENTE" }],
        },
      }),
    );
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          values: [
            { type: "CODICE_FISCALE", issuingCountry: null, value: " rssmra80a01h501u " },
            { type: knownType, issuingCountry: "IT", value: "RSSMRA80A01H501U" },
            { type: "CODICE_FISCALE", issuingCountry: "ES", value: "RSSMRA80A01H501U" },
          ],
        },
      }),
    );
    const [order] = await orders();
    await env.DB.prepare(
      "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('duplicates', 'w-a', ?, 'admin', ?)",
    )
      .bind(order!.id, now)
      .run();
    const [view] = await listVisibleOrders(env.DB, "u-a");
    expect(view!.taxIdentifiers).toHaveLength(2);
    expect(view!.taxIdentifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CODICE_FISCALE",
          issuingCountry: "ES",
          value: "RSSMRA80A01H501U",
          updated: false,
        }),
        expect.objectContaining({
          type: knownType,
          issuingCountry: "IT",
          value: "RSSMRA80A01H501U",
          updated: true,
        }),
      ]),
    );
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", issuingCountry: null, value: "RSSMRA80A01H501U" }],
        },
      }),
    );
    const [preferred] = await listVisibleOrders(env.DB, "u-a");
    expect(preferred!.taxIdentifiers).toHaveLength(2);
    expect(preferred!.taxIdentifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CODICE_FISCALE",
          issuingCountry: "ES",
          value: "RSSMRA80A01H501U",
          updated: false,
        }),
        expect.objectContaining({
          type: "CODICE_FISCALE",
          issuingCountry: null,
          source: "ebay_fulfillment",
          value: "RSSMRA80A01H501U",
          updated: true,
        }),
      ]),
    );
  },
);

it.each([true, false])(
  "ricontrolla la versione nel batch prima di ogni scrittura, fiscale %s",
  async (withTax) => {
    await recordOrderObservation(env.DB, target(), observation({ externalOrderId: "D'-1" }));
    const originalBatch = env.DB.batch.bind(env.DB);
    const batch = vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await env.DB.prepare(
        "UPDATE order_source_refs SET last_modified_time = '2026-09-10T13:00:00.000Z'",
      ).run();
      return originalBatch(statements);
    });
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      expect(
        await recordOrderObservation(
          env.DB,
          target(),
          observation({
            externalOrderId: "D'-1",
            lastModifiedTime: "2026-09-10T12:00:00Z",
            buyer: { name: "Tardivo" },
            items: [line("k3")],
            taxIdentifiers: withTax
              ? {
                  source: "ebay_fulfillment",
                  complete: true,
                  values: [{ type: "CODICE_FISCALE", value: "TARDIVO", issuingCountry: "IT" }],
                }
              : undefined,
          }),
        ),
      ).toEqual({ outcome: "stale" });
      expect(logged).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({ event: "stale_order_observation", count: 1 }),
      );
    } finally {
      batch.mockRestore();
      logged.mockRestore();
    }
    expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
    expect(
      await env.DB.prepare("SELECT stable_key FROM order_items ORDER BY stable_key").all(),
    ).toMatchObject({ results: [{ stable_key: "k1" }, { stable_key: "k2" }] });
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual({
      total: 0,
    });
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM order_tax_checks").first()).toEqual({
      total: 0,
    });
  },
);

it("conserva la versione della fonte senza usare quella dell'altra API", async () => {
  for (const source of ["fulfillment", "trading"] as const) {
    await resetOrderFixtures();
    const taxSource = source === "fulfillment" ? "ebay_fulfillment" : "ebay_trading_get_orders";
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ source, taxIdentifiers: { source: taxSource, complete: false, values: [] } }),
    );
    expect(await env.DB.prepare("SELECT last_modified_time FROM order_tax_checks").first()).toEqual(
      { last_modified_time: "2026-09-10T11:00:00.000Z" },
    );
    await resetOrderFixtures();
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        source,
        taxIdentifiers: {
          source: taxSource === "ebay_fulfillment" ? "ebay_trading_get_orders" : "ebay_fulfillment",
          complete: false,
          values: [],
        },
      }),
    );
    expect(await env.DB.prepare("SELECT last_modified_time FROM order_tax_checks").first()).toEqual(
      { last_modified_time: null },
    );
  }
});

it.each(["fulfillment", "trading"] as const)(
  "rifiuta una verifica anteriore all'ordine già letto dalla fonte %s",
  async (source) => {
    await recordOrderObservation(env.DB, target(), observation({ source }));
    const other = source === "fulfillment" ? "trading" : "fulfillment";
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          source: other,
          lastModifiedTime: "2026-09-10T12:00:00Z",
          taxIdentifiers: {
            source: source === "fulfillment" ? "ebay_fulfillment" : "ebay_trading_get_orders",
            lastModifiedTime: "2026-09-10T10:00:00Z",
            complete: false,
            values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "TARDIVO" }],
          },
        }),
      ),
    ).toEqual({ outcome: "stale" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual({
      total: 0,
    });
  },
);

it("un campo fiscale Trading malformato resta un errore distinto dall'assenza", async () => {
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: false,
        verification: "error",
        availability: "not_included",
        values: [],
      },
    }),
  );
  // Le viste mostrano soltanto ordini definitivi.
  await env.DB.prepare("UPDATE orders SET is_provisional = 0").run();
  expect((await listVisibleOrders(env.DB, "u-a"))[0]).toMatchObject({
    fiscalState: "error",
    taxVerification: "error",
    taxAvailability: "not_included",
  });
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: false,
        availability: "not_included",
        values: [],
      },
    }),
  );
  expect((await listVisibleOrders(env.DB, "u-a"))[0]).toMatchObject({
    fiscalState: "missing",
    taxVerification: "completed",
    taxAvailability: "not_included",
  });
});

it.each([
  { mode: "successo successivo", version: "11", attempts: 0, expectedAttempts: 0 },
  { mode: "versione vecchia", version: "10", attempts: 2, expectedAttempts: 3 },
  { mode: "versione nuova", version: "12", attempts: 2, expectedAttempts: 1 },
])(
  "un errore del dettaglio rispetta $mode",
  async ({ mode, version, attempts, expectedAttempts }) => {
    await recordOrderObservation(env.DB, target(), observation());
    const [stored] = await orders();
    const later = "2026-09-14T00:00:00.000Z";
    const modified = "2026-09-10T11:00:00.000Z";
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("/sell/fulfillment/"))
        return Response.json({
          orderId: "D-1",
          creationDate: "2026-09-10T10:00:00Z",
          lastModifiedDate: `2026-09-10T${version}:00:00.000Z`,
          pricingSummary: { total: { value: "25.00", currency: "EUR" } },
          lineItems: [],
        });
      if (mode === "successo successivo") {
        await env.DB.prepare(
          "INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability) VALUES (?, 'ebay_trading_get_orders', ?, ?, 'absent')",
        )
          .bind(stored!.id, modified, later)
          .run();
        await env.DB.prepare(
          "UPDATE order_source_refs SET detail_for = last_modified_time, detail_error = NULL",
        ).run();
      }
      return new Response("risposta malformata");
    };
    await readDetail(
      {
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: {
          configuration: ebayConfiguration(env, "production"),
          fetcher,
          accessToken: "sintetico",
        },
        at: now,
        budget: { calls: 10, pages: 1 },
        created: 0,
        quota: openBudget,
      },
      {
        external_order_id: "D-1",
        last_modified_time: modified,
        detail_attempts: attempts,
        marketplace_id: null,
        creation_time: now,
      },
    );
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
      ).first(),
    ).toEqual({
      detail_for: mode === "successo successivo" ? modified : null,
      detail_error: mode === "successo successivo" ? null : "invalid_response",
      detail_attempts: expectedAttempts,
    });
  },
);

it("il consolidamento conserva la precedenza temporale di una verifica sull'ordine assorbito", async () => {
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({ externalOrderId: "P-1", items: [line("k1")] }),
  );
  await recordOrderObservation(
    env.DB,
    target("s-a", "2026-09-14T00:00:00Z"),
    provisional({
      externalOrderId: "P-2",
      items: [line("k2")],
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: true,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "NUOVO-SINTETICO" }],
      },
    }),
  );
  const late = observation({
    taxIdentifiers: {
      source: "ebay_trading_get_orders",
      complete: true,
      lastModifiedTime: "2026-09-10T10:30:00Z",
      values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "VECCHIO-SINTETICO" }],
    },
  });
  expect(await recordOrderObservation(env.DB, target("s-a", "2026-09-13T00:00:00Z"), late)).toEqual(
    { outcome: "stale" },
  );
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE merged_into IS NULL").first(),
  ).toEqual({ total: 2 });
  await recordOrderObservation(env.DB, target(), observation());
  expect(
    await recordOrderObservation(
      env.DB,
      target("s-a", "2026-09-13T00:00:00Z"),
      observation({
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: true,
          lastModifiedTime: "2026-09-10T10:30:00Z",
          values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "VECCHIO-SINTETICO" }],
        },
      }),
    ),
  ).toEqual({ outcome: "stale" });
  expect(
    await env.DB.prepare(
      "SELECT value FROM tax_identifiers WHERE value = 'VECCHIO-SINTETICO'",
    ).all(),
  ).toMatchObject({ results: [] });
});

it("non scrive con un consenso diverso o con il negozio in pausa", async () => {
  expect(
    await recordOrderObservation(
      env.DB,
      { ...target(), consentGrantedAt: "2026-08-01T00:00:00.000Z" },
      observation(),
    ),
  ).toEqual({ outcome: "not_writable" });
  await insertStorePause().run();
  expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
    outcome: "not_writable",
  });
  expect(await orders()).toEqual([]);
  // Anche un ordine già salvato non cambia dopo la pausa.
  await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
  await recordOrderObservation(env.DB, target(), observation());
  await insertStorePause().run();
  const later = observation({
    lastModifiedTime: "2026-09-10T12:00:00Z",
    paymentStatus: "PENDING",
  });
  expect(await recordOrderObservation(env.DB, target(), later)).toEqual({
    outcome: "not_writable",
  });
  expect(await orders()).toMatchObject([{ payment_status: "PAID" }]);
});

it("attribuisce i campi alla fonte proprietaria dell'ordine", async () => {
  const trading = (overrides: Partial<OrderObservation>) =>
    observation({ source: "trading", externalOrderId: "T-1", ...overrides });
  const steps = [
    // Un ordine letto solo da Trading segue le letture Trading più recenti.
    [trading({ paymentStatus: "PENDING" }), "created", "T-1", "PENDING"],
    [trading({ lastModifiedTime: "2026-09-10T12:00:00Z" }), "updated", "T-1", "PAID"],
    // Un provvisorio non sostituisce il definitivo, neppure se più recente.
    [
      provisional({ externalOrderId: "P-9", lastModifiedTime: "2026-09-10T13:00:00Z" }),
      "unchanged",
      "T-1",
      "PAID",
    ],
    // Un altro ID Trading più vecchio aggancia soltanto il riferimento.
    [
      trading({
        externalOrderId: "T-0",
        lastModifiedTime: "2026-09-10T10:00:00Z",
        paymentStatus: "PENDING",
        items: [line("k1", "vecchia-1"), line("k2", "vecchia-2")],
      }),
      "unchanged",
      "T-1",
      "PAID",
    ],
    // Fulfillment subentra anche con una data precedente.
    [
      observation({ lastModifiedTime: "2026-09-10T09:00:00Z", paymentStatus: "PENDING" }),
      "updated",
      "D-1",
      "PENDING",
    ],
  ] as const;
  for (const [input, outcome, ebayOrderId, paymentStatus] of steps) {
    expect(await recordOrderObservation(env.DB, target(), input)).toMatchObject({ outcome });
    expect(await orders()).toMatchObject([
      { ebay_order_id: ebayOrderId, payment_status: paymentStatus },
    ]);
  }
});

it("riconosce le righe salvate senza identità e non abbina due righe alla stessa", async () => {
  const created = await recordOrderObservation(
    env.DB,
    target(),
    observation({ items: [line(null, "r1")] }),
  );
  const [saved] = await env.DB.prepare("SELECT id FROM order_items")
    .all<{ id: string }>()
    .then(({ results }) => results);
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ lastModifiedTime: "2026-09-10T12:00:00Z", items: [line("k1", "r1")] }),
    ),
  ).toMatchObject({ outcome: "updated", orderId: (created as { orderId: string }).orderId });
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        lastModifiedTime: "2026-09-10T13:00:00Z",
        items: [line("k1", "r2"), line(null, "r1")],
      }),
    ),
  ).toMatchObject({ outcome: "updated" });
  const { results: rows } = await env.DB.prepare(
    "SELECT id, line_item_id, stable_key FROM order_items ORDER BY line_item_id",
  ).all<{ id: string; line_item_id: string; stable_key: string | null }>();
  expect(rows.map(({ line_item_id, stable_key }) => [line_item_id, stable_key])).toEqual([
    ["r1", null],
    ["r2", "k1"],
  ]);
  expect(rows[1]!.id).toBe(saved!.id);
  expect(rows[0]!.id).not.toBe(saved!.id);

  // Rilette in ordine inverso, con e senza identità, le righe restano le stesse.
  const reversed = observation({
    lastModifiedTime: "2026-09-10T14:00:00Z",
    items: [line(null, "r1"), line("k1", "r2")],
  });
  expect(await recordOrderObservation(env.DB, target(), reversed)).toMatchObject({
    outcome: "unchanged",
  });
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      lastModifiedTime: "2026-09-10T15:00:00Z",
      items: [line("k1", "r2"), line("k2", "r3"), line(null, "r1"), line(null, "r4")],
    }),
  );
  const before = await env.DB.prepare("SELECT id, line_item_id FROM order_items ORDER BY id")
    .all()
    .then(({ results }) => results);
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        lastModifiedTime: "2026-09-10T16:00:00Z",
        items: [line(null, "r4"), line("k2", "r3"), line(null, "r1"), line("k1", "r2")],
      }),
    ),
  ).toMatchObject({ outcome: "unchanged" });
  expect(
    await env.DB.prepare("SELECT id, line_item_id FROM order_items ORDER BY id")
      .all()
      .then(({ results }) => results),
  ).toEqual(before);
});

it("valida l'osservazione e salva lo snapshot con tutti i campi", async () => {
  for (const invalid of [
    observation({ total: { minor: 1, currency: "EURO" } }),
    observation({ items: [line("k1", "stessa"), line("k2", "stessa")] }),
    observation({ items: [line("k1", "a"), line("k1", "b")] }),
  ]) {
    await expect(recordOrderObservation(env.DB, target(), invalid)).rejects.toThrow();
  }
  const address = {
    addressLine1: "Via Roma 1",
    addressLine2: null,
    city: "Trento",
    postalCode: "38122",
    stateOrProvince: "TN",
    countryCode: "IT",
  };
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      buyer: {
        username: "acquirente",
        name: "Mario Rossi",
        email: "a@example.invalid",
        phone: "+39 1",
        billingAddress: { ...address, extra: "NON-ESPORRE" } as typeof address,
        shipTo: { name: "Anna", address },
      },
      // Righe senza identità possono essere più d'una.
      items: [line(null, "a"), line(null, "b")],
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: true,
        values: [{ type: "VAT_ID", issuingCountry: null, value: "01234567890" }],
      },
    }),
  );
  expect((await orders())[0]!.buyer_json).toBe(
    JSON.stringify({
      username: "acquirente",
      name: "Mario Rossi",
      email: "a@example.invalid",
      phone: "+39 1",
      billingAddress: address,
      shipTo: { name: "Anna", phone: null, address },
    }),
  );
  // La stessa lettura completa con Paese nullo non chiude il valore.
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        buyer: { username: "acquirente" },
        items: [line(null, "a"), line(null, "b")],
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: true,
          values: [{ type: "VAT_ID", issuingCountry: null, value: "01234567890" }],
        },
      }),
    ),
  ).toMatchObject({ outcome: "updated", taxChanges: 0 });
  expect(
    await env.DB.prepare("SELECT source, removed_at FROM tax_identifiers")
      .all()
      .then(({ results }) => results),
  ).toEqual([{ source: "ebay_fulfillment", removed_at: null }]);
  expect((await orders())[0]!.buyer_json).toBe(
    JSON.stringify({
      username: "acquirente",
      name: null,
      email: null,
      phone: null,
      billingAddress: null,
      shipTo: null,
    }),
  );
});

it("limita la pagina degli ordini visibili", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ externalOrderId: "D-2", items: [line("k9")] }),
  );
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(2);
  expect(await listVisibleOrders(env.DB, "u-a", 1)).toHaveLength(1);
  expect(await listVisibleOrders(env.DB, "u-a", 0)).toHaveLength(1);
});
