import { env } from "cloudflare:workers";
import { insertWorkspace } from "./fixtures/database-fixtures";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { orderAllowance, startTrial, unlockOrders } from "../app/domain/grants.server";

import { admission, applyInactivity, recordActivity } from "../app/domain/admission.server";

import { setSwitch } from "../app/domain/service-settings.server";

import { purchaseState } from "../app/domain/checkout.server";

import { lifetimeContext } from "../app/domain/lifetime.server";

import { dispatchStoreSyncs, requestStoreSync } from "../app/domain/order-sync.server";

import { consumeOrderConfirmation } from "../app/domain/order-acquisition.server";

import { action as storeLinkAction } from "../app/routes/store-link";

import { listVisibleOrders } from "../app/domain/orders.server";

import {
  deleteStoreData,
  disconnectStore,
  listStores,
  resumeStore,
} from "../app/domain/stores.server";

import { handleAuthRequest } from "../app/auth-route.server";

import { applyFreePlans } from "../app/domain/free-store.server";

import { refreshExpiringTokens } from "../app/domain/token-refresh.server";

import { insertEntitlement, insertStore, now } from "./fixtures/database-fixtures";

import { syntheticEbay, syntheticOrderId } from "./fixtures/ebay-fixtures";

import { verifiedSession } from "./fixtures/account-fixtures";

import { beginStoreLink, storeCallback } from "./fixtures/store-link-fixtures";

import { queued } from "./fixtures/queue-fixture";

import { areaShell, routeResponse } from "./fixtures/route-fixtures";

import {
  day,
  hour,
  linkThroughEbay,
  linkedSeller,
  count,
  storesPage,
  storeForm,
  settingsPage,
  setupScenarios,
} from "./fixtures/stores-scenarios";

setupScenarios();

describe("inattività del Free e ammissione", () => {
  let base = 0;
  beforeEach(() => {
    base = Date.now();
  });
  const at = (days: number) => new Date(base + days * day);
  /** Invio delle email finto, nell'ambiente passato al compito. */
  const mailer = () => {
    const send = vi.fn<Env["AUTH_EMAIL"]["send"]>().mockResolvedValue({ messageId: "synthetic" });
    return { send, mail: { ...env, AUTH_EMAIL: { send } } as unknown as Env };
  };
  const workspace = (id: string) =>
    env.DB.prepare("SELECT active_at, inactivity_notice_at FROM workspaces WHERE id = ?")
      .bind(id)
      .first<{ active_at: string; inactivity_notice_at: string | null }>();
  const pauses = async (userId: string) =>
    (await listStores(env.DB, userId)).map((store) => store.pauseReasons);
  const admissionSettings = (waitlist: 0 | 1, open: 0 | 1) =>
    env.DB.prepare(
      `INSERT INTO admission_settings (id, free_waitlist, purchases_open, updated_at)
         VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET free_waitlist = ?1,
           purchases_open = ?2, updated_at = ?3`,
    )
      .bind(waitlist, open, new Date().toISOString())
      .run();
  const cron = {
    ...env,
    WORK_QUEUE: { send: vi.fn(), sendBatch: vi.fn().mockResolvedValue(queued) },
  } as unknown as Env;

  it("dopo 30 giorni senza accessi avvisa una volta e dopo altri 7 mette in pausa le letture", async () => {
    const seller = await linkedSeller("inattivo@example.invalid");
    const { send: email, mail } = mailer();
    const cycle = await env.DB.prepare("SELECT * FROM free_cycles").all();
    await applyInactivity(mail, at(29));
    expect(email).not.toHaveBeenCalled();

    await applyInactivity(mail, at(30.1));
    expect(email).toHaveBeenCalledOnce();
    expect(email.mock.calls[0]![0]).toMatchObject({
      to: "inattivo@example.invalid",
      subject: "I tuoi negozi su FiscalBay smetteranno di aggiornarsi",
    });
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
      at(30.1).toISOString(),
    );
    // Un preavviso per periodo, e nessuna pausa prima dei 7 giorni.
    await applyInactivity(mail, at(36.9));
    expect(email).toHaveBeenCalledOnce();
    expect(await pauses(seller.userId)).toEqual([[]]);

    await applyInactivity(mail, at(37.2));
    const [store] = await listStores(env.DB, seller.userId);
    expect(store).toMatchObject({
      connection: "paused",
      pauseReasons: ["inactivity"],
      inactiveSince: at(37.2).toISOString(),
    });
    // Le letture si fermano, i dati restano consultabili.
    expect(await dispatchStoreSyncs(cron, at(37.3))).toEqual([]);
    expect(await listVisibleOrders(env.DB, seller.userId)).toHaveLength(1);

    // La pagina aperta registra l'attività ma non riprende le letture senza conferma.
    const page = await storesPage("/app/negozi", seller.cookie);
    expect(page.data.page.stores[0]).toMatchObject({ pauseReason: "inactivity" });
    expect((await areaShell(seller.cookie, "/app/negozi")).notifications).toContainEqual(
      expect.objectContaining({ id: `inactivity:${at(37.2).toISOString()}`, href: "negozi" }),
    );
    expect(await pauses(seller.userId)).toEqual([["inactivity"]]);

    const resumed = await storeForm(seller.cookie, {
      intent: "store-resume",
      store: seller.storeId,
    });
    expect(resumed).toMatchObject({ ok: true });
    expect(await pauses(seller.userId)).toEqual([[]]);
    expect(
      await env.DB.prepare("SELECT requested_at FROM sync_state").first("requested_at"),
    ).not.toBeNull();
    // Quota, ciclo e prova restano come prima della pausa.
    expect((await env.DB.prepare("SELECT * FROM free_cycles").all()).results).toEqual(
      cycle.results,
    );
    expect(await count("workspace_entitlements")).toBe(0);
    expect((await settingsPage(seller.cookie)).page.account.trialAvailable).toBe(true);
  });

  it("un accesso durante il preavviso lo annulla e un invio non riuscito si riprova", async () => {
    const seller = await linkedSeller("preavviso@example.invalid");
    const { send: email, mail } = mailer();
    email.mockRejectedValueOnce(new Error("synthetic"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await applyInactivity(mail, at(31));
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
    await applyInactivity(mail, at(31.1));
    expect(email).toHaveBeenCalledTimes(2);
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
      at(31.1).toISOString(),
    );
    await recordActivity(env.DB, seller.userId, at(33));
    await applyInactivity(mail, at(40));
    expect(await pauses(seller.userId)).toEqual([[]]);
    expect(email).toHaveBeenCalledTimes(2);
    // Un nuovo periodo di inattività riceve un nuovo preavviso.
    await applyInactivity(mail, at(63.1));
    expect(email).toHaveBeenCalledTimes(3);
    errors.mockRestore();
  });

  it("un indirizzo soppresso vale come preavviso tentato e la pausa segue i suoi tempi", async () => {
    const seller = await linkedSeller("soppresso@example.invalid");
    const { send: email, mail } = mailer();
    email.mockRejectedValue(
      Object.assign(new Error("synthetic"), { code: "E_RECIPIENT_SUPPRESSED" }),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await applyInactivity(mail, at(31));
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(at(31).toISOString());
    // Il log riporta il codice del provider, mai il messaggio o l'indirizzo.
    const logged = errors.mock.calls.map(([line]) => String(line)).join("\n");
    expect(logged).toContain('"failure":"E_RECIPIENT_SUPPRESSED"');
    expect(logged).not.toContain("soppresso@example.invalid");
    await applyInactivity(mail, at(38.1));
    expect(email).toHaveBeenCalledOnce();
    expect(await pauses(seller.userId)).toEqual([["inactivity"]]);
    errors.mockRestore();
  });

  it("indirizzi che rifiutano sempre l'email non fermano il preavviso degli altri", async () => {
    const seller = await linkedSeller("ultimo@example.invalid");
    const { send: email, mail } = mailer();
    // Cinquanta spazi inattivi da prima, con un indirizzo che rifiuta ogni email.
    const earlier = at(-1).toISOString();
    await env.DB.batch(
      Array.from({ length: 50 }, (_, index) => `rifiuta-${index}`).flatMap((id) => [
        env.DB.prepare(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
            VALUES (?1, ?1, ?2, 1, ?3, ?3)`).bind(id, `${id}@example.invalid`, earlier),
        ...insertWorkspace({ id, userId: id, name: id, createdAt: earlier, activeAt: earlier }),
        insertStore({ id: `s-${id}`, workspaceId: id }),
      ]),
    );
    email.mockImplementation(async (message) => {
      if (String((message as { to: string }).to).startsWith("rifiuta-"))
        throw new Error("synthetic");
      return { messageId: "synthetic" };
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await applyInactivity(mail, at(31));
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
    await applyInactivity(mail, at(31.1));
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
      at(31.1).toISOString(),
    );
    errors.mockRestore();
  });

  it("una copertura non va mai in pausa per inattività e toglie pausa e preavviso", async () => {
    const seller = await linkedSeller("coperto@example.invalid");
    const { send: email, mail } = mailer();
    await applyInactivity(mail, at(31));
    await applyInactivity(mail, at(38));
    expect(await pauses(seller.userId)).toEqual([["inactivity"]]);
    await insertEntitlement({
      id: "concessione",
      workspaceId: seller.workspaceId,
      source: "admin",
      startsAt: at(38).toISOString(),
      endsAt: at(120).toISOString(),
    }).run();
    await applyFreePlans(env.DB, at(38.1));
    expect(await pauses(seller.userId)).toEqual([[]]);
    expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
    await applyInactivity(mail, at(100));
    expect(email).toHaveBeenCalledOnce();
    expect(await pauses(seller.userId)).toEqual([[]]);
    // Alla fine della copertura il Free riceve un nuovo preavviso prima di una nuova pausa.
    await applyInactivity(mail, at(120.1));
    expect(email).toHaveBeenCalledTimes(2);
    expect(await pauses(seller.userId)).toEqual([[]]);
  });

  it("riprendere a mano un negozio non riprende quelli in pausa per inattività", async () => {
    const seller = await linkedSeller("ripresa-manuale@example.invalid");
    // Il negozio in pausa manuale non leggeva: la pausa per inattività ha fermato l'altro.
    await env.DB.batch([
      insertStore({ id: "secondo", workspaceId: seller.workspaceId }),
      env.DB.prepare(`INSERT INTO ebay_store_pauses (store_id, reason, paused_at)
          VALUES (?1, 'manual', ?3), (?2, 'inactivity', ?3)`).bind(seller.storeId, "secondo", now),
    ]);
    expect(await resumeStore(env.DB, seller.userId, seller.storeId)).toBe("done");
    expect(
      (await env.DB.prepare("SELECT store_id, reason FROM ebay_store_pauses").all()).results,
    ).toEqual([{ store_id: "secondo", reason: "inactivity" }]);
  });

  it("uno spazio senza attività registrata inizia il conteggio dal compito", async () => {
    const seller = await linkedSeller("senza-attivita@example.invalid");
    await env.DB.prepare("UPDATE workspaces SET active_at = NULL").run();
    const { send: email, mail } = mailer();
    await applyInactivity(mail, at(100));
    expect((await workspace(seller.workspaceId))!.active_at).toBe(at(100).toISOString());
    expect(email).not.toHaveBeenCalled();
  });

  it("un nuovo account non ripete prova e Free ricollegando lo stesso negozio", async () => {
    const seller = await linkedSeller("primo-account@example.invalid");
    await disconnectStore(env.DB, seller.userId, seller.storeId);
    expect(await deleteStoreData(env.DB, seller.userId, seller.storeId, "venditore")).toBe("done");
    const other = await verifiedSession("nuovo-account@example.invalid");
    const state = (await beginStoreLink(other.cookie)).searchParams.get("state");
    const attempt = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice`, other.cookie),
      env,
      syntheticEbay(),
    );
    expect(attempt.headers.get("location")).toContain("negozio=altro-spazio");
    expect(await startTrial(env.DB, other.userId)).toBeNull();
    // Il tentativo crea lo spazio vuoto, senza ciclo del Free né sblocchi.
    expect(await orderAllowance(env.DB, other.userId)).toMatchObject({
      cycle: null,
      remaining: 0,
      trialAvailable: false,
    });
  });

  it("la lista d'attesa vale per i nuovi Free: prima lettura e prova se gli acquisti sono aperti", async () => {
    const existing = await verifiedSession("esistente@example.invalid");
    await admissionSettings(1, 1);
    const seller = await linkedSeller("attesa@example.invalid");
    expect(await admission(env.DB, existing.userId)).toEqual({
      waiting: false,
      purchasesOpen: true,
    });
    expect(await admission(env.DB, seller.userId)).toEqual({
      waiting: true,
      purchasesOpen: true,
    });
    // Collegamento e prima lettura, poi nessuna lettura del Free e nessuno sblocco.
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({ importedOrders: 1 });
    expect(await dispatchStoreSyncs(cron, new Date())).toEqual([]);
    expect(await requestStoreSync(cron, seller.userId, seller.storeId)).toBe("invalid");
    expect(await orderAllowance(env.DB, seller.userId)).toMatchObject({
      waiting: true,
      remaining: 0,
      purchasesOpen: true,
    });
    // Ordini propone prova e Premium soltanto con gli acquisti aperti.
    await admissionSettings(1, 0);
    expect((await orderAllowance(env.DB, seller.userId))!.purchasesOpen).toBe(false);
    await admissionSettings(1, 1);
    const [order] = await listVisibleOrders(env.DB, seller.userId);
    await expect(unlockOrders(env.DB, seller.userId, [order!.id])).rejects.toMatchObject({
      code: "free_quota_exhausted",
    });
    const page = (await settingsPage(seller.cookie)).page;
    expect(page.account).toMatchObject({ waitlisted: true, trialAvailable: true });
    expect(page.purchase.state).toBe("available");
    // La prova non scorre in attesa: parte soltanto se scelta, e con essa le letture.
    expect(await startTrial(env.DB, seller.userId)).toEqual(expect.any(String));
    expect(await dispatchStoreSyncs(cron, at(0.01))).toEqual([seller.storeId]);
    expect((await settingsPage(seller.cookie)).page.account.waitlisted).toBeUndefined();
  });

  it("in lista d'attesa la prima lettura non si ripete con eventi, rinnovi o ricollegamenti", async () => {
    await admissionSettings(1, 1);
    // Una prima lettura non riuscita non conta: il ricollegamento la ritenta.
    const unavailable = syntheticEbay();
    const failing = vi.fn<typeof fetch>((input, init) =>
      String(input).includes("/sell/fulfillment/")
        ? Promise.resolve(new Response(null, { status: 503 }))
        : unavailable(input, init),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const session = await verifiedSession("attesa-letture@example.invalid");
    await linkThroughEbay(session.cookie, failing);
    errors.mockRestore();
    expect(await count("orders")).toBe(0);
    await linkThroughEbay(session.cookie);
    const { id: storeId } = (await env.DB.prepare("SELECT id FROM ebay_stores").first<{
      id: string;
    }>())!;
    expect((await listStores(env.DB, session.userId))[0]).toMatchObject({ importedOrders: 1 });
    const paths = (ebay: ReturnType<typeof syntheticEbay>) =>
      ebay.mock.calls.map(([input]) => new URL(String(input)).pathname);

    // Un evento di eBay si chiude senza chiamate.
    const { granted_at: grantedAt } = (await env.DB.prepare(
      "SELECT granted_at FROM ebay_store_credentials",
    ).first<{ granted_at: string }>())!;
    const event = syntheticEbay({ lastModifiedDate: new Date().toISOString() });
    await consumeOrderConfirmation(
      env,
      {
        storeId,
        grantedAt,
        environment: "production",
        orderId: syntheticOrderId,
        eventAt: new Date().toISOString(),
      },
      event,
      new Date(),
    );
    expect(event).not.toHaveBeenCalled();

    // Ricollegare dopo lo scollegamento, o dopo l'eliminazione dei dati, rinnova soltanto il
    // consenso.
    for (const remove of [
      () => disconnectStore(env.DB, session.userId, storeId),
      () => deleteStoreData(env.DB, session.userId, storeId, "venditore"),
    ]) {
      await remove();
      const relinked = syntheticEbay();
      await linkThroughEbay(session.cookie, relinked);
      expect(paths(relinked)).toEqual(["/identity/v1/oauth2/token", "/commerce/identity/v1/user/"]);
    }
    expect(await count("orders")).toBe(0);

    // Nessun rinnovo del token in attesa; con una copertura riprende anche se è scaduto.
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
      .bind(new Date(Date.now() - day).toISOString())
      .run();
    const refresh = syntheticEbay();
    expect(await refreshExpiringTokens(env, refresh)).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
    // Una copertura che inizia fra un'ora vale soltanto da allora. Il database dei test usa lo
    // stesso orologio simulato: le letture si provano a un istante successivo, passato come
    // parametro, così conta l'istante dato e non quello del database.
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         SELECT 'concessione', workspace_id, 'admin', ?1, ?2 FROM ebay_stores`,
    )
      .bind(new Date(Date.now() + hour).toISOString(), new Date(Date.now() + day).toISOString())
      .run();
    expect(await refreshExpiringTokens(env, refresh)).toEqual([]);
    const ahead = new Date(Date.now() + 2 * hour);
    expect(await refreshExpiringTokens(env, refresh, ahead)).toEqual(["refreshed"]);
    const covered = syntheticEbay({ lastModifiedDate: ahead.toISOString() });
    const relinked = (await env.DB.prepare("SELECT granted_at FROM ebay_store_credentials").first<{
      granted_at: string;
    }>())!.granted_at;
    await consumeOrderConfirmation(
      env,
      {
        storeId,
        grantedAt: relinked,
        environment: "production",
        // L'ordine già letto è stato eliminato con i dati del negozio: un ordine nuovo,
        // arrivato dopo l'eliminazione.
        orderId: "27-99999-99999",
        eventAt: ahead.toISOString(),
      },
      covered,
      ahead,
    ).catch(() => {
      // eBay simulato non conosce l'ordine: conta soltanto che la lettura parta.
    });
    expect(covered).toHaveBeenCalled();
    expect(await requestStoreSync(cron, session.userId, storeId, {}, ahead)).not.toBe("invalid");
    expect(await dispatchStoreSyncs(cron, ahead)).toEqual([storeId]);
  });

  it("senza capacità per nuovi Pro ferma acquisti, prova e collegamenti in attesa", async () => {
    const admitted = await linkedSeller("ammesso@example.invalid");
    await admissionSettings(1, 0);
    expect(await purchaseState(env.DB, admitted.userId)).toMatchObject({ state: "closed" });
    expect((await lifetimeContext(env.DB, env, admitted.userId))!.offer).toMatchObject({
      state: "closed",
    });
    expect(await startTrial(env.DB, admitted.userId)).toBeNull();
    const page = (await settingsPage(admitted.cookie)).page;
    expect(page.account.trialAvailable).toBe(false);
    expect(page.account.waitlisted).toBeUndefined();
    // Un utente esistente continua a leggere i suoi negozi.
    expect(await dispatchStoreSyncs(cron, at(0.03))).toEqual([admitted.storeId]);

    const waiting = await verifiedSession("bloccato@example.invalid");
    const refused = await routeResponse(storeLinkAction, "/app/negozi/collega", {
      cookie: waiting.cookie,
      fields: {},
    });
    expect(refused.headers.get("location")).toBe("/app/ordini?negozio=lista-attesa");
    // Con le chiamate eBay spente dalla console il collegamento non parte per nessuno.
    await setSwitch(env.DB, "ebay_calls", false);
    const suspended = await routeResponse(storeLinkAction, "/app/negozi/collega", {
      cookie: admitted.cookie,
      fields: { da: "negozi" },
    });
    expect(suspended.headers.get("location")).toBe("/app/negozi?negozio=sospeso");
    await setSwitch(env.DB, "ebay_calls", true);
    expect((await settingsPage(waiting.cookie)).page).toMatchObject({
      account: { waitlisted: true },
      purchase: { state: "closed" },
    });

    // Spenta la lista d'attesa, chi era in attesa viene ammesso e resta ammesso.
    await admissionSettings(0, 1);
    await applyInactivity(env, new Date());
    await admissionSettings(1, 1);
    expect(await admission(env.DB, waiting.userId)).toEqual({
      waiting: false,
      purchasesOpen: true,
    });
  });
});
