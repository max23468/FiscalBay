import { cn } from "cn";
import { useState } from "react";

import { useAction } from "~/components/app-shell";
import { PremiumNote } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import type { AppCopy } from "../../app-copy";
import type { Language } from "../../i18n";
import { formatDate, type AccountView, type StoreView } from "../../view-models";
import { AutoSwitch, Group, SimpleSelect } from "./controls";

/**
 * Il lifetime conserva l'accesso ai documenti senza presentare un rinnovo. Un Premium concesso
 * senza abbonamento non ha periodo né gestione su Stripe.
 */
function PremiumPlan({
  account,
  billing,
  t,
  language,
}: {
  account: AccountView;
  billing: boolean;
  t: AppCopy;
  language: Language;
}) {
  const zone = useTimeZone();
  const action = useAction();
  const lifetime = account.premium?.period === "lifetime";
  return (
    <Group title={t.settings.currentPlan}>
      <div className="grid gap-1">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {account.premium ? t.settings.premiumPeriod[account.premium.period] : t.settings.premium}
        </p>
        {lifetime ? (
          <p className="text-sm text-muted-foreground">{t.settings.premiumLifetime}</p>
        ) : account.premium?.renewsAt ? (
          <p className="text-sm text-muted-foreground">
            {t.settings.premiumRenews(formatDate(account.premium.renewsAt, language, "date", zone))}
          </p>
        ) : null}
      </div>
      {billing && account.premium ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => action.run("manage-billing")}>
              {lifetime ? t.settings.billingDocuments : t.settings.manageBilling}
            </Button>
          </div>
          {lifetime ? null : (
            <p className="text-sm text-muted-foreground">{t.settings.billingDocs}</p>
          )}
        </>
      ) : null}
    </Group>
  );
}

export function PlanSection({
  account,
  stores,
  billing,
  confirmUnlock,
  t,
  language,
}: {
  account: AccountView;
  stores: StoreView[];
  /** Prova, acquisto e negozio attivo del Free dipendono dai pagamenti. */
  billing: boolean;
  confirmUnlock: boolean;
  t: AppCopy;
  language: Language;
}) {
  const zone = useTimeZone();
  const action = useAction();
  const [downgradeStore, setDowngradeStore] = useState(
    () => stores.find((store) => store.pauseReason !== "plan")?.id ?? "",
  );
  // La scelta del negozio attivo compare solo nel Free: in Premium non anticipa il downgrade.
  if (account.plan === "premium") {
    return <PremiumPlan account={account} billing={billing} t={t} language={language} />;
  }
  const quota = account.quota;
  return (
    <>
      <Group title={t.settings.currentPlan}>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.settings.free}</p>
          <p className="text-sm text-muted-foreground">{t.settings.freeSummary}</p>
        </div>
        {quota ? (
          <div className="grid max-w-md gap-2">
            <p className="flex justify-between gap-4 text-sm">
              <span>{t.settings.unlocksCycle}</span>
              <span className="font-code">{t.settings.unlocksUsed(quota.used, quota.limit)}</span>
            </p>
            {/* Il valore è già nel testo sopra: la barra è solo visiva. */}
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  quota.used >= quota.limit ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${Math.min(quota.used / quota.limit, 1) * 100}%` }}
              />
            </div>
            {quota.cycleEndsAt ? (
              <p className="text-sm text-muted-foreground">
                {t.settings.cycleEnds(formatDate(quota.cycleEndsAt, language, "dateTime", zone))}
              </p>
            ) : null}
          </div>
        ) : null}
        {/* La conferma protegge gli sblocchi del ciclo: sta accanto al loro conteggio. */}
        <AutoSwitch
          name="unlock-confirmation"
          label={t.settings.unlockConfirmation}
          description={t.settings.unlockConfirmationHint}
          initial={confirmUnlock}
          t={t}
        />
      </Group>
      {/* Prova, acquisto e negozio attivo del Free dipendono dai pagamenti. */}
      {billing && stores.length > 1 ? (
        <Group>
          <SimpleSelect
            label={t.stores.chooseFreeStore}
            hint={t.settings.freeStoreHint}
            items={stores.map((store) => ({ value: store.id, label: store.name }))}
            value={downgradeStore}
            onChange={(value) => {
              setDowngradeStore(value);
              action.run("free-store", { store: value });
            }}
          />
        </Group>
      ) : null}
      {billing && account.trialAvailable ? (
        <Group title={t.settings.trialTitle}>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.settings.trialBody}</p>
          <Button className="w-fit" onClick={() => action.run("start-trial")}>
            {t.settings.trialAction}
          </Button>
        </Group>
      ) : null}
      {billing ? <PurchaseOptions t={t} /> : null}
    </>
  );
}

function PurchaseOptions({ t }: { t: AppCopy }) {
  const action = useAction();
  return (
    <>
      <Group title={t.settings.buyTitle}>
        <PremiumNote>{t.settings.buyBody}</PremiumNote>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { plan: "monthly", price: t.settings.priceMonthly, note: t.settings.priceMonthlyNote },
            { plan: "annual", price: t.settings.priceAnnual, note: t.settings.priceAnnualNote },
            {
              plan: "lifetime",
              price: t.settings.priceLifetime,
              note: t.settings.priceLifetimeNote,
            },
          ].map(({ plan, price, note }) => (
            <li
              key={price}
              className={cn(
                "grid grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-4",
                plan === "annual" && "border-primary bg-primary/5",
              )}
            >
              <span className="grid gap-1">
                <span className="font-code text-base font-semibold">{price}</span>
                <span className="text-sm text-muted-foreground">{note}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => action.run("buy", { plan })}
              >
                {t.settings.buyPeriod[plan as keyof typeof t.settings.buyPeriod]}
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t.settings.pricesNote}</p>
      </Group>
    </>
  );
}
