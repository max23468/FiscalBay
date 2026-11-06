import { env } from "cloudflare:workers";
import { cn } from "cn";
import { CircleCheckBig, Gift, Minus } from "lucide-react";

import { useCopy } from "~/components/copy-context";
import { FaqList } from "~/components/faq-list";
import { IconTile } from "~/components/icon-tile";
import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { Badge } from "~/components/ui/badge";
import { buttonLink } from "~/components/ui/button-variants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { appCopy } from "../app-copy";
import { sitePages } from "../copy/site-pages.server";
import { accessPath, planChoiceParam, planPath, pricingPath, visitParam } from "../app-links";
import { annualPaidMonths, lifetimeSlots, premiumOffers, priceGeneration } from "../catalog";
import { languageFromPath, localizedPath } from "../i18n";
import { hasLifetime } from "../domain/lifetime.server";
import { publicPage, siteListing } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/pricing";

/**
 * Prezzi (§23): Free e le tre modalità Premium nello stesso confronto, dal listino del sito
 * comune alla home. Promozione, posti lifetime e sospensione degli acquisti si leggono a ogni
 * richiesta; senza il database resta il listino di riserva, senza quota, prova o posti.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const [{ language, origin, session }, listing] = await Promise.all([
    publicPage(request),
    siteListing(request, languageFromPath(new URL(request.url).pathname)),
  ]);
  // Chi ha già Premium a vita vede il piano attivo al posto delle offerte. Senza database la
  // pagina resta quella di tutti.
  const owned = session ? await hasLifetime(env.DB, session.user.id).catch(() => false) : false;
  const { purchasesOpen, prices, freePromotion, promotionEnd, baseQuota, lifetimeLeft } = listing;
  const t = sitePages[language].pricing;
  const plan = appCopy[language].settings.plan;
  const quota = freePromotion?.quota ?? baseQuota;
  const offers = premiumOffers.map((offer) => {
    const soldOut = offer === "lifetime" && lifetimeLeft !== null && lifetimeLeft <= 0;
    return {
      offer,
      name: t.offers[offer].name,
      price: prices[offer].net,
      period: `${t.vat} ${t.offers[offer].period}`,
      gross: plan.priceGross(prices[offer].gross),
      note: offer === "annual" ? t.offers.annual.note(annualPaidMonths()) : t.offers[offer].note,
      best: offer === "annual",
      choose: t.offers[offer].choose,
      soldOut,
      seats:
        offer === "lifetime" && lifetimeLeft !== null
          ? soldOut
            ? t.soldOutBody
            : plan.lifetimeSeats(lifetimeLeft, lifetimeSlots)
          : null,
    };
  });
  const rows: [string, string | boolean, string | boolean][] = [
    [t.rows.stores.label, t.rows.stores.free, t.rows.stores.premium],
    [t.rows.history.label, t.rows.history.free, t.rows.history.premium],
    [t.rows.unlocks.label, t.rows.unlocks.free(quota), t.rows.unlocks.premium],
    [t.rows.browse, true, true],
    [t.rows.csv, true, true],
    [t.rows.xlsx, false, true],
    [t.rows.suggestions, false, true],
    [t.rows.telegram, false, true],
    [t.rows.support, true, true],
  ];
  return {
    language,
    origin,
    signedIn: Boolean(session),
    owned,
    baseFreeQuota: baseQuota,
    freePromotion,
    lifetime: { left: lifetimeLeft, total: lifetimeSlots },
    purchasesOpen,
    copy: {
      title: t.title,
      metaTitle: t.metaTitle,
      description: t.description,
      lead: t.lead,
      promotion:
        freePromotion && baseQuota !== null
          ? sitePages[language].home.freePromotion(freePromotion.quota, promotionEnd, baseQuota)
          : null,
      free: t.free,
      freePrice: t.freePrice,
      freeItems: t.freeItems(quota),
      premium: t.premium,
      premiumItems: t.premiumItems,
      offers,
      best: t.best,
      soldOut: t.soldOut,
      owned: t.owned,
      ownedLink: t.ownedLink,
      trialTitle: t.trialTitle,
      trialBody: t.trialBody,
      purchaseNote: purchasesOpen || listing.reserve ? t.purchaseNote : t.closed,
      taxNote: t.taxNote,
      compare: t.compare,
      paymentsTitle: t.paymentsTitle,
      payments: sitePages[language].faq.items
        .filter((item) => "payment" in item)
        .map(({ q, a }) => ({ q, a })),
      feature: t.feature,
      included: t.included,
      notIncluded: t.notIncluded,
      rows,
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, copy } = loaderData;
  const url = `${origin}${localizedPath(language, pricingPath)}`;
  // Prezzi netti come nella pagina: l'IVA si aggiunge al pagamento, secondo il paese.
  const offer = (name: string, cents: number, soldOut = false) => ({
    "@type": "Offer",
    name,
    url,
    price: (cents / 100).toFixed(2),
    priceCurrency: "EUR",
    priceSpecification: {
      "@type": "PriceSpecification",
      price: (cents / 100).toFixed(2),
      priceCurrency: "EUR",
      valueAddedTaxIncluded: false,
    },
    ...(soldOut ? { availability: "https://schema.org/SoldOut" } : {}),
  });
  return [
    ...siteMeta({
      language,
      origin,
      path: pricingPath,
      title: copy.metaTitle,
      description: copy.description,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "FiscalBay",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${origin}${localizedPath(language)}`,
        inLanguage: language,
        offers: [
          offer(copy.free, 0),
          ...copy.offers.map((item) =>
            offer(`${copy.premium} ${item.name}`, priceGeneration.net[item.offer], item.soldOut),
          ),
        ],
      },
    },
  ];
}

function Included({ value, label }: { value: boolean; label: string }) {
  const Icon = value ? CircleCheckBig : Minus;
  return (
    <>
      <Icon
        aria-hidden="true"
        className={cn("size-4", value ? "text-success" : "text-muted-foreground")}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

export default function Pricing({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, owned, purchasesOpen, copy: t } = loaderData;
  const site = useCopy().t.site;
  const freeAction = signedIn
    ? { href: `${localizedPath(language)}?${visitParam}=0`, label: site.openApp }
    : { href: `${localizedPath(language, accessPath)}?registrati`, label: site.start };
  // Ogni offerta porta la scelta alla registrazione, o alla pagina Piano con la sessione.
  const offerHref = (offer: string) =>
    signedIn
      ? `${localizedPath(language, planPath)}?${planChoiceParam}=${offer}`
      : `${localizedPath(language, accessPath)}?registrati&${planChoiceParam}=${offer}`;
  const cell = (value: string | boolean) =>
    typeof value === "string" ? (
      value
    ) : (
      <Included value={value} label={value ? t.included : t.notIncluded} />
    );
  return (
    <SiteLayout path={pricingPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div className={cn(siteColumn, "grid gap-12 py-12 sm:py-16")}>
        {t.promotion ? (
          <p className="rounded-xl border border-info/30 bg-info-surface px-4 py-3 text-pretty">
            {t.promotion}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
          <section
            aria-labelledby="piano-free"
            className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:gap-5 sm:p-6"
          >
            <h2 id="piano-free" className="text-xl font-semibold">
              {t.free}
            </h2>
            <p className="text-3xl font-semibold sm:text-4xl">{t.freePrice}</p>
            <ul className="grid gap-2">
              {t.freeItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CircleCheckBig
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-success"
                  />
                  {item}
                </li>
              ))}
            </ul>
            {/* In fondo alla scheda, alla stessa altezza dell'acquisto di Premium accanto. */}
            <a
              href={freeAction.href}
              {...buttonLink({ variant: "outline", size: "lg", className: "mt-auto" })}
            >
              {freeAction.label}
            </a>
          </section>
          <section
            aria-labelledby="piano-premium"
            className="grid content-start gap-4 rounded-2xl border bg-card p-5 sm:gap-5 sm:p-6"
          >
            <h2 id="piano-premium" className="text-xl font-semibold">
              {t.premium}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.premiumItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CircleCheckBig
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-success"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <ul className="grid gap-4 md:grid-cols-3">
              {t.offers.map((offer) => (
                <li
                  key={offer.offer}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 md:gap-2 md:p-4",
                    offer.best && "border-primary ring-1 ring-primary",
                  )}
                >
                  {/* Su smartphone una riga: nome a sinistra, prezzo a destra. */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{offer.name}</h3>
                      {offer.best ? <Badge>{t.best}</Badge> : null}
                      {offer.soldOut ? <Badge variant="neutral">{t.soldOut}</Badge> : null}
                    </div>
                    <p className="text-right md:hidden">
                      <span className="block text-xl leading-tight font-semibold">
                        {offer.price}
                      </span>
                      <span className="block text-xs whitespace-nowrap text-muted-foreground">
                        {offer.period}
                      </span>
                    </p>
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-1.5 max-md:hidden">
                    <span className="text-3xl font-semibold">{offer.price}</span>
                    <span className="text-sm text-muted-foreground">{offer.period}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{offer.gross}</p>
                  <p className="text-sm text-pretty">{offer.note}</p>
                  {offer.seats ? <p className="text-sm font-medium">{offer.seats}</p> : null}
                  {offer.soldOut || owned ? null : (
                    <a
                      href={offerHref(offer.offer)}
                      {...buttonLink({
                        variant: offer.best ? "default" : "outline",
                        className: "mt-2 md:mt-auto",
                      })}
                    >
                      {offer.choose}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {owned ? (
              <p className="grid justify-items-start gap-1 text-sm text-pretty">
                {t.owned}
                <a href={localizedPath(language, planPath)} className="link-underline">
                  {t.ownedLink}
                </a>
              </p>
            ) : (
              <p className="text-sm text-pretty text-muted-foreground">{t.purchaseNote}</p>
            )}
          </section>
        </div>
        {purchasesOpen ? (
          <section
            aria-labelledby="prova"
            className="flex gap-4 rounded-2xl border bg-card p-5 sm:p-6"
          >
            <IconTile icon={Gift} tone="violet" size="lg" className="max-sm:size-9" />
            <div className="grid flex-1 gap-2">
              <h2 id="prova" className="text-lg font-semibold">
                {t.trialTitle}
              </h2>
              <p className="leading-relaxed text-pretty text-muted-foreground">{t.trialBody}</p>
            </div>
          </section>
        ) : null}
        <section aria-labelledby="confronto" className="grid gap-4">
          <h2 id="confronto" className="text-2xl font-semibold">
            {t.compare}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.feature}</TableHead>
                <TableHead>{t.free}</TableHead>
                <TableHead>{t.premium}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map(([label, free, premium]) => (
                <TableRow key={label}>
                  <TableHead scope="row" className="py-2 font-normal whitespace-normal">
                    {label}
                  </TableHead>
                  <TableCell className="whitespace-normal">{cell(free)}</TableCell>
                  <TableCell className="whitespace-normal">{cell(premium)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{t.taxNote}</p>
        </section>
        <section aria-labelledby="pagamenti" className="grid gap-4">
          <h2 id="pagamenti" className="text-2xl font-semibold">
            {t.paymentsTitle}
          </h2>
          <FaqList items={t.payments} />
        </section>
      </div>
    </SiteLayout>
  );
}
