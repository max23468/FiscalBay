import { maxListedOrders } from "../orders/order-list";
import { minorToDecimal } from "../money";
import { taxIdentifierType } from "../tax-quality";
import type { AppCopy } from "../copy/copy-it";
import type { EbayEnvironment } from "../view-models";
import { listVisibleOrders, type OrderCriteria, type VisibleOrder } from "./orders.server";

/**
 * File CSV standard degli ordini (§12): una riga per ordine o per articolo, con i soli valori
 * fiscali autorizzati all'istante della richiesta. Le colonne e il loro ordine non cambiano fra
 * un file e l'altro; i valori restano quelli della fonte.
 */

export type ExportRows = "order" | "item";

type Column = keyof AppCopy["settings"]["export"]["file"]["columns"];

/**
 * Colonne di una granularità, calcolate a ogni uso. Per articolo l'importo è della riga e il
 * totale dell'ordine compare una sola volta.
 */
function columns(rows: ExportRows): Column[] {
  const order: Column[] = [
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
  return rows === "order"
    ? order
    : order.flatMap((column): Column[] =>
        column === "items"
          ? ["item"]
          : column === "quantity"
            ? ["quantity", "itemTotal"]
            : [column],
      );
}

export function exportHeader(rows: ExportRows, t: AppCopy): string[] {
  const names = t.settings.export.file.columns;
  return columns(rows).map((column) => names[column]);
}

/** Separatore dei valori multipli nella stessa cella, in un ordine deterministico. */
const joined = (values: Array<string | null | undefined>) =>
  values.filter((value): value is string => !!value).join(" | ");

/** Data e ora nel fuso indicato, nella forma `AAAA-MM-GG hh:mm:ss` riconosciuta dai fogli. */
export function exportDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
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

/** Stato normalizzato con l'etichetta della pagina; uno stato non previsto resta il codice eBay. */
function statusCell<Status extends string>(
  status: Status | "unknown" | null,
  code: string | null,
  labels: Record<Status, string>,
) {
  return status === null || status === "unknown" ? (code ?? "") : labels[status];
}

/** Righe del file per un ordine: una sola, oppure una per articolo con il totale sulla prima. */
export function exportRows(
  order: VisibleOrder,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
): string[][] {
  const { buyer, lineItems } = order.summary;
  const billing = buyer?.billingAddress;
  const tax = taxCells(order);
  const total = minorToDecimal(order.totalMinor, order.currency);
  const head = [
    order.ebayOrderId,
    exportDateTime(order.creationTime, timeZone),
    timeZone,
    order.storeName,
    order.marketplaceId ?? "",
    buyer?.name ?? "",
    buyer?.username ?? "",
    buyer?.email ?? "",
    buyer?.phone ?? buyer?.shipTo?.phone ?? "",
    joined([billing?.addressLine1, billing?.addressLine2]),
    billing?.postalCode ?? "",
    billing?.city ?? "",
    billing?.stateOrProvince ?? "",
    billing?.countryCode ?? "",
  ];
  const tail = [
    statusCell(order.summary.payment, order.summary.orderPaymentStatus, t.orders.payment),
    statusCell(order.summary.shipping, order.summary.orderFulfillmentStatus, t.orders.shipping),
    tax.cf,
    tax.vat,
    tax.other,
    t.orders.fiscal[order.fiscalState],
    exportDateTime(order.taxCheckedAt, timeZone),
    exportDateTime(order.lastModifiedTime, timeZone),
  ];
  if (rows === "order")
    return [
      [
        ...head,
        joined(lineItems.map((item) => `${item.quantity} × ${item.title}`)),
        joined(lineItems.map((item) => item.sku)),
        String(lineItems.reduce((sum, item) => sum + item.quantity, 0)),
        order.currency,
        total,
        ...tail,
      ],
    ];
  // Un ordine senza articoli letti resta comunque nel file, con il suo totale.
  const items = lineItems.length ? lineItems : [null];
  return items.map((item, index) => [
    ...head,
    item?.title ?? "",
    item?.sku ?? "",
    item ? String(item.quantity) : "",
    // Un importo in un'altra valuta non si scrive come se fosse nella valuta dell'ordine.
    item?.totalMinor != null && item.currency === order.currency
      ? minorToDecimal(item.totalMinor, order.currency)
      : "",
    order.currency,
    index === 0 ? total : "",
    ...tail,
  ]);
}

/**
 * Valore di una cella che un foglio di calcolo eseguirebbe come formula: si apre con `=`, `@`,
 * tabulazione o ritorno a capo, oppure con `+` o `-` seguiti da qualcosa di diverso da cifre e
 * punteggiatura numerica. Un telefono internazionale o un numero negativo restano intatti.
 */
export function formulaLike(value: string): boolean {
  return /^[=@\t\r\n]/u.test(value) || /^[+-](?![\d\s().,/-]*$)/u.test(value);
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
export function exportFileName(t: AppCopy, now: Date, timeZone: string) {
  return `${t.settings.export.file.name}-${exportDateTime(now.toISOString(), timeZone).slice(0, 10)}.csv`;
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
  filter: { ids?: string[]; criteria: OrderCriteria },
): AsyncGenerator<VisibleOrder[]> {
  const page = await listVisibleOrders(db, userId, maxListedOrders, ebayEnvironment, now, {
    ids: filter.ids,
    criteria: filter.criteria,
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
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`﻿${csvLine(exportHeader(rows, t))}`));
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
            .flatMap((order) => exportRows(order, rows, t, timeZone))
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
