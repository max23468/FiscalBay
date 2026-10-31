import ExcelJS from "exceljs";
import { strFromU8 } from "fflate";
import { expect, test } from "vitest";

import { appCopy } from "../app/app-copy";
import { exportCsvStream, exportXlsxStream } from "../app/domain/order-export.server";
import type { VisibleOrder } from "../app/domain/orders.server";
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
/** Ordine visibile sintetico con tre articoli e tre identificativi, come un dataset esteso. */
function syntheticOrder(index: number): VisibleOrder {
  const item = (line: number) => ({
    lineItemId: `line-${line}`,
    title: `Oggetto sintetico ${line}`,
    quantity: line + 1,
    sku: `00${line}`,
    totalMinor: 433,
    currency: "EUR",
    imageUrl: null,
    stableKey: null,
  });
  return {
    id: `o-${index}`,
    ebayOrderId: `synthetic-${index}`,
    creationTime: detail.creationDate,
    lastModifiedTime: detail.lastModifiedDate,
    currency: "EUR",
    totalMinor: 1299,
    storeId: "s",
    storeName: "Negozio sintetico",
    marketplaceId: "EBAY_IT",
    provisional: false,
    summary: {
      buyer: {
        username: "acquirente",
        name: "Acquirente Sintetico",
        email: null,
        phone: null,
        billingAddress: {
          addressLine1: "Via Sintetica 1",
          addressLine2: null,
          city: "Roma",
          postalCode: "00100",
          stateOrProvince: "RM",
          countryCode: "IT",
        },
        shipTo: null,
        masked: undefined,
      },
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "FULFILLED",
      payment: "paid",
      shipping: "shipped",
      lineItems: [item(0), item(1), item(2)],
    },
    fiscalState: "available",
    taxVerification: "completed",
    taxAvailability: "present",
    taxCheckedAt: observedAt,
    firstTaxAvailableAt: observedAt,
    lockedShownAs: "CF",
    reconciliationIssue: false,
    taxIdentifiers: [
      ["CODICE_FISCALE", "IT", "RSSMRA80A01H501U"],
      ["VAT_ID", "IT", tax.value],
      ["VAT", "DE", "DE123456789"],
    ].map(([type, issuingCountry, value]) => ({
      type: type!,
      issuingCountry: issuingCountry!,
      value: value!,
      source: "synthetic",
      observedAt,
      quality: "valid" as const,
      updated: false,
    })),
  };
}

const datasets = [100, 1000, 5000].map((size) =>
  Array.from({ length: size }, (_, index) => syntheticOrder(index)),
);

/** Pagine del file come le legge la route, da 100 ordini. */
async function* pages(orders: VisibleOrder[]) {
  for (let start = 0; start < orders.length; start += 100) yield orders.slice(start, start + 100);
}

const files = {
  csv: (orders: VisibleOrder[]) => exportCsvStream(pages(orders), "item", appCopy.it, "UTC"),
  xlsx: (orders: VisibleOrder[]) =>
    exportXlsxStream(pages(orders), "item", appCopy.it, "UTC", new Date(observedAt)),
};
const bytes = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer());
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
    const csv = strFromU8(await bytes(files.csv(orders)));
    expect(csv.split("\r\n")).toHaveLength(orders.length * 3 + 2);
    expect(csv).toContain('"00123456789"');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bytes(files.xlsx(orders))) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets[0]!.rowCount).toBe(orders.length * 3 + 1);

    for (const [format, generate] of Object.entries(files)) {
      const name = `${format}-${orders.length}`;
      await bench(name, { writeResult: `reports/benchmarks/raw/${name}.json` }, () =>
        bytes(generate(orders)),
      ).run(options);
    }
  });
}
