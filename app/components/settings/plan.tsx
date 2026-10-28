import { cn } from "cn";
import { useState } from "react";

import { useAction } from "~/components/action";
import { PremiumNote, StatusAlert } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { useCopy } from "~/components/copy-context";
import type { AppCopy } from "../../app-copy";
import {
  annualPaidMonths,
  formatPrice,
  italianGross,
  firstChargeAt,
  priceGeneration,
  type LifetimeOffer,
  type PremiumOffer,
  type PurchaseState,
} from "../../catalog";
import type { Language } from "../../i18n";
import { dayMilliseconds } from "../../time";
import { trialDaysLeft, trialEnding, type AccountView } from "../../view-models";
import { formatDate } from "../../format";
import { AutoSwitch, Group, SimpleSelect } from "./controls";

/**
 * La prova dice quando finisce e cosa resta dopo, in evidenza negli ultimi giorni. L'acquisto
 * compare quando il server lo ammette: mensile e annuale si pagano alla fine della prova,
 * che conserva i suoi giorni.
 */
function TrialPlan({
  trial,
  payment,
  billing,
  billingPortal,
  purchase,
  now,
}: {
  trial: NonNullable<AccountView["trial"]>;
  payment: AccountView["payment"];
  billing: boolean;
  billingPortal: boolean;
  purchase: PurchaseView;
  now: string;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const ending = trialEnding(trial.endsAt, now);
  return (
    <>
      {/* Dopo la scelta la prova resta fino alla sua fine, quando arriva il primo addebito. */}
      <CheckoutReturn checkout={purchase.checkout} payment={payment} trial />
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
          {/* Con un abbonamento scelto la prova non riporta al Free: prosegue in Premium. */}
          <p className="text-sm text-muted-foreground">
            {payment?.state === "scheduled" && !payment.cancelled
              ? t.settings.plan.trialAfterChosen
              : t.settings.plan.trialAfter}
          </p>
        </div>
        {/* L'abbonamento scelto si disdice dal portale prima del primo addebito e lì si riattiva. */}
        {billingPortal && payment?.state === "scheduled" ? <ManageBilling /> : null}
      </Group>
      <PurchaseOptions
        billing={billing}
        purchase={purchase}
        trial={{ endsAt: trial.endsAt, now }}
      />
    </>
  );
}

/**
 * Il lifetime conserva l'accesso ai documenti senza presentare un rinnovo, salvo quello in
 * omaggio, che non ha acquisti su Stripe; dopo la disdetta l'abbonamento indica la fine del
 * periodo pagato. Un Premium concesso senza abbonamento indica la sua fine, senza gestione su
 * Stripe. Senza lifetime resta possibile passare a vita.
 */
function PremiumPlan({
  account,
  billing,
  billingPortal,
  purchase,
}: {
  account: AccountView;
  billing: boolean;
  billingPortal: boolean;
  purchase: PurchaseView;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const lifetime = account.premium?.period === "lifetime";
  return (
    <>
      {/* Passaggio a vita: ritorno da Stripe, pagamento in conferma o annullato. */}
      <CheckoutReturn
        checkout={purchase.checkout === "processing" ? null : purchase.checkout}
        payment={account.payment}
      />
      <Group title={t.settings.plan.currentPlan}>
        <div className="grid gap-1">
          <p className="flex items-center gap-2 text-lg font-semibold">
            {account.premium
              ? t.settings.plan.premiumPeriod[account.premium.period]
              : t.settings.plan.premium}
          </p>
          <PremiumStatus premium={account.premium} grant={account.grant} />
        </div>
        {billingPortal && account.premium?.renewsAt && account.premium.period !== "lifetime" ? (
          <RenewalPeriod
            period={account.premium.period}
            next={account.premium.nextPeriod}
            renewsAt={formatDate(account.premium.renewsAt, language, "date", zone)}
          />
        ) : null}
        {billingPortal && account.premium && !account.premium.granted ? (
          <ManageBilling lifetime={lifetime} />
        ) : null}
      </Group>
      {lifetime ? null : <PurchaseOptions billing={billing} purchase={purchase} upgrade />}
    </>
  );
}

/**
 * Rinnovo, eventuale cambio programmato, fine dopo la disdetta, acquisto una tantum o fine di
 * una concessione.
 */
function PremiumStatus({
  premium,
  grant,
}: {
  premium: AccountView["premium"];
  grant: AccountView["grant"];
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const copy = t.settings.plan;
  let text: string | null = null;
  if (premium?.period === "lifetime")
    text = premium.granted ? copy.premiumLifetimeGranted : copy.premiumLifetime;
  else if (premium?.renewsAt) {
    const date = formatDate(premium.renewsAt, language, "date", zone);
    text = premium.nextPeriod
      ? copy.switchScheduled(premium.nextPeriod)(date)
      : copy.premiumRenews(date);
  } else if (premium?.endsAt)
    text = copy.premiumEnds(formatDate(premium.endsAt, language, "dateTime", zone));
  else if (grant) text = copy.grantEnds(formatDate(grant.endsAt, language, "dateTime", zone));
  return text ? <p className="text-sm text-muted-foreground">{text}</p> : null;
}

/**
 * Cambio della periodicità del rinnovo: vale dalla fine del periodo pagato, senza conguaglio,
 * e resta annullabile fino ad allora. Il cambio programmato si legge già nella data di rinnovo.
 */
function RenewalPeriod({
  period,
  next,
  renewsAt,
}: {
  period: "monthly" | "annual";
  next: "monthly" | "annual" | undefined;
  renewsAt: string;
}) {
  const { t } = useCopy();
  const action = useAction();
  const copy = t.settings.plan;
  const other = period === "monthly" ? "annual" : "monthly";
  return (
    <div className="grid justify-items-start gap-2">
      {next ? null : <p className="text-sm text-muted-foreground">{copy.switchHint(renewsAt)}</p>}
      <Button
        variant="outline"
        size="sm"
        pending={action.pending}
        onClick={() => action.run("change-period", { period: next ? period : other })}
      >
        {next ? copy.keepPeriod[period] : copy.switchTo[other]}
      </Button>
    </div>
  );
}

/** Portale di Stripe: disdetta, metodo di pagamento e documenti; per il lifetime i soli documenti. */
function ManageBilling({ lifetime = false }: { lifetime?: boolean }) {
  const { t } = useCopy();
  const action = useAction();
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          pending={action.pending}
          onClick={() => action.run("manage-billing")}
        >
          {lifetime ? t.settings.plan.billingDocuments : t.settings.plan.manageBilling}
        </Button>
      </div>
      {lifetime ? null : (
        <p className="text-sm text-muted-foreground">{t.settings.plan.billingDocs}</p>
      )}
    </>
  );
}

/** La prova è interna a FiscalBay: non crea abbonamenti né pagamenti. */
function TrialOffer() {
  const { t } = useCopy();
  const action = useAction();
  return (
    <Group title={t.settings.plan.trialTitle}>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.settings.plan.trialBody}</p>
      <Button className="w-fit" pending={action.pending} onClick={() => action.run("start-trial")}>
        {t.settings.plan.trialAction}
      </Button>
    </Group>
  );
}

/**
 * Acquisto dalla pagina del piano: stato di mensile e annuale per lo spazio, offerte in vendita
 * e offerta lifetime, null quando non si propone.
 */
export interface PurchaseView {
  state: PurchaseState;
  offers: readonly PremiumOffer[];
  lifetime: LifetimeOffer | null;
  /** Ritorno da Stripe: pagamento in verifica, lifetime in verifica oppure annullato. */
  checkout: "processing" | "lifetime" | "cancelled" | null;
}

/** Negozio attivo del Free: negozi dello spazio, quello attivo e la prima nuova sostituzione. */
export interface FreeStoreView {
  stores: readonly { id: string; name: string }[];
  activeId: string | null;
  /** Prima data in cui il negozio attivo si può sostituire; null se è già possibile. */
  changeFrom: string | null;
}

/** Giorni fra due sostituzioni del negozio attivo, come sul server. */
const freeStoreChangeDays = 90;

/**
 * Scelta del negozio attivo, soltanto nel Free (D155). La sostituzione chiede conferma: il
 * negozio lasciato va in pausa e la prossima resta possibile solo dopo 90 giorni.
 */
function FreeStoreChoice({ freeStore, now }: { freeStore: FreeStoreView; now: string }) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const copy = t.settings.plan;
  const [active, setActive] = useState(freeStore.activeId ?? "");
  const [pending, setPending] = useState<string | null>(null);
  // Un rifiuto del server riporta la scelta al negozio attivo.
  const action = useAction((result) => {
    if (!result.ok) setActive(freeStore.activeId ?? "");
  });
  const name = (id: string | null) => freeStore.stores.find((store) => store.id === id)?.name;
  const next = new Date(Date.parse(now) + freeStoreChangeDays * dayMilliseconds).toISOString();
  return (
    <Group>
      <SimpleSelect
        label={t.stores.chooseFreeStore}
        hint={
          freeStore.changeFrom
            ? copy.freeStoreLocked(formatDate(freeStore.changeFrom, language, "date", zone))
            : copy.freeStoreHint
        }
        items={freeStore.stores.map((store) => ({ value: store.id, label: store.name }))}
        value={active}
        disabled={freeStore.changeFrom !== null || action.pending}
        onChange={(value) => {
          if (value !== active) setPending(value);
        }}
      />
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.freeStoreConfirmTitle(name(pending) ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.freeStoreConfirmBody(
                name(active) ?? null,
                formatDate(next, language, "date", zone),
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogClose
              render={<Button />}
              onClick={() => {
                setActive(pending!);
                action.run("free-store", { store: pending! });
              }}
            >
              {copy.freeStoreConfirm}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Group>
  );
}

/**
 * Il ritorno da Stripe non prova il pagamento: il piano cambia con la conferma. Un pagamento
 * che Stripe non ha ancora confermato resta in attivazione anche senza il ritorno; un rinnovo
 * non riuscito riporta al Free e indica fino a quando il prezzo resta protetto.
 */
function CheckoutReturn({
  checkout,
  payment,
  trial = false,
}: {
  checkout: PurchaseView["checkout"];
  payment: AccountView["payment"];
  /** Durante la prova la scelta non comporta un pagamento immediato. */
  trial?: boolean;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const copy = t.settings.plan;
  // Il lifetime si paga subito, anche durante la prova o con un abbonamento.
  if (checkout === "lifetime" || (payment?.state === "pending" && payment.lifetime))
    return (
      <StatusAlert tone="info" title={copy.lifetimeProcessingTitle}>
        {copy.lifetimeProcessingBody}
      </StatusAlert>
    );
  if (payment?.state === "scheduled" && payment.cancelled)
    return (
      <StatusAlert
        tone="info"
        title={copy.trialChosenCancelledTitle(copy.premiumPeriod[payment.period])}
      >
        {copy.trialChosenCancelledBody(formatDate(payment.chargeAt, language, "dateTime", zone))}
      </StatusAlert>
    );
  if (payment?.state === "scheduled")
    return (
      <StatusAlert tone="info" title={copy.trialChosenTitle(copy.premiumPeriod[payment.period])}>
        {copy.trialChosenBody(formatDate(payment.chargeAt, language, "dateTime", zone))}
      </StatusAlert>
    );
  if (trial && checkout === "processing")
    return (
      <StatusAlert tone="info" title={copy.trialCheckoutProcessingTitle}>
        {copy.trialCheckoutProcessingBody}
      </StatusAlert>
    );
  if (payment?.state === "renewal-failed")
    return (
      <StatusAlert tone="warning" title={t.settings.plan.renewalFailedTitle}>
        {t.settings.plan.renewalFailedBody(
          formatDate(payment.protectedUntil, language, "dateTime", zone),
        )}
      </StatusAlert>
    );
  if (checkout === "processing" || payment?.state === "pending")
    return (
      <StatusAlert tone="info" title={t.settings.plan.checkoutProcessingTitle}>
        {t.settings.plan.checkoutProcessingBody}
      </StatusAlert>
    );
  if (checkout === "cancelled")
    return <StatusAlert tone="info" title={t.settings.plan.checkoutCancelled} />;
  return null;
}

/**
 * Pagamento rimborsato, o con la disputa persa: spiega il ritorno al Free, con il rinnovo che
 * riporta Premium se l'abbonamento continua.
 */
function RefundNotice({ payment }: { payment: AccountView["payment"] }) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  if (payment?.state !== "refunded") return null;
  const copy = t.settings.plan;
  return (
    <StatusAlert tone="info" title={copy.refundedTitle}>
      {payment.lifetime
        ? copy.lifetimeRefundedBody
        : copy.refundedBody(
            payment.renewsAt ? formatDate(payment.renewsAt, language, "date", zone) : null,
          )}
    </StatusAlert>
  );
}

/**
 * Sblocchi del ciclo Free in corso e conferma prima dello sblocco, che li protegge e sta
 * accanto al loro conteggio.
 */
function FreeUnlocks({
  quota,
  confirmUnlock,
}: {
  quota: AccountView["quota"];
  confirmUnlock: boolean;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  return (
    <>
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
              {t.settings.plan.cycleEnds(formatDate(quota.cycleEndsAt, language, "dateTime", zone))}
              {/* La promozione cambia la quota soltanto da un ciclo all'altro. */}
              {quota.nextLimit ? ` ${t.settings.plan.nextCycleLimit(quota.nextLimit)}` : null}
            </p>
          ) : null}
        </div>
      ) : null}
      <AutoSwitch
        name="unlock-confirmation"
        label={t.settings.plan.unlockConfirmation}
        initial={confirmUnlock}
      />
    </>
  );
}

export function PlanSection({
  account,
  freeStore,
  billing,
  billingPortal,
  purchase,
  confirmUnlock,
  now,
}: {
  account: AccountView;
  /** Negozio attivo del Free; null senza negozi da scegliere. */
  freeStore: FreeStoreView | null;
  /** L'acquisto dipende dai pagamenti; prova e negozio attivo no. */
  billing: boolean;
  billingPortal: boolean;
  purchase: PurchaseView;
  confirmUnlock: boolean;
  now: string;
}) {
  const { t } = useCopy();
  // La scelta del negozio attivo compare solo nel Free: in Premium non anticipa il downgrade.
  if (account.plan === "premium") {
    return account.trial ? (
      <TrialPlan
        trial={account.trial}
        payment={account.payment}
        billing={billing}
        billingPortal={billingPortal}
        purchase={purchase}
        now={now}
      />
    ) : (
      <PremiumPlan
        account={account}
        billing={billing}
        billingPortal={billingPortal}
        purchase={purchase}
      />
    );
  }
  return (
    <>
      <RefundNotice payment={account.payment} />
      <CheckoutReturn checkout={purchase.checkout} payment={account.payment} />
      <Group title={t.settings.plan.currentPlan}>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.settings.plan.free}</p>
          {account.waitlisted ? (
            <p className="text-sm text-muted-foreground">
              {t.settings.plan.waitlisted}
              {purchase.state === "closed" ? null : ` ${t.settings.plan.waitlistedPurchase}`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t.settings.plan.freeSummary}</p>
          )}
        </div>
        {/* In lista d'attesa il Free non è ancora erogato: niente quota né conferma. */}
        {account.waitlisted ? null : (
          <FreeUnlocks quota={account.quota} confirmUnlock={confirmUnlock} />
        )}
      </Group>
      {freeStore && freeStore.stores.length > 1 ? (
        <FreeStoreChoice freeStore={freeStore} now={now} />
      ) : null}
      {account.trialAvailable ? <TrialOffer /> : null}
      <PurchaseOptions billing={billing} purchase={purchase} />
    </>
  );
}

/**
 * Acquisto con i pagamenti attivi. Mensile e annuale si fermano con un diritto in corso diverso
 * dalla prova; il lifetime resta finché ci sono posti, anche per chi ha già un abbonamento, che
 * con il lifetime si chiude detraendo dal prezzo il periodo pagato non usato.
 */
function PurchaseOptions({
  billing,
  purchase,
  trial,
  upgrade = false,
}: {
  billing: boolean;
  purchase: PurchaseView;
  /** Durante la prova mensile e annuale si pagano alla sua fine, la stessa data del server. */
  trial?: { endsAt: string; now: string };
  /** Premium già attivo: resta soltanto il passaggio a vita. */
  upgrade?: boolean;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  // Un solo acquisto alla volta: la richiesta in corso ferma tutte le offerte.
  const action = useAction();
  const lifetime = purchase.lifetime;
  const offers = purchase.offers.filter((offer) =>
    offer === "lifetime" ? !!lifetime : purchase.state !== "covered",
  );
  if (!billing || !offers.length) return null;
  const copy = t.settings.plan;
  // Durante la prova la nota dell'offerta aggiunge la data del primo addebito; con meno di due
  // giorni residui il primo addebito è subito.
  const chargeAt = trial ? firstChargeAt(trial.endsAt, trial.now) : null;
  const firstCharge = chargeAt
    ? copy.firstCharge(formatDate(chargeAt, language, "date", zone))
    : null;
  const prices = offerTexts(t, language, lifetime, firstCharge);
  const needsSync = purchase.state === "needs-sync" || lifetime?.state === "needs-sync";
  const closed = purchase.state === "closed" || lifetime?.state === "closed";
  return (
    <Group title={upgrade ? copy.lifetimeUpgradeTitle : copy.buyTitle}>
      {upgrade ? null : <PremiumNote>{copy.buyBody}</PremiumNote>}
      {trial && purchase.state !== "covered" ? (
        <p className="text-sm text-muted-foreground">
          {chargeAt ? copy.trialPurchaseNote : copy.trialEndingPurchaseNote}
        </p>
      ) : null}
      <ul
        className={cn(
          "grid gap-3",
          ["max-w-sm", "sm:grid-cols-2", "sm:grid-cols-3"][offers.length - 1],
        )}
      >
        {offers.map((plan) => (
          <li
            key={plan}
            className={cn(
              "grid grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-4",
              plan === "annual" && "border-primary bg-primary/5",
            )}
          >
            <span className="grid gap-1">
              <span className="font-code text-base font-semibold">{prices[plan].price}</span>
              <span className="text-sm text-muted-foreground">{prices[plan].gross}</span>
              {prices[plan].note ? (
                <span className="text-sm text-muted-foreground">{prices[plan].note}</span>
              ) : null}
              {plan === "lifetime" && lifetime && lifetime.state !== "sold-out" ? (
                <span className="text-sm font-medium">
                  {copy.lifetimeSeats(lifetime.seats.left, lifetime.seats.total)}
                </span>
              ) : null}
            </span>
            <OfferAction plan={plan} purchase={purchase} action={action} />
          </li>
        ))}
      </ul>
      {closed ? (
        <p className="text-sm font-medium">{copy.purchaseClosed}</p>
      ) : needsSync ? (
        <p className="text-sm font-medium">{copy.purchaseNeedsSync}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">{copy.pricesNote}</p>
    </Group>
  );
}

/**
 * Prezzo, totale con l'IVA italiana e nota di ogni offerta, vuota quando il prezzo dice già
 * tutto. Mensile e annuale aggiungono il primo addebito della prova; il lifetime la detrazione
 * del periodo pagato non usato e la chiusura dell'abbonamento.
 */
function offerTexts(
  t: AppCopy,
  language: Language,
  lifetime: LifetimeOffer | null,
  firstCharge: string | null,
): Record<PremiumOffer, { price: string; gross: string; note: string }> {
  const copy = t.settings.plan;
  const net = (offer: PremiumOffer) => formatPrice(priceGeneration.net[offer], language);
  const gross = (offer: PremiumOffer) =>
    copy.priceGross(formatPrice(italianGross(priceGeneration.net[offer]), language));
  const withCharge = (note: string) => (firstCharge ? `${note} ${firstCharge}` : note);
  return {
    monthly: {
      price: copy.priceMonthly(net("monthly")),
      gross: gross("monthly"),
      note: firstCharge ?? "",
    },
    annual: {
      price: copy.priceAnnual(net("annual")),
      gross: gross("annual"),
      note: withCharge(copy.priceAnnualNote(annualPaidMonths())),
    },
    lifetime: {
      price: copy.priceLifetime(net("lifetime")),
      gross: gross("lifetime"),
      note: [
        lifetime?.credit ? copy.lifetimeCredit(formatPrice(lifetime.credit, language)) : null,
        lifetime?.replaces ? copy.lifetimeReplaces : null,
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

/** Acquisto dell'offerta quando il server lo ammette; a posti finiti il lifetime è esaurito. */
function OfferAction({
  plan,
  purchase,
  action,
}: {
  plan: PremiumOffer;
  purchase: PurchaseView;
  action: ReturnType<typeof useAction>;
}) {
  const { t } = useCopy();
  const state = plan === "lifetime" ? purchase.lifetime?.state : purchase.state;
  if (state === "sold-out")
    return <span className="text-sm font-medium">{t.settings.plan.lifetimeSoldOut}</span>;
  if (state !== "available") return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-fit"
      pending={action.pending}
      onClick={() => action.run("buy", { plan })}
    >
      {t.settings.plan.buyPeriod[plan]}
    </Button>
  );
}
