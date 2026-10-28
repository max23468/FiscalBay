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

/**
 * Colonne che cambiano lo schema standard della granularità; null se sono le stesse, nello
 * stesso ordine: soltanto una scelta diversa chiede Premium.
 */
export function customColumns(
  columns: readonly ExportColumn[],
  rows: ExportRows,
): ExportColumn[] | null {
  return columns.join() === standardColumns(rows).join() ? null : [...columns];
}

/** Forma del file scelta: formato, granularità e colonne, comprese quelle escluse. */
export interface FileLayout {
  format: ExportFormat;
  rows: ExportRows;
  /** Ogni colonna nell'ordine scelto; quelle non incluse seguono nell'ordine standard. */
  order: ExportColumn[];
  chosen: ExportColumn[];
}

/** Forma di una configurazione salvata; senza, il file standard. */
export function layoutOf(
  configuration: { format: ExportFormat; rows: ExportRows; columns: ExportColumn[] } | null,
): FileLayout {
  const all = standardColumns("item");
  if (!configuration) return { format: "csv", rows: "order", order: all, chosen: all };
  const { format, rows, columns } = configuration;
  const saved = new Set(columns);
  return {
    format,
    rows,
    order: [...columns, ...all.filter((column) => !saved.has(column))],
    chosen: columns,
  };
}

/** Colonne del file, nell'ordine scelto, fra quelle della granularità. */
export function fileColumns(layout: FileLayout): ExportColumn[] {
  const available = new Set(standardColumns(layout.rows));
  const chosen = new Set(layout.chosen);
  return layout.order.filter((column) => available.has(column) && chosen.has(column));
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
