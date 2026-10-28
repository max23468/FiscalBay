import { originUrl } from "../app-links";
import { botCommands, ownerCommands, type BotCommand, type OwnerCommand } from "../bot-commands";
import { adminCopy } from "../copy/admin-copy";
import { ownerTelegramCopy as copy } from "../copy/owner-telegram";
import { telegramBotCopy } from "../copy/telegram";
import { formatAmount } from "../i18n";
import {
  answerCallback,
  editRichMessage,
  ownerCallbackPrefix,
  ownerChatId,
  sendPreformatted,
  setOwnerCommands,
  telegramConfigured,
  webhookInfo,
  type BotButton,
} from "../integrations/telegram.server";
import { checkPrices, commerceOverview } from "./admin-commerce.server";
import { consoleSummary, listAllStores } from "./admin-directory.server";
import { listAnomalies, receiptStates, taskStates } from "./admin-operations.server";
import { bulkDataAnomalies, quotaAnomalies, readEbayQuotas } from "./ebay-quotas.server";
import { recentIncidents, subjectsLine } from "./owner-incidents.server";
import {
  at,
  capped,
  duration,
  environmentName,
  ownerCallback,
  panelRejected,
  plainText,
  richMessage,
  sendPanel,
  type Panel,
  type Row,
  type Section,
} from "./owner-panels.server";
import { metricWindows, productMetrics, type MetricWindow } from "./product-metrics.server";
import { readTechnicalMetrics } from "./technical-metrics.server";

/**
 * Control Center Telegram dell'owner (§15, D198). Sul bot dell'ambiente, nella sola chat
 * privata dell'owner, comandi e pulsanti di sola lettura mostrano le stesse viste della console
 * con le stesse query; i pulsanti aggiornano lo stesso messaggio e «Copia» invia la vista come
 * testo copiabile. Nessun dato dei buyer, nessuna email: soltanto aggregati, stati ed etichette
 * dei negozi. Le operazioni restano nella console, raggiungibile dal pulsante di ogni vista.
 */

const t = adminCopy.it;

/**
 * Vista chiesta: argomento numerico per finestra delle metriche o pagina dei negozi; `copy` la
 * invia come testo, `fresh` in un nuovo messaggio, come dal pulsante di un avviso.
 */
export type OwnerAction = { view: OwnerCommand; arg: number; copy: boolean; fresh?: boolean };

/** Negozi con problemi per pagina. */
const storesPage = 8;

/** Sezione della console corrispondente a ogni vista. */
const consoleSection: Record<OwnerCommand, string> = {
  console: "",
  incidenti: "",
  lavori: "lavori",
  quote: "quote",
  commerciale: "commerciale",
  metriche: "metriche",
  negozi: "negozi?problemi",
  prestazioni: "prestazioni",
  versione: "",
};

/** Vista di un pulsante dell'owner; null per dati di un'altra forma, che non hanno effetto. */
export function parseOwnerCallback(data: string): OwnerAction | null {
  if (!data.startsWith(ownerCallbackPrefix)) return null;
  const [view, argText, flag, ...rest] = data.slice(ownerCallbackPrefix.length).split(":");
  const command = ownerCommands.find((name) => name === view);
  const arg = Number(argText);
  if (!command || rest.length > 0 || (flag !== undefined && flag !== "c" && flag !== "n"))
    return null;
  if (!/^\d{1,4}$/u.test(argText ?? "") || !validArg(command, arg)) return null;
  return flag === "n"
    ? { view: command, arg, copy: false, fresh: true }
    : { view: command, arg, copy: flag === "c" };
}

function validArg(view: OwnerCommand, arg: number) {
  if (view === "metriche") return (metricWindows as readonly number[]).includes(arg) || arg === 0;
  if (view === "negozi") return arg % storesPage === 0;
  return arg === 0;
}

/** Finestra delle metriche: 30 giorni come nella console, se non scelta. */
const windowOf = (arg: number): MetricWindow =>
  (metricWindows as readonly number[]).includes(arg) ? (arg as MetricWindow) : 30;

export type OwnerReceipt = {
  topic: string;
  chatId: string;
  command: string | null;
  callbackId: string | null;
  messageId: number | null;
};

/**
 * Effetto di un comando o di un pulsante dell'owner ricevuto dal webhook. L'identità si rilegge
 * dalla configurazione corrente: un aggiornamento accettato prima di un cambio non vale più.
 * Il comando apre la vista in un nuovo messaggio, il pulsante la scrive nello stesso, e un
 * messaggio non più modificabile lascia il posto a uno nuovo.
 */
export async function consumeOwnerUpdate(
  env: Env,
  update: OwnerReceipt,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const owner = ownerChatId(env);
  if (!owner || update.chatId !== owner || !telegramConfigured(env)) return;
  if (update.callbackId)
    await answerCallback(env, update.callbackId, undefined, fetcher).catch(() => undefined);
  const view = ownerCommands.find((name) => name === update.command);
  const action = view ? { view, arg: 0, copy: false } : parseOwnerCallback(update.command ?? "");
  if (!action) return;
  const panel = await ownerPanel(env, action, fetcher, now);
  if (action.copy) return sendPreformatted(env, owner, plainText(env, panel, now), fetcher);
  const shown = withControls(env, panel, action);
  if (update.topic === "owner_callback" && update.messageId !== null && !action.fresh) {
    // Un pannello rifiutato per la sua forma parte come nuovo messaggio, con la stessa regola.
    const edited = await editRichMessage(
      env,
      owner,
      update.messageId,
      richMessage(env, shown, now),
      fetcher,
    ).catch((error: unknown) => {
      if (panelRejected(error)) return "gone" as const;
      throw error;
    });
    if (edited === "edited") return;
  }
  await sendPanel(env, owner, shown, now, fetcher);
}

/** Pulsanti comuni in fondo a ogni vista: aggiorna, copia, console e ritorno alla panoramica. */
function withControls(env: Env, panel: Panel, action: OwnerAction): Panel {
  const section = consoleSection[action.view];
  return {
    ...panel,
    buttons: [
      ...(panel.buttons ?? []),
      [
        { text: copy.refresh, callback_data: ownerCallback(action.view, action.arg) },
        { text: copy.copy, callback_data: ownerCallback(action.view, action.arg, "c") },
      ],
      [
        ...(action.view === "console"
          ? []
          : [{ text: copy.back, callback_data: ownerCallback("console") }]),
        { text: copy.openConsole, url: originUrl(env, `/admin${section ? `/${section}` : ""}`) },
      ],
    ],
  };
}

/** Navigazione della panoramica, due viste per riga. */
function navigation(): BotButton[][] {
  const views = ownerCommands.filter((view) => view !== "console");
  const rows: BotButton[][] = [];
  for (let index = 0; index < views.length; index += 2)
    rows.push(
      views
        .slice(index, index + 2)
        .map((view) => ({ text: copy.views[view], callback_data: ownerCallback(view) })),
    );
  return rows;
}

const euro = (cents: number) => formatAmount(cents, "EUR", "it");
const percentFormat = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});
const percent = (share: number | null) =>
  share === null ? t.metrics.none : percentFormat.format(share);
const share = (count: number, of: number) => (of > 0 ? count / of : null);

/** Vista richiesta, letta come nella console. */
export async function ownerPanel(
  env: Env,
  action: OwnerAction,
  fetcher: typeof fetch,
  now: Date,
): Promise<Panel> {
  switch (action.view) {
    case "console":
      return consolePanel(env, now);
    case "incidenti":
      return incidentsPanel(env, now);
    case "lavori":
      return jobsPanel(env, fetcher, now);
    case "quote":
      return quotasPanel(env, fetcher, now);
    case "commerciale":
      return commercePanel(env, fetcher, now);
    case "metriche":
      return metricsPanel(env, windowOf(action.arg), now);
    case "negozi":
      return storesPanel(env, action.arg, now);
    case "prestazioni":
      return performancePanel(env, fetcher);
    case "versione":
      return versionPanel(env);
  }
}

async function consolePanel(env: Env, now: Date): Promise<Panel> {
  const [anomalies, summary, commerce, tasks] = await Promise.all([
    listAnomalies(env.DB, now),
    consoleSummary(env.DB, now),
    commerceOverview(env, now),
    taskStates(env.DB, now),
  ]);
  const count = (severity: "p1" | "p2" | "p3") =>
    anomalies.filter((anomaly) => anomaly.severity === severity).length;
  return {
    title: `🧭 ${copy.title(environmentName(env))}`,
    lead:
      anomalies.length === 0
        ? `${copy.resolvedIcon} ${copy.allClear}`
        : `${copy.severityIcon[anomalies[0]!.severity]} ${t.summary.issues(anomalies.length)} · ${copy.bySeverity(count("p1"), count("p2"), count("p3"))}`,
    sections: [
      {
        title: `👤 ${copy.accounts}`,
        rows: [
          [t.summary.accounts, String(summary.users)],
          [copy.waitlisted, String(summary.waitlisted)],
        ],
      },
      {
        title: `⭐ ${copy.coverage}`,
        rows: [
          [t.coverage.premium, String(summary.coverage.premium)],
          [t.coverage.lifetime, String(summary.coverage.lifetime)],
          [t.coverage.trial, String(summary.coverage.trial)],
          [t.coverage.admin, String(summary.coverage.admin)],
        ],
      },
      {
        title: `🏪 ${copy.stores}`,
        rows: [
          [copy.activeStores, String(summary.stores.active)],
          [copy.problemStores, String(summary.stores.problems)],
        ],
      },
      {
        title: `💶 ${copy.revenue}`,
        rows: [
          [t.commerce.last30, euro(commerce.revenue.last30)],
          [t.commerce.total, euro(commerce.revenue.total)],
          [copy.lifetime, copy.lifetimeLeft(commerce.seats.available, commerce.seats.total)],
        ],
      },
      {
        title: `⚙️ ${copy.jobs}`,
        rows: [
          [
            t.summary.jobs,
            copy.jobsRegular(tasks.filter((task) => !task.stalled).length, tasks.length),
          ],
        ],
      },
    ],
    buttons: navigation(),
  };
}

async function incidentsPanel(env: Env, now: Date): Promise<Panel> {
  const [anomalies, recent] = await Promise.all([
    listAnomalies(env.DB, now),
    recentIncidents(env.DB, now),
  ]);
  const open: Row[] = anomalies.map((anomaly) => [
    `${copy.severityIcon[anomaly.severity]} ${t.overview.kinds[anomaly.kind].title}`,
    [
      t.severity[anomaly.severity],
      copy.since(at(anomaly.since)),
      ...(anomaly.count > 1 ? [t.overview.count(anomaly.count)] : []),
      subjectsLine(
        anomaly.kind,
        anomaly.subjects.map((subject) => subject.label),
      ),
    ].join(" · "),
  ]);
  return {
    title: copy.views.incidenti,
    lead: anomalies.length === 0 ? `${copy.resolvedIcon} ${copy.allClear}` : undefined,
    sections: [
      { title: copy.open, rows: capped(open) },
      {
        title: copy.resolvedRecently,
        rows: capped(
          recent.map((incident) => [
            `${copy.resolvedIcon} ${t.overview.kinds[incident.kind].title}`,
            `${at(incident.resolvedAt)} · ${copy.duration.toLowerCase()} ${duration(incident.openedAt, incident.resolvedAt)}`,
          ]),
        ),
      },
    ],
  };
}

async function jobsPanel(env: Env, fetcher: typeof fetch, now: Date): Promise<Panel> {
  const [tasks, receipts, webhook] = await Promise.all([
    taskStates(env.DB, now),
    receiptStates(env.DB, now),
    telegramConfigured(env) ? webhookInfo(env, fetcher).catch(() => null) : null,
  ]);
  const expected = originUrl(env, "/webhooks/telegram");
  const webhookRows: Row[] = webhook
    ? [
        [
          copy.webhookUrl,
          webhook.url === expected ? copy.expected : webhook.url ? copy.different : copy.missing,
        ],
        [copy.webhookUpdates, webhook.allowedUpdates.join(", ") || "tutti"],
        [copy.webhookPending, String(webhook.pending)],
        [copy.webhookError, webhook.lastErrorAt ? at(webhook.lastErrorAt) : copy.none],
      ]
    : [[copy.state, copy.unavailable]];
  return {
    title: copy.views.lavori,
    sections: [
      {
        title: copy.jobs,
        rows: tasks.map((task) => [
          t.labels.tasks[task.task],
          task.running
            ? copy.task.running
            : task.stalled
              ? copy.task.stalled
              : task.doneAt
                ? copy.task.done(at(task.doneAt))
                : copy.task.waiting,
        ]),
      },
      {
        title: copy.receipts,
        rows: receipts.map((receipt) => [
          t.labels.providers[receipt.provider],
          [
            copy.receiptState(receipt.pending, receipt.stalled),
            ...(receipt.oldest ? [copy.since(at(receipt.oldest))] : []),
          ].join(" · "),
        ]),
      },
      { title: copy.webhook, rows: webhookRows },
    ],
  };
}

async function quotasPanel(env: Env, fetcher: typeof fetch, now: Date): Promise<Panel> {
  // La lettura aggiorna le anomalie come la sezione della console: le anomalie si leggono dopo.
  const [quotas, anomalies, bulk] = await readEbayQuotas(env, fetcher, now).then((read) =>
    Promise.all([read, quotaAnomalies(env.DB, now), bulkDataAnomalies(env.DB, now)] as const),
  );
  const sections: Section[] = quotas.map((environment) => {
    const name = t.quotas.environment[environment.environment];
    if (environment.read === "failed")
      return { title: `📊 ${name}`, rows: [[copy.state, copy.unavailable]] };
    const shown = environment.rows.filter((row) => row.used || row.over);
    const rows: Row[] = shown.map((row) => [
      `${row.api} · ${row.resource.split(".").at(-1)}`,
      [
        copy.quotas.used(row.rate.consumed, row.rate.limit, percent(row.share)),
        t.quotas.window(row.rate.windowSeconds),
        ...(row.rate.resetAt ? [copy.quotas.reset(at(row.rate.resetAt))] : []),
        ...(row.over ? [copy.quotas.over] : []),
      ].join(" · "),
    ]);
    for (const suspension of environment.suspended)
      rows.push([
        `⏸ ${t.quotas.suspended}`,
        `${suspension.call ?? t.quotas.allCalls} · ${t.quotas.until(at(suspension.until))}`,
      ]);
    return {
      title: `📊 ${name}`,
      rows: rows.length ? capped(rows) : [[copy.state, copy.quotas.noRows]],
    };
  });
  return {
    title: copy.views.quote,
    sections: [
      ...sections,
      {
        title: t.quotas.anomalies,
        rows: capped(
          anomalies.map((anomaly) => [
            `${anomaly.resolvedAt ? copy.resolvedIcon : copy.severityIcon[anomaly.severity]} ${anomaly.subject}`,
            anomaly.resolvedAt
              ? t.quotas.resolved(at(anomaly.resolvedAt))
              : `${percent(anomaly.share)} · ${copy.since(at(anomaly.openedAt))}`,
          ]),
        ),
      },
      {
        title: copy.bulkData,
        rows: bulk.map((anomaly) => [
          `${copy.severityIcon[anomaly.severity]} ${anomaly.subject}`,
          copy.since(at(anomaly.openedAt)),
        ]),
      },
    ],
    note: anomalies.some((anomaly) => !anomaly.resolvedAt) ? t.quotas.request : undefined,
  };
}

async function commercePanel(env: Env, fetcher: typeof fetch, now: Date): Promise<Panel> {
  const [overview, prices] = await Promise.all([
    commerceOverview(env, now),
    checkPrices(env, fetcher),
  ]);
  const { seats, revenue, promotions, quota } = overview;
  return {
    title: copy.views.commerciale,
    sections: [
      {
        title: t.commerce.revenue,
        rows: [
          [t.commerce.last30, euro(revenue.last30)],
          [t.commerce.total, euro(revenue.total)],
          [t.commerce.refundedTotal, euro(revenue.refunded)],
        ],
      },
      {
        title: copy.lifetime,
        rows: [
          [t.summary.seats, copy.lifetimeLeft(seats.available, seats.total)],
          [t.commerce.seats, copy.commerce.seatsTaken(seats.sold, seats.gifted, seats.reserved)],
          ...(seats.refunded > 0
            ? [
                [
                  t.commerce.reversals,
                  t.commerce.refundedNote(seats.refunded, seats.regranted),
                ] as Row,
              ]
            : []),
        ],
      },
      {
        title: `${t.commerce.prices} · ${t.commerce.generation(overview.generation)}`,
        rows: prices.map((price) => [
          t.commerce.offer[price.offer],
          `${euro(price.net)} · ${t.commerce.priceState[price.state]}`,
        ]),
      },
      {
        title: t.commerce.quota,
        rows: [
          [t.commerce.quotaValue, t.commerce.quotaCurrent(quota.quota)],
          ...(quota.next
            ? [
                [
                  t.commerce.effectiveAt,
                  t.commerce.quotaNext(quota.next.quota, at(quota.next.effectiveAt)),
                ] as Row,
              ]
            : []),
        ],
      },
      {
        title: t.commerce.promotions,
        rows: promotions.length
          ? capped(
              promotions.map((promotion) => [
                Date.parse(promotion.endsAt) <= now.getTime() ? "⚪" : "🟢",
                copy.commerce.promotion(
                  at(promotion.startsAt),
                  at(promotion.endsAt),
                  promotion.quota,
                ),
              ]),
            )
          : [[copy.state, copy.commerce.noPromotions]],
      },
    ],
  };
}

async function metricsPanel(env: Env, days: MetricWindow, now: Date): Promise<Panel> {
  const metrics = await productMetrics(env, days, now);
  const m = t.metrics;
  const { funnel, commerce, reads, lag, spaces, freeQuota, capacity } = metrics;
  const megabytes = (bytes: number) => `${Math.round(bytes / 1024 ** 2)} MB`;
  return {
    title: `${copy.views.metriche} · ${copy.metrics.window(days)}`,
    lead: m.funnelNote,
    sections: [
      {
        title: m.funnel,
        rows: funnel.steps.map((step) => [
          m.steps[step.step],
          [
            String(step.count),
            ...(step.after ? [`${percent(share(step.count, step.of))} di ${step.of}`] : []),
            ...(step.medianHours === null ? [] : [m.hours(step.medianHours)]),
          ].join(" · "),
        ]),
      },
      {
        title: m.commerce,
        rows: [
          [
            m.paying,
            `${commerce.paying} · ${m.payingNote(commerce.subscriptions.monthly, commerce.subscriptions.annual, commerce.lifetimePaid)}`,
          ],
          [m.mrr, euro(commerce.mrr)],
          [m.trialsOpen, String(commerce.trialsOpen)],
          [
            m.gifts,
            `${commerce.lifetimeGifted + commerce.granted} · ${m.giftsNote(commerce.lifetimeGifted, commerce.granted)}`,
          ],
          [m.cancelling, String(commerce.subscriptions.cancelling)],
          [
            m.trialConversion,
            `${percent(share(commerce.trials.converted, commerce.trials.ended))} · ${m.trialConversionNote(commerce.trials.converted, commerce.trials.ended)}`,
          ],
          [
            m.purchases,
            `${commerce.purchases.total} · ${m.purchasesNote(commerce.purchases.afterTrial, commerce.purchases.total - commerce.purchases.afterTrial)}`,
          ],
          [m.cash, `${euro(commerce.cash.paid)} · ${m.cashNote(euro(commerce.cash.refunded))}`],
        ],
      },
      {
        title: m.activity,
        rows: [
          [m.operative, String(spaces.operative)],
          [m.active, String(spaces.active)],
          [
            m.errorRate,
            `${percent(reads.errorRate)} · ${m.errorRateNote(reads.failures, reads.attempts)}`,
          ],
          [
            m.lag,
            `${lag.medianMinutes === null ? m.none : m.minutes(lag.medianMinutes)} · ${m.lagNote(lag.late, lag.stores - lag.neverRead, lag.targetMinutes)}`,
          ],
          [
            m.freeQuota,
            `${percent(share(freeQuota.used, freeQuota.quota))} · ${m.freeQuotaNote(freeQuota.used, freeQuota.quota, freeQuota.exhausted)}`,
          ],
        ],
      },
      {
        title: m.capacity,
        rows: [
          [
            m.database,
            `${capacity.databaseBytes === null ? m.none : megabytes(capacity.databaseBytes)} · ${m.databaseNote(megabytes(capacity.databaseBudget))}`,
          ],
          [m.stores, `${capacity.readingStores} · ${m.storesNote(capacity.referenceStores)}`],
          [
            m.readsPerDay,
            reads.days > 0 ? String(Math.round(reads.attempts / reads.days)) : m.none,
          ],
        ],
      },
    ],
    buttons: [
      metricWindows.map((window) => ({
        text: `${window === days ? "●" : "○"} ${m.days(window)}`,
        callback_data: ownerCallback("metriche", window),
      })),
    ],
  };
}

async function storesPanel(env: Env, offset: number, now: Date): Promise<Panel> {
  const [summary, problems] = await Promise.all([
    consoleSummary(env.DB, now),
    listAllStores(env.DB, { problems: true, offset }, now),
  ]);
  // La console mostra cinquanta negozi per pagina; il bot ne mostra otto.
  const rows = problems.rows.slice(0, storesPage);
  const more = problems.rows.length > storesPage || problems.more;
  return {
    title: copy.views.negozi,
    sections: [
      {
        title: copy.stores,
        rows: [
          [copy.activeStores, String(summary.stores.active)],
          [copy.problemStores, String(summary.stores.problems)],
        ],
      },
      {
        title: copy.storesView.problems,
        rows: rows.length
          ? rows.map((store) => [
              `${store.environment === "sandbox" ? "🧪 " : ""}${store.label}`,
              [
                [
                  store.failures === 2 ? t.stores.failedReads : null,
                  store.detailErrors > 0 ? t.stores.failedDetails(store.detailErrors) : null,
                  store.consent !== "valid" ? `${t.stores.consent[store.consent]}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                copy.storesView.lastRead(at(store.lastSuccessAt)),
              ].join(" · "),
            ])
          : [[copy.state, copy.storesView.none]],
      },
    ],
    buttons: [
      [
        ...(offset > 0
          ? [{ text: copy.previous, callback_data: ownerCallback("negozi", offset - storesPage) }]
          : []),
        ...(more
          ? [{ text: copy.next, callback_data: ownerCallback("negozi", offset + storesPage) }]
          : []),
      ],
    ].filter((row) => row.length > 0),
  };
}

async function performancePanel(env: Env, fetcher: typeof fetch): Promise<Panel> {
  const metrics = await readTechnicalMetrics(env, fetcher);
  const p = t.performance;
  if (metrics.read !== "ok")
    return {
      title: copy.views.prestazioni,
      sections: [
        {
          title: copy.state,
          rows: [[copy.state, metrics.read === "unconfigured" ? p.unconfigured : p.failed]],
        },
      ],
    };
  const name = (invocation: string, detail: string) =>
    `${p.invocation[invocation as keyof typeof p.invocation] ?? invocation} · ${p.detail[detail as keyof typeof p.detail] ?? detail}`;
  return {
    title: copy.views.prestazioni,
    lead: p.estimate(metrics.windowHours),
    sections: [
      {
        title: p.invocations,
        rows: capped(
          [...metrics.invocations]
            .sort((a, b) => b.count - a.count)
            .map((row) => [
              `${name(row.invocation, row.detail)} · ${row.outcome}`,
              copy.performance.value(Math.round(row.count), row.p95Ms),
            ]),
          10,
        ),
      },
      {
        title: `${p.phases} · ${copy.performance.slowest}`,
        rows: capped(
          [...metrics.phases]
            .sort((a, b) => b.p95Ms - a.p95Ms)
            .map((row) => [
              `${p.phaseName[row.phase as keyof typeof p.phaseName] ?? row.phase} · ${row.operation}`,
              copy.performance.value(Math.round(row.calls), row.p95Ms),
            ]),
          8,
        ),
      },
      {
        title: p.cpu,
        rows: metrics.cpu.map((row) => [
          `${p.pageName[row.page]} · ${p.cpuKind[row.kind]}`,
          [
            String(Math.round(row.invocations)),
            ...(
              [
                [p.cpuP50, row.cpuP50Ms],
                [p.cpuP95, row.cpuP95Ms],
                [p.wallP50, row.wallP50Ms],
              ] as const
            ).map(
              ([label, value]) =>
                `${label} ${value === null ? t.metrics.none : `${Math.round(value)} ms`}`,
            ),
          ].join(" · "),
        ]),
      },
      {
        title: p.pages,
        rows: metrics.pages.map((page) => [
          p.pageName[page.page as keyof typeof p.pageName] ?? page.page,
          `${Math.round(page.reports)} · LCP p75 ${page.measures.lcp.p75 ?? t.metrics.none} ms`,
        ]),
      },
    ],
  };
}

async function versionPanel(env: Env): Promise<Panel> {
  // La tabella delle migration esiste soltanto dove le applica la CLI.
  const migration = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
    .first<{ name: string }>()
    .catch(() => null);
  const version = env.VERSION_METADATA;
  return {
    title: copy.views.versione,
    sections: [
      {
        title: environmentName(env),
        rows: [
          [copy.version.worker, version?.id ?? t.metrics.none],
          [copy.version.tag, version?.tag || t.metrics.none],
          [copy.version.deployed, version?.timestamp ? at(version.timestamp) : t.metrics.none],
          [copy.version.origin, new URL(env.APP_ORIGIN).host],
          [copy.version.migration, migration?.name ?? t.metrics.none],
        ],
      },
    ],
  };
}

/**
 * Menu della chat dell'owner: i comandi del Control Center, poi quelli dei venditori in
 * italiano, che nella sua chat continuano a funzionare. `scripts/telegram-bot.mjs` lo compone
 * allo stesso modo per il readback.
 */
export function ownerMenu() {
  return [
    ...ownerCommands.map((command) => ({ command, description: copy.commands[command] })),
    ...(Object.keys(botCommands) as BotCommand[]).map((command) => ({
      command: botCommands[command].it,
      description: telegramBotCopy.it.commands[command],
    })),
  ];
}

/** Menu della chat dell'owner, indipendente dall'interruttore degli invii Telegram come gli avvisi. */
export async function configureOwnerCommands(env: Env, fetcher: typeof fetch = fetch) {
  const owner = ownerChatId(env);
  if (!owner || !telegramConfigured(env)) return;
  await setOwnerCommands(env, owner, ownerMenu(), fetcher);
}
