import { env } from "cloudflare:workers";
import { vi } from "vitest";

export const now = "2026-09-13T20:00:00.000Z";

/** Istante a `minutes` minuti da `now`. */
export const later = (minutes: number) => new Date(Date.parse(now) + minutes * 60_000);
/**
 * Tabelle che vivono con l'utente Better Auth: le prove creano utenti con email proprie e il
 * reset non li elimina, quindi conserva anche profilo, consensi e preferenze personali.
 */
const userTables = new Set([
  "user",
  "session",
  "account",
  "verification",
  "passkey",
  "rateLimit",
  "user_profiles",
  "user_preferences",
  "terms_acceptances",
  "marketing_consents",
  "notification_reads",
  "account_email_changes",
]);

/**
 * Svuota ogni tabella applicativa ricavandola dallo schema, così una nuova migration è coperta
 * senza modifiche qui. Le chiavi esterne si verificano a fine batch; le chiavi degli ordini
 * eliminati, scritte dal trigger durante il reset, si svuotano per ultime.
 */
export async function resetDatabase() {
  vi.setSystemTime(new Date(now));
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name NOT IN ('d1_migrations', 'deleted_order_keys')`,
  ).all<{ name: string }>();
  // Un posto lifetime attivo non si elimina: il trigger si sospende soltanto per ripulire.
  const kept = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'lifetime_allocation_is_kept'",
  ).first<{ sql: string }>();
  await env.DB.batch([
    env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
    env.DB.prepare("DROP TRIGGER lifetime_allocation_is_kept"),
    ...results
      .filter(({ name }) => !userTables.has(name))
      .map(({ name }) => env.DB.prepare(`DELETE FROM "${name}"`)),
    env.DB.prepare("DELETE FROM deleted_order_keys"),
    env.DB.prepare(kept!.sql),
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

export type EntitlementSource = "premium" | "trial" | "lifetime" | "admin";

type EntitlementRow = {
  id?: string;
  workspaceId?: string;
  source: EntitlementSource;
  startsAt?: string;
  /** Soltanto il lifetime non ha fine, come vuole lo schema. */
  endsAt?: string | null;
  stripeCheckoutSessionId?: string | null;
  grantedBy?: string | null;
  grantReason?: string | null;
  /** Prova del pagamento: fattura, importo in centesimi, valuta e istante. */
  stripeInvoiceId?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  paidAt?: string | null;
  /** Revoca per rimborso totale o disputa persa e somma dei rimborsi riusciti. */
  revokedAt?: string | null;
  revocation?: "refund" | "dispute" | null;
  amountRefunded?: number | null;
};

/** Diritto d'accesso sintetico dello spazio, eseguibile con `run()` o dentro un `batch`. */
export function insertEntitlement({
  id = crypto.randomUUID(),
  workspaceId = "w-a",
  source,
  startsAt = now,
  endsAt = null,
  stripeCheckoutSessionId,
  grantedBy,
  grantReason,
  stripeInvoiceId,
  amountPaid,
  currency,
  paidAt,
  revokedAt,
  revocation,
  amountRefunded,
}: EntitlementRow) {
  return env.DB.prepare(
    `INSERT INTO workspace_entitlements
       (id, workspace_id, source, starts_at, ends_at, stripe_checkout_session_id, granted_by,
        grant_reason, stripe_invoice_id, amount_paid, currency, paid_at, revoked_at, revocation,
        amount_refunded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    workspaceId,
    source,
    startsAt,
    endsAt,
    stripeCheckoutSessionId ?? null,
    grantedBy ?? null,
    grantReason ?? null,
    stripeInvoiceId ?? null,
    amountPaid ?? null,
    currency ?? null,
    paidAt ?? null,
    revokedAt ?? null,
    revocation ?? null,
    amountRefunded ?? null,
  );
}

type CredentialsRow = {
  storeId?: string;
  accessToken?: string;
  accessExpiresAt: string;
  refreshToken?: string;
  /** Senza un valore proprio scade insieme al token di accesso. */
  refreshExpiresAt?: string;
  grantedAt?: string;
};

/** Credenziali eBay sintetiche di un negozio, eseguibili con `run()` o dentro un `batch`. */
export function insertCredentials({
  storeId = "s-a",
  accessToken = "a",
  accessExpiresAt,
  refreshToken = "r",
  refreshExpiresAt = accessExpiresAt,
  grantedAt = now,
}: CredentialsRow) {
  return env.DB.prepare(
    `INSERT INTO ebay_store_credentials
       (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(storeId, accessToken, accessExpiresAt, refreshToken, refreshExpiresAt, grantedAt);
}

/** Pausa sintetica di un negozio, eseguibile con `run()` o dentro un `batch`. */
export function insertStorePause({
  storeId = "s-a",
  reason = "manual",
  pausedAt = now,
}: {
  storeId?: string;
  reason?: "manual" | "plan" | "inactivity" | "admin";
  pausedAt?: string;
} = {}) {
  return env.DB.prepare(
    "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES (?, ?, ?)",
  ).bind(storeId, reason, pausedAt);
}

/** Spazio sintetico con il suo unico membro, da eseguire dentro un `batch`. */
export function insertWorkspace({
  id,
  userId,
  name = "Sintetico",
  createdAt = now,
}: {
  id: string;
  userId?: string;
  name?: string;
  createdAt?: string;
}) {
  return [
    env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").bind(
      id,
      name,
      createdAt,
    ),
    ...(userId
      ? [
          env.DB.prepare(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')",
          ).bind(id, userId),
        ]
      : []),
  ];
}

/**
 * Ordine con un articolo e un Codice Fiscale, da eseguire dentro un `batch`. L'acquirente porta
 * username e token eIAS; `mergedInto` indica l'ordine in cui è confluito, `retentionUntil` la
 * conservazione e, senza, vale quella predefinita dello schema.
 */
export function insertOrder(
  id: string,
  {
    storeId = "s-a",
    buyer,
    mergedInto = null,
    retentionUntil = null,
  }: {
    storeId?: string;
    buyer?: { eias: string | null; username: string };
    mergedInto?: string | null;
    retentionUntil?: string | null;
  } = {},
) {
  return [
    env.DB.prepare(
      `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor, buyer_json, buyer_eias_token, merged_into, retention_until,
         purge_after)
       VALUES (?1, ?2, ?3, ?4, ?4, 'EUR', 1299, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(
      id,
      storeId,
      `ebay-${id}`,
      now,
      buyer ? JSON.stringify({ username: buyer.username, name: "Mario Rossi" }) : null,
      buyer?.eias ?? null,
      mergedInto,
      retentionUntil,
    ),
    env.DB.prepare(
      `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
       VALUES (?1, ?2, ?3, 'Articolo', 1, 1299, 'EUR')`,
    ).bind(`i-${id}`, id, `line-${id}`),
    env.DB.prepare(
      `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source,
         observed_at) VALUES (?1, ?2, 'CODICE_FISCALE', 'IT', 'RSSMRA80A01H501U', 'synthetic_fixture', ?3)`,
    ).bind(`t-${id}`, id, now),
  ];
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
