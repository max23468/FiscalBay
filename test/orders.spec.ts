import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { grantFreeOrder, listVisibleOrders } from "../app/domain/orders.server";

const now = "2026-09-13T20:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM order_grants"),
    env.DB.prepare("DELETE FROM free_cycles"),
    env.DB.prepare("DELETE FROM tax_identifiers"),
    env.DB.prepare("DELETE FROM order_items"),
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM sync_state"),
    env.DB.prepare("DELETE FROM ebay_stores"),
    env.DB.prepare("DELETE FROM workspace_members"),
    env.DB.prepare("DELETE FROM workspaces"),
  ]);
});

async function seed(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, name, created_at) VALUES ('w-a', 'A', ?), ('w-b', 'B', ?)",
    ).bind(now, now),
    env.DB.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-a', 'u-a', 'owner'), ('w-b', 'u-b', 'owner')",
    ),
    env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at) VALUES ('s-a', 'w-a', 'e-a', ?), ('s-b', 'w-b', 'e-b', ?)",
    ).bind(now, now),
    env.DB.prepare(
      `INSERT INTO orders
        (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES ('o-a', 's-a', 'ebay-a', ?, ?, 'EUR', 1299),
              ('o-b', 's-b', 'ebay-b', ?, ?, 'EUR', 2599)`,
    ).bind(now, now, now, now),
    env.DB.prepare(
      `INSERT INTO tax_identifiers
        (id, order_id, identifier_type, issuing_country, value, observed_at)
       VALUES ('t-a1', 'o-a', 'CODICE_FISCALE', 'IT', 'RSSMRA80A01H501U', ?),
              ('t-a2', 'o-a', 'VAT_ID', 'IT', '01234567890', ?),
              ('t-b', 'o-b', 'CODICE_FISCALE', 'IT', 'BNCLGU80A01H501Z', ?)`,
    ).bind(now, now, now),
    env.DB.prepare(
      `INSERT INTO order_items
        (id, order_id, line_item_id, sku, title, quantity, unit_minor)
       VALUES ('i-a1', 'o-a', 'line-a1', 'SKU-A', 'Articolo A', 1, 999),
              ('i-a2', 'o-a', 'line-a2', NULL, 'Articolo B', 2, 150),
              ('i-b', 'o-b', 'line-b', 'SKU-B', 'Articolo B', 1, 2599)`,
    ),
    env.DB.prepare(
      `INSERT INTO free_cycles
        (id, workspace_id, starts_at, ends_at, quota)
       VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 1)`,
    ),
  ]);
}

describe("vertical slice M0", () => {
  it("mostra i dati fiscali dell'ordine sbloccato solo al tenant proprietario", async () => {
    await seed();
    await grantFreeOrder(env.DB, {
      id: "g-a",
      workspaceId: "w-a",
      orderId: "o-a",
      cycleId: "c-a",
      grantedAt: now,
    });

    const ownerOrders = await listVisibleOrders(env.DB, "u-a");
    const otherTenantOrders = await listVisibleOrders(env.DB, "u-b");

    expect(ownerOrders).toHaveLength(1);
    expect(ownerOrders[0]?.taxIdentifiers).toEqual([
      {
        type: "CODICE_FISCALE",
        issuingCountry: "IT",
        value: "RSSMRA80A01H501U",
      },
      { type: "VAT_ID", issuingCountry: "IT", value: "01234567890" },
    ]);
    expect(otherTenantOrders[0]?.taxIdentifiers).toEqual([]);
  });

  it("consuma la quota una sola volta con due sblocchi concorrenti", async () => {
    await seed();
    await env.DB.prepare(
      `INSERT INTO orders
        (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES ('o-a2', 's-a', 'ebay-a2', ?, ?, 'EUR', 3999)`,
    )
      .bind(now, now)
      .run();
    const outcomes = await Promise.allSettled([
      grantFreeOrder(env.DB, {
        id: "g-a",
        workspaceId: "w-a",
        orderId: "o-a",
        cycleId: "c-a",
        grantedAt: now,
      }),
      grantFreeOrder(env.DB, {
        id: "g-a2",
        workspaceId: "w-a",
        orderId: "o-a2",
        cycleId: "c-a",
        grantedAt: now,
      }),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 1, quota: 1 });
  });

  it("rifiuta un grant per un ordine di un altro workspace", async () => {
    await seed();

    await expect(
      grantFreeOrder(env.DB, {
        id: "g-cross-tenant",
        workspaceId: "w-a",
        orderId: "o-b",
        cycleId: "c-a",
        grantedAt: now,
      }),
    ).rejects.toThrow();

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 0, quota: 1 });
  });
});
