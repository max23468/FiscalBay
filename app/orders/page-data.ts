import type { Language } from "../i18n";
import type { AccountView, FiscalView, OrdersNotice, OrderView } from "../view-models";

/** Azioni secondarie disponibili nella pagina: eBay ed esportazione del singolo ordine. */
export interface SecondaryActions {
  /** Solo per i negozi eBay reali: per la Sandbox non esiste un indirizzo verificato. */
  openOnEbay: boolean;
  /** Esiste la sezione Esportazione, che riceve selezione, filtri e ricerca degli Ordini. */
  exportable: boolean;
}

/** Piano, prova e sblocchi del ciclo: tutto ciò che la pagina Ordini usa dell'account. */
export type OrdersAccount = Pick<AccountView, "plan" | "quota" | "trial"> &
  Partial<Pick<AccountView, "trialAvailable" | "freeSuspended">>;

/**
 * Dati della pagina Ordini, uguali per l'area reale (ordini persistiti e autorizzati) e per
 * l'anteprima (scenari sintetici). Un valore fiscale da sbloccare non è mai fra questi dati.
 */
export interface OrdersPageData extends SecondaryActions {
  view: "list" | "no-store" | "empty";
  orders: OrderView[];
  total: number;
  nextHref: string | null;
  /** Gli ordini consultabili superano quelli leggibili in una richiesta: servono i filtri. */
  limited: boolean;
  /** Istantanea dell'elenco, come cursore opaco: l'indirizzo la conserva. */
  snapshot: string;
  /** Ordini arrivati dopo l'istantanea, che entrano soltanto in cima. */
  incoming: number;
  /** Elenco con una nuova istantanea, che comprende i nuovi ordini. */
  freshHref: string | null;
  /** I nuovi ordini stanno tutti sopra il primo mostrato: possono entrare da soli in cima. */
  incomingAtTop: boolean;
  /** Ricerca attiva, decifrata dal server: nell'indirizzo resta soltanto in forma cifrata. */
  search: string | null;
  /** Ordine aperto nel pannello, anche se fuori dalla pagina caricata. */
  detail: OrderView | null;
  stores: Array<{ id: string; name: string }>;
  account: OrdersAccount;
  notices: OrdersNotice[];
  sync: {
    running: boolean;
    lastAt: string | null;
    storeId: string | null;
    storeName: string | null;
    /** Giorni dello storico letto: il periodo di cui un elenco vuoto dà conto. */
    historyDays: number;
  };
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  /** Modello di messaggio scelto per ogni lingua dell'acquirente. */
  messageTemplates: Record<Language, string>;
  now: string;
  confirmUnlock: boolean;
  /** Le Impostazioni del piano esistono: l'avviso degli sblocchi esauriti vi rimanda. */
  settings: boolean;
  /**
   * Proposta del consenso marketing, una volta e a primi passi conclusi, a chi in registrazione
   * non ha aderito e non ha più scelto (§14).
   */
  marketingProposal?: boolean;
  /**
   * Collegamento di un negozio dal primo accesso: pagina reale, oppure null finché non è
   * possibile (email da confermare). Assente, l'azione resta quella simulata dell'anteprima.
   */
  connectHref?: string | null;
}

/** Sblocchi rimasti nel ciclo; null senza limite (Premium), zero con il Free sospeso. */
export function remainingUnlocks(account: OrdersAccount) {
  if (account.freeSuspended) return 0;
  return account.quota ? Math.max(account.quota.limit - account.quota.used, 0) : null;
}

/** Un dato si sblocca solo se è da sbloccare e nessuna verifica o conferma lo sospende. */
export function unlockable(fiscal: FiscalView) {
  return fiscal.state === "locked" && !fiscal.hold;
}

/** eBay non risponde: le azioni verso eBay restano sospese. */
export function ebayDownNotice(data: Pick<OrdersPageData, "notices">) {
  return data.notices.find((notice) => notice.kind === "ebay-down");
}

/** Importazione dello storico in corso, se c'è. */
export function importingNotice(data: Pick<OrdersPageData, "notices">) {
  return data.notices.find((notice) => notice.kind === "importing");
}

/**
 * Sblocco chiesto dalla pagina e simulato nell'anteprima con lo stesso modulo: l'intent, gli
 * ordini separati da virgola e la scelta di non chiedere più la conferma.
 */
export const unlockIntent = "unlock";

export function unlockForm(ids: readonly string[], skipConfirmation: boolean) {
  return { intent: unlockIntent, ids: ids.join(","), skipConfirmation: String(skipConfirmation) };
}

export function readUnlockForm(form: FormData) {
  return {
    ids: [
      ...new Set(
        String(form.get("ids") ?? "")
          .split(",")
          .filter(Boolean),
      ),
    ],
    skipConfirmation: form.get("skipConfirmation") === "true",
  };
}

export interface UnlockResult {
  unlocked: string[];
  remaining: number | null;
  error?: boolean;
}

/** Sblocco non riuscito: nessun ordine sbloccato e, se noti, gli sblocchi rimasti. */
export function unlockFailure(remaining: number | null = null): UnlockResult {
  return { unlocked: [], remaining, error: true };
}
