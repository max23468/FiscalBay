import { appCopy } from "../app-copy";
import { appUrl, notificationSettingsPath, ordersPath } from "../app-links";
import { ebayOrderHref } from "../orders/ebay-links";
import { buyerNameView } from "../contact";
import { formatAmount, type Language, locales } from "../i18n";
import type { BotButton, BotMessage } from "../integrations/telegram.server";
import { zoneLabel } from "../preferences";
import { displayTaxValue, taxIdentifierType } from "../tax-quality";
import type { EbayEnvironment, FiscalSituation } from "../view-models";
import type { VisibleOrder } from "./orders.server";
import { dayMilliseconds } from "../time";
import { telegramMessageCopy as text } from "../copy/telegram";

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
      // Stryker disable next-line EqualityOperator,AssignmentOperator: con «<=» una riga lunga un multiplo del limite aggiunge un pezzo vuoto, che chiude il messaggio già pieno e non cambia le parti; con «-=» il ciclo non termina: Stryker lo interrompe per limite di iterazioni e lo conta come Timeout prima che una prova possa fallire.
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
  /** Prima immagine d'inserzione fra gli articoli, dagli host d'immagine di eBay. */
  imageUrl: string | null;
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
    imageUrl: order.summary.lineItems.find((item) => item.imageUrl)?.imageUrl ?? null,
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
 * Impronta del dato fiscale notificato: SHA-256 dei valori correnti in un ordine fisso, così lo
 * stato delle notifiche non conserva una seconda copia dei Codici Fiscali. Cambia con un nuovo
 * valore, una correzione o una rimozione, non con la forma in cui eBay li riporta.
 */
export async function fiscalKey(notice: Pick<OrderNotice, "values">): Promise<string> {
  // Il JSON dell'elenco delle terne in ordine di testo: l'ordine non dipende dalla lingua.
  const entries = notice.values
    .map((value) => JSON.stringify([value.kind, value.label, value.value]))
    .sort();
  return fiscalDigest(`[${entries.join(",")}]`);
}

/** Impronta di un testo dei valori. */
export async function fiscalDigest(values: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(values));
  // Una stringa JSON, come richiede la colonna.
  return JSON.stringify(
    [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

/** Impronta di un ordine senza dato fiscale. */
export const emptyFiscalKey = JSON.stringify(
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
);

/** Icone a inizio riga: sostituiscono le etichette e danno a ogni dato un posto fisso. */
export const icons = {
  change: { new: "🛒", available: "✅", changed: "✏️", removed: "⚠️" },
  fiscal: {
    checking: "⏳",
    missing: "➖",
    foreign: "🌍",
    error: "⚠️",
    locked: "🔒",
    available: "🧾",
  },
  buyer: "👤",
  total: "💶",
  items: "📦",
  time: "🕑",
  digest: "🗓",
  import: "📥",
  link: "🔗",
  ebay: "🛍",
  copy: "📋",
} as const;

/** Data e ora locali nel fuso indicato. */
export function localClock(timeZone: string, now: Date): { day: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Giorno, con l'anno soltanto se diverso da quello di `now`. */
export function date(language: Language, timeZone: string, iso: string, now = new Date()): string {
  const year = (at: Date) => localClock(timeZone, at).day.slice(0, 4);
  const at = new Date(iso);
  return new Intl.DateTimeFormat(locales[language], {
    timeZone,
    day: "numeric",
    month: "short",
    ...(year(at) === year(now) ? {} : { year: "numeric" }),
  }).format(at);
}

/** Istante come lo dice una persona: «oggi 14:03», «ieri 18:40», «25 ott 14:03». */
export function when(language: Language, timeZone: string, iso: string, now: Date): string {
  const at = localClock(timeZone, new Date(iso));
  const today = localClock(timeZone, now).day;
  const yesterday = localClock(timeZone, new Date(now.getTime() - dayMilliseconds)).day;
  const day =
    at.day === today
      ? text[language].today
      : at.day === yesterday
        ? text[language].yesterday
        : date(language, timeZone, iso, now);
  return `${day} ${at.time}`;
}

export const settingsUrl = (env: { APP_ORIGIN: string }, language: Language) =>
  appUrl(env, language, notificationSettingsPath);

const orderUrl = (env: { APP_ORIGIN: string }, language: Language, notice: OrderNotice) =>
  appUrl(env, language, `${ordersPath}/${encodeURIComponent(notice.id)}`, notice.environment);

const maxItems = 3;
const clip = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

/** Valori fiscali in monospazio, che Telegram copia con un tocco; senza valori, lo stato. */
function fiscalLines(language: Language, notice: OrderNotice): string[] {
  const copy = text[language];
  if (notice.values.length === 0) {
    const state = copy.fiscal[notice.fiscal];
    const line = typeof state === "function" ? state(notice.country ?? "") : state;
    return line ? [`${icons.fiscal[notice.fiscal]} ${escape(line)}`] : [];
  }
  return notice.values.map((value) => {
    const label = value.kind === "OTHER" ? value.label : copy.kinds[value.kind];
    return `${icons.fiscal.available} ${label ? `${escape(label)} ` : ""}<code>${escape(value.value)}</code>`;
  });
}

const amount = (language: Language, notice: OrderNotice) =>
  `${icons.total} <b>${escape(formatAmount(notice.totalMinor, notice.currency, language))}</b>`;

/** Pulsanti di un ordine: dettaglio, eBay per i negozi reali e copia del CF autorizzato. */
export function orderButtons(
  env: { APP_ORIGIN: string },
  language: Language,
  notice: OrderNotice,
): BotButton[][] {
  const copy = text[language];
  const cf = notice.values.find((value) => value.kind === "CF");
  return [
    [
      { text: `${icons.link} ${copy.open}`, url: orderUrl(env, language, notice) },
      ...(notice.environment === "production"
        ? [{ text: `${icons.ebay} ${copy.ebay}`, url: ebayOrderHref(notice.ebayOrderId) }]
        : []),
    ],
    ...(cf ? [[{ text: `${icons.copy} ${copy.copy}`, copy_text: { text: cf.value } }]] : []),
  ];
}

/**
 * Notifica di un ordine: in testa la variazione e il dato fiscale, poi in citazione
 * acquirente, totale, articoli, numero e data.
 */
export function orderMessage(
  env: { APP_ORIGIN: string },
  language: Language,
  timeZone: string,
  notice: OrderNotice,
  change: OrderChange,
  now: Date,
): BotMessage[] {
  const copy = text[language];
  const items = notice.items
    .slice(0, maxItems)
    .map((item) => `${icons.items} ${item.quantity} × ${escape(clip(item.title, 80))}`);
  if (notice.items.length > maxItems) items.push(escape(copy.more(notice.items.length - maxItems)));
  const head = [
    `${icons.change[change]} <b>${escape(copy.change[change])}</b> · ${escape(notice.storeName)}`,
    ...(change === "removed" ? [escape(copy.removedNote)] : []),
    ...fiscalLines(language, notice),
    ...(change === "new" && notice.fiscal === "checking" ? [escape(copy.checkingNote)] : []),
  ];
  const details = [
    ...(notice.buyer ? [`${icons.buyer} ${escape(clip(notice.buyer, 64))}`] : []),
    amount(language, notice),
    ...items,
    `${icons.time} <i>${escape(when(language, timeZone, notice.createdAt, now))} · ${escape(notice.ebayOrderId)}</i>`,
  ];
  const parts = splitBlocks([head.join("\n"), `<blockquote>${details.join("\n")}</blockquote>`]);
  return parts.map((html, index) =>
    index === parts.length - 1
      ? {
          html,
          buttons: orderButtons(env, language, notice),
          ...(notice.imageUrl ? { preview: notice.imageUrl } : {}),
        }
      : { html },
  );
}

/**
 * Un ordine in un elenco, come nel riepilogo e negli ultimi ordini: il numero apre il
 * dettaglio in FiscalBay, poi acquirente, totale, data e dato fiscale.
 */
export function orderEntry(
  env: { APP_ORIGIN: string },
  language: Language,
  timeZone: string,
  notice: OrderNotice,
  change: OrderChange | null,
  now: Date,
): string {
  const copy = text[language];
  return [
    `<a href="${escape(orderUrl(env, language, notice))}">${escape(notice.ebayOrderId)}</a> · ${escape(notice.storeName)}`,
    ...(change && change !== "new"
      ? [`${icons.change[change]} <i>${escape(copy.change[change])}</i>`]
      : []),
    [
      notice.buyer ? `${icons.buyer} ${escape(clip(notice.buyer, 64))}` : null,
      amount(language, notice),
      `<i>${escape(when(language, timeZone, notice.createdAt, now))}</i>`,
    ]
      .filter(Boolean)
      .join(" · "),
    ...fiscalLines(language, notice),
  ].join("\n");
}

/**
 * Un pulsante per Codice Fiscale autorizzato degli ordini, presente nel testo indicato: il codice
 * nel pulsante dice di quale ordine è, il tocco lo copia.
 */
export function copyButtons(notices: OrderNotice[], html: string): BotButton[][] {
  const codes = new Set(
    notices.flatMap((notice) =>
      notice.values.filter((value) => value.kind === "CF").map((value) => value.value),
    ),
  );
  return [...codes]
    .filter((code) => html.includes(`<code>${escape(code)}</code>`))
    .map((code) => [{ text: `${icons.copy} ${code}`, copy_text: { text: code } }]);
}

/** Riepilogo giornaliero: un blocco per ordine, nei messaggi necessari, e l'accesso agli ordini. */
export function digestMessage(
  env: { APP_ORIGIN: string },
  language: Language,
  timeZone: string,
  at: string,
  entries: Array<{ notice: OrderNotice; change: OrderChange }>,
  now: Date,
): BotMessage[] {
  const copy = text[language];
  const parts = splitBlocks([
    `${icons.digest} <b>${escape(copy.digest(date(language, timeZone, at, now)))}</b>\n<i>${escape(copy.digestCount(entries.length))}</i>`,
    ...entries.map(({ notice, change }) =>
      orderEntry(env, language, timeZone, notice, change, now),
    ),
  ]);
  const environment = entries.every(({ notice }) => notice.environment === "sandbox")
    ? "sandbox"
    : // Stryker disable next-line StringLiteral: l'indirizzo distingue soltanto «sandbox»; ogni altro valore dà lo stesso risultato.
      "production";
  const notices = entries.map(({ notice }) => notice);
  return parts.map((html, index) => {
    const buttons = [
      ...copyButtons(notices, html),
      // Gli ultimi sette giorni di tutti i negozi comprendono il periodo del riepilogo.
      ...(index === parts.length - 1
        ? [
            [
              {
                text: `${icons.link} ${copy.orders}`,
                url: appUrl(env, language, ordersPath, environment, { periodo: "7" }),
              },
            ],
          ]
        : []),
    ];
    return { html, ...(buttons.length ? { buttons } : {}) };
  });
}

/** Completamento di un'importazione: un solo messaggio con conteggi e periodo acquisito. */
export function importMessage(
  env: { APP_ORIGIN: string },
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
  now: Date,
): BotMessage {
  const copy = text[language].import;
  return {
    html: [
      `${icons.import} <b>${escape(copy.title)}</b> · ${escape(summary.storeName)}`,
      `${icons.items} ${escape(copy.orders(summary.orders))} · ${icons.fiscal.available} <b>${summary.fiscal}</b> ${escape(copy.fiscal)}`,
      `${icons.digest} ${escape(
        copy.period(
          date(language, timeZone, summary.from, now),
          date(language, timeZone, summary.until, now),
        ),
      )}`,
      `<i>${escape(copy.note)}</i>`,
    ].join("\n"),
    buttons: [
      [
        {
          text: `${icons.link} ${text[language].orders}`,
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
