import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { handleAuthRequest } from "../app/auth-route.server";
import { createAuth } from "../app/auth.server";
import {
  consumeAccountDeletion,
  resumeAccountDeletions,
  runAccountDeletion,
  startAccountDeletion,
} from "../app/domain/account-deletion.server";
import {
  applyStoreMark,
  readStoreMark,
  storeIdentityHash,
  trialMarkDays,
} from "../app/domain/store-marks.server";
import { listAnomalies } from "../app/domain/admin-operations.server";
import { reconcileOwnerIncidents } from "../app/domain/owner-incidents.server";
import { applyStripeEvent } from "../app/domain/billing.server";
import { consumeExportJob } from "../app/domain/export-jobs.server";
import { orderAllowance } from "../app/domain/grants.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { vacantLifetimeSeats } from "../app/domain/lifetime.server";
import { grantLifetimeConcession } from "../app/domain/concessions.server";
import { consumeStoreSync } from "../app/domain/order-sync.server";
import { completeStoreLink } from "../app/domain/store-link.server";
import {
  claimStoreLinkSession,
  startStoreLink as beginLink,
} from "../app/integrations/ebay/store-link.server";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { loader as ordersLoader } from "../app/routes/orders";
import { action as signInAction, loader as signInLoader } from "../app/routes/sign-in";
import {
  emailLink,
  sessionCookie,
  syntheticProfile,
  verifiedSession,
} from "./fixtures/account-fixtures";
import { completeRegistration } from "../app/domain/registration.server";
import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertWorkspace,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { syntheticEbay } from "./fixtures/ebay-fixtures";
import { fakeQueue, queueMessage, queued } from "./fixtures/queue-fixture";
import { callRoute, routeData, testOrigin } from "./fixtures/route-fixtures";
import { firstInvoice, stripeAccount, workspace } from "./fixtures/stripe-fixtures";

const privacy = "/app/impostazioni/privacy";
const at = (iso: string) => new Date(iso);
const later = (minutes: number) => new Date(Date.parse(now) + minutes * 60_000);

/** Righe ancora presenti per tabella, filtrate sullo spazio o sull'utente della prova. */
async function leftovers(userId: string, workspaceId = "w-a") {
  const count = async (sql: string, value: string) =>
    (await env.DB.prepare(sql).bind(value).first<{ n: number }>())!.n;
  return {
    user: await count('SELECT COUNT(*) AS n FROM "user" WHERE "id" = ?', userId),
    sessions: await count('SELECT COUNT(*) AS n FROM "session" WHERE "userId" = ?', userId),
    accounts: await count('SELECT COUNT(*) AS n FROM "account" WHERE "userId" = ?', userId),
    profile: await count("SELECT COUNT(*) AS n FROM user_profiles WHERE user_id = ?", userId),
    members: await count("SELECT COUNT(*) AS n FROM workspace_members WHERE user_id = ?", userId),
    files: await count("SELECT COUNT(*) AS n FROM export_files WHERE user_id = ?", userId),
    workspace: await count("SELECT COUNT(*) AS n FROM workspaces WHERE id = ?", workspaceId),
    stores: await count(
      "SELECT COUNT(*) AS n FROM ebay_stores WHERE workspace_id = ?",
      workspaceId,
    ),
    orders: await count(
      "SELECT COUNT(*) AS n FROM orders o JOIN ebay_stores s ON s.id = o.store_id WHERE s.workspace_id = ?",
      workspaceId,
    ),
    items: await count("SELECT COUNT(*) AS n FROM order_items WHERE order_id LIKE ?", "o-%"),
    taxIds: await count("SELECT COUNT(*) AS n FROM tax_identifiers WHERE order_id LIKE ?", "o-%"),
    cycles: await count(
      "SELECT COUNT(*) AS n FROM free_cycles WHERE workspace_id = ?",
      workspaceId,
    ),
    coverage: await count(
      "SELECT COUNT(*) AS n FROM workspace_entitlements WHERE workspace_id = ?",
      workspaceId,
    ),
    subscriptions: await count(
      "SELECT COUNT(*) AS n FROM stripe_subscriptions WHERE workspace_id = ?",
      workspaceId,
    ),
  };
}

/** Ordine con un articolo e un Codice Fiscale, del negozio indicato. */
function insertOrder(id: string, storeId = "s-a") {
  return [
    env.DB.prepare(
      `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor) VALUES (?1, ?2, ?3, ?4, ?4, 'EUR', 1299)`,
    ).bind(id, storeId, `ebay-${id}`, now),
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

/**
 * Una riga in ogni altra tabella con dati dell'utente, dello spazio, dei negozi o degli ordini,
 * oltre a quelle di `populatedAccount`. Un trasferimento verso un altro spazio, un posto
 * lifetime e una voce del registro della console restano dopo la cancellazione.
 */
async function everyTable(userId: string) {
  const sessionId = (await env.DB.prepare('SELECT "id" FROM "session" WHERE "userId" = ?')
    .bind(userId)
    .first<string>("id"))!;
  const row = (sql: string, ...values: unknown[]) => env.DB.prepare(sql).bind(...values);
  const soon = later(30).toISOString();
  await env.DB.batch([
    ...insertWorkspace({ id: "w-b" }),
    insertStore({ id: "s-x", workspaceId: "w-b" }),
    row(
      `INSERT INTO store_transfers (id, store_id, from_workspace_id, to_workspace_id, actor,
         reason, prepared_at, expires_at, executed_at)
       VALUES ('t-x', 's-x', 'w-a', 'w-b', 'admin', 'Cessione', ?1, ?2, ?1)`,
      now,
      soon,
    ),
    row(
      `INSERT INTO admin_audit (id, actor, operation, target, reason, outcome, at)
       VALUES ('a-1', 'admin', 'store-pause', 'workspace:w-a:store:s-a', 'Verifica', 'done', ?)`,
      now,
    ),
    row(
      `INSERT INTO lifetime_allocations (slot, workspace_id, status, provider_reference,
         created_at, activated_at, customer_id)
       VALUES (1, 'w-a', 'active', 'cs_lifetime', ?1, ?1, 'cus_lifetime')`,
      now,
    ),
    row(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
      now,
    ),
    row(
      "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES ('s-a', ?, 1, 2)",
      now,
    ),
    row(
      "INSERT INTO telegram_store_preferences (store_id, enabled, updated_at) VALUES ('s-a', 1, ?)",
      now,
    ),
    row("INSERT INTO telegram_preferences (workspace_id, updated_at) VALUES ('w-a', ?)", now),
    row(
      `INSERT INTO telegram_deliveries (id, workspace_id, link_id, kind, order_id, store_id,
         change, event_key, event_at, created_at)
       VALUES ('d-1', 'w-a', 'tl-a', 'order', 'o-1', 's-a', 'new', 'o-1:new', ?1, ?1)`,
      now,
    ),
    row(
      `INSERT INTO telegram_order_notices (order_id, link_id, fiscal_key, notified, evaluated_at)
       VALUES ('o-1', 'tl-a', '[]', 1, ?)`,
      now,
    ),
    row(
      `INSERT INTO telegram_link_requests (token_hash, workspace_id, user_id, session_id,
         language, time_zone, created_at, expires_at)
       VALUES (?1, 'w-a', ?2, ?3, 'it', 'Europe/Rome', ?4, ?5)`,
      "a".repeat(64),
      userId,
      sessionId,
      now,
      soon,
    ),
    row(
      `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id,
         last_modified_time) VALUES ('s-a', 'fulfillment', 'ext-1', 'o-1', ?)`,
      now,
    ),
    row(
      `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
       VALUES ('o-1', 'ebay_fulfillment', ?, 'present')`,
      now,
    ),
    row(
      `INSERT INTO order_reconciliation_issues (order_id, related_order_id, kind, detected_at)
       VALUES ('o-1', 'o-2', 'partial_overlap', ?)`,
      now,
    ),
    row(
      `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
       VALUES ('g-1', 'w-a', 'o-1', 'trial', ?)`,
      now,
    ),
    row(
      `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
       VALUES ('h-1', 'w-a', 13, 'Storico', 'admin', ?)`,
      now,
    ),
    row(
      `INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
       VALUES ('w-a', 'store_linked', ?)`,
      now,
    ),
    row(
      `INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
       VALUES ('fc-1', 'w-a', 's-a', 'default', ?)`,
      now,
    ),
    row(
      `INSERT INTO abuse_reviews (signal, outcome, workspace_id, actor, reason, reviewed_at)
       VALUES ('company:sintetico', 'suspended', 'w-a', 'admin', 'Stessa attività', ?)`,
      now,
    ),
    row(
      `INSERT INTO subscription_checkouts (workspace_id, claim, expires_at, created_at)
       VALUES ('w-a', 'richiesta', ?1, ?2)`,
      soon,
      now,
    ),
    row(
      `INSERT INTO webhook_receipts (id, provider, environment, provider_id, topic, object_id,
         store_id, event_at, expires_at)
       VALUES ('r-1', 'ebay', 'production', 'n-1', 'ORDER', 'ordine', 's-a', ?1, ?2)`,
      now,
      soon,
    ),
    row(
      `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at)
       VALUES ('stato-sintetico', ?1, 'verificatore', ?2)`,
      userId,
      soon,
    ),
    row(
      `INSERT INTO user_preferences (user_id, language, updated_at) VALUES (?1, 'it', ?2)
       ON CONFLICT DO NOTHING`,
      userId,
      now,
    ),
    row(
      `INSERT INTO marketing_consents (id, user_id, granted, text_version, language, recorded_at)
       VALUES ('mc-1', ?1, 1, 'sintetica', 'it', ?2)`,
      userId,
      now,
    ),
    row(
      "INSERT INTO notification_reads (user_id, notification_id, read_at) VALUES (?1, 'n-1', ?2)",
      userId,
      now,
    ),
    row(
      `INSERT INTO account_email_changes (user_id, current_email, new_email, stage, expires_at)
       VALUES (?1, 'vecchio@example.invalid', 'nuovo@example.invalid', 'current', ?2)`,
      userId,
      soon,
    ),
    row(
      `INSERT INTO export_configurations (id, user_id, name, format, granularity, columns,
         updated_at) VALUES ('cfg-1', ?1, 'Mia', 'csv', 'order', '["id"]', ?2)`,
      userId,
      now,
    ),
    row(
      `INSERT INTO export_jobs (id, user_id, access_revision, request_sealed, file_name,
         requested_at) VALUES ('00000000-0000-4000-8000-000000000002', ?1, 0, 'x', 'ordini.csv', ?2)`,
      userId,
      now,
    ),
    row("INSERT INTO support_requests (id, user_id, sent_at) VALUES ('sr-1', ?1, ?2)", userId, now),
    row("INSERT INTO unlock_preferences VALUES (?, 0)", userId),
    row(
      `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter",
         "deviceType", "backedUp") VALUES ('pk-1', 'chiave', ?, 'credenziale', 0, 'singleDevice', 0)`,
      userId,
    ),
    row(
      `INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt",
         "updatedAt") VALUES ('v-1', 'reset-password:sintetico', ?1, ?2, ?3, ?3)`,
      userId,
      soon,
      now,
    ),
  ]);
}

/**
 * Righe rimaste per tabella, diverse da zero: ogni tabella dello schema, così una nuova
 * migration è coperta. Le tabelle con una colonna dell'utente Auth contano soltanto le sue
 * righe, perché gli utenti delle altre prove restano; i limiti dei tentativi non hanno utente.
 */
async function remainingRows(userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name NOT IN ('d1_migrations', 'rateLimit')`,
  ).all<{ name: string }>();
  const remaining: Record<string, number> = {};
  for (const { name } of results) {
    const { results: columns } = await env.DB.prepare("SELECT name FROM pragma_table_info(?)")
      .bind(name)
      .all<{ name: string }>();
    const column =
      name === "user"
        ? "id"
        : name === "verification"
          ? "value"
          : columns.find((item) => item.name === "user_id" || item.name === "userId")?.name;
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM "${name}"${column ? ` WHERE "${column}" = ?` : ""}`,
    )
      .bind(...(column ? [userId] : []))
      .first<number>("n");
    if (count) remaining[name] = count;
  }
  return remaining;
}

/** Abbonamento mensile attivo dello spazio, come dopo il primo pagamento. */
function insertSubscription(status = "active") {
  return env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
      customer_id, offer, price_generation, status, current_period_start, current_period_end,
      cancel_at_period_end, synced_at, checked_at, renewal_offer)
    VALUES ('sub_test', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', ?1, ?2,
      '2026-10-13T20:00:00.000Z', 0, ?2, ?2, 'monthly')`).bind(status, now);
}

/** Spazio con negozio, ordini, credenziali, Telegram, prova usata, ciclo con sblocchi e file. */
async function populatedAccount(email: string) {
  const { userId, cookie } = await verifiedSession(email);
  await workspace(userId);
  await env.DB.batch([
    ...insertOrder("o-1"),
    ...insertOrder("o-2"),
    insertCredentials({ accessExpiresAt: "2026-09-14T20:00:00.000Z" }),
    env.DB.prepare(`INSERT INTO telegram_links (workspace_id, id, chat_id, language, linked_at)
      VALUES ('w-a', 'tl-a', '1001', 'it', ?)`).bind(now),
    insertEntitlement({
      source: "trial",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-10T00:00:00.000Z",
    }),
    // Il collegamento del negozio ha fissato l'ancoraggio dei cicli a `now`.
    env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota, used)
      VALUES ('c-a', 'w-a', ?, '2026-09-20T20:00:00.000Z', 5, 2)`).bind(now),
  ]);
  await env.EXPORT_FILES.put("f-a", "contenuto");
  await env.DB.prepare(`INSERT INTO export_files (id, user_id, file_name, content_type,
      access_revision, created_at, expires_at)
    SELECT 'f-a', ?1, 'ordini.csv', 'text/csv', access_revision, ?2, '2026-09-14T20:00:00.000Z'
      FROM workspaces WHERE id = 'w-a'`)
    .bind(userId, now)
    .run();
  return { userId, cookie };
}

/** Email inviate a un indirizzo, dall'invio spiato. */
function sentTo(send: MockInstance<SendEmail["send"]>, email: string) {
  return send.mock.calls
    .map(([message]) => message as { to: string; subject: string; text: string })
    .filter((message) => message.to === email);
}

describe("cancellazione dell'account", () => {
  let send: MockInstance<SendEmail["send"]>;
  let queue: MockInstance<Queue["send"]>;
  let errors: MockInstance<typeof console.error>;
  const signals = () =>
    errors.mock.calls
      .map(([line]) => JSON.parse(String(line)) as { operation?: string; failure?: string })
      .filter((line) => line.operation === "account_deletion");

  beforeEach(async () => {
    await resetDatabase();
    send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    queue = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.setSystemTime(new Date(now));
  });

  it("chiede un accesso recente e l'indirizzo, poi manda il link senza eliminare nulla", async () => {
    const email = `richiesta-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await verifiedSession(email);
    const request = (confirmation: string) =>
      callRoute(settingsAction, privacy, {
        cookie,
        fields: { intent: "account-delete", confirmation },
      });
    // Le Impostazioni sanno se serve una nuova conferma dell'identità.
    const page = await routeData(settingsLoader, privacy, {
      cookie,
      params: { sezione: "privacy" },
    });
    expect(page).toMatchObject({
      page: { services: { accountDeletion: true }, security: { deletionReady: true } },
    });
    expect(await request("altro@example.invalid")).toMatchObject({
      data: { ok: false, notice: "L’indirizzo non corrisponde a quello dell’account." },
      init: { status: 400 },
    });
    // Oltre dieci minuti dall'accesso serve una nuova conferma.
    vi.setSystemTime(later(11));
    expect(await request(email)).toMatchObject({
      data: { ok: false, notice: "Conferma di nuovo la tua identità per eliminare l’account." },
      init: { status: 403 },
    });
    vi.setSystemTime(new Date(now));
    expect(await request(` ${email.toUpperCase()} `)).toEqual({
      ok: true,
      notice: `Ti abbiamo inviato un link a ${email}. Aprilo entro un’ora in questo browser per confermare la cancellazione.`,
    });
    await vi.waitFor(() =>
      expect(sentTo(send, email).some((message) => message.subject.includes("cancellazione"))).toBe(
        true,
      ),
    );
    const message = sentTo(send, email).find((sent) => sent.subject.includes("cancellazione"))!;
    expect(message.subject).toBe("Conferma la cancellazione dell’account FiscalBay");
    expect(message.text).toContain("Il link vale un’ora.");
    expect(emailLink(message.text)).toContain("/api/auth/delete-user/callback?token=");
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 1 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM account_deletions").first()).toEqual({
      n: 0,
    });
    // La richiesta diretta ad Auth salterebbe riautenticazione e conferma.
    const direct = await handleAuthRequest(
      new Request(`${testOrigin}/api/auth/delete-user`, {
        method: "POST",
        headers: { cookie, origin: testOrigin, "content-type": "application/json" },
        body: "{}",
      }),
      env,
    );
    expect(direct.status).toBe(404);
  });

  it("il link ferma accesso, letture e notifiche senza eliminare l'utente e vale una volta", async () => {
    const email = `conferma-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await populatedAccount(email);
    await callRoute(settingsAction, `/en${privacy}`, {
      cookie,
      fields: { intent: "account-delete", confirmation: email },
    });
    await vi.waitFor(() => expect(sentTo(send, email).length).toBeGreaterThan(0));
    const message = sentTo(send, email).find((sent) => sent.subject.includes("deletion"))!;
    expect(message.subject).toBe("Confirm the deletion of your FiscalBay account");
    const link = emailLink(message.text);
    const open = (sessionCookie?: string) =>
      handleAuthRequest(
        new Request(link, { headers: sessionCookie ? { cookie: sessionCookie } : {} }),
        env,
      );
    // Senza la sessione dello stesso utente il link non vale e non viene consumato.
    const anonymous = await open();
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toBe(`${testOrigin}/en/auth/error?error=delete_link`);

    const confirmed = await open(cookie);
    expect(confirmed.status).toBe(302);
    expect(confirmed.headers.get("location")).toBe("/en/cancellazione-account");
    expect(confirmed.headers.getSetCookie().join("\n")).toContain("Max-Age=0");
    // L'utente resta fino all'ultimo passo del lavoro; sessioni, consenso e chat no.
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 0, orders: 2, stores: 1 });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM ebay_store_credentials").first(),
    ).toEqual({ n: 0 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM telegram_links").first()).toEqual({
      n: 0,
    });
    const deletion = await env.DB.prepare(
      "SELECT id, workspace_id, notice_sealed FROM account_deletions WHERE user_id = ?",
    )
      .bind(userId)
      .first<{ id: string; workspace_id: string; notice_sealed: string }>();
    expect(deletion).toMatchObject({ workspace_id: "w-a", notice_sealed: expect.any(String) });
    expect(deletion!.notice_sealed).not.toContain(email);
    expect(queue).toHaveBeenCalledWith({ accountDeletion: deletion!.id });

    // Già usato: anche con una nuova sessione il link è rifiutato.
    expect((await open(cookie)).headers.get("location")).toContain("error=delete_link");
    // Nessun metodo apre più una sessione.
    const signIn = await handleAuthRequest(
      new Request(`${testOrigin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin: testOrigin, "content-type": "application/json" },
        body: JSON.stringify({ email, password: "Una-password-negozio-molto-lunga" }),
      }),
      env,
    );
    expect(signIn.status).toBe(403);
    expect(await signIn.json()).toMatchObject({ code: "account_deletion_in_progress" });
    expect(
      await callRoute(signInAction, "/accesso", {
        fields: { intent: "accedi", email, password: "Una-password-negozio-molto-lunga" },
      }),
    ).toMatchObject({
      data: { notice: { key: "cancellazione-in-corso", tone: "warning" } },
      init: { status: 400 },
    });
  });

  /** Chiede la cancellazione dalle Impostazioni e restituisce il link dell'email. */
  const requestLink = async (cookie: string, email: string) => {
    send.mockClear();
    await callRoute(settingsAction, privacy, {
      cookie,
      fields: { intent: "account-delete", confirmation: email },
    });
    await vi.waitFor(() =>
      expect(sentTo(send, email).some((sent) => sent.subject.includes("cancellazione"))).toBe(true),
    );
    return emailLink(
      sentTo(send, email).find((sent) => sent.subject.includes("cancellazione"))!.text,
    );
  };
  /** Apre il link, eventualmente con un altro metodo o percorso, e restituisce la risposta. */
  const openLink = (
    link: string,
    cookie?: string,
    { method = "GET", path }: { method?: string; path?: string } = {},
  ) => {
    const url = new URL(link);
    if (path) url.pathname = path;
    return handleAuthRequest(new Request(url, { method, headers: cookie ? { cookie } : {} }), env);
  };
  const deletions = async () =>
    (await env.DB.prepare("SELECT COUNT(*) AS n FROM account_deletions").first<number>("n"))!;

  it("verifica l'utente prima di consumare il link: il titolare lo usa ancora", async () => {
    const email = `titolare-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await verifiedSession(email);
    const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
    const link = await requestLink(cookie, email);
    const refused = `${testOrigin}/auth/error?error=delete_link`;
    // Sessione di un altro utente, nessuna sessione, un metodo diverso o il percorso scritto in
    // un altro modo: nessun effetto e il link resta valido.
    const attempts = [
      openLink(link, other.cookie),
      openLink(link),
      openLink(link, cookie, { method: "POST" }),
      openLink(link, other.cookie, { method: "POST" }),
      ...[
        "/api/auth/delete-user/callback/",
        "/api/auth/DELETE-USER/Callback",
        "/api/auth//delete-user//callback",
      ].map((path) => openLink(link, other.cookie, { path })),
    ];
    for (const attempt of attempts) {
      const response = await attempt;
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(refused);
    }
    expect(await deletions()).toBe(0);
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 1 });
    expect(await leftovers(other.userId)).toMatchObject({ user: 1, sessions: 1 });

    const confirmed = await openLink(link, cookie);
    expect(confirmed.status).toBe(302);
    expect(confirmed.headers.get("location")).toBe("/cancellazione-account");
    expect(await deletions()).toBe(1);
    expect(await leftovers(other.userId)).toMatchObject({ user: 1, sessions: 1 });
  });

  it("durante la cancellazione nessun metodo di accesso apre una sessione", async () => {
    const email = `metodi-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const sessions = async () => (await leftovers(userId)).sessions;
    await env.DB.batch([
      ...[
        ["acc-google", "google-metodi", "google"],
        ["acc-ebay", "ebay-metodi", "ebay"],
      ].map(([id, accountId, provider]) =>
        env.DB.prepare(`INSERT INTO "account" ("id", "accountId", "providerId", "userId",
            "createdAt", "updatedAt") VALUES (?1, ?2, ?3, ?4, ?5, ?5)`).bind(
          id,
          accountId,
          provider,
          userId,
          now,
        ),
      ),
      env.DB.prepare(`INSERT INTO account_deletions (id, user_id, requested_at)
        VALUES (?1, ?2, ?3)`).bind(crypto.randomUUID(), userId, now),
    ]);
    // La richiesta registrata chiude subito le sessioni aperte.
    expect(await sessions()).toBe(0);
    const social = async (provider: "google" | "ebay", reply: (url: string) => Response) => {
      const start = await handleAuthRequest(
        new Request(`${testOrigin}/api/auth/sign-in/social`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: testOrigin },
          body: JSON.stringify({ provider, callbackURL: "/" }),
        }),
        env,
      );
      const state = new URL((await start.json<{ url: string }>()).url).searchParams.get("state");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input) =>
          reply(input instanceof Request ? input.url : String(input)),
        );
      try {
        return await handleAuthRequest(
          new Request(`${testOrigin}/api/auth/callback/${provider}?code=synthetic&state=${state}`, {
            headers: { cookie: sessionCookie(start) },
          }),
          env,
        );
      } finally {
        fetchMock.mockRestore();
      }
    };
    // Google.
    const segment = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/u, "");
    const idToken = `${segment({ alg: "none" })}.${segment({
      aud: "google-test-client",
      sub: "google-metodi",
      email,
      email_verified: true,
      name: "Venditore",
    })}.`;
    const google = await social("google", () =>
      Response.json({ access_token: "sintetico", id_token: idToken, token_type: "Bearer" }),
    );
    expect(google.headers.get("location")).toContain("error=account_deletion_in_progress");
    expect(await sessions()).toBe(0);
    // eBay.
    const ebay = await social("ebay", (url) =>
      url.endsWith("/identity/v1/oauth2/token")
        ? Response.json({ access_token: "sintetico", token_type: "Bearer", expires_in: 7200 })
        : Response.json({
            userId: "ebay-metodi",
            username: "venditore",
            businessAccount: { email },
          }),
    );
    expect(ebay.headers.get("location")).toContain("error=account_deletion_in_progress");
    expect(await sessions()).toBe(0);
    // Passkey e ogni altro metodo passano dalla creazione della sessione di Auth.
    const { internalAdapter } = await createAuth(env).$context;
    await expect(internalAdapter.createSession(userId)).rejects.toMatchObject({
      body: { code: "account_deletion_in_progress" },
    });
    expect(await sessions()).toBe(0);

    // Accesso automatico dopo la conferma dell'email di un utente ancora da verificare.
    const pending = `da-verificare-${crypto.randomUUID()}@example.invalid`;
    await handleAuthRequest(
      new Request(`${testOrigin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: testOrigin },
        body: JSON.stringify({
          name: "Venditore",
          email: pending,
          password: "Password-lunga-123!",
        }),
      }),
      env,
    );
    await vi.waitFor(() => expect(sentTo(send, pending).length).toBeGreaterThan(0));
    const unverified = (await env.DB.prepare('SELECT "id" FROM "user" WHERE "email" = ?')
      .bind(pending)
      .first<string>("id"))!;
    await env.DB.prepare(`INSERT INTO account_deletions (id, user_id, requested_at)
        VALUES (?1, ?2, ?3)`)
      .bind(crypto.randomUUID(), unverified, now)
      .run();
    const verified = await handleAuthRequest(
      new Request(emailLink(sentTo(send, pending)[0]!.text)),
      env,
    );
    expect(verified.headers.getSetCookie().join("\n")).not.toContain("session_token=");
    expect((await leftovers(unverified)).sessions).toBe(0);
  });

  it("chi non ha completato la registrazione né verificato l'email si cancella dall'accesso", async () => {
    // Registrazione senza profilo né Termini e senza conferma dell'indirizzo.
    const email = `incompleto-${crypto.randomUUID()}@example.invalid`;
    const password = "Password-incompleta-123!";
    const signUp = (address: string) =>
      handleAuthRequest(
        new Request(`${testOrigin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: testOrigin },
          body: JSON.stringify({ name: "Venditore", email: address, password }),
        }),
        env,
      );
    const signIn = async (address: string) =>
      sessionCookie(
        await handleAuthRequest(
          new Request(`${testOrigin}/api/auth/sign-in/email`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: testOrigin },
            body: JSON.stringify({ email: address, password }),
          }),
          env,
        ),
      );
    await signUp(email);
    const userId = (await env.DB.prepare('SELECT "id" FROM "user" WHERE "email" = ?')
      .bind(email)
      .first<string>("id"))!;
    vi.setSystemTime(later(-30));
    const stale = await signIn(email);
    vi.setSystemTime(at(now));
    // La pagina di completamento offre la cancellazione con i metodi per confermare l'identità.
    expect(await routeData(signInLoader, "/accesso", { cookie: stale })).toMatchObject({
      authenticated: true,
      emailVerified: false,
      needsProfile: true,
      needsAgreement: true,
      deletion: { ready: false, methods: { accounts: { password: true } } },
    });
    const ask = (cookie: string, confirmation = email) =>
      callRoute(signInAction, "/accesso", {
        cookie,
        fields: { intent: "account-delete", confirmation },
      });
    // Un accesso di oltre dieci minuti fa chiede di confermare l'identità; l'indirizzo va scritto.
    expect(await ask(stale)).toMatchObject({
      data: { ok: false, notice: "Conferma di nuovo la tua identità per eliminare l’account." },
      init: { status: 403 },
    });
    const confirmed = (await callRoute(signInAction, "/accesso", {
      cookie: stale,
      fields: { intent: "conferma-accesso", metodo: "password", password },
    })) as { data: { ok: boolean }; init: { headers: Headers } };
    expect(confirmed.data).toEqual({ ok: true });
    const fresh = confirmed.init.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    expect(await ask(fresh, "altro@example.invalid")).toMatchObject({
      data: { ok: false, notice: "L’indirizzo non corrisponde a quello dell’account." },
      init: { status: 400 },
    });
    send.mockClear();
    expect(await ask(fresh, ` ${email.toUpperCase()} `)).toEqual({
      ok: true,
      notice: `Ti abbiamo inviato un link a ${email}. Aprilo entro un’ora in questo browser per confermare la cancellazione.`,
    });
    // Il link arriva anche all'indirizzo non verificato e avvia la cancellazione.
    await vi.waitFor(() =>
      expect(sentTo(send, email).some((sent) => sent.subject.includes("cancellazione"))).toBe(true),
    );
    const link = emailLink(
      sentTo(send, email).find((sent) => sent.subject.includes("cancellazione"))!.text,
    );
    const opened = await openLink(link, fresh);
    expect(opened.status).toBe(302);
    expect(opened.headers.get("location")).toBe("/cancellazione-account");
    expect(await deletions()).toBe(1);
    expect(await leftovers(userId)).toMatchObject({ sessions: 0 });

    // Chi ha completato la registrazione senza verificare l'email la trova nell'avviso della
    // verifica sugli Ordini; con l'email verificata resta nelle Impostazioni.
    const pending = `da-verificare-${crypto.randomUUID()}@example.invalid`;
    await signUp(pending);
    const pendingId = (await env.DB.prepare('SELECT "id" FROM "user" WHERE "email" = ?')
      .bind(pending)
      .first<string>("id"))!;
    await completeRegistration(env.DB, {
      userId: pendingId,
      language: "it",
      now: at(now),
      profile: syntheticProfile,
      agreement: { marketing: false },
    });
    const pendingCookie = await signIn(pending);
    expect(await routeData(ordersLoader, "/app/ordini", { cookie: pendingCookie })).toMatchObject({
      verified: false,
      deletion: { ready: true, currentSession: expect.any(String) },
    });
    const verified = await verifiedSession(`verificato-${crypto.randomUUID()}@example.invalid`);
    expect(await routeData(ordersLoader, "/app/ordini", { cookie: verified.cookie })).toMatchObject(
      { verified: true, deletion: null },
    );
  });

  it("rifiuta il link scaduto senza registrare nulla", async () => {
    const email = `scaduto-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await verifiedSession(email);
    const expired = await requestLink(cookie, email);
    vi.setSystemTime(later(61));
    expect((await openLink(expired, cookie)).headers.get("location")).toBe(
      `${testOrigin}/auth/error?error=delete_link`,
    );
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
    expect(await deletions()).toBe(0);
  });

  it("se la richiesta non si registra invita a riprovare e l'account resta com'era", async () => {
    const email = `fallita-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await verifiedSession(email);
    const link = await requestLink(cookie, email);
    await env.DB.prepare(`CREATE TRIGGER deletion_refused_for_test BEFORE INSERT ON account_deletions
      BEGIN SELECT RAISE(ABORT, 'synthetic_failure'); END`).run();
    const failed = await Promise.resolve(openLink(link, cookie)).finally(() =>
      env.DB.prepare("DROP TRIGGER deletion_refused_for_test").run(),
    );
    expect(failed.status).toBe(303);
    expect(failed.headers.get("location")).toBe(`${testOrigin}/auth/error?error=delete_failed`);
    expect(failed.headers.getSetCookie()).toEqual([]);
    expect(signals()).toHaveLength(1);
    // Nessuna richiesta, sessioni, credenziali e dati intatti: le Impostazioni restano aperte.
    expect(await deletions()).toBe(0);
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 1, profile: 1 });
    expect(
      await routeData(settingsLoader, privacy, { cookie, params: { sezione: "privacy" } }),
    ).toMatchObject({ page: { services: { accountDeletion: true } } });
    // Il link è consumato: anche con una sessione nuova e valida dello stesso utente non vale.
    const signIn = await handleAuthRequest(
      new Request(`${testOrigin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin: testOrigin, "content-type": "application/json" },
        body: JSON.stringify({ email, password: "Una-password-negozio-molto-lunga" }),
      }),
      env,
    );
    expect(signIn.status).toBe(200);
    expect((await openLink(link, sessionCookie(signIn))).headers.get("location")).toBe(
      `${testOrigin}/auth/error?error=delete_link`,
    );
    expect(await deletions()).toBe(0);
    // Un nuovo link funziona.
    const fresh = await requestLink(cookie, email);
    expect((await openLink(fresh, cookie)).status).toBe(302);
    expect(await deletions()).toBe(1);
  });

  it("ferma i rinnovi, lascia i segni dei negozi, elimina tutto e per ultimo l'utente", async () => {
    const email = `lavoro-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
    await everyTable(userId);
    await insertSubscription().run();
    const stripe = stripeAccount();
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    expect(await runAccountDeletion(env, id, stripe.fetcher, at(now))).toBe("done");
    expect(stripe.requests).toEqual([
      "GET /v1/subscriptions/sub_test",
      "DELETE /v1/subscriptions/sub_test",
    ]);
    expect(await leftovers(userId)).toEqual({
      user: 0,
      sessions: 0,
      accounts: 0,
      profile: 0,
      members: 0,
      files: 0,
      workspace: 0,
      stores: 0,
      orders: 0,
      items: 0,
      taxIds: 0,
      cycles: 0,
      coverage: 0,
      subscriptions: 0,
    });
    expect(await env.EXPORT_FILES.get("f-a")).toBeNull();
    // In tutto lo schema restano soltanto il marker, il segno, il posto lifetime senza spazio, il
    // registro della console, il trasferimento verso l'altro spazio, che resta con il negozio, e
    // l'aggregato giornaliero delle letture, senza riferimenti, e l'avviso all'owner della
    // cancellazione, senza spazio.
    expect(await remainingRows(userId)).toEqual({
      sync_daily: 1,
      owner_notifications: 1,
      account_deletions: 1,
      store_identity_marks: 1,
      lifetime_allocations: 1,
      admin_audit: 1,
      store_transfers: 1,
      workspaces: 1,
      ebay_stores: 1,
    });
    expect(
      await env.DB.prepare("SELECT key, workspace_id FROM owner_notifications").first(),
    ).toEqual({ key: `account_deleted:${id}`, workspace_id: null });
    expect(
      await env.DB.prepare("SELECT workspace_id, customer_id FROM lifetime_allocations").first(),
    ).toEqual({ workspace_id: null, customer_id: "cus_lifetime" });
    // Il segno del negozio: soltanto impronta, prova usata e ciclo in corso con i suoi sblocchi.
    expect(await env.DB.prepare("SELECT * FROM store_identity_marks").all()).toMatchObject({
      results: [
        {
          identity_hash: await storeIdentityHash(env.BETTER_AUTH_SECRET, "s-a"),
          trial_used: 1,
          cycle_anchor_at: now,
          cycle_starts_at: now,
          cycle_ends_at: "2026-09-20T20:00:00.000Z",
          cycle_quota: 5,
          cycle_used: 2,
          expires_at: new Date(Date.parse(now) + trialMarkDays * 86_400_000).toISOString(),
        },
      ],
    });
    await vi.waitFor(() =>
      expect(sentTo(send, email).map((message) => message.subject)).toContain(
        "Il tuo account FiscalBay è stato eliminato",
      ),
    );
    const done = await env.DB.prepare(
      "SELECT completed_at, notice_sealed, user_deleted_at FROM account_deletions WHERE id = ?",
    )
      .bind(id)
      .first();
    expect(done).toEqual({ completed_at: now, notice_sealed: null, user_deleted_at: now });

    // Una consegna ripetuta non ripete nulla.
    stripe.requests.length = 0;
    send.mockClear();
    const message = queueMessage({ accountDeletion: id });
    await consumeAccountDeletion(message, env, stripe.fetcher, at(now));
    expect(message.ack).toHaveBeenCalled();
    expect(stripe.requests).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("riprende dopo un errore senza doppi effetti", async () => {
    const email = `ripresa-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
    await insertSubscription().run();
    const stripe = stripeAccount();
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    const remove = vi
      .spyOn(env.EXPORT_FILES, "delete")
      .mockRejectedValueOnce(new Error("r2"))
      .mockRejectedValueOnce(new Error("r2"));
    const failing = queueMessage({ accountDeletion: id }, 2);
    await consumeAccountDeletion(failing, env, stripe.fetcher, at(now));
    expect(failing.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    // Dopo i primi tentativi l'errore passa al compito periodico, entro il limite della coda:
    // nessun messaggio finisce fra quelli non consegnati.
    const exhausted = queueMessage({ accountDeletion: id }, 4);
    await consumeAccountDeletion(exhausted, env, stripe.fetcher, at(now));
    expect(exhausted.ack).toHaveBeenCalled();
    expect(exhausted.retry).not.toHaveBeenCalled();
    // Rinnovi già fermati e ordini eliminati; l'utente resta finché il passo non riesce.
    expect(await leftovers(userId)).toMatchObject({ user: 1, orders: 0, subscriptions: 1 });
    expect(
      await env.DB.prepare(
        "SELECT locked_until, renewals_stopped_at FROM account_deletions",
      ).first(),
    ).toEqual({ locked_until: null, renewals_stopped_at: now });
    remove.mockRestore();
    stripe.requests.length = 0;
    const retried = queueMessage({ accountDeletion: id }, 3);
    await consumeAccountDeletion(retried, env, stripe.fetcher, at(now));
    expect(retried.ack).toHaveBeenCalled();
    expect(stripe.requests).toEqual([]);
    expect(await leftovers(userId)).toMatchObject({ user: 0, workspace: 0 });
    await vi.waitFor(() => expect(sentTo(send, email).length).toBeGreaterThan(0));
    expect(
      sentTo(send, email).filter((message) => message.subject.includes("eliminato")),
    ).toHaveLength(1);
  });

  it("con un altro consumer al lavoro chiude il messaggio e la riprende il compito", async () => {
    const email = `occupato-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    await env.DB.prepare("UPDATE account_deletions SET locked_until = ?")
      .bind(later(5).toISOString())
      .run();
    // Un nuovo tentativo dalla coda arriverebbe prima della fine del blocco e finirebbe fra i
    // messaggi non consegnati: la richiesta resta al compito periodico.
    const message = queueMessage({ accountDeletion: id });
    await consumeAccountDeletion(message, env, fetch, at(now));
    expect(message.ack).toHaveBeenCalled();
    expect(message.retry).not.toHaveBeenCalled();
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
    await resumeAccountDeletions(env, fetch, later(16));
    expect(await leftovers(userId)).toMatchObject({ user: 0 });
    // Un messaggio di una richiesta che non esiste più si chiude.
    const missing = queueMessage({ accountDeletion: crypto.randomUUID() });
    await consumeAccountDeletion(missing, env, fetch, at(now));
    expect(missing.ack).toHaveBeenCalled();
  });

  it("elimina gli ordini a lotti e prosegue con un nuovo messaggio", async () => {
    const email = `lotti-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    await workspace(userId);
    await env.DB.batch(["o-1", "o-2", "o-3", "o-4", "o-5"].flatMap((id) => insertOrder(id)));
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    const budget = { batch: 2, batches: 1 };
    expect(await runAccountDeletion(env, id, fetch, at(now), budget)).toBe("more");
    expect(await leftovers(userId)).toMatchObject({ user: 1, orders: 3 });
    queue.mockClear();
    await consumeAccountDeletion(queueMessage({ accountDeletion: id }), env, fetch, at(now));
    // Con il budget pieno restano zero ordini: il passo si conclude.
    expect(await leftovers(userId)).toMatchObject({ user: 0, orders: 0, workspace: 0 });
  });

  it("elimina oltre mille file entro il limite di R2 e dopo un errore riprende dai rimasti", async () => {
    const email = `file-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
    await env.DB.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n
        WHERE x < 1000)
      INSERT INTO export_files (id, user_id, file_name, content_type, access_revision,
        created_at, expires_at)
      SELECT 'f-' || x, ?1, 'ordini.csv', 'text/csv', 0, ?2, '2026-09-14T20:00:00.000Z' FROM n`)
      .bind(userId, now)
      .run();
    const files = () =>
      env.DB.prepare("SELECT COUNT(*) AS n FROM export_files WHERE user_id = ?")
        .bind(userId)
        .first("n");
    const remove = env.EXPORT_FILES.delete.bind(env.EXPORT_FILES);
    let calls = 0;
    // Il binding R2 rifiuta più di mille chiavi; la seconda richiesta non riesce una volta.
    const limited = vi.spyOn(env.EXPORT_FILES, "delete").mockImplementation(async (keys) => {
      if (Array.isArray(keys) && keys.length > 1000) throw new Error("r2_too_many_keys");
      if (++calls === 2) throw new Error("r2");
      await remove(keys);
    });
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    await expect(runAccountDeletion(env, id, fetch, at(now))).rejects.toThrow("r2");
    // Restano soltanto le righe dei file non ancora eliminati, e l'utente.
    expect(await files()).toBe(501);
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
    await expect(runAccountDeletion(env, id, fetch, later(16))).resolves.toBe("done");
    expect(await files()).toBe(0);
    expect(await leftovers(userId)).toMatchObject({ user: 0 });
    expect(await env.EXPORT_FILES.get("f-a")).toBeNull();
    expect(limited.mock.calls.every(([keys]) => (keys as string[]).length <= 1000)).toBe(true);
  });

  it("senza lo stop dei rinnovi conserva solo spazio e riferimenti, segnala e riprova", async () => {
    const email = `bloccata-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
    await insertSubscription().run();
    const stripe = stripeAccount();
    stripe.state.down = true;
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    const message = queueMessage({ accountDeletion: id });
    await consumeAccountDeletion(message, env, stripe.fetcher, at(now));
    // Il messaggio si chiude: lo riprende il compito periodico, non la coda dei falliti.
    expect(message.ack).toHaveBeenCalled();
    expect(await leftovers(userId)).toMatchObject({
      user: 0,
      profile: 0,
      orders: 0,
      stores: 0,
      cycles: 0,
      coverage: 0,
      workspace: 1,
      subscriptions: 1,
    });
    expect(signals()).toEqual([
      expect.objectContaining({ operation: "account_deletion", failure: "renewals_not_stopped" }),
    ]);
    expect(
      (await listAnomalies(env.DB, later(5))).find(
        (anomaly) => anomaly.kind === "account_deletion",
      ),
    ).toMatchObject({ severity: "p1", count: 1, subjects: [{ label: "w-a", href: "lavori" }] });
    // L'anomalia diventa un incidente dell'owner, avvisato sul bot dell'ambiente.
    await reconcileOwnerIncidents(env, stripe.fetcher, later(5));
    expect(
      await env.DB.prepare(
        "SELECT kind, severity FROM owner_incidents WHERE kind = 'account_deletion'",
      ).all(),
    ).toMatchObject({
      results: [{ kind: "account_deletion", severity: "p1" }],
    });
    expect(sentTo(send, email).filter((sent) => sent.subject.includes("eliminato"))).toEqual([]);

    // Il secondo tentativo non ripete la segnalazione.
    await resumeAccountDeletions(env, stripe.fetcher, later(10));
    expect(signals()).toHaveLength(1);
    // Un pagamento arriva mentre lo spazio resta soltanto per fermare i rinnovi: nessuna
    // copertura rinasce.
    stripe.state.down = false;
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_first" },
      stripe.fetcher,
      later(15),
    );
    expect(await leftovers(userId)).toMatchObject({ workspace: 1, coverage: 0 });
    await resumeAccountDeletions(env, stripe.fetcher, later(20));
    expect(await leftovers(userId)).toMatchObject({ workspace: 0, subscriptions: 0 });
    await vi.waitFor(() =>
      expect(sentTo(send, email).filter((sent) => sent.subject.includes("eliminato"))).toHaveLength(
        1,
      ),
    );
    expect(
      (await listAnomalies(env.DB, later(25))).some(
        (anomaly) => anomaly.kind === "account_deletion",
      ),
    ).toBe(false);
  });

  it("l'email finale non riuscita si ritenta, poi la richiesta si conclude senza", async () => {
    const email = `posta-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    send.mockImplementation(async (message) => {
      if ("to" in message && message.to === email)
        throw Object.assign(new Error("rate"), { code: "E_RATE_LIMIT_EXCEEDED" });
      return { messageId: "synthetic" };
    });
    expect(await runAccountDeletion(env, id, fetch, at(now))).toBe("waiting");
    // Fino al prossimo tentativo la richiesta non riparte.
    expect(await runAccountDeletion(env, id, fetch, later(5))).toBe("busy");
    expect(await runAccountDeletion(env, id, fetch, later(10))).toBe("waiting");
    expect(await runAccountDeletion(env, id, fetch, later(20))).toBe("done");
    expect(
      await env.DB.prepare("SELECT notice_attempts, notice_sealed FROM account_deletions").first(),
    ).toEqual({ notice_attempts: 3, notice_sealed: null });
  });

  it("vecchi lavori, webhook e restore non ricreano i dati", async () => {
    const email = `ricrea-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
    await insertSubscription().run();
    await env.DB.prepare(
      `INSERT INTO export_jobs (id, user_id, access_revision, request_sealed, file_name, requested_at)
       VALUES ('00000000-0000-4000-8000-000000000001', ?, 0, 'x', 'ordini.csv', ?)`,
    )
      .bind(userId, now)
      .run();
    const stripe = stripeAccount();
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    expect(await runAccountDeletion(env, id, stripe.fetcher, at(now))).toBe("done");

    const sync = queueMessage({ syncStore: "s-a" });
    await consumeStoreSync(sync, env, syntheticEbay(), at(now));
    expect(sync.ack).toHaveBeenCalled();
    const exportJob = queueMessage({ exportJob: "00000000-0000-4000-8000-000000000001" });
    await consumeExportJob(exportJob, env, at(now));
    expect(exportJob.ack).toHaveBeenCalled();
    // Un pagamento dell'abbonamento chiuso arriva dopo: lo spazio non esiste più.
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_first" },
      stripe.fetcher,
      at(now),
    );
    expect(await leftovers(userId)).toMatchObject({
      user: 0,
      workspace: 0,
      stores: 0,
      orders: 0,
      coverage: 0,
      subscriptions: 0,
    });

    // Restore a prima della richiesta: utente, sessione, spazio, negozio e ordini ricompaiono
    // senza il marker, che l'operatore riapplica subito dopo.
    send.mockClear();
    const marker = (await env.DB.prepare("SELECT * FROM account_deletions WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>())!;
    const session = env.DB.prepare(`INSERT INTO "session" ("id", "token", "userId", "expiresAt",
        "createdAt", "updatedAt") VALUES (?1, ?1, ?2, ?3, ?4, ?4)`);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM account_deletions WHERE id = ?").bind(id),
      env.DB.prepare(`INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt",
          "updatedAt") VALUES (?1, 'Venditore', ?2, 1, ?3, ?3)`).bind(userId, email, now),
      session.bind("s-restore", userId, "2026-09-20T00:00:00.000Z", now),
    ]);
    await workspace(userId);
    await env.DB.batch([...insertOrder("o-1"), insertSubscription("canceled")]);
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 1 });
    const columns = Object.keys(marker);
    await env.DB.prepare(
      `INSERT INTO account_deletions (${columns.join(", ")})
       VALUES (${columns.map(() => "?").join(", ")})`,
    )
      .bind(...Object.values(marker))
      .run();
    // Il marker riapplicato chiude subito le sessioni ripristinate, prima del lavoro, e nessuna
    // nuova sessione nasce finché la richiesta esiste.
    expect(await leftovers(userId)).toMatchObject({ user: 1, sessions: 0 });
    await expect(
      session.bind("s-nuova", userId, "2026-09-20T00:00:00.000Z", now).run(),
    ).rejects.toThrow("account_deletion_in_progress");
    stripe.state.subscription.status = "canceled";
    await resumeAccountDeletions(env, stripe.fetcher, later(10));
    expect(await leftovers(userId)).toMatchObject({
      user: 0,
      sessions: 0,
      workspace: 0,
      orders: 0,
      subscriptions: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare("SELECT completed_at FROM account_deletions WHERE id = ?")
        .bind(id)
        .first(),
    ).toEqual({ completed_at: later(10).toISOString() });
  });

  it("lo stesso negozio in un nuovo account non riceve una nuova prova né la quota azzerata", async () => {
    const link = async (userId: string) => {
      const authorize = await beginLink(env, userId);
      const state = new URL(authorize).searchParams.get("state")!;
      const claimed = await claimStoreLinkSession(env.DB, state);
      if (claimed?.kind !== "new") throw new Error("missing_link");
      return completeStoreLink({
        env,
        link: claimed,
        sessionUserId: userId,
        search: new URLSearchParams({ state, code: "sintetico" }),
        fetcher: syntheticEbay({ orders: [] }),
        now: at(now),
      });
    };
    const first = `primo-${crypto.randomUUID()}@example.invalid`;
    const owner = await verifiedSession(first);
    expect(await link(owner.userId)).toBe("collegato");
    const allowance = (await orderAllowance(env.DB, owner.userId, at(now)))!;
    expect(allowance.trialAvailable).toBe(true);
    await env.DB.batch([
      insertEntitlement({
        workspaceId: allowance.workspaceId,
        source: "trial",
        startsAt: now,
        endsAt: "2026-09-27T20:00:00.000Z",
      }),
      env.DB.prepare("UPDATE free_cycles SET used = 2 WHERE id = ?").bind(allowance.cycle!.id),
    ]);
    const id = await startAccountDeletion(env, { id: owner.userId, email: first }, "it", at(now));
    expect(await runAccountDeletion(env, id, fetch, at(now))).toBe("done");

    // Il giorno dopo un nuovo account collega lo stesso negozio eBay.
    const nextDay = at("2026-09-14T20:00:00.000Z");
    vi.setSystemTime(nextDay);
    const second = await verifiedSession(`secondo-${crypto.randomUUID()}@example.invalid`);
    await env.DB.prepare(
      "UPDATE ebay_store_link_sessions SET expires_at = '2026-09-15T00:00:00.000Z'",
    ).run();
    const authorize = await beginLink(env, second.userId);
    const state = new URL(authorize).searchParams.get("state")!;
    const claimed = await claimStoreLinkSession(env.DB, state);
    if (claimed?.kind !== "new") throw new Error("missing_link");
    expect(
      await completeStoreLink({
        env,
        link: claimed,
        sessionUserId: second.userId,
        search: new URLSearchParams({ state, code: "sintetico" }),
        fetcher: syntheticEbay({ orders: [] }),
        now: nextDay,
      }),
    ).toBe("collegato");
    const inherited = (await orderAllowance(env.DB, second.userId, nextDay))!;
    expect(inherited.trialAvailable).toBe(false);
    expect(inherited.cycle).toMatchObject({
      used: 2,
      quota: allowance.cycle!.quota,
      ends_at: allowance.cycle!.ends_at,
    });
    expect(inherited.remaining).toBe(allowance.cycle!.quota - 2);

    // Scaduto il segno, la pulizia giornaliera lo elimina.
    await purgeExpiredRecords(env.DB, new Date(Date.parse(now) + (trialMarkDays + 1) * 86_400_000));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM store_identity_marks").first()).toEqual({
      n: 0,
    });
  });

  /** Collega allo spazio dell'utente l'account eBay indicato, con il consenso sintetico. */
  const linkEbay = async (
    userId: string,
    ebayUserId: string,
    when: Date,
    ebayEnvironment: "production" | "sandbox" = "production",
  ) => {
    // La Sandbox, disponibile soltanto sul test, con le sue credenziali sintetiche.
    const environment = {
      ...env,
      EBAY_SANDBOX_ENABLED: "true",
      EBAY_SANDBOX_CLIENT_ID: "client",
      EBAY_SANDBOX_CLIENT_SECRET: "secret",
      EBAY_SANDBOX_RUNAME: "runame",
    } as unknown as Env;
    const authorize = await beginLink(environment, userId, when, "it", ebayEnvironment);
    const state = new URL(authorize).searchParams.get("state")!;
    const claimed = await claimStoreLinkSession(env.DB, state, when);
    if (claimed?.kind !== "new") throw new Error("missing_link");
    return completeStoreLink({
      env: environment,
      link: claimed,
      sessionUserId: userId,
      search: new URLSearchParams({ state, code: "sintetico" }),
      fetcher: syntheticEbay({ orders: [], userId: ebayUserId }),
      now: when,
    });
  };
  /** Cancella subito l'account dell'utente, con il lavoro concluso. */
  const deleteAccount = async (user: { userId: string }, email: string, when = at(now)) => {
    const id = await startAccountDeletion(env, { id: user.userId, email }, "it", when);
    expect(await runAccountDeletion(env, id, fetch, when)).toBe("done");
  };

  it("il cliente che torna riprende lo stesso posto lifetime, senza dati né prova", async () => {
    const first = `lifetime-${crypto.randomUUID()}@example.invalid`;
    const owner = await verifiedSession(first);
    expect(await linkEbay(owner.userId, "seller-lifetime", at(now))).toBe("collegato");
    const space = (await orderAllowance(env.DB, owner.userId, at(now)))!.workspaceId;
    const storeId = (await env.DB.prepare("SELECT id FROM ebay_stores WHERE workspace_id = ?")
      .bind(space)
      .first<string>("id"))!;
    await env.DB.batch([
      insertEntitlement({ workspaceId: space, source: "trial", endsAt: later(60).toISOString() }),
      ...insertOrder("o-lifetime", storeId),
      env.DB.prepare(
        `INSERT INTO lifetime_allocations (slot, workspace_id, status, provider_reference,
           created_at, activated_at, customer_id)
         VALUES (1, ?2, 'active', 'cs_lifetime', ?1, ?1, 'cus_lifetime')`,
      ).bind(now, space),
      insertEntitlement({
        workspaceId: space,
        source: "lifetime",
        startsAt: later(1).toISOString(),
        stripeCheckoutSessionId: "cs_lifetime",
      }),
    ]);
    await deleteAccount(owner, first, later(2));
    // Il posto venduto resta occupato, senza spazio e con i riferimenti della vendita.
    expect(await vacantLifetimeSeats(env.DB)).toEqual([
      { slot: 1, kind: "sale", customerId: "cus_lifetime", activatedAt: now },
    ]);

    // L'assistenza riconosce il cliente in un nuovo account e gli restituisce il suo posto.
    const second = await verifiedSession(`ritorno-${crypto.randomUUID()}@example.invalid`);
    expect(await linkEbay(second.userId, "seller-lifetime", later(3))).toBe("collegato");
    const returning = (await orderAllowance(env.DB, second.userId, later(3)))!;
    const input = {
      workspaceId: returning.workspaceId,
      author: "owner",
      reason: "Cliente tornato dopo la cancellazione",
    };
    // Un posto inesistente o di nessuno spazio cancellato non si riprende.
    expect(await grantLifetimeConcession(env, { ...input, slot: 2 }, later(4))).toBe(
      "seat-unavailable",
    );
    expect(await grantLifetimeConcession(env, { ...input, slot: 0 }, later(4))).toBe("invalid");
    expect(
      await grantLifetimeConcession(env, { ...input, workspaceId: "w-none", slot: 1 }, later(4)),
    ).toBe("not_found");
    expect(await grantLifetimeConcession(env, { ...input, slot: 1 }, later(4))).toBe("done");
    // Ripetuta, non cambia nulla: il posto ha di nuovo uno spazio.
    expect(await grantLifetimeConcession(env, { ...input, slot: 1 }, later(5))).toBe(
      "seat-unavailable",
    );
    const after = (await orderAllowance(env.DB, second.userId, later(5)))!;
    expect(after.trialAvailable).toBe(false);
    expect(after.premium).toBe(true);
    // Stesso posto, con la vendita originale: rimborsi e dispute lo revocano ancora.
    expect(
      await env.DB.prepare(`SELECT a.slot, a.workspace_id, a.customer_id, e.stripe_checkout_session_id,
          e.granted_by, e.grant_reason FROM lifetime_allocations a
          JOIN workspace_entitlements e ON e.workspace_id = a.workspace_id AND e.source = 'lifetime'`).all(),
    ).toMatchObject({
      results: [
        {
          slot: 1,
          workspace_id: returning.workspaceId,
          customer_id: "cus_lifetime",
          stripe_checkout_session_id: "cs_lifetime",
          granted_by: "owner",
          grant_reason: "Cliente tornato dopo la cancellazione",
        },
      ],
    });
    // Nessun ordine, sblocco o prova dello spazio cancellato torna nel nuovo.
    expect(
      await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM orders) AS orders,
          (SELECT COUNT(*) FROM order_grants) AS grants,
          (SELECT COUNT(*) FROM workspace_entitlements WHERE source = 'trial') AS trials,
          (SELECT COUNT(*) FROM lifetime_allocations) AS seats`).first(),
    ).toEqual({ orders: 0, grants: 0, trials: 0, seats: 1 });
    expect(await vacantLifetimeSeats(env.DB)).toEqual([]);
    // Lo spazio di un posto assegnato non cambia più se non con una nuova cancellazione.
    await expect(
      env.DB.prepare("UPDATE lifetime_allocations SET workspace_id = 'w-a' WHERE slot = 1").run(),
    ).rejects.toThrow(/immutable_lifetime_allocation/);
  });

  it("i segni di più negozi valgono anche dopo un altro negozio, con la stessa regola", async () => {
    // Uno spazio con due negozi, la prova usata e due sblocchi nel ciclo.
    const firstEmail = `segni-${crypto.randomUUID()}@example.invalid`;
    const first = await verifiedSession(firstEmail);
    expect(await linkEbay(first.userId, "ebay-uno", at(now))).toBe("collegato");
    expect(await linkEbay(first.userId, "ebay-due", at(now))).toBe("collegato");
    const origin = (await orderAllowance(env.DB, first.userId, at(now)))!;
    await env.DB.batch([
      insertEntitlement({
        workspaceId: origin.workspaceId,
        source: "trial",
        startsAt: now,
        endsAt: "2026-09-27T20:00:00.000Z",
      }),
      env.DB.prepare("UPDATE free_cycles SET used = 2 WHERE id = ?").bind(origin.cycle!.id),
    ]);
    await deleteAccount(first, firstEmail);
    // Uno spazio Sandbox senza prova, con un solo sblocco: il suo segno ha soltanto il ciclo.
    const sandboxEmail = `ciclo-${crypto.randomUUID()}@example.invalid`;
    const sandbox = await verifiedSession(sandboxEmail);
    expect(await linkEbay(sandbox.userId, "ebay-tre", later(1), "sandbox")).toBe("collegato");
    const cycleOnly = (await orderAllowance(env.DB, sandbox.userId, later(1)))!;
    await env.DB.prepare("UPDATE free_cycles SET used = 1 WHERE id = ?")
      .bind(cycleOnly.cycle!.id)
      .run();
    await deleteAccount(sandbox, sandboxEmail, later(1));
    const sandboxIdentity = JSON.stringify(["sandbox", "ebay-tre"]);
    const marks = await env.DB.prepare(
      "SELECT identity_hash, trial_used, cycle_used, expires_at FROM store_identity_marks",
    ).all<{ identity_hash: string; trial_used: number; cycle_used: number; expires_at: string }>();
    const hash = (identity: string) => storeIdentityHash(env.BETTER_AUTH_SECRET, identity);
    expect(marks.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identity_hash: await hash("ebay-uno"), trial_used: 1 }),
        expect.objectContaining({ identity_hash: await hash("ebay-due"), trial_used: 1 }),
        expect.objectContaining({
          identity_hash: await hash(sandboxIdentity),
          trial_used: 0,
          cycle_used: 1,
          expires_at: cycleOnly.cycle!.ends_at,
        }),
      ]),
    );
    expect(marks.results).toHaveLength(3);
    // L'impronta richiede la chiave del server: lo SHA-256 dell'identificativo non la ritrova.
    const plain = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ebay-uno"))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    expect(marks.results.map((mark) => mark.identity_hash)).not.toContain(plain);
    expect(await hash("ebay-uno")).not.toBe(await storeIdentityHash("altro-segreto", "ebay-uno"));

    // Il giorno dopo un nuovo spazio collega prima un altro negozio, inizia la prova e usa uno
    // sblocco del proprio ciclo.
    const nextDay = at("2026-09-14T20:00:00.000Z");
    const second = await verifiedSession(`nuovo-${crypto.randomUUID()}@example.invalid`);
    expect(await linkEbay(second.userId, "ebay-nuovo", nextDay)).toBe("collegato");
    const fresh = (await orderAllowance(env.DB, second.userId, nextDay))!;
    await env.DB.batch([
      insertEntitlement({
        workspaceId: fresh.workspaceId,
        source: "trial",
        startsAt: nextDay.toISOString(),
        endsAt: "2026-09-28T20:00:00.000Z",
      }),
      env.DB.prepare("UPDATE free_cycles SET used = 1 WHERE id = ?").bind(fresh.cycle!.id),
    ]);
    expect((await orderAllowance(env.DB, second.userId, nextDay))!.coverage).toMatchObject({
      source: "trial",
    });
    // Il negozio con la prova usata: la prova in corso termina subito e gli sblocchi del ciclo
    // del segno si aggiungono al ciclo in corso dello spazio.
    const linkedAt = at("2026-09-14T21:00:00.000Z");
    expect(await linkEbay(second.userId, "ebay-uno", linkedAt)).toBe("collegato");
    const ended = (await orderAllowance(env.DB, second.userId, linkedAt))!;
    expect(ended).toMatchObject({ premium: false, coverage: null, trialAvailable: false });
    expect(ended.cycle).toMatchObject({ id: fresh.cycle!.id, used: 3 });
    // Il secondo negozio dello stesso spazio cancellato porta lo stesso ciclo: non si somma.
    expect(await linkEbay(second.userId, "ebay-due", linkedAt)).toBe("collegato");
    expect((await orderAllowance(env.DB, second.userId, linkedAt))!.cycle).toMatchObject({
      used: 3,
    });
    // Il segno con il solo ciclo aggiunge il suo sblocco; ricollegato, nulla cambia.
    expect(await linkEbay(second.userId, "ebay-tre", linkedAt, "sandbox")).toBe("collegato");
    expect(await linkEbay(second.userId, "ebay-uno", linkedAt)).toBe("collegato");
    expect((await orderAllowance(env.DB, second.userId, linkedAt))!.cycle).toMatchObject({
      used: 4,
    });

    // Alla fine del ciclo del segno la pulizia elimina il ciclo e il segno che aveva solo
    // quello; la prova usata resta due anni.
    await purgeExpiredRecords(env.DB, at(cycleOnly.cycle!.ends_at));
    expect(
      (
        await env.DB.prepare(
          `SELECT trial_used, cycle_anchor_at, cycle_starts_at, cycle_ends_at, cycle_quota,
            cycle_used FROM store_identity_marks`,
        ).all()
      ).results,
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        trial_used: 1,
        cycle_anchor_at: null,
        cycle_starts_at: null,
        cycle_ends_at: null,
        cycle_quota: null,
        cycle_used: null,
      })),
    );
  });

  it("il segno riprende soltanto un ciclo aperto e ancorato, con la sua quota", async () => {
    const day = 86_400_000;
    const shift = (ms: number) => new Date(Date.parse(now) + ms).toISOString();
    const record = async (identity: string, trialUsed: number, cycle: Partial<Cycle> | null) =>
      env.DB.prepare(
        `INSERT INTO store_identity_marks (identity_hash, trial_used, cycle_anchor_at,
          cycle_starts_at, cycle_ends_at, cycle_quota, cycle_used, recorded_at, expires_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
        .bind(
          await storeIdentityHash(env.BETTER_AUTH_SECRET, identity),
          trialUsed,
          cycle?.anchor ?? null,
          cycle?.startsAt ?? null,
          cycle?.endsAt ?? null,
          cycle?.quota ?? null,
          cycle?.used ?? null,
          shift(-day),
          shift(trialMarkDays * day),
        )
        .run();
    type Cycle = { anchor: string; startsAt: string; endsAt: string; quota: number; used: number };
    const open: Cycle = {
      anchor: shift(-10 * day),
      startsAt: shift(-3 * day),
      endsAt: shift(4 * day),
      quota: 50,
      used: 3,
    };
    await record("aperto", 0, open);
    // Concluso proprio ora, senza ancoraggio o con la sola prova: nessun ciclo da riprendere.
    await record("concluso", 1, { ...open, startsAt: shift(-7 * day), endsAt: now });
    await record("senza-ancoraggio", 0, { ...open, anchor: undefined });
    await record("prova", 1, null);
    const read = (identity: string) =>
      readStoreMark(env.DB, env.BETTER_AUTH_SECRET, identity, at(now));
    const mark = await read("aperto");
    expect(mark).toEqual({ trialUsed: false, cycle: open });
    expect(await read("concluso")).toEqual({ trialUsed: true, cycle: null });
    expect(await read("senza-ancoraggio")).toEqual({ trialUsed: false, cycle: null });
    const trialOnly = await read("prova");
    expect(trialOnly).toEqual({ trialUsed: true, cycle: null });

    const anchored = (id: string, anchor: string | null) =>
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at, free_cycle_anchor_at) VALUES (?, 'S', ?, ?)",
      ).bind(id, shift(-20 * day), anchor);
    await env.DB.batch([
      anchored("w-stesso", open.anchor),
      anchored("w-altro", shift(-day)),
      anchored("w-nuovo", null),
      insertEntitlement({
        workspaceId: "w-nuovo",
        source: "trial",
        startsAt: shift(-day),
        endsAt: shift(6 * day),
      }),
      insertEntitlement({
        workspaceId: "w-stesso",
        source: "trial",
        startsAt: shift(-30 * day),
        endsAt: shift(-16 * day),
      }),
    ]);
    const cycles = (workspace: string) =>
      env.DB.prepare(
        "SELECT starts_at, ends_at, quota, used FROM free_cycles WHERE workspace_id = ?",
      )
        .bind(workspace)
        .all()
        .then(({ results }) => results);
    // Lo spazio con lo stesso ancoraggio riprende il ciclo del segno con la sua quota; un altro
    // ancoraggio crea il ciclo in corso con la quota base e vi aggiunge gli sblocchi.
    await applyStoreMark(env.DB, "w-stesso", mark!, at(now));
    await applyStoreMark(env.DB, "w-altro", mark!, at(now));
    await applyStoreMark(env.DB, "w-nuovo", mark!, at(now));
    expect(await cycles("w-stesso")).toEqual([
      { starts_at: open.startsAt, ends_at: open.endsAt, quota: 50, used: 3 },
    ]);
    expect(await cycles("w-altro")).toEqual([
      { starts_at: shift(-day), ends_at: shift(6 * day), quota: 5, used: 3 },
    ]);
    // Senza ancoraggio non c'è un ciclo da toccare; la sola prova chiude quella in corso, non
    // una già conclusa.
    expect(await cycles("w-nuovo")).toEqual([]);
    await applyStoreMark(env.DB, "w-nuovo", trialOnly!, at(now));
    await applyStoreMark(env.DB, "w-stesso", trialOnly!, at(now));
    expect(await cycles("w-nuovo")).toEqual([]);
    expect(
      (
        await env.DB.prepare(
          "SELECT ends_at, revoked_at FROM workspace_entitlements WHERE source = 'trial' ORDER BY starts_at",
        ).all()
      ).results,
    ).toEqual([
      { ends_at: shift(-16 * day), revoked_at: null },
      { ends_at: shift(6 * day), revoked_at: now },
    ]);
  });

  it("la pulizia elimina le richieste concluse dopo la finestra di Time Travel", async () => {
    const email = `marker-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    expect(await runAccountDeletion(env, id, fetch, at(now))).toBe("done");
    await purgeExpiredRecords(env.DB, new Date(Date.parse(now) + 29 * 86_400_000));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM account_deletions").first()).toEqual({
      n: 1,
    });
    await purgeExpiredRecords(env.DB, new Date(Date.parse(now) + 31 * 86_400_000));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM account_deletions").first()).toEqual({
      n: 0,
    });
  });

  it("il compito fa avanzare le richieste nuove anche dietro dieci richieste bloccate", async () => {
    // Dieci richieste ferme su Stripe, più vecchie della nuova.
    const blocked = Array.from({ length: 10 }, (_, index) => ({
      id: crypto.randomUUID(),
      workspace: `w-bloccato-${index}`,
    }));
    await env.DB.batch(
      blocked.flatMap(({ id, workspace }, index) => [
        ...insertWorkspace({ id: workspace }),
        env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
            customer_id, offer, price_generation, status, current_period_start,
            current_period_end, cancel_at_period_end, synced_at, checked_at)
          VALUES (?1, ?2, 'test', ?3, 'monthly', '2026-09', 'active', ?4,
            '2026-10-13T20:00:00.000Z', 0, ?4, ?4)`).bind(
          `sub_bloccato_${index}`,
          workspace,
          `cus_bloccato_${index}`,
          now,
        ),
        env.DB.prepare(`INSERT INTO account_deletions (id, user_id, workspace_id, requested_at)
          VALUES (?1, ?2, ?3, ?4)`).bind(id, `utente-bloccato-${index}`, workspace, now),
      ]),
    );
    const stripe = stripeAccount();
    stripe.state.down = true;
    const email = `dietro-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    vi.setSystemTime(later(1));
    await startAccountDeletion(
      { ...env, WORK_QUEUE: fakeQueue({ send: vi.fn().mockRejectedValue(new Error("queue")) }) },
      { id: userId, email },
      "it",
      later(1),
    );
    // Il primo giro prova le dieci più vecchie, che restano in attesa del prossimo tentativo.
    await resumeAccountDeletions(env, stripe.fetcher, later(2));
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
    const waiting = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM account_deletions WHERE renewals_blocked_at IS NOT NULL AND locked_until > ?",
    )
      .bind(later(2).toISOString())
      .first<number>("n");
    expect(waiting).toBe(10);
    // Il giro seguente riprende la nuova: le bloccate attendono il loro turno.
    await resumeAccountDeletions(env, stripe.fetcher, later(4));
    expect(await leftovers(userId)).toMatchObject({ user: 0 });
    // Le attese crescono con l'età della richiesta, fino a sei ore.
    await resumeAccountDeletions(env, stripe.fetcher, later(12));
    const next = await env.DB.prepare(
      "SELECT DISTINCT locked_until FROM account_deletions WHERE completed_at IS NULL",
    ).all<{ locked_until: string }>();
    expect(next.results).toEqual([{ locked_until: later(24).toISOString() }]);
    await resumeAccountDeletions(env, stripe.fetcher, later(30 * 24 * 60));
    expect(
      await env.DB.prepare(
        "SELECT DISTINCT locked_until FROM account_deletions WHERE completed_at IS NULL",
      ).all(),
    ).toMatchObject({ results: [{ locked_until: later(30 * 24 * 60 + 360).toISOString() }] });
  });

  it("un errore su una richiesta non ferma le altre del compito", async () => {
    const emails = [0, 1].map((index) => `errore-${index}-${crypto.randomUUID()}@example.invalid`);
    const users = await Promise.all(emails.map(verifiedSession));
    const failing = await startAccountDeletion(
      env,
      { id: users[0]!.userId, email: emails[0]! },
      "it",
      at(now),
    );
    await startAccountDeletion(env, { id: users[1]!.userId, email: emails[1]! }, "it", later(1));
    // La prima richiesta ha un file che il bucket non riesce a eliminare.
    await env.DB.prepare(`INSERT INTO export_files (id, user_id, file_name, content_type,
        access_revision, created_at, expires_at) VALUES ('f-errore', ?1, 'ordini.csv', 'text/csv',
        0, ?2, '2026-09-14T20:00:00.000Z')`)
      .bind(users[0]!.userId, now)
      .run();
    vi.spyOn(env.EXPORT_FILES, "delete").mockRejectedValue(new Error("r2"));
    await resumeAccountDeletions(env, fetch, later(2));
    expect(await leftovers(users[1]!.userId)).toMatchObject({ user: 0 });
    expect(await leftovers(users[0]!.userId)).toMatchObject({ user: 1 });
    expect(signals()).toEqual([expect.objectContaining({ operation: "account_deletion" })]);
    // La richiesta con l'errore attende il prossimo tentativo invece di restare in testa.
    expect(
      await env.DB.prepare("SELECT locked_until FROM account_deletions WHERE id = ?")
        .bind(failing)
        .first<string>("locked_until"),
    ).toBe(later(12).toISOString());
  });

  it("una richiesta registrata senza messaggio riparte dal compito periodico", async () => {
    const email = `persa-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const id = await startAccountDeletion(
      { ...env, WORK_QUEUE: fakeQueue({ send: vi.fn().mockRejectedValue(new Error("queue")) }) },
      { id: userId, email },
      "it",
      at(now),
    );
    expect(signals()).toEqual([expect.objectContaining({ operation: "account_deletion" })]);
    // Una seconda conferma ritrova la stessa richiesta.
    expect(await startAccountDeletion(env, { id: userId, email }, "it", at(now))).toBe(id);
    await resumeAccountDeletions(env, fetch, later(10));
    expect(await leftovers(userId)).toMatchObject({ user: 0 });
  });
});
