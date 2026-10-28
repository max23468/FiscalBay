import { env } from "cloudflare:workers";
import { data } from "react-router";

import { assertSameOrigin } from "./account-area.server";
import { adminCopy, type AdminCopy, type AuditOutcome } from "./copy/admin-copy";
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
import { metricWindowFrom, productMetrics } from "./domain/product-metrics.server";
import { readTechnicalMetrics } from "./domain/technical-metrics.server";
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
import {
  admitWorkspace,
  isSwitchName,
  setQuotaAttention,
  setSwitch,
  switchboard,
} from "./domain/service-settings.server";
import { confirmStoreTransfer, prepareStoreTransfer } from "./domain/store-transfer.server";
import { setAdminPause } from "./domain/stores.server";
import { logFailure } from "./errors";
import { displayTimeZone, formatDate } from "./format";
import type { Language } from "./i18n";
import { sha256Hex } from "./sealed.server";
import { wallInstant } from "./time";
import { resumeStalledReceipts } from "./webhooks.server";

/**
 * Console amministrativa (§15): sezioni, letture e operazioni. Ogni richiesta rilegge la
 * sessione e il ruolo dal database; chi non è admin riceve la stessa risposta di un indirizzo
 * inesistente, e senza la conferma con passkey le sezioni non si caricano. Ogni operazione è
 * nell'elenco qui sotto, rilegge lo stato al momento dell'esecuzione e lascia autore, motivo ed
 * esito nel registro: non esiste un accesso generico ai dati.
 */

export const adminSections = [
  "metriche",
  "account",
  "spazi",
  "negozi",
  "lavori",
  "quote",
  "prestazioni",
  "commerciale",
  "antiabuso",
  "comunicazioni",
  "interruttori",
  "registro",
] as const;

export type AdminSection = (typeof adminSections)[number] | "panoramica";

export function sectionFrom(value: string | undefined): AdminSection | null {
  if (!value) return "panoramica";
  return (adminSections as readonly string[]).includes(value) ? (value as AdminSection) : null;
}

/** Prefisso dei token tecnici della console, riconoscibile in un'eventuale fuga. */
const agentTokenPrefix = "fbat_";

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
    .bind(await sha256Hex(token), now.toISOString())
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
      const [anomalies, summary, commerce, recent, tasks] = await Promise.all([
        listAnomalies(env.DB, now),
        consoleSummary(env.DB, now),
        commerceOverview(env, now),
        listAudit(env.DB, { limit: 5, changes: true }),
        taskStates(env.DB, now),
      ]);
      return {
        section,
        anomalies,
        summary,
        revenue: { last30: commerce.revenue.last30, total: commerce.revenue.total },
        seats: { available: commerce.seats.available, total: commerce.seats.total },
        tasks: {
          regular: tasks.filter((task) => !task.stalled).length,
          total: tasks.length,
        },
        recent,
      } as const;
    }
    case "metriche":
      return {
        section,
        metrics: await productMetrics(env, metricWindowFrom(url.searchParams.get("giorni")), now),
      } as const;
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
    case "prestazioni":
      return { section, performance: await readTechnicalMetrics(env, fetch) } as const;
    case "commerciale": {
      const [overview, prices] = await Promise.all([commerceOverview(env, now), checkPrices(env)]);
      return { section, ...overview, prices } as const;
    }
    case "antiabuso":
      return { section, signals: await listAbuseSignals(env.DB, now) } as const;
    case "comunicazioni":
      return { section, notices: await listServiceNotices(env.DB, now) } as const;
    case "interruttori":
      return { section, ...(await switchboard(env.DB)) } as const;
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

/** Ora locale del modulo, nel fuso della console, convertita in istante UTC. */
export function localInstant(value: string, timeZone = displayTimeZone): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  return wallInstant(Date.UTC(year!, month! - 1, day, hour, minute), timeZone).toISOString();
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

/** Campi del modulo che indicano l'oggetto dell'operazione, con il prefisso del registro. */
const targetFields = [
  ["spazio", "workspace"],
  ["trasferimento", "transfer"],
  ["lavoro", "task"],
  ["provider", "receipts"],
  ["promozione", "promotion"],
  ["comunicazione", "notice"],
  ["segnalazione", "abuse"],
] as const;

/**
 * Oggetto indicato dal modulo, per i rifiuti e gli errori che arrivano prima dell'esito
 * dell'operazione; null se il modulo non ne indica uno valido.
 */
async function formTarget(intent: string, field: Field) {
  const id = (name: string) => {
    const value = field(name);
    return value && value.length <= 128 ? value : null;
  };
  if (intent === "schedule-quota") return "free-quota";
  if (intent === "quota-attention") return `setting:quota_attention:${id("soglia") ?? ""}`;
  if (intent === "set-switch" && id("interruttore"))
    return `switch:${id("interruttore")}${id("stato") ? `:${id("stato")}` : ""}`;
  const store = id("negozio");
  if (store) return storeTarget(store);
  for (const [name, kind] of targetFields) {
    const value = id(name);
    if (value) return `${kind}:${value}`;
  }
  return null;
}

/** Contesto di un'operazione della console: modulo, autore, motivo e scrittura dell'esito. */
type ActionContext = {
  field: Field;
  actor: string;
  /** Motivo validato, vuoto dove non serve. */
  why: string;
  now: Date;
  language: Language;
  t: AdminCopy;
  date: (value: string) => string;
  result: (
    target: string,
    outcome: AuditOutcome,
    notice: string,
    ok?: boolean,
  ) => Promise<AdminActionResult>;
  audit: (target: string | null, outcome: AuditOutcome, operation?: string) => Promise<void>;
  invalid: () => Promise<ReturnType<typeof data>>;
  refuse: (outcome: AuditOutcome) => Promise<ReturnType<typeof data>>;
};

/** Operazione della console: se chiede il motivo e cosa fa. */
type AdminAction = {
  needsReason: boolean;
  run: (context: ActionContext) => Promise<AdminActionResult | ReturnType<typeof data>>;
};

/** Pausa manuale di un negozio, messa o tolta. */
const storePause = (paused: boolean): AdminAction => ({
  needsReason: true,
  run: async ({ field, now, t, result }) => {
    const storeId = field("negozio");
    const pause = await setAdminPause(env.DB, storeId, paused, now);
    return result(
      await storeTarget(storeId),
      pause,
      pause === "not_found" ? t.common.notFound : t.results.pause[pause],
    );
  },
});

const adminActions: Record<string, AdminAction> = {
  "grant-premium": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, date, result }) => {
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
    },
  },
  "grant-lifetime": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result }) => {
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
    },
  },
  "grant-history": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result }) => {
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
    },
  },
  "revoke-history": {
    needsReason: true,
    run: async ({ field, now, t, result }) => {
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
    },
  },
  "free-store": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result }) => {
      const storeId = field("negozio");
      const choice = await assistFreeStore(env.DB, { storeId, actor, reason: why }, now);
      return result(
        await storeTarget(storeId),
        choice,
        choice === "not_found" ? t.common.notFound : t.results.freeStore[choice],
      );
    },
  },
  "store-sync": {
    needsReason: false,
    run: async ({ field, now, t, result }) => {
      const storeId = field("negozio");
      const sync = await requestStoreSync(env, null, storeId, {}, now);
      return result(
        await storeTarget(storeId),
        sync,
        sync === "not_found" ? t.common.notFound : t.results.sync[sync],
        sync === "queued" || sync === "merged",
      );
    },
  },
  "store-pause": storePause(true),
  "store-resume": storePause(false),
  "retry-details": {
    needsReason: false,
    run: async ({ field, now, t, result }) => {
      const storeId = field("negozio");
      const count = await retryOrderDetails(env.DB, storeId, now);
      return result(await storeTarget(storeId), "done", t.results.details(count));
    },
  },
  "record-erasure": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result }) => {
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
    },
  },
  "transfer-prepare": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result, audit, language }) => {
      const storeId = field("negozio");
      const [prepared, target] = await Promise.all([
        prepareStoreTransfer(
          env.DB,
          { storeId, toWorkspaceId: field("destinazione"), actor, reason: why },
          now,
        ),
        storeTarget(storeId),
      ]);
      if (prepared.result !== "prepared")
        return result(
          target,
          prepared.result,
          prepared.result === "not_found" ? t.common.notFound : t.results.transfer[prepared.result],
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
    },
  },
  "transfer-confirm": {
    needsReason: false,
    run: async ({ field, actor, now, t, result, audit }) => {
      const confirmed = await confirmStoreTransfer(env, { id: field("trasferimento"), actor }, now);
      const target = confirmed.transfer
        ? `workspace:${confirmed.transfer.from}:store:${confirmed.transfer.storeId}`
        : `transfer:${field("trasferimento")}`;
      if (confirmed.transfer)
        await audit(
          `workspace:${confirmed.transfer.to}:store:${confirmed.transfer.storeId}`,
          "done",
          "transfer-received",
        );
      return result(target, confirmed.result, t.results.transfer[confirmed.result]);
    },
  },
  "requeue-task": {
    needsReason: false,
    run: async ({ field, now, t, result, invalid }) => {
      const task = field("lavoro");
      if (!isScheduledTask(task)) return invalid();
      const queued = await requeueTask(env, task, now);
      return result(`task:${task}`, queued, t.results.task[queued], queued === "queued");
    },
  },
  "resume-receipts": {
    needsReason: false,
    run: async ({ field, now, t, result, invalid }) => {
      const provider = field("provider");
      if (provider !== "ebay" && provider !== "stripe" && provider !== "telegram") return invalid();
      const count = await resumeStalledReceipts(env, provider, now);
      return result(`receipts:${provider}`, "done", t.results.receipts(count));
    },
  },
  "save-promotion": {
    needsReason: true,
    run: async ({ field, now, t, result, invalid }) => {
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
    },
  },
  "end-promotion": {
    needsReason: true,
    run: async ({ field, now, t, result }) => {
      const id = field("promozione");
      const ended = await endPromotion(env.DB, id, now);
      return result(
        `promotion:${id}`,
        ended,
        ended === "done" ? t.results.promotion.done : t.common.notFound,
      );
    },
  },
  "schedule-quota": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result, invalid }) => {
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
    },
  },
  "save-notice": {
    needsReason: false,
    run: async ({ field, actor, now, t, result, invalid }) => {
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
    },
  },
  "withdraw-notice": {
    needsReason: false,
    run: async ({ field, now, t, result }) => {
      const id = field("comunicazione");
      const withdrawn = await withdrawServiceNotice(env.DB, id, now);
      return result(
        `notice:${id}`,
        withdrawn,
        withdrawn === "done" ? t.results.notice.withdrawn : t.common.notFound,
      );
    },
  },
  "review-abuse": {
    needsReason: true,
    run: async ({ field, actor, why, now, t, result, invalid }) => {
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
    },
  },
  "set-switch": {
    needsReason: true,
    run: async ({ field, now, t, result, invalid }) => {
      const name = field("interruttore");
      const state = field("stato");
      if (!isSwitchName(name) || (state !== "on" && state !== "off")) return invalid();
      const changed = await setSwitch(env.DB, name, state === "on", now);
      return result(
        `switch:${name}:${state}`,
        changed,
        changed === "done" ? t.common.done : t.results.unchanged,
      );
    },
  },
  "quota-attention": {
    needsReason: true,
    run: async ({ field, now, t, result, refuse }) => {
      const saved = await setQuotaAttention(env.DB, Number(field("soglia")), now);
      if (saved === "invalid") return refuse("out_of_range");
      return result(
        `setting:quota_attention:${field("soglia")}`,
        saved,
        saved === "done" ? t.common.done : t.results.unchanged,
      );
    },
  },
  "admit-waitlisted": {
    needsReason: true,
    run: async ({ field, t, result }) => {
      const workspaceId = field("spazio");
      const admitted = await admitWorkspace(env.DB, workspaceId);
      return result(
        `workspace:${workspaceId}`,
        admitted,
        admitted === "done" ? t.results.admitted : t.results.notWaiting,
      );
    },
  },
};

/**
 * Esegue un'operazione e ne registra l'esito. Ogni ramo restituisce l'oggetto del registro,
 * l'esito tecnico e l'avviso; il motivo, dove serve, è obbligatorio. Anche i rifiuti decisi dal
 * modulo, come il motivo mancante o l'origine estranea, lasciano la loro riga.
 */
export async function runAdminAction(
  request: Request,
  actor: string,
  language: Language,
): Promise<AdminActionResult | ReturnType<typeof data>> {
  // Un corpo che non è un modulo vale come modulo vuoto: un'operazione sconosciuta.
  const form = await request.formData().catch(() => new FormData());
  const field: Field = (name) => String(form.get(name) ?? "").trim();
  const intent = field("intent");
  const t = adminCopy[language];
  const now = new Date();
  const reason = reasonSchema.safeParse(field("motivo"));
  /**
   * Riga del registro. L'operazione è già avvenuta: un errore della scrittura si riprova una
   * volta, poi resta nei log senza cambiare la risposta, che riflette l'esito reale.
   */
  const audit = async (
    target: string | null,
    outcome: AuditOutcome,
    operation = intent.slice(0, 64) || "unknown",
  ) => {
    const entry = {
      actor,
      operation,
      target,
      reason: reason.success ? reason.data : null,
      outcome,
    };
    try {
      await recordAudit(env.DB, entry, now);
    } catch {
      await recordAudit(env.DB, entry, now).catch((error: unknown) =>
        logFailure({ request, error, operation: "admin" }),
      );
    }
  };
  const result = async (
    target: string,
    outcome: AuditOutcome,
    notice: string,
    ok = outcome === "done",
  ) => {
    await audit(target, outcome);
    return { ok, notice } satisfies AdminActionResult;
  };
  /** Rifiuto deciso dal modulo, registrato con l'oggetto indicato quando è valido. */
  const refuse = async (outcome: AuditOutcome) => {
    await audit(await formTarget(intent, field), outcome);
    return data({ ok: false, notice: t.common.invalid }, { status: 400 });
  };
  const invalid = () => refuse("invalid");
  try {
    assertSameOrigin(request);
  } catch (error) {
    await audit(await formTarget(intent, field), "foreign_origin");
    throw error;
  }
  const action = Object.hasOwn(adminActions, intent) ? adminActions[intent] : undefined;
  if (action?.needsReason && !reason.success) return refuse("reason_required");
  // Gli identificativi vengono dal modulo: oltre la lunghezza del registro non sono validi.
  if (
    [...form.keys()].some(
      (name) => name !== "motivo" && !name.startsWith("testo") && field(name).length > 128,
    )
  )
    return refuse("too_long");
  const why = reason.success ? reason.data : "";
  const date = (value: string) => formatDate(value, language);
  try {
    if (!action) return refuse("unknown_intent");
    return await action.run({
      field,
      actor,
      why,
      now,
      language,
      t,
      date,
      result,
      audit,
      invalid,
      refuse,
    });
  } catch (error) {
    logFailure({ request, error, operation: "admin" });
    await audit(await formTarget(intent, field).catch(() => null), "failed");
    return data({ ok: false, notice: t.common.failed }, { status: 500 });
  }
}
