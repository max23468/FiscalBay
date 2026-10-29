import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  headers as siteHeaders,
  loader as loadSite,
  meta as siteRouteMeta,
} from "../app/routes/site";
import { loader as loadFeatures } from "../app/routes/features";
import { loader as loadPricing } from "../app/routes/pricing";
import { loader as loadSecurity } from "../app/routes/site-security";
import { loader as loadFaq, meta as faqMeta } from "../app/routes/faq";
import { loader as loadSupport } from "../app/routes/support";
import { loader as loadLegal } from "../app/routes/legal";
import { loader as loadRobots, robots } from "../app/routes/robots";
import { sitemap } from "../app/routes/sitemap";
import { indexable, isProductionOrigin } from "../app/app-links";
import { appCopy, infoEmail } from "../app/app-copy";
import { adminCopy } from "../app/copy/admin-copy";
import { legalDocuments, type LegalSection } from "../app/copy/legal-documents.server";
import { sitePages } from "../app/copy/site-pages.server";
import { italianGross } from "../app/catalog";
import { freeStoreChangeDays } from "../app/domain/free-store.server";
import { trialDays } from "../app/domain/grants.server";
import { legalVersions } from "../app/domain/registration.server";
import { freeHistoryDays } from "../app/domain/history-window.server";
import { formatDate } from "../app/format";
import { siteMeta } from "../app/site-meta";
import { resetDatabase } from "./fixtures/database-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { accessForm } from "./fixtures/account-route-fixtures";
import { callRoute } from "./fixtures/route-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("radice pubblica e area riservata", () => {
  const root = (path: string, cookie?: string) =>
    callRoute(loadSite, path, { cookie }).catch((thrown: Response) => thrown);

  it("porta agli Ordini ogni utente con la sessione e mostra il sito all'anonimo, senza cache", async () => {
    const first = await verifiedSession("radice-uno@example.invalid");
    const second = await verifiedSession("radice-due@example.invalid");
    // Stesso indirizzo, tre visitatori: la pagina dell'anonimo non contiene dati di account.
    expect(await root("/")).toMatchObject({
      language: "it",
      signedIn: false,
      origin: "http://localhost:5173",
      baseFreeQuota: 5,
      freePromotion: null,
      copy: { quota: "Con il piano Free sblocchi 5 ordini ogni 7 giorni." },
    });
    expect(await root("/en")).toMatchObject({ language: "en", signedIn: false });
    for (const { cookie } of [first, second]) {
      for (const base of ["", "/en"]) {
        const response = (await root(base || "/", cookie)) as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`${base}/app/ordini`);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    }
    expect(siteHeaders()).toEqual({ "cache-control": "no-store" });
  });

  it("annuncia la promozione Free fino alla sua fine, poi la quota base", async () => {
    await env.DB.prepare(
      `INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
       VALUES ('lancio', '2026-09-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 10, ?1)`,
    )
      .bind(new Date().toISOString())
      .run();
    const promotion = { quota: 10, endsAt: "2026-11-01T00:00:00.000Z" };
    // La fine della promozione è un giorno, senza l'orario, in home come in Prezzi.
    const line =
      "Promozione Free: 10 ordini da sbloccare ogni 7 giorni nei cicli che iniziano entro il 1 nov 2026, poi 5.";
    expect(await root("/")).toMatchObject({ freePromotion: promotion, copy: { quota: line } });
    expect((await callRoute(loadPricing, "/prezzi")).copy.promotion).toBe(line);
    expect(sitePages.it.home.freePromotion(10, formatDate(promotion.endsAt, "it", "date"), 5)).toBe(
      line,
    );
    vi.setSystemTime(new Date(promotion.endsAt));
    expect(await root("/en")).toMatchObject({ baseFreeQuota: 5, freePromotion: null });
  });

  it("mostra in home il netto con il totale IVA e la prova soltanto con gli acquisti aperti", async () => {
    expect((await callRoute(loadSite, "/")).copy).toMatchObject({
      premiumPrice: "4,90\u00a0€ + IVA al mese o 49\u00a0€ + IVA all’anno",
      premiumGross: "5,98\u00a0€ al mese o 59,78\u00a0€ all’anno con IVA italiana al 22%",
      premiumBody: expect.stringMatching(/\. Prova di 14 giorni senza carta\.$/u),
    });
    // Con acquisti e prove sospesi dalla console la home lo dice come Prezzi.
    await env.DB.prepare(
      `INSERT INTO admission_settings (id, free_waitlist, purchases_open, updated_at)
       VALUES (1, 0, 0, ?1)`,
    )
      .bind(new Date().toISOString())
      .run();
    const { copy } = await callRoute(loadSite, "/en");
    expect(copy).toMatchObject({
      premiumGross: "€5.98 per month or €59.78 per year with 22% Italian VAT",
      premiumBody: expect.stringMatching(
        /\. New Premium purchases and trials are paused for now\.$/u,
      ),
    });
    expect(copy.premiumBody).not.toContain("14-day");
    expect((await callRoute(loadPricing, "/en/prezzi")).copy.purchaseNote).toBe(
      sitePages.en.pricing.closed,
    );
  });

  it("visita il sito pubblico mantenendo la sessione e torna all'app senza ciclo", async () => {
    const user = await verifiedSession("radice-visita@example.invalid");
    const session = user.cookie.split(";")[0]!;
    const visit = (await root("/en?visita=1", session)) as Response;
    expect(visit.status).toBe(302);
    expect(visit.headers.get("location")).toBe("/en");
    expect(visit.headers.get("cache-control")).toBe("no-store");
    expect(visit.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=1; Path=/; HttpOnly; SameSite=Lax",
    ]);
    const visiting = `${session}; fiscalbay_visita=1`;
    expect(await root("/en", visiting)).toMatchObject({ language: "en", signedIn: true });
    expect(await root("/", visiting)).toMatchObject({ language: "it", signedIn: true });
    // La scelta di visita senza sessione non apre nulla.
    expect(await root("/", "fiscalbay_visita=1")).toMatchObject({ signedIn: false });

    const back = (await root("/en?visita=0", visiting)) as Response;
    expect(back.headers.get("location")).toBe("/en/app/ordini");
    expect(back.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    ]);
    expect(((await root("/", session)) as Response).headers.get("location")).toBe("/app/ordini");

    // L'uscita riporta al sito pubblico e dimentica la scelta.
    const signOut = await accessForm("/accesso", { intent: "esci" }, visiting);
    expect(signOut.headers.get("location")).toBe("/");
    expect(signOut.headers.getSetCookie()).toContain("fiscalbay_visita=; Path=/; Max-Age=0");
  });

  it("indicizza solo le pagine pubbliche del dominio di produzione", async () => {
    for (const path of [
      "/",
      "/en",
      "/funzionalita",
      "/en/prezzi",
      "/sicurezza",
      "/en/faq",
      "/supporto",
      "/en/supporto",
    ]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(true);
      expect(indexable("https://test.fiscalbay.it", path)).toBe(false);
    }
    for (const path of [
      // Termini e Privacy restano raggiungibili ma `noindex` (D204).
      "/termini",
      "/en/privacy",
      "/app/ordini",
      "/en/app/negozi/x",
      "/app/novita",
      "/accesso",
      "/admin",
      "/anteprima",
    ]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(false);
    }
    // Production si riconosce dall'host, non dalla grafia dell'origine. Le varianti si
    // compongono dall'host: nelle fixture compaiono soltanto host ammessi.
    for (const origin of [
      "https://fiscalbay.it",
      "https://fiscalbay.it/",
      "https://FiscalBay.it:443",
      "http://fiscalbay.it",
      ...["www.fiscalbay.it", "fiscalbay.it."].map((host) => `https://${host}`),
    ])
      expect(isProductionOrigin(origin), origin).toBe(true);
    for (const origin of [
      "https://test.fiscalbay.it",
      "http://localhost:5173",
      "https://fiscalbay.it.esempio.invalid",
      "https://esempio.invalid/fiscalbay.it",
    ])
      expect(isProductionOrigin(origin), origin).toBe(false);
    // Fuori dalla produzione robots.txt chiude tutto il dominio.
    expect(await loadRobots().text()).toBe("User-agent: *\nDisallow: /\n");
    // In produzione chiude le aree private, indica la sitemap e lascia raggiungibili i legali,
    // il cui `noindex` arriva dall'header.
    const production = robots("https://fiscalbay.it");
    expect(production).toContain("Disallow: /app/\nDisallow: /en/app/\n");
    // Ogni regola è un prefisso: icone, logo e immagini pubbliche restano fuori dai divieti,
    // le pagine dell'area dentro.
    const disallowed = (path: string) =>
      [...production.matchAll(/^Disallow: (\S+)$/gmu)].some(([, rule]) => path.startsWith(rule!));
    for (const path of [
      "/apple-touch-icon.png",
      "/favicon.ico",
      "/favicon.svg",
      "/ebay-logo.svg",
      "/og/fiscalbay-it.png",
      "/site/ordini-it-light.webp",
      "/prezzi",
      "/en/sicurezza",
    ])
      expect(disallowed(path), path).toBe(false);
    for (const path of [
      "/app/ordini",
      "/en/app/negozi",
      "/admin",
      "/anteprima/ordini",
      "/api/v1/x",
    ])
      expect(disallowed(path), path).toBe(true);
    expect(production).toContain("Disallow: /anteprima\nDisallow: /en/anteprima\n");
    expect(production).toMatch(/\nSitemap: https:\/\/fiscalbay\.it\/sitemap\.xml\n$/u);
    expect(production).not.toMatch(/termini|privacy|prezzi/u);
  });

  it("elenca nella sitemap le sole pagine canoniche, in ogni lingua con le alternate", () => {
    const xml = sitemap("https://fiscalbay.it");
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    expect(locations).toEqual(
      ["", "/funzionalita", "/prezzi", "/sicurezza", "/faq", "/supporto"].flatMap((path) => [
        `https://fiscalbay.it${path || "/"}`,
        `https://fiscalbay.it/en${path}`,
      ]),
    );
    expect(xml).toContain(
      '<url><loc>https://fiscalbay.it/en/prezzi</loc><xhtml:link rel="alternate" hreflang="it" href="https://fiscalbay.it/prezzi"/><xhtml:link rel="alternate" hreflang="en" href="https://fiscalbay.it/en/prezzi"/><xhtml:link rel="alternate" hreflang="x-default" href="https://fiscalbay.it/prezzi"/></url>',
    );
    expect(xml).not.toMatch(/termini|privacy|accesso|\/app/u);
  });

  it("dà alla home i dati strutturati veri e l'italiano come x-default, alla FAQ le sue domande", async () => {
    const home = siteRouteMeta({
      loaderData: await callRoute(loadSite, "/"),
    } as Parameters<typeof siteRouteMeta>[0]);
    expect(home).toEqual(
      expect.arrayContaining([
        { title: "FiscalBay | Recupera il Codice Fiscale dagli ordini eBay" },
        { tagName: "link", rel: "canonical", href: "http://localhost:5173/" },
        { tagName: "link", rel: "alternate", hrefLang: "en", href: "http://localhost:5173/en" },
        {
          tagName: "link",
          rel: "alternate",
          hrefLang: "x-default",
          href: "http://localhost:5173/",
        },
      ]),
    );
    const structured = (meta: unknown[]) =>
      (meta as Record<string, unknown>[]).find((item) => "script:ld+json" in item)![
        "script:ld+json"
      ];
    const graph = structured(home) as {
      "@graph": Record<string, unknown>[];
    };
    // I contatti generali sono `info@`: `supporto@` resta all'assistenza clienti (§14).
    expect(graph["@graph"]).toEqual([
      {
        "@type": "Organization",
        "@id": "http://localhost:5173/#organization",
        name: "FiscalBay",
        url: "http://localhost:5173/",
        logo: "http://localhost:5173/apple-touch-icon.png",
        email: infoEmail,
      },
      {
        "@type": "WebSite",
        name: "FiscalBay",
        url: "http://localhost:5173/",
        inLanguage: "it",
        publisher: { "@id": "http://localhost:5173/#organization" },
      },
    ]);
    const english = siteRouteMeta({
      loaderData: await callRoute(loadSite, "/en"),
    } as Parameters<typeof siteRouteMeta>[0]);
    expect(english).toEqual(
      expect.arrayContaining([
        { tagName: "link", rel: "canonical", href: "http://localhost:5173/en" },
        {
          tagName: "link",
          rel: "alternate",
          hrefLang: "x-default",
          href: "http://localhost:5173/",
        },
      ]),
    );
    const faq = faqMeta({
      loaderData: await callRoute(loadFaq, "/en/faq"),
    } as Parameters<typeof faqMeta>[0]);
    const questions = structured(faq) as {
      "@type": string;
      inLanguage: string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(questions).toMatchObject({ "@type": "FAQPage", inLanguage: "en" });
    expect(questions.mainEntity).toEqual(
      sitePages.en.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    );
  });

  it("dà a ogni pagina pubblica canonical, alternate e Open Graph della propria lingua", () => {
    const meta = siteMeta({
      language: "en",
      origin: "https://fiscalbay.it",
      path: "/prezzi",
      title: "Pricing",
      description: "Prezzi",
    });
    expect(meta).toEqual(
      expect.arrayContaining([
        { title: "FiscalBay | Pricing" },
        { tagName: "link", rel: "canonical", href: "https://fiscalbay.it/en/prezzi" },
        { tagName: "link", rel: "alternate", hrefLang: "it", href: "https://fiscalbay.it/prezzi" },
        {
          tagName: "link",
          rel: "alternate",
          hrefLang: "x-default",
          href: "https://fiscalbay.it/prezzi",
        },
        { property: "og:locale", content: "en_GB" },
        { property: "og:locale:alternate", content: "it_IT" },
        { property: "og:url", content: "https://fiscalbay.it/en/prezzi" },
        { property: "og:image", content: "https://fiscalbay.it/og/fiscalbay-en.png" },
      ]),
    );
  });
});

describe("pagine del sito pubblico", () => {
  const visit = (cookie?: string) =>
    Promise.all([
      callRoute(loadFeatures, "/funzionalita", { cookie }),
      callRoute(loadPricing, "/en/prezzi", { cookie }),
      callRoute(loadSecurity, "/sicurezza", { cookie }),
      callRoute(loadFaq, "/en/faq", { cookie }),
      callRoute(loadSupport, "/supporto", { cookie }),
      callRoute(loadLegal, "/en/termini", { cookie }),
    ]);

  it("restano sul sito anche con la sessione, che porta «Apri l'app» nella barra", async () => {
    const { cookie } = await verifiedSession("sito-pagine@example.invalid");
    const languages = ["it", "en", "it", "en", "it", "en"];
    expect(await visit()).toMatchObject(
      languages.map((language) => ({ language, signedIn: false })),
    );
    expect(await visit(cookie)).toMatchObject(
      languages.map((language) => ({ language, signedIn: true })),
    );
  });

  it("nomina Temisfera soltanto in Termini e Privacy, mai nel footer, nel sito o nell'app", async () => {
    // Testi e modelli, comprese le funzioni che compongono le frasi.
    const texts = (value: unknown): string[] =>
      typeof value === "string" || typeof value === "function"
        ? [String(value)]
        : value && typeof value === "object"
          ? Object.values(value).flatMap(texts)
          : [];
    const operator = (value: unknown) => texts(value).filter((text) => text.includes("Temisfera"));
    for (const language of ["it", "en"] as const) {
      expect(operator([appCopy[language], adminCopy[language], sitePages[language]])).toEqual([]);
      for (const document of ["termini", "privacy"] as const)
        expect(operator(legalDocuments[language][document][0])).not.toEqual([]);
    }
    const prefix = (language: "it" | "en") => (language === "it" ? "" : "/en");
    for (const language of ["it", "en"] as const) {
      const pages = await Promise.all([
        callRoute(loadSite, prefix(language) || "/"),
        callRoute(loadFeatures, `${prefix(language)}/funzionalita`),
        callRoute(loadPricing, `${prefix(language)}/prezzi`),
        callRoute(loadSecurity, `${prefix(language)}/sicurezza`),
        callRoute(loadFaq, `${prefix(language)}/faq`),
        callRoute(loadSupport, `${prefix(language)}/supporto`),
      ]);
      expect(JSON.stringify(pages)).not.toContain("Temisfera");
      for (const document of ["termini", "privacy"])
        expect(
          JSON.stringify(await callRoute(loadLegal, `${prefix(language)}/${document}`)),
        ).toContain("Temisfera");
    }
  });

  it("distingue Termini e Privacy con la versione e il testo del documento", async () => {
    expect(await callRoute(loadLegal, "/privacy")).toMatchObject({
      document: "privacy",
      version: legalVersions.privacy,
      sections: legalDocuments.it.privacy,
    });
    expect(await callRoute(loadLegal, "/en/termini")).toMatchObject({
      document: "termini",
      version: legalVersions.terms,
      sections: legalDocuments.en.termini,
    });
  });

  it("tiene allineati Termini e Privacy nelle due lingue", () => {
    const shape = (sections: LegalSection[]) =>
      sections.map(({ blocks }) =>
        blocks.map((block) =>
          typeof block === "string"
            ? "p"
            : "items" in block
              ? block.items.length
              : [block.head.length, block.rows.map((row) => row.length)],
        ),
      );
    for (const document of ["termini", "privacy"] as const)
      expect(shape(legalDocuments.en[document])).toEqual(shape(legalDocuments.it[document]));
    // Il contatto è info@, mai l'assistenza clienti; nessun segnaposto rimasto nei testi.
    const text = JSON.stringify(legalDocuments);
    expect(text).toContain(infoEmail);
    expect(text).not.toContain("supporto@");
    // La pagina collega il contatto una volta per blocco.
    const blocks = Object.values(legalDocuments).flatMap((documents) =>
      Object.values(documents).flatMap((sections) =>
        sections.flatMap(({ blocks }) =>
          blocks.flatMap((block) =>
            typeof block === "string" ? [block] : "items" in block ? block.items : [],
          ),
        ),
      ),
    );
    for (const block of blocks) expect(block.split(infoEmail).length).toBeLessThanOrEqual(2);
    expect(text).not.toMatch(/\[(da rileggere|to be checked|link)/iu);
  });

  it("mostra i posti lifetime reali, gli acquisti sospesi e la promozione in corso", async () => {
    expect(await callRoute(loadPricing, "/prezzi")).toMatchObject({
      baseFreeQuota: 5,
      freePromotion: null,
      lifetime: { left: 20, total: 20 },
      purchasesOpen: true,
    });
    const at = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('w-prezzi', 'Spazio', ?1)",
      ).bind(at),
      // Un posto prenotato da un Checkout aperto non è in vendita.
      env.DB.prepare(
        `INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at)
         VALUES (1, 'w-prezzi', 'reserved', ?2, ?1)`,
      ).bind(at, new Date(Date.now() + 3_600_000).toISOString()),
      env.DB.prepare(
        `INSERT INTO admission_settings (id, free_waitlist, purchases_open, updated_at)
         VALUES (1, 0, 0, ?1)`,
      ).bind(at),
      env.DB.prepare(
        `INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
         VALUES ('lancio', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', 10, ?1)`,
      ).bind(at),
    ]);
    const pricing = await callRoute(loadPricing, "/prezzi");
    expect(pricing).toMatchObject({
      freePromotion: { quota: 10, endsAt: "2099-01-01T00:00:00.000Z" },
      lifetime: { left: 19, total: 20 },
      purchasesOpen: false,
    });
    // Il Free mostra la quota della promozione; il prezzo netto ha accanto il totale con IVA.
    expect(pricing.copy).toMatchObject({
      freeItems: expect.arrayContaining(["10 ordini da sbloccare ogni 7 giorni"]),
      purchaseNote: "I nuovi acquisti di Premium e le prove sono sospesi per ora.",
      offers: [
        {
          offer: "monthly",
          price: "4,90\u00a0€",
          gross: "5,98\u00a0€ con IVA italiana al 22%",
          seats: null,
        },
        { offer: "annual", best: true, note: "12 mesi al prezzo di 10." },
        { offer: "lifetime", soldOut: false, seats: "Restano 19 posti su 20" },
      ],
    });
    expect(pricing.copy.promotion).toMatch(/^Promozione Free: 10 ordini/u);
  });

  it("lascia visibile il lifetime esaurito senza posti residui", async () => {
    const at = new Date().toISOString();
    // Venti prenotazioni di spazi diversi bastano a esaurire l'offerta.
    await env.DB.batch(
      Array.from({ length: 20 }, (_, index) => [
        env.DB.prepare(
          "INSERT INTO workspaces (id, name, created_at) VALUES (?1, 'Spazio', ?2)",
        ).bind(`w-${index}`, at),
        env.DB.prepare(
          `INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at)
           VALUES (?1, ?2, 'reserved', ?3, ?3)`,
        ).bind(index + 1, `w-${index}`, at),
      ]).flat(),
    );
    const { copy } = await callRoute(loadPricing, "/en/prezzi");
    expect(copy.offers.at(-1)).toMatchObject({
      offer: "lifetime",
      price: "€149",
      soldOut: true,
      seats: "Lifetime places have run out.",
    });
  });

  it("affianca al netto il totale con l'IVA italiana arrotondata al centesimo", () => {
    expect([490, 4900, 14900].map(italianGross)).toEqual([598, 5978, 18178]);
    // L'imposta della riga si arrotonda: 0,05 € netti danno 0,01 € di IVA.
    expect(italianGross(5)).toBe(6);
  });

  it("scrive nei testi la durata della prova, il cambio del negozio Free e il suo storico", () => {
    for (const language of ["it", "en"] as const) {
      const app = appCopy[language];
      const site = sitePages[language];
      // I numeri restano scritti nel testo: qui si confrontano con le regole del dominio.
      const days = (value: number) =>
        new RegExp(language === "it" ? `\\b${value} giorni\\b` : `\\b${value}[ -]days?\\b`, "u");
      const answers = site.faq.items.map((item) => item.a);
      const negozi = site.features.showcase.find((item) => item.shot === "negozi")!.body;
      const texts: Array<[number, string[]]> = [
        [
          trialDays,
          [
            app.orders.trialOffer,
            app.settings.plan.trialTitle,
            site.home.premiumTrial,
            site.pricing.description,
            site.pricing.trialTitle,
          ],
        ],
        [
          freeStoreChangeDays,
          [app.settings.plan.freeStoreHint, site.pricing.rows.stores.free, negozi],
        ],
        [
          freeHistoryDays,
          [
            app.settings.plan.freeSummary,
            site.pricing.rows.history.free,
            site.pricing.freeItems(5)[2]!,
            negozi,
          ],
        ],
      ];
      for (const [value, list] of texts)
        for (const text of list) expect(text, language).toMatch(days(value));
      // Le risposte della FAQ sulla prova e sui negozi del Free.
      expect(
        answers.filter((answer) => days(trialDays).test(answer)),
        language,
      ).toHaveLength(1);
      expect(
        answers.filter((answer) => days(freeStoreChangeDays).test(answer)),
        language,
      ).toHaveLength(1);
      expect(
        site.security.details.filter((item) => days(freeHistoryDays).test(item.body)),
        language,
      ).toHaveLength(1);
    }
  });
});
