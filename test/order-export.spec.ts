import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  csvCell,
  exportCsvStream,
  exportDateTime,
  exportFileName,
  exportHeader,
  exportRows,
  formulaLike,
} from "../app/domain/order-export.server";
import { visibleOrderTallies, type VisibleOrder } from "../app/domain/orders.server";
import { action as exportAction, loader as exportLoader } from "../app/routes/order-export";
import { loader as loadSettings } from "../app/routes/settings";
import { verifiedSession } from "./fixtures/account-fixtures";
import { insertTaxIdentifiers, now, resetDatabase, seed } from "./fixtures/database-fixtures";
import { callRoute, routePage, routeResponse } from "./fixtures/route-fixtures";
import { searchOrders } from "./fixtures/order-search-fixtures";
import { snapshotCursor } from "../app/orders/order-list";
import { fulfillmentObservation } from "../app/integrations/ebay/fulfillment.server";

const it_ = appCopy.it;

/** Ordine visibile minimo per le righe del file, con i campi che la prova cambia. */
function visible(overrides: Partial<VisibleOrder> = {}): VisibleOrder {
  return {
    id: "o-1",
    ebayOrderId: "01-00001",
    creationTime: "2026-09-13T20:00:00.000Z",
    lastModifiedTime: "2026-09-14T08:30:00.000Z",
    currency: "EUR",
    totalMinor: 1599,
    storeId: "s-a",
    storeName: "Negozio",
    marketplaceId: "EBAY_IT",
    provisional: false,
    summary: {
      buyer: {
        username: "acquirente",
        name: "Mario Rossi",
        email: "mario@example.invalid",
        phone: "+39 333 000 1000",
        billingAddress: {
          addressLine1: "Via Roma 1",
          addressLine2: "Scala B",
          city: "Roma",
          postalCode: "00184",
          stateOrProvince: "RM",
          countryCode: "IT",
        },
        shipTo: null,
        masked: undefined,
      },
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "NOT_STARTED",
      payment: "paid",
      shipping: "to_ship",
      lineItems: [
        {
          lineItemId: "l-1",
          title: "Lampada",
          quantity: 2,
          sku: "007",
          totalMinor: 1000,
          currency: "EUR",
          imageUrl: null,
          stableKey: null,
        },
        {
          lineItemId: "l-2",
          title: "Cavo",
          quantity: 1,
          sku: null,
          totalMinor: 599,
          currency: "EUR",
          imageUrl: null,
          stableKey: null,
        },
      ],
    },
    fiscalState: "available",
    taxVerification: "completed",
    taxAvailability: "present",
    taxCheckedAt: "2026-09-13T21:00:00.000Z",
    firstTaxAvailableAt: "2026-09-13T21:00:00.000Z",
    lockedShownAs: "CF",
    reconciliationIssue: false,
    taxIdentifiers: [],
    ...overrides,
  };
}

const tax = (type: string, value: string, issuingCountry: string | null = "IT") => ({
  type,
  issuingCountry,
  value,
  source: "ebay_trading_get_orders",
  observedAt: now,
  quality: "valid" as const,
  updated: false,
});

describe("righe e celle del file", () => {
  it("neutralizza soltanto i valori che un foglio eseguirebbe come formula", () => {
    for (const value of [
      "=1+1",
      "@SUM(A1)",
      "\tA",
      "\rA",
      "\nA",
      "+cmd|' /C calc'!A0",
      "-2+HYPERLINK(1)",
    ])
      expect([value, formulaLike(value)]).toEqual([value, true]);
    for (const value of ["", "a=b", "1-2", "00123456789", "+39 333 000 1000", "-12.50", "+1", "-"])
      expect([value, formulaLike(value)]).toEqual([value, false]);
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell('Ditta "Rossi", via\r\nRoma')).toBe('"Ditta ""Rossi"", via\r\nRoma"');
    expect(csvCell("+39 333")).toBe('"+39 333"');
  });

  it("scrive data e ora nel fuso dell'utente, anche a mezzanotte", () => {
    expect(exportDateTime("2026-09-13T22:00:05.000Z", "Europe/Rome")).toBe("2026-09-14 00:00:05");
    expect(exportDateTime("2026-01-10T09:30:00.000Z", "America/New_York")).toBe(
      "2026-01-10 04:30:00",
    );
    expect(exportDateTime(null, "Europe/Rome")).toBe("");
  });

  it("per ordine riunisce articoli e identificativi in una riga, in ordine deterministico", () => {
    const order = visible({
      taxIdentifiers: [
        tax("VAT_ID", "00123456789"),
        tax("CODICE_FISCALE", "rssmra80a01h501u"),
        tax("VAT", "DE123456789", "DE"),
        tax("CODICE_FISCALE", "BNCLGU80A01H501Z", null),
      ],
    });
    const header = exportHeader("order", it_);
    const [row, ...others] = exportRows(order, "order", it_, "Europe/Rome");
    expect(others).toEqual([]);
    const cell = (name: string) => row![header.indexOf(name)];
    expect(header).toHaveLength(row!.length);
    expect(cell("Numero ordine")).toBe("01-00001");
    expect(cell("Data")).toBe("2026-09-13 22:00:00");
    expect(cell("Fuso orario")).toBe("Europe/Rome");
    expect(cell("Articoli")).toBe("2 × Lampada | 1 × Cavo");
    expect(cell("SKU")).toBe("007");
    expect(cell("Quantità")).toBe("3");
    expect(cell("Totale ordine")).toBe("15.99");
    expect(cell("Indirizzo di fatturazione")).toBe("Via Roma 1 | Scala B");
    expect(cell("Pagamento")).toBe("Pagato");
    expect(cell("Spedizione")).toBe("Da spedire");
    // I valori restano quelli della fonte: nessuna correzione di maiuscole o spazi.
    expect(cell("Codice Fiscale")).toBe("BNCLGU80A01H501Z | rssmra80a01h501u");
    expect(cell("Partita IVA")).toBe("00123456789");
    expect(cell("Altri identificativi fiscali")).toBe("VAT (DE): DE123456789");
    expect(cell("Situazione fiscale")).toBe("Disponibile");
    expect(cell("Ultima modifica su eBay")).toBe("2026-09-14 10:30:00");
  });

  it("per articolo non ripete il totale e lascia vuoto l'importo in un'altra valuta", () => {
    const order = visible({ taxIdentifiers: [tax("CODICE_FISCALE", "RSSMRA80A01H501U")] });
    order.summary.lineItems[1]!.currency = "USD";
    const header = exportHeader("item", appCopy.en);
    const rows = exportRows(order, "item", appCopy.en, "Europe/Rome");
    const column = (name: string) => rows.map((row) => row[header.indexOf(name)]);
    expect(rows.every((row) => row.length === header.length)).toBe(true);
    expect(column("Item")).toEqual(["Lampada", "Cavo"]);
    expect(column("Quantity")).toEqual(["2", "1"]);
    expect(column("Item amount")).toEqual(["10.00", ""]);
    expect(column("Order total")).toEqual(["15.99", ""]);
    expect(column("Codice Fiscale")).toEqual(["RSSMRA80A01H501U", "RSSMRA80A01H501U"]);
    expect(column("Payment")).toEqual(["Paid", "Paid"]);
  });

  it("lascia fuori dal totale e dal file la protezione acquisti riscossa da eBay", () => {
    // eBay addebita la tariffa all'acquirente in `ebayCollectedCharges`, separata dal totale.
    const observation = fulfillmentObservation(
      {
        orderId: "01-00001",
        creationDate: "2026-09-13T20:00:00.000Z",
        lastModifiedDate: "2026-09-14T08:30:00.000Z",
        pricingSummary: { total: { value: "15.99", currency: "EUR" } },
        ebayCollectedCharges: {
          charges: [{ chargeType: "BUYER_PROTECTION", amount: { value: "1.20", currency: "EUR" } }],
        },
      },
      "2026-09-14T09:00:00.000Z",
    );
    expect(observation.total).toEqual({ minor: 1599, currency: "EUR" });
    const header = exportHeader("order", appCopy.en);
    const [row] = exportRows(
      visible({ totalMinor: observation.total.minor, currency: observation.total.currency }),
      "order",
      appCopy.en,
      "Europe/Rome",
    );
    expect(row![header.indexOf("Order total")]).toBe("15.99");
  });

  it("dichiara il motivo del dato vuoto e conserva il codice di uno stato non previsto", () => {
    const header = exportHeader("item", it_);
    const foreign = visible({ fiscalState: "foreign" });
    foreign.summary = {
      ...foreign.summary,
      payment: "unknown",
      orderPaymentStatus: "ON_HOLD",
      lineItems: [],
    };
    const [row] = exportRows(foreign, "item", it_, "Europe/Rome");
    const cell = (name: string) => row![header.indexOf(name)];
    expect(cell("Situazione fiscale")).toBe("Acquirente estero");
    expect(cell("Pagamento")).toBe("ON_HOLD");
    expect(cell("Totale ordine")).toBe("15.99");
    expect(cell("Articolo")).toBe("");
    const locked = exportRows(visible({ fiscalState: "locked" }), "order", it_, "Europe/Rome")[0]!;
    expect(locked[exportHeader("order", it_).indexOf("Situazione fiscale")]).toBe("Da sbloccare");
  });
});

describe("righe complete del file", () => {
  it("scrive ogni colonna di un ordine con dati assenti, senza articoli né acquirente", () => {
    const order = visible({ marketplaceId: null, taxCheckedAt: null, fiscalState: "missing" });
    order.summary = {
      buyer: null,
      orderPaymentStatus: null,
      orderFulfillmentStatus: null,
      payment: null,
      shipping: null,
      lineItems: [],
    };
    const empty = Array<string>(10).fill("");
    expect(exportRows(order, "order", it_, "UTC")).toEqual([
      [
        "01-00001",
        "2026-09-13 20:00:00",
        "UTC",
        "Negozio",
        ...empty,
        "",
        "",
        "0",
        "EUR",
        "15.99",
        "",
        "",
        "",
        "",
        "",
        "Non disponibile su eBay",
        "",
        "2026-09-14 08:30:00",
      ],
    ]);
    expect(exportRows(order, "item", it_, "UTC")).toEqual([
      [
        "01-00001",
        "2026-09-13 20:00:00",
        "UTC",
        "Negozio",
        ...empty,
        "",
        "",
        "",
        "",
        "EUR",
        "15.99",
        "",
        "",
        "",
        "",
        "",
        "Non disponibile su eBay",
        "",
        "2026-09-14 08:30:00",
      ],
    ]);
  });

  it("scrive l'acquirente e la riga completa, con il telefono della consegna come riserva", () => {
    const order = visible({
      taxIdentifiers: [
        tax("VAT_ID", "22222222222"),
        tax("PartitaIVA", "11111111111", null),
        tax("VAT", "FR2", "FR"),
        tax("TIN", "ZZ1", null),
        tax("VAT", "DE1", "DE"),
      ],
    });
    order.summary.buyer = {
      ...order.summary.buyer!,
      phone: null,
      shipTo: { name: null, phone: "+39 06 123", address: null },
    };
    order.summary.lineItems[1]!.totalMinor = null;
    expect(exportRows(order, "item", it_, "Europe/Rome")).toEqual([
      [
        "01-00001",
        "2026-09-13 22:00:00",
        "Europe/Rome",
        "Negozio",
        "EBAY_IT",
        "Mario Rossi",
        "acquirente",
        "mario@example.invalid",
        "+39 06 123",
        "Via Roma 1 | Scala B",
        "00184",
        "Roma",
        "RM",
        "IT",
        "Lampada",
        "007",
        "2",
        "10.00",
        "EUR",
        "15.99",
        "Pagato",
        "Da spedire",
        "",
        "11111111111 | 22222222222",
        "TIN: ZZ1 | VAT (DE): DE1 | VAT (FR): FR2",
        "Disponibile",
        "2026-09-13 23:00:00",
        "2026-09-14 10:30:00",
      ],
      [
        "01-00001",
        "2026-09-13 22:00:00",
        "Europe/Rome",
        "Negozio",
        "EBAY_IT",
        "Mario Rossi",
        "acquirente",
        "mario@example.invalid",
        "+39 06 123",
        "Via Roma 1 | Scala B",
        "00184",
        "Roma",
        "RM",
        "IT",
        "Cavo",
        "",
        "1",
        "",
        "EUR",
        "",
        "Pagato",
        "Da spedire",
        "",
        "11111111111 | 22222222222",
        "TIN: ZZ1 | VAT (DE): DE1 | VAT (FR): FR2",
        "Disponibile",
        "2026-09-13 23:00:00",
        "2026-09-14 10:30:00",
      ],
    ]);
  });

  it("lascia intatti numeri con punteggiatura e neutralizza il testo dopo il segno", () => {
    for (const value of ["+(39) 333", "-1,5", "-12.50", "+39/333", "+39-333", "-(1)"])
      expect([value, formulaLike(value)]).toEqual([value, false]);
    for (const value of ["+39 a", "-1e5", "+ SUM(1)", "-(A1)"])
      expect([value, formulaLike(value)]).toEqual([value, true]);
  });

  it("interrompendo il download chiude anche la lettura delle pagine", async () => {
    let closed = false;
    async function* pages() {
      try {
        yield [visible()];
        yield [visible({ ebayOrderId: "01-00002" })];
      } finally {
        closed = true;
      }
    }
    const reader = exportCsvStream(pages(), "order", it_, "UTC").getReader();
    // Il BOM resta nei byte: la decodifica predefinita lo toglierebbe.
    const header = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      (await reader.read()).value,
    );
    expect(header.startsWith('\uFEFF"Numero ordine","Data",')).toBe(true);
    expect(header.endsWith('"Ultima modifica su eBay"\r\n')).toBe(true);
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first.startsWith('"01-00001",')).toBe(true);
    await reader.cancel();
    expect(closed).toBe(true);
  });

  it("chiude il file dopo l'ultima pagina", async () => {
    async function* pages() {
      yield [visible()];
    }
    const text = await new Response(exportCsvStream(pages(), "item", appCopy.en, "UTC")).text();
    const lines = text.split("\r\n");
    expect(lines).toHaveLength(4);
    // Le righe di una pagina si susseguono senza separatori aggiunti.
    expect(lines[1]!.startsWith('"01-00001","2026-09-13 20:00:00",')).toBe(true);
    expect(lines[2]!.startsWith('"01-00001","2026-09-13 20:00:00",')).toBe(true);
    expect(lines[0]).toBe(
      exportHeader("item", appCopy.en)
        .map((name) => `"${name}"`)
        .join(","),
    );
    expect(lines[3]).toBe("");
  });

  it("nomina il file con prodotto e data nel fuso, senza dati personali", () => {
    const at = new Date("2026-09-13T22:30:00.000Z");
    expect(exportFileName(it_, at, "Europe/Rome")).toBe("fiscalbay-ordini-2026-09-14.csv");
    expect(exportFileName(appCopy.en, at, "UTC")).toBe("fiscalbay-orders-2026-09-13.csv");
  });
});

describe("file degli ordini", () => {
  let cookie: string;

  beforeEach(async () => {
    await resetDatabase();
    await seed();
    const session = await verifiedSession(`export-${crypto.randomUUID()}@example.invalid`);
    cookie = session.cookie;
    const at = (minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'").bind(
        session.userId,
      ),
      // o-a ha già i suoi identificativi; o-c è bloccato con una formula nel titolo, o-d estero,
      // o-p un acquisto non ancora pagato.
      env.DB.prepare(
        `INSERT INTO orders
          (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor,
           payment_status, buyer_json, is_provisional)
         VALUES ('o-c', 's-a', 'ebay-c', ?1, ?1, 'EUR', 500, 'PAID', NULL, 0),
                ('o-d', 's-a', 'ebay-d', ?2, ?2, 'EUR', 700, 'PAID', ?3, 0),
                ('o-p', 's-a', 'ebay-p', ?2, ?2, 'EUR', 900, 'PENDING', NULL, 1)`,
      ).bind(
        at(10),
        at(20),
        JSON.stringify({
          username: "kunde",
          name: "Hans",
          email: null,
          phone: null,
          billingAddress: { countryCode: "DE", city: "Berlin" },
          shipTo: null,
        }),
      ),
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
         VALUES ('i-c', 'o-c', 'line-c', '=HYPERLINK("http://x.invalid")', 1, 500, 'EUR')`,
      ),
      insertTaxIdentifiers({
        id: "t-c",
        orderId: "o-c",
        type: "CODICE_FISCALE",
        value: "VRDGPP80A01H501X",
        source: "ebay_trading_get_orders",
      }),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
         VALUES ('o-d', 'ebay_fulfillment', ?, 'absent')`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
         VALUES ('g-a', 'w-a', 'o-a', NULL, 'admin', ?)`,
      ).bind(now),
    ]);
  });

  afterEach(() => vi.useRealTimers());

  const request = (
    query: string,
    fields: Record<string, string> = {},
    options: { json?: boolean; origin?: string | null; cookie?: string | null } = {},
  ) =>
    routeResponse(exportAction, `/api/v1/orders/export${query ? `?${query}` : ""}`, {
      cookie: options.cookie === undefined ? cookie : options.cookie,
      origin: options.origin,
      headers: options.json === false ? {} : { accept: "text/csv, application/json" },
      fields: { language: "it", ...fields },
    });

  /** Righe del CSV senza BOM, con l'intestazione come chiavi. */
  async function csv(response: Response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.subarray(3));
    expect(text.endsWith("\r\n")).toBe(true);
    const parse = (line: string) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/gu)].map(([, value]) =>
        value!.replaceAll('""', '"'),
      );
    const [header, ...lines] = text.trimEnd().split("\r\n").map(parse);
    return {
      text,
      rows: lines.map((cells) => Object.fromEntries(header!.map((name, i) => [name, cells[i]]))),
    };
  }

  it("esporta la selezione con i soli valori autorizzati e il motivo dei dati vuoti", async () => {
    // o-b appartiene a un altro spazio e o-p non è pagato: nessuno dei due entra nel file.
    const response = await request("ordini=o-a,o-c,o-d,o-b,o-p");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="fiscalbay-ordini-2026-09-13.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { text, rows } = await csv(response);
    expect(rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a", "ebay-c", "ebay-d"]);
    expect(text).not.toContain("VRDGPP80A01H501X");
    expect(text).not.toContain("BNCLGU80A01H501Z");
    expect(rows[0]).toMatchObject({
      "Codice Fiscale": "RSSMRA80A01H501U",
      "Partita IVA": "01234567890",
      "Situazione fiscale": "Disponibile",
      Articoli: "1 × Articolo A | 2 × Articolo B",
      "Totale ordine": "12.99",
    });
    expect(rows[1]).toMatchObject({
      "Codice Fiscale": "",
      "Situazione fiscale": "Da sbloccare",
      Articoli: '1 × =HYPERLINK("http://x.invalid")',
    });
    // La formula del titolo resta neutralizzata nel file.
    expect(text).toContain(`"1 × =HYPERLINK(""http://x.invalid"")"`);
    expect(rows[2]).toMatchObject({ "Situazione fiscale": "Acquirente estero", Paese: "DE" });
  });

  it("neutralizza la formula di un titolo esportato per articolo", async () => {
    const { text, rows } = await csv(await request("ordini=o-c", { rows: "item" }));
    expect(rows).toHaveLength(1);
    expect(text).toContain(`"'=HYPERLINK(""http://x.invalid"")"`);
  });

  it("per articolo scrive una riga per articolo e il totale una volta sola", async () => {
    const { rows } = await csv(await request("ordini=o-a", { rows: "item" }));
    expect(
      rows.map((row) => [row.Articolo, row["Importo articolo"], row["Totale ordine"]]),
    ).toEqual([
      ["Articolo A", "9.99", "12.99"],
      ["Articolo B", "3.00", ""],
    ]);
    expect(rows.map((row) => row["Codice Fiscale"])).toEqual([
      "RSSMRA80A01H501U",
      "RSSMRA80A01H501U",
    ]);
  });

  it("con l'opzione dei soli dati disponibili esclude gli altri ordini", async () => {
    const { rows } = await csv(
      await request(`vista=${snapshotCursor(new Date(now))}`, { fiscal: "available" }),
    );
    expect(rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
    // Un filtro degli Ordini che esclude i dati disponibili non produce un file vuoto.
    const refused = await request("fiscale=locked", { fiscal: "available" });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ ok: false, notice: it_.settings.export.exportEmpty });
  });

  it("segue filtri, ricerca cifrata e «Non pagato» dell'elenco", async () => {
    const filtered = await csv(await request("fiscale=foreign"));
    expect(filtered.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-d"]);
    const unpaid = await csv(await request("pagamento=unpaid"));
    expect(unpaid.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-p"]);
    const { href } = await searchOrders(cookie, "articolo a");
    const searched = await csv(await request(href.split("?")[1]!));
    expect(searched.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
    // Un valore da sbloccare non trova l'ordine nemmeno nel file.
    const { href: guess } = await searchOrders(cookie, "VRDGPP80A01H501X");
    expect((await request(guess.split("?")[1]!)).status).toBe(409);
  });

  it("senza ambito degli Ordini esporta il periodo scelto e ignora quello Premium nel Free", async () => {
    await env.DB.prepare(
      `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor, retention_until)
       VALUES ('o-old', 's-a', 'ebay-old', ?1, ?1, 'EUR', 100, ?2)`,
    )
      .bind(new Date(Date.parse(now) - 10 * 86_400_000).toISOString(), "2026-12-01T00:00:00.000Z")
      .run();
    const week = await csv(await request("", { period: "7" }));
    expect(week.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a", "ebay-c", "ebay-d"]);
    const premium = await csv(await request("", { period: "90" }));
    expect(premium.rows.map((row) => row["Numero ordine"])).toContain("ebay-old");
  });

  it("legge tutte le pagine una volta sola, anche con ordini nello stesso istante", async () => {
    await env.DB.batch(
      Array.from({ length: 4 }, (_, batch) =>
        env.DB.prepare(
          `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
           SELECT 'p-' || printf('%03d', value), 's-a', 'page-' || printf('%03d', value), ?1, ?1, 'EUR', 100
             FROM json_each(?2)`,
        ).bind(
          new Date(Date.parse(now) - 3_600_000).toISOString(),
          JSON.stringify(Array.from({ length: 80 }, (_, index) => batch * 80 + index)),
        ),
      ),
    );
    const { rows } = await csv(await request(`vista=${snapshotCursor(new Date(now))}`));
    const pages = rows.map((row) => row["Numero ordine"]).filter((id) => id!.startsWith("page-"));
    expect(pages).toHaveLength(320);
    expect(new Set(pages).size).toBe(320);
  });

  it("esclude negozi con i dati eliminati, ordini scaduti e il file di un ambito vuoto", async () => {
    const deleted = (at: string | null) =>
      env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-a'").bind(at).run();
    await deleted(now);
    expect((await request("ordini=o-a")).status).toBe(409);
    await deleted(null);
    expect((await request("ordini=o-a")).status).toBe(200);
    await env.DB.prepare(
      "UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = 'o-a'",
    )
      .bind(new Date(Date.parse(now) - 60_000).toISOString())
      .run();
    expect((await request("ordini=o-a")).status).toBe(409);
  });

  it("rifiuta richieste senza sessione, da un'altra origine o in lettura", async () => {
    const anonymous = await request("ordini=o-a", {}, { cookie: null });
    expect(anonymous.status).toBe(401);
    const foreign = await request("ordini=o-a", {}, { origin: "https://altro.invalid" });
    expect(foreign.status).toBe(403);
    expect((await callRoute(exportLoader, "/api/v1/orders/export")).status).toBe(405);
    // Senza JavaScript un rifiuto torna alla sezione con lo stesso ambito.
    const form = await request("fiscale=locked", { fiscal: "available" }, { json: false });
    expect(form.status).toBe(303);
    expect(form.headers.get("location")).toBe("/app/impostazioni/esportazione?fiscale=locked");
  });

  it("la sezione conta l'ambito e ogni periodo con le regole del file", async () => {
    const single = await routePage(loadSettings, "/app/impostazioni/esportazione?ordini=o-c", {
      cookie,
      params: { sezione: "esportazione" },
    });
    expect(single.page.exportContext).toMatchObject({
      kind: "orders",
      order: "ebay-c",
      filtered: false,
      returnHref: "/app/ordini",
      estimate: { orders: 1, locked: 1, available: 0 },
    });
    expect(single.page.exportPeriods).toBeNull();
    const selection = await routePage(
      loadSettings,
      "/app/impostazioni/esportazione?ordini=o-a,o-c,o-b,o-p",
      { cookie, params: { sezione: "esportazione" } },
    );
    expect(selection.page.exportContext).toMatchObject({
      order: null,
      estimate: { orders: 2, locked: 1, available: 1 },
    });
    const periods = await routePage(loadSettings, "/app/impostazioni/esportazione", {
      cookie,
      params: { sezione: "esportazione" },
    });
    expect(periods.page.exportContext).toBeNull();
    expect(periods.page.exportPeriods?.["7"]).toEqual({ orders: 3, locked: 1, available: 1 });
    expect(periods.page.services.exportAdvanced).toBe(false);
    expect(periods.page.sections).toContain("esportazione");
  });

  it("conta per inizio di periodo con una sola lettura", async () => {
    const userId = (await env.DB.prepare(
      "SELECT user_id FROM workspace_members WHERE workspace_id = 'w-a'",
    ).first<{ user_id: string }>())!.user_id;
    const at = (minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
    const tallies = await visibleOrderTallies(
      env.DB,
      userId,
      "production",
      new Date(now),
      { criteria: {} },
      [at(15), at(0), at(60)],
    );
    expect(tallies).toEqual([
      { orders: 2, locked: 1, available: 1 },
      { orders: 1, locked: 0, available: 1 },
      { orders: 3, locked: 1, available: 1 },
    ]);
  });
});
