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
  const buyer = (await first.getByRole("heading", { level: 3 }).textContent()) ?? "";
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
  await expect(card).toContainText("Ti restano 2 sblocchi");
  await card.getByRole("button", { name: "Sblocca ordine" }).click();
  await expect(card.getByText("BNCLCU75C12F205X")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Ordine sbloccato" })).toContainText(
    "Ti resta 1 sblocco",
  );
  await page.reload();
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "BNCLCU75C12F205X",
  );
  await page.getByRole("link", { name: "Carica altri" }).click();
  await expect(page.getByRole("article", { name: "Ordine 02-44519-70831" })).toContainText(
    "Ti resta 1 sblocco",
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
  await expect(dialog).toContainText("te ne resteranno 0");
  await dialog.getByRole("button", { name: "Sblocca" }).click();
  // Il filtro «Da sbloccare» esclude gli ordini appena sbloccati.
  await expect(page.getByRole("status").filter({ hasText: "2 ordini sbloccati." })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.goto("/anteprima/ordini?q=Conti");
  await expect(page.getByText("CNTPLA68M01L781T")).toBeVisible();
});

test("con gli sblocchi esauriti gli ordini restano consultabili", async ({ page }) => {
  await open(page);
  await chooseScenario(page, "Sblocchi esauriti");
  await expect(page.getByRole("status").filter({ hasText: "Sblocchi esauriti" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sblocca ordine" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Ordine 05-55555-12121" })).toContainText(
    "Hai usato tutti gli sblocchi",
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
