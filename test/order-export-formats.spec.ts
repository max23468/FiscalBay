import ExcelJS from "exceljs";

import { strFromU8, unzipSync } from "fflate";

import { describe, expect, it } from "vitest";

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
  XlsxRowLimitError,
  xlsxMaxRows,
  type XlsxCell,
} from "../app/domain/xlsx.server";

import { type VisibleOrder } from "../app/domain/orders.server";

import { now } from "./fixtures/database-fixtures";

import { fulfillmentObservation } from "../app/integrations/ebay/fulfillment.server";

import { it_, visible, tax } from "./fixtures/order-export-scenarios";

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
      // Excel calcola anche telefoni, sottrazioni e divisioni che iniziano con un segno.
      "+39-333-1234567",
      "-2-3",
      "-1/0",
      "+39 333 000 1000",
      "-",
      "+",
    ])
      expect([value, formulaLike(value)]).toEqual([value, true]);
    for (const value of ["", "a=b", "1-2", "00123456789", "-12.50", "+1", "-1,5", "+007"])
      expect([value, formulaLike(value)]).toEqual([value, false]);
    // Casi documentati: uno spazio o un carattere Unicode iniziale (spazio unificatore, segno
    // uguale a larghezza piena, spazio a larghezza zero) non apre una formula e resta intatto.
    for (const value of [" =1+1", "\u00a0=1+1", "\uff1d1+1", "\u200b=1+1", " +39 333"])
      expect([value, formulaLike(value)]).toEqual([value, false]);
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell('Ditta "Rossi", via\r\nRoma')).toBe('"Ditta ""Rossi"", via\r\nRoma"');
    expect(csvCell("+39 333")).toBe(`"'+39 333"`);
    expect(csvCell("-12.50")).toBe('"-12.50"');
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
    expect(cell("Codici fiscali esteri")).toBe("VAT (DE): DE123456789");
    expect(cell("Stato del Codice Fiscale")).toBe("Disponibile");
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
    expect(column("Tax code")).toEqual(["RSSMRA80A01H501U", "RSSMRA80A01H501U"]);
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
    expect(cell("Stato del Codice Fiscale")).toBe("Acquirente estero");
    expect(cell("Pagamento")).toBe("ON_HOLD");
    expect(cell("Totale ordine")).toBe("15.99");
    expect(cell("Articolo")).toBe("");
    const locked = exportRows(visible({ fiscalState: "locked" }), "order", it_, "Europe/Rome")[0]!;
    expect(locked[exportHeader("order", it_).indexOf("Stato del Codice Fiscale")]).toBe(
      "Da sbloccare",
    );
  });

  it("scrive la situazione fiscale con l'avvertenza della pagina sull'ultima lettura", () => {
    const situation = (overrides: Partial<VisibleOrder>, language: "it" | "en" = "it") =>
      exportRows(visible(overrides), "order", appCopy[language], "Europe/Rome", ["fiscal"])[0]![0];
    expect(situation({})).toBe("Disponibile");
    expect(situation({ taxVerification: "error" })).toBe(
      "Disponibile, ultima lettura da eBay non riuscita",
    );
    expect(situation({ taxVerification: "checking" })).toBe(
      "Disponibile, nuova lettura da eBay in corso",
    );
    expect(situation({ taxAvailability: "masked" })).toBe("Disponibile, ora nascosto da eBay");
    expect(situation({ taxAvailability: "absent" })).toBe("Disponibile, non più riportato da eBay");
    expect(situation({ taxAvailability: "not_included" })).toBe(
      "Disponibile, non più riportato da eBay",
    );
    expect(situation({ taxVerification: "error" }, "en")).toBe(
      "Available, latest eBay read failed",
    );
    // Senza valore resta lo stato della pagina, anche con la lettura non riuscita o in corso.
    expect(situation({ fiscalState: "locked", taxVerification: "checking" })).toBe("Da sbloccare");
    expect(situation({ fiscalState: "error", taxVerification: "error" })).toBe(
      "Aggiornamento non riuscito",
    );
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
    for (const name of ["Data", "Ultima verifica del Codice Fiscale", "Ultima modifica su eBay"])
      expect([name, column(name)[0]!.numFmt]).toEqual([name, "yyyy-mm-dd hh:mm:ss"]);
    // Larghezze: il nome intero, più spazio per articoli, indirizzo e altri identificativi.
    const width = (name: string) => sheet.getColumn(header.indexOf(name)).width;
    expect(
      [
        "Numero ordine",
        "Paese",
        "Articolo",
        "Indirizzo di fatturazione",
        "Codici fiscali esteri",
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
    expect(values("Codici fiscali esteri")[1]).toBe("VAT (DE): DE123456789");
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

  it("interrompe il foglio oltre il limite di righe di Excel prima di scriverlo", async () => {
    const sheet = { name: "Ordini", header: ["A"], widths: [10], modified: new Date(now) };
    let closed = false;
    async function* pages(sizes: number[]) {
      try {
        for (const size of sizes) yield size;
      } finally {
        closed = true;
      }
    }
    const rows = (size: number): XlsxCell[][] =>
      Array.from({ length: size }, () => [{ type: "text", value: "x" }]);
    const bytes = (stream: ReadableStream<Uint8Array>) => new Response(stream).arrayBuffer();
    // Con l'intestazione il foglio arriva esattamente al limite e si scrive.
    expect((await bytes(xlsxStream(sheet, pages([1, 1]), rows, 3))).byteLength).toBeGreaterThan(0);
    closed = false;
    await expect(bytes(xlsxStream(sheet, pages([2, 1]), rows, 3))).rejects.toBeInstanceOf(
      XlsxRowLimitError,
    );
    expect(closed).toBe(true);
    // Il limite predefinito è quello di un foglio di Excel, intestazione compresa.
    expect(xlsxMaxRows).toBe(1_048_576);
    const empty = (size: number): XlsxCell[][] => Array.from({ length: size }, () => []);
    await expect(bytes(xlsxStream(sheet, pages([xlsxMaxRows]), empty))).rejects.toBeInstanceOf(
      XlsxRowLimitError,
    );
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

  it("senza indirizzo di fatturazione scrive quello di spedizione", () => {
    const order = visible({});
    order.summary.buyer = {
      ...order.summary.buyer!,
      billingAddress: null,
      shipTo: {
        name: "Luca Neri",
        phone: null,
        address: {
          addressLine1: "Piazza Spedizione 2",
          addressLine2: null,
          city: "Bolzano",
          stateOrProvince: "BZ",
          postalCode: "39100",
          countryCode: "IT",
        },
      },
    };
    expect(exportRows(order, "order", it_, "Europe/Rome")[0]!.slice(9, 14)).toEqual([
      "Piazza Spedizione 2",
      "39100",
      "Bolzano",
      "BZ",
      "IT",
    ]);
    // Senza nessuno dei due indirizzi le colonne restano vuote.
    order.summary.buyer = { ...order.summary.buyer!, shipTo: null };
    expect(exportRows(order, "order", it_, "Europe/Rome")[0]!.slice(9, 14)).toEqual([
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("scrive l'acquirente e la riga completa, con il telefono della consegna come riserva", () => {
    const order = visible({
      taxIdentifiers: [
        tax("VAT_ID", "22222222222"),
        tax("PartitaIVA", "11111111111", null),
        // Partita IVA riportata come Codice Fiscale; il codice di un ente resta Codice Fiscale.
        tax("CODICE_FISCALE", "33333333333"),
        tax("CODICE_FISCALE", "80012345678"),
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
        "80012345678",
        "11111111111 | 22222222222 | 33333333333",
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
        "80012345678",
        "11111111111 | 22222222222 | 33333333333",
        "TIN: ZZ1 | VAT (DE): DE1 | VAT (FR): FR2",
        "Disponibile",
        "2026-09-13 23:00:00",
        "2026-09-14 10:30:00",
      ],
    ]);
  });

  it("dopo il segno lascia intatto soltanto un numero semplice", () => {
    for (const value of ["-1,5", "-12.50", "+3", "-0.5", "+1234567"])
      expect([value, formulaLike(value)]).toEqual([value, false]);
    for (const value of [
      "+(39) 333",
      "+39/333",
      "+39-333",
      "-(1)",
      "+39 a",
      "-1e5",
      "+ SUM(1)",
      "-(A1)",
      "-1.",
      "-.5",
      "-1,5,0",
      "+1 ",
    ])
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
