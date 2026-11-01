import type { Locator, Page } from "@playwright/test";
import { expect, networkIdle, test, watchNetwork } from "./fixtures";
import { areas, clickHydrated, enter, open, searched, setScenario } from "./components";
import { useLocalAccount } from "./local-account";
import { whatsNew } from "./page-cases";
import { testAccount } from "./test-account";

/*
 * Shell e sezioni dell'app sugli scenari sintetici dell'anteprima.
 * Ogni prova usa un contesto nuovo, quindi parte dallo scenario ordinario.
 * Le prove dei comportamenti già presenti nell'area reale girano anche sulle route reali, con la
 * sessione e gli ordini sintetici del database locale; l'anteprima resta per gli stati rari.
 */

/** Navigazione principale degli Ordini, uguale nell'anteprima e nell'area reale. */
async function expectOrdersNavigation(page: Page) {
  await expect(page).toHaveTitle("FiscalBay | Ordini");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(nav.getByRole("link")).toHaveText(["Ordini", "Negozi eBay", "Impostazioni"]);
  await expect(nav.getByRole("link", { name: "Ordini" })).toHaveAttribute("aria-current", "page");
}

/** Dal menu account si arriva alla categoria Account dell'area aperta. */
async function openAccountFromMenu(page: Page, base: string) {
  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  // L'anteprima non ha la pagina Novità; l'area reale la mostra quando il changelog ha voci.
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Account",
    "Piano e pagamenti",
    "Impostazioni",
    ...(base === "/app" && whatsNew ? ["Novità"] : []),
    "Visita fiscalbay.it",
    "Esci",
  ]);
  await menu.getByRole("menuitem", { name: "Account" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/impostazioni/account$`, "u"));
  await expect(page.getByRole("heading", { name: "Account", level: 2 })).toBeVisible();
}

/**
 * Ricerca della top bar con un solo risultato: elenco filtrato con la query cifrata
 * nell'indirizzo, poi il dettaglio dal suggerimento. Restituisce il pannello aperto.
 */
async function searchFromTopBar(page: Page, base: string, query: string, suggestion: RegExp) {
  const search = page.getByRole("searchbox", { name: "Cerca ordini" });
  await search.fill(query);
  const link = page.getByRole("search").getByRole("link", { name: suggestion });
  await expect(link).toBeVisible();
  await page.getByRole("link", { name: "Vedi tutti i risultati (1)" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${base}/ordini\\?ricerca=[\\w-]+(?:[?&]vista=[0-9a-z]+)?$`, "u"),
  );
  expect(page.url()).not.toContain(query);
  await expect(search).toHaveValue(query);
  await expect(
    page.getByRole("region", { name: "Elenco ordini" }).getByRole("article"),
  ).toHaveCount(1);
  await search.fill("");
  await search.fill(query);
  await link.click();
  await expect(page).toHaveURL(
    new RegExp(`${base}/ordini/[^/?]+\\?ricerca=[\\w-]+(?:[?&]vista=[0-9a-z]+)?$`, "u"),
  );
  return page.getByRole("dialog");
}

/** Indirizzo inesistente, filtro sconosciuto e ricerca senza risultati restano nell'app. */
async function expectOrdersFallbacks(page: Page, base: string, missing: string, total: string) {
  const response = await page.goto(`${base}/ordini/${missing}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Ordine non trovato" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
  await page.getByRole("link", { name: "Torna agli ordini" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/ordini(?:[?&]vista=[0-9a-z]+)?$`, "u"));

  await open(page, `${base}/ordini?pagamento=sconosciuto`);
  await expect(page.getByRole("combobox", { name: "Pagamento" })).toContainText("Tutti");
  await expect(page.getByText(total)).toBeVisible();

  await open(page, await searched(page, "zzzz", base));
  await expect(page.getByRole("searchbox").first()).toHaveValue("zzzz");
  await expect(page.getByText("Prova un’altra ricerca.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancella ricerca" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seleziona" })).toBeDisabled();
}

/** La conferma forte abilita l'eliminazione soltanto con il nome esatto del negozio. */
async function confirmStoreDeletion(page: Page, dialog: Locator, name: string) {
  await dialog.getByRole("button", { name: "Scollega ed elimina negozio" }).click();
  const confirm = page.getByRole("alertdialog");
  const button = confirm.getByRole("button", { name: "Scollega ed elimina negozio" });
  await expect(button).toBeDisabled();
  await confirm.getByRole("textbox").fill(name);
  await expect(button).toBeEnabled();
  return { confirm, button };
}

async function chooseScenario(page: Page, name: string) {
  await page.getByRole("combobox", { name: /Scenario/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("combobox", { name: /Scenario/ })).toContainText(name);
}

test(
  "la radice apre Ordini con navigazione, campanella e menu account",
  { tag: "@smoke" },
  async ({ page }) => {
    await open(page, "/anteprima");
    await expect(page).toHaveURL(/\/anteprima\/ordini(?:[?&]vista=[0-9a-z]+)?$/u);
    await expectOrdersNavigation(page);
    await page.getByRole("button", { name: "Notifiche, 1 da leggere" }).click();
    await expect(page.getByText("Manutenzione programmata")).toBeVisible();
    await page.getByRole("button", { name: "Segna tutte come lette" }).click();
    await expect(page.getByRole("button", { name: "Notifiche", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await openAccountFromMenu(page, "/anteprima");
  },
);

for (const area of areas)
  test(`il dettaglio ha un URL, si chiude con Indietro e conserva i filtri, ${area.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await enter(context, baseURL!, area);
    await open(page, `${area.base}/ordini?fiscale=available`);
    const list = page.getByRole("region", { name: "Elenco ordini" });
    const first = list.getByRole("article").first();
    const buyer = (await first.getByRole("heading", { level: 2 }).textContent()) ?? "";
    await first.getByRole("link", { name: "Dettaglio" }).click();
    await expect(page).toHaveURL(
      new RegExp(`${area.base}/ordini/[^/?]+\\?fiscale=available(?:[?&]vista=[0-9a-z]+)?$`, "u"),
    );
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(buyer);
    await dialog.getByRole("tab", { name: /Articoli/ }).click();
    await expect(dialog.getByRole("tabpanel", { name: /Articoli/ })).toContainText(
      area.base === "/app" ? "Articolo di collaudo" : "SKU",
    );
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`${area.base}/ordini\\?fiscale=available(?:[?&]vista=[0-9a-z]+)?$`, "u"),
    );
    const entries = await page.evaluate(() => history.length);
    const details = first.getByRole("link", { name: "Dettaglio" });
    await details.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await expect(dialog.getByText("Ultima modifica su eBay")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\?fiscale=available(?:[?&]vista=[0-9a-z]+)?$/u);
    // La chiusura torna alla voce dell'elenco, senza aggiungerne una: Indietro non riapre il
    // pannello. Il dettaglio aperto ha preso il posto della voce in avanti lasciata da Indietro.
    await expect(first.getByRole("heading", { level: 2 }).getByRole("link")).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(entries);
  });

/** Trattiene le risposte dei dati finché la prova non le libera. */
async function holdData(page: Page) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\.data(?:\?|$)/u, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

for (const area of areas)
  test(`durante il caricamento filtri, elenco e navigazione mostrano la scelta, ${area.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await enter(context, baseURL!, area);
    await open(page, `${area.base}/ordini`);
    const list = page.getByRole("region", { name: "Elenco ordini" });
    const period = page.getByRole("combobox", { name: "Periodo" });
    let release = await holdData(page);
    await period.click();
    await page.getByRole("option", { name: "Ultimi 30 giorni" }).click();
    // Il filtro non torna al valore precedente e l'elenco mostrato resta, attenuato.
    await expect(period).toContainText("Ultimi 30 giorni");
    const changing = page.locator('main [aria-busy="true"]', { has: list });
    await expect(changing).toHaveCSS("opacity", "0.6");
    await expect(page.locator(".navigation-progress")).toHaveAttribute("data-phase", "loading");
    release();
    await expect(page).toHaveURL(/periodo=30/u);
    // Il nuovo elenco, anche vuoto, arriva senza attenuazione.
    await expect(page.locator("main [aria-busy], main[aria-busy]")).toHaveCount(0);
    await page.unrouteAll({ behavior: "wait" });
    // La voce scelta diventa subito quella evidenziata, prima che la pagina arrivi.
    release = await holdData(page);
    const nav = page.getByRole("navigation", { name: "Navigazione principale" });
    const stores = nav.getByRole("link", { name: "Negozi eBay" });
    await stores.click();
    await expect(stores).toHaveClass(/\bpending\b/u);
    const link = await stores.boundingBox();
    // La barra sotto la voce rientra di 0,75 rem come il segno statico che sostituisce.
    await expect
      .poll(async () => (await nav.locator("li[aria-hidden]").boundingBox())?.x)
      .toBeCloseTo(link!.x + 12, 0);
    release();
    await expect(page).toHaveTitle("FiscalBay | Negozi eBay");
    await expect(stores).toHaveAttribute("aria-current", "page");
  });

for (const area of areas)
  test(`«Visita fiscalbay.it» apre il sito senza uscire dall'account, ${area.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await enter(context, baseURL!, area);
    await open(page, `${area.base}/ordini`);
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Visita fiscalbay.it" }).click();
    await expect(page).toHaveURL(/\/$/u);
    await expect(page).toHaveTitle("FiscalBay | Recupera il Codice Fiscale dagli ordini eBay");
    const bar = page.getByRole("banner");
    if (area.base !== "/app") {
      // L'anteprima non ha una sessione: il sito propone l'accesso.
      await expect(bar.getByRole("link", { name: "Accedi" })).toBeVisible();
      return;
    }
    await bar.getByRole("link", { name: "Apri l’app" }).click();
    await expectOrdersNavigation(page);
  });

test("il menu dell'avatar porta l'admin alla console", async ({ page, context, baseURL }) => {
  await useLocalAccount(context, "admin-granted", baseURL!);
  await open(page, "/app/ordini");
  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Console" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Console" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await expect(page.getByRole("main")).toBeVisible();
});

test("il collegamento diretto al dettaglio regge ricarica e chiusura", async ({ page }) => {
  await open(page, "/anteprima/ordini?fiscale=available");
  const first = page.getByRole("region", { name: "Elenco ordini" }).getByRole("article").first();
  const title = first.getByRole("heading", { level: 2 }).getByRole("link");
  const href = (await title.getAttribute("href"))!;
  // Con il pannello aperto il resto della pagina è inerte: si attende il dialogo.
  await page.goto(href);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  const entries = await page.evaluate(() => history.length);
  await clickHydrated(dialog.getByRole("button", { name: "Chiudi", exact: true }));
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/anteprima\/ordini\?fiscale=available(?:[?&]vista=[0-9a-z]+)?$/u);
  // Senza una voce dell'elenco il dettaglio è sostituito e il focus va sulla sua scheda.
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await expect(title).toBeFocused();
});

for (const area of areas)
  test(`il dettaglio conserva selezione e posizione dell'elenco, ${area.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await enter(context, baseURL!, area);
    await open(page, `${area.base}/ordini?fiscale=locked`);
    await page.getByRole("button", { name: "Seleziona" }).click();
    const checkbox = page.getByRole("checkbox", { name: `Seleziona l’ordine ${area.locked}` });
    await checkbox.click();
    const card = page.getByRole("article", { name: `Ordine ${area.locked}` });
    await card.scrollIntoViewIfNeeded();
    // Con la tastiera: il clic di Playwright scorrerebbe il collegamento fuori dalla barra fissa.
    await card.getByRole("link", { name: "Dettaglio" }).focus();
    const scroll = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(checkbox).toBeChecked();
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  });

for (const area of areas)
  test(`su smartphone il dettaglio occupa tutto lo schermo, ${area.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await enter(context, baseURL!, area);
    await page.setViewportSize({ width: 375, height: 740 });
    await open(page, `${area.base}/ordini`);
    await page.getByRole("article").first().getByRole("link", { name: "Dettaglio" }).click();
    // Si attende la fine dell'ingresso, che trasla il pannello.
    await expect
      .poll(() => page.getByRole("dialog").boundingBox())
      .toMatchObject({ x: 0, y: 0, width: 375, height: 740 });
  });

test("lo sblocco rivela il dato solo dopo l'azione e aggiorna la quota", async ({ page }) => {
  await open(page);
  expect(await page.content()).not.toContain("BNCLCU75C12F205G");
  const card = page.getByRole("article", { name: "Ordine 05-55555-12121" });
  await expect(
    page.getByText("2 sblocchi disponibili in questo ciclo.", { exact: true }),
  ).toHaveCount(1);
  await card.getByRole("button", { name: "Sblocca ordine" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(card.getByText("BNCLCU75C12F205G")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Ordine sbloccato" })).toContainText(
    "Ti resta 1 sblocco in questo ciclo",
  );
  await page.reload();
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "BNCLCU75C12F205G",
  );
  await page.getByRole("link", { name: "Carica altri" }).click();
  await expect(page.getByRole("article", { name: "Ordine 02-44519-70831" })).toBeVisible();
  await expect(
    page.getByText("1 sblocco disponibile in questo ciclo.", { exact: true }),
  ).toHaveCount(1);
});

test("lo sblocco di una scheda conserva la selezione", async ({ page }) => {
  await open(page, "/anteprima/ordini?fiscale=locked");
  await page.getByRole("button", { name: "Seleziona" }).click();
  await page.getByRole("checkbox", { name: "Seleziona l’ordine 02-44519-70831" }).click();
  await page
    .getByRole("article", { name: "Ordine 05-55555-12121" })
    .getByRole("button", { name: "Sblocca ordine" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ordine sbloccato" })).toBeVisible();
  await expect(page.getByText("1 selezionato")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Seleziona l’ordine 02-44519-70831" }),
  ).toBeChecked();
});

test("la selezione sblocca più ordini entro la quota", async ({ page }) => {
  await open(page, "/anteprima/ordini?fiscale=locked");
  await page.getByRole("button", { name: "Seleziona" }).click();
  await page.getByRole("checkbox", { name: "Seleziona l’ordine 05-55555-12121" }).click();
  await page.getByRole("checkbox", { name: "Seleziona l’ordine 02-44519-70831" }).click();
  await expect(page.getByText("2 ordini da sbloccare")).toBeVisible();
  await page.getByRole("button", { name: "Sblocca 2" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("ti resteranno 0 sblocchi in questo ciclo");
  await dialog.getByRole("button", { name: "Sblocca" }).click();
  // Il filtro «Da sbloccare» esclude gli ordini appena sbloccati.
  await expect(page.getByRole("status").filter({ hasText: "2 ordini sbloccati." })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.goto(await searched(page, "Conti"));
  await expect(page.getByText("04567890126")).toBeVisible();
});

test("Esporta porta la selezione con conteggio esplicito e la ritrova al ritorno", async ({
  page,
}) => {
  await open(page, "/anteprima/ordini?fiscale=locked");
  await page.getByRole("button", { name: "Seleziona" }).click();
  for (const id of ["05-55555-12121", "02-44519-70831"])
    await page.getByRole("checkbox", { name: `Seleziona l’ordine ${id}` }).click();
  const bar = page.getByRole("button", { name: "Esporta", exact: true });
  await bar.click();
  await expect(page).toHaveURL(/\/anteprima\/impostazioni\/esportazione\?.*ordini=/u);
  const section = page.locator("main");
  await expect(section).toContainText("Ordini selezionati nella pagina Ordini.");
  await expect(section).toContainText(
    "2 ordini. Per 2 ordini da sbloccare il Codice Fiscale resta vuoto.",
  );
  // Il periodo è già nei filtri degli Ordini; il file nasce soltanto da «Crea file».
  await expect(page.getByRole("combobox", { name: "Periodo" })).toHaveCount(0);
  await page.goBack();
  for (const id of ["05-55555-12121", "02-44519-70831"])
    await expect(page.getByRole("checkbox", { name: `Seleziona l’ordine ${id}` })).toBeChecked();
  await expect(page.getByText("2 selezionati")).toBeVisible();
  await bar.click();
  await page.getByRole("link", { name: "Torna agli ordini" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini\?fiscale=locked&vista=[0-9a-z]+$/u);
  await expect(page.getByText("2 selezionati")).toBeVisible();
  // La selezione esportata si ripristina una volta: le modifiche successive restano anche
  // dopo un dettaglio aperto e chiuso.
  await page.getByRole("checkbox", { name: "Seleziona l’ordine 02-44519-70831" }).click();
  await expect(page.getByText("1 selezionato")).toBeVisible();
  await page
    .getByRole("article", { name: "Ordine 05-55555-12121" })
    .getByRole("link", { name: "Dettaglio" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 selezionato")).toBeVisible();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("Esporta senza selezione usa l'elenco filtrato e il menu il solo ordine", async ({ page }) => {
  await open(page, "/anteprima/ordini?fiscale=locked");
  const total = (await page.getByText(/^\d+ ordin[eio] · Dal più recente$/u).innerText()).split(
    " ",
  )[0];
  await page.getByRole("link", { name: "Esporta", exact: true }).click();
  const section = page.locator("main");
  await expect(section).toContainText("Ordini dell’elenco con i filtri e la ricerca attivi.");
  await expect(section).toContainText(`${total} ordini.`);
  await page.getByRole("button", { name: "Crea file" }).click();
  await expect(page.getByRole("status").filter({ hasText: "nessun file creato" })).toBeVisible();
  await page.getByRole("link", { name: "Torna agli ordini" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini\?fiscale=locked&vista=[0-9a-z]+$/u);
  await page.getByRole("button", { name: "Altre azioni per l’ordine 05-55555-12121" }).click();
  await page.getByRole("menuitem", { name: "Esporta ordine" }).click();
  await expect(section).toContainText("Ordine 05-55555-12121.");
  await expect(section).toContainText("1 ordine. Per 1 ordine da sbloccare");
});

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 768, 1280]) {
      test(`quota, descrittori e skeleton ${language} ${colorScheme} ${width}`, async ({
        browser,
        baseURL,
      }) => {
        test.setTimeout(120_000);
        const context = await browser.newContext({
          baseURL,
          colorScheme,
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        watchNetwork(context);
        const page = await context.newPage();
        const base = language === "it" ? "/anteprima" : "/en/anteprima";
        const reset = (scenario: string) => setScenario(page, scenario, base);
        try {
          await reset("ordinario");
          await open(page, `${base}/ordini?fiscale=locked`);
          await expect(page.getByText(/Europe\/Rome/)).toContainText(
            language === "it"
              ? "Simulazione fissata al 27 set 2026, 15:00"
              : "Simulation fixed at 27 Sep 2026, 15:00",
          );
          const card = page.getByRole("article", {
            name: language === "it" ? "Ordine 02-44519-70831" : "Order 02-44519-70831",
          });
          await expect(card).toContainText("Partita IVA");
          const unlocked = page.waitForResponse(
            (response) =>
              response.url().endsWith("/ordini.data") && response.request().method() === "POST",
          );
          await card
            .getByRole("button", {
              name: language === "it" ? "Sblocca ordine" : "Unlock order",
              exact: true,
            })
            .click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: language === "it" ? "Sblocca" : "Unlock", exact: true })
            .click();
          expect((await unlocked).status()).toBe(200);
          await page.goto(await searched(page, "Conti", base));
          await expect(page.getByText("04567890126")).toBeVisible();
          await open(page, `${base}/impostazioni/piano`);
          await expect(
            page.getByText(language === "it" ? "4 di 5" : "4 of 5", { exact: true }),
          ).toBeVisible();
          await open(page, `${base}/impostazioni/supporto`);
          const diagnostic = page.getByText(
            language === "it" ? "Free, 4 di 5 ordini sbloccati" : "Free, 4 of 5 orders unlocked",
            { exact: true },
          );
          await diagnostic.scrollIntoViewIfNeeded();
          await expect(diagnostic).toBeVisible();
          await expect(
            page.getByText(language === "it" ? "2.0.0 (anteprima)" : "2.0.0 (preview)", {
              exact: true,
            }),
          ).toBeVisible();
          const faq = page.locator("details").filter({
            hasText:
              language === "it"
                ? "Quando un ordine conta come sbloccato?"
                : "When does an order count as unlocked?",
          });
          await faq.locator("summary").click();
          await expect(faq).toContainText("Partita IVA");
          await expect(faq).toContainText(
            language === "it" ? "Ogni ordine conta una sola volta" : "Each order counts only once",
          );
          await open(page, `${base}/impostazioni/account`);
          for (const device of language === "it"
            ? ["Safari su macOS", "Safari su iPhone", "Chrome su Windows"]
            : ["Safari on macOS", "Safari on iPhone", "Chrome on Windows"]) {
            const session = page.getByText(device, { exact: true });
            await session.scrollIntoViewIfNeeded();
            await expect(session).toBeVisible();
          }
          await reset("quota-esaurita");
          await open(page, `${base}/ordini`);
          await expect(
            page.getByRole("button", {
              name: language === "it" ? "Sblocca ordine" : "Unlock order",
              exact: true,
            }),
          ).toHaveCount(0);
          await expect(
            page.getByText(
              language === "it"
                ? /^Puoi consultare e cercare tutti gli ordini\./
                : /^You can still view and search all orders\./,
            ),
          ).toContainText("Partita IVA");
          await reset("caricamento");
          await open(page, `${base}/ordini`);
          const grid = page.locator('[aria-busy="true"]');
          await expect(grid).toBeVisible();
          expect(
            await grid
              .locator('[data-slot="skeleton"]')
              .first()
              .evaluate((element) => getComputedStyle(element).backgroundColor),
          ).toBe(colorScheme === "light" ? "rgb(217, 223, 232)" : "rgb(36, 40, 48)");
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await test.info().attach("loading", {
            body: await page.screenshot({
              fullPage: true,
              path: test.info().outputPath("loading.png"),
            }),
            contentType: "image/png",
          });
          await page.goto(language === "it" ? "/termini" : "/en/termini");
          await expect(
            page.getByText(
              language === "it"
                ? /^Versione del \d{1,2} \p{L}+ \d{4}$/u
                : /^Version of \d{1,2} \p{L}+ \d{4}$/u,
            ),
          ).toBeVisible();
        } finally {
          await context.close();
        }
      });
    }
  }
}

test("con gli sblocchi esauriti gli ordini restano consultabili", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Sblocchi esauriti");
  const quota = page.getByRole("status").filter({ hasText: "Sblocchi esauriti per questo ciclo" });
  await expect(quota).toBeVisible();
  // Con la prova disponibile l'avviso la offre e non c'è un secondo invito.
  await expect(quota.getByRole("button", { name: "Attiva la prova" })).toBeVisible();
  await expect(page.getByText("Prova Premium gratis per 14 giorni, senza carta.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "Sblocco disponibile dal 2 ott 2026.",
  );
  await expect(page.getByRole("article", { name: "Ordine 08-33110-45672" })).toContainText(
    "SPSNNA85T55F83",
  );
});

test("la ricerca della top bar suggerisce e apre l'elenco filtrato", async ({
  page,
  browserName,
}) => {
  const search = page.getByRole("searchbox", { name: "Cerca ordini" });
  let continueHydration = () => {};
  const hydration = new Promise<void>((resolve) => {
    continueHydration = resolve;
  });
  await page.route("**/assets/app-shell-*.js", async (route) => {
    await hydration;
    await route.continue();
  });
  try {
    await page.goto("/anteprima/ordini", { waitUntil: "commit" });
    await expect(search).toBeDisabled();
  } finally {
    continueHydration();
  }
  await expect(search).toBeEnabled();
  await expect(
    await searchFromTopBar(page, "/anteprima", "carburatore", /Maria Rossi/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await search.fill("Conti");
  const keyboardSuggestion = page.getByRole("search").getByRole("link", { name: /Conti/ });
  await expect(keyboardSuggestion).toBeVisible();
  await search.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(keyboardSuggestion).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ordini\/ord-\d+\?ricerca=[\w-]+(?:[?&]vista=[0-9a-z]+)?$/u);
  await expect(page.getByRole("dialog")).toContainText("Conti");
});

test("negozi con problema e conferma forte dell'eliminazione", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Problema su un negozio");
  await expect(page.getByText(/collegamento scaduto$/u).first()).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("link", {
      name: "Negozi eBay",
    })
    .click();
  await expect(page.getByRole("table", { name: "Elenco negozi" })).toContainText(
    "Negozio non verificabile",
  );
  await page.getByRole("link", { name: /Retro Parts Europe/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Autorizzazione incompleta");
  const { button } = await confirmStoreDeletion(page, dialog, "Retro Parts Europe");
  // Riuscita l'eliminazione, il pannello si chiude e l'avviso resta visibile sull'elenco.
  await button.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Anteprima: l’azione è simulata." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/anteprima\/negozi$/u);
});

test("il salvataggio automatico fallito ripristina il valore", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Premium, più negozi");
  // Un clic prima dell'idratazione non chiama il salvataggio.
  await open(page, "/anteprima/impostazioni/notifiche");
  await expect(page.locator("#settings-notifiche")).toBeInViewport();
  const toggle = page.getByRole("switch", { name: "Invia notifiche degli ordini" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText(/Modifica non salvata/u)).toBeVisible();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText("Salvato")).toBeVisible();
  await expect(toggle).not.toBeChecked();
});

for (const area of areas)
  for (const locale of ["it", "en"] as const) {
    test(`mobile con tocco e bottom navigation, ${locale}, ${area.name}`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 375, height: 740 },
        hasTouch: true,
        isMobile: true,
      });
      await enter(context, baseURL!, area);
      watchNetwork(context);
      const page = await context.newPage();
      const prefix = locale === "it" ? "" : "/en";
      const labels =
        locale === "it"
          ? { nav: "Navigazione principale", settings: "Impostazioni", notifications: "Notifiche" }
          : { nav: "Main navigation", settings: "Settings", notifications: "Notifications" };
      try {
        await open(page, `${prefix}${area.base}/ordini`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        // Anche su mobile l'anteprima dichiara che le azioni sono simulate.
        if (area.base === "/anteprima")
          await expect(
            page.getByText(locale === "it" ? "Le azioni sono simulate." : "Actions are simulated."),
          ).toBeVisible();
        const bottom = page.getByRole("navigation", { name: labels.nav });
        await expect(bottom).toHaveCount(1);
        await expect(bottom).toBeInViewport();
        const noOverflow = () =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        await expect.poll(noOverflow).toBe(true);
        await bottom.getByRole("link", { name: labels.settings }).tap();
        await expect(page).toHaveURL(new RegExp(`${prefix}${area.base}/impostazioni$`, "u"));
        const categories = page.getByRole("navigation", {
          name: locale === "it" ? "Categorie" : "Categories",
        });
        await expect(
          categories.getByRole("link", { name: new RegExp(labels.notifications, "u") }),
        ).toBeVisible();
        await expect(
          categories.getByRole("link", {
            name: locale === "it" ? /Dati e privacy/u : /Data and privacy/u,
          }),
        ).toBeVisible();
        await categories.getByRole("link", { name: new RegExp(labels.notifications, "u") }).tap();
        await expect(categories).toBeHidden();
        await expect(
          page.getByRole("heading", { level: 2, name: labels.notifications }),
        ).toBeVisible();
        await expect.poll(noOverflow).toBe(true);
        await page.getByRole("link", { name: labels.settings, exact: true }).first().tap();
        await expect(categories).toBeVisible();
        await bottom
          .getByRole("link", { name: locale === "it" ? "Negozi eBay" : "eBay stores" })
          .tap();
        await expect.poll(noOverflow).toBe(true);
      } finally {
        await context.close();
      }
    });
  }

test("con Premium nessun ordine resta da sbloccare e il piano a vita non si rinnova", async ({
  page,
}) => {
  await open(page);
  await chooseScenario(page, "Problema su un negozio");
  await expect(page.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await expect(page.getByText("BNCLCU75C12F205G")).toBeVisible();

  await chooseScenario(page, "Premium a vita");
  await expect(page.getByText("Il carattere di controllo non corrisponde.")).toBeVisible();
  await page.goto("/anteprima/impostazioni/piano");
  // Su desktop tutte le categorie stanno nella stessa pagina: la prova resta sulla sezione del piano.
  const plan = page.getByRole("region", { name: "Piano e pagamenti" });
  await expect(plan.getByText("Premium a vita")).toBeVisible();
  await expect(plan.getByText("Acquisto una tantum, senza rinnovi.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gestisci abbonamento/u })).toHaveCount(0);
});

test("la prova si attiva volontariamente, poi la fine è in evidenza e non si ripete", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByText("Prova Premium gratis per 14 giorni, senza carta.")).toBeVisible();
  await page.getByRole("button", { name: "Attiva la prova", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Prova Premium attivata." }),
  ).toBeVisible();
  await expect(page.getByText("Prova Premium: 14 giorni rimasti")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Attiva la prova" })).toHaveCount(0);

  await chooseScenario(page, "Prova in scadenza");
  const ending = page.getByRole("status").filter({ hasText: "La prova Premium finisce il" });
  await expect(ending).toContainText("29 set 2026");
  await ending.getByRole("link", { name: "Vedi il piano" }).click();
  await expect(page).toHaveURL(/\/anteprima\/impostazioni\/piano$/u);
  const plan = page.getByRole("region", { name: "Piano e pagamenti" });
  await expect(plan.getByText("Prova Premium", { exact: true })).toBeVisible();
  await expect(plan.getByText(/1 giorno rimasto/u)).toBeVisible();

  await chooseScenario(page, "Prova terminata");
  await expect(plan.getByText("Free", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attiva la prova" })).toHaveCount(0);
});

test("stati vuoti, ricerca e indirizzi inesistenti restano dentro l'app", async ({ page }) => {
  await expectOrdersFallbacks(page, "/anteprima", "ord-999", "12 ordini");

  await page.getByRole("combobox", { name: "Periodo" }).click();
  for (const period of ["Ultimi 90 giorni", "Ultimi 6 mesi", "Ultimi 12 mesi"])
    await expect(page.getByRole("option", { name: new RegExp(period, "u") })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  await page.keyboard.press("Escape");

  await chooseScenario(page, "Nessun ordine");
  await expect(
    page.getByRole("heading", { name: "Nessun ordine negli ultimi 30 giorni" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri il negozio" })).toBeVisible();
});

test("stati coerenti: aggiornamento, eBay fermo e collegamento già usato", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Aggiornamento in corso");
  await expect(
    page.getByRole("main").getByText("Aggiornamento in corso", { exact: true }),
  ).toHaveCount(1);
  // Un acquisto non ancora pagato non si sblocca finché non è pagato.
  await open(page, await searched(page, "14-20983-11275"));
  const unpaid = page.getByRole("article", { name: "Ordine 14-20983-11275" });
  await expect(unpaid).toContainText("Acquisto non ancora pagato");
  await expect(unpaid.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await open(page);

  await chooseScenario(page, "eBay non risponde");
  await expect(
    page.getByRole("article", { name: "Ordine 19-00001-99999" }).getByRole("button", {
      name: "Riprova",
    }),
  ).toBeDisabled();
  // Anche il ricollegamento del consenso in scadenza chiama eBay e resta sospeso.
  await expect(page.getByRole("button", { name: "Ricollega negozio" })).toBeDisabled();

  await chooseScenario(page, "Primo accesso");
  // Il selettore cambia subito: attendere anche i dati dello scenario prima del collegamento.
  await networkIdle(page);
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("link", { name: "Negozi eBay" })
    .click();
  await expect(page).toHaveURL(/\/anteprima\/negozi$/u);
  await networkIdle(page);
  await expect(page.getByText("Negozio già collegato a un altro account")).toHaveCount(0);
  await page.getByRole("button", { name: "Collega negozio eBay" }).click();
  await expect(page.getByText("Negozio già collegato a un altro account")).toBeVisible();
  // Come dopo il ritorno da eBay, l'esito esce dall'indirizzo e una ricarica non lo ripropone.
  await expect(page).toHaveURL(/\/anteprima\/negozi$/u);
});

test("contatti cliccabili e copiabili, senza richiesta fiscale precompilata agli alias eBay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { copiedText?: string }).copiedText = value;
        },
      },
    });
  });
  await setScenario(page, "dati-discordanti");
  // Indirizzo tutto in maiuscolo e cellulare senza prefisso.
  await page.goto("/anteprima/ordini/ord-09");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Via dell'Orto 12B", { exact: true })).toBeVisible();
  await expect(dialog.getByText("26866 Sant'Angelo Lodigiano (LO)", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Italia", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "+39 333 000 1009" })).toHaveAttribute(
    "href",
    "tel:+393330001009",
  );
  // Dato fiscale mancante con un indirizzo reale: email già compilata.
  await page.goto("/anteprima/ordini/ord-11");
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Scrivi all’acquirente via email" }),
  ).toHaveAttribute("href", /^mailto:fra\.colombo@esempio\.invalid\?subject=/u);
  // Alias eBay e numero non riconoscibile: niente email precompilata né chiamata.
  await page.goto("/anteprima/ordini/ord-14");
  const alias = page.getByRole("dialog");
  await expect(alias.getByText("interno 14", { exact: true })).toBeVisible();
  await expect(alias.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(alias.getByText("c3f0a1b2@members.ebay.invalid", { exact: true })).toBeVisible();
  await expect(
    alias.getByRole("link", { name: /^c3f0a1b2\s*@members\.ebay\.invalid$/u }),
  ).toHaveAttribute("href", "mailto:c3f0a1b2@members.ebay.invalid");
  const copyEmail = alias.getByRole("button", { name: /^Copia email:/u });
  await copyEmail.click();
  await expect(copyEmail).toHaveAttribute("data-state", "copied");
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe(
    "c3f0a1b2@members.ebay.invalid",
  );
  await expect(alias.getByRole("link", { name: "Scrivi all’acquirente via email" })).toHaveCount(0);
  await expect(alias.getByRole("button", { name: /^Copia messaggio/u })).toBeVisible();
});

test.describe("area reale", () => {
  test.beforeEach(({ context, baseURL }) => enter(context, baseURL!, areas[1]));

  test("Ordini con navigazione, campanella e menu account", async ({ page }) => {
    await open(page, "/app/ordini");
    await expectOrdersNavigation(page);
    // Nel Free i negozi oltre a quello attivo sono in pausa per il piano: il collegamento
    // scaduto non avvisa nella campanella.
    await page.getByRole("button", { name: /^Notifiche/u }).click();
    const bell = page.getByRole("dialog");
    await expect(bell).toBeVisible();
    await expect(bell.getByRole("link", { name: /collaudo-scaduto/u })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(bell).toBeHidden();
    await openAccountFromMenu(page, "/app");
  });

  test("la ricerca della top bar suggerisce e apre l'elenco filtrato", async ({ page }) => {
    await open(page, "/app/ordini");
    const id = testAccount.orders.unlocked;
    await expect(await searchFromTopBar(page, "/app", id, new RegExp(id, "u"))).toContainText(
      testAccount.taxCodes.unlocked,
    );
  });

  test("stati vuoti, ricerca e indirizzi inesistenti restano dentro l'app", async ({ page }) => {
    await expectOrdersFallbacks(page, "/app", "non-esiste", "2 ordini");
  });

  test("negozio da ricollegare e conferma forte dell'eliminazione", async ({ page }) => {
    await open(page, "/app/negozi");
    const name = testAccount.stores.expired;
    await page.getByRole("table", { name: "Elenco negozi" }).getByRole("link", { name }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(name);
    const { confirm } = await confirmStoreDeletion(page, dialog, name);
    // Il negozio serve alle altre prove: l'eliminazione resta alla prova dell'errore.
    await confirm.getByRole("button", { name: "Annulla", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(dialog).toBeVisible();
  });
});

// Sul tablet i filtri riempiono le righe: quattro su due colonne, cinque (con il negozio) su tre.
// Il filtro del negozio compare con più negozi ammessi: nel Free ne resta attivo uno.
for (const [account, columns] of [
  ["stores-premium", 3],
  [undefined, 2],
] as const)
  test(`filtri del tablet a righe piene su ${columns} colonne, area reale`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLocalAccount(context, "member", baseURL!, account);
    await page.setViewportSize({ width: 768, height: 900 });
    await open(page, "/app/ordini");
    const lefts = await page
      .locator("#orders-filters > *")
      .evaluateAll((filters) => filters.map((filter) => filter.getBoundingClientRect().left));
    expect(lefts).toHaveLength(columns === 3 ? 5 : 4);
    expect(new Set(lefts).size).toBe(columns);
  });

// Il fuso automatico nomina quello del dispositivo anche nell'anteprima, come nell'area reale.
test.describe("fuso del dispositivo", () => {
  for (const area of areas)
    test(`Impostazioni con il fuso rilevato, ${area.name}`, async ({ page, context, baseURL }) => {
      await enter(context, baseURL!, area);
      await open(page, `${area.base}/impostazioni/aspetto`);
      await expect(page.getByRole("combobox", { name: "Fuso orario" })).toContainText(
        "Automatico: Roma (Italia)",
      );
    });
});
