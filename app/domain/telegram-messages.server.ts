import { appCopy } from "../app-copy";
import { ordersPath, settingsPath } from "../app-links";
import { ebayOrderHref } from "../components/orders/labels";
import { buyerNameView } from "../contact";
import { formatAmount, locales, localizedPath, type Language } from "../i18n";
import type { BotButton, BotMessage } from "../integrations/telegram.server";
import { zoneLabel } from "../preferences";
import { displayTaxValue, taxIdentifierType } from "../tax-quality";
import type { EbayEnvironment, FiscalSituation } from "../view-models";
import type { VisibleOrder } from "./orders.server";

/**
 * Testi del bot e loro composizione in HTML. Ogni valore che arriva da eBay o dall'utente passa
 * da `escape`; il messaggio non riporta indirizzo, email o telefono dell'acquirente.
 */

/** Limite di Telegram dopo l'interpretazione dell'HTML, con un margine per i tag. */
export const messageLimit = 3900;

export function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Suddivide i blocchi in messaggi entro il limite, senza spezzare un blocco che ci sta per
 * intero; un blocco più lungo si divide per righe, e una riga troppo lunga, che non contiene
 * tag, per caratteri.
 */
export function splitBlocks(blocks: string[], limit = messageLimit): string[] {
  const parts: string[] = [];
  let current = "";
  const push = (piece: string, separator: string) => {
    if (current && current.length + separator.length + piece.length > limit) {
      parts.push(current);
      current = "";
    }
    current = current ? `${current}${separator}${piece}` : piece;
  };
  for (const block of blocks) {
    if (block.length <= limit) {
      push(block, "\n\n");
      continue;
    }
    let first = true;
    for (const line of block.split("\n")) {
      for (let start = 0; start < Math.max(line.length, 1); start += limit) {
        push(line.slice(start, start + limit), first ? "\n\n" : "\n");
        first = false;
      }
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Variazione notificata di un ordine. */
export type OrderChange = "new" | "available" | "changed" | "removed";

/** Ordine nella forma dei messaggi: soltanto i dati che il messaggio mostra. */
export type OrderNotice = {
  id: string;
  ebayOrderId: string;
  environment: EbayEnvironment;
  storeName: string;
  createdAt: string;
  buyer: string | null;
  items: Array<{ title: string; quantity: number }>;
  totalMinor: number;
  currency: string;
  fiscal: FiscalSituation;
  /** Paese di fatturazione estero, per lo stato `foreign`. */
  country: string | null;
  /** Identificativi autorizzati e correnti, nella forma di visualizzazione e copia. */
  values: Array<{ kind: "CF" | "PIVA" | "OTHER"; label: string | null; value: string }>;
};

/** Ordine consultabile ridotto ai dati del messaggio, con i soli valori fiscali autorizzati. */
export function orderNotice(order: VisibleOrder, environment: EbayEnvironment): OrderNotice {
  const buyer = order.summary.buyer;
  return {
    id: order.id,
    ebayOrderId: order.ebayOrderId,
    environment,
    storeName: order.storeName,
    createdAt: order.creationTime,
    buyer: buyerNameView(buyer?.name ?? null) ?? buyer?.username ?? null,
    items: order.summary.lineItems.map((item) => ({ title: item.title, quantity: item.quantity })),
    totalMinor: order.totalMinor,
    currency: order.currency,
    fiscal: order.fiscalState,
    country: buyer?.billingAddress?.countryCode ?? null,
    values: order.taxIdentifiers.map((identifier) => {
      const kind = taxIdentifierType(identifier.type, identifier.issuingCountry);
      return {
        kind,
        label:
          kind === "OTHER"
            ? [identifier.type, identifier.issuingCountry].filter(Boolean).join(" · ")
            : null,
        value: displayTaxValue({ type: kind, value: identifier.value }),
      };
    }),
  };
}

/**
 * Impronta del dato fiscale notificato: i valori correnti in un ordine fisso. Cambia con un
 * nuovo valore, una correzione o una rimozione, non con la forma in cui eBay li riporta.
 */
export function fiscalKey(notice: Pick<OrderNotice, "values">): string {
  return JSON.stringify(
    notice.values
      .map((value) => [value.kind, value.label, value.value])
      .sort((a, b) =>
        // Le chiavi sono testi: l'ordine non dipende dalla lingua.
        JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
      ),
  );
}

/** Impronta di un ordine senza dato fiscale. */
export const emptyFiscalKey = fiscalKey({ values: [] });

const text = {
  it: {
    change: {
      new: "Nuovo ordine",
      available: "Dato fiscale disponibile",
      changed: "Dato fiscale aggiornato",
      removed: "Dato fiscale rimosso",
    },
    order: (id: string, date: string) => `Ordine ${id} del ${date}`,
    buyer: "Acquirente",
    total: "Totale",
    more: (count: number) => (count === 1 ? "e un altro articolo" : `e altri ${count} articoli`),
    kinds: { CF: "Codice Fiscale", PIVA: "Partita IVA" },
    removedNote: "Il dato fiscale notificato in precedenza non è più presente nell'ordine.",
    fiscal: {
      checking: "Dato fiscale in verifica: se arriva, ricevi un nuovo messaggio.",
      missing: "Nessun dato fiscale nell'ordine.",
      foreign: (country: string) => `Fatturazione estera (${country}): nessun dato fiscale.`,
      error: "Lettura del dato fiscale non riuscita: riprova da FiscalBay.",
      locked: "Dato fiscale da sbloccare in FiscalBay.",
      available: "",
    } satisfies Record<FiscalSituation, string | ((country: string) => string)>,
    open: "Apri in FiscalBay",
    ebay: "Apri su eBay",
    copy: "Copia Codice Fiscale",
    orders: "Apri gli ordini",
    digest: (date: string, count: number) =>
      `<b>Riepilogo ordini del ${date}</b>\n${count === 1 ? "Un ordine" : `${count} ordini`} dall'ultimo riepilogo.`,
    import: {
      title: "Importazione completata",
      orders: (count: number, fiscal: number) =>
        `${count === 1 ? "Un ordine acquisito" : `${count} ordini acquisiti`}, ${fiscal} con dato fiscale.`,
      period: (from: string, until: string) => `Periodo: dal ${from} al ${until}.`,
      note: "Gli ordini importati non ricevono messaggi singoli; da ora arrivano quelli nuovi.",
    },
  },
  en: {
    change: {
      new: "New order",
      available: "Tax ID available",
      changed: "Tax ID updated",
      removed: "Tax ID removed",
    },
    order: (id: string, date: string) => `Order ${id} of ${date}`,
    buyer: "Buyer",
    total: "Total",
    more: (count: number) => (count === 1 ? "and one more item" : `and ${count} more items`),
    kinds: { CF: "Italian tax code", PIVA: "Italian VAT number" },
    removedNote: "The tax ID notified earlier is no longer in the order.",
    fiscal: {
      checking: "Tax ID being checked: if it arrives, you get a new message.",
      missing: "No tax ID in the order.",
      foreign: (country: string) => `Billing abroad (${country}): no tax ID.`,
      error: "The tax ID could not be read: try again from FiscalBay.",
      locked: "Tax ID to unlock in FiscalBay.",
      available: "",
    } satisfies Record<FiscalSituation, string | ((country: string) => string)>,
    open: "Open in FiscalBay",
    ebay: "Open on eBay",
    copy: "Copy tax code",
    orders: "Open orders",
    digest: (date: string, count: number) =>
      `<b>Order summary of ${date}</b>\n${count === 1 ? "One order" : `${count} orders`} since the last summary.`,
    import: {
      title: "Import completed",
      orders: (count: number, fiscal: number) =>
        `${count === 1 ? "One order imported" : `${count} orders imported`}, ${fiscal} with a tax ID.`,
      period: (from: string, until: string) => `Period: from ${from} to ${until}.`,
      note: "Imported orders get no individual messages; new orders arrive from now on.",
    },
  },
} satisfies Record<Language, unknown>;

export function dateTime(language: Language, timeZone: string, iso: string): string {
  return new Intl.DateTimeFormat(locales[language], {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function date(language: Language, timeZone: string, iso: string): string {
  return new Intl.DateTimeFormat(locales[language], { timeZone, dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Indirizzo assoluto di una pagina dell'app, con l'ambiente eBay se non è Production. */
export function appUrl(
  env: Pick<Env, "APP_ORIGIN">,
  language: Language,
  path: string,
  environment: EbayEnvironment = "production",
  filters: Record<string, string> = {},
) {
  const query = new URLSearchParams(filters);
  if (environment === "sandbox") query.set("environment", "sandbox");
  const search = query.size ? `?${query}` : "";
  return `${new URL(env.APP_ORIGIN).origin}${localizedPath(language, path)}${search}`;
}

export const settingsUrl = (env: Pick<Env, "APP_ORIGIN">, language: Language) =>
  appUrl(env, language, `${settingsPath}/notifiche`);

const maxItems = 3;
const clip = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

function fiscalLines(language: Language, notice: OrderNotice): string[] {
  const copy = text[language];
  if (notice.values.length === 0) {
    const state = copy.fiscal[notice.fiscal];
    const line = typeof state === "function" ? state(notice.country ?? "") : state;
    return line ? [escape(line)] : [];
  }
  return notice.values.map(
    (value) =>
      `${escape(value.kind === "OTHER" ? value.label! : copy.kinds[value.kind])}: <code>${escape(value.value)}</code>`,
  );
}

/** Pulsanti di un ordine: dettaglio, eBay per i negozi reali e copia del CF autorizzato. */
export function orderButtons(
  env: Pick<Env, "APP_ORIGIN">,
  language: Language,
  notice: OrderNotice,
): BotButton[][] {
  const copy = text[language];
  const cf = notice.values.find((value) => value.kind === "CF");
  return [
    [
      {
        text: copy.open,
        url: appUrl(
          env,
          language,
          `${ordersPath}/${encodeURIComponent(notice.id)}`,
          notice.environment,
        ),
      },
      ...(notice.environment === "production"
        ? [{ text: copy.ebay, url: ebayOrderHref(notice.ebayOrderId) }]
        : []),
    ],
    ...(cf ? [[{ text: copy.copy, copy_text: { text: cf.value } }]] : []),
  ];
}

/**
 * Messaggio di un ordine: nuovo, con il dato arrivato dopo, corretto o rimosso; senza
 * variazione, come nella consultazione degli ultimi ordini, il titolo è il negozio.
 */
export function orderMessage(
  env: Pick<Env, "APP_ORIGIN">,
  language: Language,
  timeZone: string,
  notice: OrderNotice,
  change: OrderChange | null,
): BotMessage[] {
  const copy = text[language];
  const items = notice.items
    .slice(0, maxItems)
    .map((item) => `${item.quantity} × ${escape(clip(item.title, 80))}`);
  if (notice.items.length > maxItems) items.push(escape(copy.more(notice.items.length - maxItems)));
  const lines = [
    change
      ? `<b>${escape(copy.change[change])}</b> · ${escape(notice.storeName)}`
      : `<b>${escape(notice.storeName)}</b>`,
    escape(copy.order(notice.ebayOrderId, dateTime(language, timeZone, notice.createdAt))),
    ...(notice.buyer ? [`${escape(copy.buyer)}: ${escape(clip(notice.buyer, 64))}`] : []),
    ...items,
    `${escape(copy.total)}: ${escape(formatAmount(notice.totalMinor, notice.currency, language))}`,
  ];
  const fiscal = [
    ...(change === "removed" ? [escape(copy.removedNote)] : []),
    ...fiscalLines(language, notice),
  ];
  const parts = splitBlocks([lines.join("\n"), ...(fiscal.length ? [fiscal.join("\n")] : [])]);
  return parts.map((html, index) => ({
    html,
    ...(index === parts.length - 1 ? { buttons: orderButtons(env, language, notice) } : {}),
  }));
}

/** Riepilogo giornaliero: un blocco per ordine, nei messaggi necessari, e l'accesso agli ordini. */
export function digestMessage(
  env: Pick<Env, "APP_ORIGIN">,
  language: Language,
  timeZone: string,
  at: string,
  entries: Array<{ notice: OrderNotice; change: OrderChange }>,
): BotMessage[] {
  const copy = text[language];
  const blocks = entries.map(({ notice, change }) =>
    [
      `<b>${escape(notice.storeName)}</b> · ${escape(notice.ebayOrderId)}`,
      ...(change === "new" ? [] : [`<i>${escape(copy.change[change])}</i>`]),
      [
        notice.buyer ? escape(clip(notice.buyer, 64)) : null,
        escape(formatAmount(notice.totalMinor, notice.currency, language)),
      ]
        .filter(Boolean)
        .join(" · "),
      ...fiscalLines(language, notice),
    ].join("\n"),
  );
  const parts = splitBlocks([
    copy.digest(escape(date(language, timeZone, at)), entries.length),
    ...blocks,
  ]);
  const environment = entries.every(({ notice }) => notice.environment === "sandbox")
    ? "sandbox"
    : "production";
  return parts.map((html, index) => ({
    html,
    ...(index === parts.length - 1
      ? {
          // Gli ultimi sette giorni di tutti i negozi comprendono il periodo del riepilogo.
          buttons: [
            [
              {
                text: copy.orders,
                url: appUrl(env, language, ordersPath, environment, { periodo: "7" }),
              },
            ],
          ],
        }
      : {}),
  }));
}

/** Completamento di un'importazione: un solo messaggio con conteggi e periodo acquisito. */
export function importMessage(
  env: Pick<Env, "APP_ORIGIN">,
  language: Language,
  timeZone: string,
  summary: {
    storeId: string;
    storeName: string;
    environment: EbayEnvironment;
    from: string;
    until: string;
    orders: number;
    fiscal: number;
  },
): BotMessage {
  const copy = text[language].import;
  return {
    html: [
      `<b>${escape(copy.title)}</b> · ${escape(summary.storeName)}`,
      escape(copy.orders(summary.orders, summary.fiscal)),
      escape(
        copy.period(
          date(language, timeZone, summary.from),
          date(language, timeZone, summary.until),
        ),
      ),
      escape(copy.note),
    ].join("\n"),
    buttons: [
      [
        {
          text: text[language].orders,
          url: appUrl(env, language, ordersPath, summary.environment, {
            negozio: summary.storeId,
          }),
        },
      ],
    ],
  };
}

/** Nome del fuso come nelle Impostazioni. */
export function zoneName(language: Language, timeZone: string) {
  return zoneLabel(timeZone, appCopy[language]) ?? timeZone;
}
