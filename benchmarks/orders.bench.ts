import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { expect, test } from "vitest";

import {
  createCsv,
  createXlsx,
  createExportZip,
  type ExportOrder,
} from "../app/domain/export.server";
import { fulfillmentObservation } from "../app/integrations/ebay/fulfillment.server";
import { parseMinor, minorToDecimal } from "../app/money";
import { taxQuality } from "../app/tax-quality";

// Preparazione e verifiche fuori dalla misura, nessun accesso ai provider.
const detail = {
  orderId: "synthetic-order",
  creationDate: "2026-01-01T00:00:00.000Z",
  lastModifiedDate: "2026-01-02T00:00:00.000Z",
  pricingSummary: { total: { value: "12.99", currency: "EUR" } },
  lineItems: [{ lineItemId: "synthetic-line", title: "Oggetto sintetico", quantity: 1 }],
};
const payload = JSON.stringify(detail);
const observedAt = "2026-01-03T00:00:00.000Z";
const tax = { type: "PartitaIVA", issuingCountry: "IT", value: "00123456789" };
const datasets = [100, 1000].map((size) =>
  Array.from({ length: size }, (_, index): ExportOrder => ({
    orderId: `synthetic-${index}`,
    createdAt: detail.creationDate,
    totalMinor: 1299,
    currency: "EUR",
    taxIdentifiers: [{ type: "VAT_ID", value: tax.value }],
  })),
);
const options = { time: 200, iterations: 8, warmupTime: 50, warmupIterations: 2 };

test("parsing e normalizzazione eBay", async ({ bench }) => {
  expect(fulfillmentObservation(JSON.parse(payload), observedAt)).toMatchObject({
    externalOrderId: detail.orderId,
    total: { minor: 1299, currency: "EUR" },
    items: [{ lineItemId: "synthetic-line", quantity: 1 }],
  });
  await bench(
    "ebay-normalization",
    { writeResult: "reports/benchmarks/raw/ebay-normalization.json" },
    () => fulfillmentObservation(JSON.parse(payload), observedAt),
  ).run(options);
});

test("qualità formale e importi", async ({ bench }) => {
  expect(taxQuality(tax, [])).toBe("checksum");
  expect(minorToDecimal(parseMinor("12.99", "EUR"), "EUR")).toBe("12.99");
  await bench("tax-quality", { writeResult: "reports/benchmarks/raw/tax-quality.json" }, () =>
    taxQuality(tax, []),
  ).run(options);
  await bench("money", { writeResult: "reports/benchmarks/raw/money.json" }, () =>
    minorToDecimal(parseMinor("12.99", "EUR"), "EUR"),
  ).run(options);
});

for (const orders of datasets) {
  test(`export di ${orders.length} ordini sintetici`, async ({ bench }) => {
    const csv = strFromU8(createCsv(orders));
    expect(csv.split("\r\n")).toHaveLength(orders.length + 2);
    expect(csv).toContain(`"synthetic-${orders.length - 1}"`);
    expect(csv).toContain('"00123456789"');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await createXlsx(orders)) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets[0]!.rowCount).toBe(orders.length + 1);
    const zip = unzipSync(await createExportZip(orders));
    expect(strFromU8(zip["ordini.csv"]!)).toBe(csv);
    expect(zip["ordini.xlsx"]!.length).toBeGreaterThan(0);

    for (const [format, generate] of [
      ["csv", createCsv],
      ["xlsx", createXlsx],
      ["zip", createExportZip],
    ] as const) {
      const name = `${format}-${orders.length}`;
      await bench(name, { writeResult: `reports/benchmarks/raw/${name}.json` }, () =>
        generate(orders),
      ).run(options);
    }
  });
}
