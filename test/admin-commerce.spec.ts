import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { listAnomalies } from "../app/domain/admin-operations.server";

import {
  endPromotion,
  lifetimeSeats,
  listPromotions,
  savePromotion,
  scheduleFreeQuota,
} from "../app/domain/admin-commerce.server";

import { grantLifetimeConcession } from "../app/domain/concessions.server";

import { freeQuotaSettings, orderAllowance } from "../app/domain/grants.server";

import { subscriptionView } from "../app/domain/plan-view.server";

import { listNotifications } from "../app/domain/notifications.server";

import { saveServiceNotice, withdrawServiceNotice } from "../app/domain/service-notices.server";

import { admission } from "../app/domain/admission.server";

import { serviceSetting, switchboard } from "../app/domain/service-settings.server";

import { loader as adminLoader } from "../app/routes/admin";

import { verifiedSession } from "./fixtures/account-fixtures";

import { insertSubscription, insertWorkspace, now } from "./fixtures/database-fixtures";

import { stripeAccount } from "./fixtures/stripe-fixtures";

import { routeData } from "./fixtures/route-fixtures";

import { at, hour, later, admin, audit, act, setupScenarios } from "./fixtures/admin-scenarios";

setupScenarios();

describe("configurazioni commerciali", () => {
  const cycleStart = "2026-09-13T20:00:00.000Z";

  async function freeWorkspace(userId: string) {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-free", userId }),
      env.DB.prepare("UPDATE workspaces SET free_cycle_anchor_at = ? WHERE id = 'w-free'").bind(
        cycleStart,
      ),
    ]);
  }

  it("applica la nuova quota base soltanto ai cicli che iniziano dopo", async () => {
    const { userId } = await verifiedSession("quota.base@example.invalid");
    await freeWorkspace(userId);
    const input = { actor: "admin", reason: "Lancio" };
    expect(
      await scheduleFreeQuota(env.DB, { ...input, quota: 8, effectiveAt: later(-hour) }, at(now)),
    ).toBe("invalid");
    expect(
      await scheduleFreeQuota(env.DB, { ...input, quota: 8, effectiveAt: later(hour) }, at(now)),
    ).toBe("done");
    expect(await freeQuotaSettings(env.DB, at(now))).toEqual({
      quota: 5,
      next: { quota: 8, effectiveAt: later(hour) },
    });
    // Il ciclo in corso, anche creato dopo la modifica, conserva la quota del suo inizio.
    const current = await orderAllowance(env.DB, userId, at(later(2 * hour)));
    expect(current?.cycle).toMatchObject({ quota: 5, next_quota: 8 });
    const next = await orderAllowance(env.DB, userId, at(later(7 * 24 * hour + hour)));
    expect(next?.cycle).toMatchObject({ quota: 8 });
    // Una modifica non si cancella né si riscrive: ne serve una nuova.
    await expect(env.DB.prepare("UPDATE free_quota_changes SET quota = 9").run()).rejects.toThrow(
      "immutable_quota_change",
    );
  });

  it("gestisce le promozioni senza toccare i cicli iniziati", async () => {
    const promotion = (startsAt: string, endsAt: string, quota = 10) => ({
      startsAt,
      endsAt,
      quota,
    });
    expect(
      await savePromotion(env.DB, { promotion: promotion(later(-hour), later(hour)) }, at(now)),
    ).toBe("invalid");
    expect(
      await savePromotion(env.DB, { promotion: promotion(later(hour), later(48 * hour)) }, at(now)),
    ).toBe("done");
    expect(
      await savePromotion(
        env.DB,
        { promotion: promotion(later(24 * hour), later(72 * hour)) },
        at(now),
      ),
    ).toBe("overlap");
    const { id } = (await env.DB.prepare("SELECT id FROM free_promotions").first<{
      id: string;
    }>())!;
    // Iniziata: si cambiano quota e fine, non l'inizio.
    const running = at(later(2 * hour));
    expect(
      await savePromotion(
        env.DB,
        { id, promotion: promotion(later(90 * 60_000), later(48 * hour), 12) },
        running,
      ),
    ).toBe("started");
    expect(
      await savePromotion(
        env.DB,
        { id, promotion: promotion(later(hour), later(24 * hour), 12) },
        running,
      ),
    ).toBe("done");
    expect(
      await env.DB.prepare(
        "SELECT previous_quota, previous_ends_at FROM free_promotion_changes",
      ).all(),
    ).toMatchObject({ results: [{ previous_quota: 10, previous_ends_at: later(48 * hour) }] });
    // La fine anticipata chiude adesso quella in corso; una futura si annulla.
    const ending = at(later(3 * hour));
    expect(await endPromotion(env.DB, id, ending)).toBe("done");
    expect(
      await env.DB.prepare("SELECT ends_at FROM free_promotions WHERE id = ?").bind(id).first(),
    ).toEqual({ ends_at: ending.toISOString() });
    expect(
      await savePromotion(
        env.DB,
        { promotion: promotion(later(96 * hour), later(120 * hour)) },
        running,
      ),
    ).toBe("done");
    const future = await env.DB.prepare("SELECT id FROM free_promotions WHERE id <> ?")
      .bind(id)
      .first<{ id: string }>();
    expect(await endPromotion(env.DB, future!.id, ending)).toBe("done");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM free_promotions").first()).toEqual({
      n: 1,
    });
    expect(await endPromotion(env.DB, id, ending)).toBe("not_found");
  });

  it("tiene una promozione senza fine finché non si termina, con la quota nei cicli", async () => {
    const promotion = { startsAt: later(hour), endsAt: null, quota: 10 };
    expect(await savePromotion(env.DB, { promotion }, at(now))).toBe("done");
    const [saved] = await listPromotions(env.DB, at(now));
    expect(saved).toMatchObject({ startsAt: later(hour), endsAt: null, quota: 10 });
    // Un'altra promozione successiva si sovrappone a quella aperta.
    expect(
      await savePromotion(
        env.DB,
        { promotion: { startsAt: later(400 * 24 * hour), endsAt: null, quota: 8 } },
        at(now),
      ),
    ).toBe("overlap");
    // Iniziata, riceve una fine; senza fine si riapre.
    const running = at(later(2 * hour));
    const withEnd = { ...promotion, endsAt: later(48 * hour) };
    expect(await savePromotion(env.DB, { id: saved!.id, promotion: withEnd }, running)).toBe(
      "done",
    );
    expect((await listPromotions(env.DB, running))[0]!.endsAt).toBe(later(48 * hour));
    const reopened = at(later(150 * 60_000));
    expect(await savePromotion(env.DB, { id: saved!.id, promotion }, reopened)).toBe("done");
    expect((await listPromotions(env.DB, reopened))[0]!.endsAt).toBeNull();
    const ending = at(later(3 * hour));
    expect(await endPromotion(env.DB, saved!.id, ending)).toBe("done");
    expect((await listPromotions(env.DB, ending))[0]!.endsAt).toBe(ending.toISOString());
  });

  it("legge dal modulo della console una fine vuota come promozione senza fine", async () => {
    const { cookie } = await admin();
    const fields = { intent: "save-promotion", inizio: "2099-01-01T10:00", quota: "10" };
    expect(await act(cookie, { ...fields, fine: "domani", motivo: "Lancio" })).toMatchObject({
      status: 400,
    });
    expect(await act(cookie, { ...fields, fine: "", motivo: "Lancio" })).toMatchObject({
      ok: true,
    });
    expect(await listPromotions(env.DB)).toMatchObject([
      { startsAt: "2099-01-01T09:00:00.000Z", endsAt: null, quota: 10 },
    ]);
  });

  it("conta i posti lifetime e riconcede il lifetime rimborsato sullo stesso posto", async () => {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a" }),
      ...insertWorkspace({ id: "w-b" }),
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          provider_reference, activated_at, created_at)
        VALUES (1, 'w-a', 'active', 'sale', 'cs_paid', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          stripe_checkout_session_id, amount_paid, currency, paid_at, revoked_at, revocation,
          amount_refunded)
        VALUES ('paid', 'w-a', 'lifetime', ?1, 'cs_paid', 14900, 'eur', ?1, ?1, 'refund', 14900)`).bind(
        now,
      ),
    ]);
    expect(await lifetimeSeats(env.DB)).toMatchObject({
      sold: 1,
      refunded: 1,
      regranted: 0,
      available: 19,
    });
    const grant = (workspaceId: string) =>
      grantLifetimeConcession(
        env,
        { workspaceId, author: "admin", reason: "Riconcessione" },
        at(now),
      );
    expect(await grant("w-a")).toBe("done");
    expect(await grant("w-a")).toBe("owned");
    expect(await grant("w-b")).toBe("done");
    expect(await lifetimeSeats(env.DB)).toEqual({
      total: 20,
      sold: 1,
      gifted: 1,
      reserved: 0,
      refunded: 1,
      regranted: 1,
      available: 18,
    });
    expect(
      (
        await env.DB.prepare(`SELECT granted_by, grant_reason, revoked_at FROM workspace_entitlements
          WHERE workspace_id = 'w-a' AND id <> 'paid'`).all()
      ).results,
    ).toEqual([{ granted_by: "admin", grant_reason: "Riconcessione", revoked_at: null }]);
    // Il piano lo mostra concesso, non acquistato, anche sul posto della vendita.
    expect(
      await subscriptionView(env.DB, env, "w-a", { source: "lifetime", endsAt: null }, at(now)),
    ).toEqual({ premium: { period: "lifetime", renewsAt: null, granted: true } });
  });

  it("con il lifetime concesso un abbonamento che Stripe non restituisce più resta indisponibile", async () => {
    await env.DB.batch([...insertWorkspace({ id: "w-a" }), insertSubscription()]);
    const stripe = stripeAccount();
    stripe.state.missing = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    expect(
      await grantLifetimeConcession(
        env,
        { workspaceId: "w-a", author: "admin", reason: "Omaggio" },
        at(now),
      ),
    ).toBe("done");
    expect(stripe.requests).toEqual(["GET /v1/subscriptions/sub_test"]);
    // Non può più addebitare: il cron non la rilegge come un abbonamento da chiudere.
    expect(
      await env.DB.prepare("SELECT status, unavailable_at FROM stripe_subscriptions").first(),
    ).toEqual({ status: "active", unavailable_at: now });
  });
});

describe("comunicazioni di servizio", () => {
  const notice = (startsAt: string, endsAt: string) => ({
    tone: "warning" as const,
    titleIt: "Manutenzione",
    bodyIt: "Le letture si fermano per un'ora.",
    titleEn: "Maintenance",
    bodyEn: "Reads pause for one hour.",
    startsAt,
    endsAt,
  });

  it("compare nella campanella nella lingua dell'utente durante la validità", async () => {
    const { userId } = await verifiedSession("campanella@example.invalid");
    expect(
      await saveServiceNotice(
        env.DB,
        { notice: notice(later(-2 * hour), later(-hour)), actor: "admin" },
        at(now),
      ),
    ).toEqual({ result: "invalid" });
    const saved = await saveServiceNotice(
      env.DB,
      { notice: notice(later(hour), later(3 * hour)), actor: "admin" },
      at(now),
    );
    if (saved.result !== "done") throw new Error();
    const bell = (language: "it" | "en", time: string) =>
      listNotifications(env.DB, userId, [], language, "Europe/Rome", at(time));
    expect(await bell("it", now)).toEqual([]);
    const [item] = await bell("it", later(2 * hour));
    expect(item).toMatchObject({ tone: "warning", title: "Manutenzione", read: false });
    expect((await bell("en", later(2 * hour)))[0]).toMatchObject({ title: "Maintenance" });
    expect(await bell("it", later(3 * hour))).toEqual([]);

    // Un testo modificato torna da leggere; ritirata esce subito.
    const edited = await saveServiceNotice(
      env.DB,
      {
        id: saved.id,
        notice: { ...notice(later(hour), later(3 * hour)), bodyIt: "Due ore." },
        actor: "admin",
      },
      at(later(90 * 60_000)),
    );
    expect(edited).toEqual({ result: "done", id: saved.id });
    const [updated] = await bell("it", later(2 * hour));
    expect(updated!.id).not.toBe(item!.id);
    expect(await withdrawServiceNotice(env.DB, saved.id, at(later(2 * hour)))).toBe("done");
    expect(await bell("it", later(2 * hour))).toEqual([]);
    expect(await withdrawServiceNotice(env.DB, saved.id)).toBe("not_found");
  });
});

describe("interruttori e ammissione", () => {
  it("vale il comportamento normale senza configurazione o con un valore non valido", async () => {
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: false, since: null },
      purchases: { value: true, since: null },
      ebay: { value: true, since: null },
      telegram: { value: true, since: null },
      quotaAttention: { value: 70, since: null },
      waiting: [],
      waitingTotal: 0,
    });
    await env.DB.prepare(`INSERT INTO service_settings (name, value, updated_at)
        VALUES ('ebay_calls', '"no"', ?1), ('telegram_sends', '0', ?1), ('quota_attention', '99', ?1)`)
      .bind(now)
      .run();
    expect(await serviceSetting(env.DB, "ebay_calls")).toBe(true);
    expect(await serviceSetting(env.DB, "telegram_sends")).toBe(true);
    expect(await serviceSetting(env.DB, "quota_attention")).toBe(70);
    expect((await listAnomalies(env.DB, at(now))).some((a) => a.kind === "service_off")).toBe(
      false,
    );
  });

  it("spegne e riaccende i servizi con motivo, registro e anomalia in panoramica", async () => {
    const { cookie, userId } = await admin();
    const off = (interruttore: string, motivo = "Incidente") =>
      act(cookie, { intent: "set-switch", interruttore, stato: "off", motivo });
    const on = (interruttore: string) =>
      act(cookie, { intent: "set-switch", interruttore, stato: "on", motivo: "Rientro" });
    expect(
      await act(cookie, { intent: "set-switch", interruttore: "ebay_calls", stato: "off" }),
    ).toMatchObject({ status: 400 });
    expect(await off("sql")).toMatchObject({ status: 400 });
    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "ebay_calls",
        stato: "x",
        motivo: "x",
      }),
    ).toMatchObject({ status: 400 });

    expect(await off("ebay_calls")).toEqual({ ok: true, notice: "Operazione registrata." });
    expect(await off("ebay_calls")).toMatchObject({ ok: false });
    expect(await off("telegram_sends")).toMatchObject({ ok: true });
    expect(await off("purchases_open")).toMatchObject({ ok: true });
    expect(await serviceSetting(env.DB, "ebay_calls")).toBe(false);
    expect(await admission(env.DB, userId)).toMatchObject({ purchasesOpen: false });
    // La lista d'attesa resta com'era: l'interruttore degli acquisti non la tocca.
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: false },
      purchases: { value: false },
      ebay: { value: false },
      telegram: { value: false },
    });

    const anomaly = (await listAnomalies(env.DB)).find((a) => a.kind === "service_off");
    expect(anomaly).toMatchObject({ severity: "p2", count: 3 });
    expect(anomaly!.subjects.map((subject) => subject.id).sort()).toEqual([
      "ebay_calls",
      "purchases_open",
      "telegram_sends",
    ]);
    const section = await routeData(adminLoader, "/admin/interruttori", {
      cookie,
      params: { sezione: "interruttori" },
    });
    expect(section.page).toMatchObject({ section: "interruttori", ebay: { value: false } });

    for (const name of ["ebay_calls", "telegram_sends", "purchases_open"])
      expect(await on(name)).toMatchObject({ ok: true });
    expect((await listAnomalies(env.DB)).some((a) => a.kind === "service_off")).toBe(false);
    expect(await admission(env.DB, userId)).toMatchObject({ purchasesOpen: true });
    expect(await audit()).toEqual([
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: null,
        outcome: "reason_required",
      },
      {
        operation: "set-switch",
        target: "switch:sql:off",
        reason: "Incidente",
        outcome: "invalid",
      },
      { operation: "set-switch", target: "switch:ebay_calls:x", reason: "x", outcome: "invalid" },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: "Incidente",
        outcome: "unchanged",
      },
      {
        operation: "set-switch",
        target: "switch:telegram_sends:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:purchases_open:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:on",
        reason: "Rientro",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:telegram_sends:on",
        reason: "Rientro",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:purchases_open:on",
        reason: "Rientro",
        outcome: "done",
      },
    ]);
  });

  it("ammette uno spazio in attesa e, spegnendo la lista, tutti gli altri", async () => {
    const { cookie } = await admin();
    const first = await verifiedSession("attesa.prima@example.invalid");
    const second = await verifiedSession("attesa.seconda@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-prima", userId: first.userId }),
      ...insertWorkspace({ id: "w-seconda", userId: second.userId }),
      env.DB.prepare("UPDATE user_profiles SET waitlisted_at = ?1 WHERE user_id IN (?2, ?3)").bind(
        now,
        first.userId,
        second.userId,
      ),
    ]);
    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "free_waitlist",
        stato: "on",
        motivo: "Capacità",
      }),
    ).toMatchObject({ ok: true });
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: true, since: now },
      purchases: { value: true },
      waitingTotal: 2,
      waiting: [
        { workspaceId: "w-prima", email: "attesa.prima@example.invalid" },
        { workspaceId: "w-seconda", email: "attesa.seconda@example.invalid" },
      ],
    });

    expect(await act(cookie, { intent: "admit-waitlisted", spazio: "w-prima" })).toMatchObject({
      status: 400,
    });
    expect(
      await act(cookie, {
        intent: "admit-waitlisted",
        spazio: "w-prima",
        motivo: "Venditore noto",
      }),
    ).toMatchObject({ ok: true });
    expect(await admission(env.DB, first.userId)).toMatchObject({ waiting: false });
    expect(await admission(env.DB, second.userId)).toMatchObject({ waiting: true });
    expect(
      await act(cookie, { intent: "admit-waitlisted", spazio: "w-prima", motivo: "Ancora" }),
    ).toMatchObject({ ok: false });

    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "free_waitlist",
        stato: "off",
        motivo: "Capacità",
      }),
    ).toMatchObject({ ok: true });
    expect(await admission(env.DB, second.userId)).toMatchObject({ waiting: false });
    expect((await audit()).filter((row) => row.operation === "admit-waitlisted")).toEqual([
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: null,
        outcome: "reason_required",
      },
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: "Venditore noto",
        outcome: "done",
      },
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: "Ancora",
        outcome: "not_found",
      },
    ]);
  });
});
