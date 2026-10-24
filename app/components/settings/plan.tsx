import { cn } from "cn";
import { useState } from "react";

import { useAction } from "~/components/app-shell";
import { PremiumNote, StatusAlert } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import type { AppCopy } from "../../app-copy";
import {
  annualMonthlyPrice,
  formatPrice,
  priceGeneration,
  type PremiumOffer,
  type PurchaseState,
} from "../../catalog";
import type { Language } from "../../i18n";
import {
  formatDate,
  trialDaysLeft,
  trialEnding,
  type AccountView,
  type StoreView,
} from "../../view-models";
import { AutoSwitch, Group, SimpleSelect } from "./controls";

/**
 * La prova dice quando finisce e cosa resta dopo, in evidenza negli ultimi giorni. L'acquisto
 * compare quando il server lo ammette: un abbonamento ordinario non conserverebbe i giorni
 * residui della prova.
 */
function TrialPlan({
  trial,
  billing,
  purchase,
  now,
  t,
  language,
}: {
  trial: NonNullable<AccountView["trial"]>;
  billing: boolean;
  purchase: PurchaseView;
  now: string;
  t: AppCopy;
  language: Language;
}) {
  const zone = useTimeZone();
  const ending = trialEnding(trial.endsAt, now);
  return (
    <>
      <Group title={t.settings.plan.currentPlan}>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.settings.plan.trialPlan}</p>
          <p
            className={cn("text-sm", ending ? "font-medium text-warning" : "text-muted-foreground")}
          >
            {t.settings.plan.trialEnds(
              formatDate(trial.endsAt, language, "dateTime", zone),
              trialDaysLeft(trial.endsAt, now),
            )}
          </p>
          <p className="text-sm text-muted-foreground">{t.settings.plan.trialAfter}</p>
        </div>
      </Group>
      <PurchaseOptions billing={billing} purchase={purchase} t={t} language={language} />
    </>
  );
}

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
    <Group title={t.settings.plan.currentPlan}>
      <div className="grid gap-1">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {account.premium
            ? t.settings.plan.premiumPeriod[account.premium.period]
            : t.settings.plan.premium}
        </p>
        {lifetime ? (
          <p className="text-sm text-muted-foreground">{t.settings.plan.premiumLifetime}</p>
        ) : account.premium?.renewsAt ? (
          <p className="text-sm text-muted-foreground">
            {t.settings.plan.premiumRenews(
              formatDate(account.premium.renewsAt, language, "date", zone),
            )}
          </p>
        ) : null}
      </div>
      {billing && account.premium ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => action.run("manage-billing")}>
              {lifetime ? t.settings.plan.billingDocuments : t.settings.plan.manageBilling}
            </Button>
          </div>
          {lifetime ? null : (
            <p className="text-sm text-muted-foreground">{t.settings.plan.billingDocs}</p>
          )}
        </>
      ) : null}
    </Group>
  );
}

/** La prova è interna a FiscalBay: non crea abbonamenti né pagamenti. */
function TrialOffer({ t }: { t: AppCopy }) {
  const action = useAction();
  return (
    <Group title={t.settings.plan.trialTitle}>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.settings.plan.trialBody}</p>
      <Button className="w-fit" disabled={action.pending} onClick={() => action.run("start-trial")}>
        {action.pending ? <Spinner /> : null}
        {t.settings.plan.trialAction}
      </Button>
    </Group>
  );
}

/** Acquisto dalla pagina del piano: stato per lo spazio e offerte in vendita. */
export interface PurchaseView {
  state: PurchaseState;
  offers: readonly PremiumOffer[];
  /** Ritorno da Stripe: pagamento in verifica oppure annullato. */
  checkout: "processing" | "cancelled" | null;
}

/** Il ritorno da Stripe non prova il pagamento: il piano cambia con la conferma. */
function CheckoutReturn({ checkout, t }: { checkout: PurchaseView["checkout"]; t: AppCopy }) {
  if (checkout === "processing")
    return (
      <StatusAlert tone="info" title={t.settings.plan.checkoutProcessingTitle}>
        {t.settings.plan.checkoutProcessingBody}
      </StatusAlert>
    );
  if (checkout === "cancelled")
    return <StatusAlert tone="info" title={t.settings.plan.checkoutCancelled} />;
  return null;
}

export function PlanSection({
  account,
  stores,
  billing,
  purchase,
  confirmUnlock,
  now,
  t,
  language,
}: {
  account: AccountView;
  stores: StoreView[];
  /** Acquisto e negozio attivo del Free dipendono dai pagamenti; la prova no. */
  billing: boolean;
  purchase: PurchaseView;
  confirmUnlock: boolean;
  now: string;
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
    return account.trial ? (
      <TrialPlan
        trial={account.trial}
        billing={billing}
        purchase={purchase}
        now={now}
        t={t}
        language={language}
      />
    ) : (
      <PremiumPlan account={account} billing={billing} t={t} language={language} />
    );
  }
  const quota = account.quota;
  return (
    <>
      <CheckoutReturn checkout={purchase.checkout} t={t} />
      <Group title={t.settings.plan.currentPlan}>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.settings.plan.free}</p>
          <p className="text-sm text-muted-foreground">{t.settings.plan.freeSummary}</p>
        </div>
        {quota ? (
          <div className="grid max-w-md gap-2">
            <p className="flex justify-between gap-4 text-sm">
              <span>{t.settings.plan.unlocksCycle}</span>
              <span className="font-code">
                {t.settings.plan.unlocksUsed(quota.used, quota.limit)}
              </span>
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
                {t.settings.plan.cycleEnds(
                  formatDate(quota.cycleEndsAt, language, "dateTime", zone),
                )}
                {/* La promozione cambia la quota soltanto da un ciclo all'altro. */}
                {quota.nextLimit ? ` ${t.settings.plan.nextCycleLimit(quota.nextLimit)}` : null}
              </p>
            ) : null}
          </div>
        ) : null}
        {/* La conferma protegge gli sblocchi del ciclo: sta accanto al loro conteggio. */}
        <AutoSwitch
          name="unlock-confirmation"
          label={t.settings.plan.unlockConfirmation}
          description={t.settings.plan.unlockConfirmationHint}
          initial={confirmUnlock}
          t={t}
        />
      </Group>
      {/* Acquisto e negozio attivo del Free dipendono dai pagamenti. */}
      {billing && stores.length > 1 ? (
        <Group>
          <SimpleSelect
            label={t.stores.chooseFreeStore}
            hint={t.settings.plan.freeStoreHint}
            items={stores.map((store) => ({ value: store.id, label: store.name }))}
            value={downgradeStore}
            onChange={(value) => {
              setDowngradeStore(value);
              action.run("free-store", { store: value });
            }}
          />
        </Group>
      ) : null}
      {account.trialAvailable ? <TrialOffer t={t} /> : null}
      <PurchaseOptions billing={billing} purchase={purchase} t={t} language={language} />
    </>
  );
}

/** Acquisto con i pagamenti attivi e senza una copertura in corso, prova compresa. */
function PurchaseOptions({
  billing,
  purchase,
  t,
  language,
}: {
  billing: boolean;
  purchase: PurchaseView;
  t: AppCopy;
  language: Language;
}) {
  const action = useAction();
  if (!billing || purchase.state === "covered") return null;
  const copy = t.settings.plan;
  const net = (offer: PremiumOffer) => formatPrice(priceGeneration.net[offer], language);
  const prices = {
    monthly: { price: copy.priceMonthly(net("monthly")), note: copy.priceMonthlyNote },
    annual: {
      price: copy.priceAnnual(net("annual")),
      note: copy.priceAnnualNote(annualMonthlyPrice(language)),
    },
    lifetime: { price: copy.priceLifetime(net("lifetime")), note: copy.priceLifetimeNote },
  };
  const available = purchase.state === "available";
  return (
    <Group title={copy.buyTitle}>
      <PremiumNote>{copy.buyBody}</PremiumNote>
      <ul
        className={cn(
          "grid gap-3",
          purchase.offers.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {purchase.offers.map((plan) => (
          <li
            key={plan}
            className={cn(
              "grid grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-4",
              plan === "annual" && "border-primary bg-primary/5",
            )}
          >
            <span className="grid gap-1">
              <span className="font-code text-base font-semibold">{prices[plan].price}</span>
              <span className="text-sm text-muted-foreground">{prices[plan].note}</span>
            </span>
            {available ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={action.pending}
                onClick={() => action.run("buy", { plan })}
              >
                {copy.buyPeriod[plan]}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {available ? null : <p className="text-sm font-medium">{copy.purchaseNeedsSync}</p>}
      <p className="text-sm text-muted-foreground">{copy.pricesNote}</p>
    </Group>
  );
}
