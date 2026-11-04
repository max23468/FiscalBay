import { env } from "cloudflare:workers";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listVisibleOrders,
  searchVisibleOrders,
  visibleOrderState,
} from "../app/domain/orders.server";

import { searchTokens } from "../app/orders/order-search";

import { listStores } from "../app/domain/stores.server";

import { applyFreePlans } from "../app/domain/free-store.server";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { sealToken } from "../app/integrations/ebay/seller-credentials.server";

import {
  insertCredentials,
  insertEntitlement,
  insertStorePause,
  now,
  type EntitlementSource,
} from "./fixtures/database-fixtures";

import { order } from "./fixtures/ebay-client-fixtures";

import {
  grantedAt,
  ebay,
  calls,
  acquire,
  syncState,
  count,
  cronTurn,
  series,
  setupScenarios,
  slices,
} from "./fixtures/order-acquisition-scenarios";

setupScenarios();

describe("finestra dello storico secondo la copertura", () => {
  const day = 86_400_000;
  const linked = Date.parse("2026-09-02T00:00:00.000Z");
  const iso = (at: number) => new Date(at).toISOString();
  /** Stesso istante dodici mesi di calendario prima o dopo. */
  const months = (at: number, value: number) => {
    const date = new Date(at);
    date.setUTCMonth(date.getUTCMonth() + value);
    return date.getTime();
  };
  const dated = (orderId: string, created: number) =>
    order({
      orderId,
      creationDate: iso(created),
      lastModifiedDate: iso(created + 60_000),
      lineItems: [],
    });
  const coverage = (from: number, until: number, source: EntitlementSource = "trial") =>
    insertEntitlement({ source, startsAt: iso(from), endsAt: iso(until) }).run();
  const terms = async () =>
    Object.fromEntries(
      (
        await env.DB.prepare(
          "SELECT ebay_order_id, retention_until FROM orders WHERE store_id = 's-a'",
        ).all<{ ebay_order_id: string; retention_until: string }>()
      ).results.map((row) => [row.ebay_order_id, row.retention_until]),
    );
  const historyFilters = (fetcher: ReturnType<typeof ebay>) => slices(fetcher, "creationdate");
  const history = () =>
    env.DB.prepare(
      `SELECT history_from, history_until, history_through, history_done_at
           FROM sync_state WHERE store_id = 's-a'`,
    ).first<Record<string, string | null>>();

  beforeEach(() => env.DB.prepare("DELETE FROM orders").run());

  it("all'attivazione importa il resto dell'anno, interrotto e ripreso, senza rileggere il Free", async () => {
    const older = series("12-esteso", 60, iso(linked - 30 * day));
    const orders = [
      dated("12-recente", linked - 10 * day),
      ...older,
      dated("12-oltre-anno", months(linked, -13)),
    ];
    await acquire(ebay({ orders }), iso(linked));
    expect(await terms()).toEqual({ "12-recente": iso(linked - 10 * day + 30 * day) });

    // Prova attiva: l'esecuzione successiva legge soltanto il periodo più vecchio.
    const active = linked + 60 * 60_000;
    await coverage(active, active + 14 * day);
    let requests = 0;
    const failing = ebay({
      orders,
      pageLimit: 25,
      fail: (url) => {
        if (!url.searchParams.get("filter")?.startsWith("creationdate:")) return undefined;
        requests += 1;
        return requests === 3 ? new Response(null, { status: 503 }) : undefined;
      },
    });
    await expect(acquire(failing, iso(active))).rejects.toMatchObject({
      failure: "unavailable",
    });
    const [first, applied] = historyFilters(failing);
    expect(first).toBe(`${iso(months(active, -12))}..${iso(linked - 30 * day)}`);
    const through = applied!.split("..")[0]!;
    expect(applied).toBe(`${through}..${iso(linked - 30 * day)}`);
    expect(await history()).toMatchObject({
      history_from: iso(months(active, -12)),
      history_until: iso(linked),
      history_through: through,
      history_done_at: null,
    });
    expect((await listStores(env.DB, "u-a", new Date(active)))[0]).toMatchObject({
      history: { days: 365, done: false },
    });

    const resumed = ebay({ orders, pageLimit: 25 });
    expect(await acquire(resumed, iso(active + 30 * 60_000))).toBe("complete");
    // Il tratto applicato non si rilegge.
    expect(historyFilters(resumed)[0]).toBe(`${iso(months(active, -12))}..${through}`);
    expect(historyFilters(resumed).every((range) => range.split("..")[1]! <= through)).toBe(true);
    const acquired = await terms();
    expect(Object.keys(acquired)).toHaveLength(61);
    expect(acquired["12-oltre-anno"]).toBeUndefined();
    // Gli ordini arrivati con la copertura hanno il termine di un anno dalla loro data.
    expect(acquired["12-esteso-00000"]).toBe(iso(months(Date.parse(older[0]!.creationDate), 12)));
    expect(await history()).toMatchObject({
      history_from: iso(months(active, -12)),
      history_through: null,
      history_done_at: iso(active + 30 * 60_000),
    });
    expect((await listStores(env.DB, "u-a", new Date(active + day)))[0]).toMatchObject({
      history: { days: 365, done: true },
    });

    // La finestra che avanza non riapre lo storico.
    const later = ebay({ orders });
    await acquire(later, iso(active + day));
    expect(historyFilters(later)).toEqual([]);
  });

  it("elenco, dettaglio, ricerca e pulizia rispettano lo stesso termine di un anno", async () => {
    await coverage(linked - day, linked + 400 * day, "admin");
    const created = months(linked, -11);
    await acquire(ebay({ orders: [dated("12-confine", created)] }), iso(linked));
    const end = months(created, 12);
    expect(await terms()).toEqual({ "12-confine": iso(end) });
    const id = (await env.DB.prepare("SELECT id FROM orders").first<{ id: string }>())!.id;
    const seen = async (at: number) => ({
      list: (await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(at))).length,
      detail: (await visibleOrderState(env.DB, "u-a", "production", id, new Date(at))) !== null,
      search: (
        await searchVisibleOrders(
          env.DB,
          "u-a",
          "production",
          new Date(at),
          searchTokens("12-confine"),
        )
      ).total,
    });
    expect(await seen(end - 1)).toEqual({ list: 1, detail: true, search: 1 });
    // Con la pulizia sospesa l'ordine c'è ancora ma non si consulta.
    await purgeExpiredRecords(env.DB, new Date(end - 1));
    expect(await seen(end)).toEqual({ list: 0, detail: false, search: 0 });
    await purgeExpiredRecords(env.DB, new Date(end));
    expect(await terms()).toEqual({});
  });

  it("non cerca i dati fiscali su Trading per gli ordini oltre i novanta giorni", async () => {
    await coverage(linked - day, linked + 400 * day, "admin");
    const fetcher = ebay({
      orders: [
        dated("12-recente", linked - 89 * day),
        // Esattamente novanta giorni prima: già fuori dalla portata di Trading.
        dated("12-confine", linked - 90 * day),
        dated("12-vecchio", linked - 91 * day),
      ],
    });
    expect(await acquire(fetcher, iso(linked))).toBe("complete");
    // Soltanto l'ordine ancora alla portata di Trading; l'altro chiude il dettaglio senza CF.
    expect(calls(fetcher, "GetOrders")).toBe(1);
    expect(
      await count(
        "SELECT COUNT(*) AS total FROM order_source_refs WHERE detail_for = last_modified_time",
      ),
    ).toBe(3);
  });

  it("il ritorno al Free chiude l'estensione dove era arrivata e una nuova copertura la riprende", async () => {
    const orders = series("12-esteso", 60, iso(linked - 30 * day));
    await acquire(ebay({ orders }), iso(linked));
    const active = linked + 60 * 60_000;
    await coverage(active, active + day);
    const partial = ebay({ orders, pageLimit: 25 });
    expect(await acquire(partial, iso(active), { calls: 30, pages: 3 })).toBe("budget");
    // Un tratto troppo denso e uno applicato.
    const through = historyFilters(partial)[1]!.split("..")[0]!;
    expect(await history()).toMatchObject({ history_through: through, history_done_at: null });
    const kept = Object.keys(await terms()).length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(60);

    // Senza copertura il periodo rimasto è fuori dalla finestra: nessuna pagina dello storico.
    const free = active + 2 * day;
    const stopped = ebay({ orders });
    expect(await acquire(stopped, iso(free))).toBe("complete");
    expect(historyFilters(stopped)).toEqual([]);
    expect(await history()).toEqual({
      history_from: through,
      history_until: iso(linked),
      history_through: null,
      history_done_at: iso(free),
    });
    expect((await listStores(env.DB, "u-a", new Date(free)))[0]).toMatchObject({
      history: { days: 30, done: true },
    });

    const again = free + day;
    await coverage(again, again + 30 * day, "premium");
    const resumed = ebay({ orders });
    expect(await acquire(resumed, iso(again))).toBe("complete");
    expect(historyFilters(resumed)).toEqual([`${iso(months(again, -12))}..${through}`]);
    expect(Object.keys(await terms())).toHaveLength(60);
  });

  it("un ordine eliminato alla scadenza del Free torna con la copertura", async () => {
    const kept = dated("12-eliminato", linked - 20 * day);
    await acquire(ebay({ orders: [kept] }), iso(linked));
    expect(Object.keys(await terms())).toEqual(["12-eliminato"]);
    const expired = linked + 11 * day;
    await purgeExpiredRecords(env.DB, new Date(expired));
    expect(await terms()).toEqual({});
    // La scadenza non è una cancellazione voluta: nessun blocco del reimport.
    expect(
      await count(
        "SELECT COUNT(*) AS total FROM deleted_order_keys WHERE external_key LIKE '12-eliminato%'",
      ),
    ).toBe(0);

    // Con la prova eBay lo restituisce fra i modificati e torna con il termine di un anno.
    await coverage(expired, expired + 14 * day);
    const replay = ebay({
      orders: [{ ...kept, lastModifiedDate: iso(expired + 60_000) }],
    });
    expect(await acquire(replay, iso(expired + 30 * 60_000))).toBe("complete");
    expect(await terms()).toEqual({ "12-eliminato": iso(months(linked - 20 * day, 12)) });
  });

  it("l'estensione concessa vale con la copertura, fino a due anni, e la revoca riporta l'anno", async () => {
    await env.DB.prepare(
      `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
         VALUES ('x-a', 'w-a', 24, 'Periodo recuperabile verificato', 'assistenza', ?)`,
    )
      .bind(iso(linked - day))
      .run();
    const orders = [
      dated("12-diciotto-mesi", months(linked, -18)),
      dated("12-dieci-mesi", months(linked, -10)),
    ];
    // Senza copertura l'estensione non vale: trenta giorni.
    const free = ebay({ orders });
    await acquire(free, iso(linked));
    expect(historyFilters(free)).toEqual([`${iso(linked - 30 * day)}..${iso(linked)}`]);

    const active = linked + 60 * 60_000;
    await coverage(active, active + 30 * day);
    await acquire(ebay({ orders }), iso(active));
    const created = Date.parse(orders[0]!.creationDate);
    expect(await terms()).toEqual({
      "12-diciotto-mesi": iso(months(created, 24)),
      "12-dieci-mesi": iso(months(Date.parse(orders[1]!.creationDate), 24)),
    });
    expect(await history()).toMatchObject({ history_from: iso(months(active, -24)) });

    // La revoca riporta la finestra a un anno: l'ordine più vecchio non è più consultabile e
    // resta trenta giorni, come dopo un downgrade; il cron lo rivede senza visite.
    // Durata, motivo e autore non cambiano: un'estensione diversa è una nuova riga.
    for (const change of ["months = 13", "reason = 'altro'", "actor = 'altri'"])
      await expect(
        env.DB.prepare(`UPDATE history_extensions SET ${change} WHERE id = 'x-a'`).run(),
      ).rejects.toThrow("immutable_history_extension");
    const revoked = active + day;
    await env.DB.prepare("UPDATE history_extensions SET revoked_at = ? WHERE id = 'x-a'")
      .bind(iso(revoked))
      .run();
    // La revoca si registra una volta.
    await expect(
      env.DB.prepare("UPDATE history_extensions SET revoked_at = NULL WHERE id = 'x-a'").run(),
    ).rejects.toThrow("immutable_history_extension");
    await applyFreePlans(env.DB, new Date(revoked + 60_000));
    expect(
      await env.DB.prepare(
        "SELECT retention_until, purge_after FROM orders WHERE ebay_order_id = '12-diciotto-mesi'",
      ).first(),
    ).toEqual({
      retention_until: iso(months(created, 12)),
      purge_after: iso(revoked + 60_000 + 30 * day),
    });
    expect(
      (await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(revoked + 60_000))).map(
        (row) => row.ebayOrderId,
      ),
    ).toEqual(["12-dieci-mesi"]);
  });

  it("Negozi mostra i giorni della finestra anche con la copertura attivata mesi dopo", async () => {
    const orders = [dated("12-recente", linked - 10 * day)];
    await acquire(ebay({ orders }), iso(linked));
    const store = async (at: number) => (await listStores(env.DB, "u-a", new Date(at)))[0]!.history;
    expect(await store(linked + 59 * day)).toEqual({ days: 30, done: true });

    // Prova attivata due mesi dopo: l'anno è da importare finché la lettura non lo legge.
    const active = linked + 60 * day;
    await coverage(active, active + 14 * day);
    expect(await store(active)).toEqual({ days: 365, done: false });
    expect(await acquire(ebay({ orders }), iso(active))).toBe("complete");
    expect(await history()).toMatchObject({
      history_from: iso(months(active, -12)),
      history_until: iso(linked),
    });
    expect(await store(active + day)).toEqual({ days: 365, done: true });

    // Un'estensione di due anni allarga la finestra: i giorni in più restano da importare.
    await env.DB.prepare(
      `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
         VALUES ('x-b', 'w-a', 24, 'Periodo recuperabile verificato', 'assistenza', ?)`,
    )
      .bind(iso(active + day))
      .run();
    const extended = active + 2 * day;
    expect(await store(extended)).toEqual({ days: 730, done: false });
    expect(await acquire(ebay({ orders }), iso(extended))).toBe("complete");
    expect(await store(extended)).toEqual({ days: 730, done: true });

    // Alla fine della prova si consultano i trenta giorni del Free.
    expect(await store(active + 15 * day)).toEqual({ days: 30, done: true });
  });
});

it("rimanda il dettaglio dopo un errore dell'ordine e lo chiude dopo l'ultimo tentativo", async () => {
  const rejected = () =>
    new Response(
      `<GetOrdersResponse><Ack>Failure</Ack><Errors><ErrorCode>10007</ErrorCode>` +
        `<SeverityCode>Error</SeverityCode><ErrorClassification>RequestError</ErrorClassification>` +
        `</Errors></GetOrdersResponse>`,
    );
  const orders = [order({ lineItems: [] })];
  const detail = () =>
    env.DB.prepare(
      `SELECT detail_for, detail_error, detail_attempts, detail_retry_at
           FROM order_source_refs WHERE external_order_id = '12-34567-89012'`,
    ).first();

  // eBay non disponibile: l'ordine si salva, il dettaglio resta da leggere e l'esecuzione si ferma.
  await expect(
    acquire(ebay({ orders, trading: () => new Response(null, { status: 503 }) })),
  ).rejects.toMatchObject({ failure: "unavailable" });
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(1);
  expect(await detail()).toEqual({
    detail_for: null,
    detail_error: "unavailable",
    detail_attempts: 0,
    detail_retry_at: null,
  });

  // Un rifiuto riguarda il solo ordine: nuovi tentativi a 15 minuti, 1, 4 e 16 ore.
  let at = Date.parse("2026-09-02T00:00:00.000Z");
  for (const [attempt, minutes] of [15, 60, 240, 960].entries()) {
    const fetcher = ebay({ orders, trading: rejected });
    expect(await acquire(fetcher, new Date(at).toISOString())).toBe("complete");
    expect(calls(fetcher, "GetOrders")).toBe(1);
    const retryAt = new Date(at + minutes * 60_000).toISOString();
    expect(await detail()).toEqual({
      detail_for: null,
      detail_error: "rejected",
      detail_attempts: attempt + 1,
      detail_retry_at: retryAt,
    });
    // Prima della scadenza nessuna nuova lettura.
    const early = ebay({ orders, trading: rejected });
    await acquire(early, new Date(at + minutes * 60_000 - 1).toISOString());
    expect(calls(early, "GetOrders")).toBe(0);
    at += minutes * 60_000;
  }
  await acquire(ebay({ orders, trading: rejected }), new Date(at).toISOString());
  expect(await detail()).toEqual({
    detail_for: "2026-09-01T09:00:00.000Z",
    detail_error: "rejected",
    detail_attempts: 0,
    detail_retry_at: null,
  });
  const closed = ebay({ orders });
  await acquire(closed, new Date(at + 1).toISOString());
  expect(calls(closed, "GetOrders")).toBe(0);
  expect(await count("SELECT COUNT(*) AS total FROM tax_identifiers")).toBe(0);

  // Una nuova versione con gli stessi campi dell'ordine riapre il dettaglio: il dato fiscale
  // aggiunto dall'acquirente non dipende da un cambiamento visibile dell'ordine.
  orders[0] = { ...orders[0]!, lastModifiedDate: new Date(at + 2).toISOString() };
  await acquire(ebay({ orders }), new Date(at + 3).toISOString());
  expect(await detail()).toEqual({
    detail_for: new Date(at + 2).toISOString(),
    detail_error: null,
    detail_attempts: 0,
    detail_retry_at: null,
  });
  expect(await count("SELECT COUNT(*) AS total FROM tax_identifiers")).toBe(1);
});

it.each([false, true])(
  "ferma l'acquisizione con consenso rifiutato, risposta già in corso: %s",
  async (inFlight) => {
    const rejectedAt = "2026-09-02T00:00:00.000Z";
    const reject = () =>
      env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ? WHERE store_id = 's-a'")
        .bind(rejectedAt)
        .run();
    if (!inFlight) await reject();
    const fetcher = ebay({
      orders: [order({ lastModifiedDate: rejectedAt })],
      before: async () => {
        if (inFlight) await reject();
      },
    });

    expect(await acquire(fetcher)).toBe("not_writable");
    expect(fetcher).toHaveBeenCalledTimes(inFlight ? 1 : 0);
    for (const table of [
      "orders",
      "order_items",
      "tax_identifiers",
      "order_source_refs",
      "sync_runs",
    ])
      expect(await count(`SELECT COUNT(*) AS total FROM ${table}`)).toBe(0);
    if (inFlight)
      expect(await syncState()).toMatchObject({
        cursor: rejectedAt,
        recent_end: null,
        history_through: null,
        history_done_at: null,
        last_success_at: null,
        locked_until: null,
      });
    else expect(await syncState()).toBeNull();
  },
);

it("non sovrappone due esecuzioni e non scrive senza il consenso con cui è partita", async () => {
  const fetcher = ebay();
  await env.DB.prepare(
    "INSERT INTO sync_state (store_id, locked_until, updated_at) VALUES ('s-a', ?, ?)",
  )
    .bind("2026-09-02T00:10:00.000Z", now)
    .run();
  expect(await acquire(fetcher)).toBe("busy");
  expect(fetcher).not.toHaveBeenCalled();
  // La schermata Negozi vede la sincronizzazione in corso fino alla scadenza del blocco.
  const syncing = async (at: string) => (await listStores(env.DB, "u-a", new Date(at)))[0]!.syncing;
  expect(await syncing("2026-09-02T00:09:59.999Z")).toBe(true);
  expect(await syncing("2026-09-02T00:10:00.000Z")).toBe(false);
  // Un blocco scaduto non trattiene il negozio.
  expect(await acquire(fetcher, "2026-09-02T00:10:00.000Z")).toBe("complete");
  expect((await syncState())!.locked_until).toBeNull();

  await insertStorePause().run();
  const paused = ebay();
  expect(await acquire(paused, "2026-09-03T00:00:00.000Z")).toBe("not_writable");
  expect(paused).not.toHaveBeenCalled();
  await env.DB.prepare("DELETE FROM ebay_store_pauses").run();

  // Un nuovo consenso durante la lettura: la pagina non scrive e il checkpoint resta.
  await env.DB.prepare("DELETE FROM orders").run();
  const before = await syncState();
  const reconnected = ebay({
    orders: series("12-consenso", 30, "2026-09-03T00:00:00.000Z").map((item) => ({
      ...item,
      lastModifiedDate: "2026-09-02T12:00:00.000Z",
    })),
    before: async () => {
      await env.DB.prepare(
        "UPDATE ebay_store_credentials SET granted_at = '2026-09-03T00:00:00.000Z'",
      ).run();
    },
  });
  expect(await acquire(reconnected, "2026-09-03T00:00:00.000Z")).toBe("not_writable");
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(0);
  expect(await syncState()).toEqual({ ...before, locked_until: null });
});

it("rispetta separatamente chiamate e pagine e lascia il dettaglio alle chiamate rimaste", async () => {
  const reset = () => env.DB.prepare("DELETE FROM sync_state").run();
  const orders = series("12-budget", 60, "2026-09-02T00:00:00.000Z");
  // Senza chiamate lo storico non parte, anche con pagine disponibili.
  const noCalls = ebay({ orders });
  expect(await acquire(noCalls, undefined, { calls: 1, pages: 10 })).toBe("budget");
  // I recenti e la prima lettura del profilo del negozio, che non scala il budget.
  expect(noCalls).toHaveBeenCalledTimes(3);
  await reset();
  // Senza pagine lo storico non parte, anche con chiamate disponibili.
  const noPages = ebay({ orders });
  expect(await acquire(noPages, undefined, { calls: 10, pages: 1 })).toBe("budget");
  expect(noPages).toHaveBeenCalledTimes(1);

  // Recenti incompleti: nessuna ultima sincronizzazione e lo storico aspetta.
  await reset();
  await acquire(ebay({ orders: [] }));
  const recent = series("12-recenti", 30, "2026-09-01T00:00:00.000Z").map((item) => ({
    ...item,
    lastModifiedDate: "2026-09-02T00:30:00.000Z",
  }));
  const partial = ebay({ orders: recent, pageLimit: 25 });
  // Anche con il profilo del negozio da rileggere, recenti incompleti non lo leggono.
  await env.DB.prepare("UPDATE ebay_stores SET store_profile_read_at = NULL").run();
  expect(await acquire(partial, "2026-09-02T01:00:00.000Z", { calls: 1, pages: 1 })).toBe("budget");
  expect(partial).toHaveBeenCalledTimes(1);
  expect(await syncState()).toMatchObject({
    last_success_at: "2026-09-02T00:00:00.000Z",
    recent_end: null,
  });

  // Finite le pagine, le chiamate rimaste leggono il dettaglio fino al budget.
  const details = ebay({ orders: recent });
  expect(await acquire(details, "2026-09-02T01:10:00.000Z", { calls: 10, pages: 1 })).toBe(
    "budget",
  );
  const singles = details.mock.calls.filter(([input]) =>
    new URL(String(input)).pathname.includes("/order/"),
  );
  expect([singles.length, calls(details, "GetOrders")]).toEqual([4, 4]);
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T01:10:00.000Z",
    recent_end: null,
    last_success_at: "2026-09-02T01:10:00.000Z",
  });

  // Con chiamate per un solo dettaglio di due, l'esecuzione non si dichiara completa.
  await acquire(ebay({ orders: recent }), "2026-09-02T01:20:00.000Z");
  await env.DB.prepare(
    `UPDATE order_source_refs SET detail_for = NULL
        WHERE external_order_id IN (SELECT external_order_id FROM order_source_refs LIMIT 2)`,
  ).run();
  const last = ebay({ orders: recent });
  expect(await acquire(last, "2026-09-02T01:30:00.000Z", { calls: 3, pages: 1 })).toBe("budget");
  expect(calls(last, "GetOrders")).toBe(1);
  expect(await acquire(ebay({ orders: recent }), "2026-09-02T01:40:00.000Z")).toBe("complete");
});

it("limita le immagini per versione e rimanda il dettaglio senza chiamate sufficienti", async () => {
  const [line] = order().lineItems;
  const listings = Array.from({ length: 10 }, (_, index) => ({
    ...line,
    lineItemId: `2000000000${index}`,
    legacyItemId: `21000000000${index}`,
  }));
  const many = ebay({ orders: [order({ lineItems: listings })] });
  await acquire(many);
  expect(calls(many, "GetItem")).toBe(8);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM deleted_order_keys"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  // Due pagine, il dettaglio e tre delle otto immagini necessarie: l'ordine si legge una
  // volta sola e resta in attesa.
  const short = ebay({ orders: [order({ lineItems: listings.slice(0, 8) })] });
  expect(await acquire(short, undefined, { calls: 8, pages: 3 })).toBe("budget");
  expect([calls(short, "GetItem"), calls(short, "GetOrders")]).toEqual([0, 0]);
  expect(
    short.mock.calls.filter(([input]) => new URL(String(input)).pathname.includes("/order/")),
  ).toHaveLength(1);
  expect(
    await env.DB.prepare("SELECT detail_for, detail_attempts FROM order_source_refs").first(),
  ).toEqual({ detail_for: null, detail_attempts: 0 });
});

it("ferma l'acquisizione quando GetItem rifiuta le credenziali", async () => {
  const provider = ebay({ getItem: () => new Response(null, { status: 401 }) });
  await expect(acquire(provider)).rejects.toMatchObject({ failure: "credentials" });
  expect(calls(provider, "GetOrders")).toBe(0);
});

it("con la quota GetOrders già in attesa rimanda la lettura fiscale senza chiamare Trading", async () => {
  const detail = () =>
    env.DB.prepare(
      "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
    ).first();
  await env.DB.prepare(
    "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com#GetOrders', ?)",
  )
    .bind("2026-09-02T00:15:00.000Z")
    .run();
  const limited = ebay();
  expect(await acquire(limited)).toBe("budget");
  expect(limited.mock.calls.some(([, init]) => String(init?.body).includes("GetOrders"))).toBe(
    false,
  );
  expect(await detail()).toEqual({
    detail_for: null,
    detail_error: "rate_limited",
    detail_attempts: 0,
  });
  // Alla scadenza dell'attesa la lettura fiscale riparte e chiude la versione.
  const resumed = ebay();
  expect(await acquire(resumed, "2026-09-02T00:15:00.000Z")).toBe("complete");
  expect(calls(resumed, "GetOrders")).toBe(1);
  expect(await detail()).toMatchObject({ detail_error: null, detail_attempts: 0 });
  expect((await detail())!.detail_for).not.toBeNull();
});

it("con la quota GetItem esaurita lascia le righe senza immagine e prosegue", async () => {
  const provider = ebay({
    getItem: () => new Response(null, { status: 429, headers: { "Retry-After": "3600" } }),
  });
  expect(await acquire(provider)).toBe("complete");
  expect(
    await env.DB.prepare("SELECT api_origin, until FROM ebay_rate_limits").all(),
  ).toMatchObject({
    results: [{ api_origin: "https://api.ebay.com#GetItem", until: "2026-09-02T01:00:00.000Z" }],
  });
  expect(await count("SELECT COUNT(*) AS total FROM order_items WHERE image_url IS NULL")).toBe(
    await count("SELECT COUNT(*) AS total FROM order_items"),
  );
  // Durante l'attesa una nuova versione dell'ordine non richiama GetItem.
  const next = ebay({ orders: [order({ lastModifiedDate: "2026-09-02T00:05:00.000Z" })] });
  expect(await acquire(next, "2026-09-02T00:10:00.000Z")).toBe("complete");
  expect(next).toHaveBeenCalled();
  expect(calls(next, "GetItem")).toBe(0);
});

it("distingue gli errori del dettaglio che fermano l'esecuzione da quelli dell'ordine", async () => {
  const detail = () =>
    env.DB.prepare(
      "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
    ).first();
  const pending = { detail_for: null, detail_error: null, detail_attempts: 0 };
  for (const [status, failure] of [
    [503, "unavailable"],
    [401, "credentials"],
  ] as const) {
    await expect(
      acquire(ebay({ trading: () => new Response(null, { status }) })),
    ).rejects.toMatchObject({ failure });
    expect(await detail()).toEqual({ ...pending, detail_error: failure });
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.taxVerification).toBe("error");
  }
  // La quota GetOrders esaurita lascia il dettaglio in attesa senza consumare tentativi né
  // fermare la lettura; senza Retry-After si attende il valore prudente.
  expect(await acquire(ebay({ trading: () => new Response(null, { status: 429 }) }))).toBe(
    "complete",
  );
  expect(await detail()).toEqual({ ...pending, detail_error: "rate_limited" });
  expect(
    await env.DB.prepare("SELECT api_origin, until FROM ebay_rate_limits").all(),
  ).toMatchObject({
    results: [{ api_origin: "https://api.ebay.com#GetOrders", until: "2026-09-02T00:15:00.000Z" }],
  });
  await env.DB.prepare("DELETE FROM ebay_rate_limits").run();

  const single = (response: () => Response) => (url: URL) =>
    url.pathname.includes("/order/") ? response() : undefined;
  // Ordine non più leggibile, risposta che non è un ordine e versione più vecchia di
  // quella già registrata: errori del solo ordine, con un nuovo tentativo.
  let at = Date.parse("2026-09-02T00:00:00.000Z");
  for (const [fail, error] of [
    [single(() => new Response(null, { status: 404 })), "rejected"],
    [single(() => Response.json({ orderId: "12-34567-89012" })), "invalid_response"],
    [single(() => Response.json(order({ creationDate: "not-a-date" }))), "invalid_response"],
    [
      single(() => Response.json(order({ lastModifiedDate: "2026-09-01T08:30:00.000Z" }))),
      "invalid_response",
    ],
  ] as const) {
    await env.DB.prepare(
      "UPDATE order_source_refs SET detail_attempts = 0, detail_retry_at = NULL",
    ).run();
    at += 60_000;
    expect(await acquire(ebay({ fail }), new Date(at).toISOString())).toBe("complete");
    expect(await detail()).toEqual({
      detail_for: null,
      detail_error: error,
      detail_attempts: 1,
    });
  }
});

it("non scrive se il consenso cambia dopo una pagina vuota o durante il dettaglio", async () => {
  const reconnect = () =>
    env.DB.prepare(
      "UPDATE ebay_store_credentials SET granted_at = '2026-09-03T00:00:00.000Z'",
    ).run();
  const empty = ebay({ orders: [], before: reconnect });
  expect(await acquire(empty)).toBe("not_writable");
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T00:00:00.000Z",
    last_success_at: null,
  });

  for (const fail of [undefined, () => new Response(null, { status: 404 })]) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM orders"),
      env.DB.prepare("DELETE FROM deleted_order_keys"),
      env.DB.prepare("DELETE FROM sync_state"),
      env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?").bind(grantedAt),
    ]);
    const during = ebay({
      before: async (url) => {
        if (url.pathname.includes("/order/")) await reconnect();
      },
      fail: (url) => (url.pathname.includes("/order/") ? fail?.() : undefined),
    });
    expect(await acquire(during)).toBe("not_writable");
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
      ).first(),
    ).toEqual({ detail_for: null, detail_error: null, detail_attempts: 0 });
  }
});

it("tiene il negozio per l'esecuzione e regge un orologio indietro rispetto al limite", async () => {
  let nested: string | null = null;
  const fetcher = ebay({
    before: async () => {
      nested ??= await acquire(ebay(), "2026-09-02T00:05:00.000Z");
    },
  });
  expect(await acquire(fetcher)).toBe("complete");
  expect(nested).toBe("busy");

  const earlier = ebay();
  expect(await acquire(earlier, "2026-09-01T23:00:00.000Z")).toBe("complete");
  expect(new URL(String(earlier.mock.calls[0]![0])).searchParams.get("filter")).toBe(
    "lastmodifieddate:[2026-09-01T22:45:00.000Z..2026-09-01T23:00:00.000Z]",
  );
  expect((await syncState())!.cursor).toBe("2026-09-02T00:00:00.000Z");
});

it("il lavoro periodico accoda ogni negozio dovuto, con un budget ciascuno, isolando gli errori", async () => {
  const seal = (storeId: string) => sealToken(env, storeId, "access", `token-${storeId}`);
  const expires = "2026-09-02T03:00:00.000Z";
  await env.DB.prepare(
    `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
       VALUES ('s-c', 'w-a', 'e-c', ?1), ('s-d', 'w-a', 'e-d', ?1)`,
  )
    .bind(now)
    .run();
  await env.DB.prepare("DELETE FROM ebay_store_credentials").run();
  for (const storeId of ["s-a", "s-b", "s-c", "s-d"]) {
    await insertCredentials({
      storeId,
      // Il token di B non si apre, come dopo una rotazione del segreto.
      accessToken: storeId === "s-b" ? "v1.illeggibile" : await seal(storeId),
      accessExpiresAt: expires,
      grantedAt,
    }).run();
  }
  const tokenOf = (init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    return (
      headers.get("authorization")?.slice("Bearer ".length) ?? headers.get("x-ebay-api-iaf-token")
    );
  };
  // Chiamate fatte con il token del negozio, senza quelle dell'applicazione.
  const perStore = (fetcher: ReturnType<typeof ebay>) =>
    Object.fromEntries(
      Object.entries(
        Object.groupBy(
          fetcher.mock.calls.filter(
            ([, init]) =>
              !new Headers(init?.headers).get("authorization")?.startsWith("Basic ") &&
              tokenOf(init) !== "token-applicazione",
          ),
          ([, init]) => tokenOf(init) ?? "",
        ),
      ).map(([token, list]) => [token, list!.length]),
    );
  const attempted = async () =>
    Object.fromEntries(
      (
        await env.DB.prepare("SELECT store_id, polled_at FROM sync_state ORDER BY store_id").all<{
          store_id: string;
          polled_at: string | null;
        }>()
      ).results.map(({ store_id, polled_at }) => [store_id, polled_at]),
    );
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const logged = () =>
    errors.mock.calls.filter(([line]) => String(line).includes('"operation":"order_acquisition"'))
      .length;
  try {
    // A e D hanno più lavoro del proprio budget; B non apre il token; C risponde 401.
    const fetcher = ebay({
      orders: series("12-turno", 10, "2026-09-02T00:00:00.000Z"),
      fail: (_, init) =>
        tokenOf(init) === "token-s-c" ? new Response(null, { status: 401 }) : undefined,
    });
    await cronTurn(env, fetcher, new Date("2026-09-02T00:00:00.000Z"));
    // Il budget di A e D più la prima lettura del profilo del negozio, fuori budget.
    expect(perStore(fetcher)).toEqual({ "token-s-a": 13, "token-s-c": 1, "token-s-d": 13 });
    expect(logged()).toBe(2);
    expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)).failure).sort()).toEqual([
      "credentials",
      "credentials",
    ]);
    // C passa il turno; B chiude il consenso prima di acquisire e non scrive il checkpoint.
    expect(await attempted()).toEqual({
      "s-a": "2026-09-02T00:00:00.000Z",
      "s-b": null,
      "s-c": "2026-09-02T00:00:00.000Z",
      "s-d": "2026-09-02T00:00:00.000Z",
    });
    // Il token che non si apre chiude il consenso: B va ricollegato e non si ritenta.
    expect(
      await env.DB.prepare(
        "SELECT store_id, rejected_at FROM ebay_store_credentials WHERE rejected_at IS NOT NULL",
      ).all(),
    ).toMatchObject({
      results: [{ store_id: "s-b", rejected_at: "2026-09-02T00:00:00.000Z" }],
    });

    // Al turno successivo; in pausa o con il token in scadenza un negozio non si legge.
    await insertStorePause({ storeId: "s-c" }).run();
    const later = ebay({ orders: [] });
    await cronTurn(env, later, new Date("2026-09-02T01:00:00.000Z"));
    expect(Object.keys(perStore(later)).sort()).toEqual(["token-s-a", "token-s-d"]);
    expect(await attempted()).toMatchObject({
      "s-b": null,
      "s-d": "2026-09-02T01:00:00.000Z",
    });
    expect(logged()).toBe(2);
    const expiring = ebay();
    expect(await cronTurn(env, expiring, new Date("2026-09-02T02:56:00.000Z"))).toEqual([]);
    expect(expiring).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});
