import { env } from "cloudflare:workers";
import { vi } from "vitest";

export const now = "2026-09-13T20:00:00.000Z";
export async function resetDatabase() {
  vi.setSystemTime(new Date(now));
  // Un posto lifetime attivo non si elimina: il trigger si sospende soltanto per ripulire.
  const kept = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'lifetime_allocation_is_kept'",
  ).first<{ sql: string }>();
  await env.DB.batch([
    env.DB.prepare("DROP TRIGGER lifetime_allocation_is_kept"),
    env.DB.prepare("DELETE FROM lifetime_allocations"),
    env.DB.prepare(kept!.sql),
    env.DB.prepare("DELETE FROM ebay_store_link_sessions"),
    env.DB.prepare("DELETE FROM ebay_store_credentials"),
    env.DB.prepare("DELETE FROM order_grants"),
    env.DB.prepare("DELETE FROM free_cycles"),
    env.DB.prepare("DELETE FROM free_promotions"),
    env.DB.prepare("DELETE FROM admission_settings"),
    env.DB.prepare("DELETE FROM tax_identifiers"),
    env.DB.prepare("DELETE FROM order_items"),
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM sync_state"),
    env.DB.prepare("DELETE FROM ebay_stores"),
    env.DB.prepare("DELETE FROM workspace_members"),
    env.DB.prepare("DELETE FROM workspaces"),
  ]);
}
export async function resetOrderFixtures() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM deleted_order_keys"),
  ]);
}

type StoreRow = {
  id: string;
  workspaceId?: string;
  ebayUserId?: string;
  environment?: "production" | "sandbox";
  linkedAt?: string;
};

/** Negozio eBay sintetico, eseguibile con `run()` o dentro un `batch`. */
export function insertStore({
  id,
  workspaceId = "w-a",
  ebayUserId = id,
  environment = "production",
  linkedAt = now,
}: StoreRow) {
  return env.DB.prepare(
    "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, ebay_environment, linked_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, workspaceId, ebayUserId, environment, linkedAt);
}

type TaxIdentifierRow = {
  id: string;
  orderId: string;
  type: string;
  value: string;
  country?: string | null;
  source?: string;
  observedAt?: string;
  removedAt?: string | null;
};

/** Identificativi fiscali sintetici in un'unica istruzione, eseguibile con `run()` o in `batch`. */
export function insertTaxIdentifiers(...rows: TaxIdentifierRow[]) {
  return env.DB.prepare(
    `INSERT INTO tax_identifiers
      (id, order_id, identifier_type, issuing_country, value, source, observed_at, removed_at)
     VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
  ).bind(
    ...rows.flatMap((row) => [
      row.id,
      row.orderId,
      row.type,
      row.country ?? null,
      row.value,
      row.source ?? "synthetic_fixture",
      row.observedAt ?? now,
      row.removedAt ?? null,
    ]),
  );
}

export async function seed(): Promise<void> {
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
        (id, order_id, identifier_type, issuing_country, value, source, observed_at)
       VALUES ('t-a1', 'o-a', 'CODICE_FISCALE', NULL, 'RSSMRA80A01H501U', 'ebay_trading_get_orders', ?),
              ('t-a2', 'o-a', 'VAT_ID', 'IT', '01234567890', 'ebay_trading_get_orders', ?),
              ('t-b', 'o-b', 'CODICE_FISCALE', 'IT', 'BNCLGU80A01H501Z', 'synthetic_fixture', ?)`,
    ).bind(now, now, now),
    env.DB.prepare(
      `INSERT INTO order_items
        (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
       VALUES ('i-a1', 'o-a', 'line-a1', 'SKU-A', 'Articolo A', 1, 999, 'EUR'),
              ('i-a2', 'o-a', 'line-a2', NULL, 'Articolo B', 2, 300, 'EUR'),
              ('i-b', 'o-b', 'line-b', 'SKU-B', 'Articolo B', 1, 2599, 'EUR')`,
    ),
    env.DB.prepare(
      `INSERT INTO free_cycles
        (id, workspace_id, starts_at, ends_at, quota)
       VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 1)`,
    ),
  ]);
}
