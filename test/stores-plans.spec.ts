import { env } from "cloudflare:workers";
import { insertOrder } from "./fixtures/database-fixtures";

import { describe, expect, it, vi } from "vitest";

import { pendingVisitWrites } from "../app/domain/admission.server";
import { listVisibleOrders } from "../app/domain/orders.server";

import { disconnectStore, listStores } from "../app/domain/stores.server";

import {
  applyFreePlan,
  applyFreePlans,
  chooseFreeStore,
  freeStoreState,
} from "../app/domain/free-store.server";

import type { ActionResult } from "../app/view-models";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { refreshExpiringTokens } from "../app/domain/token-refresh.server";

import {
  insertEntitlement,
  insertStore,
  insertWorkspace,
  resetOrderFixtures,
  type EntitlementSource,
} from "./fixtures/database-fixtures";

import { syntheticEbay } from "./fixtures/ebay-fixtures";

import { verifiedSession } from "./fixtures/account-fixtures";

import {
  day,
  linkThroughEbay,
  linkedSeller,
  count,
  grantImportedOrder,
  quotaUsed,
  settingsPage,
  saveSetting,
  setupScenarios,
} from "./fixtures/stores-scenarios";

setupScenarios();

describe("negozio attivo del Free e downgrade", () => {
  const iso = (at: number) => new Date(at).toISOString();

  /** Venditore con il negozio collegato da eBay e un secondo negozio collegato dopo. */
  async function twoStores(email: string) {
    const seller = await linkedSeller(email);
    await insertStore({
      id: "secondo",
      workspaceId: seller.workspaceId,
      linkedAt: iso(Date.now() + 60_000),
    }).run();
    return seller;
  }

  async function addOrder(id: string, storeId: string, created: number, retained?: number) {
    await env.DB.batch(
      insertOrder(id, {
        storeId,
        externalId: id,
        createdAt: iso(created),
        totalMinor: 100,
        retentionUntil: retained === undefined ? null : iso(retained),
        withItem: false,
        withTax: false,
      }),
    );
  }

  async function coverage(
    workspaceId: string,
    source: EntitlementSource,
    from: number,
    until: number,
  ) {
    await insertEntitlement({
      workspaceId,
      source,
      startsAt: iso(from),
      endsAt: iso(until),
    }).run();
  }

  const pauses = async (userId: string, at?: Date) =>
    Object.fromEntries(
      (await listStores(env.DB, userId, at)).map((store) => [store.id, store.pauseReasons]),
    );
  const visible = async (userId: string, at: number) =>
    (await listVisibleOrders(env.DB, userId, 50, "production", new Date(at)))
      .map((order) => order.id)
      .sort();
  const changes = async () =>
    (
      await env.DB.prepare(
        "SELECT store_id, kind FROM free_store_changes ORDER BY changed_at, rowid",
      ).all<{ store_id: string; kind: string }>()
    ).results;

  it("resta attivo il primo negozio collegato, anche scollegandolo, e gli altri sono in pausa", async () => {
    const seller = await twoStores("attivo@example.invalid");
    await addOrder("ordine-secondo", "secondo", Date.now() - day);
    await applyFreePlan(env.DB, seller.userId);
    expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
    expect(await changes()).toEqual([{ store_id: seller.storeId, kind: "default" }]);
    const [first] = await listVisibleOrders(env.DB, seller.userId);
    expect(await visible(seller.userId, Date.now())).toEqual([first!.id]);
    expect(await refreshExpiringTokens(env, vi.fn<typeof fetch>())).toEqual([]);

    // Scollegare e ricollegare il negozio attivo non porta un altro negozio al suo posto.
    await disconnectStore(env.DB, seller.userId, seller.storeId);
    await applyFreePlan(env.DB, seller.userId);
    expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
    await linkThroughEbay(seller.cookie);
    expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
    expect(await changes()).toEqual([{ store_id: seller.storeId, kind: "default" }]);
    expect(await visible(seller.userId, Date.now())).not.toContain("ordine-secondo");
  });

  it("un negozio collegato nel Free oltre a quello attivo va in pausa prima della prima lettura", async () => {
    const seller = await linkedSeller("collega@example.invalid");
    const ebay = syntheticEbay({ userId: "altro-venditore", orderId: "ordine-altro" });
    await linkThroughEbay(seller.cookie, ebay);
    const stores = await listStores(env.DB, seller.userId);
    expect(stores.map((store) => [store.id === seller.storeId, store.pauseReasons])).toEqual([
      [true, []],
      [false, ["plan"]],
    ]);
    expect(stores[1]).toMatchObject({ connection: "paused", importedOrders: 0 });
    expect(ebay.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/identity/v1/oauth2/token",
      "/commerce/identity/v1/user/",
    ]);
  });

  it("con una copertura tutti i negozi sono ammessi e al downgrade vale il primo ancora collegato", async () => {
    const seller = await twoStores("copertura@example.invalid");
    await applyFreePlan(env.DB, seller.userId);
    const start = Date.now();
    await coverage(seller.workspaceId, "trial", start - day, start + day);
    await applyFreePlan(env.DB, seller.userId);
    expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: [] });
    expect((await listStores(env.DB, seller.userId)).map((store) => store.targetMinutes)).toEqual([
      10, 10,
    ]);
    // In Premium nessun negozio predefinito: non anticipa la scelta del downgrade (D155).
    expect(await changes()).toEqual([]);
    expect(await freeStoreState(env.DB, seller.userId)).toBeNull();
    await disconnectStore(env.DB, seller.userId, seller.storeId);

    const after = new Date(start + 2 * day);
    await applyFreePlans(env.DB, after);
    expect(await pauses(seller.userId, after)).toEqual({
      [seller.storeId]: ["plan"],
      secondo: [],
    });
    expect(
      (await listStores(env.DB, seller.userId, after)).map((store) => store.targetMinutes),
    ).toEqual([30, 30]);
    expect(await changes()).toEqual([{ store_id: "secondo", kind: "default" }]);
  });

  it("la sostituzione dell'utente vale una volta ogni 90 giorni, soltanto nel Free", async () => {
    const seller = await twoStores("sostituzione@example.invalid");
    await insertStore({
      id: "terzo",
      workspaceId: seller.workspaceId,
      linkedAt: iso(Date.now() + 120_000),
    }).run();
    await applyFreePlan(env.DB, seller.userId);
    const chosenAt = Date.now();
    // La prima scelta è sempre ammessa; due richieste concorrenti ne registrano una sola.
    const [first, second] = await Promise.all([
      chooseFreeStore(env.DB, seller.userId, "secondo", new Date(chosenAt)),
      chooseFreeStore(env.DB, seller.userId, "terzo", new Date(chosenAt)),
    ]);
    expect(first).toEqual({ result: "done" });
    const changeFrom = iso(chosenAt + 90 * day);
    expect(second).toEqual({ result: "locked", changeFrom });
    expect(await pauses(seller.userId)).toEqual({
      [seller.storeId]: ["plan"],
      secondo: [],
      terzo: ["plan"],
    });
    expect(await freeStoreState(env.DB, seller.userId, new Date(chosenAt))).toEqual({
      stores: [
        { id: seller.storeId, name: "venditore" },
        { id: "secondo", name: "secondo" },
        { id: "terzo", name: "terzo" },
      ],
      activeId: "secondo",
      changeFrom,
    });
    // Scollegare e ricollegare non sposta il vincolo; il negozio già attivo non conta.
    await disconnectStore(env.DB, seller.userId, "secondo");
    expect(
      await chooseFreeStore(env.DB, seller.userId, seller.storeId, new Date(chosenAt + day)),
    ).toEqual({ result: "locked", changeFrom });
    expect(
      await chooseFreeStore(env.DB, seller.userId, "secondo", new Date(chosenAt + day)),
    ).toEqual({ result: "done" });
    expect(
      await chooseFreeStore(env.DB, seller.userId, "estraneo", new Date(chosenAt + day)),
    ).toEqual({ result: "not_found" });
    const later = new Date(chosenAt + 90 * day);
    expect(await chooseFreeStore(env.DB, seller.userId, seller.storeId, later)).toEqual({
      result: "done",
    });
    expect(await pauses(seller.userId, later)).toEqual({
      [seller.storeId]: [],
      secondo: ["plan"],
      terzo: ["plan"],
    });
    // In Premium la scelta non compare e non si registra.
    await coverage(seller.workspaceId, "premium", later.getTime(), later.getTime() + 30 * day);
    const covered = new Date(later.getTime() + 100 * day);
    await coverage(seller.workspaceId, "admin", covered.getTime() - day, covered.getTime() + day);
    expect(await chooseFreeStore(env.DB, seller.userId, "terzo", covered)).toEqual({
      result: "invalid",
    });
    expect((await changes()).filter((change) => change.kind === "choice")).toHaveLength(2);
  });

  it("l'eccezione assistita richiede motivo e autore e non tocca quota, prova o ciclo", async () => {
    const seller = await twoStores("assistenza@example.invalid");
    await grantImportedOrder(seller);
    await applyFreePlan(env.DB, seller.userId);
    await chooseFreeStore(env.DB, seller.userId, "secondo");
    const assisted = (reason: string | null, actor: string | null) =>
      env.DB.prepare(
        `INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at, reason, actor)
           VALUES (?, ?, ?, 'assisted', ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          seller.workspaceId,
          seller.storeId,
          iso(Date.now() + 1000),
          reason,
          actor,
        )
        .run();
    await expect(assisted(null, "assistenza@example.invalid")).rejects.toThrow("CHECK");
    await expect(assisted("Account eBay chiuso", null)).rejects.toThrow("CHECK");
    await expect(assisted(" ", "assistenza@example.invalid")).rejects.toThrow("CHECK");
    await assisted("Account eBay chiuso, nuovo negozio", "assistenza@example.invalid");
    await expect(
      env.DB.prepare(
        "UPDATE free_store_changes SET reason = 'altro' WHERE kind = 'assisted'",
      ).run(),
    ).rejects.toThrow("immutable_free_store_change");
    const after = new Date(Date.now() + 2000);
    await applyFreePlan(env.DB, seller.userId, after);
    expect(await pauses(seller.userId, after)).toEqual({
      [seller.storeId]: [],
      secondo: ["plan"],
    });
    expect(await quotaUsed()).toBe(1);
    expect(await count("free_cycles")).toBe(1);
    expect(await count("workspace_entitlements")).toBe(0);
    // Anche l'eccezione è una sostituzione: la prossima scelta attende 90 giorni.
    expect(await chooseFreeStore(env.DB, seller.userId, "secondo", after)).toMatchObject({
      result: "locked",
    });
  });

  /** Spazio con due negozi e ordini acquisiti con un anno di storico, poi tornato al Free. */
  async function downgraded(email: string) {
    const seller = await twoStores(email);
    await resetOrderFixtures();
    const end = Date.parse("2026-10-01T12:00:00.000Z");
    // Termini di un anno, come per gli ordini acquisiti con Premium.
    await addOrder("attivo-vecchio", seller.storeId, end - 60 * day, yearAfter(end - 60 * day));
    await addOrder("attivo-recente", seller.storeId, end - 5 * day, yearAfter(end - 5 * day));
    await addOrder("eccedente", "secondo", end - 5 * day, yearAfter(end - 5 * day));
    await coverage(seller.workspaceId, "trial", end - 14 * day, end);
    return { seller, end, applied: end + 60_000 };
  }
  const yearAfter = (at: number) => {
    const date = new Date(at);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    return date.getTime();
  };
  const terms = async () =>
    (
      await env.DB.prepare("SELECT id, retention_until, purge_after FROM orders ORDER BY id").all<{
        id: string;
        retention_until: string;
        purge_after: string;
      }>()
    ).results;

  it("al downgrade l'eccedenza non è più consultabile, resta 30 giorni e poi non torna con Pro", async () => {
    const { seller, end, applied } = await downgraded("downgrade@example.invalid");
    await applyFreePlans(env.DB, new Date(end - 60_000));
    expect(await visible(seller.userId, end - 60_000)).toEqual([
      "attivo-recente",
      "attivo-vecchio",
      "eccedente",
    ]);

    // Il cron applica il downgrade; anche prima del suo passaggio la visita lo applica.
    await applyFreePlan(env.DB, seller.userId, new Date(applied));
    expect(await visible(seller.userId, applied)).toEqual(["attivo-recente"]);
    const downgradeTerms = await terms();
    expect(downgradeTerms).toEqual([
      {
        id: "attivo-recente",
        retention_until: iso(end + 25 * day),
        purge_after: iso(applied + 30 * day),
      },
      {
        id: "attivo-vecchio",
        retention_until: iso(end - 30 * day),
        purge_after: iso(applied + 30 * day),
      },
      {
        id: "eccedente",
        retention_until: iso(end + 25 * day),
        purge_after: iso(applied + 30 * day),
      },
    ]);
    // Ripetere il riallineamento non allunga né accorcia i termini.
    await applyFreePlans(env.DB, new Date(applied + day));
    await applyFreePlan(env.DB, seller.userId, new Date(applied + day));
    expect(await terms()).toEqual(downgradeTerms);

    // Con la pulizia sospesa nessun accesso; prima del termine fisico i dati restano.
    await purgeExpiredRecords(env.DB, new Date(applied + 29 * day));
    expect(await count("orders")).toBe(3);
    expect(await visible(seller.userId, applied + 29 * day)).toEqual([]);

    // Dopo la pulizia il ritorno a Premium non ripristina i dati eliminati.
    await purgeExpiredRecords(env.DB, new Date(applied + 30 * day));
    expect(await count("orders")).toBe(0);
    // La scadenza non blocca il reimport: lo storico torna con una nuova lettura.
    expect(await count("deleted_order_keys")).toBe(0);
    const again = applied + 31 * day;
    await coverage(seller.workspaceId, "admin", again, again + day);
    await applyFreePlan(env.DB, seller.userId, new Date(again));
    expect(await visible(seller.userId, again)).toEqual([]);
  });

  it("il ritorno a Pro prima della pulizia riporta l'anno di storico agli ordini conservati", async () => {
    const { seller, end, applied } = await downgraded("ritorno@example.invalid");
    await applyFreePlan(env.DB, seller.userId, new Date(applied));
    const back = applied + 10 * day;
    await coverage(seller.workspaceId, "premium", back, back + 30 * day);
    await applyFreePlan(env.DB, seller.userId, new Date(back));
    expect(await visible(seller.userId, back)).toEqual([
      "attivo-recente",
      "attivo-vecchio",
      "eccedente",
    ]);
    expect(await terms()).toEqual(
      [
        ["attivo-recente", end - 5 * day],
        ["attivo-vecchio", end - 60 * day],
        ["eccedente", end - 5 * day],
      ].map(([id, created]) => ({
        id,
        retention_until: iso(yearAfter(created as number)),
        purge_after: iso(yearAfter(created as number)),
      })),
    );
    // Alla nuova fine della copertura torna la finestra del Free con altri trenta giorni.
    await applyFreePlans(env.DB, new Date(back + 30 * day));
    expect(await visible(seller.userId, back + 30 * day)).toEqual([]);
    expect(await terms()).toMatchObject([
      { id: "attivo-recente", purge_after: iso(back + 60 * day) },
      { id: "attivo-vecchio", purge_after: iso(back + 60 * day) },
      { id: "eccedente", purge_after: iso(back + 60 * day) },
    ]);
  });

  const alignedPlans = () => env.DB.prepare("UPDATE workspaces SET plan_changed_at = NULL").run();
  const planChanged = async (workspaceId: string) =>
    (await env.DB.prepare("SELECT plan_changed_at AS at FROM workspaces WHERE id = ?")
      .bind(workspaceId)
      .first<{ at: string | null }>())!.at;

  it("il cron rivede i termini dopo un downgrade recente o un cambiamento non riallineato", async () => {
    const seller = await linkedSeller("termini@example.invalid");
    await resetOrderFixtures();
    const end = Date.parse("2026-10-01T12:00:00.000Z");
    await addOrder("lungo", seller.storeId, end - 60 * day, end + 300 * day);
    await coverage(seller.workspaceId, "trial", end - 14 * day, end);
    await alignedPlans();
    const term = async () =>
      (await env.DB.prepare("SELECT retention_until FROM orders").first<{
        retention_until: string;
      }>())!.retention_until;
    await applyFreePlans(env.DB, new Date(end + 8 * day));
    expect(await term()).toBe(iso(end + 300 * day));
    await env.DB.prepare("UPDATE workspaces SET plan_changed_at = ?").bind(iso(end)).run();
    await applyFreePlans(env.DB, new Date(end + 8 * day));
    expect(await term()).toBe(iso(end - 30 * day));
    expect(await planChanged(seller.workspaceId)).toBeNull();
  });

  it("ogni cambiamento del piano chiede un riallineamento, quello del negozio predefinito no", async () => {
    const seller = await twoStores("cambiamenti@example.invalid");
    const marked = async (change: () => Promise<unknown>) => {
      await alignedPlans();
      await change();
      return (await planChanged(seller.workspaceId)) !== null;
    };
    const now = Date.now();
    expect(await marked(() => coverage(seller.workspaceId, "trial", now - day, now + day))).toBe(
      true,
    );
    expect(
      await marked(() =>
        env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
          .bind(iso(now), seller.workspaceId)
          .run(),
      ),
    ).toBe(true);
    expect(
      await marked(() =>
        env.DB.prepare("DELETE FROM workspace_entitlements WHERE workspace_id = ?")
          .bind(seller.workspaceId)
          .run(),
      ),
    ).toBe(true);
    expect(
      await marked(() =>
        env.DB.prepare(
          `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
          VALUES ('estensione', ?, 18, 'prova', 'console', ?)`,
        )
          .bind(seller.workspaceId, iso(now))
          .run(),
      ),
    ).toBe(true);
    expect(
      await marked(() =>
        env.DB.prepare("UPDATE history_extensions SET revoked_at = ? WHERE id = 'estensione'")
          .bind(iso(now))
          .run(),
      ),
    ).toBe(true);
    // Le letture aggiornano il negozio: soltanto i suoi campi che decidono il piano contano.
    expect(
      await marked(() =>
        env.DB.prepare("UPDATE ebay_stores SET store_profile_read_at = ? WHERE id = ?")
          .bind(iso(now), seller.storeId)
          .run(),
      ),
    ).toBe(false);
    expect(await marked(() => disconnectStore(env.DB, seller.userId, seller.storeId))).toBe(true);
    expect(
      await marked(() =>
        env.DB.prepare(
          `INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
          VALUES ('riallineato', ?, ?, 'default', ?)`,
        )
          .bind(seller.workspaceId, seller.storeId, iso(now))
          .run(),
      ),
    ).toBe(false);
    expect(
      await marked(() =>
        env.DB.prepare(
          `INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
          VALUES ('scelto', ?, 'secondo', 'choice', ?)`,
        )
          .bind(seller.workspaceId, iso(now))
          .run(),
      ),
    ).toBe(true);
    expect(
      await marked(() => env.DB.prepare("DELETE FROM ebay_stores WHERE id = 'secondo'").run()),
    ).toBe(true);
    // Il riallineamento azzera il cambiamento, ma non uno successivo all'istante della lettura.
    await applyFreePlan(env.DB, seller.userId, new Date(now - day));
    expect(await planChanged(seller.workspaceId)).not.toBeNull();
    await applyFreePlan(env.DB, seller.userId, new Date(now + day));
    expect(await planChanged(seller.workspaceId)).toBeNull();
  });

  it("una pagina riallinea il piano e scrive l'attività soltanto quando serve", async () => {
    const seller = await twoStores("visita@example.invalid");
    const pending = (at = new Date()) => pendingVisitWrites(env.DB, seller.userId, at);
    await env.DB.prepare("UPDATE workspaces SET active_at = ?").bind(iso(Date.now())).run();
    await alignedPlans();
    expect(await pending()).toEqual({ plan: false, activity: false });
    expect(await pending(new Date(Date.now() + 2 * 3_600_000))).toEqual({
      plan: false,
      activity: true,
    });
    await coverage(seller.workspaceId, "trial", Date.now() - day, Date.now() + day);
    expect((await pending()).plan).toBe(true);
    await alignedPlans();
    // Chi è in attesa con la lista spenta va ammesso anche con l'attività già registrata.
    await env.DB.prepare("UPDATE user_profiles SET waitlisted_at = ? WHERE user_id = ?")
      .bind(iso(Date.now()), seller.userId)
      .run();
    expect((await pending()).activity).toBe(true);
    expect(await pendingVisitWrites(env.DB, "nessuno")).toEqual({ plan: false, activity: false });
  });

  it("il cron porta l'anno agli ordini di una copertura senza visite prima che scadano", async () => {
    const covered = await linkedSeller("concessa@example.invalid");
    await env.DB.batch(
      insertWorkspace({ id: "w-libero", name: "Libero", createdAt: new Date().toISOString() }),
    );
    await insertStore({ id: "negozio-libero", workspaceId: "w-libero" }).run();
    const free = { storeId: "negozio-libero" };
    await resetOrderFixtures();
    const at = Date.parse("2026-10-01T12:00:00.000Z");
    // Termini del Free, assegnati all'import prima della copertura.
    await addOrder("coperto", covered.storeId, at - 29.5 * day);
    await addOrder("libero", free.storeId, at - 29.5 * day);
    await coverage(covered.workspaceId, "admin", at - 20 * day, at + 30 * day);
    const term = async (id: string) =>
      (await env.DB.prepare("SELECT retention_until FROM orders WHERE id = ?")
        .bind(id)
        .first<{ retention_until: string }>())!.retention_until;
    await alignedPlans();
    // Il cron non rivede ogni giorno tutti gli ordini: soltanto quelli che scadono entro un giorno.
    await applyFreePlans(env.DB, new Date(at - 2 * day));
    expect(await term("coperto")).toBe(iso(at + 0.5 * day));
    await applyFreePlans(env.DB, new Date(at));
    expect(await term("coperto")).toBe("2027-09-02T00:00:00.000Z");
    expect(await term("libero")).toBe(iso(at + 0.5 * day));
  });

  it("con la copertura in corso la revoca dell'estensione riporta i termini all'anno, con trenta giorni", async () => {
    const seller = await linkedSeller("estensione-revocata@example.invalid");
    await resetOrderFixtures();
    const at = Date.parse("2026-10-01T12:00:00.000Z");
    const months = (from: number, count: number) => {
      const date = new Date(from);
      date.setUTCMonth(date.getUTCMonth() + count);
      return date.getTime();
    };
    // Uno oltre l'anno, conservato dall'estensione di diciotto mesi; uno dentro l'anno.
    const extended = at - 450 * day;
    const recent = at - 60 * day;
    await addOrder("esteso", seller.storeId, extended, months(extended, 18));
    await addOrder("annuale", seller.storeId, recent, yearAfter(recent));
    await coverage(seller.workspaceId, "admin", at - 500 * day, at + 30 * day);
    await env.DB.prepare(
      `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at, revoked_at)
         VALUES ('x-revocata', ?1, 18, 'Storico verificato', 'owner', ?2, ?3)`,
    )
      .bind(seller.workspaceId, iso(at - 500 * day), iso(at - day))
      .run();
    const expected = [
      {
        id: "annuale",
        retention_until: iso(yearAfter(recent)),
        purge_after: iso(yearAfter(recent)),
      },
      {
        id: "esteso",
        retention_until: iso(months(extended, 12)),
        purge_after: iso(at + 30 * day),
      },
    ];
    // Il cron rivede lo spazio per la revoca recente; ripetere non sposta i termini.
    await applyFreePlans(env.DB, new Date(at));
    expect(await terms()).toEqual(expected);
    await applyFreePlans(env.DB, new Date(at + day));
    await applyFreePlan(env.DB, seller.userId, new Date(at + day));
    expect(await terms()).toEqual(expected);
  });

  it("il piano mostra e registra la scelta del negozio attivo soltanto nel Free", async () => {
    const seller = await twoStores("piano-negozio@example.invalid");
    expect((await settingsPage(seller.cookie)).page.freeStore).toEqual({
      stores: [
        { id: seller.storeId, name: "venditore" },
        { id: "secondo", name: "secondo" },
      ],
      activeId: seller.storeId,
      changeFrom: null,
    });
    expect(await saveSetting(seller.cookie, { intent: "free-store", store: "secondo" })).toEqual({
      ok: true,
      notice: "Negozio attivo aggiornato.",
    });
    const locked = (await saveSetting(seller.cookie, {
      intent: "free-store",
      store: seller.storeId,
    })) as { data: ActionResult; init: ResponseInit };
    expect(locked.init.status).toBe(409);
    expect(locked.data.notice).toMatch(/^Potrai sostituire il negozio attivo dal /u);
    const missing = (await saveSetting(seller.cookie, {
      intent: "free-store",
      store: "estraneo",
    })) as { init: ResponseInit };
    expect(missing.init.status).toBe(404);
    // Il negozio di un altro spazio vale come inesistente e la scelta resta quella salvata.
    const other = await verifiedSession("piano-negozio-altro@example.invalid");
    await env.DB.batch(insertWorkspace({ id: "w-altrui", userId: other.userId }));
    await insertStore({ id: "altrui", workspaceId: "w-altrui" }).run();
    const othersStore = (await saveSetting(seller.cookie, {
      intent: "free-store",
      store: "altrui",
    })) as { init: ResponseInit };
    expect(othersStore.init.status).toBe(404);
    const foreign = (await saveSetting(
      seller.cookie,
      { intent: "free-store", store: seller.storeId },
      "https://estraneo.invalid",
    )) as Response;
    expect(foreign.status).toBe(403);
    expect((await settingsPage(seller.cookie)).page.freeStore).toMatchObject({
      activeId: "secondo",
      changeFrom: expect.any(String),
    });
    await coverage(seller.workspaceId, "trial", Date.now() - day, Date.now() + day);
    expect((await settingsPage(seller.cookie)).page.freeStore).toBeNull();
    expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: [] });
  });
});
