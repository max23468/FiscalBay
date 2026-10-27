import type { AppCopy } from "../copy/copy-it";

/**
 * Colonne del file degli ordini (§12), uguali per CSV e XLSX, nell'area reale e nell'anteprima.
 * Lo schema standard è stabile; con Premium le colonne scelte cambiano presenza e ordine.
 */

/** Lunghezza massima del nome di una configurazione salvata. */
export const maxConfigurationName = 60;

export type ExportRows = "order" | "item";

export type ExportFormat = "csv" | "xlsx";

/** Colonna del file; «Articoli» per ordine diventa «Articolo» per articolo. */
export type ExportColumn = Exclude<keyof AppCopy["settings"]["export"]["file"]["columns"], "item">;

/**
 * Colonne standard di una granularità, calcolate a ogni uso. Per articolo l'importo è della
 * riga e il totale dell'ordine compare una sola volta.
 */
export function standardColumns(rows: ExportRows): ExportColumn[] {
  const columns: ExportColumn[] = [
    "order",
    "date",
    "timeZone",
    "store",
    "marketplace",
    "buyer",
    "username",
    "email",
    "phone",
    "address",
    "postalCode",
    "city",
    "province",
    "country",
    "items",
    "sku",
    "quantity",
    "itemTotal",
    "currency",
    "total",
    "payment",
    "shipping",
    "taxCode",
    "vat",
    "otherTax",
    "fiscal",
    "checkedAt",
    "updatedAt",
  ];
  return rows === "item" ? columns : columns.filter((column) => column !== "itemTotal");
}

/**
 * Colonne scelte con Premium, separate da virgole, nell'ordine del file: ogni colonna nota al
 * più una volta. Quelle che la granularità non prevede si tralasciano. null se il valore non è
 * valido o non resta nessuna colonna.
 */
export function parseColumns(value: string, rows: ExportRows): ExportColumn[] | null {
  const known = new Set<string>(standardColumns("item"));
  const chosen = value.split(",");
  if (new Set(chosen).size !== chosen.length || chosen.some((column) => !known.has(column)))
    return null;
  const available = new Set<string>(standardColumns(rows));
  const columns = chosen.filter((column) => available.has(column)) as ExportColumn[];
  return columns.length ? columns : null;
}

/** Nome della colonna nella granularità scelta. */
export function columnName(column: ExportColumn, rows: ExportRows, t: AppCopy): string {
  const names = t.settings.export.file.columns;
  return rows === "item" && column === "items" ? names.item : names[column];
}

export function exportHeader(
  rows: ExportRows,
  t: AppCopy,
  columns: readonly ExportColumn[] = standardColumns(rows),
): string[] {
  return columns.map((column) => columnName(column, rows, t));
}
