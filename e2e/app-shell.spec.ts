import { expect, test, type Page } from "@playwright/test";

/*
 * Shell e sezioni dell'app sugli scenari sintetici dell'anteprima.
 * Ogni prova usa un contesto nuovo, quindi parte dallo scenario ordinario.
 */

async function open(page: Page, path = "/anteprima/ordini") {
  await page.goto(path);
  // Il selettore di scenario è interattivo solo dopo l'idratazione.
  await expect(page.getByRole("combobox", { name: /Scenario/ })).toBeEnabled({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

async function chooseScenario(page: Page, name: string) {
  await page.getByRole("combobox", { name: /Scenario/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("combobox", { name: /Scenario/ })).toContainText(name);
}

test("la radice apre Ordini con navigazione, campanella e menu account", async ({ page }) => {
  await open(page, "/anteprima");
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);
  await expect(page).toHaveTitle("FiscalBay | Ordini");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(nav.getByRole("link")).toHaveText(["Ordini", "Negozi eBay", "Impostazioni"]);
  await expect(nav.getByRole("link", { name: "Ordini" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Notifiche, 1 da leggere" }).click();
  await expect(page.getByText("Manutenzione programmata")).toBeVisible();
  await page.getByRole("button", { name: "Segna tutte come lette" }).click();
  await expect(page.getByRole("button", { name: "Notifiche", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Profilo",
    "Sicurezza",
    "Piano e pagamenti",
    "Impostazioni",
    "Visita fiscalbay.it",
    "Esci",
  ]);
  await menu.getByRole("menuitem", { name: "Sicurezza" }).click();
  await expect(page).toHaveURL(/\/anteprima\/impostazioni\/sicurezza$/u);
  await expect(page.getByRole("heading", { name: "Sicurezza", level: 2 })).toBeVisible();
});

test("il dettaglio ha un URL, si chiude con Indietro e conserva i filtri", async ({ page }) => {
  await open(page, "/anteprima/ordini?fiscale=available");
  const list = page.getByRole("region", { name: "Elenco ordini" });
  const first = list.getByRole("article").first();
  const buyer = (await first.getByRole("heading", { level: 2 }).textContent()) ?? "";
  await first.getByRole("link", { name: "Dettaglio" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini\/ord-\d+\?fiscale=available$/u);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(buyer);
  await dialog.getByRole("tab", { name: /Articoli/ }).click();
  await expect(dialog.getByRole("tabpanel", { name: /Articoli/ })).toContainText("SKU");
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/anteprima\/ordini\?fiscale=available$/u);
  await first.getByRole("link", { name: "Dettaglio" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\?fiscale=available$/u);
});

test("lo sblocco rivela il dato solo dopo l'azione e aggiorna la quota", async ({ page }) => {
  await open(page);
  expect(await page.content()).not.toContain("BNCLCU75C12F205X");
  const card = page.getByRole("article", { name: "Ordine 05-55555-12121" });
  await expect(card).toContainText("Hai 2 sblocchi disponibili");
  await card.getByRole("button", { name: "Sblocca ordine" }).click();
  await expect(card.getByText("BNCLCU75C12F205X")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Ordine sbloccato" })).toContainText(
    "Ti resta 1 sblocco in questo ciclo",
  );
  await page.reload();
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "BNCLCU75C12F205X",
  );
  await page.getByRole("link", { name: "Carica altri" }).click();
  await expect(page.getByRole("article", { name: "Ordine 02-44519-70831" })).toContainText(
    "Hai 1 sblocco disponibile",
  );
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
  await page.goto("/anteprima/ordini?q=Conti");
  await expect(page.getByText("04567890123")).toBeVisible();
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
        const page = await context.newPage();
        const base = language === "it" ? "/anteprima" : "/en/anteprima";
        const reset = async (scenario: string) => {
          await page.request.post(base, {
            form: { scenario, redirectTo: `${base}/ordini` },
            maxRedirects: 0,
          });
        };
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
          expect((await unlocked).status()).toBe(200);
          await page.goto(`${base}/ordini?q=Conti`);
          await expect(page.getByText("04567890123")).toBeVisible();
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
          await open(page, `${base}/impostazioni/sicurezza`);
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
                ? "Bozza · Versione bozza-2026-09-28"
                : "Draft · Version bozza-2026-09-28",
              { exact: true },
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
  await expect(
    page.getByRole("status").filter({ hasText: "Sblocchi esauriti per questo ciclo" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "Sblocco disponibile dal 2 ott 2026.",
  );
  await expect(page.getByRole("article", { name: "Ordine 08-33110-45672" })).toContainText(
    "SPSNNA85T55F83",
  );
});

test("la ricerca della top bar suggerisce e apre l'elenco filtrato", async ({ page }) => {
  await open(page);
  const search = page.getByRole("searchbox", { name: "Cerca ordini" });
  await search.fill("carburatore");
  const suggestion = page.getByRole("search").getByRole("link", { name: /Maria Rossi/ });
  await expect(suggestion).toBeVisible();
  await page.getByRole("link", { name: "Vedi tutti i risultati (1)" }).click();
  await expect(page).toHaveURL(/\?q=carburatore$/u);
  await expect(
    page.getByRole("region", { name: "Elenco ordini" }).getByRole("article"),
  ).toHaveCount(1);
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
  await dialog.getByRole("button", { name: "Scollega ed elimina dati" }).click();
  const confirm = page.getByRole("alertdialog");
  const button = confirm.getByRole("button", { name: "Scollega ed elimina" });
  await expect(button).toBeDisabled();
  await confirm.getByRole("textbox").fill("Retro Parts Europe");
  await expect(button).toBeEnabled();
});

test("il salvataggio automatico fallito ripristina il valore", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Premium, più negozi");
  await page.goto("/anteprima/impostazioni/notifiche");
  const toggle = page.getByRole("switch", { name: "Invia notifiche degli ordini" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText(/Modifica non salvata/u)).toBeVisible();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText("Salvato")).toBeVisible();
  await expect(toggle).not.toBeChecked();
});

for (const locale of ["it", "en"] as const) {
  test(`mobile con tocco e bottom navigation, ${locale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 740 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const prefix = locale === "it" ? "" : "/en";
    const labels =
      locale === "it"
        ? { nav: "Navigazione principale", settings: "Impostazioni", notifications: "Notifiche" }
        : { nav: "Main navigation", settings: "Settings", notifications: "Notifications" };
    try {
      await open(page, `${prefix}/anteprima/ordini`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      // Anche su mobile l'anteprima dichiara che le azioni sono simulate.
      await expect(
        page.getByText(
          locale === "it"
            ? "Qui le azioni sono simulate e usano dati di esempio."
            : "Actions here are simulated and use sample data.",
        ),
      ).toBeVisible();
      const bottom = page.getByRole("navigation", { name: labels.nav });
      await expect(bottom).toHaveCount(1);
      await expect(bottom).toBeInViewport();
      const noOverflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      await expect.poll(noOverflow).toBe(true);
      await bottom.getByRole("link", { name: labels.settings }).tap();
      await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni$`, "u"));
      const categories = page.getByRole("navigation", {
        name: locale === "it" ? "Categorie" : "Categories",
      });
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
  await expect(page.getByText("BNCLCU75C12F205X")).toBeVisible();

  await chooseScenario(page, "Premium a vita");
  await expect(page.getByText("Il carattere di controllo non corrisponde.")).toBeVisible();
  await page.goto("/anteprima/impostazioni/piano");
  // Su desktop tutte le categorie stanno nella stessa pagina: la prova resta sulla sezione del piano.
  const plan = page.getByRole("region", { name: "Piano e pagamenti" });
  await expect(plan.getByText("Premium a vita")).toBeVisible();
  await expect(plan.getByText("Acquisto una tantum, senza rinnovi.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gestisci abbonamento/u })).toHaveCount(0);
});

test("stati vuoti, ricerca e indirizzi inesistenti restano dentro l'app", async ({ page }) => {
  const response = await page.goto("/anteprima/ordini/ord-999");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Ordine non trovato" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
  await page.getByRole("link", { name: "Torna agli ordini" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);

  await open(page, "/anteprima/ordini?pagamento=sconosciuto");
  await expect(page.getByRole("combobox", { name: "Pagamento" })).toContainText("Tutti");
  await expect(page.getByText("12 ordini")).toBeVisible();

  await open(page, "/anteprima/ordini?q=zzzz");
  await expect(page.getByRole("searchbox").first()).toHaveValue("zzzz");
  await expect(page.getByText("Nessun ordine corrisponde alla ricerca.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancella ricerca" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seleziona" })).toBeDisabled();

  await page.getByRole("combobox", { name: "Periodo" }).click();
  await expect(page.getByRole("option", { name: /Ultimi 90 giorni/u })).toHaveAttribute(
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

  await chooseScenario(page, "eBay non risponde");
  await expect(
    page.getByRole("article", { name: "Ordine 19-00001-99999" }).getByRole("button", {
      name: "Riprova",
    }),
  ).toBeDisabled();

  await chooseScenario(page, "Primo accesso");
  // Il selettore cambia subito: attendere anche i dati dello scenario prima del collegamento.
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("link", { name: "Negozi eBay" })
    .click();
  await expect(
    page.getByText("Questo negozio eBay è già collegato a un altro account FiscalBay."),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Collega negozio eBay" }).click();
  await expect(
    page.getByText("Questo negozio eBay è già collegato a un altro account FiscalBay."),
  ).toBeVisible();
});
