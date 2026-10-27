import { env } from "cloudflare:workers";
import { cn } from "cn";
import { BadgeCheck, ClipboardCopy, Plug, RefreshCcw } from "lucide-react";
import { redirect } from "react-router";

import { useCopy } from "~/components/copy-context";
import { IconTile } from "~/components/icon-tile";
import { SiteLayout, siteColumn } from "~/components/site-layout";
import { buttonLink } from "~/components/ui/button-variants";
import { supportEmail } from "../app-copy";
import { sitePages } from "../copy/site-pages.server";
import {
  accessPath,
  featuresPath,
  ordersPath,
  pricingPath,
  visitCookie,
  visitParam,
} from "../app-links";
import { currentFreePromotion, freeQuotaSettings } from "../domain/grants.server";
import { languageFromPath, localizedPath } from "../i18n";
import { formatDate } from "../format";
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
  const { freeQuota, freePromotion: promotionLine, ...copy } = sitePages[language].home;
  return {
    language,
    signedIn: Boolean(session),
    origin,
    baseFreeQuota,
    freePromotion,
    copy: {
      ...copy,
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
          className="pointer-events-none absolute -right-24 -bottom-16 grid rotate-[-8deg] gap-6 opacity-25"
        >
          <span className="h-8 w-[28rem] rounded-full bg-brand-sky" />
          <span className="h-8 w-80 rounded-full bg-brand-green" />
          <span className="h-8 w-40 rounded-full bg-brand-red" />
        </div>
        <div className={cn(siteColumn, "relative grid gap-6 py-16 sm:py-24")}>
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            {t.hero}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-pretty text-white/80">{t.body}</p>
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
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {t.trust.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <BadgeCheck aria-hidden="true" className="size-4 text-brand-sky" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section
        id={stepsId}
        aria-labelledby={`${stepsId}-titolo`}
        className={cn(siteColumn, "grid scroll-mt-4 gap-8 py-16")}
      >
        <h2 id={`${stepsId}-titolo`} className="text-2xl font-semibold">
          {t.howItWorks}
        </h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {t.steps.map((step, index) => (
            <li key={step.title} className="grid content-start gap-3">
              <IconTile icon={stepIcons[index]!.icon} tone={stepIcons[index]!.tone} size="lg" />
              <h3 className="font-semibold">{step.title}</h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 border-t pt-8">
          <p className="text-pretty">{t.quota}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href={localizedPath(language, pricingPath)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.pricingLink}
            </a>
            <a
              href={localizedPath(language, featuresPath)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.allFeatures}
            </a>
          </div>
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
