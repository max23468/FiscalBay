import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { listVisibleOrders } from "../app/domain/orders.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import {
  orderObservationSchema,
  type OrderObservation,
} from "../app/domain/order-observation.server";

import { orderSuggestions } from "../app/domain/order-suggestions.server";

import { deleteStoreData } from "../app/domain/stores.server";

import {
  insertCredentials,
  insertEntitlement,
  insertStorePause,
  now,
} from "./fixtures/database-fixtures";

import {
  grantedAt,
  target,
  line,
  observation,
  setupScenarios,
} from "./fixtures/order-import-scenarios";

setupScenarios();

describe("suggerimenti fiscali dai precedenti", () => {
  const cf = (value: string) => ({ type: "CODICE_FISCALE", issuingCountry: "IT", value });
  async function imported(
    id: string,
    date: string,
    values: Array<{ type: string; issuingCountry?: string; value: string }> = [],
    overrides: Partial<OrderObservation> = {},
    store = "s-a",
  ) {
    const result = await recordOrderObservation(
      env.DB,
      target(store),
      observation({
        externalOrderId: id,
        creationTime: date,
        lastModifiedTime: now,
        buyerEiasToken: "stable-buyer",
        items: [line(id)],
        taxIdentifiers: { source: "ebay_trading_get_orders", complete: true, values },
        ...overrides,
      }),
    );
    if (!("orderId" in result)) throw new Error("fixture_not_created");
    // D1 usa il proprio orologio SQL, distinto dal tempo simulato di Vitest.
    await env.DB.prepare("UPDATE tax_identifiers SET observed_at = ? WHERE order_id = ?")
      .bind(now, result.orderId)
      .run();
    await env.DB.prepare(
      "UPDATE order_source_refs SET detail_for = last_modified_time WHERE order_id = ?",
    )
      .bind(result.orderId)
      .run();
    return result.orderId;
  }
  async function premium() {
    await insertEntitlement({
      id: "suggestions-premium",
      source: "premium",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-10-01T00:00:00.000Z",
    }).run();
  }
  const read = (id: string, user = "u-a", at = new Date(now)) =>
    orderSuggestions(env.DB, user, [id], "production", at);

  it("accetta soltanto identità testuali non vuote entro il limite, senza alterare il token opaco", () => {
    for (const buyerEiasToken of ["", "  ", "x".repeat(2049), 42, {}]) {
      expect(() => orderObservationSchema.parse({ ...observation(), buyerEiasToken })).toThrow();
    }
    for (const buyerEiasToken of [undefined, null, "x", "x".repeat(2048), "MiXeD-Token"]) {
      expect(
        orderObservationSchema.parse({ ...observation(), buyerEiasToken }).buyerEiasToken,
      ).toBe(buyerEiasToken);
    }
    expect(
      orderObservationSchema.parse({ ...observation(), buyerEiasToken: " token " }).buyerEiasToken,
    ).toBe("token");
  });

  it("il payload non aggiunge suggerimenti ai dati già disponibili o ancora da verificare", async () => {
    await premium();
    const previous = await imported("previous", "2026-09-10T00:00:00.000Z", [
      cf("RSSMRA80A01H501U"),
    ]);
    const available = await imported("available", "2026-09-11T00:00:00.000Z", [
      cf("BNCLGU80A01H501Z"),
    ]);
    const unchecked = await imported("unchecked", "2026-09-12T00:00:00.000Z", [], {
      taxIdentifiers: undefined,
    });
    const visible = await listVisibleOrders(env.DB, "u-a");
    expect(visible.find((order) => order.id === available)!.fiscalState).toBe("available");
    // Senza controllo né lettura in attesa la verifica risulta non riuscita, da riprovare.
    expect(visible.find((order) => order.id === unchecked)!.fiscalState).toBe("error");
    for (const id of [previous, available, unchecked]) {
      const order = visible.find((item) => item.id === id)!;
      expect(order).not.toHaveProperty("suggestions");
      expect(order).not.toHaveProperty("suggestionStatus");
    }
  });

  it("una fonte scaduta durante la lettura dell'elenco non entra nel suggerimento", async () => {
    await premium();
    const source = await imported("previous", "2026-09-11T00:00:00.000Z", [cf("RSSMRA80A01H501U")]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    const expiry = new Date(Date.parse(now) + 1);
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind(expiry.toISOString(), source)
      .run();
    const prepare = env.DB.prepare.bind(env.DB);
    const intercepted = vi.spyOn(env.DB, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql);
      if (!sql.includes("WITH visible_orders")) return statement;
      statement.bind = (...values: unknown[]) => {
        const bound = prepare(sql).bind(...values);
        const all = bound.all.bind(bound);
        bound.all = async <T>() => {
          const rows = await all<T>();
          vi.setSystemTime(expiry);
          return rows;
        };
        return bound;
      };
      return statement;
    });
    try {
      const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(now));
      expect(visible.find((order) => order.id === current)!.suggestions).toEqual([]);
      expect(
        await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(source).first(),
      ).not.toBeNull();
    } finally {
      intercepted.mockRestore();
    }
  });

  it("usa data ordine, identità stabile e fonte corrente, con conflitti omogenei e provenienza", async () => {
    await premium();
    const recent = await imported("recent", "2026-09-11T00:00:00.000Z", [
      cf("RSSMRA80A01H501U"),
      { type: "PartitaIVA", issuingCountry: "IT", value: "01234567890" },
    ]);
    await imported("old-backfill", "2026-09-09T00:00:00.000Z", [cf("BNCLGU80A01H501Z")]);
    await imported("other-buyer", "2026-09-12T00:00:00.000Z", [cf("NON-ESPORRE")], {
      buyerEiasToken: "different-buyer",
    });
    await imported("other-workspace", "2026-09-12T00:00:00.000Z", [cf("ALTRO-SPAZIO")], {}, "s-b");
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    const result = (await read(current)).get(current)!;
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.find((item) => item.identifier?.type === "CF")).toMatchObject({
      value: "RSSMRA80A01H501U",
      conflict: true,
      sourceOrder: "recent",
      sourceDate: "2026-09-11T00:00:00.000Z",
      sourceStore: "e-a",
      source: "ebay_trading_get_orders",
    });
    expect(result.suggestions.find((item) => item.identifier?.type === "PIVA")?.conflict).toBe(
      false,
    );
    const visible = (await listVisibleOrders(env.DB, "u-a")).find((order) => order.id === current)!;
    expect(visible.fiscalState).toBe("missing");
    expect(visible.taxIdentifiers).toEqual([]);
    expect(visible.suggestions).toEqual(result.suggestions);
    expect(JSON.stringify(result)).not.toMatch(/NON-ESPORRE|ALTRO-SPAZIO/);
    expect(JSON.stringify(visible)).not.toContain("stable-buyer");
    expect((await read(current, "u-b")).size).toBe(0);
    await imported("recent", "2026-09-11T00:00:00.000Z", [cf("VRDLGU80A01H501Z")]);
    expect((await read(current)).get(current)!.suggestions[0]!.value).toBe("VRDLGU80A01H501Z");
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE order_id = ?")
      .bind(now, recent)
      .run();
    expect((await read(current)).get(current)!.suggestions).toMatchObject([
      { sourceOrder: "old-backfill", conflict: false },
    ]);
    await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(recent).run();
    expect((await read(current)).get(current)!.suggestions[0]!.sourceOrder).toBe("old-backfill");
  });

  it("nega i suggerimenti Free e dopo revoca/scadenza Premium, senza restituire valori", async () => {
    await imported("previous", "2026-09-11T00:00:00.000Z", [cf("RSSMRA80A01H501U")]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    expect((await read(current)).size).toBe(0);
    await premium();
    expect((await read(current)).get(current)!.suggestions).toHaveLength(1);
    expect((await read(current, "u-a", new Date("2026-10-01T00:00:00.000Z"))).size).toBe(0);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ?").bind(now).run();
    expect((await read(current)).size).toBe(0);
  });

  it("non collega username uguali senza identità stabile e rende esplicite le parità", async () => {
    await premium();
    await imported("previous", "2026-09-11T00:00:00.000Z", [cf("RSSMRA80A01H501U")]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z", [], {
      buyerEiasToken: null,
    });
    expect((await read(current)).get(current)).toEqual({
      suggestions: [],
      suggestionStatus: "identity_missing",
    });
    await env.DB.prepare("UPDATE orders SET buyer_eias_token = 'stable-buyer' WHERE id = ?")
      .bind(current)
      .run();
    await imported("same-date", "2026-09-11T00:00:00.000Z", [cf("BNCLGU80A01H501Z")]);
    expect((await read(current)).get(current)).toEqual({
      suggestions: [],
      suggestionStatus: "ambiguous",
    });
  });

  it("rilegge fonti di altri negozi dello spazio rispettando ambiente, pausa, eliminazione e retention senza pulizia", async () => {
    await premium();
    await env.DB.prepare(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
        VALUES ('s-other', 'w-a', 'e-other', ?1, 'Negozio precedente')`)
      .bind(now)
      .run();
    await insertCredentials({ storeId: "s-other", accessExpiresAt: now, grantedAt }).run();
    const source = await imported(
      "previous",
      "2026-09-11T00:00:00.000Z",
      [cf("RSSMRA80A01H501U")],
      {},
      "s-other",
    );
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    expect((await read(current)).get(current)!.suggestions[0]!.sourceStore).toBe(
      "Negozio precedente",
    );
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind(now, source)
      .run();
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
    expect(
      await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(source).first(),
    ).not.toBeNull();
    await env.DB.prepare(
      "UPDATE orders SET retention_until = '2026-09-30T00:00:00.000Z', purge_after = '2026-09-30T00:00:00.000Z' WHERE id = ?",
    )
      .bind(source)
      .run();
    await env.DB.prepare(
      "UPDATE ebay_stores SET ebay_environment = 'sandbox' WHERE id = 's-other'",
    ).run();
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
    await env.DB.prepare(
      "UPDATE ebay_stores SET ebay_environment = 'production' WHERE id = 's-other'",
    ).run();
    await insertStorePause({ storeId: "s-other", reason: "plan" }).run();
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
    await env.DB.prepare("DELETE FROM ebay_store_pauses WHERE store_id = 's-other'").run();
    await deleteStoreData(env.DB, "u-a", "s-other", "Negozio precedente", new Date(now));
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
  });

  it("mantiene il token su letture senza identità e invalida subito una diversa identità corrente", async () => {
    await premium();
    await imported("previous", "2026-09-11T00:00:00.000Z", [cf("RSSMRA80A01H501U")]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    await imported("current", "2026-09-13T00:00:00.000Z", [], { buyerEiasToken: undefined });
    expect((await read(current)).get(current)!.suggestions).toHaveLength(1);
    await imported("current", "2026-09-13T00:00:00.000Z", [], {
      buyerEiasToken: "changed-buyer",
    });
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
  });

  it("una rilettura con la stessa identità non produce falsi aggiornamenti e rifiuta identità tardive", async () => {
    const input = observation({ buyerEiasToken: "stable-buyer" });
    const first = await recordOrderObservation(env.DB, target(), input);
    expect(first.outcome).toBe("created");
    expect((await recordOrderObservation(env.DB, target(), input)).outcome).toBe("unchanged");
    const stale = await recordOrderObservation(env.DB, target(), {
      ...input,
      buyerEiasToken: "stale-buyer",
      lastModifiedTime: "2026-09-10T10:00:00Z",
    });
    expect(stale.outcome).toBe("stale");
    expect(await env.DB.prepare("SELECT buyer_eias_token FROM orders").first()).toEqual({
      buyer_eias_token: "stable-buyer",
    });
  });

  it("conserva i diritti indipendenti e nega fonti e destinazioni scadute senza pulizia", async () => {
    await premium();
    const source = await imported("previous", "2026-08-30T00:00:00.000Z", [cf("RSSMRA80A01H501U")]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    await env.DB.prepare(
      "UPDATE tax_identifiers SET observed_at = '2026-08-31T00:00:00.000Z' WHERE order_id = ?",
    )
      .bind(source)
      .run();
    expect((await read(current)).get(current)!.suggestions).toHaveLength(1);
    await env.DB.prepare(`INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at, expires_at)
        VALUES ('suggestion-access', 'w-a', ?, 'admin', ?, '2026-09-14T00:00:00.000Z')`)
      .bind(source, now)
      .run();
    expect((await read(current)).get(current)!.suggestions).toHaveLength(1);
    expect(
      (await read(current, "u-a", new Date("2026-09-14T00:00:00.000Z"))).get(current)!.suggestions,
    ).toHaveLength(1);
    await env.DB.prepare("UPDATE order_grants SET revoked_at = ? WHERE id = 'suggestion-access'")
      .bind(now)
      .run();
    expect((await read(current)).get(current)!.suggestions).toHaveLength(1);
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind(now, source)
      .run();
    expect((await read(current)).get(current)!.suggestions).toEqual([]);
    expect(
      await env.DB.prepare("SELECT id FROM tax_identifiers WHERE order_id = ?")
        .bind(source)
        .first(),
    ).not.toBeNull();
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind(now, current)
      .run();
    expect((await read(current)).size).toBe(0);
  });

  it("normalizza alias italiani e tiene distinti tipi e Paesi esteri, senza nascondere una fonte discordante", async () => {
    await premium();
    await imported("older", "2026-09-10T00:00:00.000Z", [
      { type: "CodiceFiscale", value: " rssmra80a01h501u " },
      { type: "NIF", issuingCountry: "ES", value: "ES-OLD" },
    ]);
    const source = await imported("recent", "2026-09-11T00:00:00.000Z", [
      cf("RSSMRA80A01H501U"),
      { type: "NIF", issuingCountry: "ES", value: "ES-NEW" },
      { type: "NIF", issuingCountry: "PT", value: "PT-VALUE" },
    ]);
    const current = await imported("current", "2026-09-13T00:00:00.000Z");
    const result = (await read(current)).get(current)!;
    expect(result.suggestions.find((item) => item.identifier?.type === "CF")?.conflict).toBe(false);
    expect(result.suggestions.find((item) => item.issuingCountry === "ES")?.conflict).toBe(true);
    expect(result.suggestions.find((item) => item.issuingCountry === "PT")?.conflict).toBe(false);
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
        VALUES ('discordant', ?, 'CODICE_FISCALE', 'IT', 'BNCLGU80A01H501Z', 'ebay_fulfillment', ?)`)
      .bind(source, now)
      .run();
    const ambiguous = (await read(current)).get(current)!;
    expect(ambiguous.suggestionStatus).toBe("ambiguous");
    expect(ambiguous.suggestions.some((item) => item.identifier?.type === "CF")).toBe(false);
    expect(ambiguous.suggestions).toHaveLength(2);
  });
});
