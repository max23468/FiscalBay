import { env } from "cloudflare:workers";

import { appCopy } from "./app-copy";
import { faqPath, featuresPath, pricingPath, siteSecurityPath, supportPath } from "./app-links";
import { createAuth } from "./auth.server";
import {
  formatPrice,
  italianGross,
  premiumOffers,
  priceGeneration,
  type PremiumOffer,
} from "./catalog";
import { readPurchasesOpen } from "./domain/admission-state.server";
import { currentFreePromotion } from "./domain/grants.server";
import { readSession } from "./domain/sessions.server";
import { logFailure, tracePhase } from "./errors";
import { formatDate } from "./format";
import { sitePages } from "./copy/site-pages.server";
import { languageFromPath, languages, localizedPath, type Language } from "./i18n";

/**
 * Dati comuni delle pagine pubbliche: lingua, origine per canonical e Open Graph e sessione,
 * che porta `Apri l'app` nella barra al posto di `Accedi`. La pagina dipende quindi dalla
 * sessione e nessuna cache la conserva: il Worker risponde `no-store`. Con Auth o database non
 * disponibili la pagina resta consultabile come per chi non ha una sessione: non contiene dati
 * dell'account e l'app, raggiunta da `Accedi`, dice che non è disponibile.
 */
export async function publicPage(request: Request) {
  const session = await createAuth(env)
    .$context.then(() => readSession(env, request))
    .catch((error: unknown) => {
      logFailure({ request, code: "UPSTREAM_UNAVAILABLE", error, operation: "route" });
      return null;
    });
  tracePhase(request, "session");
  return {
    language: languageFromPath(new URL(request.url).pathname),
    origin: new URL(env.APP_ORIGIN).origin,
    session,
  };
}

/**
 * Listino delle pagine pubbliche (§23), lo stesso per Home e Prezzi: ogni prezzo netto con il
 * totale con l'IVA italiana al 22%, la promozione Free in corso con il solo giorno di fine, se c'è, e gli
 * acquisti con le prove aperti o sospesi dalla console. Tutto si legge a ogni richiesta: senza il
 * database la pagina risponde 503 (`areaPage`), senza promettere prova, quota o posti.
 */
export async function siteListing(language: Language) {
  const [admission, freePromotion] = await Promise.all([
    readPurchasesOpen(env.DB),
    currentFreePromotion(env.DB),
  ]);
  const prices = Object.fromEntries(
    premiumOffers.map((offer) => {
      const net = priceGeneration.net[offer];
      return [
        offer,
        { net: formatPrice(net, language), gross: formatPrice(italianGross(net), language) },
      ];
    }),
  ) as Record<PremiumOffer, { net: string; gross: string }>;
  return {
    purchasesOpen: Boolean(admission?.open),
    prices,
    freePromotion,
    promotionEnd: freePromotion?.endsAt ? formatDate(freePromotion.endsAt, language, "date") : null,
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
    ].map(([title, path, description]) => {
      return `- [${title}](${origin}${localizedPath(language, path!)}): ${description}`;
    });
    return `## ${sectionTitles[language]}\n\n${links.join("\n")}`;
  });
  return `# FiscalBay\n\n> ${intro.description}\n\n${intro.body}\n\n${sections.join("\n\n")}\n`;
}
