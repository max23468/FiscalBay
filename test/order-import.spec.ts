import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { unlockOrders } from "../app/domain/grants.server";

import { listVisibleOrders } from "../app/domain/orders.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { type OrderObservation } from "../app/domain/order-observation.server";

import { now, resetOrderFixtures } from "./fixtures/database-fixtures";

import {
  target,
  line,
  observation,
  provisional,
  orders,
  current,
  setupScenarios,
} from "./fixtures/order-import-scenarios";

setupScenarios();

it("conserva i campi noti e lascia mascherati quelli annidati mai acquisiti", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      lastModifiedTime: "2026-09-10T12:00:00Z",
      buyer: {
        username: "acquirente",
        name: null,
        billingAddress: { addressLine1: null, city: "Trento" },
        shipTo: { name: null },
        masked: ["name", "billingAddress.addressLine1", "shipTo.name"],
      },
    }),
  );
  expect(JSON.parse((await orders())[0]!.buyer_json as string)).toMatchObject({
    name: "Mario Rossi",
    billingAddress: { addressLine1: null, city: "Trento" },
    shipTo: { name: null },
    masked: ["billingAddress.addressLine1", "shipTo.name"],
  });
});

it("importa ordini multi-articolo in modo idempotente, senza versioni per la sola data", async () => {
  const created = await recordOrderObservation(env.DB, target(), observation());
  expect(created).toMatchObject({ outcome: "created", taxChanges: 0, issue: null });
  const items = () =>
    env.DB.prepare(
      "SELECT id, line_item_id, total_minor, currency FROM order_items ORDER BY line_item_id",
    )
      .all()
      .then(({ results }) => results);
  const firstItems = await items();
  expect(firstItems).toHaveLength(2);

  expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
    outcome: "unchanged",
    orderId: (created as { orderId: string }).orderId,
    taxChanges: 0,
    issue: null,
  });
  const touched = observation({ lastModifiedTime: "2026-09-10T12:00:00Z" });
  expect((await recordOrderObservation(env.DB, target(), touched)).outcome).toBe("unchanged");
  expect(await items()).toEqual(firstItems);

  // Una sola riga modificata, poi il solo ordine, poi un cambiamento con la stessa data.
  const quantity = [{ ...line("k1"), quantity: 2 }, line("k2")];
  for (const [lastModifiedTime, paymentStatus] of [
    ["2026-09-10T12:30:00Z", "PAID"],
    ["2026-09-10T12:45:00Z", "PENDING"],
    ["2026-09-10T12:45:00Z", "PAID"],
  ] as const) {
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ lastModifiedTime, paymentStatus, items: quantity }),
      ),
    ).toMatchObject({ outcome: "updated" });
  }
  expect(
    await env.DB.prepare("SELECT id, quantity FROM order_items ORDER BY line_item_id")
      .all()
      .then(({ results }) => results),
  ).toEqual([
    { id: firstItems[0]!.id, quantity: 2 },
    { id: firstItems[1]!.id, quantity: 1 },
  ]);

  const changed = observation({
    lastModifiedTime: "2026-09-10T13:00:00Z",
    paymentStatus: "PAID",
    items: [line("k1")],
  });
  expect((await recordOrderObservation(env.DB, target(), changed)).outcome).toBe("updated");
  expect(await items()).toEqual([firstItems[0]]);
  expect(await orders()).toMatchObject([{ ebay_order_id: "D-1", payment_status: "PAID" }]);
});

it("un campo omesso e uno nullo sono lo stesso dato e non creano versioni", async () => {
  const tax = (issuingCountry?: null) => ({
    source: "ebay_fulfillment" as const,
    complete: true,
    values: [
      {
        type: "VAT_ID",
        ...(issuingCountry === null && { issuingCountry }),
        value: "01234567890",
      },
    ],
  });
  const explicit = (lastModifiedTime: string) =>
    observation({
      lastModifiedTime,
      marketplaceId: null,
      fulfillmentStatus: null,
      cancelStatus: null,
      buyerEiasToken: null,
      buyer: {
        username: "acquirente",
        name: "Mario Rossi",
        email: null,
        phone: null,
        billingAddress: {
          addressLine1: null,
          addressLine2: null,
          city: "Trento",
          postalCode: null,
          stateOrProvince: null,
          countryCode: null,
        },
        shipTo: null,
        masked: [],
      },
      items: [{ ...line("k1"), legacyItemId: null, sku: null }, line("k2")],
      taxIdentifiers: tax(null),
    });
  const omitted = (lastModifiedTime: string) =>
    observation({
      lastModifiedTime,
      buyer: { username: "acquirente", name: "Mario Rossi", billingAddress: { city: "Trento" } },
      taxIdentifiers: tax(),
    });
  const rows = async () =>
    Object.fromEntries(
      await Promise.all(
        ["orders", "order_items", "tax_identifiers", "order_tax_checks", "order_source_refs"].map(
          async (table) => [
            table,
            (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n,
          ],
        ),
      ),
    );
  const saved = () =>
    Promise.all(
      [
        "SELECT * FROM orders",
        "SELECT * FROM order_items ORDER BY line_item_id",
        "SELECT * FROM tax_identifiers",
      ].map((sql) =>
        env.DB.prepare(sql)
          .all()
          .then(({ results }) => results),
      ),
    );
  const created = await recordOrderObservation(env.DB, target(), explicit("2026-09-10T11:00:00Z"));
  expect(created).toMatchObject({ outcome: "created", taxChanges: 1 });
  const counts = await rows();
  const first = await saved();
  // In entrambe le direzioni la rilettura è invariata: nessuna riga e nessun campo diverso.
  for (const [read, lastModifiedTime] of [
    [omitted, "2026-09-10T12:00:00Z"],
    [explicit, "2026-09-10T12:30:00Z"],
    [omitted, "2026-09-10T12:45:00Z"],
  ] as const) {
    expect(await recordOrderObservation(env.DB, target(), read(lastModifiedTime))).toEqual({
      outcome: "unchanged",
      orderId: (created as { orderId: string }).orderId,
      taxChanges: 0,
      issue: null,
    });
    expect(await rows()).toEqual(counts);
    expect(await saved()).toEqual(first);
  }

  // Un null dove prima c'era un valore lo rimuove, come l'omissione.
  const buyer = () =>
    orders().then(([order]) => JSON.parse(order!.buyer_json as string) as { phone: string | null });
  const phone = (lastModifiedTime: string, value?: string | null) =>
    observation({
      lastModifiedTime,
      buyer: {
        username: "acquirente",
        name: "Mario Rossi",
        billingAddress: { city: "Trento" },
        ...(value !== undefined && { phone: value }),
      },
      taxIdentifiers: tax(),
    });
  for (const [lastModifiedTime, value] of [
    ["2026-09-10T13:00:00Z", "+39 1"],
    ["2026-09-10T13:15:00Z", null],
    ["2026-09-10T13:30:00Z", "+39 1"],
    ["2026-09-10T13:45:00Z", undefined],
  ] as const) {
    expect(
      await recordOrderObservation(env.DB, target(), phone(lastModifiedTime, value)),
    ).toMatchObject({ outcome: "updated", taxChanges: 0 });
    expect((await buyer()).phone).toBe(value ?? null);
  }

  // L'identità dell'acquirente distingue: assente dalla fonte la conserva, null la toglie.
  const token = () =>
    env.DB.prepare("SELECT buyer_eias_token AS token FROM orders")
      .first<{ token: string | null }>()
      .then((row) => row!.token);
  for (const [lastModifiedTime, buyerEiasToken, outcome, stored] of [
    ["2026-09-10T14:00:00Z", "stable-buyer", "updated", "stable-buyer"],
    ["2026-09-10T14:15:00Z", undefined, "unchanged", "stable-buyer"],
    ["2026-09-10T14:30:00Z", null, "updated", null],
    ["2026-09-10T14:45:00Z", undefined, "unchanged", null],
  ] as const) {
    expect(
      await recordOrderObservation(env.DB, target(), {
        ...omitted(lastModifiedTime),
        buyerEiasToken,
      }),
    ).toMatchObject({ outcome });
    expect(await token()).toBe(stored);
  }
});

it("mantiene il testo cercabile dagli ultimi campi scritti, senza contarlo come variazione", async () => {
  const searchText = () =>
    env.DB.prepare("SELECT search_text FROM orders WHERE ebay_order_id = 'D-1'")
      .first<{ search_text: string }>()
      .then((row) => row!.search_text);
  const created = await recordOrderObservation(
    env.DB,
    target(),
    observation({ buyer: { username: "zoe_b", name: "ZOË Bäcker" } }),
  );
  expect(created).toMatchObject({ outcome: "created" });
  expect(await searchText()).toBe("d-1 zoe backer zoe_b articolo k1  articolo k2 ");
  // Il testo indicato da un'indicizzazione precedente si riallinea senza variare l'ordine.
  await env.DB.prepare("UPDATE orders SET search_text = NULL").run();
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ buyer: { username: "zoe_b", name: "ZOË Bäcker" } }),
    ),
  ).toMatchObject({ outcome: "unchanged" });
  expect(await searchText()).toBe("d-1 zoe backer zoe_b articolo k1  articolo k2 ");
  const renamed = observation({
    lastModifiedTime: "2026-09-10T12:00:00Z",
    buyer: { username: "zoe_b", name: "ZOË Bäcker" },
    items: [{ ...line("k1"), title: "Lámpara ÉLITE", sku: "LMP-1" }],
  });
  expect((await recordOrderObservation(env.DB, target(), renamed)).outcome).toBe("updated");
  expect(await searchText()).toBe("d-1 zoe backer zoe_b lampara elite lmp-1");
  // Un provvisorio non sovrascrive i campi del definitivo, né il suo testo.
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({ externalOrderId: "D-1", items: [line("k1")], buyer: { username: "altro" } }),
  );
  expect(await searchText()).toBe("d-1 zoe backer zoe_b lampara elite lmp-1");
});

it("scarta la lettura tardiva della stessa fonte prima di scrivere", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const late = observation({
    lastModifiedTime: "2026-09-10T10:59:59Z",
    paymentStatus: "PENDING",
  });
  const batch = vi.spyOn(env.DB, "batch");
  try {
    expect(await recordOrderObservation(env.DB, target(), late)).toEqual({ outcome: "stale" });
    expect(batch).not.toHaveBeenCalled();
  } finally {
    batch.mockRestore();
  }
  expect(await orders()).toMatchObject([{ payment_status: "PAID" }]);
});

it("conserva lo snapshot dell'acquirente di ogni ordine", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      externalOrderId: "D-2",
      buyer: { username: "acquirente", name: "Mario Rossi Bianchi" },
      items: [line("k9")],
    }),
  );
  const [first, second] = await orders();
  expect(JSON.parse(first!.buyer_json as string)).toMatchObject({ name: "Mario Rossi" });
  expect(JSON.parse(second!.buyer_json as string)).toMatchObject({ name: "Mario Rossi Bianchi" });
});

it("il definitivo eredita UUID e sblocco del provvisorio con le stesse righe", async () => {
  // La data Trading del provvisorio può essere successiva a quella Fulfillment del definitivo.
  const draft = await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      lastModifiedTime: "2026-09-10T11:30:00Z",
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: false,
        values: [{ type: "CODICE_FISCALE", issuingCountry: null, value: "RSSMRA80A01H501U" }],
      },
    }),
  );
  expect(draft).toMatchObject({ outcome: "created", taxChanges: 1 });
  const orderId = (draft as { orderId: string }).orderId;
  const itemRows = () =>
    env.DB.prepare("SELECT id, line_item_id, stable_key FROM order_items ORDER BY stable_key")
      .all<{ id: string }>()
      .then(({ results }) => results);
  const draftItems = await itemRows();
  await env.DB.prepare(
    `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
       VALUES ('g-1', 'w-a', ?, 'admin', ?)`,
  )
    .bind(orderId, now)
    .run();
  // L'acquisto entra negli elenchi quando è letto e di nuovo quando risulta pagato.
  const listedAt = () =>
    env.DB.prepare("SELECT listed_at FROM orders WHERE id = ?")
      .bind(orderId)
      .first<string>("listed_at");
  expect(await listedAt()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  await env.DB.prepare("UPDATE orders SET listed_at = '2026-01-01T00:00:00.000Z'").run();

  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    outcome: "updated",
    orderId,
  });
  const promoted = await listedAt();
  expect(promoted! > "2026-01-01T00:00:00.000Z").toBe(true);
  // Una modifica successiva del definitivo non lo fa rientrare.
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ lastModifiedTime: "2026-09-12T08:00:00Z", fulfillmentStatus: "FULFILLED" }),
  );
  expect(await listedAt()).toBe(promoted);
  expect(await orders()).toMatchObject([
    { id: orderId, ebay_order_id: "D-1", is_provisional: 0, payment_status: "PAID" },
  ]);
  // Le righe restano le stesse, con gli ID riga del definitivo.
  expect(await itemRows()).toEqual([
    { id: draftItems[0]!.id, line_item_id: "riga-k1", stable_key: "k1" },
    { id: draftItems[1]!.id, line_item_id: "riga-k2", stable_key: "k2" },
  ]);
  expect(
    await env.DB.prepare("SELECT order_id FROM order_grants")
      .all()
      .then(({ results }) => results),
  ).toEqual([{ order_id: orderId }]);
  const visible = await listVisibleOrders(env.DB, "u-a");
  expect(visible.map(({ id, fiscalState }) => [id, fiscalState])).toEqual([[orderId, "available"]]);
});

it("aggancia al definitivo il provvisorio arrivato dopo, senza sovrascriverlo", async () => {
  const definitive = await recordOrderObservation(env.DB, target(), observation());
  const orderId = (definitive as { orderId: string }).orderId;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    expect(await recordOrderObservation(env.DB, target(), provisional())).toMatchObject({
      outcome: "unchanged",
      orderId,
    });
  }
  // Trading non sovrascrive un ordine letto da Fulfillment, anche con una data successiva.
  const tradingCopy = observation({
    source: "trading",
    lastModifiedTime: "2026-09-10T12:00:00Z",
    paymentStatus: "PENDING",
    items: [line("k1", "t-1"), line("k2", "t-2")],
  });
  expect(await recordOrderObservation(env.DB, target(), tradingCopy)).toMatchObject({
    outcome: "unchanged",
    orderId,
  });
  // Anche un ID riemesso con una lettura più vecchia aggancia soltanto il riferimento.
  const reissued = observation({
    externalOrderId: "D-0",
    lastModifiedTime: "2026-09-10T10:45:00Z",
    paymentStatus: "PENDING",
    items: [line("k1", "vecchia-1"), line("k2", "vecchia-2")],
  });
  expect(await recordOrderObservation(env.DB, target(), reissued)).toMatchObject({
    outcome: "unchanged",
    orderId,
  });
  expect(await orders()).toMatchObject([
    { id: orderId, ebay_order_id: "D-1", is_provisional: 0, payment_status: "PAID" },
  ]);
  expect(
    await env.DB.prepare(
      "SELECT source, external_order_id FROM order_source_refs ORDER BY source, external_order_id",
    )
      .all()
      .then(({ results }) => results),
  ).toEqual([
    { source: "fulfillment", external_order_id: "D-0" },
    { source: "fulfillment", external_order_id: "D-1" },
    { source: "trading", external_order_id: "D-1" },
    { source: "trading", external_order_id: "P-1" },
  ]);
});

it.each([false, true])(
  "sostituisce i CF dei provvisori assorbiti con il valore corrente, lettura completa: %s",
  async (complete) => {
    for (const [key, value] of [
      ["k1", "CF-PRECEDENTE-A"],
      ["k2", "CF-PRECEDENTE-B"],
    ] as const) {
      await recordOrderObservation(
        env.DB,
        target(),
        provisional({
          externalOrderId: `P-${key}`,
          items: [line(key)],
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value }],
          },
        }),
      );
    }
    const result = await recordOrderObservation(
      env.DB,
      target(),
      observation({
        source: "trading",
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete,
          values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "CF-CORRENTE" }],
        },
      }),
    );
    const id = (result as { orderId: string }).orderId;
    expect(
      (
        await env.DB.prepare(
          "SELECT value FROM tax_identifiers WHERE order_id = ? AND removed_at IS NULL",
        )
          .bind(id)
          .all()
      ).results,
    ).toEqual([{ value: "CF-CORRENTE" }]);
    expect(
      (
        await env.DB.prepare(
          "SELECT value FROM tax_identifiers WHERE order_id = ? AND removed_at IS NOT NULL ORDER BY value",
        )
          .bind(id)
          .all()
      ).results,
    ).toEqual([{ value: "CF-PRECEDENTE-A" }, { value: "CF-PRECEDENTE-B" }]);
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          source: "trading",
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete,
            values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "CF-CORRENTE" }],
          },
        }),
      ),
    ).toMatchObject({ taxChanges: 0 });
  },
);

it("consolida più acquisti, conserva grant e quota anche al replay e con righe rinominate", async () => {
  const drafts: string[] = [];
  for (const key of ["k1", "k2"]) {
    const result = await recordOrderObservation(
      env.DB,
      target(),
      provisional({
        externalOrderId: `P-${key}`,
        creationTime: key === "k1" ? "2026-09-10T10:00:00Z" : "2026-09-10T10:01:00Z",
        items: [line(key, `prima-${key}`)],
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: `SINTETICO-${key}` }],
        },
      }),
    );
    drafts.push((result as { orderId: string }).orderId);
  }
  await env.DB.prepare("DELETE FROM free_cycles WHERE id = 'c-a'").run();
  await env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
      VALUES ('combined-cycle', 'w-a', '2026-09-01', '2026-10-01', 1)`).run();
  await expect(unlockOrders(env.DB, "u-a", [drafts[1]!])).rejects.toThrow("order_not_available");
  // Diritto storico precedente al divieto di sbloccare i provvisori, conservato dal consolidamento.
  await env.DB.prepare("UPDATE orders SET is_provisional = 0 WHERE id = ?").bind(drafts[1]!).run();
  await env.DB.prepare(
    `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
       VALUES ('combined-grant', 'w-a', ?, 'combined-cycle', 'free_cycle', ?)`,
  )
    .bind(drafts[1]!, now)
    .run();
  await env.DB.prepare("UPDATE orders SET is_provisional = 1 WHERE id = ?").bind(drafts[1]!).run();
  const result = await recordOrderObservation(env.DB, target(), observation());
  expect(result).toMatchObject({ outcome: "updated", issue: null, taxChanges: 0 });
  const orderId = (result as { orderId: string }).orderId;
  expect(orderId).toBe(drafts[0]);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
      taxChanges: 0,
    });
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({ externalOrderId: "P-k2", items: [line("k2")] }),
    );
    await unlockOrders(env.DB, "u-a", [orderId]);
  }
  const visible = await listVisibleOrders(env.DB, "u-a");
  expect(visible).toHaveLength(1);
  expect(visible[0]).toMatchObject({ id: orderId, ebayOrderId: "D-1", fiscalState: "available" });
  expect(visible[0]!.taxIdentifiers).toHaveLength(2);
  for (const key of ["k1", "k2"]) {
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        provisional({ externalOrderId: `alias-${key}`, items: [line(key)] }),
      ),
    ).toMatchObject({ orderId, outcome: "unchanged" });
  }
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(1);
  expect(visible[0]!.summary.lineItems.map((item) => item.lineItemId).sort()).toEqual([
    "riga-k1",
    "riga-k2",
  ]);
  expect(
    await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'combined-cycle'").first(),
  ).toEqual({ used: 1 });
  expect(
    await env.DB.prepare("SELECT order_id FROM order_grants")
      .all()
      .then((r) => r.results),
  ).toEqual([{ order_id: drafts[1] }]);
  expect(await listVisibleOrders(env.DB, "u-b")).toEqual([]);
  await expect(unlockOrders(env.DB, "u-b", [orderId])).rejects.toThrow("order_not_available");
});

it("aggancia singoli provvisori tardivi al combinato senza duplicare o ridurre le righe", async () => {
  const result = await recordOrderObservation(env.DB, target(), observation());
  for (const key of ["k1", "k2"]) {
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        provisional({
          externalOrderId: `P-${key}`,
          items: [line(key)],
        }),
      ),
    ).toMatchObject({ outcome: "unchanged", orderId: (result as { orderId: string }).orderId });
  }
  expect(await orders()).toHaveLength(1);
  expect((await listVisibleOrders(env.DB, "u-a"))[0]!.summary.lineItems).toHaveLength(2);
});

it("nasconde il provvisorio annullato e rende visibili le anomalie senza consolidare", async () => {
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1"), line("k3")] }));
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    issue: "partial_overlap",
  });
  expect((await listVisibleOrders(env.DB, "u-a")).every((order) => order.reconciliationIssue)).toBe(
    true,
  );
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      cancelStatus: "CANCELED",
      lastModifiedTime: "2026-09-12T00:00:00Z",
      items: [line("k1"), line("k3")],
    }),
  );
  expect(await orders()).toHaveLength(2);
  expect((await listVisibleOrders(env.DB, "u-a")).map((order) => order.ebayOrderId)).toEqual([
    "D-1",
  ]);
});

it("rifiuta identità duplicate prima delle scritture", async () => {
  await expect(
    recordOrderObservation(
      env.DB,
      target(),
      observation({ items: [line("k1"), line("k1", "altra")] }),
    ),
  ).rejects.toThrow("duplicate_line_identity");
  await expect(
    recordOrderObservation(
      env.DB,
      target(),
      observation({ items: [line("k1", "stessa"), line("k2", "stessa")] }),
    ),
  ).rejects.toThrow("duplicate_line_identity");
  expect(await orders()).toEqual([]);
});

it("chiude l'anomalia e sposta i riferimenti quando il definitivo completa le identità", async () => {
  for (const key of ["k1", "k2"])
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({ externalOrderId: `P-${key}`, items: [line(key)] }),
    );
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ items: [line("k1"), line(null, "riga-senza")] }),
    ),
  ).toMatchObject({ issue: "missing_line_identity" });
  const result = await recordOrderObservation(
    env.DB,
    target(),
    observation({ lastModifiedTime: "2026-09-10T12:00:00Z" }),
  );
  expect(result).toMatchObject({ outcome: "updated", issue: null });
  expect(await listVisibleOrders(env.DB, "u-a")).toMatchObject([
    { ebayOrderId: "D-1", reconciliationIssue: false },
  ]);
  expect(
    await env.DB.prepare("SELECT DISTINCT order_id FROM order_source_refs")
      .all()
      .then(({ results }) => results),
  ).toEqual([{ order_id: (result as { orderId: string }).orderId }]);
});

it("ricollega al definitivo gli ordini già uniti a un provvisorio assorbito", async () => {
  const record = (overrides: Partial<OrderObservation>) =>
    recordOrderObservation(env.DB, target(), provisional(overrides)).then(
      (result) => (result as { orderId: string }).orderId,
    );
  const absorbed = await record({ externalOrderId: "P-k1", items: [line("k1")] });
  const child = await record({ externalOrderId: "P-k9", items: [line("k9")] });
  await env.DB.prepare("UPDATE orders SET merged_into = ? WHERE id = ?")
    .bind(absorbed, child)
    .run();
  // Il provvisorio più vecchio conserva l'UUID: l'altro, con il suo unito, confluisce.
  const kept = await record({
    externalOrderId: "P-k2",
    creationTime: "2026-09-10T09:00:00Z",
    items: [line("k2")],
  });
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    orderId: kept,
    issue: null,
  });
  expect(
    await env.DB.prepare(
      "SELECT id, merged_into FROM orders WHERE merged_into IS NOT NULL ORDER BY id",
    )
      .all()
      .then(({ results }) => results),
  ).toEqual(
    [
      { id: absorbed, merged_into: kept },
      { id: child, merged_into: kept },
    ].sort((a, b) => a.id.localeCompare(b.id)),
  );
});

it("lo sblocco concorrente dello stesso ordine consuma una sola quota", async () => {
  const result = await recordOrderObservation(
    env.DB,
    target(),
    observation({
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: false,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "SINTETICO" }],
      },
    }),
  );
  const orderId = (result as { orderId: string }).orderId;
  await env.DB.prepare("DELETE FROM free_cycles WHERE id = 'c-a'").run();
  await env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
      VALUES ('race-cycle', 'w-a', '2026-09-01', '2026-10-01', 1)`).run();
  await Promise.all(Array.from({ length: 2 }, () => unlockOrders(env.DB, "u-a", [orderId])));
  expect(
    await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'race-cycle'").first(),
  ).toEqual({ used: 1 });
  expect((await env.DB.prepare("SELECT id FROM order_grants").all()).results).toHaveLength(1);
});

it("non aggancia una parte nota a un definitivo con righe prive di identità", async () => {
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ items: [line("k1"), line(null, "ignota")] }),
  );
  expect(
    await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] })),
  ).toMatchObject({ outcome: "created", issue: "missing_line_identity" });
  expect(await current()).toBe(2);
});

it("mantiene gli UUID distinti quando due definitivi già noti diventano candidati identici", async () => {
  const first = await recordOrderObservation(env.DB, target(), observation());
  const second = await recordOrderObservation(
    env.DB,
    target(),
    observation({ externalOrderId: "D-2", items: [line("k2"), line("k3")] }),
  );
  expect(
    await recordOrderObservation(env.DB, target(), observation({ externalOrderId: "D-2" })),
  ).toMatchObject({ orderId: (second as { orderId: string }).orderId, outcome: "updated" });
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    orderId: (first as { orderId: string }).orderId,
  });
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(2);
  // Un nuovo alias Trading non può scegliere il primo fra due definitivi compatibili.
  expect(await recordOrderObservation(env.DB, target(), provisional())).toMatchObject({
    outcome: "created",
    issue: "multiple_candidates",
  });
  expect(await current()).toBe(3);
});

it("non assorbe un gruppo misto di candidati provvisori e definitivi", async () => {
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] }));
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ externalOrderId: "D-2", items: [line("k2")] }),
  );
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    outcome: "created",
    issue: "multiple_candidates",
  });
  expect(await current()).toBe(3);
  expect(
    (await env.DB.prepare("SELECT id FROM orders WHERE merged_into IS NOT NULL").all()).results,
  ).toHaveLength(0);
});

it("blocca il consolidamento se la mappatura Trading persistita è vuota", async () => {
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] }));
  await env.DB.prepare("UPDATE orders SET trading_line_keys = '[]'").run();
  expect(
    await recordOrderObservation(env.DB, target(), observation({ source: "trading" })),
  ).toMatchObject({ outcome: "created", issue: "partial_overlap" });
  expect(await current()).toBe(2);
});

it("un alias Trading più vecchio non sostituisce le identità del definitivo corrente", async () => {
  const first = await recordOrderObservation(
    env.DB,
    target(),
    observation({ source: "trading", externalOrderId: "D-0" }),
  );
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ source: "trading", lastModifiedTime: "2026-09-10T12:00:00Z" }),
  );
  await recordOrderObservation(
    env.DB,
    target(),
    observation({
      source: "trading",
      externalOrderId: "D-0",
      lastModifiedTime: "2026-09-10T11:30:00Z",
      items: [line("k1")],
    }),
  );
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({ externalOrderId: "P-2", items: [line("k2")] }),
    ),
  ).toMatchObject({ orderId: (first as { orderId: string }).orderId, outcome: "unchanged" });
  expect((await listVisibleOrders(env.DB, "u-a")).map((o) => o.ebayOrderId)).toEqual(["D-1"]);
});

it("un provvisorio tardivo non rimuove i dati correnti del definitivo", async () => {
  const result = await recordOrderObservation(
    env.DB,
    target(),
    observation({
      source: "trading",
      taxIdentifiers: {
        source: "ebay_trading_get_orders",
        complete: true,
        values: [{ type: "CODICE_FISCALE", issuingCountry: "IT", value: "SINTETICO" }],
      },
    }),
  );
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({
      items: [line("k1")],
      taxIdentifiers: { source: "ebay_trading_get_orders", complete: true, values: [] },
    }),
  );
  expect(
    (
      await env.DB.prepare(
        "SELECT value FROM tax_identifiers WHERE order_id = ? AND removed_at IS NULL",
      )
        .bind((result as { orderId: string }).orderId)
        .all()
    ).results,
  ).toEqual([{ value: "SINTETICO" }]);
});

it("usa il riferimento Trading del definitivo se Fulfillment ha rinominato anche le identità", async () => {
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] }));
  const final = observation({ items: [line("nuova1"), line("nuova2")] });
  const result = await recordOrderObservation(env.DB, target(), final);
  const orderId = (result as { orderId: string }).orderId;
  expect(await current()).toBe(2);
  await recordOrderObservation(env.DB, target(), observation({ source: "trading" }));
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(1);
  await recordOrderObservation(env.DB, target(), final);
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({ externalOrderId: "P-2", items: [line("k2")] }),
    ),
  ).toMatchObject({ orderId, outcome: "unchanged" });
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(1);
  expect(
    (await listVisibleOrders(env.DB, "u-a"))[0]!.summary.lineItems.map((i) => i.lineItemId),
  ).toEqual(["riga-nuova1", "riga-nuova2"]);
});

it.each([
  { items: [line("k1"), line(null, "senza")], issue: "missing_line_identity" },
  { items: [line("k1"), line("k3")], issue: "partial_overlap" },
])("blocca un provvisorio non interamente identificato: $issue", async ({ items, issue }) => {
  await recordOrderObservation(env.DB, target(), provisional({ items }));
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    outcome: "created",
    issue,
  });
  expect(await current()).toBe(2);
});

it("non consolida provvisori sovrapposti né trasferisce diritti dopo la revoca del consenso", async () => {
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] }));
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({ externalOrderId: "P-2", items: [line("k1"), line("k2")] }),
  );
  expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
    issue: "multiple_candidates",
  });
  expect(await current()).toBe(3);
  await resetOrderFixtures();
  await recordOrderObservation(env.DB, target(), provisional({ items: [line("k1")] }));
  await recordOrderObservation(
    env.DB,
    target(),
    provisional({ externalOrderId: "P-2", items: [line("k2")] }),
  );
  await env.DB.prepare("DELETE FROM ebay_store_credentials WHERE store_id = 's-a'").run();
  expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
    outcome: "not_writable",
  });
  expect(await orders()).toMatchObject([{ ebay_order_id: "P-1" }, { ebay_order_id: "P-2" }]);
  expect(await current()).toBe(2);
});

it("non riconcilia righe di negozi diversi", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const other = await recordOrderObservation(env.DB, target("s-b"), provisional());
  expect(other).toMatchObject({ outcome: "created", issue: null });
  expect(await orders("s-a")).toHaveLength(1);
  expect(await orders("s-b")).toMatchObject([{ ebay_order_id: "P-1", is_provisional: 1 }]);
  await expect(
    env.DB.prepare(
      `INSERT INTO order_reconciliation_issues (order_id, related_order_id, kind, detected_at)
         SELECT a.id, b.id, 'partial_overlap', ?
           FROM orders a, orders b WHERE a.store_id = 's-a' AND b.store_id = 's-b'`,
    )
      .bind(now)
      .run(),
  ).rejects.toThrow("reconciliation_across_stores");
});

it("rende esplicite sovrapposizioni parziali, identità mancanti e più candidati", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const cases = [
    ["X-1", [line("k2"), line("k3")], "partial_overlap"],
    ["Y-1", [line("k4"), line(null, "senza-identita")], null],
    ["Y-2", [line("k4"), line("k5")], "missing_line_identity"],
    ["Z-1", [line("k1"), line("k3")], "multiple_candidates"],
  ] as const;
  for (const [externalOrderId, items, issue] of cases) {
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ externalOrderId, items: [...items] }),
      ),
    ).toMatchObject({ outcome: "created", issue });
  }
  expect(await orders()).toHaveLength(5);
  expect(
    await env.DB.prepare(
      `SELECT o.ebay_order_id AS orderId, r.ebay_order_id AS relatedId, i.kind
           FROM order_reconciliation_issues i
           JOIN orders o ON o.id = i.order_id JOIN orders r ON r.id = i.related_order_id
          ORDER BY orderId, relatedId`,
    )
      .all()
      .then(({ results }) => results),
  ).toEqual([
    { orderId: "X-1", relatedId: "D-1", kind: "partial_overlap" },
    { orderId: "Y-2", relatedId: "Y-1", kind: "missing_line_identity" },
    { orderId: "Z-1", relatedId: "D-1", kind: "multiple_candidates" },
    { orderId: "Z-1", relatedId: "X-1", kind: "multiple_candidates" },
  ]);
  // Un candidato identico insieme a un altro che condivide una riga resta ambiguo.
  expect(
    await recordOrderObservation(env.DB, target(), observation({ externalOrderId: "V-1" })),
  ).toMatchObject({ outcome: "created", issue: "multiple_candidates" });
  for (const [items, issue] of [
    [[line("k1")], "partial_overlap"],
    [[line("k1"), line(null, "senza")], "missing_line_identity"],
  ] as const) {
    await resetOrderFixtures();
    await recordOrderObservation(env.DB, target(), observation());
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ externalOrderId: "W-1", items: [...items] }),
      ),
    ).toMatchObject({ outcome: "created", issue });
  }
  await resetOrderFixtures();
  await recordOrderObservation(env.DB, target(), observation());
  await recordOrderObservation(
    env.DB,
    target(),
    observation({ externalOrderId: "X-1", items: [line("k2"), line("k3")] }),
  );
  // La stessa lettura ripetuta riconosce l'ordine già creato e non duplica l'anomalia.
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ externalOrderId: "X-1", items: [line("k2"), line("k3")] }),
    ),
  ).toMatchObject({ outcome: "unchanged", issue: "partial_overlap" });
});
