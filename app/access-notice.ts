import { appCopy } from "./app-copy";
import type { Language } from "./i18n";

/** Tono degli avvisi: gli errori chiedono un'azione, le conferme no. */
const noticeTones: Record<string, "success" | "info" | "warning" | "danger"> = {
  errore: "danger",
  registrazione: "danger",
  termini: "warning",
  dati: "warning",
  "troppi-tentativi": "warning",
  accesso: "warning",
  "altro-spazio": "warning",
  registrato: "success",
  "verifica-inviata": "success",
  "passkey-rimossa": "success",
  "ultimo-accesso": "warning",
  "recupero-inviato": "info",
  "password-reimpostata": "success",
  "recupero-scaduto": "warning",
  collegato: "success",
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
};

export type AccessNoticeView = { text: string; tone: (typeof noticeTones)[string] };

/** Esito arrivato nell'indirizzo (`accesso`, `negozio`, `error`), con il suo tono. */
export function accessNotice(search: URLSearchParams, language: Language): AccessNoticeView | null {
  const { access } = appCopy[language];
  const key = search.get("accesso") ?? search.get("negozio") ?? "";
  const text =
    access.signInNotices[search.get("accesso") ?? ""] ??
    access.storeNotices[search.get("negozio") ?? ""] ??
    (search.has("error") ? access.signInNotices["recupero-scaduto"] : null) ??
    null;
  return text
    ? { text, tone: noticeTones[search.has("error") ? "recupero-scaduto" : key] ?? "info" }
    : null;
}
