import { activeEntitlementSql } from "./grants.server";
import { listVisibleOrders } from "./orders.server";
import { storeNameSql } from "./store-state.server";
import {
  consumeTelegramStart,
  saveTelegramChange,
  unknownChatReply,
  type TelegramChange,
} from "./telegram.server";
import {
  appUrl,
  dateTime,
  escape,
  orderMessage,
  orderNotice,
  settingsUrl,
  splitBlocks,
  zoneName,
} from "./telegram-messages.server";
import { settingsPath } from "../app-links";
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
    status: "Stato di FiscalBay",
    plan: "Piano",
    plans: {
      premium: (until: string) => `Premium fino al ${until}`,
      trial: (until: string) => `Prova Premium fino al ${until}`,
      lifetime: "Premium a vita",
      free: "Free: le notifiche sono ferme",
    },
    notifications: "Notifiche",
    enabled: "attive",
    paused: "in pausa",
    filter: "Ordini",
    filters: { fiscal: "solo con dato fiscale", all: "tutti" },
    mode: "Frequenza",
    modes: {
      each: "un messaggio per ordine",
      digest: (time: string, zone: string) => `riepilogo giornaliero alle ${time} (${zone})`,
    },
    included: "Negozi inclusi",
    excluded: "Negozi esclusi",
    reconnect: "Da ricollegare",
    none: "nessuno",
    lastDelivery: "Ultimo invio",
    unreachable: "Alcuni messaggi non sono arrivati dopo diversi tentativi.",
    preferences: "Preferenze",
    openSettings: "Apri le Impostazioni",
    choosePlan: "Scegli il piano",
    premiumRequired:
      "Notifiche e consultazione degli ordini nel bot sono comprese in Premium, nella prova e nel lifetime.",
    preferencesTitle: "Preferenze delle notifiche",
    zoneNote: "Il fuso del riepilogo si cambia dal sito.",
    pause: "Metti in pausa",
    resume: "Riprendi le notifiche",
    fiscalOnly: "Solo con dato fiscale",
    allOrders: "Tutti gli ordini",
    each: "Un messaggio per ordine",
    digest: "Riepilogo giornaliero",
    time: (time: string) => `Orario: ${time}`,
    timeTitle: "Orario del riepilogo",
    stores: (included: number, total: number) => `Negozi: ${included} di ${total}`,
    storesTitle: "Negozi inclusi nelle notifiche",
    suspended: "sospeso",
    back: "Indietro",
    unlink: "Scollega la chat",
    unlinkQuestion:
      "Scollegare questa chat? Le notifiche in attesa si annullano e la chat non riceve più nulla finché non la colleghi di nuovo dal sito.",
    unlinkConfirm: "Sì, scollega",
    cancel: "Annulla",
    unlinked:
      "Chat scollegata. Puoi collegarla di nuovo da FiscalBay, in Impostazioni › Notifiche.",
    expired: "Questo pulsante non è più valido.",
    latestEmpty: "Nessun ordine da mostrare nei negozi inclusi.",
    latestPage: (from: number, to: number) => `Ordini dal ${from} al ${to}.`,
    more: "Altri 5",
    help: [
      "Qui arrivano le notifiche degli ordini secondo le preferenze delle Impostazioni.",
      "/stato: piano, notifiche e negozi",
      "/ultimi: gli ultimi ordini dei negozi inclusi",
      "/preferenze: pausa, filtro, frequenza e negozi",
      "Ricerca, sblocco ed esportazione restano sul sito.",
    ],
  },
  en: {
    commands: {
      status: "Plan, notifications and stores",
      latest: "Latest orders",
      preferences: "Notifications and stores",
      help: "How the bot works",
    } satisfies Record<BotCommand, string>,
    status: "FiscalBay status",
    plan: "Plan",
    plans: {
      premium: (until: string) => `Premium until ${until}`,
      trial: (until: string) => `Premium trial until ${until}`,
      lifetime: "Lifetime Premium",
      free: "Free: notifications are stopped",
    },
    notifications: "Notifications",
    enabled: "on",
    paused: "paused",
    filter: "Orders",
    filters: { fiscal: "only with a tax ID", all: "all" },
    mode: "Frequency",
    modes: {
      each: "one message per order",
      digest: (time: string, zone: string) => `daily summary at ${time} (${zone})`,
    },
    included: "Included stores",
    excluded: "Excluded stores",
    reconnect: "To reconnect",
    none: "none",
    lastDelivery: "Last delivery",
    unreachable: "Some messages did not arrive after several attempts.",
    preferences: "Preferences",
    openSettings: "Open Settings",
    choosePlan: "Choose a plan",
    premiumRequired:
      "Notifications and order lookup in the bot are included in Premium, the trial and lifetime.",
    preferencesTitle: "Notification preferences",
    zoneNote: "The summary time zone is changed on the website.",
    pause: "Pause",
    resume: "Resume notifications",
    fiscalOnly: "Only with a tax ID",
    allOrders: "All orders",
    each: "One message per order",
    digest: "Daily summary",
    time: (time: string) => `Time: ${time}`,
    timeTitle: "Summary time",
    stores: (included: number, total: number) => `Stores: ${included} of ${total}`,
    storesTitle: "Stores included in notifications",
    suspended: "suspended",
    back: "Back",
    unlink: "Unlink this chat",
    unlinkQuestion:
      "Unlink this chat? Pending notifications are cancelled and the chat receives nothing until you link it again on the website.",
    unlinkConfirm: "Yes, unlink",
    cancel: "Cancel",
    unlinked: "Chat unlinked. You can link it again in FiscalBay, under Settings › Notifications.",
    expired: "This button is no longer valid.",
    latestEmpty: "No orders to show in the included stores.",
    latestPage: (from: number, to: number) => `Orders ${from} to ${to}.`,
    more: "5 more",
    help: [
      "Order notifications arrive here according to your Settings.",
      "/status: plan, notifications and stores",
      "/latest: the latest orders of the included stores",
      "/preferences: pause, filter, frequency and stores",
      "Search, unlocking and export stay on the website.",
    ],
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
  (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = l.workspace_id
    ORDER BY wm.role = 'owner' DESC, wm.user_id LIMIT 1) AS userId,
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
 * un problema di consegna: chi aveva bloccato il bot e gli scrive di nuovo riceve gli eventi da
 * quel momento, senza quelli del periodo bloccato. Una chat senza collegamento non vede nulla.
 */
export async function consumeTelegramUpdate(
  env: Env,
  update: TelegramReceipt,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const db = env.DB;
  await db
    .prepare(`UPDATE telegram_links SET
        resumed_at = CASE WHEN delivery_failure = 'blocked' THEN ?2 ELSE resumed_at END,
        delivery_failure = NULL, delivery_failed_at = NULL
      WHERE chat_id = ?1 AND delivery_failure IS NOT NULL`)
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
  return replies.reduce<Promise<void>>(
    (previous, { link, message }) =>
      previous.then(() => quiet(sendMessage(env, link.chatId, message, fetcher))),
    Promise.resolve(),
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
  return latestMessages(env, link, 0, now);
}

function helpMessage(env: Env, language: Language): BotMessage {
  return {
    html: copy[language].help.map(escape).join("\n"),
    buttons: [[{ text: copy[language].openSettings, url: settingsUrl(env, language) }]],
  };
}

function premiumMessage(env: Env, language: Language): BotMessage {
  return {
    html: escape(copy[language].premiumRequired),
    buttons: [
      [
        {
          text: copy[language].choosePlan,
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
      .prepare(`SELECT COALESCE(p.enabled, 1) AS enabled, COALESCE(p.filter, 'fiscal') AS filter,
          COALESCE(p.mode, 'each') AS mode, COALESCE(p.digest_time, '18:00') AS digestTime,
          COALESCE(p.time_zone, 'Europe/Rome') AS timeZone, l.last_delivery_at AS lastDelivery,
          l.delivery_failure AS failure
        FROM telegram_links l LEFT JOIN telegram_preferences p ON p.workspace_id = l.workspace_id
        WHERE l.id = ?`)
      .bind(link.id),
    db
      .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, s.ebay_environment AS environment,
          COALESCE(sp.enabled, 1) AS enabled,
          EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id AND p.reason = 'plan')
            AS paused,
          (s.disconnected_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM ebay_store_credentials c
            WHERE c.store_id = s.id AND c.rejected_at IS NULL AND c.refresh_expires_at > ?2))
            AS reconnect
        FROM ebay_stores s LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
        WHERE s.workspace_id = ?1 AND s.data_deleted_at IS NULL ORDER BY s.linked_at, s.id`)
      .bind(link.workspaceId, now.toISOString()),
    // La copertura mostrata è la stessa delle Impostazioni: prima un diritto diverso dalla prova.
    db
      .prepare(`SELECT e.source, e.ends_at AS endsAt FROM workspace_entitlements e
        WHERE e.workspace_id = ?1 AND e.revoked_at IS NULL AND julianday(e.starts_at) <= julianday(?2)
          AND (e.ends_at IS NULL OR julianday(?2) < julianday(e.ends_at))
        ORDER BY e.source = 'trial', e.ends_at IS NOT NULL, julianday(e.ends_at) DESC LIMIT 1`)
      .bind(link.workspaceId, now.toISOString()),
  ]);
  return {
    preferences: preferences[0] as Preferences,
    stores: stores as StoreRow[],
    coverage: coverage[0] as { source: string; endsAt: string | null } | undefined,
  };
}

const names = (stores: StoreRow[], none: string) => {
  if (stores.length === 0) return none;
  const shown = stores.slice(0, 10).map((store) => store.name.slice(0, 40));
  return [...shown, ...(stores.length > 10 ? [`+${stores.length - 10}`] : [])].join(", ");
};

function preferenceLines(language: Language, state: Awaited<ReturnType<typeof readState>>) {
  const text = copy[language];
  const { preferences } = state;
  const line = (label: string, value: string) => `${escape(label)}: ${escape(value)}`;
  return [
    line(text.notifications, preferences.enabled ? text.enabled : text.paused),
    line(text.filter, text.filters[preferences.filter]),
    line(
      text.mode,
      preferences.mode === "each"
        ? text.modes.each
        : text.modes.digest(preferences.digestTime, zoneName(language, preferences.timeZone)),
    ),
  ];
}

async function statusMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const state = await readState(env.DB, link, now);
  const { coverage, preferences } = state;
  const until = (iso: string) => dateTime(link.language, preferences.timeZone, iso);
  const plan = !coverage
    ? text.plans.free
    : coverage.source === "lifetime"
      ? text.plans.lifetime
      : coverage.source === "trial"
        ? text.plans.trial(until(coverage.endsAt!))
        : text.plans.premium(until(coverage.endsAt!));
  const active = state.stores.filter((store) => !store.paused);
  const line = (label: string, value: string) => `${escape(label)}: ${escape(value)}`;
  const lines = [
    `<b>${escape(text.status)}</b>`,
    line(text.plan, plan),
    ...(coverage ? preferenceLines(link.language, state) : []),
    line(
      text.included,
      names(
        active.filter((store) => store.enabled),
        text.none,
      ),
    ),
    line(
      text.excluded,
      names(
        active.filter((store) => !store.enabled),
        text.none,
      ),
    ),
    ...(state.stores.some((store) => store.reconnect)
      ? [
          line(
            text.reconnect,
            names(
              state.stores.filter((store) => store.reconnect),
              text.none,
            ),
          ),
        ]
      : []),
    line(
      text.lastDelivery,
      preferences.lastDelivery
        ? dateTime(link.language, preferences.timeZone, preferences.lastDelivery)
        : text.none,
    ),
    // Un blocco si chiude già con il messaggio che ha chiesto lo stato.
    ...(preferences.failure === "unreachable" ? [escape(text.unreachable)] : []),
  ];
  return {
    html: splitBlocks([lines.join("\n")])[0]!,
    buttons: [
      [
        coverage
          ? { text: text.preferences, callback_data: data(link, "pr") }
          : { text: text.choosePlan, url: appUrl(env, link.language, `${settingsPath}/piano`) },
        { text: text.openSettings, url: settingsUrl(env, link.language) },
      ],
    ],
  };
}

const mark = (on: boolean, label: string) => `${on ? "✓ " : ""}${label}`;

async function preferencesMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const state = await readState(env.DB, link, now);
  const { preferences } = state;
  const active = state.stores.filter((store) => !store.paused);
  const settings: BotButton = { text: text.openSettings, url: settingsUrl(env, link.language) };
  const unlink: BotButton = { text: text.unlink, callback_data: data(link, "ul") };
  const html = [
    `<b>${escape(text.preferencesTitle)}</b>`,
    ...preferenceLines(link.language, state),
    escape(text.zoneNote),
  ].join("\n");
  if (!preferences.enabled)
    return {
      html,
      buttons: [[{ text: text.resume, callback_data: data(link, "en", 1) }], [unlink], [settings]],
    };
  return {
    html,
    buttons: [
      [{ text: text.pause, callback_data: data(link, "en", 0) }],
      [
        {
          text: mark(preferences.filter === "fiscal", text.fiscalOnly),
          callback_data: data(link, "fi", "fiscal"),
        },
        {
          text: mark(preferences.filter === "all", text.allOrders),
          callback_data: data(link, "fi", "all"),
        },
      ],
      [
        {
          text: mark(preferences.mode === "each", text.each),
          callback_data: data(link, "mo", "each"),
        },
        {
          text: mark(preferences.mode === "digest", text.digest),
          callback_data: data(link, "mo", "digest"),
        },
      ],
      ...(preferences.mode === "digest"
        ? [[{ text: text.time(preferences.digestTime), callback_data: data(link, "tm") }]]
        : []),
      ...(state.stores.length > 0
        ? [
            [
              {
                text: text.stores(active.filter((store) => store.enabled).length, active.length),
                callback_data: data(link, "ss", 0),
              },
            ],
          ]
        : []),
      [unlink],
      [settings],
    ],
  };
}

async function timesMessage(env: Env, link: Link, now: Date): Promise<BotMessage> {
  const text = copy[link.language];
  const { preferences } = await readState(env.DB, link, now);
  return {
    html: `<b>${escape(text.timeTitle)}</b>\n${escape(text.zoneNote)}`,
    buttons: [
      telegramDigestTimes.map((time) => ({
        text: mark(preferences.digestTime === time, time),
        callback_data: data(link, "tm", time.replace(":", "")),
      })),
      [{ text: text.back, callback_data: data(link, "pr") }],
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
    html: `<b>${escape(text.storesTitle)}</b>`,
    buttons: [
      ...shown.map((store) => [
        store.paused
          ? {
              text: `${store.name.slice(0, 40)} (${text.suspended})`,
              callback_data: data(link, "ss", current),
            }
          : {
              text: mark(store.enabled === 1, store.name.slice(0, 40)),
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
      [{ text: text.back, callback_data: data(link, "pr") }],
    ],
  };
}

/**
 * Ultimi ordini definitivi dei negozi inclusi, letti come nel sito dall'utente dello spazio: un
 * messaggio per ordine con i suoi pulsanti, poi la posizione e, fino a 20, «Altri 5».
 */
async function latestMessages(
  env: Env,
  link: Link,
  offset: number,
  now: Date,
): Promise<BotMessage[]> {
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
  const orders = perStore.flat();
  orders.sort((a, b) =>
    b.order.creationTime === a.order.creationTime
      ? b.order.id.localeCompare(a.order.id)
      : b.order.creationTime.localeCompare(a.order.creationTime),
  );
  const listed = orders.slice(0, latestLimit);
  const page = listed.slice(offset, offset + latestPage);
  if (page.length === 0) return [{ html: escape(text.latestEmpty) }];
  const next = offset + latestPage;
  return [
    ...page.flatMap(({ order, environment }) =>
      orderMessage(
        env,
        link.language,
        state.preferences.timeZone,
        orderNotice(order, environment),
        null,
      ),
    ),
    {
      html: escape(text.latestPage(offset + 1, offset + page.length)),
      ...(next < listed.length
        ? { buttons: [[{ text: text.more, callback_data: data(link, "la", next) }]] }
        : {}),
    },
  ];
}

/**
 * Un altro tocco sullo stesso pulsante dello stesso messaggio, già eseguito o ricevuto prima: dei
 * tocchi in attesa insieme vale il primo ricevuto.
 */
async function earlierTap(db: D1Database, update: TelegramReceipt) {
  const earlier = await db
    .prepare(`SELECT 1 FROM webhook_receipts mine JOIN webhook_receipts other
        ON other.provider = mine.provider AND other.environment = mine.environment
          AND other.object_id = mine.object_id AND other.message_id = mine.message_id
          AND other.command = mine.command AND other.id <> mine.id
      WHERE mine.id = ?1 AND (other.completed_at IS NOT NULL
        OR julianday(other.event_at) < julianday(mine.event_at)
        OR (other.event_at = mine.event_at AND other.id < mine.id))`)
    .bind(update.receiptId)
    .first();
  return earlier !== null;
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
    if (!Number.isInteger(offset) || offset <= 0 || offset >= latestLimit) return;
    // Il pulsante sparisce dal messaggio toccato; dei tocchi arrivati prima che sparisse vale
    // soltanto il primo ricevuto, così la pagina non si ripete.
    if (await earlierTap(env.DB, update)) return;
    await edit({ html: escape(copy[language].latestPage(offset - latestPage + 1, offset)) });
    const messages = await latestMessages(env, link, offset, now);
    return sendInOrder(
      env,
      messages.map((message) => ({ link, message })),
      fetcher,
    );
  }
  return edit(await preferencesMessage(env, link, now));
}
