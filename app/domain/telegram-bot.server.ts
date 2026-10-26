import { activeCoverageSql, activeEntitlementSql } from "./grants.server";
import { listVisibleOrders } from "./orders.server";
import { planPausedStore, reconnectStore, storeNameSql } from "./store-state.server";
import {
  consumeTelegramStart,
  saveTelegramChange,
  type TelegramChange,
  telegramPreferencesSql,
  unknownChatReply,
} from "./telegram.server";
import {
  appUrl,
  copyButtons,
  date,
  escape,
  icons,
  orderEntry,
  orderNotice,
  settingsUrl,
  splitBlocks,
  when,
  zoneName,
} from "./telegram-messages.server";
import { ordersPath, settingsPath } from "../app-links";
import type { Language } from "../i18n";
import { UpstreamError } from "../integrations/http.server";
import {
  answerCallback,
  editMessage,
  sendMessage,
  setBotCommands,
  telegramConfigured,
  type BotButton,
  type BotCommand,
  type BotMessage,
} from "../integrations/telegram.server";
import { telegramDigestTimes } from "../preferences";
import type { EbayEnvironment } from "../view-models";
import { inSequence } from "../sequence";

/**
 * Comandi e pulsanti del bot per i venditori (D199). Ogni risposta rilegge collegamento,
 * generazione, Premium e spazio; legge e scrive le stesse preferenze delle Impostazioni, con le
 * stesse regole. Ricerca, sblocco, esportazione e gestione dei negozi restano sul sito.
 */

const copy = {
  it: {
    commands: {
      status: "Piano, notifiche e negozi",
      latest: "Ultimi ordini",
      preferences: "Notifiche e negozi",
      help: "Come funziona il bot",
    } satisfies Record<BotCommand, string>,
    plans: {
      premium: (until: string) => `Premium fino al ${until}`,
      trial: (until: string) => `Prova Premium fino al ${until}`,
      lifetime: "Premium a vita",
      free: "Free",
    },
    freeNote: "Con il piano Free le notifiche sono ferme.",
    enabled: "Notifiche attive",
    paused: "Notifiche in pausa",
    filters: { fiscal: "solo con dato fiscale", all: "tutti gli ordini" },
    filterTitles: { fiscal: "Solo ordini con dato fiscale", all: "Tutti gli ordini" },
    modes: {
      each: "Un messaggio per ordine",
      digest: (time: string, zone: string) => `Riepilogo alle ${time} · ${zone}`,
    },
    stores: "Negozi",
    excluded: "escluso",
    reconnect: "da ricollegare",
    suspended: "sospeso",
    lastDelivery: (at: string) => `Ultimo invio ${at}`,
    noDelivery: "Nessun invio finora",
    unreachable: "Alcuni messaggi non sono arrivati dopo diversi tentativi.",
    preferences: "Preferenze",
    openSettings: "Impostazioni",
    choosePlan: "Scegli il piano",
    premiumRequired:
      "Notifiche e ultimi ordini nel bot sono compresi in Premium, nella prova e nel lifetime.",
    zoneNote: "Il fuso si cambia dal sito.",
    pause: "Metti in pausa",
    resume: "Riprendi le notifiche",
    fiscalOnly: "Solo con dato fiscale",
    allOrders: "Tutti gli ordini",
    each: "Uno per ordine",
    digest: "Riepilogo",
    time: (time: string) => `Orario: ${time}`,
    timeTitle: "Orario del riepilogo",
    storeCount: (included: number, total: number) => `Negozi: ${included} di ${total}`,
    storesTitle: "Negozi nelle notifiche",
    back: "Indietro",
    unlink: "Scollega la chat",
    unlinkQuestion:
      "Scollegare questa chat? Le notifiche in attesa si annullano e la chat non riceve più nulla finché non la colleghi di nuovo dal sito.",
    unlinkConfirm: "Sì, scollega",
    cancel: "Annulla",
    unlinked:
      "Chat scollegata. Puoi collegarla di nuovo da FiscalBay, in Impostazioni › Notifiche.",
    expired: "Questo pulsante non è più valido.",
    latest: "Ultimi ordini",
    latestRange: (from: number, to: number, total: number) => `${from}–${to} di ${total}`,
    latestEmpty: "Nessun ordine da mostrare nei negozi inclusi.",
    more: "Altri 5",
    previous: "Precedenti",
    orders: "Apri gli ordini",
    help: {
      title: "FiscalBay",
      intro: "Qui arrivano le notifiche degli ordini, secondo le preferenze delle Impostazioni.",
      commands: [
        ["⭐", "/stato", "piano, notifiche e negozi"],
        ["🛒", "/ultimi", "gli ultimi ordini"],
        ["⚙️", "/preferenze", "pausa, filtro, frequenza e negozi"],
      ],
      site: "Ricerca, sblocco ed esportazione restano sul sito.",
    },
  },
  en: {
    commands: {
      status: "Plan, notifications and stores",
      latest: "Latest orders",
      preferences: "Notifications and stores",
      help: "How the bot works",
    } satisfies Record<BotCommand, string>,
    plans: {
      premium: (until: string) => `Premium until ${until}`,
      trial: (until: string) => `Premium trial until ${until}`,
      lifetime: "Lifetime Premium",
      free: "Free",
    },
    freeNote: "Notifications are stopped on the Free plan.",
    enabled: "Notifications on",
    paused: "Notifications paused",
    filters: { fiscal: "only with a tax ID", all: "all orders" },
    filterTitles: { fiscal: "Only orders with a tax ID", all: "All orders" },
    modes: {
      each: "One message per order",
      digest: (time: string, zone: string) => `Summary at ${time} · ${zone}`,
    },
    stores: "Stores",
    excluded: "excluded",
    reconnect: "to reconnect",
    suspended: "suspended",
    lastDelivery: (at: string) => `Last delivery ${at}`,
    noDelivery: "Nothing delivered yet",
    unreachable: "Some messages did not arrive after several attempts.",
    preferences: "Preferences",
    openSettings: "Settings",
    choosePlan: "Choose a plan",
    premiumRequired:
      "Notifications and latest orders in the bot are included in Premium, the trial and lifetime.",
    zoneNote: "The time zone is changed on the website.",
    pause: "Pause",
    resume: "Resume notifications",
    fiscalOnly: "Only with a tax ID",
    allOrders: "All orders",
    each: "One per order",
    digest: "Summary",
    time: (time: string) => `Time: ${time}`,
    timeTitle: "Summary time",
    storeCount: (included: number, total: number) => `Stores: ${included} of ${total}`,
    storesTitle: "Stores in notifications",
    back: "Back",
    unlink: "Unlink this chat",
    unlinkQuestion:
      "Unlink this chat? Pending notifications are cancelled and the chat receives nothing until you link it again on the website.",
    unlinkConfirm: "Yes, unlink",
    cancel: "Cancel",
    unlinked: "Chat unlinked. You can link it again in FiscalBay, under Settings › Notifications.",
    expired: "This button is no longer valid.",
    latest: "Latest orders",
    latestRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    latestEmpty: "No orders to show in the included stores.",
    more: "5 more",
    previous: "Previous",
    orders: "Open orders",
    help: {
      title: "FiscalBay",
      intro: "Order notifications arrive here according to your Settings.",
      commands: [
        ["⭐", "/status", "plan, notifications and stores"],
        ["🛒", "/latest", "the latest orders"],
        ["⚙️", "/preferences", "pause, filter, frequency and stores"],
      ],
      site: "Search, unlocking and export stay on the website.",
    },
  },
} satisfies Record<Language, unknown>;

/** Il menu dei comandi del bot dell'ambiente, nelle due lingue. */
export async function configureBotCommands(env: Env, fetcher: typeof fetch = fetch) {
  if (!telegramConfigured(env)) return;
  await setBotCommands(env, { it: copy.it.commands, en: copy.en.commands }, fetcher);
}

/** Ultimi ordini consultabili dal bot e ordini per pagina. */
const latestLimit = 20;
const latestPage = 5;
const storesPerPage = 6;

type Link = {
  id: string;
  workspaceId: string;
  chatId: string;
  language: Language;
  userId: string;
  premium: number;
};

const linkColumns = `l.id, l.workspace_id AS workspaceId, l.chat_id AS chatId, l.language,
  (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = l.workspace_id) AS userId,
  ${activeEntitlementSql("l.workspace_id", "?2")} AS premium`;

export type TelegramReceipt = {
  receiptId: string;
  topic: string;
  chatId: string;
  tokenHash: string | null;
  command: string | null;
  callbackId: string | null;
  messageId: number | null;
  eventAt: string;
};

/**
 * Effetto di un aggiornamento del bot ricevuto dal webhook. Qualunque messaggio della chat chiude
 * il blocco: chi aveva bloccato il bot e gli scrive di nuovo riceve gli eventi da quel momento,
 * senza quelli del periodo bloccato. La chat irraggiungibile resta tale fino al primo invio
 * riuscito di una notifica. Una chat senza collegamento non vede nulla.
 */
export async function consumeTelegramUpdate(
  env: Env,
  update: TelegramReceipt,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const db = env.DB;
  await db
    .prepare(`UPDATE telegram_links SET resumed_at = ?2, delivery_failure = NULL,
        delivery_failed_at = NULL
      WHERE chat_id = ?1 AND delivery_failure = 'blocked'`)
    .bind(update.chatId, update.eventAt)
    .run();
  const { results: links } = await db
    .prepare(
      `SELECT ${linkColumns} FROM telegram_links l WHERE l.chat_id = ?1 ORDER BY l.linked_at`,
    )
    .bind(update.chatId, now.toISOString())
    .all<Link>();
  if (update.topic === "start" && (update.tokenHash || links.length === 0))
    return consumeTelegramStart(
      env,
      {
        receiptId: update.receiptId,
        chatId: update.chatId,
        tokenHash: update.tokenHash,
        eventAt: update.eventAt,
      },
      fetcher,
      now,
    );
  if (update.topic === "callback") return consumeCallback(env, update, links, fetcher, now);
  if (links.length === 0) return unknownChatReply(env, update.chatId, "help", fetcher);
  const command = (update.topic === "start" ? "help" : update.command) as BotCommand;
  const replies = await Promise.all(
    links.map(async (link) =>
      (await commandMessages(env, link, command, now)).map((message) => ({ link, message })),
    ),
  );
  await sendInOrder(env, replies.flat(), fetcher);
}

/** Risposte nell'ordine dato, una alla volta, come la chat le deve leggere. */
function sendInOrder(
  env: Env,
  replies: Array<{ link: Pick<Link, "chatId">; message: BotMessage }>,
  fetcher: typeof fetch,
) {
  return inSequence(replies, ({ link, message }) =>
    quiet(sendMessage(env, link.chatId, message, fetcher)),
  );
}

/** Una risposta rifiutata, per esempio a un bot appena bloccato, non si ritenta. */
async function quiet(request: Promise<unknown>) {
  try {
    await request;
  } catch (error) {
    if (error instanceof UpstreamError && error.failure === "rejected") return;
    throw error;
  }
}

async function commandMessages(
  env: Env,
  link: Link,
  command: BotCommand,
  now: Date,
): Promise<BotMessage[]> {
  if (command === "help") return [helpMessage(env, link.language)];
  if (command === "status") return [await statusMessage(env, link, now)];
  if (link.premium !== 1) return [premiumMessage(env, link.language)];
  if (command === "preferences") return [await preferencesMessage(env, link, now)];
  return [await latestMessage(env, link, 0, now)];
}

function helpMessage(env: Env, language: Language): BotMessage {
  const help = copy[language].help;
  return {
    html: [
      `👋 <b>${escape(help.title)}</b>\n${escape(help.intro)}`,
      help.commands
        .map(([icon, command, what]) => `${icon} ${command} · ${escape(what)}`)
        .join("\n"),
      `<i>${escape(help.site)}</i>`,
    ].join("\n\n"),
    buttons: [
      [{ text: `${icons.link} ${copy[language].openSettings}`, url: settingsUrl(env, language) }],
    ],
  };
}

function premiumMessage(env: Env, language: Language): BotMessage {
  return {
    html: `⭐ ${escape(copy[language].premiumRequired)}`,
    buttons: [
      [
        {
          text: `⭐ ${copy[language].choosePlan}`,
          url: appUrl(env, language, `${settingsPath}/piano`),
        },
      ],
    ],
  };
}

/** Dati del pulsante, legati alla generazione del collegamento. */
const data = (link: Pick<Link, "id">, ...parts: Array<string | number>) =>
  [link.id.slice(0, 8), ...parts].join(":");

type Preferences = {
  enabled: number;
  filter: "fiscal" | "all";
  mode: "each" | "digest";
  digestTime: string;
  timeZone: string;
  lastDelivery: string | null;
  failure: "blocked" | "unreachable" | null;
};

type StoreRow = {
  id: string;
  name: string;
  environment: EbayEnvironment;
  enabled: number;
  paused: number;
  reconnect: number;
};

async function readState(db: D1Database, link: Link, now: Date) {
  const [{ results: preferences }, { results: stores }, { results: coverage }] = await db.batch<
    Record<string, unknown>
  >([
    db
      .prepare(`SELECT ${telegramPreferencesSql("p")}, l.last_delivery_at AS lastDelivery,
          l.delivery_failure AS failure
        FROM telegram_links l LEFT JOIN telegram_preferences p ON p.workspace_id = l.workspace_id
        WHERE l.id = ?`)
      .bind(link.id),
    db
      .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, s.ebay_environment AS environment,
          COALESCE(sp.enabled, 1) AS enabled, ${planPausedStore("s.id")} AS paused,
          ${reconnectStore("s", "?2")} AS reconnect
        FROM ebay_stores s LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
        WHERE s.workspace_id = ?1 AND s.data_deleted_at IS NULL ORDER BY s.linked_at, s.id`)
      .bind(link.workspaceId, now.toISOString()),
    // La copertura mostrata è la stessa delle Impostazioni.
    db
      .prepare(`SELECT ${activeCoverageSql("source", "?1", "?2")} AS source,
          ${activeCoverageSql("ends_at", "?1", "?2")} AS endsAt`)
      .bind(link.workspaceId, now.toISOString()),
  ]);
  return {
    preferences: preferences[0] as Preferences,
    stores: stores as StoreRow[],
    coverage: coverage[0]?.source
      ? (coverage[0] as { source: string; endsAt: string | null })
      : undefined,
  };
}

/** Icone del bot, accanto a quelle dei messaggi degli ordini. */
const marks = {
  plan: "⭐",
  enabled: "🔔",
  paused: "⏸",
  resume: "▶️",
  digest: "🕘",
  each: "📨",
  stores: "🏪",
  delivery: "📨",
  warning: "⚠️",
  settings: "⚙️",
  unlink: "🔌",
  store: { active: "🟢", excluded: "⚪", reconnect: "🔴", suspended: "⏸" },
} as const;

/** Frequenza del riepilogo con orario e fuso, come nelle Impostazioni. */
function modeLine(language: Language, preferences: Preferences) {
  const text = copy[language];
  return preferences.mode === "each"
    ? `${marks.each} ${escape(text.modes.each)}`
    : `${marks.digest} ${escape(text.modes.digest(preferences.digestTime, zoneName(language, preferences.timeZone)))}`;
}

async function statusMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const state = await readState(env.DB, link, now);
  const { coverage, preferences } = state;
  const until = (iso: string) => date(link.language, preferences.timeZone, iso, now);
  const plan = !coverage
    ? text.plans.free
    : coverage.source === "lifetime"
      ? text.plans.lifetime
      : coverage.source === "trial"
        ? text.plans.trial(until(coverage.endsAt!))
        : text.plans.premium(until(coverage.endsAt!));
  const shown = state.stores.slice(0, 10).map((store) => {
    const [mark, note] = store.paused
      ? [marks.store.suspended, text.suspended]
      : store.reconnect
        ? [marks.store.reconnect, text.reconnect]
        : store.enabled
          ? [marks.store.active, null]
          : [marks.store.excluded, text.excluded];
    const name = escape(store.name.slice(0, 40));
    return `${mark} ${note ? `${name} · <i>${escape(note)}</i>` : name}`;
  });
  if (state.stores.length > 10) shown.push(`+${state.stores.length - 10}`);
  const blocks = [
    [
      `${marks.plan} <b>${escape(plan)}</b>`,
      ...(coverage
        ? [
            preferences.enabled
              ? `${marks.enabled} ${escape(`${text.enabled} · ${text.filters[preferences.filter]}`)}`
              : `${marks.paused} ${escape(text.paused)}`,
            modeLine(link.language, preferences),
          ]
        : [`${marks.paused} ${escape(text.freeNote)}`]),
    ].join("\n"),
    ...(shown.length ? [`${marks.stores} <b>${escape(text.stores)}</b>\n${shown.join("\n")}`] : []),
    [
      `${marks.delivery} <i>${escape(
        preferences.lastDelivery
          ? text.lastDelivery(
              when(link.language, preferences.timeZone, preferences.lastDelivery, now),
            )
          : text.noDelivery,
      )}</i>`,
      // Un blocco si chiude già con il messaggio che ha chiesto lo stato.
      ...(preferences.failure === "unreachable"
        ? [`${marks.warning} ${escape(text.unreachable)}`]
        : []),
    ].join("\n"),
  ];
  return {
    html: splitBlocks(blocks)[0]!,
    buttons: [
      [
        coverage
          ? { text: `${marks.settings} ${text.preferences}`, callback_data: data(link, "pr") }
          : {
              text: `${marks.plan} ${text.choosePlan}`,
              url: appUrl(env, link.language, `${settingsPath}/piano`),
            },
        { text: `${icons.link} ${text.openSettings}`, url: settingsUrl(env, link.language) },
      ],
    ],
  };
}

/** Pulsanti a scelta singola: ● sull'opzione attiva, ○ sulle altre. */
const choice = (on: boolean, label: string) => `${on ? "●" : "○"} ${label}`;
/** Interruttori dei negozi: ☑ incluso, ☐ escluso. */
const check = (on: boolean, label: string) => `${on ? "☑" : "☐"} ${label}`;

async function preferencesMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const state = await readState(env.DB, link, now);
  const { preferences } = state;
  const active = state.stores.filter((store) => !store.paused);
  const html = [
    preferences.enabled
      ? `${marks.enabled} <b>${escape(text.enabled)}</b>`
      : `${marks.paused} <b>${escape(text.paused)}</b>`,
    `${preferences.filter === "fiscal" ? icons.fiscal.available : icons.items} ${escape(text.filterTitles[preferences.filter])}`,
    modeLine(link.language, preferences),
    ...(preferences.mode === "digest" ? [`<i>${escape(text.zoneNote)}</i>`] : []),
  ].join("\n");
  const footer: BotButton[] = [
    { text: `${marks.unlink} ${text.unlink}`, callback_data: data(link, "ul") },
    { text: `${icons.link} ${text.openSettings}`, url: settingsUrl(env, link.language) },
  ];
  if (!preferences.enabled)
    return {
      html,
      buttons: [
        [{ text: `${marks.resume} ${text.resume}`, callback_data: data(link, "en", 1) }],
        footer,
      ],
    };
  return {
    html,
    buttons: [
      [{ text: `${marks.paused} ${text.pause}`, callback_data: data(link, "en", 0) }],
      [
        {
          text: choice(preferences.filter === "fiscal", text.fiscalOnly),
          callback_data: data(link, "fi", "fiscal"),
        },
        {
          text: choice(preferences.filter === "all", text.allOrders),
          callback_data: data(link, "fi", "all"),
        },
      ],
      [
        {
          text: choice(preferences.mode === "each", text.each),
          callback_data: data(link, "mo", "each"),
        },
        {
          text: choice(preferences.mode === "digest", text.digest),
          callback_data: data(link, "mo", "digest"),
        },
      ],
      [
        ...(preferences.mode === "digest"
          ? [
              {
                text: `${marks.digest} ${text.time(preferences.digestTime)}`,
                callback_data: data(link, "tm"),
              },
            ]
          : []),
        ...(state.stores.length > 0
          ? [
              {
                text: `${marks.stores} ${text.storeCount(active.filter((store) => store.enabled).length, active.length)}`,
                callback_data: data(link, "ss", 0),
              },
            ]
          : []),
      ],
      footer,
    ].filter((row) => row.length > 0),
  };
}

async function timesMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const { preferences } = await readState(env.DB, link, now);
  return {
    html: `${marks.digest} <b>${escape(text.timeTitle)}</b>\n${escape(zoneName(link.language, preferences.timeZone))}\n<i>${escape(text.zoneNote)}</i>`,
    buttons: [
      telegramDigestTimes.map((time) => ({
        text: choice(preferences.digestTime === time, time),
        callback_data: data(link, "tm", time.replace(":", "")),
      })),
      [{ text: `‹ ${text.back}`, callback_data: data(link, "pr") }],
    ],
  };
}

async function storesMessage(env: Env, link: Link, page: number, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const { stores } = await readState(env.DB, link, now);
  const pages = Math.max(1, Math.ceil(stores.length / storesPerPage));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const shown = stores.slice(current * storesPerPage, (current + 1) * storesPerPage);
  return {
    html: `${marks.stores} <b>${escape(text.storesTitle)}</b>`,
    buttons: [
      ...shown.map((store) => [
        store.paused
          ? {
              text: `${marks.store.suspended} ${store.name.slice(0, 40)} · ${text.suspended}`,
              callback_data: data(link, "ss", current),
            }
          : {
              text: check(store.enabled === 1, store.name.slice(0, 40)),
              callback_data: data(link, "sx", current, store.enabled ? 0 : 1, store.id),
            },
      ]),
      ...(pages > 1
        ? [
            [
              ...(current > 0 ? [{ text: "‹", callback_data: data(link, "ss", current - 1) }] : []),
              ...(current < pages - 1
                ? [{ text: "›", callback_data: data(link, "ss", current + 1) }]
                : []),
            ],
          ]
        : []),
      [{ text: `‹ ${text.back}`, callback_data: data(link, "pr") }],
    ],
  };
}

/**
 * Ultimi ordini definitivi dei negozi inclusi, letti come nel sito dall'utente dello spazio, in
 * un solo messaggio a pagine di cinque, fino a venti: il numero dell'ordine apre il dettaglio
 * e le pagine aggiornano lo stesso messaggio.
 */
async function latestMessage(env: Env, link: Link, offset: number, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const state = await readState(env.DB, link, now);
  // Ogni negozio incluso con i propri ultimi ordini: quelli dei negozi esclusi non tolgono posto.
  const perStore = await Promise.all(
    state.stores
      .filter((store) => store.enabled && !store.paused)
      .map(async (store) =>
        (
          await listVisibleOrders(env.DB, link.userId, latestLimit, store.environment, now, {
            criteria: { storeId: store.id },
          })
        ).map((order) => ({ order, environment: store.environment })),
      ),
  );
  const listed = perStore
    .flat()
    .sort((a, b) =>
      b.order.creationTime === a.order.creationTime
        ? b.order.id.localeCompare(a.order.id)
        : b.order.creationTime.localeCompare(a.order.creationTime),
    )
    .slice(0, latestLimit);
  const page = listed.slice(offset, offset + latestPage);
  if (page.length === 0) return { html: escape(text.latestEmpty) };
  const environment = page.every(({ environment }) => environment === "sandbox")
    ? "sandbox"
    : "production";
  const notices = page.map(({ order, environment }) => orderNotice(order, environment));
  const html = splitBlocks([
    `${icons.change.new} <b>${escape(text.latest)}</b> · <i>${escape(text.latestRange(offset + 1, offset + page.length, listed.length))}</i>`,
    ...notices.map((notice) =>
      orderEntry(env, link.language, state.preferences.timeZone, notice, null, now),
    ),
  ])[0]!;
  return {
    html,
    buttons: [
      ...copyButtons(notices, html),
      [
        ...(offset > 0
          ? [{ text: `‹ ${text.previous}`, callback_data: data(link, "la", offset - latestPage) }]
          : []),
        ...(offset + latestPage < listed.length
          ? [{ text: `${text.more} ›`, callback_data: data(link, "la", offset + latestPage) }]
          : []),
      ],
      [
        {
          text: `${icons.link} ${text.orders}`,
          url: appUrl(env, link.language, ordersPath, environment),
        },
      ],
    ].filter((row) => row.length > 0),
  };
}

/** Scelta di un pulsante delle preferenze, nella forma delle Impostazioni. */
function preferenceChange(action: string, args: string[]): TelegramChange | null {
  if (action === "en" && (args[0] === "0" || args[0] === "1"))
    return { name: "enabled", value: args[0] === "1" };
  if (action === "fi" && (args[0] === "fiscal" || args[0] === "all"))
    return { name: "filter", value: args[0] };
  if (action === "mo" && (args[0] === "each" || args[0] === "digest"))
    return { name: "mode", value: args[0] };
  const time = args[0] ? `${args[0].slice(0, 2)}:${args[0].slice(2)}` : "";
  if (action === "tm" && (telegramDigestTimes as readonly string[]).includes(time))
    return { name: "digestTime", value: time };
  if (action === "sx" && (args[1] === "0" || args[1] === "1") && args[2])
    return { name: "store", storeId: args.slice(2).join(":"), value: args[1] === "1" };
  return null;
}

/**
 * Tocco su un pulsante: la risposta immediata chiude l'attesa, poi il menu si aggiorna nello
 * stesso messaggio. Un pulsante di un collegamento sostituito o scollegato non ha effetto; senza
 * Premium il menu torna allo stato. Ogni scelta porta il valore voluto, così un tocco ripetuto
 * non la inverte.
 */
async function consumeCallback(
  env: Env,
  update: TelegramReceipt,
  links: Link[],
  fetcher: typeof fetch,
  now: Date,
) {
  const [generation, action = "", ...args] = update.command!.split(":");
  const link = links.find((candidate) => candidate.id.slice(0, 8) === generation);
  const language = link?.language ?? "it";
  await quiet(
    answerCallback(env, update.callbackId!, link ? undefined : copy[language].expired, fetcher),
  );
  if (!link) return;
  const edit = (message: BotMessage) =>
    editMessage(env, link.chatId, update.messageId!, message, fetcher);
  if (action === "st" || link.premium !== 1) return edit(await statusMessage(env, link, now));
  const change = preferenceChange(action, args);
  if (change) {
    // Il fuso del riepilogo resta quello scelto dal sito.
    const { preferences } = await readState(env.DB, link, now);
    await saveTelegramChange(env.DB, link.userId, change, preferences.timeZone, now);
    if (change.name === "store") return edit(await storesMessage(env, link, Number(args[0]), now));
    return edit(await preferencesMessage(env, link, now));
  }
  if (action === "tm") return edit(await timesMessage(env, link, now));
  if (action === "ss") return edit(await storesMessage(env, link, Number(args[0]) || 0, now));
  if (action === "ul" && args[0] !== "ok") {
    const text = copy[language];
    return edit({
      html: escape(text.unlinkQuestion),
      buttons: [
        [
          { text: text.unlinkConfirm, callback_data: data(link, "ul", "ok") },
          { text: text.cancel, callback_data: data(link, "pr") },
        ],
      ],
    });
  }
  if (action === "ul") {
    // Le consegne in attesa si annullano con il collegamento; le preferenze restano dello spazio.
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM telegram_deliveries WHERE link_id = ? AND sent_at IS NULL AND failed_at IS NULL",
      ).bind(link.id),
      env.DB.prepare("DELETE FROM telegram_links WHERE id = ? AND chat_id = ?").bind(
        link.id,
        link.chatId,
      ),
    ]);
    return edit({
      html: escape(copy[language].unlinked),
      buttons: [[{ text: copy[language].openSettings, url: settingsUrl(env, language) }]],
    });
  }
  if (action === "la") {
    const offset = Number(args[0]);
    if (!Number.isInteger(offset) || offset < 0 || offset >= latestLimit) return;
    // La pagina sostituisce quella mostrata: un tocco ripetuto la riscrive uguale.
    return edit(await latestMessage(env, link, offset, now));
  }
  return edit(await preferencesMessage(env, link, now));
}
