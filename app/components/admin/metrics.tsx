import { cn } from "cn";
import { Link } from "react-router";

import type { ProductMetrics } from "../../domain/product-metrics.server";
import { locales } from "../../i18n";
import { DataTable, Panel, Stat, StatGrid } from "./kit";
import { useAdmin } from "./use-admin";

/** Dimensione in megabyte o gigabyte, nella lingua della pagina. */
function size(bytes: number, language: "it" | "en") {
  const giga = bytes >= 1024 ** 3;
  return new Intl.NumberFormat(locales[language], {
    style: "unit",
    unit: giga ? "gigabyte" : "megabyte",
    maximumFractionDigits: 1,
  }).format(bytes / 1024 ** (giga ? 3 : 2));
}

/**
 * KPI aggregati: primi passi della coorte registrata nella finestra, commerciale, letture e
 * capacità. Ogni quota mostra il proprio denominatore; nessun dato di un singolo spazio.
 */
export function MetricsView({ metrics }: { metrics: ProductMetrics }) {
  const { t, href, date, money, percent, language } = useAdmin();
  const m = t.metrics;
  const { funnel, commerce, reads, lag, spaces, freeQuota, capacity, volume } = metrics;
  const rate = (count: number, of: number) => (of > 0 ? percent(count / of) : m.none);
  return (
    <>
      <nav aria-label={m.window} className="flex flex-wrap items-center gap-2">
        {metrics.window.options.map((days) => (
          <Link
            key={days}
            to={href(`metriche?giorni=${days}`)}
            aria-current={days === metrics.window.days ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring",
              days === metrics.window.days
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted/50",
            )}
          >
            {m.days(days)}
          </Link>
        ))}
        <span className="text-sm text-muted-foreground">
          {m.range(date(metrics.window.from, "date"), date(metrics.window.to, "date"))}
        </span>
      </nav>
      <Panel title={m.funnel}>
        <p className="text-sm text-muted-foreground text-pretty">{m.funnelNote}</p>
        <DataTable
          head={[m.step, m.reached, m.rate, m.base, m.median]}
          rows={funnel.steps.map((step) => ({
            key: step.step,
            cells: [
              m.steps[step.step],
              step.count,
              step.after ? rate(step.count, step.of) : m.none,
              step.after ? m.of(step.of, m.steps[step.after]) : m.none,
              step.medianHours === null ? m.none : m.hours(step.medianHours),
            ],
          }))}
        />
        {funnel.syncWithoutOrders > 0 ? (
          <p className="text-sm">{m.syncWithoutOrders(funnel.syncWithoutOrders)}</p>
        ) : null}
      </Panel>
      <Panel title={m.commerce}>
        <StatGrid>
          <Stat
            label={m.paying}
            value={commerce.paying}
            note={m.payingNote(
              commerce.subscriptions.monthly,
              commerce.subscriptions.annual,
              commerce.lifetimePaid,
            )}
          />
          <Stat
            label={m.mrr}
            value={money(commerce.mrr)}
            note={
              commerce.subscriptions.unlisted > 0
                ? m.unlisted(commerce.subscriptions.unlisted)
                : m.mrrNote
            }
          />
          <Stat label={m.trialsOpen} value={commerce.trialsOpen} />
          <Stat
            label={m.gifts}
            value={commerce.lifetimeGifted + commerce.granted}
            note={m.giftsNote(commerce.lifetimeGifted, commerce.granted)}
          />
          <Stat label={m.cancelling} value={commerce.subscriptions.cancelling} />
          <Stat
            label={m.trialConversion}
            value={rate(commerce.trials.converted, commerce.trials.ended)}
            note={m.trialConversionNote(commerce.trials.converted, commerce.trials.ended)}
          />
          <Stat
            label={m.purchases}
            value={commerce.purchases.total}
            note={m.purchasesNote(
              commerce.purchases.afterTrial,
              commerce.purchases.total - commerce.purchases.afterTrial,
            )}
          />
          <Stat
            label={m.cash}
            value={money(commerce.cash.paid)}
            note={m.cashNote(money(commerce.cash.refunded))}
          />
        </StatGrid>
      </Panel>
      <Panel title={m.activity}>
        <StatGrid>
          <Stat label={m.operative} value={spaces.operative} note={m.operativeNote} />
          <Stat label={m.active} value={spaces.active} note={m.activeNote} />
          <Stat
            label={m.errorRate}
            value={reads.errorRate === null ? m.none : percent(reads.errorRate)}
            note={m.errorRateNote(reads.failures, reads.attempts)}
            tone={reads.errorRate !== null && reads.errorRate > 0.05 ? "warning" : undefined}
          />
          <Stat
            label={m.lag}
            value={lag.medianMinutes === null ? m.none : m.minutes(lag.medianMinutes)}
            note={
              <>
                {m.lagNote(lag.late, lag.stores - lag.neverRead, lag.targetMinutes)}
                {lag.neverRead > 0 ? ` · ${m.neverRead(lag.neverRead)}` : null}
              </>
            }
            tone={lag.late > 0 ? "warning" : undefined}
          />
          <Stat
            label={m.freeQuota}
            value={rate(freeQuota.used, freeQuota.quota)}
            note={m.freeQuotaNote(freeQuota.used, freeQuota.quota, freeQuota.exhausted)}
          />
        </StatGrid>
      </Panel>
      <Panel title={m.capacity}>
        <StatGrid>
          <Stat
            label={m.database}
            value={
              capacity.databaseBytes === null ? m.none : size(capacity.databaseBytes, language)
            }
            note={m.databaseNote(size(capacity.databaseBudget, language))}
            tone={
              capacity.databaseBytes !== null && capacity.databaseBytes > capacity.databaseBudget
                ? "warning"
                : undefined
            }
          />
          <Stat
            label={m.stores}
            value={capacity.readingStores}
            note={m.storesNote(capacity.referenceStores)}
          />
          <Stat
            label={m.readsPerDay}
            value={reads.days > 0 ? Math.round(reads.attempts / reads.days) : m.none}
            note={m.readsPerDayNote(reads.days)}
          />
          <Stat
            label={m.kept}
            value={volume.steps + volume.days}
            note={m.keptNote(volume.days, volume.runs)}
          />
        </StatGrid>
      </Panel>
    </>
  );
}
