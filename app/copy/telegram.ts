import type { FiscalSituation } from "../view-models";
import type { Language } from "../i18n";
import type { BotCommand } from "../integrations/telegram.server";

/** Testi del bot Telegram e dei suoi messaggi, nelle due lingue. */

/** Voci ripetute fra messaggi, comandi e risposte. */
const shared = {
  it: { orders: "Apri gli ordini", notifications: "Impostazioni › Notifiche" },
  en: { orders: "Open orders", notifications: "Settings › Notifications" },
} satisfies Record<Language, unknown>;

/** Messaggi degli ordini, dei riepiloghi e delle importazioni. */
export const telegramMessageCopy = {
  it: {
    change: {
      new: "Nuovo ordine",
      available: "Dato fiscale disponibile",
      changed: "Dato fiscale aggiornato",
      removed: "Dato fiscale rimosso",
    },
    today: "oggi",
    yesterday: "ieri",
    more: (count: number) => (count === 1 ? "e un altro articolo" : `e altri ${count} articoli`),
    kinds: { CF: null, PIVA: "P.IVA" },
    removedNote: "Il dato notificato in precedenza non è più nell'ordine.",
    fiscal: {
      checking: "Dato fiscale in verifica",
      missing: "Nessun dato fiscale",
      foreign: (country: string) => `Fatturazione estera (${country})`,
      error: "Dato fiscale non letto: riprova da FiscalBay",
      locked: "Da sbloccare in FiscalBay",
      available: "",
    } satisfies Record<FiscalSituation, string | ((country: string) => string)>,
    checkingNote: "Se arriva, ricevi un nuovo messaggio.",
    open: "Apri in FiscalBay",
    ebay: "Apri su eBay",
    copy: "Copia Codice Fiscale",
    orders: shared.it.orders,
    digest: (date: string) => `Riepilogo del ${date}`,
    digestCount: (count: number) =>
      `${count === 1 ? "Un ordine" : `${count} ordini`} dall'ultimo riepilogo`,
    import: {
      title: "Importazione completata",
      orders: (count: number) => (count === 1 ? "Un ordine" : `${count} ordini`),
      fiscal: "con dato fiscale",
      period: (from: string, until: string) => `dal ${from} al ${until}`,
      note: "Gli ordini importati non ricevono messaggi singoli: da ora arrivano quelli nuovi.",
    },
  },
  en: {
    change: {
      new: "New order",
      available: "Tax ID available",
      changed: "Tax ID updated",
      removed: "Tax ID removed",
    },
    today: "today",
    yesterday: "yesterday",
    more: (count: number) => (count === 1 ? "and one more item" : `and ${count} more items`),
    kinds: { CF: null, PIVA: "VAT" },
    removedNote: "The tax ID notified earlier is no longer in the order.",
    fiscal: {
      checking: "Tax ID being checked",
      missing: "No tax ID",
      foreign: (country: string) => `Billing abroad (${country})`,
      error: "Tax ID not read: try again from FiscalBay",
      locked: "To unlock in FiscalBay",
      available: "",
    } satisfies Record<FiscalSituation, string | ((country: string) => string)>,
    checkingNote: "If it arrives, you get a new message.",
    open: "Open in FiscalBay",
    ebay: "Open on eBay",
    copy: "Copy tax code",
    orders: shared.en.orders,
    digest: (date: string) => `Summary of ${date}`,
    digestCount: (count: number) =>
      `${count === 1 ? "One order" : `${count} orders`} since the last summary`,
    import: {
      title: "Import completed",
      orders: (count: number) => (count === 1 ? "One order" : `${count} orders`),
      fiscal: "with a tax ID",
      period: (from: string, until: string) => `from ${from} to ${until}`,
      note: "Imported orders get no individual messages: new orders arrive from now on.",
    },
  },
} satisfies Record<Language, unknown>;

/**
 * Comandi e pulsanti del bot per i venditori.
 */
export const telegramBotCopy = {
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
    unlinked: `Chat scollegata. Puoi collegarla di nuovo da FiscalBay, in ${shared.it.notifications}.`,
    expired: "Questo pulsante non è più valido.",
    latest: "Ultimi ordini",
    latestRange: (from: number, to: number, total: number) => `${from}–${to} di ${total}`,
    latestEmpty: "Nessun ordine da mostrare nei negozi inclusi.",
    more: "Altri 5",
    previous: "Precedenti",
    orders: shared.it.orders,
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
    unlinked: `Chat unlinked. You can link it again in FiscalBay, under ${shared.en.notifications}.`,
    expired: "This button is no longer valid.",
    latest: "Latest orders",
    latestRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    latestEmpty: "No orders to show in the included stores.",
    more: "5 more",
    previous: "Previous",
    orders: shared.en.orders,
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

/** Risposte del bot, in testo semplice. Senza una richiesta riconosciuta, in entrambe le lingue. */
export const telegramReplyCopy = {
  it: {
    linked:
      "Chat collegata a FiscalBay. Qui riceverai le notifiche degli ordini secondo le preferenze delle Impostazioni.",
    invalid: (url: string) =>
      `Questo link non è più valido. Creane uno nuovo da FiscalBay, in ${shared.it.notifications}:\n${url}`,
    help: (url: string) =>
      `Per ricevere qui le notifiche degli ordini, collega questa chat da FiscalBay, in ${shared.it.notifications}:\n${url}`,
  },
  en: {
    linked:
      "Chat linked to FiscalBay. Order notifications will arrive here according to your Settings.",
    invalid: (url: string) =>
      `This link is no longer valid. Create a new one in FiscalBay, under ${shared.en.notifications}:\n${url}`,
    help: (url: string) =>
      `To receive order notifications here, link this chat in FiscalBay, under ${shared.en.notifications}:\n${url}`,
  },
} satisfies Record<Language, unknown>;
