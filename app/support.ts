import type { AppCopy } from "./app-copy";
import type { AccountView } from "./view-models";

/** Argomenti del modulo di assistenza, nell'ordine dell'elenco. */
export const supportTopics = ["orders", "stores", "billing", "other"] as const;
export type SupportTopic = (typeof supportTopics)[number];

/** Lunghezza massima del messaggio, nel modulo e sul server. */
export const maxSupportMessage = 4000;

/**
 * Campi della richiesta di assistenza inviati dal modulo. La casella del riepilogo vale «on»
 * quando è spuntata e si allega soltanto se il riepilogo è mostrato, cioè con il suo correlation
 * ID (`reference`), che parte insieme perché l'email riporti il riferimento visto dall'utente.
 */
export function supportFields(
  form: FormData,
  input: { topic: string; message: string; reference: string | null },
): Record<string, string> {
  const attached = input.reference !== null && form.get("diagnostics") === "on";
  return {
    topic: input.topic,
    message: input.message,
    diagnostics: String(attached),
    ...(attached ? { reference: input.reference! } : {}),
  };
}

/**
 * Stato dei diritti nel riepilogo diagnostico dell'assistenza, nell'area reale e
 * nell'anteprima: piano, prova, concessione o periodicità, con gli sblocchi del Free.
 */
export function planDiagnostics(
  account: Pick<AccountView, "plan" | "waitlisted" | "quota" | "trial" | "grant" | "premium">,
  t: AppCopy,
): string {
  const plans = t.settings.support.diag.plans;
  if (account.waitlisted) return plans.waitlist;
  if (account.quota) return plans.freeQuota(account.quota.used, account.quota.limit);
  if (account.plan === "free") return plans.free;
  if (account.trial) return plans.trial;
  if (account.grant) return plans.granted;
  if (account.premium?.period === "lifetime") return plans.lifetime;
  return account.premium?.period === "monthly" ? plans.monthly : plans.annual;
}
