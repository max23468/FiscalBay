import { maxListedOrders } from "../orders/order-list";
import { minorToDecimal } from "../money";
import { taxIdentifierType } from "../tax-quality";
import type { AppCopy } from "../copy/copy-it";
import type { EbayEnvironment } from "../view-models";
import { fiscalNotice } from "./order-view.server";
import { listVisibleOrders, type OrderCriteria, type VisibleOrder } from "./orders.server";
import { xlsxStream, type XlsxCell } from "./xlsx.server";
import { wallClock } from "../time";
import {
  exportHeader,
  exportSampleSize,
  standardColumns,
  type ExportColumn,
  type ExportFormat,
  type ExportRows,
  type ExportSampleOrder,
} from "../orders/export-columns";

/**
 * File degli ordini (§12), CSV o XLSX: una riga per ordine o per articolo, con i soli valori
 * fiscali autorizzati all'istante della richiesta. Lo schema standard non cambia fra un file e
 * l'altro; con Premium le colonne scelte cambiano presenza e ordine, non il significato. I
 * valori restano quelli della fonte.
 */

/** Separatore dei valori multipli nella stessa cella, in un ordine deterministico. */
const joined = (values: Array<string | null | undefined>) =>
  values.filter((value): value is string => !!value).join(" | ");

/** Data e ora nel fuso indicato, nella forma `AAAA-MM-GG hh:mm:ss` riconosciuta dai fogli. */
export function exportDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const parts = wallClock(new Date(iso), timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Identificativi autorizzati per colonna: CF e Partita IVA italiani con il valore originale,
 * gli altri con tipo e Paese. Più valori dello stesso tipo stanno nella stessa cella, ordinati.
 */
function taxCells(order: VisibleOrder) {
  const cf: string[] = [];
  const vat: string[] = [];
  const other: string[] = [];
  for (const tax of order.taxIdentifiers) {
    const type = taxIdentifierType(tax.type, tax.issuingCountry);
    if (type === "CF") cf.push(tax.value);
    else if (type === "PIVA") vat.push(tax.value);
    else
      other.push(
        `${tax.type}${tax.issuingCountry ? ` (${tax.issuingCountry})` : ""}: ${tax.value}`,
      );
  }
  return { cf: joined(cf.sort()), vat: joined(vat.sort()), other: joined(other.sort()) };
}

/**
 * Situazione fiscale come nella pagina Ordini: un dato disponibile porta la stessa avvertenza
 * sull'ultima lettura, così il file non lo presenta come confermato dopo una lettura non
 * riuscita o in corso.
 */
function fiscalCell(order: VisibleOrder, t: AppCopy) {
  const notice = order.fiscalState === "available" ? fiscalNotice(order) : null;
  return notice ? t.settings.export.file.fiscalNotice[notice] : t.orders.fiscal[order.fiscalState];
}

/** Stato normalizzato con l'etichetta della pagina; uno stato non previsto resta il codice eBay. */
function statusCell<Status extends string>(
  status: Status | "unknown" | null,
  code: string | null,
  labels: Record<Status, string>,
) {
  return status === null || status === "unknown" ? (code ?? "") : labels[status];
}

/**
 * Valori del file per un ordine, colonna per colonna: una sola riga, oppure una per articolo con
 * il totale sulla prima.
 */
export function exportRecords(
  order: VisibleOrder,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
): Array<Record<ExportColumn, string>> {
  const { buyer, lineItems } = order.summary;
  const billing = buyer?.billingAddress;
  const tax = taxCells(order);
  const total = minorToDecimal(order.totalMinor, order.currency);
  const common = {
    order: order.ebayOrderId,
    date: exportDateTime(order.creationTime, timeZone),
    timeZone,
    store: order.storeName,
    marketplace: order.marketplaceId ?? "",
    buyer: buyer?.name ?? "",
    username: buyer?.username ?? "",
    email: buyer?.email ?? "",
    phone: buyer?.phone ?? buyer?.shipTo?.phone ?? "",
    address: joined([billing?.addressLine1, billing?.addressLine2]),
    postalCode: billing?.postalCode ?? "",
    city: billing?.city ?? "",
    province: billing?.stateOrProvince ?? "",
    country: billing?.countryCode ?? "",
    currency: order.currency,
    payment: statusCell(order.summary.payment, order.summary.orderPaymentStatus, t.orders.payment),
    shipping: statusCell(
      order.summary.shipping,
      order.summary.orderFulfillmentStatus,
      t.orders.shipping,
    ),
    taxCode: tax.cf,
    vat: tax.vat,
    otherTax: tax.other,
    fiscal: fiscalCell(order, t),
    checkedAt: exportDateTime(order.taxCheckedAt, timeZone),
    updatedAt: exportDateTime(order.lastModifiedTime, timeZone),
  };
  if (rows === "order")
    return [
      {
        ...common,
        items: joined(lineItems.map((item) => `${item.quantity} × ${item.title}`)),
        sku: joined(lineItems.map((item) => item.sku)),
        quantity: String(lineItems.reduce((sum, item) => sum + item.quantity, 0)),
        // Stryker disable next-line StringLiteral: per ordine la colonna non entra nel file.
        itemTotal: "",
        total,
      },
    ];
  // Un ordine senza articoli letti resta comunque nel file, con il suo totale.
  const items = lineItems.length ? lineItems : [null];
  return items.map((item, index) => ({
    ...common,
    items: item?.title ?? "",
    sku: item?.sku ?? "",
    quantity: item ? String(item.quantity) : "",
    // Un importo in un'altra valuta non si scrive come se fosse nella valuta dell'ordine.
    itemTotal:
      item?.totalMinor != null && item.currency === order.currency
        ? minorToDecimal(item.totalMinor, order.currency)
        : "",
    total: index === 0 ? total : "",
  }));
}

/** Righe del file per un ordine, con le colonne nell'ordine scelto. */
export function exportRows(
  order: VisibleOrder,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
  columns: readonly ExportColumn[] = standardColumns(rows),
): string[][] {
  return exportRecords(order, rows, t, timeZone).map((record) =>
    columns.map((column) => record[column]),
  );
}

/**
 * Valore di una cella che un foglio di calcolo eseguirebbe come formula: si apre con `=`, `@`,
 * tabulazione o ritorno a capo, oppure con `+` o `-` senza essere un numero semplice con segno.
 * Excel calcola anche `+39-333-1234567`, `-2-3` o `-1/0`: soltanto cifre con al più un
 * separatore decimale restano intatte. Uno spazio o un carattere Unicode iniziale, come `＝`,
 * non apre una formula.
 */
export function formulaLike(value: string): boolean {
  return /^[=@\t\r\n]/u.test(value) || /^[+-](?!\d+(?:[.,]\d+)?$)/u.test(value);
}

/** Cella CSV: sempre fra virgolette, virgolette raddoppiate, formula neutralizzata con `'`. */
export function csvCell(value: string): string {
  const safe = formulaLike(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvLine(cells: readonly string[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** Nome del file senza dati personali: prodotto e data della richiesta nel fuso dell'utente. */
export function exportFileName(
  t: AppCopy,
  now: Date,
  timeZone: string,
  format: ExportFormat = "csv",
) {
  return `${t.settings.export.file.name}-${exportDateTime(now.toISOString(), timeZone).slice(0, 10)}.${format}`;
}

/**
 * Ordini più recenti dell'ambito con le loro righe del file, per l'anteprima tabellare: stessi
 * criteri, diritti e valori della creazione del file, senza suggerimenti.
 */
export async function exportSampleOrders(
  db: D1Database,
  userId: string,
  ebayEnvironment: EbayEnvironment,
  now: Date,
  filter: { ids?: string[]; criteria: OrderCriteria; provisional?: boolean } | null,
  t: AppCopy,
  timeZone: string,
): Promise<ExportSampleOrder[]> {
  if (!filter) return [];
  const orders = await listVisibleOrders(db, userId, exportSampleSize, ebayEnvironment, now, {
    ...filter,
    // Stryker disable next-line BooleanLiteral: le prime righe non leggono i suggerimenti.
    suggestions: false,
  });
  return orders.map((order) => ({
    createdAt: order.creationTime,
    rows: {
      order: exportRecords(order, "order", t, timeZone),
      // Stryker disable next-line StringLiteral: ogni valore diverso da «order» dà le righe per articolo.
      item: exportRecords(order, "item", t, timeZone),
    },
  }));
}

/**
 * Ordini consultabili dell'ambito, a pagine dal più recente: ogni pagina rilegge negozi,
 * conservazione e diritti allo stesso istante `now`, così nessuna pagina include un ordine o
 * un valore fiscale che quell'istante non autorizza.
 */
export async function* exportOrderPages(
  db: D1Database,
  userId: string,
  ebayEnvironment: EbayEnvironment,
  now: Date,
  filter: { ids?: string[]; criteria: OrderCriteria; provisional?: boolean },
): AsyncGenerator<VisibleOrder[]> {
  const page = await listVisibleOrders(db, userId, maxListedOrders, ebayEnvironment, now, {
    ids: filter.ids,
    criteria: filter.criteria,
    provisional: filter.provisional,
    // Stryker disable next-line BooleanLiteral: i suggerimenti non entrano nel file; con true la lettura costa di più e dà le stesse righe.
    suggestions: false,
  });
  yield page;
  const last = page.at(-1)!;
  // Stryker disable ConditionalExpression,EqualityOperator,BlockStatement,ObjectLiteral: una condizione vera o una posizione vuota fanno ripartire la lettura senza fine e Stryker la conta come Timeout; la prova con 320 ordini nello stesso istante verifica che ogni pagina si legga una volta.
  if (page.length === maxListedOrders)
    yield* exportOrderPages(db, userId, ebayEnvironment, now, {
      ...filter,
      criteria: { ...filter.criteria, after: { creationTime: last.creationTime, id: last.id } },
    });
  // Stryker restore ConditionalExpression,EqualityOperator,BlockStatement,ObjectLiteral
}

/**
 * CSV in streaming: BOM UTF-8 per Excel, intestazione e poi le righe pagina per pagina. Un
 * errore a metà interrompe il flusso, così il file incompleto non risulta scaricato.
 */
export function exportCsvStream(
  pages: AsyncGenerator<VisibleOrder[]>,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
  columns: readonly ExportColumn[] = standardColumns(rows),
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${csvLine(exportHeader(rows, t, columns))}`));
    },
    async pull(controller) {
      const next = await pages.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(
        encoder.encode(
          next.value
            .flatMap((order) => exportRows(order, rows, t, timeZone, columns))
            .map(csvLine)
            .join(""),
        ),
      );
    },
    async cancel() {
      await pages.return(undefined);
    },
  });
}

/**
 * Tipo della colonna nel file XLSX: importi e quantità sono numeri, date e ore valori di data,
 * tutto il resto testo, compresi Codice Fiscale, Partita IVA, SKU, CAP e telefono.
 */
function cellType(column: ExportColumn): XlsxCell["type"] {
  return column === "quantity" || column === "itemTotal" || column === "total"
    ? "number"
    : column === "date" || column === "checkedAt" || column === "updatedAt"
      ? "date"
      : // Stryker disable next-line StringLiteral: un tipo diverso da numero e data vale già come testo.
        "text";
}

/** Larghezza della colonna nel foglio: il nome intero, più spazio per i testi lunghi. */
function columnWidth(column: ExportColumn, name: string): number {
  const wide = column === "items" || column === "address" || column === "otherTax";
  return Math.max(wide ? 40 : 14, name.length + 4);
}

/**
 * XLSX in streaming con le stesse righe del CSV: i valori restano quelli della fonte, senza
 * apostrofi, perché una cella di testo non è mai una formula.
 */
export function exportXlsxStream(
  pages: AsyncGenerator<VisibleOrder[]>,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
  now: Date,
  columns: readonly ExportColumn[] = standardColumns(rows),
): ReadableStream<Uint8Array> {
  const header = exportHeader(rows, t, columns);
  const types = columns.map(cellType);
  return xlsxStream(
    {
      name: t.settings.export.file.sheet,
      header,
      widths: columns.map((column, index) => columnWidth(column, header[index]!)),
      modified: now,
    },
    pages,
    (page) =>
      page.flatMap((order) =>
        exportRows(order, rows, t, timeZone, columns).map((values) =>
          values.map((value, index) => ({ type: types[index]!, value })),
        ),
      ),
  );
}
