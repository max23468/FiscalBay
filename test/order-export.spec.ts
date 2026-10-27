import { env } from "cloudflare:workers";
import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  csvCell,
  exportCsvStream,
  exportDateTime,
  exportFileName,
  exportRows,
  exportXlsxStream,
  formulaLike,
} from "../app/domain/order-export.server";
import { exportHeader, parseColumns, standardColumns } from "../app/orders/export-columns";
import {
  columnLetters,
  serialDate,
  xlsxCell,
  xlsxRow,
  xlsxStream,
  xlsxText,
  type XlsxCell,
} from "../app/domain/xlsx.server";
import { visibleOrderTallies, type VisibleOrder } from "../app/domain/orders.server";
import { action as exportAction, loader as exportLoader } from "../app/routes/order-export";
import { action as settingsAction, loader as loadSettings } from "../app/routes/settings";
import { maxExportConfigurations } from "../app/domain/export-configurations.server";
import { verifiedSession } from "./fixtures/account-fixtures";
import {
  insertEntitlement,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./fixtures/database-fixtures";
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

describe("colonne scelte e file XLSX", () => {
  it("accetta colonne note una volta sola e tralascia quelle della sola riga per articolo", () => {
    expect(parseColumns("total,order,taxCode", "order")).toEqual(["total", "order", "taxCode"]);
    expect(parseColumns("itemTotal,order", "order")).toEqual(["order"]);
    expect(parseColumns("itemTotal,order", "item")).toEqual(["itemTotal", "order"]);
    for (const value of ["", "order,order", "order,item", "order,", "itemTotal"])
      expect([value, parseColumns(value, "order")]).toEqual([value, null]);
    expect(standardColumns("item")).toHaveLength(28);
    expect(standardColumns("order")).toEqual(
      standardColumns("item").filter((column) => column !== "itemTotal"),
    );
    expect(exportHeader("item", it_, ["items", "total"])).toEqual(["Articolo", "Totale ordine"]);
    expect(exportHeader("order", it_, ["items", "total"])).toEqual(["Articoli", "Totale ordine"]);
    // Le colonne scelte seguono l'ordine dato, con gli stessi valori dello schema standard.
    expect(exportRows(visible(), "order", it_, "UTC", ["total", "order"])).toEqual([
      ["15.99", "01-00001"],
    ]);
  });

  it("scrive il testo come Excel lo rilegge, senza caratteri che rompono il file", () => {
    expect(xlsxText(`a & <b> "c"`)).toBe("a &amp; &lt;b&gt; &quot;c&quot;");
    // Una sequenza che Excel decodificherebbe resta com'è; i caratteri di controllo si codificano.
    expect(xlsxText("_x0041_ _x41_ _xZZZZ_")).toBe("_x005F_x0041_ _x41_ _xZZZZ_");
    expect(xlsxText("a\u0001b\rc\nd\te\u001F\uFFFE")).toBe("a_x0001_b_x000D_c\nd\te_x001F__xFFFE_");
    expect(xlsxText("\uD83D x \uDE00 😀")).toBe("\uFFFD x \uFFFD 😀");
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetters)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
    expect(serialDate("1900-03-01 00:00:00")).toBe(61);
    expect(serialDate("2026-09-13 12:00:00")).toBe(46278.5);
    for (const value of ["2026-09-13T12:00:00", "x2026-09-13 12:00:00", "2026-09-13 12:00:00x"])
      expect([value, serialDate(value)]).toEqual([value, null]);
    expect(serialDate("")).toBeNull();
  });

  it("dà a ogni cella il suo tipo e lascia testo ciò che non è un numero o una data", () => {
    const cell = (type: XlsxCell["type"], value: string) => xlsxCell({ type, value }, "B7");
    expect(cell("text", "")).toBe("");
    expect(cell("number", "")).toBe("");
    expect(cell("number", "3")).toBe('<c r="B7" s="3"><v>3</v></c>');
    expect(cell("number", "15.99")).toBe('<c r="B7" s="4"><v>15.99</v></c>');
    expect(cell("number", "-1.250")).toBe('<c r="B7" s="6"><v>-1.250</v></c>');
    expect(cell("date", "2026-09-13 12:00:00")).toBe('<c r="B7" s="5"><v>46278.5</v></c>');
    const text = (value: string) =>
      `<c r="B7" s="2" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
    expect(cell("number", "1.5")).toBe(text("1.5"));
    expect(cell("number", "1e5")).toBe(text("1e5"));
    expect(cell("number", "2026-09-13 12:00:00")).toBe(text("2026-09-13 12:00:00"));
    expect(cell("date", "13/09/2026")).toBe(text("13/09/2026"));
    expect(cell("text", "=1+1")).toBe(text("=1+1"));
    expect(cell("text", "007")).toBe(text("007"));
    expect(
      xlsxRow(
        [
          { type: "text", value: "" },
          { type: "number", value: "2" },
        ],
        3,
      ),
    ).toBe('<row r="3"><c r="B3" s="3"><v>2</v></c></row>');
  });

  it("legge l'XLSX con un altro lettore: tipi, testo e totali di più articoli e identificativi", async () => {
    const order = visible({
      taxIdentifiers: [
        tax("CODICE_FISCALE", "RSSMRA80A01H501U"),
        tax("VAT_ID", "00123456789"),
        tax("VAT", "DE123456789", "DE"),
      ],
    });
    order.summary.lineItems[0]!.title = '=HYPERLINK("http://x.invalid")';
    order.summary.lineItems[0]!.sku = "00042";
    async function* pages() {
      yield [order, visible({ ebayOrderId: "01-00002", totalMinor: 100, currency: "JPY" })];
      yield [visible({ ebayOrderId: "01-00003" })];
    }
    const at = new Date(now);
    const bytes = new Uint8Array(
      await new Response(exportXlsxStream(pages(), "item", it_, "Europe/Rome", at)).arrayBuffer(),
    );
    const parts = unzipSync(bytes);
    expect(Object.keys(parts).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    // Parti fisse con dichiarazione, spazi dei nomi e relazioni che Excel richiede.
    const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const schemas = "http://schemas.openxmlformats.org";
    for (const part of Object.values(parts))
      expect(strFromU8(part).startsWith(declaration)).toBe(true);
    expect(strFromU8(parts["_rels/.rels"]!)).toBe(
      `${declaration}<Relationships xmlns="${schemas}/package/2006/relationships"><Relationship Id="rId1" Type="${schemas}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    );
    expect(strFromU8(parts["xl/_rels/workbook.xml.rels"]!)).toBe(
      `${declaration}<Relationships xmlns="${schemas}/package/2006/relationships"><Relationship Id="rId1" Type="${schemas}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${schemas}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    );
    for (const name of ["xl/workbook.xml", "xl/worksheets/sheet1.xml"])
      expect(strFromU8(parts[name]!)).toContain(
        `xmlns="${schemas}/spreadsheetml/2006/main" xmlns:r="${schemas}/officeDocument/2006/relationships">`,
      );
    expect(strFromU8(parts["xl/styles.xml"]!)).toContain(
      `<styleSheet xmlns="${schemas}/spreadsheetml/2006/main">`,
    );
    const xml = Object.values(parts)
      .map((part) => strFromU8(part))
      .join("");
    // Nessuna formula, macro, collegamento esterno o hyperlink.
    expect(xml).not.toMatch(/<f[ >]|vbaProject|externalLink|<hyperlink/u);
    expect(strFromU8(parts["xl/workbook.xml"]!)).toContain(
      `<sheet name="Ordini" sheetId="1" r:id="rId1"/>`,
    );
    expect(strFromU8(parts["xl/workbook.xml"]!)).toContain("'Ordini'!$A$1:$AB$7");
    expect(strFromU8(parts["xl/worksheets/sheet1.xml"]!)).toContain('<autoFilter ref="A1:AB7"/>');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Ordini")!;
    const header = sheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual(exportHeader("item", it_));
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    const column = (name: string) =>
      [2, 3, 4, 5, 6, 7].map((row) => sheet.getRow(row).getCell(header.indexOf(name)));
    const values = (name: string) => column(name).map((cell) => cell.value);
    expect(values("Numero ordine")).toEqual([
      "01-00001",
      "01-00001",
      "01-00002",
      "01-00002",
      "01-00003",
      "01-00003",
    ]);
    // Il totale dell'ordine compare una volta, anche con più articoli e identificativi.
    expect(values("Totale ordine")).toEqual([15.99, null, 100, null, 15.99, null]);
    expect(values("Importo articolo")).toEqual([10, 5.99, null, null, 10, 5.99]);
    expect(column("Totale ordine")[0]!.numFmt).toBe("0.00");
    expect(column("Totale ordine")[2]!.numFmt).toBe("0");
    expect(values("Quantità")).toEqual([2, 1, 2, 1, 2, 1]);
    expect(values("Data")[0]).toEqual(new Date("2026-09-13T22:00:00.000Z"));
    for (const name of ["Data", "Ultima verifica fiscale", "Ultima modifica su eBay"])
      expect([name, column(name)[0]!.numFmt]).toEqual([name, "yyyy-mm-dd hh:mm:ss"]);
    // Larghezze: il nome intero, più spazio per articoli, indirizzo e altri identificativi.
    const width = (name: string) => sheet.getColumn(header.indexOf(name)).width;
    expect(
      [
        "Numero ordine",
        "Paese",
        "Articolo",
        "Indirizzo di fatturazione",
        "Altri identificativi fiscali",
      ].map(width),
    ).toEqual([17, 14, 40, 40, 40]);
    // CF, Partita IVA, SKU e la formula del titolo restano testo, con gli zeri iniziali.
    for (const [name, value] of [
      ["Codice Fiscale", "RSSMRA80A01H501U"],
      ["Partita IVA", "00123456789"],
      ["SKU", "00042"],
      ["Articolo", '=HYPERLINK("http://x.invalid")'],
      ["CAP", "00184"],
      ["Telefono", "+39 333 000 1000"],
    ] as const) {
      const [cell] = column(name);
      expect([name, cell!.value, cell!.type, cell!.numFmt]).toEqual([
        name,
        value,
        ExcelJS.ValueType.String,
        "@",
      ]);
    }
    expect(values("Altri identificativi fiscali")[1]).toBe("VAT (DE): DE123456789");
  });

  it("scrive le parti del foglio come le legge Excel, con righe di più pagine", async () => {
    async function* pages() {
      yield [
        ["x", "1"],
        ["2026-09-13 12:00:00", "_x0041_"],
      ];
      yield [["y", "2.50"]];
    }
    const sheet = {
      name: "Ordini d'Italia",
      header: ["a", "b"],
      widths: [10, 20],
      modified: new Date(now),
    };
    const bytes = new Uint8Array(
      await new Response(
        xlsxStream(sheet, pages(), (page) =>
          page.map(([first, second]) => [
            { type: "date" as const, value: first! },
            { type: "number" as const, value: second! },
          ]),
        ),
      ).arrayBuffer(),
    );
    const parts = Object.fromEntries(
      Object.entries(unzipSync(bytes)).map(([name, part]) => [name, strFromU8(part)]),
    );
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const ns = "http://schemas.openxmlformats.org";
    const text = (reference: string, style: number, value: string) =>
      `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
    expect(parts["[Content_Types].xml"]).toBe(
      `${head}<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    );
    const xf = (format: number, font = "") =>
      `<xf numFmtId="${format}" fontId="${font ? 1 : 0}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"${font}/>`;
    expect(parts["xl/styles.xml"]).toBe(
      `${head}<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/><numFmt numFmtId="165" formatCode="0.000"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xf(49, ' applyFont="1"')}${xf(49)}${xf(1)}${xf(2)}${xf(164)}${xf(165)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    );
    expect(parts["xl/worksheets/sheet1.xml"]).toBe(
      `${head}<worksheet xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="10" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/></cols><sheetData><row r="1">${text("A1", 1, "a")}${text("B1", 1, "b")}</row><row r="2">${text("A2", 2, "x")}<c r="B2" s="3"><v>1</v></c></row><row r="3"><c r="A3" s="5"><v>46278.5</v></c>${text("B3", 2, "_x005F_x0041_")}</row><row r="4">${text("A4", 2, "y")}<c r="B4" s="4"><v>2.50</v></c></row></sheetData><autoFilter ref="A1:B4"/></worksheet>`,
    );
    expect(parts["xl/workbook.xml"]).toBe(
      `${head}<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Ordini d'Italia" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Ordini d''Italia'!$A$1:$B$4</definedName></definedNames></workbook>`,
    );
  });

  it("interrompendo l'XLSX chiude anche la lettura delle pagine", async () => {
    let read = 0;
    let closed = false;
    // Pagine senza fine: soltanto l'interruzione del download ferma la lettura.
    async function* pages() {
      try {
        for (;;) {
          read++;
          yield [visible({ ebayOrderId: `01-${read}` })];
        }
      } finally {
        closed = true;
      }
    }
    const reader = exportXlsxStream(pages(), "order", it_, "UTC", new Date(now)).getReader();
    while (read === 0) await reader.read();
    await reader.cancel();
    expect(closed).toBe(true);
  });

  it("nomina il file XLSX con la sua estensione", () => {
    expect(exportFileName(it_, new Date(now), "UTC", "xlsx")).toBe(
      "fiscalbay-ordini-2026-09-13.xlsx",
    );
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
  let userId: string;

  beforeEach(async () => {
    await resetDatabase();
    await seed();
    const session = await verifiedSession(`export-${crypto.randomUUID()}@example.invalid`);
    cookie = session.cookie;
    userId = session.userId;
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

  const premium = () =>
    insertEntitlement({
      source: "admin",
      endsAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
      grantedBy: "owner",
      grantReason: "prova",
    }).run();

  /** Foglio dell'XLSX letto da un altro lettore, con l'XML del foglio per cercare valori. */
  async function xlsx(response: Response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0]!;
    const rows = sheet.getSheetValues().slice(1) as unknown[][];
    return {
      xml: strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]!),
      rows: rows.map((row) => row.slice(1)),
    };
  }

  it("con Premium crea l'XLSX con le colonne scelte; nel Free resta il CSV standard", async () => {
    for (const fields of [{ format: "xlsx" }, { columns: "order" }] as Record<string, string>[]) {
      const refused = await request("ordini=o-a", fields);
      expect(refused.status).toBe(403);
      expect(await refused.json()).toEqual({
        ok: false,
        notice: it_.settings.export.exportPremium,
      });
    }
    await premium();
    const response = await request("ordini=o-a,o-c", {
      format: "xlsx",
      rows: "item",
      columns: "taxCode,order,itemTotal,total",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="fiscalbay-ordini-2026-09-13.xlsx"',
    );
    const { xml, rows } = await xlsx(response);
    expect(rows).toEqual([
      ["Codice Fiscale", "Numero ordine", "Importo articolo", "Totale ordine"],
      ["RSSMRA80A01H501U", "ebay-a", 9.99, 12.99],
      ["RSSMRA80A01H501U", "ebay-a", 3],
      // Con Premium anche il dato prima da sbloccare entra nel file.
      ["VRDGPP80A01H501X", "ebay-c", 5, 5],
    ]);
    expect(xml).toContain('<t xml:space="preserve">VRDGPP80A01H501X</t>');
    // Con Premium anche il CSV segue le colonne scelte; una scelta non valida non crea il file.
    const { rows: csvRows } = await csv(await request("ordini=o-a", { columns: "total,order" }));
    expect(csvRows).toEqual([{ "Totale ordine": "12.99", "Numero ordine": "ebay-a" }]);
    const invalid = await request("ordini=o-a", { columns: "order,order" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      ok: false,
      notice: it_.settings.export.exportColumnsInvalid,
    });
  });

  it("legge un dataset esteso a pagine senza moltiplicare totali o righe", async () => {
    await premium();
    const created = new Date(Date.parse(now) - 3_600_000).toISOString();
    const ids = JSON.stringify(Array.from({ length: 300 }, (_, index) => index));
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
         SELECT 'x-' || value, 's-a', 'big-' || printf('%03d', value), ?1, ?1, 'EUR', 1000 + value
           FROM json_each(?2)`,
      ).bind(created, ids),
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
         SELECT 'x-' || o.value || '-' || i.value, 'x-' || o.value, 'l-' || i.value,
                'Articolo ' || i.value, 1, 100, 'EUR'
           FROM json_each(?1) o, json_each('[0,1,2]') i`,
      ).bind(ids),
      env.DB.prepare(
        `INSERT INTO tax_identifiers
           (id, order_id, identifier_type, issuing_country, value, source, observed_at)
         SELECT 'tx-' || o.value || '-' || t.key, 'x-' || o.value, t.value ->> 0, t.value ->> 1,
                t.value ->> 2, 'ebay_trading_get_orders', ?2
           FROM json_each(?1) o,
                json_each('[["CODICE_FISCALE","IT","RSSMRA80A01H501U"],["VAT_ID","IT","00123456789"],["VAT","DE","DE123456789"]]') t`,
      ).bind(ids, now),
    ]);
    const { rows } = await xlsx(
      await request(`vista=${snapshotCursor(new Date(now))}`, {
        format: "xlsx",
        rows: "item",
        columns: "order,itemTotal,total,taxCode,vat,otherTax",
      }),
    );
    const big = rows.filter((row) => String(row[0]).startsWith("big-"));
    expect(big).toHaveLength(900);
    expect(new Set(big.map((row) => row[0])).size).toBe(300);
    const sum = (index: number) =>
      big.reduce((total, row) => total + Math.round(Number(row[index] ?? 0) * 100), 0);
    // Totali una volta per ordine e importi degli articoli una volta per riga.
    expect(sum(2)).toBe(
      Array.from({ length: 300 }, (_, index) => 1000 + index).reduce((a, b) => a + b),
    );
    expect(sum(1)).toBe(900 * 100);
    expect(big[0]!.slice(3)).toEqual(["RSSMRA80A01H501U", "00123456789", "VAT (DE): DE123456789"]);
  });

  /** Esito di un'azione delle Impostazioni, con lo stato HTTP. */
  async function settingsIntent(fields: Record<string, string>, as = cookie) {
    const result: unknown = await callRoute(settingsAction, "/app/impostazioni/esportazione", {
      cookie: as,
      fields,
    });
    if (result && typeof result === "object" && "init" in result && "data" in result)
      return {
        status: (result.init as ResponseInit | null)?.status ?? 200,
        body: result.data,
      };
    return { status: 200, body: result };
  }

  const configurations = async () =>
    (
      await routePage(loadSettings, "/app/impostazioni/esportazione", {
        cookie,
        params: { sezione: "esportazione" },
      })
    ).page.exportConfigurations;

  it("salva, sostituisce ed elimina le configurazioni soltanto con Premium", async () => {
    const save = (fields: Record<string, string>) =>
      settingsIntent({
        intent: "export-save",
        name: "Commercialista",
        format: "xlsx",
        rows: "order",
        columns: "order,taxCode",
        ...fields,
      });
    expect(await save({})).toEqual({
      status: 403,
      body: { ok: false, notice: it_.settings.export.exportPremium },
    });
    await premium();
    expect(await save({ name: "  Commercialista " })).toEqual({
      status: 200,
      body: { ok: true, notice: it_.settings.export.exportConfigSaved },
    });
    expect(await configurations()).toEqual([
      {
        id: expect.any(String),
        name: "Commercialista",
        format: "xlsx",
        rows: "order",
        columns: ["order", "taxCode"],
      },
    ]);
    // Lo stesso nome sostituisce la configurazione; un altro nome ne aggiunge una.
    await save({ format: "csv", rows: "item", columns: "itemTotal,order" });
    await save({ name: "Altro" });
    expect(
      (await configurations()).map(({ name, format, rows, columns }) => [
        name,
        format,
        rows,
        columns,
      ]),
    ).toEqual([
      ["Altro", "xlsx", "order", ["order", "taxCode"]],
      ["Commercialista", "csv", "item", ["itemTotal", "order"]],
    ]);
    // Un nome di 60 caratteri è ammesso; un campo assente no.
    expect((await save({ name: "x".repeat(60) })).status).toBe(200);
    await env.DB.prepare("DELETE FROM export_configurations WHERE length(name) = 60").run();
    for (const missing of ["name", "format", "rows", "columns"])
      expect(
        (
          await settingsIntent(
            Object.fromEntries(
              Object.entries({
                intent: "export-save",
                name: "Senza campo",
                format: "csv",
                rows: "order",
                columns: "order",
              }).filter(([key]) => key !== missing),
            ),
          )
        ).status,
      ).toBe(400);
    for (const fields of [
      { name: " " },
      { name: "x".repeat(61) },
      { format: "pdf" },
      { rows: "riga" },
      { columns: "order,ignota" },
      { columns: "itemTotal" },
    ] as Record<string, string>[])
      expect((await save(fields)).status).toBe(400);
    // Oltre il limite non si aggiunge una configurazione, ma si sostituisce ancora una esistente.
    for (let index = 0; index < maxExportConfigurations - 2; index++)
      expect((await save({ name: `C${index}` })).status).toBe(200);
    expect(await save({ name: "Ultima" })).toEqual({
      status: 409,
      body: {
        ok: false,
        notice: it_.settings.export.exportConfigFull(maxExportConfigurations),
      },
    });
    expect((await save({ name: "Altro", format: "csv" })).status).toBe(200);
    expect(await configurations()).toHaveLength(maxExportConfigurations);
    // Un'altra persona non elimina le configurazioni; il titolare sì, anche senza Premium.
    const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
    const [first] = await configurations();
    expect(
      (await settingsIntent({ intent: "export-delete", id: first!.id }, other.cookie)).status,
    ).toBe(404);
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    expect(await settingsIntent({ intent: "export-delete", id: first!.id })).toEqual({
      status: 200,
      body: { ok: true, notice: it_.settings.export.exportConfigDeleted },
    });
    expect(await configurations()).toHaveLength(maxExportConfigurations - 1);
    // Una colonna non più prevista lascia le colonne standard; l'account porta via tutto.
    await env.DB.prepare("UPDATE export_configurations SET columns = 'ignota' WHERE user_id = ?")
      .bind(userId)
      .run();
    expect((await configurations())[0]!.columns).toEqual(standardColumns("order"));
    await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run();
    expect(await env.DB.prepare("SELECT count(*) AS n FROM export_configurations").first("n")).toBe(
      0,
    );
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
