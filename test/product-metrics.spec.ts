import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import {
  metricWindowFrom,
  productMetrics,
  syncDailyRetentionDays,
} from "../app/domain/product-metrics.server";
import { issueTimingTicket, redeemTimingTicket } from "../app/page-timing.server";
import { action as pageTiming } from "../app/routes/page-timing";
import { loader as adminLoader } from "../app/routes/admin";
import { verifiedSession } from "./fixtures/account-fixtures";
import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertStorePause,
  insertWorkspace,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { routeData, routeResponse } from "./fixtures/route-fixtures";

/**
 * Le coorti stanno in un anno in cui nessun'altra prova crea utenti: il reset non li elimina,
 * quindi una finestra del 2031 contiene soltanto quelli creati qui.
 */
const clock = "2031-03-31T12:00:00.000Z";
const before = (days: number, hours = 0) =>
  new Date(Date.parse(clock) - days * 86_400_000 - hours * 3_600_000).toISOString();
const future = "2031-12-31T00:00:00.000Z";

beforeEach(async () => {
  await resetDatabase();
  await env.DB.prepare(`DELETE FROM "user" WHERE id LIKE 'kpi-u-%'`).run();
  vi.setSystemTime(new Date(clock));
});
afterEach(() => vi.restoreAllMocks());

let users = 0;

/** Utente con lo spazio di cui è titolare; `createdAt` come lo scrive Better Auth o in millisecondi. */
async function merchant(options: {
  createdAt: string;
  verified?: boolean;
  admin?: boolean;
  numeric?: boolean;
}) {
  users += 1;
  const userId = `kpi-u-${users}-${crypto.randomUUID()}`;
  const workspaceId = `kpi-w-${users}`;
  const created = options.numeric ? Date.parse(options.createdAt) : options.createdAt;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt",
        "updatedAt", "admin") VALUES (?, 'Venditore', ?, ?, ?, ?, ?)`).bind(
      userId,
      `${userId}@example.invalid`,
      options.verified === false ? 0 : 1,
      created,
      created,
      options.admin ? 1 : 0,
    ),
    ...insertWorkspace({ id: workspaceId, userId, createdAt: options.createdAt }),
  ]);
  return workspaceId;
}

/** Negozio collegato dello spazio, con il consenso valido fino a `future`. */
async function store(workspaceId: string, linkedAt: string, id = `${workspaceId}-s`) {
  await env.DB.batch([
    insertStore({ id, workspaceId, linkedAt }),
    insertCredentials({ storeId: id, accessExpiresAt: future, grantedAt: linkedAt }),
  ]);
  return id;
}

const run = (storeId: string, startedAt: string, ok: boolean, created = 0) =>
  env.DB.prepare(
    "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES (?, ?, ?, ?)",
  ).bind(storeId, startedAt, ok ? 1 : 0, created);

/** Ordine entrato negli elenchi all'istante dell'orologio, come lo scrive l'import. */
const order = (id: string, storeId: string) =>
  env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
      last_modified_time, currency, total_minor, listed_at)
    VALUES (?, ?, ?, ?, ?, 'EUR', 1000, ?)`).bind(
    id,
    storeId,
    `ebay-${id}`,
    clock,
    clock,
    new Date().toISOString(),
  );

const taxId = (id: string, orderId: string, type: string, observedAt: string) =>
  env.DB.prepare(`INSERT INTO tax_identifiers
      (id, order_id, identifier_type, issuing_country, value, source, observed_at)
    VALUES (?, ?, ?, 'IT', 'RSSMRA80A01H501U', 'synthetic_fixture', ?)`).bind(
    id,
    orderId,
    type,
    observedAt,
  );

const paid = (workspaceId: string, source: "premium" | "lifetime", paidAt: string, amount = 490) =>
  env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at,
      amount_paid, currency, paid_at, stripe_checkout_session_id)
    VALUES (?, ?, ?, ?, ?, ?, 'eur', ?, ?)`).bind(
    crypto.randomUUID(),
    workspaceId,
    source,
    paidAt,
    source === "lifetime" ? null : future,
    amount,
    paidAt,
    source === "lifetime" ? `cs_${workspaceId}` : null,
  );

async function stepsOf(workspaceId: string) {
  const { results } = await env.DB.prepare(
    "SELECT step, occurred_at AS at FROM workspace_funnel_steps WHERE workspace_id = ? ORDER BY step",
  )
    .bind(workspaceId)
    .all<{ step: string; at: string }>();
  return Object.fromEntries(results.map((row) => [row.step, row.at]));
}

describe("finestra delle metriche", () => {
  it("accetta soltanto le finestre previste, altrimenti trenta giorni", () => {
    expect(metricWindowFrom("7")).toBe(7);
    expect(metricWindowFrom("90")).toBe(90);
    expect(metricWindowFrom("365")).toBe(30);
    expect(metricWindowFrom(null)).toBe(30);
  });
});

describe("primi passaggi deduplicati", () => {
  it("registra ogni passaggio una volta, al primo istante, con retry e ricollegamenti", async () => {
    const workspace = await merchant({ createdAt: before(10) });
    const storeId = await store(workspace, before(9));
    // Ricollegamento dello stesso negozio con l'upsert del consenso e un secondo negozio:
    // resta il primo collegamento, e il trigger non fa fallire l'upsert.
    await env.DB.prepare(`INSERT INTO ebay_store_credentials (store_id, access_token,
        access_expires_at, refresh_token, refresh_expires_at, granted_at)
      VALUES (?1, 'a', ?2, 'r', ?2, ?3)
      ON CONFLICT(store_id) DO UPDATE SET granted_at = excluded.granted_at`)
      .bind(storeId, future, before(5))
      .run();
    await store(workspace, before(4), `${workspace}-s2`);
    // Una lettura fallita non è la prima riuscita; le successive riuscite non la spostano.
    await env.DB.batch([
      run(storeId, before(8, 2), false),
      run(storeId, before(8), true),
      run(storeId, before(7), true, 2),
    ]);
    vi.setSystemTime(new Date(before(7)));
    await env.DB.batch([order("kpi-o1", storeId), order("kpi-o2", storeId)]);
    vi.setSystemTime(new Date(clock));
    await order("kpi-o3", storeId).run();
    // Una Partita IVA non è il primo codice fiscale; un codice ripetuto non lo sposta.
    await env.DB.batch([
      taxId("kpi-t0", "kpi-o1", "VAT_ID", before(7, 1)),
      taxId("kpi-t1", "kpi-o1", "CODICE_FISCALE", before(7)),
      taxId("kpi-t2", "kpi-o2", "CODICE_FISCALE", before(6)),
    ]);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
        VALUES ('kpi-g1', ?, 'kpi-o1', 'admin', ?)`).bind(workspace, before(6)),
      env.DB.prepare(`INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
        VALUES ('kpi-g2', ?, 'kpi-o2', 'admin', ?)`).bind(workspace, before(5)),
    ]);
    // Una concessione non è un acquisto; il primo pagamento sì, il rinnovo no.
    await env.DB.batch([
      insertEntitlement({
        workspaceId: workspace,
        source: "trial",
        startsAt: before(6),
        endsAt: before(-8),
      }),
      insertEntitlement({
        workspaceId: workspace,
        source: "admin",
        startsAt: before(6),
        endsAt: future,
        grantedBy: "admin",
        grantReason: "prova",
      }),
      paid(workspace, "premium", before(3)),
      paid(workspace, "premium", before(1)),
    ]);

    expect(await stepsOf(workspace)).toEqual({
      store_linked: before(9),
      first_sync: before(8),
      first_order: before(7),
      first_tax_id: before(7),
      first_unlock: before(6),
      trial: before(6),
      purchase: before(3),
    });
    // L'attività automatica non tocca l'attività umana dello spazio.
    const space = await env.DB.prepare("SELECT active_at FROM workspaces WHERE id = ?")
      .bind(workspace)
      .first<{ active_at: string | null }>();
    expect(space!.active_at).toBeNull();
  });

  it("conta le letture per giorno senza conservare i negozi", async () => {
    const workspace = await merchant({ createdAt: before(3) });
    const storeId = await store(workspace, before(3));
    await env.DB.batch([
      run(storeId, before(2, 1), true),
      run(storeId, before(2), false),
      run(storeId, before(1), true),
    ]);
    const { results } = await env.DB.prepare(
      "SELECT day, attempts, failures FROM sync_daily ORDER BY day",
    ).all();
    expect(results).toEqual([
      { day: before(2).slice(0, 10), attempts: 2, failures: 1 },
      { day: before(1).slice(0, 10), attempts: 1, failures: 0 },
    ]);
  });
});

describe("KPI della console", () => {
  it("calcola il funnel della coorte con denominatori, mediane e lettura a zero ordini", async () => {
    // Coorte: tre venditori nella finestra, uno in millisecondi come può scrivere Better Auth.
    const full = await merchant({ createdAt: before(20) });
    const empty = await merchant({ createdAt: before(10), numeric: true });
    const unverified = await merchant({ createdAt: before(5), verified: false });
    // Fuori dalla coorte: un admin e un venditore registrato prima della finestra.
    const staff = await merchant({ createdAt: before(4), admin: true });
    const old = await merchant({ createdAt: before(40) });
    const fullStore = await store(full, before(20, -2));
    const emptyStore = await store(empty, before(10, -6));
    await store(staff, before(4));
    await store(old, before(39));
    await env.DB.batch([run(fullStore, before(19), true, 1), run(emptyStore, before(9), true)]);
    await order("kpi-f1", fullStore).run();
    // Negozio e ordine senza email verificata né lettura: fuori dalle basi, nessuna quota oltre
    // il 100%.
    await order("kpi-u1", await store(unverified, before(5))).run();

    const { funnel } = await productMetrics(env, 30);
    const steps = Object.fromEntries(funnel.steps.map((step) => [step.step, step]));
    expect(steps.registered).toEqual({
      step: "registered",
      after: null,
      count: 3,
      of: 3,
      medianHours: null,
    });
    expect(steps.verified).toMatchObject({ count: 2, of: 3 });
    expect(steps.store_linked).toEqual({
      step: "store_linked",
      after: "verified",
      count: 2,
      of: 2,
      medianHours: 4,
    });
    expect(steps.first_sync).toMatchObject({ count: 2, of: 2, medianHours: 24 });
    expect(steps.first_order).toMatchObject({ count: 1, of: 2 });
    expect(steps.first_tax_id).toMatchObject({ count: 0, of: 1, medianHours: null });
    expect(steps.trial).toMatchObject({ after: "first_sync", count: 0, of: 2 });
    expect(steps.purchase).toMatchObject({ after: "store_linked", count: 0, of: 2 });
    expect(funnel.steps.every((step) => step.count <= step.of)).toBe(true);
    expect(funnel.syncWithoutOrders).toBe(1);
    // Con sette giorni la coorte è il solo venditore senza email verificata.
    const week = await productMetrics(env, 7);
    expect(week.funnel.steps[0]!.count).toBe(1);
    expect(week.funnel.steps[2]!.count).toBe(0);
    expect(week.funnel.syncWithoutOrders).toBe(0);
  });

  it("separa paganti, ricavo ricorrente, prove, omaggi e incassi", async () => {
    const monthly = await merchant({ createdAt: before(60) });
    const annual = await merchant({ createdAt: before(60) });
    const lifetime = await merchant({ createdAt: before(60) });
    const gift = await merchant({ createdAt: before(60) });
    const trialOpen = await merchant({ createdAt: before(5) });
    const trialBought = await merchant({ createdAt: before(30) });
    const trialLost = await merchant({ createdAt: before(30) });
    const subscription = (
      id: string,
      workspaceId: string,
      offer: "monthly" | "annual",
      extra: { status?: string; generation?: string; cancelling?: boolean } = {},
    ) =>
      env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id,
          offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at)
        VALUES (?, ?, 'test', 'cus_kpi', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        id,
        workspaceId,
        offer,
        extra.generation ?? "2026-09",
        extra.status ?? "active",
        before(10),
        future,
        extra.cancelling ? 1 : 0,
        clock,
        clock,
      );
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          provider_reference, activated_at, created_at)
        VALUES (1, ?1, 'active', 'sale', ?2, ?3, ?3), (2, ?4, 'active', 'gift', NULL, ?3, ?3)`).bind(
        lifetime,
        `cs_${lifetime}`,
        before(20),
        gift,
      ),
      subscription("sub_m", monthly, "monthly", { cancelling: true }),
      subscription("sub_a", annual, "annual"),
      // Un'altra generazione resta fuori dal ricavo calcolato, un abbonamento chiuso da tutto.
      subscription("sub_old", trialBought, "monthly", { generation: "2025-01" }),
      subscription("sub_closed", trialLost, "annual", { status: "canceled" }),
      paid(monthly, "premium", before(50)),
      paid(monthly, "premium", before(10)),
      paid(annual, "premium", before(40), 4900),
      paid(lifetime, "lifetime", before(20), 14900),
      env.DB.prepare(`INSERT INTO workspace_entitlements
          (id, workspace_id, source, starts_at, granted_by, grant_reason)
        VALUES ('kpi-gift', ?, 'lifetime', ?, 'admin', 'omaggio')`).bind(gift, before(20)),
      insertEntitlement({
        workspaceId: trialOpen,
        source: "trial",
        startsAt: before(2),
        endsAt: before(-12),
      }),
      insertEntitlement({
        workspaceId: trialBought,
        source: "trial",
        startsAt: before(25),
        endsAt: before(11),
      }),
      paid(trialBought, "premium", before(11)),
      insertEntitlement({
        workspaceId: trialLost,
        source: "trial",
        startsAt: before(24),
        endsAt: before(10),
      }),
    ]);
    await env.DB.prepare(
      "UPDATE workspace_entitlements SET amount_refunded = 100 WHERE source = 'lifetime' AND amount_paid > 0",
    ).run();

    const { commerce } = await productMetrics(env, 30);
    expect(commerce.subscriptions).toEqual({ monthly: 2, annual: 1, cancelling: 1, unlisted: 1 });
    expect(commerce.mrr).toBe(Math.round(490 + 4900 / 12));
    expect(commerce.paying).toBe(4);
    expect(commerce).toMatchObject({
      trialsOpen: 1,
      lifetimePaid: 1,
      lifetimeGifted: 1,
      granted: 0,
      trials: { ended: 2, converted: 1 },
      purchases: { total: 2, afterTrial: 1 },
    });
    // Incassi della finestra: il primo mensile e l'annuale sono più vecchi.
    expect(commerce.cash).toEqual({ paid: 490 + 14900 + 490, refunded: 100 });
  });

  it("misura errori, ritardo, merchant operativi, quota Free e capacità", async () => {
    const reading = await merchant({ createdAt: before(60) });
    const late = await merchant({ createdAt: before(60) });
    const fresh = await merchant({ createdAt: before(1) });
    const paused = await merchant({ createdAt: before(60) });
    const readingStore = await store(reading, before(60));
    const lateStore = await store(late, before(60));
    await store(fresh, before(1));
    const pausedStore = await store(paused, before(60));
    await env.DB.batch([
      insertStorePause({ storeId: pausedStore, pausedAt: before(1) }),
      env.DB.prepare(
        "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
      ).bind(
        readingStore,
        before(0, 0.1),
        clock,
        lateStore,
        before(0, 2),
        clock,
        pausedStore,
        before(0, 1),
        clock,
      ),
      run(readingStore, before(3), true),
      run(readingStore, before(2), false),
      run(lateStore, before(2), true),
      run(lateStore, before(40), false),
      env.DB.prepare("UPDATE workspaces SET active_at = ? WHERE id = ?").bind(before(2), reading),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota, used)
        VALUES ('kpi-c1', ?, ?, ?, 5, 5), ('kpi-c2', ?, ?, ?, 5, 1)`).bind(
        reading,
        before(10),
        before(-20),
        late,
        before(10),
        before(-20),
      ),
    ]);

    const metrics = await productMetrics(env, 30);
    expect(metrics.reads).toEqual({ attempts: 3, failures: 1, errorRate: 1 / 3, days: 2 });
    // La pausa toglie il negozio dalle letture attese; il negozio nuovo non è mai stato letto.
    expect(metrics.lag).toEqual({
      targetMinutes: 30,
      stores: 3,
      neverRead: 1,
      medianMinutes: 63,
      maxMinutes: 120,
      late: 1,
    });
    expect(metrics.spaces).toEqual({ operative: 2, active: 1 });
    expect(metrics.freeQuota).toEqual({ cycles: 2, used: 6, quota: 10, exhausted: 1 });
    expect(metrics.capacity).toMatchObject({
      readingStores: 3,
      referenceStores: 150,
      databaseBudget: 8 * 1024 ** 3,
    });
    expect(metrics.capacity.databaseBytes).toBeGreaterThan(0);
    // Le righe conservate restano poche: un passaggio per spazio e un giorno per data.
    expect(metrics.volume).toEqual({ steps: 6, days: 3, runs: 4 });
  });

  it("elimina gli aggregati oltre novanta giorni e i biglietti scaduti", async () => {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO sync_daily (day, attempts, failures) VALUES (?, 1, 0), (?, 1, 1)",
      ).bind(
        before(syncDailyRetentionDays + 1).slice(0, 10),
        before(syncDailyRetentionDays - 1).slice(0, 10),
      ),
      env.DB.prepare(
        "INSERT INTO page_timing_reports (nonce, expires_at) VALUES ('nonce-expired-0001', ?), ('nonce-current-0001', ?)",
      ).bind(before(0, 1), before(0, -1)),
    ]);
    await purgeExpiredRecords(env.DB, new Date(clock));
    const days = await env.DB.prepare("SELECT day FROM sync_daily").all<{ day: string }>();
    expect(days.results.map((row) => row.day)).toEqual([
      before(syncDailyRetentionDays - 1).slice(0, 10),
    ]);
    const tickets = await env.DB.prepare("SELECT nonce FROM page_timing_reports").all();
    expect(tickets.results).toEqual([{ nonce: "nonce-current-0001" }]);
  });

  it("apre la sezione Metriche della console con la finestra scelta", async () => {
    vi.setSystemTime(new Date("2026-09-13T20:00:00.000Z"));
    const session = await verifiedSession("admin.metriche@example.invalid");
    await env.DB.batch([
      env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(session.userId),
      env.DB.prepare('UPDATE "session" SET "passkeyVerified" = 1 WHERE "userId" = ?').bind(
        session.userId,
      ),
    ]);
    const result = await routeData(adminLoader, "/admin/metriche?giorni=7", {
      cookie: session.cookie,
      params: { sezione: "metriche" },
    });
    expect(result.page).toMatchObject({ section: "metriche", metrics: { window: { days: 7 } } });
  });
});

describe("report del browser", () => {
  const secret = "fiscalbay-test-secret-at-least-32-bytes";
  const report = (ticket: string, page = "orders") =>
    routeResponse(pageTiming, "/api/v1/page-timing", {
      body: JSON.stringify({ page, ttfb: 100, ready: 400, server: { d1: 5 }, ticket }),
      headers: { "content-type": "application/json" },
    });

  it("registra un report soltanto con un biglietto valido e una volta sola", async () => {
    const written = vi.spyOn(env.METRICS, "writeDataPoint").mockImplementation(() => {});
    const ticket = await issueTimingTicket(secret, "orders");
    expect((await report(ticket)).status).toBe(204);
    expect(written).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["page", "orders"]),
        doubles: [100, -1, -1, 400, -1, 5, -1],
      }),
    );
    written.mockClear();
    // Lo stesso biglietto, quello di un'altra pagina, uno firmato altrove o scaduto non contano.
    expect((await report(ticket)).status).toBe(204);
    expect((await report(await issueTimingTicket(secret, "stores"))).status).toBe(204);
    const forged = await issueTimingTicket("un-altro-segreto-lungo-almeno-32-byte", "orders");
    expect((await report(forged)).status).toBe(204);
    const old = await issueTimingTicket(
      secret,
      "orders",
      new Date(Date.parse(clock) - 15 * 60_000),
    );
    expect((await report(old)).status).toBe(204);
    const ahead = await issueTimingTicket(secret, "orders", new Date(Date.parse(clock) + 120_000));
    expect((await report(ahead)).status).toBe(204);
    expect((await report("orders.x.y.z")).status).toBe(204);
    expect(written).not.toHaveBeenCalled();
    written.mockRestore();
    // Il biglietto di Negozi vale per Negozi.
    expect(
      await redeemTimingTicket(env.DB, secret, await issueTimingTicket(secret, "stores"), "stores"),
    ).toBe(true);
  });
});
