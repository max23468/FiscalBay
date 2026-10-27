import { appCopy, supportEmail } from "../app-copy";
import { isProduction } from "../app-links";
import { formatDate } from "../format";
import { maxSupportMessage, supportTopics, type SupportTopic } from "../support";
import type { Language } from "../i18n";
import type { DiagnosticsView } from "../view-models";
import { readsFailing, type StoreStatus } from "./stores.server";

/**
 * Richieste del modulo di assistenza (§14). La richiesta arriva soltanto alla casella
 * `supporto@`, con Reply-To sull'indirizzo dell'account: D1 non ne conserva testo né riepilogo
 * (limite per account in `support-requests.server.ts`).
 */

export interface SupportRequest {
  topic: SupportTopic;
  message: string;
  /** L'utente allega il riepilogo diagnostico. */
  diagnostics: boolean;
}

/** Argomento dell'elenco e messaggio non vuoto entro il limite; null altrimenti. */
export function parseSupportRequest(form: FormData): SupportRequest | null {
  const topic = String(form.get("topic") ?? "");
  // Ritorni a capo e tabulazioni restano; gli altri caratteri di controllo no.
  const message = String(form.get("message") ?? "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .trim();
  if (!(supportTopics as readonly string[]).includes(topic)) return null;
  if (!message || message.length > maxSupportMessage) return null;
  return {
    topic: topic as SupportTopic,
    message,
    diagnostics: form.get("diagnostics") === "true",
  };
}

/** Versione distribuita: il tag del deploy (prefisso del commit) o l'identificativo. */
export function appVersion(env: Pick<Env, "VERSION_METADATA">): string | null {
  const metadata = env.VERSION_METADATA as Partial<WorkerVersionMetadata> | undefined;
  return metadata?.tag || metadata?.id?.slice(0, 8) || null;
}

/**
 * Negozio interessato: prima quello con un problema, poi quello letto per ultimo fra i
 * collegati, infine il primo dell'elenco. Sempre e soltanto fra i negozi dello spazio.
 */
function concernedStore(stores: StoreStatus[]): StoreStatus | null {
  const linked = stores.filter((store) => store.connection !== "disconnected");
  return (
    linked.find((store) => store.connection === "reconnect_required" || readsFailing(store)) ??
    linked
      .filter((store) => store.lastSyncAt)
      .sort((a, b) => b.lastSyncAt!.localeCompare(a.lastSyncAt!))[0] ??
    linked[0] ??
    stores[0] ??
    null
  );
}

/**
 * Riepilogo allowlistato: versione, riferimento interno del negozio, fase ed esito dell'ultima
 * lettura, codice errore stabile, diritti e correlation ID. Mai token, nomi o username eBay,
 * dati fiscali, acquirenti o altri spazi: i campi nascono qui, non da una copia dei record.
 */
export function supportDiagnostics(input: {
  stores: StoreStatus[];
  plan: string;
  version: string | null;
  correlationId: string;
  language: Language;
  timeZone: string;
}): DiagnosticsView {
  const diag = appCopy[input.language].settings.support.diag;
  const store = concernedStore(input.stores);
  const at = (value: string) => formatDate(value, input.language, "dateTime", input.timeZone);
  const last = store?.recent[0];
  const syncPhase = !store
    ? diag.phases.none
    : store.connection === "disconnected"
      ? diag.phases.disconnected
      : store.connection === "reconnect_required"
        ? diag.phases.reconnect
        : store.connection === "paused"
          ? diag.phases.paused
          : store.history?.done === false
            ? diag.phases.importing
            : store.syncing
              ? diag.phases.running
              : last
                ? (last.ok ? diag.phases.ok : diag.phases.failed)(at(last.at))
                : store.lastSyncAt
                  ? diag.phases.ok(at(store.lastSyncAt))
                  : diag.phases.waiting;
  return {
    version: input.version ?? diag.none,
    storeRef: store?.id ?? null,
    syncPhase,
    errorCode:
      store?.connection === "reconnect_required"
        ? "STORE_RECONNECT_REQUIRED"
        : store && readsFailing(store)
          ? "UPSTREAM_UNAVAILABLE"
          : null,
    rights: input.plan,
    correlationId: input.correlationId,
  };
}

/**
 * Testo dell'email verso `supporto@`, sempre in italiano per chi risponde: account, lingua e
 * argomento, il messaggio dell'utente e, se allegato, il riepilogo come lo ha visto l'utente.
 */
export function supportEmailMessage(
  env: Pick<Env, "APP_ORIGIN">,
  input: {
    request: SupportRequest;
    userId: string;
    email: string;
    language: Language;
    /** Riepilogo allegato; null se l'utente non lo allega o se non è stato possibile leggerlo. */
    diagnostics: DiagnosticsView | null;
  },
): { to: string; replyTo: string; subject: string; text: string } {
  const t = appCopy.it.settings.support;
  const environment = isProduction(env) ? "" : ` (${new URL(env.APP_ORIGIN).host})`;
  const { request, diagnostics } = input;
  const summary = diagnostics
    ? [
        [t.diag.version, diagnostics.version],
        [t.diag.store, diagnostics.storeRef ?? t.diag.none],
        [t.diag.sync, diagnostics.syncPhase],
        [t.diag.error, diagnostics.errorCode ?? t.diag.none],
        [t.diag.rights, diagnostics.rights],
        [t.diag.reference, diagnostics.correlationId],
      ]
        .map(([label, value]) => `${label}: ${value}`)
        .join("\n")
    : request.diagnostics
      ? "Riepilogo diagnostico non disponibile al momento dell'invio."
      : "Riepilogo diagnostico non allegato.";
  return {
    to: supportEmail,
    replyTo: input.email,
    subject: `Assistenza FiscalBay${environment}: ${t.topics[request.topic]}`,
    text: [
      `Argomento: ${t.topics[request.topic]}`,
      `Account: ${input.userId}`,
      `Email: ${input.email}`,
      `Lingua: ${input.language}`,
      "",
      request.message,
      "",
      "--",
      summary,
    ].join("\n"),
  };
}
