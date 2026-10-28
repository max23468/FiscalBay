import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { handleAuthRequest } from "../app/auth-route.server";
import {
  consumeAccountDeletion,
  resumeAccountDeletions,
  runAccountDeletion,
  startAccountDeletion,
  storeIdentityHash,
  trialMarkDays,
} from "../app/domain/account-deletion.server";
import { listAnomalies } from "../app/domain/admin-operations.server";
import { reconcileOwnerIncidents } from "../app/domain/owner-incidents.server";
import { applyStripeEvent } from "../app/domain/billing.server";
import { consumeExportJob } from "../app/domain/export-jobs.server";
import { orderAllowance } from "../app/domain/grants.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { consumeStoreSync } from "../app/domain/order-sync.server";
import { completeStoreLink } from "../app/domain/store-link.server";
import {
  claimStoreLinkSession,
  startStoreLink as beginLink,
} from "../app/integrations/ebay/store-link.server";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { action as signInAction } from "../app/routes/sign-in";
import { emailLink, verifiedSession } from "./fixtures/account-fixtures";
import {
  insertCredentials,
  insertEntitlement,
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

  it("rifiuta il link aperto da un altro utente o scaduto", async () => {
    const email = `scaduto-${crypto.randomUUID()}@example.invalid`;
    const { userId, cookie } = await verifiedSession(email);
    const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
    const requestLink = async () => {
      send.mockClear();
      await callRoute(settingsAction, privacy, {
        cookie,
        fields: { intent: "account-delete", confirmation: email },
      });
      await vi.waitFor(() =>
        expect(sentTo(send, email).some((sent) => sent.subject.includes("cancellazione"))).toBe(
          true,
        ),
      );
      return emailLink(
        sentTo(send, email).find((sent) => sent.subject.includes("cancellazione"))!.text,
      );
    };
    const open = async (link: string, sessionCookie: string) =>
      (
        await handleAuthRequest(new Request(link, { headers: { cookie: sessionCookie } }), env)
      ).headers.get("location");
    // Con la sessione di un altro utente il link si consuma senza effetti.
    expect(await open(await requestLink(), other.cookie)).toBe(
      `${testOrigin}/auth/error?error=delete_link`,
    );
    const expired = await requestLink();
    vi.setSystemTime(later(61));
    expect(await open(expired, cookie)).toBe(`${testOrigin}/auth/error?error=delete_link`);
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
    expect(await leftovers(other.userId)).toMatchObject({ user: 1 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM account_deletions").first()).toEqual({
      n: 0,
    });
  });

  it("ferma i rinnovi, lascia i segni dei negozi, elimina tutto e per ultimo l'utente", async () => {
    const email = `lavoro-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await populatedAccount(email);
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
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM deleted_order_keys").first()).toEqual({
      n: 0,
    });
    // Il segno del negozio: soltanto impronta, prova usata e ciclo in corso con i suoi sblocchi.
    expect(await env.DB.prepare("SELECT * FROM store_identity_marks").all()).toMatchObject({
      results: [
        {
          identity_hash: await storeIdentityHash("s-a"),
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
    const remove = vi.spyOn(env.EXPORT_FILES, "delete").mockRejectedValueOnce(new Error("r2"));
    const failing = queueMessage({ accountDeletion: id }, 2);
    await consumeAccountDeletion(failing, env, stripe.fetcher, at(now));
    expect(failing.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
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

  it("con un altro consumer al lavoro riprova più tardi", async () => {
    const email = `occupato-${crypto.randomUUID()}@example.invalid`;
    const { userId } = await verifiedSession(email);
    const id = await startAccountDeletion(env, { id: userId, email }, "it", at(now));
    await env.DB.prepare("UPDATE account_deletions SET locked_until = ?")
      .bind(later(5).toISOString())
      .run();
    const message = queueMessage({ accountDeletion: id });
    await consumeAccountDeletion(message, env, fetch, at(now));
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(await leftovers(userId)).toMatchObject({ user: 1 });
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
    stripe.state.down = false;
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
    expect(await runAccountDeletion(env, id, fetch, at(now))).toBe("waiting");
    expect(await runAccountDeletion(env, id, fetch, at(now))).toBe("done");
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

    // Restore: utente, spazio, negozio e ordini ricompaiono con il marker riapplicato.
    send.mockClear();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt",
          "updatedAt") VALUES (?1, 'Venditore', ?2, 1, ?3, ?3)`).bind(userId, email, now),
      env.DB.prepare(`INSERT INTO "session" ("id", "token", "userId", "expiresAt", "createdAt",
          "updatedAt") VALUES ('s-restore', 'token-restore', ?1, ?2, ?3, ?3)`).bind(
        userId,
        "2026-09-20T00:00:00.000Z",
        now,
      ),
    ]);
    await workspace(userId);
    await env.DB.batch([...insertOrder("o-1"), insertSubscription("canceled")]);
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
