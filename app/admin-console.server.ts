import { env } from "cloudflare:workers";
import { data } from "react-router";

import { assertSameOrigin } from "./account-area.server";
import { adminCopy } from "./copy/admin-copy";
import { listAbuseSignals, reviewAbuseSignal } from "./domain/abuse-review.server";
import { listAudit, reasonSchema, recordAudit } from "./domain/admin-audit.server";
import {
  checkPrices,
  commerceOverview,
  endPromotion,
  promotionSchema,
  quotaChangeSchema,
  savePromotion,
  scheduleFreeQuota,
} from "./domain/admin-commerce.server";
import {
  consoleSummary,
  listAccounts,
  listAllStores,
  workspaceDetail,
} from "./domain/admin-directory.server";
import {
  listAnomalies,
  receiptStates,
  retryOrderDetails,
  taskStates,
} from "./domain/admin-operations.server";
import { recordSupportErasure } from "./domain/billing.server";
import {
  grantHistoryExtension,
  grantLifetimeConcession,
  grantPremium,
  revokeHistoryExtension,
} from "./domain/concessions.server";
import { quotaAnomalies, readEbayQuotas } from "./domain/ebay-quotas.server";
import { assistFreeStore } from "./domain/free-store.server";
import { requestStoreSync } from "./domain/order-sync.server";
import { isScheduledTask, requeueTask } from "./domain/scheduled-work.server";
import {
  listServiceNotices,
  saveServiceNotice,
  serviceNoticeSchema,
  withdrawServiceNotice,
} from "./domain/service-notices.server";
import {
  adminAccess,
  adminSessionMaxAge,
  readSession,
  type AuthSession,
} from "./domain/sessions.server";

export { adminSessionMaxAge };
import { confirmStoreTransfer, prepareStoreTransfer } from "./domain/store-transfer.server";
import { setAdminPause } from "./domain/stores.server";
import { logFailure } from "./errors";
import { displayTimeZone, formatDate } from "./format";
import type { Language } from "./i18n";
import { resumeStalledReceipts } from "./webhooks.server";

/**
 * Console amministrativa (§15): sezioni, letture e operazioni. Ogni richiesta rilegge la
 * sessione e il ruolo dal database; chi non è admin riceve la stessa risposta di un indirizzo
 * inesistente, e senza la conferma con passkey le sezioni non si caricano. Ogni operazione è
 * nell'elenco qui sotto, rilegge lo stato al momento dell'esecuzione e lascia autore, motivo ed
 * esito nel registro: non esiste un accesso generico ai dati.
 */

export const adminSections = [
  "account",
  "spazi",
  "negozi",
  "lavori",
  "quote",
  "commerciale",
  "antiabuso",
  "comunicazioni",
  "registro",
] as const;

export type AdminSection = (typeof adminSections)[number] | "panoramica";

export function sectionFrom(value: string | undefined): AdminSection | null {
  if (!value) return "panoramica";
  return (adminSections as readonly string[]).includes(value) ? (value as AdminSection) : null;
}

/** Prefisso dei token tecnici della console, riconoscibile in un'eventuale fuga. */
const agentTokenPrefix = "fbat_";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Accesso tecnico (D213): un token `Bearer` il cui SHA-256 è registrato e non revocato apre la
 * console all'agente che assiste l'owner, anche senza passkey, con le stesse operazioni della
 * sessione admin. Restituisce l'etichetta del token, o null.
 */
async function agentAccess(request: Request, now: Date) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith(`Bearer ${agentTokenPrefix}`) ? header.slice(7) : null;
  if (!token || token.length > 128) return null;
  const row = await env.DB.prepare(`UPDATE admin_agent_tokens SET used_at = ?2
      WHERE token_hash = ?1 AND revoked_at IS NULL RETURNING label`)
    .bind(await sha256(token), now.toISOString())
    .first<{ label: string }>();
  return row?.label ?? null;
}

/**
 * Livello di accesso della richiesta: la sessione admin con passkey verificata, oppure il token
 * tecnico quando la sessione non basta.
 */
export async function adminSession(request: Request) {
  const session = (await readSession(env, request)) as
    | (AuthSession & {
        user: { email: string };
      })
    | null;
  const access = adminAccess(session);
  if (access === "granted") return { session, access, agent: null };
  const agent = await agentAccess(request, new Date());
  return agent ? { session, access: "agent" as const, agent } : { session, access, agent: null };
}

/** Autore delle operazioni e delle letture con il token tecnico, nel registro. */
export const agentActor = (agent: string) => `agent:${agent}`.slice(0, 128);

/** Lettura con il token tecnico: resta nel registro con l'etichetta del token. */
export async function recordAgentRead(agent: string, url: URL) {
  await recordAudit(env.DB, {
    actor: agentActor(agent),
    operation: "agent-read",
    target: `page:${url.pathname}`.slice(0, 256),
    outcome: "done",
  });
}

export async function loadSection(section: AdminSection, item: string | undefined, url: URL) {
  const now = new Date();
  const query = url.searchParams.get("q") ?? undefined;
  const offset = Math.max(0, Number(url.searchParams.get("da")) || 0);
  switch (section) {
    case "panoramica": {
      const [anomalies, summary, commerce, recent] = await Promise.all([
        listAnomalies(env.DB, now),
        consoleSummary(env.DB, now),
        commerceOverview(env, now),
        listAudit(env.DB, { limit: 5, changes: true }),
      ]);
      return {
        section,
        anomalies,
        summary,
        revenue: { last30: commerce.revenue.last30, total: commerce.revenue.total },
        seats: { available: commerce.seats.available, total: commerce.seats.total },
        recent,
      } as const;
    }
    case "account":
      return {
        section,
        query: query ?? "",
        offset,
        ...(await listAccounts(env.DB, { query, offset }, now)),
      } as const;
    case "spazi": {
      const workspace = item ? await workspaceDetail(env, item, now) : null;
      if (!workspace) throw data(null, { status: 404 });
      return {
        section,
        workspace,
        audit: await listAudit(env.DB, { target: `workspace:${workspace.id}`, limit: 20 }),
      } as const;
    }
    case "negozi": {
      const problems = url.searchParams.has("problemi");
      return {
        section,
        query: query ?? "",
        problems,
        offset,
        ...(await listAllStores(env.DB, { query, problems, offset }, now)),
      } as const;
    }
    case "lavori":
      return {
        section,
        tasks: await taskStates(env.DB, now),
        receipts: await receiptStates(env.DB, now),
      } as const;
    case "quote": {
      const quotas = await readEbayQuotas(env, fetch, now);
      return { section, quotas, anomalies: await quotaAnomalies(env.DB, now) } as const;
    }
    case "commerciale": {
      const [overview, prices] = await Promise.all([commerceOverview(env, now), checkPrices(env)]);
      return { section, ...overview, prices } as const;
    }
    case "antiabuso":
      return { section, signals: await listAbuseSignals(env.DB, now) } as const;
    case "comunicazioni":
      return { section, notices: await listServiceNotices(env.DB, now) } as const;
    case "registro":
      return { section, entries: await listAudit(env.DB, { limit: 200 }) } as const;
  }
}

export type SectionData = Awaited<ReturnType<typeof loadSection>>;

export type AdminActionResult = {
  ok: boolean;
  notice: string;
  /** Trasferimento preparato, da confermare. */
  transfer?: { id: string; summary: string };
};

const wallClocks = new Map<string, Intl.DateTimeFormat>();

/** Ora del muro nel fuso indicato, in millisecondi come se fosse UTC. */
function wallTime(at: number, timeZone: string) {
  let format = wallClocks.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    wallClocks.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(at)).map((part) => [part.type, part.value]),
  );
  return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
}

/** Ora locale del modulo, nel fuso della console, convertita in istante UTC. */
export function localInstant(value: string, timeZone = displayTimeZone): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  const wall = Date.UTC(year!, month! - 1, day, hour, minute);
  const offset = (at: number) => wallTime(at, timeZone) - at;
  // Due passaggi: il primo stima l'offset, il secondo lo corregge vicino al cambio d'ora.
  const first = wall - offset(wall);
  return new Date(wall - offset(first)).toISOString();
}

type Field = (name: string) => string;

/**
 * Oggetto del registro per un'operazione su un negozio: lo spazio è quello che lo possiede
 * adesso, riletto dal database, non quello indicato dal modulo.
 */
async function storeTarget(storeId: string) {
  const store = await env.DB.prepare("SELECT workspace_id FROM ebay_stores WHERE id = ?")
    .bind(storeId)
    .first<{ workspace_id: string }>();
  return store ? `workspace:${store.workspace_id}:store:${storeId}` : `store:${storeId}`;
}

/**
 * Esegue un'operazione e ne registra l'esito. Ogni ramo restituisce l'oggetto del registro,
 * l'esito tecnico e l'avviso; il motivo, dove serve, è obbligatorio.
 */
export async function runAdminAction(
  request: Request,
  actor: string,
  language: Language,
): Promise<AdminActionResult | ReturnType<typeof data>> {
  assertSameOrigin(request);
  const form = await request.formData();
  const field: Field = (name) => String(form.get(name) ?? "").trim();
  const intent = field("intent");
  const t = adminCopy[language];
  const now = new Date();
  const reason = reasonSchema.safeParse(field("motivo"));
  const audit = (target: string, outcome: string) =>
    recordAudit(
      env.DB,
      { actor, operation: intent, target, reason: reason.success ? reason.data : null, outcome },
      now,
    );
  const result = async (
    target: string,
    outcome: string,
    notice: string,
    ok = outcome === "done",
  ) => {
    await audit(target, outcome);
    return { ok, notice } satisfies AdminActionResult;
  };
  const invalid = () => data({ ok: false, notice: t.common.invalid }, { status: 400 });
  const needsReason = new Set([
    "grant-premium",
    "grant-lifetime",
    "grant-history",
    "revoke-history",
    "free-store",
    "store-pause",
    "store-resume",
    "record-erasure",
    "transfer-prepare",
    "save-promotion",
    "end-promotion",
    "schedule-quota",
    "review-abuse",
  ]);
  if (needsReason.has(intent) && !reason.success) return invalid();
  // Gli identificativi vengono dal modulo: oltre la lunghezza del registro non sono validi.
  if (
    [...form.keys()].some(
      (name) => name !== "motivo" && !name.startsWith("testo") && field(name).length > 128,
    )
  )
    return invalid();
  const why = reason.success ? reason.data : "";
  const date = (value: string) => formatDate(value, language);
  try {
    switch (intent) {
      case "grant-premium": {
        const workspaceId = field("spazio");
        const grant = await grantPremium(
          env,
          { workspaceId, author: actor, reason: why, days: Number(field("giorni")) },
          now,
        );
        const notices = t.results.grantPremium;
        return result(
          `workspace:${workspaceId}`,
          grant.result,
          grant.result === "done"
            ? notices.done(date(grant.endsAt))
            : grant.result === "lifetime"
              ? notices.lifetime
              : grant.result === "unavailable"
                ? notices.unavailable
                : grant.result === "invalid"
                  ? t.common.invalid
                  : t.common.notFound,
        );
      }
      case "grant-lifetime": {
        const workspaceId = field("spazio");
        const grant = await grantLifetimeConcession(
          env,
          { workspaceId, author: actor, reason: why },
          now,
        );
        return result(
          `workspace:${workspaceId}`,
          grant,
          grant === "invalid"
            ? t.common.invalid
            : grant === "not_found"
              ? t.common.notFound
              : t.results.grantLifetime[grant],
        );
      }
      case "grant-history": {
        const workspaceId = field("spazio");
        const grant = await grantHistoryExtension(
          env.DB,
          { workspaceId, months: Number(field("mesi")), author: actor, reason: why },
          now,
        );
        return result(
          `workspace:${workspaceId}`,
          grant,
          grant === "done"
            ? t.common.done
            : grant === "invalid"
              ? t.common.invalid
              : t.common.notFound,
        );
      }
      case "revoke-history": {
        const workspaceId = field("spazio");
        const revoked = await revokeHistoryExtension(
          env.DB,
          { workspaceId, extensionId: field("estensione") },
          now,
        );
        return result(
          `workspace:${workspaceId}`,
          revoked,
          revoked === "done" ? t.common.done : t.common.notFound,
        );
      }
      case "free-store": {
        const storeId = field("negozio");
        const choice = await assistFreeStore(env.DB, { storeId, actor, reason: why }, now);
        return result(
          await storeTarget(storeId),
          choice,
          choice === "not_found" ? t.common.notFound : t.results.freeStore[choice],
        );
      }
      case "store-sync": {
        const storeId = field("negozio");
        const sync = await requestStoreSync(env, null, storeId, {}, now);
        return result(
          await storeTarget(storeId),
          sync,
          sync === "not_found" ? t.common.notFound : t.results.sync[sync],
          sync === "queued" || sync === "merged",
        );
      }
      case "store-pause":
      case "store-resume": {
        const storeId = field("negozio");
        const pause = await setAdminPause(env.DB, storeId, intent === "store-pause", now);
        return result(
          await storeTarget(storeId),
          pause,
          pause === "not_found" ? t.common.notFound : t.results.pause[pause],
        );
      }
      case "retry-details": {
        const storeId = field("negozio");
        const count = await retryOrderDetails(env.DB, storeId, now);
        return result(await storeTarget(storeId), "done", t.results.details(count));
      }
      case "record-erasure": {
        const workspaceId = field("spazio");
        const erasure = await recordSupportErasure(
          env,
          { workspaceId, customerId: field("cliente"), actor, reason: why },
          fetch,
          now,
        );
        return result(
          `workspace:${workspaceId}`,
          erasure,
          erasure === "not_found" ? t.common.notFound : t.results.erasure[erasure],
        );
      }
      case "transfer-prepare": {
        const storeId = field("negozio");
        const prepared = await prepareStoreTransfer(
          env.DB,
          { storeId, toWorkspaceId: field("destinazione"), actor, reason: why },
          now,
        );
        const target = await storeTarget(storeId);
        if (prepared.result !== "prepared")
          return result(
            target,
            prepared.result,
            prepared.result === "not_found"
              ? t.common.notFound
              : t.results.transfer[prepared.result],
          );
        await audit(target, "prepared");
        return {
          ok: true,
          notice: "",
          transfer: {
            id: prepared.id,
            summary: t.workspace.transferSummary(
              prepared.preview.storeName,
              prepared.preview.toWorkspaceId,
              prepared.preview.orders,
              formatDate(prepared.expiresAt, language, "time"),
            ),
          },
        };
      }
      case "transfer-confirm": {
        const confirmed = await confirmStoreTransfer(
          env.DB,
          { id: field("trasferimento"), actor },
          now,
        );
        const target = confirmed.transfer
          ? `workspace:${confirmed.transfer.from}:store:${confirmed.transfer.storeId}`
          : `transfer:${field("trasferimento")}`;
        if (confirmed.transfer)
          await recordAudit(
            env.DB,
            {
              actor,
              operation: "transfer-received",
              target: `workspace:${confirmed.transfer.to}:store:${confirmed.transfer.storeId}`,
              outcome: "done",
            },
            now,
          );
        return result(target, confirmed.result, t.results.transfer[confirmed.result]);
      }
      case "requeue-task": {
        const task = field("lavoro");
        if (!isScheduledTask(task)) return invalid();
        const queued = await requeueTask(env, task, now);
        return result(`task:${task}`, queued, t.results.task[queued], queued === "queued");
      }
      case "resume-receipts": {
        const provider = field("provider");
        if (provider !== "ebay" && provider !== "stripe" && provider !== "telegram")
          return invalid();
        const count = await resumeStalledReceipts(env, provider, now);
        return result(`receipts:${provider}`, "done", t.results.receipts(count));
      }
      case "save-promotion": {
        const parsed = promotionSchema.safeParse({
          startsAt: localInstant(field("inizio")),
          endsAt: localInstant(field("fine")),
          quota: field("quota"),
        });
        if (!parsed.success) return invalid();
        const id = field("promozione") || undefined;
        const saved = await savePromotion(env.DB, { id, promotion: parsed.data }, now);
        return result(
          `promotion:${id ?? "new"}`,
          saved,
          saved === "not_found" ? t.common.notFound : t.results.promotion[saved],
        );
      }
      case "end-promotion": {
        const id = field("promozione");
        const ended = await endPromotion(env.DB, id, now);
        return result(
          `promotion:${id}`,
          ended,
          ended === "done" ? t.results.promotion.done : t.common.notFound,
        );
      }
      case "schedule-quota": {
        const parsed = quotaChangeSchema.safeParse({
          quota: field("quota"),
          effectiveAt: localInstant(field("decorrenza")),
        });
        if (!parsed.success) return invalid();
        const scheduled = await scheduleFreeQuota(
          env.DB,
          { ...parsed.data, actor, reason: why },
          now,
        );
        return result("free-quota", scheduled, t.results.quota[scheduled]);
      }
      case "save-notice": {
        const parsed = serviceNoticeSchema.safeParse({
          tone: field("tono"),
          titleIt: field("titolo_it"),
          bodyIt: field("testo_it"),
          titleEn: field("titolo_en"),
          bodyEn: field("testo_en"),
          startsAt: localInstant(field("inizio")),
          endsAt: localInstant(field("fine")),
        });
        if (!parsed.success) return invalid();
        const saved = await saveServiceNotice(
          env.DB,
          { id: field("comunicazione") || undefined, notice: parsed.data, actor },
          now,
        );
        return result(
          `notice:${saved.result === "done" ? saved.id : field("comunicazione") || "new"}`,
          saved.result,
          saved.result === "done"
            ? t.results.notice.done
            : saved.result === "invalid"
              ? t.common.invalid
              : t.common.notFound,
        );
      }
      case "withdraw-notice": {
        const id = field("comunicazione");
        const withdrawn = await withdrawServiceNotice(env.DB, id, now);
        return result(
          `notice:${id}`,
          withdrawn,
          withdrawn === "done" ? t.results.notice.withdrawn : t.common.notFound,
        );
      }
      case "review-abuse": {
        const outcome = field("esito");
        if (outcome !== "clear" && outcome !== "suspended") return invalid();
        const workspaceId = field("spazio") || undefined;
        const reviewed = await reviewAbuseSignal(
          env.DB,
          { key: field("segnalazione"), outcome, workspaceId, actor, reason: why },
          now,
        );
        return result(
          workspaceId ? `workspace:${workspaceId}` : `abuse:${field("segnalazione")}`,
          reviewed,
          reviewed === "not_found" ? t.common.notFound : t.results.abuse[reviewed],
        );
      }
      default:
        return invalid();
    }
  } catch (error) {
    logFailure({ request, error, operation: "admin" });
    await audit(intent, "failed").catch(() => {});
    return data({ ok: false, notice: t.common.failed }, { status: 500 });
  }
}
