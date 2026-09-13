import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";

export type ExportOrder = {
  orderId: string;
  createdAt: string;
  totalMinor: number;
  currency: string;
  taxIdentifiers: Array<{ type: string; value: string }>;
};

const columns = ["Ordine", "Data UTC", "Totale", "Valuta", "Tipo identificativo", "Identificativo"];

function rows(orders: ExportOrder[]): string[][] {
  return orders.flatMap((order) => {
    const identifiers = order.taxIdentifiers.length
      ? order.taxIdentifiers
      : [{ type: "", value: "" }];
    return identifiers.map((identifier) => [
      order.orderId,
      order.createdAt,
      (order.totalMinor / 100).toFixed(2),
      order.currency,
      identifier.type,
      identifier.value,
    ]);
  });
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function createCsv(orders: ExportOrder[]): Uint8Array {
  const lines = [columns, ...rows(orders)].map((row) => row.map(csvCell).join(","));
  return strToU8(`\uFEFF${lines.join("\r\n")}\r\n`);
}

export async function createXlsx(orders: ExportOrder[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FiscalBay";
  workbook.created = new Date(0);
  workbook.modified = new Date(0);

  const sheet = workbook.addWorksheet("Ordini");
  sheet.addRow(columns);
  for (const row of rows(orders)) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.numFmt = "@";
  });

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function createExportZip(orders: ExportOrder[]): Promise<Uint8Array> {
  return zipSync({
    "ordini.csv": createCsv(orders),
    "ordini.xlsx": await createXlsx(orders),
  });
}
