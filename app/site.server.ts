import { env } from "cloudflare:workers";
import { getSessionCookie } from "better-auth/cookies";

import { appCopy } from "./app-copy";
import {
  faqPath,
  featuresPath,
  guidePaths,
  guidesPath,
  pricingPath,
  sitemapPages,
  siteSecurityPath,
  supportPath,
} from "./app-links";
import { createAuth, readSession } from "./auth.server";
import {
  formatPrice,
  italianGross,
  premiumOffers,
  priceGeneration,
  type PremiumOffer,
} from "./catalog";
import { readPurchasesOpen } from "./domain/admission-state.server";
import { currentFreePromotion, freeQuotaSettings } from "./domain/grants.server";
import { lifetimeSlotsLeft } from "./domain/lifetime.server";
import { skipPageCache } from "./page-cache.server";
import { logFailure, tracePhase } from "./errors";
import { formatDate } from "./format";
import { guides } from "./copy/guides.server";
import { sitePages } from "./copy/site-pages.server";
import { languageFromPath, languages, localizedPath, type Language } from "./i18n";
import type { FaqItem } from "./components/faq-list";

/** Domande del sito con la guida collegata, portata nella lingua della pagina. */
export function faqItems(
  items: readonly { q: string; a: string; guide?: { label: string; path: string } }[],
  language: Language,
): FaqItem[] {
  return items.map(({ q, a, guide }) =>
    guide
      ? { q, a, link: { label: guide.label, href: localizedPath(language, guide.path) } }
      : { q, a },
  );
}

/**
 * Dati comuni delle pagine pubbliche: lingua, origine per canonical e Open Graph e sessione,
 * che porta `Apri l'app` nella barra al posto di `Accedi`. La pagina dipende quindi dalla
 * sessione e nessuna cache la conserva: il Worker risponde `no-store`. Con Auth o database non
 * disponibili la pagina resta consultabile come per chi non ha una sessione: non contiene dati
 * dell'account e l'app, raggiunta da `Accedi`, dice che non è disponibile.
 */
export async function publicPage(request: Request) {
  // Senza il cookie di sessione non c'è nulla da leggere: niente Auth né database.
  const session = getSessionCookie(request)
    ? await createAuth(env)
        .$context.then(() => readSession(env, request))
        .catch((error: unknown) => {
          logFailure({ request, code: "UPSTREAM_UNAVAILABLE", error, operation: "route" });
          return null;
        })
    : null;
  tracePhase(request, "session");
  return {
    language: languageFromPath(new URL(request.url).pathname),
    origin: new URL(env.APP_ORIGIN).origin,
    session,
  };
}

/**
 * Listino delle pagine pubbliche (§23), lo stesso per Home e Prezzi: ogni prezzo netto con il
 * totale con l'IVA italiana al 22%, la quota Free, la promozione in corso con il solo giorno di
 * fine, se c'è, i posti lifetime e gli acquisti con le prove aperti o sospesi dalla console. Senza
 * il database resta il listino di riserva: i prezzi del catalogo, senza promettere prova, quota,
 * promozione o posti, e le pagine restano consultabili invece di rispondere 503.
 */
export async function siteListing(request: Request, language: Language) {
  const prices = Object.fromEntries(
    premiumOffers.map((offer) => {
      const net = priceGeneration.net[offer];
      return [
        offer,
        { net: formatPrice(net, language), gross: formatPrice(italianGross(net), language) },
      ];
    }),
  ) as Record<PremiumOffer, { net: string; gross: string }>;
  const read = await (async () => {
    try {
      return await Promise.all([
        readPurchasesOpen(env.DB),
        currentFreePromotion(env.DB),
        freeQuotaSettings(env.DB),
        lifetimeSlotsLeft(env.DB),
      ]);
    } catch (error) {
      logFailure({ request, code: "UPSTREAM_UNAVAILABLE", error, operation: "route" });
      return null;
    }
  })();
  tracePhase(request, "listing");
  if (!read) {
    // La riserva vale finché il database non risponde: nessuna copia la conserva.
    skipPageCache();
    return {
      reserve: true as const,
      purchasesOpen: false,
      prices,
      baseQuota: null,
      freePromotion: null,
      promotionEnd: null,
      lifetimeLeft: null,
    };
  }
  const [admission, freePromotion, { quota: baseQuota }, lifetimeLeft] = read;
  return {
    reserve: false as const,
    purchasesOpen: Boolean(admission?.open),
    prices,
    baseQuota,
    freePromotion,
    promotionEnd: freePromotion?.endsAt ? formatDate(freePromotion.endsAt, language, "date") : null,
    lifetimeLeft,
  };
}

const sectionTitles: Record<Language, string> = { it: "Pagine", en: "English pages" };

/**
 * Guida per gli assistenti AI nel formato llms.txt (llmstxt.org): cosa fa FiscalBay e le pagine
 * della sitemap con la loro descrizione, in italiano e in inglese. Titoli e descrizioni sono
 * gli stessi dei metadati delle pagine, così restano allineati.
 */
export function llms(origin: string) {
  const intro = sitePages.it.home;
  const sections = languages.map((language) => {
    const pages = sitePages[language];
    const links = [
      [pages.home.title, "/", pages.home.description],
      [pages.features.title, featuresPath, pages.features.description],
      [pages.pricing.title, pricingPath, pages.pricing.description],
      [pages.security.title, siteSecurityPath, pages.security.description],
      [pages.faq.title, faqPath, pages.faq.description],
      [appCopy[language].supportPage.title, supportPath, appCopy[language].supportPage.description],
      [guides[language].index.title, guidesPath, guides[language].index.description],
      ...guidePaths.map((path) => {
        const article = guides[language].articles[path];
        return [article.title, path, article.description];
      }),
    ].map(([title, path, description]) => {
      return `- [${title}](${origin}${localizedPath(language, path!)}): ${description}`;
    });
    return `## ${sectionTitles[language]}\n\n${links.join("\n")}`;
  });
  return `# FiscalBay\n\n> ${intro.description}\n\n${intro.body}\n\n${sections.join("\n\n")}\n`;
}

/**
 * Giorno dell'ultima modifica sostanziale del contenuto di ogni pagina, per `lastmod`: si
 * aggiorna con il testo della pagina, non a ogni rilascio. Le guide portano la propria data.
 */
const pageUpdates: Record<(typeof sitemapPages)[number], string> = {
  "/": "2026-11-06",
  "/funzionalita": "2026-11-06",
  "/prezzi": "2026-11-06",
  "/sicurezza": "2026-11-06",
  "/faq": "2026-11-06",
  "/supporto": "2026-11-03",
  "/guide": "2026-11-08",
  ...Object.fromEntries(guidePaths.map((path) => [path, guides.it.articles[path].updated])),
} as Record<(typeof sitemapPages)[number], string>;

/**
 * Sitemap delle sole pagine pubbliche canoniche, in ogni lingua con le alternate: Termini e
 * Privacy restano fuori perché `noindex` (D204). Fuori dalla produzione le pagine elencate
 * rispondono comunque `noindex` e robots.txt chiude il dominio.
 */
export function sitemap(origin: string) {
  const alternates = (path: string) =>
    [...languages, "x-default" as const]
      .map((code) => {
        const href = `${origin}${code === "x-default" ? path : localizedPath(code, path)}`;
        return `<xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>`;
      })
      .join("");
  const urls = sitemapPages.flatMap((path) =>
    languages.map(
      (language) =>
        `<url><loc>${origin}${localizedPath(language, path)}</loc><lastmod>${pageUpdates[path]}</lastmod>${alternates(path)}</url>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}
