import { env } from "cloudflare:workers";

import { createAuth } from "./auth.server";
import {
  formatPrice,
  italianGross,
  premiumOffers,
  priceGeneration,
  type PremiumOffer,
} from "./catalog";
import { purchasesOpenSql } from "./domain/admission-state.server";
import { currentFreePromotion } from "./domain/grants.server";
import { readSession } from "./domain/sessions.server";
import { tracePhase } from "./errors";
import { formatDate } from "./format";
import { languageFromPath, type Language } from "./i18n";

/**
 * Dati comuni delle pagine pubbliche: lingua, origine per canonical e Open Graph e sessione,
 * che porta `Apri l'app` nella barra al posto di `Accedi`. La pagina dipende quindi dalla
 * sessione e nessuna cache la conserva: il Worker risponde `no-store`.
 */
export async function publicPage(request: Request) {
  const auth = createAuth(env);
  await auth.$context;
  const session = await readSession(env, request);
  tracePhase(request, "session");
  return {
    language: languageFromPath(new URL(request.url).pathname),
    origin: new URL(env.APP_ORIGIN).origin,
    session,
  };
}

/**
 * Listino delle pagine pubbliche (§23), lo stesso per Home e Prezzi: ogni prezzo netto con il
 * totale con l'IVA italiana al 22%, la promozione Free in corso con il solo giorno di fine e gli
 * acquisti con le prove aperti o sospesi dalla console. Tutto si legge a ogni richiesta.
 */
export async function siteListing(language: Language) {
  const [admission, freePromotion] = await Promise.all([
    env.DB.prepare(`SELECT ${purchasesOpenSql} AS open`).first<{ open: number }>(),
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
    promotionEnd: freePromotion ? formatDate(freePromotion.endsAt, language, "date") : null,
  };
}
