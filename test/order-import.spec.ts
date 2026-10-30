import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDetail } from "../app/domain/order-acquisition-details.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { unlockOrders } from "../app/domain/grants.server";
import { listVisibleOrders } from "../app/domain/orders.server";
import { recordOrderObservation } from "../app/domain/order-import.server";
import {
  orderObservationSchema,
  type OrderObservation,
} from "../app/domain/order-observation.server";
import { orderSuggestions } from "../app/domain/order-suggestions.server";
import { deleteStoreData, listStores } from "../app/domain/stores.server";
import { ebayConfiguration } from "../app/integrations/ebay/environment.server";
import {
  insertCredentials,
  insertEntitlement,
  insertStorePause,
  now,
  resetDatabase,
  resetOrderFixtures,
  seed,
} from "./fixtures/database-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("modello ordini", () => {
  const grantedAt = "2026-09-01T00:00:00.000Z";
  const target = (storeId = "s-a", observedAt = now) => ({
    storeId,
    consentGrantedAt: grantedAt,
    observedAt,
  });
  const line = (stableKey: string | null, lineItemId = `riga-${stableKey}`) => ({
    lineItemId,
    stableKey,
    title: `Articolo ${stableKey}`,
    quantity: 1,
    total: { minor: 1250, currency: "EUR" },
  });
  const observation = (overrides: Partial<OrderObservation> = {}): OrderObservation => ({
    source: "fulfillment",
    externalOrderId: "D-1",
    provisional: false,
    creationTime: "2026-09-10T10:00:00Z",
    lastModifiedTime: "2026-09-10T11:00:00Z",
    total: { minor: 2500, currency: "EUR" },
    paymentStatus: "PAID",
    buyer: { username: "acquirente", name: "Mario Rossi" },
    items: [line("k1"), line("k2")],
    ...overrides,
  });
  const provisional = (overrides: Partial<OrderObservation> = {}) =>
    observation({
      source: "trading",
      externalOrderId: "P-1",
      provisional: true,
      lastModifiedTime: "2026-09-10T10:30:00Z",
      paymentStatus: "PENDING",
      items: [line("k1", "t-1"), line("k2", "t-2")],
      ...overrides,
    });
  const orders = (storeId = "s-a") =>
    env.DB.prepare(
      `SELECT id, ebay_order_id, is_provisional, payment_status, buyer_json
         FROM orders WHERE store_id = ? ORDER BY ebay_order_id`,
    )
      .bind(storeId)
      .all()
      .then(({ results }) => results);

  // Ordini non assorbiti, provvisori compresi: le viste mostrano soltanto i definitivi.
  const current = () =>
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE store_id = 's-a' AND merged_into IS NULL",
    )
      .first<{ n: number }>()
      .then((row) => row!.n);

  beforeEach(async () => {
    await seed();
    await resetOrderFixtures();
    await env.DB.batch([
      insertCredentials({ accessExpiresAt: now, grantedAt }),
      insertCredentials({ storeId: "s-b", accessExpiresAt: now, grantedAt }),
    ]);
  });

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
        orderObservationSchema.parse({ ...observation(), buyerEiasToken: " token " })
          .buyerEiasToken,
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
      const source = await imported("previous", "2026-09-11T00:00:00.000Z", [
        cf("RSSMRA80A01H501U"),
      ]);
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
      await imported(
        "other-workspace",
        "2026-09-12T00:00:00.000Z",
        [cf("ALTRO-SPAZIO")],
        {},
        "s-b",
      );
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
      const visible = (await listVisibleOrders(env.DB, "u-a")).find(
        (order) => order.id === current,
      )!;
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
      const source = await imported("previous", "2026-08-30T00:00:00.000Z", [
        cf("RSSMRA80A01H501U"),
      ]);
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
        (await read(current, "u-a", new Date("2026-09-14T00:00:00.000Z"))).get(current)!
          .suggestions,
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
      expect(result.suggestions.find((item) => item.identifier?.type === "CF")?.conflict).toBe(
        false,
      );
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

  it("nega l'accesso alla scadenza anche senza pulizia e non rinnova il grant", async () => {
    const result = await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
        },
      }),
    );
    const id = (result as { orderId: string }).orderId;
    await unlockOrders(env.DB, "u-a", [id]);
    const expiry = new Date("2026-10-10T10:00:00.000Z");
    for (const offset of [-1, 0, 1]) {
      const at = new Date(expiry.getTime() + offset);
      const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", at);
      expect(visible).toHaveLength(offset < 0 ? 1 : 0);
      expect((await listStores(env.DB, "u-a", at))[0]!.importedOrders).toBe(offset < 0 ? 1 : 0);
      if (offset >= 0)
        await expect(unlockOrders(env.DB, "u-a", [id], false, "production", at)).rejects.toThrow(
          "order_not_available",
        );
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
      n: 1,
    });
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  });

  it.each(["expires_at", "revoked_at"])(
    "un grant con %s non espone valori e non consuma altra quota",
    async (column) => {
      // Un posto libero dopo lo sblocco: il rifiuto successivo non dipende dalla quota.
      await env.DB.batch([
        env.DB.prepare("DELETE FROM free_cycles WHERE id = 'c-a'"),
        env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
          VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 2)`),
      ]);
      const result = await recordOrderObservation(
        env.DB,
        target(),
        observation({
          taxIdentifiers: {
            source: "ebay_fulfillment",
            complete: false,
            values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
          },
        }),
      );
      const orderId = (result as { orderId: string }).orderId;
      await unlockOrders(env.DB, "u-a", [orderId]);
      const expiry = new Date(Date.parse(now) + 1000);
      await env.DB.prepare(`UPDATE order_grants SET ${column} = ?`)
        .bind(expiry.toISOString())
        .run();
      if (column === "expires_at") {
        expect(
          (
            await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(expiry.getTime() - 1))
          )[0]!.taxIdentifiers,
        ).toHaveLength(1);
      }
      for (const offset of [0, 1]) {
        const at = new Date(expiry.getTime() + offset);
        const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", at);
        expect(visible[0]!.taxIdentifiers).toEqual([]);
        expect(JSON.stringify(visible)).not.toContain("RSSMRA80A01H501U");
        await expect(
          unlockOrders(env.DB, "u-a", [orderId], false, "production", at),
        ).rejects.toMatchObject({ code: "order_already_granted" });
      }
      expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual(
        { used: 1 },
      );
    },
  );

  it("la pulizia elimina tutte le copie dell'ordine e il replay non le ricrea", async () => {
    const value = observation({
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: true,
        values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
      },
    });
    const first = await recordOrderObservation(env.DB, target(), value);
    const id = (first as { orderId: string }).orderId;
    await unlockOrders(env.DB, "u-a", [id]);
    const expiry = new Date("2026-10-10T10:00:00.000Z");
    await purgeExpiredRecords(env.DB, new Date(expiry.getTime() - 1));
    expect(await orders()).toHaveLength(1);
    await purgeExpiredRecords(env.DB, expiry);
    await purgeExpiredRecords(env.DB, expiry);
    for (const table of [
      "orders",
      "order_items",
      "tax_identifiers",
      "order_tax_checks",
      "order_source_refs",
      "order_grants",
      "order_reconciliation_issues",
    ]) {
      expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first(), table).toEqual({
        n: 0,
      });
    }
    // Anche una data successiva e un nuovo identificativo esterno non aggirano il marker.
    expect(await recordOrderObservation(env.DB, target(), value)).toEqual({ outcome: "stale" });
    expect(
      await recordOrderObservation(env.DB, target(), {
        ...value,
        externalOrderId: "nuovo-id",
        creationTime: now,
      }),
    ).toEqual({ outcome: "stale" });
    expect(await orders()).toEqual([]);
    expect((await recordOrderObservation(env.DB, target("s-b"), value)).outcome).toBe("created");
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  });

  it("una risposta iniziata prima della scadenza non aggiorna buyer e dati fiscali dopo", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z"));
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          buyer: { name: "Tardivo" },
          taxIdentifiers: {
            source: "ebay_fulfillment",
            complete: false,
            values: [{ type: "CODICE_FISCALE", value: "TARDIVO" }],
          },
        }),
      ),
    ).toEqual({ outcome: "stale" });
    expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
      n: 0,
    });
  });

  it("una sovrapposizione parziale con un ordine scaduto non crea un nuovo alias consultabile", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?2")
      .bind(now, "2026-10-10T10:00:00.000Z")
      .run();
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          externalOrderId: "alias-parziale",
          items: [line("k1"), line("k3")],
          taxIdentifiers: {
            source: "ebay_fulfillment",
            complete: false,
            values: [{ type: "CODICE_FISCALE", value: "NON-ESPORRE" }],
          },
        }),
      ),
    ).toEqual({ outcome: "stale" });
    expect(await orders()).toHaveLength(1);
    expect(await listVisibleOrders(env.DB, "u-a")).toEqual([]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
      n: 0,
    });
  });

  it.each(["ordine nuovo", "fonte fiscale"])(
    "non legge articoli non necessari per %s",
    async (mode) => {
      if (mode === "fonte fiscale") await recordOrderObservation(env.DB, target(), observation());
      const prepared = vi.spyOn(env.DB, "prepare");
      try {
        const result = await recordOrderObservation(
          env.DB,
          target(),
          observation({
            source: mode === "fonte fiscale" ? "trading" : "fulfillment",
            taxIdentifiers: {
              source: "ebay_trading_get_orders",
              complete: false,
              values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
            },
          }),
        );
        expect(result).toMatchObject({
          outcome: mode === "ordine nuovo" ? "created" : "unchanged",
          taxChanges: 1,
        });
        expect(
          prepared.mock.calls.some(([sql]) => /^\s*SELECT id, line_item_id, stable_key/u.test(sql)),
        ).toBe(false);
      } finally {
        prepared.mockRestore();
      }
    },
  );

  it("rilegge il tempo dopo l'ultima lettura preparatoria, prima di autorizzare il batch", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const expiry = new Date("2026-10-10T10:00:00.000Z");
    vi.setSystemTime(new Date(expiry.getTime() - 1));
    const prepare = env.DB.prepare.bind(env.DB);
    const intercepted = vi.spyOn(env.DB, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql);
      if (!sql.includes("FROM order_items WHERE order_id = ?")) return statement;
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
      expect(
        await recordOrderObservation(env.DB, target(), observation({ buyer: { name: "Tardivo" } })),
      ).toEqual({ outcome: "stale" });
      expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
    } finally {
      intercepted.mockRestore();
    }
  });

  it("un orologio arretrato non riapre un ordine già scaduto all'inizio dell'osservazione", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const expiry = "2026-10-10T10:00:00.000Z";
    vi.setSystemTime(new Date(Date.parse(expiry) - 1));
    expect(
      await recordOrderObservation(
        env.DB,
        target("s-a", expiry),
        observation({ buyer: { name: "Tardivo" } }),
      ),
    ).toEqual({ outcome: "stale" });
    expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
  });

  it("conserva la grace senza consultazione e la cancellazione richiesta prevale", async () => {
    const result = await recordOrderObservation(env.DB, target(), observation());
    const id = (result as { orderId: string }).orderId;
    // Scadenza Premium esplicita di un anno, separata dal grant e dalla pulizia fisica.
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind("2027-09-10T10:00:00.000Z", id)
      .run();
    expect(
      await listVisibleOrders(
        env.DB,
        "u-a",
        50,
        "production",
        new Date("2027-09-10T09:59:59.999Z"),
      ),
    ).toHaveLength(1);
    const downgrade = "2026-10-01T00:00:00.000Z";
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?2 WHERE id = ?3")
      .bind(downgrade, "2026-10-31T00:00:00.000Z", id)
      .run();
    const at = new Date(downgrade);
    expect(await listVisibleOrders(env.DB, "u-a", 50, "production", at)).toEqual([]);
    await purgeExpiredRecords(env.DB, at);
    expect(await orders()).toHaveLength(1);
    expect(await deleteStoreData(env.DB, "u-a", "s-a", "e-a", at)).toBe("done");
    expect(await orders()).toEqual([]);
    // Il ricollegamento conserva il limite di cancellazione anche per ordini mai importati.
    await env.DB.batch([
      env.DB.prepare("UPDATE ebay_stores SET disconnected_at = NULL, data_deleted_at = NULL"),
      insertCredentials({ accessExpiresAt: "2027-01-01T00:00:00.000Z", grantedAt }),
    ]);
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ externalOrderId: "mai-importato", items: [line("mai-vista")] }),
      ),
    ).toEqual({ outcome: "stale" });
    expect(
      (
        await recordOrderObservation(
          env.DB,
          target(),
          observation({
            externalOrderId: "nuovo",
            creationTime: "2026-10-01T00:00:00.001Z",
            items: [line("nuova")],
          }),
        )
      ).outcome,
    ).toBe("created");
  });

  it("una cancellazione tra lettura e batch vince anche su una risposta già pronta", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const execute = env.DB.batch.bind(env.DB);
    const batch = vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await execute([env.DB.prepare("DELETE FROM orders")]);
      return execute(statements);
    });
    try {
      expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
        outcome: "stale",
      });
      expect(await orders()).toEqual([]);
    } finally {
      batch.mockRestore();
    }
  });

  it.each(["scadenza", "cancellazione"])(
    "un dettaglio pendente si ferma prima di eBay dopo %s",
    async (mode) => {
      await recordOrderObservation(env.DB, target(), observation());
      if (mode === "scadenza") vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z"));
      else await env.DB.prepare("DELETE FROM orders").run();
      const fetcher = vi.fn<typeof fetch>();
      const budget = { calls: 12, pages: 1 };
      expect(
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
            budget,
            created: 0,
          },
          {
            external_order_id: "D-1",
            last_modified_time: "2026-09-10T11:00:00.000Z",
            detail_attempts: 0,
            marketplace_id: null,
          },
        ),
      ).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
      expect(budget).toEqual({ calls: 12, pages: 1 });
    },
  );

  it("un errore arrivato dopo la scadenza non riapre il retry del dettaglio", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const expiry = new Date("2026-10-10T10:00:00.000Z");
    vi.setSystemTime(new Date(expiry.getTime() - 1));
    const fetcher = vi.fn<typeof fetch>(async () => {
      vi.setSystemTime(expiry);
      return new Response("non-json");
    });
    expect(
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
          budget: { calls: 12, pages: 1 },
          created: 0,
        },
        {
          external_order_id: "D-1",
          last_modified_time: "2026-09-10T11:00:00.000Z",
          detail_attempts: 0,
          marketplace_id: null,
        },
      ),
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare(
        "SELECT detail_error, detail_attempts, detail_retry_at FROM order_source_refs",
      ).first(),
    ).toEqual({ detail_error: null, detail_attempts: 0, detail_retry_at: null });
  });

  it.each([true, false])(
    "gli originali del combinato seguono la retention corrente senza perdere il grant, primo più vecchio: %s",
    async (firstOlder) => {
      await recordOrderObservation(
        env.DB,
        target(),
        provisional({
          items: [line("k1")],
          creationTime: firstOlder ? "2026-09-09T10:00:00Z" : "2026-09-10T10:00:00Z",
        }),
      );
      const second = await recordOrderObservation(
        env.DB,
        target(),
        provisional({
          externalOrderId: "P-2",
          creationTime: firstOlder ? "2026-09-10T10:00:00Z" : "2026-09-09T10:00:00Z",
          items: [line("k2")],
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
          },
        }),
      );
      await env.DB.prepare(
        "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('merged-retention', 'w-a', ?, 'admin', ?)",
      )
        .bind((second as { orderId: string }).orderId, now)
        .run();
      const combined = await recordOrderObservation(env.DB, target(), observation());
      await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
        .bind("2026-11-01T00:00:00.000Z", (combined as { orderId: string }).orderId)
        .run();
      const at = new Date("2026-10-11T00:00:00.000Z");
      await purgeExpiredRecords(env.DB, at);
      expect((await listVisibleOrders(env.DB, "u-a", 50, "production", at))[0]!.fiscalState).toBe(
        "available",
      );
      expect(await orders()).toHaveLength(2);
      await purgeExpiredRecords(env.DB, new Date("2026-11-01T00:00:00.000Z"));
      expect(await orders()).toEqual([]);
      expect(
        await recordOrderObservation(
          env.DB,
          target(),
          provisional({ externalOrderId: "P-2", items: [line("k2")] }),
        ),
      ).toEqual({ outcome: "stale" });
    },
  );

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
              (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!
                .n,
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
    const created = await recordOrderObservation(
      env.DB,
      target(),
      explicit("2026-09-10T11:00:00Z"),
    );
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
      orders().then(
        ([order]) => JSON.parse(order!.buyer_json as string) as { phone: string | null },
      );
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
    expect(visible.map(({ id, fiscalState }) => [id, fiscalState])).toEqual([
      [orderId, "available"],
    ]);
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
    await env.DB.prepare("UPDATE orders SET is_provisional = 0 WHERE id = ?")
      .bind(drafts[1]!)
      .run();
    await env.DB.prepare(
      `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
       VALUES ('combined-grant', 'w-a', ?, 'combined-cycle', 'free_cycle', ?)`,
    )
      .bind(drafts[1]!, now)
      .run();
    await env.DB.prepare("UPDATE orders SET is_provisional = 1 WHERE id = ?")
      .bind(drafts[1]!)
      .run();
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
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({ items: [line("k1"), line("k3")] }),
    );
    expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
      issue: "partial_overlap",
    });
    expect(
      (await listVisibleOrders(env.DB, "u-a")).every((order) => order.reconciliationIssue),
    ).toBe(true);
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
      await recordOrderObservation(
        env.DB,
        target(),
        check(availability, availability === "removed"),
      );
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
    expect(firstAvailable >= beforeAvailable && firstAvailable <= (await databaseTime())).toBe(
      true,
    );
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
      env.DB.prepare("UPDATE orders SET merged_into = ?1 WHERE id = ?2").bind(
        kept!.id,
        absorbed!.id,
      ),
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
      expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual(
        {
          total: 0,
        },
      );
      expect(
        await env.DB.prepare("SELECT COUNT(*) AS total FROM order_tax_checks").first(),
      ).toEqual({
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
      expect(
        await env.DB.prepare("SELECT last_modified_time FROM order_tax_checks").first(),
      ).toEqual({ last_modified_time: "2026-09-10T11:00:00.000Z" });
      await resetOrderFixtures();
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          source,
          taxIdentifiers: {
            source:
              taxSource === "ebay_fulfillment" ? "ebay_trading_get_orders" : "ebay_fulfillment",
            complete: false,
            values: [],
          },
        }),
      );
      expect(
        await env.DB.prepare("SELECT last_modified_time FROM order_tax_checks").first(),
      ).toEqual({ last_modified_time: null });
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
      expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual(
        { total: 0 },
      );
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
        },
        {
          external_order_id: "D-1",
          last_modified_time: modified,
          detail_attempts: attempts,
          marketplace_id: null,
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
    expect(
      await recordOrderObservation(env.DB, target("s-a", "2026-09-13T00:00:00Z"), late),
    ).toEqual({ outcome: "stale" });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM orders WHERE merged_into IS NULL",
      ).first(),
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
});
