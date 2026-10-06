import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createCsv,
  createExportZip,
  createXlsx,
  type ExportOrder,
} from "../app/domain/export.server";

const orders: ExportOrder[] = [
  {
    orderId: "24-12345-67890",
    createdAt: "2026-09-13T20:00:00.000Z",
    totalMinor: 1299,
    currency: "EUR",
    taxIdentifiers: [
      { type: "CODICE_FISCALE", value: "=1+1" },
      { type: "VAT_ID", value: "00123456789" },
    ],
  },
];

describe("export ordini", () => {
  it("genera un CSV integro e neutralizza le formule", () => {
    const csv = strFromU8(createCsv(orders));
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"00123456789"');
  });

  it("scrive il CSV esatto: intestazioni, totale, virgolette e ordine senza identificativi", () => {
    const bytes = createCsv([
      {
        orderId: "24-00001",
        createdAt: "2026-09-13T20:00:00.000Z",
        totalMinor: 1299,
        currency: "EUR",
        taxIdentifiers: [{ type: "CODICE_FISCALE", value: 'Ditta "Rossi"' }],
      },
      {
        orderId: "24-00002",
        createdAt: "2026-09-14T08:30:00.000Z",
        totalMinor: 5,
        currency: "EUR",
        taxIdentifiers: [],
      },
    ]);
    // Il BOM fa riconoscere UTF-8 a Excel; la decodifica lo rimuove, quindi si legge sui byte.
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(strFromU8(bytes)).toBe(
      '"Ordine","Data UTC","Totale","Valuta","Tipo identificativo","Identificativo"\r\n' +
        '"24-00001","2026-09-13T20:00:00.000Z","12.99","EUR","CODICE_FISCALE","Ditta ""Rossi"""\r\n' +
        '"24-00002","2026-09-14T08:30:00.000Z","0.05","EUR","",""\r\n',
    );
  });

  it("neutralizza ogni prefisso di formula e lascia invariati gli altri valori", () => {
    const cell = (value: string) =>
      strFromU8(
        createCsv([
          {
            orderId: "24-00001",
            createdAt: "2026-09-13T20:00:00.000Z",
            totalMinor: 100,
            currency: "EUR",
            taxIdentifiers: [{ type: "VAT_ID", value }],
          },
        ]),
      )
        .trimEnd()
        .split("\r\n")[1]
        ?.split(",")
        .at(-1);
    for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", "\tA", "\rA"])
      expect(cell(value)).toBe(`"'${value}"`);
    for (const value of ["a=b", "1-2", "IT00123456789"]) expect(cell(value)).toBe(`"${value}"`);
  });

  it("intesta il foglio XLSX e ne fissa i metadati", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await createXlsx(orders)) as unknown as ExcelJS.Buffer);
    expect(workbook.creator).toBe("FiscalBay");
    expect(workbook.getWorksheet("Ordini")?.getRow(1).values).toEqual([
      undefined,
      "Ordine",
      "Data UTC",
      "Totale",
      "Valuta",
      "Tipo identificativo",
      "Identificativo",
    ]);
  });

  it("conserva gli identificativi come testo in XLSX", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await createXlsx(orders)) as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Ordini");
    expect(sheet?.getCell("F2").value).toBe("=1+1");
    expect(sheet?.getCell("F2").numFmt).toBe("@");
    expect(sheet?.getCell("F3").value).toBe("00123456789");
  });

  it("consegna entrambi i formati in uno ZIP leggibile", async () => {
    const archive = unzipSync(await createExportZip(orders));
    expect(Object.keys(archive).sort()).toEqual(["ordini.csv", "ordini.xlsx"]);
    expect(archive["ordini.csv"]?.byteLength).toBeGreaterThan(100);
    expect(archive["ordini.xlsx"]?.byteLength).toBeGreaterThan(1_000);
  });

  it("genera mille ordini entro il budget locale del Worker", async () => {
    const sample = Array.from({ length: 1_000 }, (_, index): ExportOrder => ({
      orderId: `ordine-${index}`,
      createdAt: "2026-09-13T20:00:00.000Z",
      totalMinor: 1_000 + index,
      currency: "EUR",
      taxIdentifiers: [
        { type: "CODICE_FISCALE", value: `SYNTHCF${index.toString().padStart(8, "0")}` },
        { type: "VAT_ID", value: index.toString().padStart(11, "0") },
      ],
    }));
    const startedAt = performance.now();
    const archive = await createExportZip(sample);

    expect(archive.byteLength).toBeGreaterThan(10_000);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });
});
