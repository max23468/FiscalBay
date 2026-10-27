import { env } from "cloudflare:workers";
import { cn } from "cn";
import { BadgeCheck, ClipboardCopy, Plug, RefreshCcw } from "lucide-react";
import { redirect } from "react-router";

import { useCopy } from "~/components/copy-context";
import { FaqList } from "~/components/faq-list";
import { IconTile } from "~/components/icon-tile";
import { ProductShot, ShotRow, type ShotName } from "~/components/product-shot";
import { SiteLayout, siteColumn } from "~/components/site-layout";
import { Badge } from "~/components/ui/badge";
import { buttonLink } from "~/components/ui/button-variants";
import { supportEmail } from "../app-copy";
import { sitePages } from "../copy/site-pages.server";
import {
  accessPath,
  faqPath,
  featuresPath,
  ordersPath,
  pricingPath,
  visitCookie,
  visitParam,
} from "../app-links";
import { currentFreePromotion, freeQuotaSettings } from "../domain/grants.server";
import { languageFromPath, localizedPath } from "../i18n";
import { formatDate } from "../format";
import { formatPrice, priceGeneration } from "../catalog";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/site";

const noStore = { "cache-control": "no-store" };

/**
 * Radice pubblica. Con la sessione porta agli Ordini, salvo la scelta «Visita fiscalbay.it»:
 * il parametro diventa un cookie di sessione del browser e l'indirizzo torna pulito, così la
 * pagina resta una sola e non c'è un ciclo fra sito e app. La risposta dipende dalla sessione:
 * nessuna cache la conserva.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const visit = url.searchParams.get(visitParam);
  if (visit !== null) {
    const leaving = visit === "0";
    const secure = env.APP_ORIGIN.startsWith("https:") ? "; Secure" : "";
    const headers = new Headers(noStore);
    headers.append(
      "set-cookie",
      `${visitCookie}=${leaving ? "; Max-Age=0" : "1"}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    throw redirect(localizedPath(language, leaving ? ordersPath : "/"), { headers });
  }
  const visiting = (request.headers.get("cookie") ?? "")
    .split(";")
    .some((cookie) => cookie.trim() === `${visitCookie}=1`);
  const { origin, session } = await publicPage(request);
  if (session && !visiting) {
    throw redirect(localizedPath(language, ordersPath), { headers: noStore });
  }
  // Senza cache la pagina annuncia la promozione in corso e la quota base appena finisce.
  const [{ quota: baseFreeQuota }, freePromotion] = await Promise.all([
    freeQuotaSettings(env.DB),
    currentFreePromotion(env.DB),
  ]);
  const pages = sitePages[language];
  const { freeQuota, freePromotion: promotionLine, premiumPrice, ...copy } = pages.home;
  return {
    language,
    signedIn: Boolean(session),
    origin,
    baseFreeQuota,
    freePromotion,
    copy: {
      ...copy,
      premiumPrice: premiumPrice(
        formatPrice(priceGeneration.net.monthly, language),
        formatPrice(priceGeneration.net.annual, language),
      ),
      faq: pages.faq.items.slice(0, 4),
      shots: pages.shots,
      quota: freePromotion
        ? promotionLine(
            freePromotion.quota,
            formatDate(freePromotion.endsAt, language),
            baseFreeQuota,
          )
        : freeQuota(baseFreeQuota),
    },
  };
}

export function headers(): HeadersInit {
  return noStore;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaderData) return [];
  const { language, origin, copy } = loaderData;
  const organization = `${origin}/#organization`;
  return [
    ...siteMeta({ language, origin, path: "/", title: copy.title, description: copy.description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": organization,
            name: "FiscalBay",
            url: `${origin}/`,
            logo: `${origin}/apple-touch-icon.png`,
            email: supportEmail,
          },
          {
            "@type": "WebSite",
            name: "FiscalBay",
            url: `${origin}/`,
            inLanguage: language,
            publisher: { "@id": organization },
          },
        ],
      },
    },
  ];
}

// Sulla fascia blu i pulsanti restano chiari anche al passaggio e nel tema scuro.
const onBrand = "bg-white text-brand-navy hover:bg-white/90 hover:text-brand-navy";
const outlineOnBrand =
  "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent dark:hover:bg-white/10";

const stepIcons = [
  { icon: Plug, tone: "blue" },
  { icon: RefreshCcw, tone: "green" },
  { icon: ClipboardCopy, tone: "amber" },
] as const;

/** Id della sezione dei tre passaggi, meta di «Come funziona». */
const stepsId = "come-funziona";

const textLink = "font-medium text-primary underline-offset-4 hover:underline";

export default function Site({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  const site = useCopy().t.site;
  const primary = signedIn
    ? { href: `${localizedPath(language)}?${visitParam}=0`, label: site.openApp }
    : { href: `${localizedPath(language, accessPath)}?registrati`, label: site.start };
  return (
    <SiteLayout path="/" signedIn={signedIn}>
      <section className="relative overflow-hidden bg-brand-navy text-white">
        {/* Righe della tessera del logo, come nella pagina di accesso. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-24 grid rotate-[-8deg] gap-6 opacity-20"
        >
          <span className="h-8 w-[28rem] rounded-full bg-brand-sky" />
          <span className="h-8 w-80 rounded-full bg-brand-green" />
          <span className="h-8 w-40 rounded-full bg-brand-red" />
        </div>
        <div
          className={cn(
            siteColumn,
            "relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-20",
          )}
        >
          <div className="grid gap-6">
            <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
              {t.hero}
            </h1>
            <p className="text-lg leading-relaxed text-pretty text-white/80">{t.body}</p>
            <div className="flex flex-wrap gap-3">
              <a href={primary.href} {...buttonLink({ size: "lg", className: onBrand })}>
                {primary.label}
              </a>
              <a
                href={`#${stepsId}`}
                {...buttonLink({ variant: "outline", size: "lg", className: outlineOnBrand })}
              >
                {t.howItWorks}
              </a>
            </div>
            <ul className="grid gap-2 text-sm text-white/80 sm:flex sm:flex-wrap sm:gap-x-6">
              {t.trust.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <BadgeCheck aria-hidden="true" className="size-4 shrink-0 text-brand-sky" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ProductShot
            name="ordini"
            language={language}
            alt={t.shots.ordini}
            priority
            className="border-white/20 shadow-2xl shadow-black/30 max-sm:mx-auto max-sm:max-w-sm"
          />
        </div>
      </section>
      <section
        id={stepsId}
        aria-labelledby={`${stepsId}-titolo`}
        className={cn(siteColumn, "grid scroll-mt-4 gap-8 py-14 sm:py-16")}
      >
        <h2 id={`${stepsId}-titolo`} className="text-2xl font-semibold sm:text-3xl">
          {t.howItWorks}
        </h2>
        <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
          {t.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 md:grid md:content-start md:gap-3">
              <IconTile icon={stepIcons[index]!.icon} tone={stepIcons[index]!.tone} size="lg" />
              <div className="grid content-start gap-1.5">
                <h3 className="font-semibold">{step.title}</h3>
                <p className="leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="dentro-fiscalbay" className="border-y bg-muted/40">
        <div className={cn(siteColumn, "grid gap-14 py-14 sm:gap-20 sm:py-20")}>
          <h2 id="dentro-fiscalbay" className="text-2xl font-semibold sm:text-3xl">
            {t.showcaseTitle}
          </h2>
          {t.highlights.map((item, index) => (
            <ShotRow
              key={item.shot}
              id={`dentro-${item.shot}`}
              title={item.title}
              badge={item.premium ? <Badge variant="premium">{t.premium}</Badge> : null}
              body={item.body}
              shot={item.shot as ShotName}
              language={language}
              alt={t.shots[item.shot as ShotName]}
              reverse={index % 2 === 1}
            />
          ))}
          <a href={localizedPath(language, featuresPath)} className={cn(textLink, "w-fit")}>
            {t.allFeatures}
          </a>
        </div>
      </section>
      <section aria-labelledby="piani" className={cn(siteColumn, "grid gap-6 py-14 sm:py-16")}>
        <h2 id="piani" className="text-2xl font-semibold sm:text-3xl">
          {t.plansTitle}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2 rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">{t.freePlan}</h3>
            <p className="text-3xl font-semibold">{t.freePrice}</p>
            <p className="leading-relaxed text-pretty text-muted-foreground">{t.quota}</p>
          </div>
          <div className="grid content-start gap-2 rounded-2xl border border-primary bg-card p-6 ring-1 ring-primary">
            <h3 className="font-semibold">{t.premiumPlan}</h3>
            <p className="text-lg font-semibold text-pretty">{t.premiumPrice}</p>
            <p className="leading-relaxed text-pretty text-muted-foreground">{t.premiumBody}</p>
          </div>
        </div>
        <a href={localizedPath(language, pricingPath)} className={cn(textLink, "w-fit")}>
          {t.pricingLink}
        </a>
      </section>
      <section aria-labelledby="domande" className="border-t">
        <div className={cn(siteColumn, "grid max-w-3xl gap-6 py-14 sm:py-16")}>
          <h2 id="domande" className="text-2xl font-semibold sm:text-3xl">
            {t.faqTitle}
          </h2>
          <FaqList items={t.faq} />
          <a href={localizedPath(language, faqPath)} className={cn(textLink, "w-fit")}>
            {t.faqLink}
          </a>
        </div>
      </section>
      <section className="bg-brand-navy text-white">
        <div className={cn(siteColumn, "flex flex-wrap items-center justify-between gap-6 py-12")}>
          <p className="text-2xl font-semibold text-balance">{t.closing}</p>
          <a href={primary.href} {...buttonLink({ size: "lg", className: onBrand })}>
            {primary.label}
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
