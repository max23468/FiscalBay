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
