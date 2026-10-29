import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unlockOrders } from "../app/domain/grants.server";
import { visibleOrderFacets } from "../app/domain/orders.server";
import { indexOrderSearch } from "../app/domain/maintenance.server";
import { createAuth } from "../app/auth.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/orders";
import { action as storesAction, loader as loadStores } from "../app/routes/stores";
import { action as startStoreLink } from "../app/routes/store-link";
import { listNotifications } from "../app/domain/notifications.server";
import { markNotificationsRead } from "../app/domain/notification-reads.server";
import { completeRegistration, marketingTextVersions } from "../app/domain/registration.server";
import { loader as loadWhatsNew } from "../app/routes/whats-new";
import { whatsNew, whatsNewProblems, type WhatsNewRelease } from "../app/whats-new.server";
import { ebayOutage, listStores } from "../app/domain/stores.server";
import { setSwitch } from "../app/domain/service-settings.server";
import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertStorePause,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./fixtures/database-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { displayTaxValue } from "../app/tax-quality";
import { fiscalSituation, itemPrice } from "../app/view-models";
import { appCopy } from "../app/app-copy";
import { settle } from "../app/settle.server";
import { requestOrderRead } from "../app/domain/order-sync.server";
import {
  areaShell,
  callRoute,
  routeData,
  routePage,
  routeResponse,
} from "./fixtures/route-fixtures";
import { queued } from "./fixtures/queue-fixture";

import { searchOrders, searchRequest } from "./fixtures/order-search-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("pagina Ordini reale", () => {
  /** Proprietario dello spazio A, con la sessione aperta. */
  async function owner() {
    await seed();
    const session = await verifiedSession("pagina-ordini@example.invalid");
    await env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'")
      .bind(session.userId)
      .run();
    return session;
  }

  /** Premium concesso allo spazio A: tutti i suoi negozi sono ammessi. */
  async function premiumCoverage() {
    await insertEntitlement({
      id: "concessione",
      source: "admin",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2027-12-31T00:00:00.000Z",
    }).run();
  }

  function ordersPage(cookie: string, path = "/app/ordini", params: { ordine?: string } = {}) {
    return routePage(loadHome, path, { cookie, params });
  }

  /** Dettaglio che non si apre: stessa risposta 404 per ogni ordine non consultabile. */
  async function missingOrder(cookie: string, ordine: string) {
    const response = await routeResponse(loadHome, `/app/ordini/${ordine}`, {
      cookie,
      params: { ordine },
    });
    return { status: response.status, body: await response.text() };
  }

  /** Elenco con la ricerca indicata, dall'indirizzo che restituisce la barra superiore. */
  async function searchedPage(cookie: string, query: string, params = "") {
    const { href } = await searchOrders(cookie, query);
    return ordersPage(cookie, params ? `${href}&${params}` : href);
  }

  function ordersAction(cookie: string, fields: Record<string, string>) {
    return callRoute(unlockAction, "/app/ordini", { cookie, fields });
  }

  async function withCredentials() {
    await insertCredentials({
      accessExpiresAt: "2026-09-14T00:00:00.000Z",
      refreshExpiresAt: "2027-09-13T00:00:00.000Z",
    }).run();
  }

  it("rende gli ordini persistiti nella vista dell'anteprima, con stati, prezzi e contatti", async () => {
    const { cookie } = await owner();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE orders SET marketplace_id = 'EBAY_IT', payment_status = 'PARTIALLY_REFUNDED',
                fulfillment_status = 'IN_PROGRESS', buyer_json = ? WHERE id = 'o-a'`,
      ).bind(
        JSON.stringify({
          username: "acquirente-sintetico",
          name: "Maria Rossi",
          email: "maria@example.invalid",
          phone: "+39 000 0000000",
          billingAddress: {
            addressLine1: "Via Roma 1",
            addressLine2: "Scala B",
            city: "Trento",
            postalCode: "38122",
            stateOrProvince: "TN",
            countryCode: "IT",
          },
          shipTo: {
            name: "Maria Rossi c/o Ufficio",
            phone: null,
            address: {
              addressLine1: "Via Verdi 2",
              addressLine2: null,
              city: "Rovereto",
              postalCode: "38068",
              stateOrProvince: "TN",
              countryCode: "IT",
            },
          },
        }),
      ),
      env.DB.prepare(
        "UPDATE order_items SET image_url = 'https://i.ebayimg.com/images/sintetica.jpg' WHERE id = 'i-a2'",
      ),
    ]);
    const result = await ordersPage(cookie);
    expect(result.notFound).toBe(false);
    const [order] = result.page!.orders;
    expect(order).toMatchObject({
      id: "o-a",
      ebayOrderId: "ebay-a",
      storeId: "s-a",
      buyerName: "Maria Rossi",
      buyerUsername: "acquirente-sintetico",
      shipTo: { name: "Maria Rossi c/o Ufficio", locality: "Rovereto (TN)", country: "IT" },
      payment: { status: "partially_refunded" },
      shipping: { status: "in_progress" },
      billingAddress: {
        line: "Via Roma 1, Scala B",
        postalCode: "38122",
        city: "Trento",
        province: "TN",
        countryCode: "IT",
      },
      phone: "+39 000 0000000",
      email: "maria@example.invalid",
      thumbnail: "https://i.ebayimg.com/images/sintetica.jpg",
      items: [
        { id: "line-a1", totalMinor: 999, quantity: 1, currency: "EUR" },
        { id: "line-a2", totalMinor: 300, quantity: 2, currency: "EUR" },
      ],
      // Nessuna lettura in attesa né controllo registrato: la lettura risulta da riprovare.
      fiscal: { state: "locked", shownAs: "CF" },
    });
    // Il valore da sbloccare non arriva mai al browser, neppure nella vista condivisa.
    expect(JSON.stringify(result)).not.toContain("RSSMRA80A01H501U");
    expect(result.page).toMatchObject({
      view: "list",
      exportable: true,
      // Negozio eBay reale: l'ordine si apre nel Seller Hub.
      openOnEbay: true,
      // L'acquisto è configurato: gli sblocchi esauriti rimandano al piano.
      settings: true,
      account: { plan: "free", quota: { used: 0, limit: 1 } },
    });

    // Uno stato eBay non previsto compare con il suo codice; uno stato assente resta tale.
    await env.DB.prepare(
      "UPDATE orders SET payment_status = 'AWAITING_REVIEW', fulfillment_status = NULL WHERE id = 'o-a'",
    ).run();
    const unknown = (await ordersPage(cookie)).page!.orders[0]!;
    expect(unknown.payment).toEqual({ status: null, code: "AWAITING_REVIEW" });
    expect(unknown.shipping).toEqual({ status: null, code: null });
    // Uno stato non previsto resta fuori dai filtri.
    expect((await ordersPage(cookie, "/app/ordini?pagamento=paid")).page!.orders).toEqual([]);
  });

  it("mostra il prezzo unitario solo quando la divisione è esatta, altrimenti l'importo della riga", () => {
    const line = (totalMinor: number | null, quantity: number) => ({
      id: "riga",
      title: "Articolo",
      sku: null,
      quantity,
      totalMinor,
      currency: "EUR",
    });
    expect(itemPrice(line(999, 1))).toEqual({ minor: 999, unit: true });
    expect(itemPrice(line(300, 2))).toEqual({ minor: 150, unit: true });
    expect(itemPrice(line(1000, 3))).toEqual({ minor: 1000, unit: false });
    expect(itemPrice(line(0, 4))).toEqual({ minor: 0, unit: true });
    expect(itemPrice(line(null, 2))).toBeNull();
  });

  it("apre il dettaglio dall'indirizzo solo per un ordine consultabile dello spazio", async () => {
    const { cookie } = await owner();
    const opened = await ordersPage(cookie, "/app/ordini/o-a", { ordine: "o-a" });
    expect(opened.page?.detail).toMatchObject({ id: "o-a", ebayOrderId: "ebay-a" });
    // Un ordine di un altro spazio, inesistente o scaduto risponde allo stesso modo.
    for (const ordine of ["o-b", "inesistente", "x".repeat(65)]) {
      const missing = await missingOrder(cookie, ordine);
      expect(missing.status).toBe(404);
      expect(JSON.parse(missing.body)).toMatchObject({ notFound: true });
      expect(missing.body).not.toContain("ebay-b");
    }
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-a'").bind(now).run();
    const expired = await missingOrder(cookie, "o-a");
    expect(expired.status).toBe(404);
    expect(JSON.parse(expired.body)).toMatchObject({ notFound: true });
  });

  it("filtra sul server con i soli valori autorizzati, anche nella forma normalizzata", async () => {
    const { cookie, userId } = await owner();
    await env.DB.prepare(
      "UPDATE tax_identifiers SET value = ' rss mra80a01h501u' WHERE id = 't-a1'",
    ).run();
    // Prima dello sblocco il codice non trova l'ordine e il filtro lo indica da sbloccare.
    expect((await searchedPage(cookie, "RSSMRA80A01H501U")).page!.orders).toEqual([]);
    expect(
      (await ordersPage(cookie, "/app/ordini?fiscale=locked")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    await unlockOrders(env.DB, userId, ["o-a"]);
    const found = await searchedPage(cookie, "RSSMRA80A01H501U");
    expect(found.page!.orders.map(({ id }) => id)).toEqual(["o-a"]);
    // L'originale resta quello della fonte; la forma derivata è solo per mostrare e copiare.
    const [order] = found.page!.orders;
    expect(order!.fiscal).toMatchObject({
      state: "available",
      identifiers: expect.arrayContaining([
        expect.objectContaining({ type: "CF", value: " rss mra80a01h501u" }),
      ]),
    });
    expect((await ordersPage(cookie, "/app/ordini?fiscale=locked")).page!.orders).toEqual([]);
    // Filtro e ricerca valutano l'accesso all'istante della richiesta, come la vista.
    await env.DB.prepare("UPDATE order_grants SET expires_at = ? WHERE order_id = 'o-a'")
      .bind(new Date(Date.parse(now) + 60_000).toISOString())
      .run();
    expect(
      (await ordersPage(cookie, "/app/ordini?fiscale=available")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    expect((await searchedPage(cookie, "RSSMRA80A01H501U")).page!.total).toBe(1);
    // L'esito del collegamento nell'indirizzo non diventa un filtro per negozio.
    expect(
      (await ordersPage(cookie, "/app/ordini?negozio=collegato")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    // Un negozio fuori dai filtrabili, anche di un altro spazio, vale come «Tutti».
    expect(
      (await ordersPage(cookie, "/app/ordini?negozio=s-b")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
  });

  it("filtri, ricerca, conteggio e «Carica altri» usano la query reale sullo spazio", async () => {
    const { cookie, userId } = await owner();
    const day = 86_400_000;
    // Ordini sintetici di A con stati diversi; o-b resta di un altro spazio.
    const extra = [
      ["x-paid", "PAID", "FULFILLED", null, "EBAY_IT", 1],
      ["x-unpaid", "PENDING", "NOT_STARTED", null, "EBAY_DE", 2],
      ["x-partial", "PARTIALLY_REFUNDED", "IN_PROGRESS", null, "EBAY_IT", 3],
      ["x-refunded", "FULLY_REFUNDED", "NOT_STARTED", "CANCELED", "EBAY_IT", 10],
      ["x-unknown", "AWAITING_REVIEW", "NOT_STARTED", null, null, 15],
      ["x-checking", "PAID", "NOT_STARTED", null, "EBAY_IT", 20],
      ["x-missing", "PAID", "NOT_STARTED", null, "EBAY_IT", 25],
    ] as const;
    await env.DB.batch([
      ...extra.map(([id, payment, fulfillment, cancel, marketplace, age]) =>
        env.DB.prepare(
          `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
             total_minor, payment_status, fulfillment_status, cancel_status, marketplace_id, buyer_json)
           VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(
          id,
          new Date(Date.parse(now) - age * day).toISOString(),
          payment,
          fulfillment,
          cancel,
          marketplace,
          JSON.stringify({
            username: `utente-${id}`,
            name: id === "x-paid" ? "Giulia Verdi" : null,
          }),
        ),
      ),
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
         VALUES ('i-x', 'x-paid', 'l-x', 'SKU-RICERCA', 'Lampada da tavolo', 1, 100, 'EUR')`,
      ),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
         VALUES ('s-a', 'fulfillment', 'x-checking', 'x-checking', ?1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
         VALUES ('x-missing', 'ebay_fulfillment', ?1, 'absent'), ('x-paid', 'ebay_fulfillment', ?1, 'absent')`,
      ).bind(now),
    ]);
    const ids = async (query: string) =>
      (await ordersPage(cookie, `/app/ordini?${query}`)).page!.orders.map(({ id }) => id);
    const all = (await ordersPage(cookie, "/app/ordini?mostra=2")).page!;
    expect(all.total).toBe(8);
    // Lo stato fiscale filtrato in SQL coincide con quello della vista per ogni ordine.
    for (const order of all.orders)
      expect(await ids(`fiscale=${fiscalSituation(order.fiscal)}&mostra=2`)).toContain(order.id);
    expect(Object.fromEntries(all.orders.map((order) => [order.id, order.fiscal.state]))).toEqual({
      "o-a": "locked",
      "x-paid": "missing",
      "x-unpaid": "error",
      "x-partial": "error",
      "x-refunded": "error",
      "x-unknown": "error",
      "x-checking": "checking",
      "x-missing": "missing",
    });
    expect(await ids("pagamento=paid")).toEqual(["x-paid", "x-checking", "x-missing"]);
    expect(await ids("pagamento=unpaid")).toEqual(["x-unpaid"]);
    expect(await ids("pagamento=partially_refunded")).toEqual(["x-partial"]);
    expect(await ids("pagamento=refunded")).toEqual(["x-refunded"]);
    expect(await ids("spedizione=cancelled")).toEqual(["x-refunded"]);
    expect(await ids("spedizione=in_progress")).toEqual(["x-partial"]);
    expect(await ids("spedizione=shipped")).toEqual(["x-paid"]);
    // Il marketplace non è un filtro: il parametro non restringe l'elenco.
    expect(await ids("marketplace=EBAY_DE&mostra=2")).toHaveLength(8);
    expect(await ids("periodo=7")).toEqual(["o-a", "x-paid", "x-unpaid", "x-partial"]);
    // In Free il periodo di 90 giorni vale come «Tutti», come nell'interfaccia.
    expect((await ordersPage(cookie, "/app/ordini?periodo=90")).page!.total).toBe(8);
    expect(await ids("pagamento=sconosciuto&negozio=s-a&fiscale=missing")).toEqual([
      "x-paid",
      "x-missing",
    ]);
    // La ricerca combina le parole su numero, acquirente, articoli e SKU.
    const searched = async (query: string, params = "") =>
      (await searchedPage(cookie, query, params)).page!.orders.map(({ id }) => id);
    expect(await searched("giulia sku-ricerca")).toEqual(["x-paid"]);
    expect(await searched("LAMPADA")).toEqual(["x-paid"]);
    expect(await searched("utente-x-unpaid")).toEqual(["x-unpaid"]);
    expect(await searched("ebay-b")).toEqual([]);
    // La ricerca si combina con i filtri e una query nell'indirizzo non filtra.
    expect(await searched("utente", "pagamento=paid")).toEqual([
      "x-paid",
      "x-checking",
      "x-missing",
    ]);
    expect((await ordersPage(cookie, "/app/ordini?q=lampada")).page!.total).toBe(8);
    // «Carica altri» amplia la pagina letta dal server finché restano ordini.
    const first = (await ordersPage(cookie)).page!;
    expect({ shown: first.orders.length, total: first.total }).toEqual({ shown: 6, total: 8 });
    expect(first.nextHref).toBe(`/app/ordini?mostra=2&vista=${first.snapshot}`);
    expect(all.nextHref).toBeNull();
    const filtered = (await ordersPage(cookie, "/app/ordini?pagamento=paid&negozio=collegato"))
      .page!;
    expect(filtered).toMatchObject({ total: 3, nextHref: null });
    void userId;
  });

  it("«Carica altri» resta sull'istantanea e i nuovi ordini entrano soltanto in cima", async () => {
    const { cookie } = await owner();
    const day = 86_400_000;
    const insert = (id: string, age: number, listedAt: string | null) =>
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
           total_minor, payment_status, listed_at)
         VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, 'PAID', ?3)`,
      ).bind(id, new Date(Date.parse(now) - age * day).toISOString(), listedAt);
    // Ordini letti prima che l'ingresso negli elenchi fosse registrato: valgono come presenti.
    await env.DB.batch([1, 2, 3, 4, 5, 6, 7].map((age) => insert(`x-${age}`, age + 0.5, null)));
    const listed = async (path: string) => (await ordersPage(cookie, path)).page!;
    const first = await listed("/app/ordini");
    expect(first).toMatchObject({ total: 8, incoming: 0, freshHref: null, limited: false });
    expect(first.snapshot).toMatch(/^[0-9a-z]+$/u);
    const opened = new Date(Number.parseInt(first.snapshot, 36));
    // Dopo l'apertura arrivano un ordine recente e uno vecchio, letti dallo storico.
    vi.setSystemTime(opened.getTime() + 60_000);
    const later = new Date(opened.getTime() + 1).toISOString();
    await env.DB.batch([insert("x-nuovo", 0, later), insert("x-storico", 3, later)]);
    // La pagina successiva continua dall'istantanea: nessun ordine si inserisce fra i già letti.
    const second = await listed(first.nextHref!);
    expect(second.orders.map(({ id }) => id)).toEqual([
      "o-a",
      "x-1",
      "x-2",
      "x-3",
      "x-4",
      "x-5",
      "x-6",
      "x-7",
    ]);
    expect(second).toMatchObject({
      total: 8,
      snapshot: first.snapshot,
      nextHref: null,
      incoming: 2,
      // La nuova istantanea conserva le pagine caricate.
      freshHref: "/app/ordini?mostra=2",
      // L'ordine dello storico finirebbe fra quelli già letti: resta all'indicatore.
      incomingAtTop: false,
    });
    // Anche i filtri contano i nuovi ordini con gli stessi criteri.
    expect(await listed(`/app/ordini?periodo=7&vista=${first.snapshot}`)).toMatchObject({
      total: 7,
      incoming: 2,
    });
    expect(await listed(`/app/ordini?pagamento=unpaid&vista=${first.snapshot}`)).toMatchObject({
      incoming: 0,
      freshHref: null,
    });
    // Il dettaglio di un ordine nuovo si apre anche sull'istantanea precedente.
    expect(
      (
        await ordersPage(cookie, `/app/ordini/x-nuovo?vista=${first.snapshot}`, {
          ordine: "x-nuovo",
        })
      ).page!.detail?.id,
    ).toBe("x-nuovo");
    const fresh = await listed(second.freshHref!);
    expect(fresh.orders.map(({ id }) => id).slice(0, 5)).toEqual([
      "x-nuovo",
      "o-a",
      "x-1",
      "x-2",
      "x-storico",
    ]);
    expect(fresh).toMatchObject({ total: 10, incoming: 0, incomingAtTop: false });
    expect(fresh.snapshot > first.snapshot).toBe(true);
    // Un ordine più recente del primo mostrato entra da solo in cima.
    const reopened = new Date(Number.parseInt(fresh.snapshot, 36));
    vi.setSystemTime(reopened.getTime() + 60_000);
    await env.DB.batch([insert("x-ultimo", 0, new Date(reopened.getTime() + 1).toISOString())]);
    expect(await listed(`/app/ordini?vista=${fresh.snapshot}`)).toMatchObject({
      incoming: 1,
      incomingAtTop: true,
    });
    // Un cursore alterato o futuro non va oltre l'istante della richiesta.
    expect(await listed("/app/ordini?vista=zzzzzzzzzz")).toMatchObject({ total: 11, incoming: 0 });
    expect(await listed("/app/ordini?vista=..")).toMatchObject({ total: 11, incoming: 0 });
  });

  it("un nuovo accesso riapre soltanto il negozio ricordato, se ancora fra i filtri", async () => {
    const { cookie } = await owner();
    const remembered = `${cookie}; fiscalbay-negozio=s-c`;
    const entry = (sessionCookie: string, path = "/app/ordini") =>
      ordersPage(sessionCookie, path).catch((response: Response) => response);
    // Con un solo negozio il filtro non compare: il negozio ricordato non si applica.
    expect(await entry(remembered)).toMatchObject({ page: expect.any(Object) });
    // Con Premium anche il secondo negozio è fra i filtri; nel Free resterebbe in pausa.
    await premiumCoverage();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    const redirected = (await entry(remembered)) as Response;
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("location")).toBe("/app/ordini?negozio=s-c");
    // Con un indirizzo già scelto, o un negozio di un altro spazio, l'elenco resta com'è.
    expect(await entry(remembered, "/app/ordini?periodo=7")).toMatchObject({
      page: expect.any(Object),
    });
    expect(await entry(`${cookie}; fiscalbay-negozio=s-b`)).toMatchObject({
      page: expect.any(Object),
    });
    expect(await entry(`${cookie}; fiscalbay-negozio=%E0%A4%A`)).toMatchObject({
      page: expect.any(Object),
    });
  });

  it("con Auth o database non disponibili risponde 503 senza dati", async () => {
    const { cookie } = await owner();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const prepare = vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1_ERROR: unavailable");
    });
    try {
      expect(await ordersPage(cookie).catch((error: unknown) => error)).toMatchObject({
        data: null,
        init: { status: 503, headers: { "retry-after": "60" } },
      });
      expect(JSON.parse(String(log.mock.calls[0]![0]))).toMatchObject({
        code: "UPSTREAM_UNAVAILABLE",
        operation: "route",
      });
    } finally {
      prepare.mockRestore();
    }
    // Anche una lettura che non riesce dopo quella dell'account non mostra dati né l'errore
    // imprevisto: Negozi e ordini si leggono in lotto.
    const batch = vi.spyOn(env.DB, "batch").mockRejectedValue(new Error("D1_ERROR: unavailable"));
    try {
      expect(await ordersPage(cookie).catch((error: unknown) => error)).toMatchObject({
        data: null,
        init: { status: 503, headers: { "retry-after": "60" } },
      });
    } finally {
      batch.mockRestore();
      log.mockRestore();
    }
  });

  it("con le letture ferme segnala eBay o il solo negozio, con l'ultimo aggiornamento", async () => {
    const { cookie, userId } = await owner();
    await withCredentials();
    const synced = "2026-09-13T21:00:00.000Z";
    /** Letture dei recenti del negozio, dalla più recente, e ultima lettura riuscita. */
    const reads = async (store: string, outcomes: boolean[], success: string | null = synced) => {
      await env.DB.prepare("DELETE FROM sync_runs WHERE store_id = ?").bind(store).run();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(store_id) DO UPDATE SET last_success_at = excluded.last_success_at`,
        ).bind(store, success, now),
        ...outcomes.map((ok, index) =>
          env.DB.prepare(
            "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES (?, ?, ?, 0)",
          ).bind(store, `2026-09-14T0${9 - index}:00:00.000Z`, ok ? 1 : 0),
        ),
      ]);
    };
    const notices = async (path = "/app/ordini") =>
      (await ordersPage(cookie, path)).page!.notices.filter(
        (notice) => notice.kind === "ebay-down" || notice.kind === "store-read-failed",
      );
    const bell = async () =>
      ((await areaShell(cookie, "/app/ordini")).notifications ?? []).map((item) => item.id);
    const storesDown = async () =>
      (await routeData(loadStores, "/app/negozi", { cookie })).page.ebayDown;

    // Un errore isolato non basta: la lettura successiva di solito riesce.
    await reads("s-a", [false, true]);
    expect(await notices()).toEqual([]);
    expect(await bell()).toEqual([]);
    expect(await storesDown()).toEqual([]);

    // Tutti i negozi attivi non riescono a leggere: eBay non risponde.
    await reads("s-a", [false, false, true]);
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);
    expect(await storesDown()).toEqual(["production"]);
    // Un solo problema nella campanella, come nell'anteprima, e la nuova lettura resta sospesa.
    expect(await bell()).toEqual([`ebay-down:${synced}`]);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      data: { ok: false, notice: appCopy.it.stores.ebayDown },
      init: { status: 409 },
    });
    // Anche Sincronizza, Reimporta e Ricollega restano sospese sul server.
    for (const intent of ["store-sync", "store-reimport"])
      expect(
        await callRoute(storesAction, "/app/negozi", { cookie, fields: { intent, store: "s-a" } }),
      ).toMatchObject({
        data: { ok: false, notice: appCopy.it.stores.ebayDown },
        init: { status: 409 },
      });
    const reconnect = await routeResponse(startStoreLink, "/app/negozi/collega", {
      cookie,
      fields: { negozio: "s-a", da: "negozi" },
    });
    expect(reconnect.status).toBe(303);
    expect(reconnect.headers.get("location")).toBe("/app/negozi?negozio=ebay-non-risponde");
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
    // Un negozio Sandbox che legge non cambia l'indisponibilità di Production, e viceversa.
    await insertStore({ id: "s-sb", ebayUserId: "e-sb", environment: "sandbox" }).run();
    await insertCredentials({
      storeId: "s-sb",
      accessExpiresAt: "2026-09-14T00:00:00.000Z",
      refreshExpiresAt: "2027-09-13T00:00:00.000Z",
    }).run();
    await reads("s-sb", [true, true]);
    expect(await storesDown()).toEqual(["production"]);
    expect(await bell()).toEqual([`ebay-down:${synced}`]);
    await env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-sb'").run();

    // Con un altro negozio che legge, il problema resta del solo negozio, finché è nella vista.
    // Con Premium il secondo negozio è ammesso; nel Free resterebbe in pausa.
    await premiumCoverage();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    await insertCredentials({
      storeId: "s-c",
      accessExpiresAt: "2026-09-14T00:00:00.000Z",
      refreshExpiresAt: "2027-09-13T00:00:00.000Z",
    }).run();
    await reads("s-c", [true, true]);
    const failed = { kind: "store-read-failed", storeId: "s-a", storeName: "e-a", at: synced };
    expect(await notices()).toEqual([failed]);
    expect(await notices("/app/ordini?negozio=s-a")).toEqual([failed]);
    expect(await notices("/app/ordini?negozio=s-c")).toEqual([]);
    expect(await storesDown()).toEqual([]);
    expect(await bell()).toEqual([`store-read-failed:s-a:${synced}`]);

    // Un negozio in pausa non legge eBay: non conta per l'indisponibilità né per gli avvisi.
    await insertStorePause({ storeId: "s-c" }).run();
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);

    // La prima lettura riuscita chiude il problema, anche nella campanella. Le letture fallite
    // di un negozio poi messo in pausa non lo segnalano.
    await reads("s-a", [true, false, false]);
    await reads("s-c", [false, false]);
    expect(await notices()).toEqual([]);
    expect(await bell()).toEqual([]);

    // Con più negozi fermi vale l'aggiornamento riuscito più recente; senza nessuno, nessun orario.
    await env.DB.prepare("DELETE FROM ebay_store_pauses WHERE store_id = 's-c'").run();
    await reads("s-a", [false, false]);
    await reads("s-c", [false, false], "2026-09-13T20:30:00.000Z");
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);
    await reads("s-a", [false, false], null);
    await reads("s-c", [false, false], null);
    expect(await notices()).toEqual([{ kind: "ebay-down", at: null }]);
    expect(await bell()).toEqual(["ebay-down:never"]);
    // Oltre i trenta giorni della campanella il problema resta soltanto negli avvisi.
    const later = new Date(Date.parse("2026-09-14T08:00:00.000Z") + 31 * 86_400_000);
    const statuses = await listStores(env.DB, userId, later);
    expect(await listNotifications(env.DB, userId, statuses, "it", "Europe/Rome", later)).toEqual(
      [],
    );
    expect(ebayOutage(statuses)).not.toBeNull();
  });

  it("con le letture eBay sospese dalla console lo dice come manutenzione e sospende le azioni", async () => {
    const { cookie } = await owner();
    await withCredentials();
    const synced = "2026-09-13T21:00:00.000Z";
    await env.DB.prepare(
      "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES ('s-a', ?1, ?1)",
    )
      .bind(synced)
      .run();
    const notices = async () =>
      (await ordersPage(cookie, "/app/ordini")).page!.notices.filter(
        (notice) => notice.kind === "ebay-down",
      );
    const stores = async () => (await routeData(loadStores, "/app/negozi", { cookie })).page;
    expect(await notices()).toEqual([]);

    await setSwitch(env.DB, "ebay_calls", false);
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced, maintenance: true }]);
    expect(await stores()).toMatchObject({
      ebayDown: ["production", "sandbox"],
      ebayMaintenance: true,
    });
    // Non è un problema di eBay: la campanella resta com'è.
    expect((await areaShell(cookie, "/app/ordini")).notifications ?? []).toEqual([]);
    const paused = {
      data: { ok: false, notice: appCopy.it.stores.ebayPaused },
      init: { status: 409 },
    };
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject(paused);
    for (const intent of ["store-sync", "store-reimport"])
      expect(
        await callRoute(storesAction, "/app/negozi", { cookie, fields: { intent, store: "s-a" } }),
      ).toMatchObject(paused);
    const link = await routeResponse(startStoreLink, "/app/negozi/collega", {
      cookie,
      fields: { da: "negozi" },
    });
    expect(link.headers.get("location")).toBe("/app/negozi?negozio=sospeso");

    await setSwitch(env.DB, "ebay_calls", true);
    expect(await notices()).toEqual([]);
    expect(await stores()).toMatchObject({ ebayDown: [], ebayMaintenance: false });
  });

  it("con eBay, Telegram e acquisti spenti e i provider irraggiungibili il Premium resta e sblocca", async () => {
    const { cookie } = await owner();
    await premiumCoverage();
    for (const name of ["ebay_calls", "telegram_sends", "purchases_open"] as const)
      await setSwitch(env.DB, name, false);
    // eBay, Stripe e Telegram non rispondono: consultazione e sblocchi usano i soli dati salvati.
    const providers = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("rete assente"));
    try {
      expect((await ordersPage(cookie)).page!.account).toMatchObject({ plan: "premium" });
      expect(
        await callRoute(unlockAction, "/app/ordini", {
          cookie,
          fields: { intent: "unlock", ids: "o-a", skipConfirmation: "true" },
        }),
      ).toMatchObject({ unlocked: ["o-a"] });
      const [order] = (await ordersPage(cookie)).page!.orders;
      expect(order).toMatchObject({ id: "o-a", fiscal: { state: "available" } });
      expect(providers).not.toHaveBeenCalled();
    } finally {
      providers.mockRestore();
    }
  });

  it("annuncia le Novità di ogni rilascio nella campanella e nel menu, solo se ci sono", async () => {
    const at = new Date("2026-11-20T09:00:00.000Z");
    vi.setSystemTime(at);
    const { cookie, userId } = await owner();
    const page = (path: string) => routeResponse(loadWhatsNew, path, { cookie }).catch(() => null);
    const bell = (language: "it" | "en", when = at) =>
      listNotifications(env.DB, userId, [], language, "Europe/Rome", when);
    // L'elenco versionato è vuoto e ben formato: nessuna voce, pagina o campanella.
    expect(whatsNew).toEqual([]);
    expect(whatsNewProblems()).toEqual([]);
    expect((await areaShell(cookie)).whatsNew).toBe(false);
    expect((await routeResponse(loadWhatsNew, "/app/novita", { cookie })).status).toBe(404);
    expect(await bell("it")).toEqual([]);

    const release = (version: string, date: string): WhatsNewRelease => ({
      version,
      date,
      items: [
        {
          it: { title: `Titolo ${version}`, body: "Testo." },
          en: { title: `Title ${version}`, body: "Text." },
        },
      ],
    });
    whatsNew.push(release("2.0.1", "2026-10-01"), release("2.0.2", "2026-11-10"));
    try {
      expect((await areaShell(cookie)).whatsNew).toBe(true);
      expect((await routeData(loadWhatsNew, "/en/app/novita", { cookie })).releases).toEqual([
        { version: "2.0.2", date: "2026-11-10", items: [{ title: "Title 2.0.2", body: "Text." }] },
        { version: "2.0.1", date: "2026-10-01", items: [{ title: "Title 2.0.1", body: "Text." }] },
      ]);
      // Una voce per rilascio negli ultimi trenta giorni, nella lingua dell'utente.
      expect(await bell("it")).toEqual([
        {
          id: "whats-new:2.0.2",
          tone: "info",
          title: "Novità di FiscalBay",
          body: "Titolo 2.0.2",
          at: "2026-11-10T00:00:00.000Z",
          read: false,
          href: "novita",
        },
      ]);
      expect((await bell("en"))[0]).toMatchObject({ title: "What’s new in FiscalBay" });
      await markNotificationsRead(env.DB, userId, ["whats-new:2.0.2"], at);
      expect((await bell("it"))[0]).toMatchObject({ read: true });
      // Un rilascio con data futura non compare prima del suo giorno: né nella campanella né
      // nella pagina, e senza rilasci già usciti nemmeno la voce del menu.
      expect(await bell("it", new Date("2026-11-09T09:00:00.000Z"))).toEqual([]);
      whatsNew.push(release("2.0.3", "2026-11-21"));
      expect(
        (await routeData(loadWhatsNew, "/app/novita", { cookie })).releases.map(
          (item: { version: string }) => item.version,
        ),
      ).toEqual(["2.0.2", "2.0.1"]);
      expect(await bell("it")).toHaveLength(1);
      whatsNew.splice(0, 2);
      expect((await areaShell(cookie)).whatsNew).toBe(false);
      expect(await page("/app/novita")).toMatchObject({ status: 404 });
      vi.setSystemTime(new Date("2026-11-21T00:00:00.000Z"));
      expect((await areaShell(cookie)).whatsNew).toBe(true);
      vi.setSystemTime(at);
      expect(
        whatsNewProblems([release("2.0.1", "2026-13-01"), release("2.0.1", "2026-10-01")]),
      ).toEqual(["2.0.1: giorno non valido", "2.0.1: versione ripetuta"]);
    } finally {
      whatsNew.length = 0;
    }
    expect(await page("/app/novita")).toMatchObject({ status: 404 });
  });

  it("propone il consenso marketing una sola volta, a primi passi conclusi, in ogni lingua", async () => {
    const { cookie, userId } = await owner();
    const proposal = async (path = "/app/ordini") =>
      (await ordersPage(cookie, path)).page.marketingProposal;
    const choices = () =>
      env.DB.prepare(
        "SELECT granted, text_version, language FROM marketing_consents WHERE user_id = ? ORDER BY rowid",
      )
        .bind(userId)
        .all()
        .then(({ results }) => results);
    // La sola scelta della registrazione, senza adesione: l'utente di prova resta fra i test.
    const register = async (marketing: boolean) => {
      await env.DB.prepare("DELETE FROM marketing_consents WHERE user_id = ?").bind(userId).run();
      await completeRegistration(env.DB, {
        userId,
        language: "it",
        now: new Date(now),
        agreement: { marketing },
      });
    };
    await register(false);
    const registration = {
      granted: 0,
      text_version: marketingTextVersions.registration,
      language: "it",
    };
    expect(await choices()).toEqual([registration]);
    // Prima della prima lettura riuscita i primi passi non sono conclusi.
    expect(await proposal()).toBe(false);
    await env.DB.prepare(
      "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES ('s-a', ?1, ?1)",
    )
      .bind(now)
      .run();
    expect((await ordersPage(cookie)).page.onboarding.every((step) => step.done)).toBe(true);
    expect(await proposal()).toBe(true);
    const answer = (path: string, value: string) =>
      routeData(unlockAction, path, {
        cookie,
        fields: { intent: "marketing", value },
      });
    await expect(answer("/app/ordini", "forse")).resolves.toMatchObject({ ok: false });
    expect(await answer("/app/ordini", "false")).toEqual({
      ok: true,
      notice: appCopy.it.orders.marketingProposal.declined,
    });
    // La mancata adesione resta come prova del testo della proposta e la proposta non torna.
    expect(await choices()).toEqual([
      registration,
      { granted: 0, text_version: marketingTextVersions.proposal, language: "it" },
    ]);
    expect(await proposal()).toBe(false);
    // In inglese la risposta registra la lingua della pagina, con la stessa versione del testo.
    await env.DB.prepare("DELETE FROM marketing_consents WHERE user_id = ? AND text_version = ?")
      .bind(userId, marketingTextVersions.proposal)
      .run();
    expect(await proposal("/en/app/ordini")).toBe(true);
    expect(await answer("/en/app/ordini", "true")).toEqual({
      ok: true,
      notice: appCopy.en.orders.marketingProposal.accepted,
    });
    expect(await choices()).toEqual([
      registration,
      { granted: 1, text_version: marketingTextVersions.proposal, language: "en" },
    ]);
    expect(await proposal("/en/app/ordini")).toBe(false);
    // Chi aderisce in registrazione non riceve la proposta; la revoca resta nelle Impostazioni.
    await register(true);
    expect(await proposal()).toBe(false);
  });

  it("la barra superiore cerca con la query nel corpo e l'elenco la riceve cifrata", async () => {
    const { cookie, userId } = await owner();
    for (const origin of ["https://estraneo.invalid", null])
      await expect(searchRequest(cookie, "articolo", { origin })).rejects.toMatchObject({
        status: 403,
      });
    // Senza sessione la richiesta del browser riceve un errore, il modulo l'accesso.
    const anonymous = await searchRequest(null, "articolo");
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(searchRequest(null, "articolo", { json: false })).rejects.toMatchObject({
      status: 302,
    });

    const found = await searchOrders(cookie, "  ARTICOLO a  ");
    expect(found.href).toMatch(/^\/app\/ordini\?ricerca=[\w-]+$/u);
    expect(found).toEqual({
      items: [
        {
          id: "o-a",
          ebayOrderId: "ebay-a",
          buyerName: "",
          detail: "Articolo A",
          href: `/app/ordini/o-a${found.href.slice("/app/ordini".length)}`,
        },
      ],
      total: 1,
      href: found.href,
    });
    // Un modulo inviato senza JavaScript apre l'elenco; la query non è mai nell'indirizzo.
    const submitted = await searchRequest(cookie, "ARTICOLO a", { json: false });
    expect(submitted.status).toBe(303);
    expect(submitted.headers.get("location")).toMatch(/^\/app\/ordini\?ricerca=[\w-]+$/u);
    expect(submitted.headers.get("location")?.toLowerCase()).not.toContain("articolo");
    expect(await searchOrders(cookie, "   ")).toEqual({ items: [], total: 0, href: "/app/ordini" });
    // Con la sessione di un altro utente lo stesso termine non trova gli ordini di questo spazio.
    const stranger = await verifiedSession("ricerca-estraneo@example.invalid");
    expect(await searchOrders(stranger.cookie, "articolo a")).toMatchObject({
      items: [],
      total: 0,
    });

    // La presentazione del nome non riscrive la fonte né cambia lo username di ripiego.
    for (const [buyer, display] of [
      [{ name: "  MARIO ROSSI  ", username: "BUYER_TEST" }, "Mario Rossi"],
      [{ name: null, username: "BUYER_TEST" }, "BUYER_TEST"],
    ] as const) {
      await env.DB.prepare("UPDATE orders SET buyer_json = ? WHERE id = 'o-a'")
        .bind(JSON.stringify(buyer))
        .run();
      expect((await searchOrders(cookie, "articolo a")).items[0]?.buyerName).toBe(display);
      expect(
        await env.DB.prepare("SELECT buyer_json FROM orders WHERE id = 'o-a'").first("buyer_json"),
      ).toBe(JSON.stringify(buyer));
    }

    // L'elenco decifra la ricerca della propria sessione e la conserva con filtri e pagine.
    const listed = (await ordersPage(cookie, `${found.href}&fiscale=locked`)).page!;
    expect(listed).toMatchObject({ search: "ARTICOLO a", total: 1 });
    // Alterata, oppure in un'altra sessione dello stesso utente, la ricerca si dimentica.
    expect((await ordersPage(cookie, `${found.href}x`)).page!.search).toBeNull();
    const signIn = await createAuth(env).handler(
      new Request("http://localhost:5173/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "pagina-ordini@example.invalid",
          password: "Una-password-negozio-molto-lunga",
        }),
      }),
    );
    const other = (await ordersPage(signIn.headers.get("set-cookie")!, found.href)).page!;
    expect(other).toMatchObject({ search: null, total: 1 });
    void userId;
  });

  it("confronta maiuscole e accenti di ogni alfabeto dopo l'indicizzazione", async () => {
    const { cookie } = await owner();
    await env.DB.prepare("UPDATE orders SET buyer_json = ? WHERE id = 'o-a'")
      .bind(JSON.stringify({ name: "ÖZTÜRK Lucía", username: "oz_lucia" }))
      .run();
    // Prima dell'indicizzazione valgono le sole minuscole ASCII di SQLite.
    expect((await searchOrders(cookie, "öztürk")).total).toBe(0);
    expect((await searchOrders(cookie, "oz_lucia")).total).toBe(1);
    expect(await indexOrderSearch(env.DB)).toBeGreaterThan(0);
    expect(await indexOrderSearch(env.DB)).toBe(0);
    const row = await env.DB.prepare("SELECT search_text FROM orders WHERE id = 'o-a'").first();
    expect(row).toEqual({
      search_text: "ebay-a ozturk lucia oz_lucia articolo a sku-a articolo b ",
    });
    for (const query of ["Öztürk", "ozturk LUCÍA", "lucia sku-a"])
      expect((await searchOrders(cookie, query)).total).toBe(1);
    expect((await searchedPage(cookie, "ÖZTÜRK")).page!.orders.map(({ id }) => id)).toEqual([
      "o-a",
    ]);
  });

  it("«Non pagato» mostra anche gli acquisti provvisori, senza sblocco né suggerimenti", async () => {
    const { cookie } = await owner();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
           total_minor, is_provisional, payment_status, buyer_json)
         VALUES ('x-prov', 's-a', 'x-prov', ?1, ?1, 'EUR', 100, 1, 'PENDING', '{"username":"carrello"}')`,
      ).bind(now),
      insertTaxIdentifiers({
        id: "t-prov",
        orderId: "x-prov",
        type: "CODICE_FISCALE",
        country: "IT",
        value: "VRDGLI80A41H501X",
        source: "ebay_trading_get_orders",
      }),
    ]);
    const ids = async (query: string) =>
      (await ordersPage(cookie, `/app/ordini?${query}`)).page!.orders.map(({ id }) => id);
    expect(await ids("")).toEqual(["o-a"]);
    expect((await ordersPage(cookie)).page!.total).toBe(1);
    expect(await ids("pagamento=unpaid")).toEqual(["x-prov"]);
    expect((await searchOrders(cookie, "carrello")).total).toBe(0);
    // Il dettaglio si apre dal filtro; lo sblocco attende il pagamento.
    const opened = await ordersPage(cookie, "/app/ordini/x-prov?pagamento=unpaid", {
      ordine: "x-prov",
    });
    expect(opened.page!.detail).toMatchObject({
      id: "x-prov",
      fiscal: { state: "locked", shownAs: "CF", hold: "unpaid" },
      suggestions: [],
    });
    expect((await missingOrder(cookie, "x-prov")).status).toBe(404);
    // Una lettura non riuscita dell'acquisto si può riprovare dal filtro che lo mostra.
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'x-prov'").run();
    await withCredentials();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    try {
      expect(await ordersAction(cookie, { intent: "retry", order: "x-prov" })).toEqual({
        ok: true,
        notice: "Nuova lettura richiesta.",
      });
    } finally {
      send.mockRestore();
    }
  });

  it("distingue l'acquirente estero dal dato non riportato da eBay", async () => {
    const { cookie } = await owner();
    const buyer = (country: string) =>
      JSON.stringify({
        name: "Lucía Martín",
        billingAddress: { addressLine1: "Calle Mayor 10", city: "Madrid", countryCode: country },
      });
    await env.DB.batch(
      [
        ["x-es", buyer("ES"), "absent"],
        ["x-es-masked", buyer("ES"), "masked"],
        ["x-it", buyer("IT"), "absent"],
        ["x-none", "{}", "not_included"],
      ].flatMap(([id, json, availability], index) => [
        env.DB.prepare(
          `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
             total_minor, payment_status, buyer_json)
           VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, 'PAID', ?3)`,
        ).bind(id, new Date(Date.parse(now) - (index + 1) * 60_000).toISOString(), json),
        env.DB.prepare(
          `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
           VALUES (?1, 'ebay_fulfillment', ?2, ?3)`,
        ).bind(id, now, availability),
      ]),
    );
    const page = async (query: string) => (await ordersPage(cookie, `/app/ordini?${query}`)).page!;
    expect((await page("fiscale=foreign")).orders.map(({ id }) => id)).toEqual(["x-es"]);
    expect((await page("fiscale=missing")).orders.map(({ id }) => id)).toEqual([
      "x-es-masked",
      "x-it",
      "x-none",
    ]);
    const all = await page("mostra=2");
    expect(
      Object.fromEntries(all.orders.map((order) => [order.id, fiscalSituation(order.fiscal)])),
    ).toEqual({
      "o-a": "locked",
      "x-es": "foreign",
      "x-es-masked": "missing",
      "x-it": "missing",
      "x-none": "missing",
    });
    // Con Premium anche l'acquirente estero riceve la ricerca dei suggerimenti.
    await insertEntitlement({
      id: "foreign-premium",
      source: "premium",
      endsAt: "2099-01-01T00:00:00.000Z",
    }).run();
    expect((await page("mostra=2")).orders.find(({ id }) => id === "x-es")).toMatchObject({
      fiscal: { state: "missing", reason: "foreign", country: "ES" },
      suggestionStatus: "identity_missing",
    });
  });

  it("con il Free sospeso dall'antiabuso la pagina lo dice e lo sblocco è rifiutato", async () => {
    const { cookie } = await owner();
    await env.DB.prepare(`INSERT INTO abuse_reviews (signal, outcome, workspace_id, actor, reason,
        reviewed_at) VALUES ('company:sintetico', 'suspended', 'w-a', 'admin', 'Stessa attività', ?)`)
      .bind(now)
      .run();
    expect((await ordersPage(cookie)).page!.account).toMatchObject({
      plan: "free",
      freeSuspended: true,
    });
    expect(
      await callRoute(unlockAction, "/app/ordini", {
        cookie,
        fields: { intent: "unlock", ids: "o-a", skipConfirmation: "true" },
      }),
    ).toMatchObject({ init: { status: 409 }, data: { error: true, unlocked: [] } });
    // Con una copertura concessa l'avviso sparisce.
    await premiumCoverage();
    expect((await ordersPage(cookie)).page!.account).not.toHaveProperty("freeSuspended");
  });

  it("forma derivata di CF e Partita IVA italiani senza toccare i tipi esteri", () => {
    expect(displayTaxValue({ type: "CF", value: " rss mra80a01h501u " })).toBe("RSSMRA80A01H501U");
    expect(displayTaxValue({ type: "PIVA", value: "0123 4567 890" })).toBe("01234567890");
    expect(displayTaxValue({ type: "PIVA", value: "00000000000" })).toBe("00000000000");
    // Un valore errato resta errato: la forma derivata non lo corregge.
    expect(displayTaxValue({ type: "CF", value: "rss-mra" })).toBe("RSS-MRA");
    expect(displayTaxValue({ type: "OTHER", value: " es b123 456 " })).toBe(" es b123 456 ");
  });

  it("«Riprova» rilegge soltanto un ordine dello spazio con lettura non riuscita", async () => {
    const { cookie } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    // Un identificativo assente o troppo lungo è una richiesta non valida, come nei Negozi.
    for (const order of ["", "x".repeat(65)])
      expect(await ordersAction(cookie, { intent: "retry", order })).toMatchObject({
        init: { status: 400 },
      });
    // Con dati da sbloccare la lettura non è da riprovare.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      init: { status: 409 },
    });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    // Senza un consenso valido la lettura non si può richiedere e nulla cambia.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      init: { status: 409 },
    });
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: now, detail_error: "unavailable", detail_attempts: 5 });
    await withCredentials();
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toEqual({
      ok: true,
      notice: "Nuova lettura richiesta.",
    });
    expect(send).toHaveBeenCalledWith({ syncStore: "s-a" });
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: null, detail_error: null, detail_attempts: 0 });
    // L'ordine torna in verifica finché la nuova lettura non si conclude.
    expect((await ordersPage(cookie)).page!.orders[0]!.fiscal).toEqual({ state: "checking" });
    // Un ordine di un altro spazio non si rilegge.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-b" })).toMatchObject({
      init: { status: 409 },
    });
    send.mockRestore();
  });

  it("la nuova lettura di un ordine noto solo a Trading riparte dalla passata Trading", async () => {
    const { userId } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    await withCredentials();
    // Un ordine con dati da sbloccare non si rilegge, anche con un consenso valido.
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("invalid");
    expect(send).not.toHaveBeenCalled();
    await env.DB.batch([
      // Senza dato e senza verifica la lettura risulta non riuscita.
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
         VALUES ('s-a', 'trading', 'ebay-a', 'o-a', ?1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO sync_state (store_id, updated_at, history_from, trading_cursor, trading_end, trading_page, trading_total)
         VALUES ('s-a', ?1, ?1, ?1, ?1, 2, 40), ('s-b', ?1, ?1, ?1, NULL, NULL, NULL)`,
      ).bind(now),
    ]);
    const tradingState = () =>
      env.DB.prepare(
        "SELECT store_id, trading_cursor, trading_end, trading_page, trading_total FROM sync_state ORDER BY store_id",
      ).all();
    // Il negozio di un altro spazio non si rilegge e il suo cursore resta.
    expect(await requestOrderRead(env, userId, "o-b", "production")).toBe("not_found");
    // Neppure un ordine del proprio negozio fuori conservazione o in un altro ambiente.
    const expired = new Date("2026-11-01T00:00:00.000Z");
    expect(await requestOrderRead(env, userId, "o-a", "production", expired)).toBe("not_found");
    expect(await requestOrderRead(env, userId, "o-a", "sandbox")).toBe("not_found");
    expect((await tradingState()).results[0]).toMatchObject({ trading_cursor: now });
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("queued");
    expect((await tradingState()).results).toEqual([
      {
        store_id: "s-a",
        trading_cursor: null,
        trading_end: null,
        trading_page: null,
        trading_total: null,
      },
      {
        store_id: "s-b",
        trading_cursor: now,
        trading_end: null,
        trading_page: null,
        trading_total: null,
      },
    ]);
    // Con un riferimento Fulfillment rilegge il dettaglio, non l'intera passata Trading.
    await env.DB.batch([
      env.DB.prepare("UPDATE sync_state SET trading_cursor = ?1, requested_at = NULL").bind(now),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time, detail_for)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1)`,
      ).bind(now),
    ]);
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("queued");
    expect((await tradingState()).results[0]).toMatchObject({ trading_cursor: now });
    expect(
      await env.DB.prepare(
        "SELECT detail_for FROM order_source_refs WHERE source = 'fulfillment'",
      ).first(),
    ).toEqual({ detail_for: null });
    send.mockRestore();
  });

  it("non riprende la lettura di un ordine il cui negozio esce dallo spazio durante la richiesta", async () => {
    const { userId } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    await withCredentials();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    // L'appartenenza cessa tra la verifica dell'ordine e la richiesta di lettura del negozio.
    const database = new Proxy(env.DB, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (key !== "prepare") return typeof value === "function" ? value.bind(target) : value;
        return (query: string) =>
          query.includes("LEFT JOIN ebay_store_credentials c")
            ? {
                bind: (...values: unknown[]) => ({
                  first: async () => {
                    await target
                      .prepare("DELETE FROM workspace_members WHERE user_id = ?")
                      .bind(userId)
                      .run();
                    return target
                      .prepare(query)
                      .bind(...values)
                      .first();
                  },
                }),
              }
            : target.prepare(query);
      },
    });
    expect(
      await requestOrderRead({ ...env, DB: database } as Env, userId, "o-a", "production"),
    ).toBe("not_found");
    expect(send).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: now, detail_error: "unavailable", detail_attempts: 5 });
    send.mockRestore();
  });

  it("mostra subito l'ultimo stato e conferma nella stessa risposta la verifica in corso", async () => {
    const { cookie } = await owner();
    await env.DB.prepare(
      `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
       VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?)`,
    )
      .bind(now)
      .run();
    const result = await ordersPage(cookie);
    // Lo sblocco resta sospeso durante la verifica, senza attendere eBay.
    expect(result.page!.orders[0]!.fiscal).toEqual({
      state: "locked",
      shownAs: "CF",
      hold: "checking",
    });
    expect(result.confirmation).toBeInstanceOf(Promise);
    await env.DB.batch([
      env.DB.prepare("UPDATE order_source_refs SET detail_for = last_modified_time"),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability)
         VALUES ('o-a', 'ebay_trading_get_orders', ?1, ?1, 'present')`,
      ).bind(now),
    ]);
    const confirmed = await result.confirmation!;
    expect(confirmed.map(({ id, fiscal }) => ({ id, fiscal }))).toEqual([
      { id: "o-a", fiscal: { state: "locked", shownAs: "CF" } },
    ]);
    expect(JSON.stringify(confirmed)).not.toContain("RSSMRA80A01H501U");
    // Senza verifiche in corso non resta nulla da confermare.
    expect((await ordersPage(cookie)).confirmation).toBeUndefined();
  });

  it("l'attesa della conferma si ferma alla scadenza con l'ultima lettura", async () => {
    let reads = 0;
    const read = async () => ++reads;
    expect(await settle(read, (value) => value === 2, { timeoutMs: 1_000, intervalMs: 10 })).toBe(
      2,
    );
    reads = 0;
    // Un'altra attesa supererebbe la scadenza: resta l'ultima lettura, non confermata.
    expect(await settle(read, () => false, { timeoutMs: 15, intervalMs: 20 })).toBe(1);
  });

  it("rilegge una volta gli ordini mai verificati", async () => {
    await seed();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor, is_provisional)
         VALUES ('o-t', 's-a', 'trading-a', ?1, ?1, 'EUR', 100, 1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time, detail_for, detail_error)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, NULL),
                ('s-b', 'fulfillment', 'ebay-b', 'o-b', ?1, ?1, NULL),
                ('s-a', 'trading', 'trading-a', 'o-t', ?1, NULL, NULL)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability)
         VALUES ('o-b', 'ebay_trading_get_orders', ?1, ?1, 'present')`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO sync_state (store_id, updated_at, history_from, trading_cursor)
         VALUES ('s-a', ?1, ?1, ?1), ('s-b', ?1, ?1, ?1)`,
      ).bind(now),
    ]);
    const migration = env.TEST_MIGRATIONS.find(
      ({ name }) => name === "0028_order_tax_recheck.sql",
    )!;
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    expect(
      (
        await env.DB.prepare(
          "SELECT order_id, detail_for FROM order_source_refs WHERE source = 'fulfillment' ORDER BY order_id",
        ).all()
      ).results,
    ).toEqual([
      { order_id: "o-a", detail_for: null },
      { order_id: "o-b", detail_for: now },
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT store_id, trading_cursor FROM sync_state ORDER BY store_id",
        ).all()
      ).results,
    ).toEqual([
      { store_id: "s-a", trading_cursor: null },
      { store_id: "s-b", trading_cursor: now },
    ]);
  });

  it("conta i dati dell'intero elenco, anche senza ordini", async () => {
    await seed();
    const at = new Date(now);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toEqual({
      total: 1,
      locked: true,
    });
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toMatchObject({
      locked: false,
    });
    expect(await visibleOrderFacets(env.DB, "nessuno", "production", at)).toEqual({
      total: 0,
      locked: false,
    });
  });
});
