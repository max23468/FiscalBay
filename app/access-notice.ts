import { appCopy, type AppCopy } from "./app-copy";
import type { Language } from "./i18n";

type Tone = "success" | "info" | "warning" | "danger";
export type SignInNotice = keyof AppCopy["access"]["signInNotices"];
export type StoreNotice = keyof AppCopy["access"]["storeNotices"];

/**
 * Esito del collegamento di un negozio nell'indirizzo: è il nome del filtro del negozio negli
 * Ordini, che riconosce gli esiti e li toglie dai filtri.
 */
export const storeNoticeParam = "negozio";

/** Pagina `path` con l'avviso dell'esito `notice`. */
export function withStoreNotice(path: string, notice: StoreNotice) {
  return `${path}?${new URLSearchParams({ [storeNoticeParam]: notice })}`;
}

/** Tono degli avvisi: gli errori chiedono un'azione, le conferme no. */
const signInTones: Record<SignInNotice, Tone> = {
  errore: "danger",
  registrazione: "danger",
  autorizzazione: "warning",
  termini: "warning",
  dati: "warning",
  "troppi-tentativi": "warning",
  "verifica-non-riuscita": "warning",
  "verifica-non-disponibile": "warning",
  "codice-errato": "warning",
  "verifica-inviata": "success",
  "passkey-rimossa": "success",
  "passkey-rinominata": "success",
  "passkey-nome-non-valido": "warning",
  "ultimo-accesso": "warning",
  "recupero-inviato": "info",
  "password-reimpostata": "success",
  "password-trapelata": "warning",
  "recupero-scaduto": "warning",
  "password-violata": "warning",
  "metodo-collegato": "success",
  "metodo-rimosso": "success",
  "ebay-rimosso": "success",
  "ultimo-metodo": "warning",
  "password-link": "info",
  "email-richiesta": "info",
  "email-confermata": "success",
  "email-non-valida": "warning",
  "nuovo-accesso": "warning",
  "conferma-passkey": "warning",
  "sessione-chiusa": "success",
  "sessioni-chiuse": "success",
  "accesso-non-verificato": "warning",
  "cancellazione-in-corso": "warning",
};

const storeTones: Record<StoreNotice, Tone> = {
  collegato: "success",
  eliminato: "success",
  negato: "warning",
  "negozio-diverso": "warning",
  "altro-spazio": "warning",
  accesso: "warning",
  errore: "danger",
  "ebay-non-risponde": "warning",
  "lista-attesa": "warning",
  sospeso: "warning",
};

export type AccessNoticeView = { text: string; tone: Tone } & (
  | { source: "accesso"; key: SignInNotice }
  | { source: "negozio"; key: StoreNotice }
);

/** Esito di un accesso nell'indirizzo, se è uno di quelli previsti. */
export function isSignInNotice(value: string | null): value is SignInNotice {
  return value !== null && Object.hasOwn(signInTones, value);
}

/** Esito del collegamento di un negozio nell'indirizzo, se è uno di quelli previsti. */
export function isStoreNotice(value: string | null): value is StoreNotice {
  return value !== null && Object.hasOwn(storeTones, value);
}

/** Avviso di un esito d'accesso, con il suo tono. */
export function signInNotice(key: SignInNotice, language: Language): AccessNoticeView {
  return {
    source: "accesso",
    key,
    text: appCopy[language].access.signInNotices[key],
    tone: signInTones[key],
  };
}

/**
 * Esito arrivato nell'indirizzo (`accesso`, `negozio`, `error`), con il suo tono. Un link di
 * recupero con un errore vale come link scaduto.
 */
export function accessNotice(search: URLSearchParams, language: Language): AccessNoticeView | null {
  const { access } = appCopy[language];
  const signIn = search.get("accesso");
  const store = search.get(storeNoticeParam);
  const key = isSignInNotice(signIn) ? signIn : search.has("error") ? "recupero-scaduto" : null;
  if (key) return signInNotice(key, language);
  if (isStoreNotice(store))
    return {
      source: "negozio",
      key: store,
      text: access.storeNotices[store],
      tone: storeTones[store],
    };
  return null;
}
