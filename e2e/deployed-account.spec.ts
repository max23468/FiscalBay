import { expect, test } from "@playwright/test";

import { testAccount } from "./test-account";

const password = process.env.E2E_ACCOUNT_PASSWORD;

// Solo sul dominio distribuito, dopo il ripristino dell'account di collaudo.
test.skip(!process.env.E2E_BASE_URL, "Non applicabile: collaudo riservato al dominio remoto.");
test.skip(
  Boolean(process.env.E2E_BASE_URL) && !password,
  "Password assente: collaudo remoto parziale.",
);

test(
  "l'account di collaudo entra e vede ordini, sblocchi e negozi del piano Free",
  { tag: "@smoke" },
  async ({ page }) => {
    const { stores, orders, taxCodes } = testAccount;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/accesso");
    const signIn = page.getByRole("tabpanel", { name: "Accedi" });
    await signIn.getByRole("textbox", { name: "Email" }).fill(testAccount.email);
    await signIn.getByRole("textbox", { name: "Password" }).fill(password!);
    await signIn.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(page).toHaveTitle("FiscalBay | Ordini");

    // Nel Free resta attivo il primo negozio collegato: gli altri sono in pausa per il piano,
    // non avvisano del consenso e non compaiono negli Ordini.
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /collegamento scaduto|autorizzazione in scadenza/u }),
    ).toHaveCount(0);
    await expect(page.getByText(stores.paused)).toHaveCount(0);

    // Il codice dell'ordine sbloccato è visibile, quello bloccato non arriva al browser.
    await expect(page.getByText(orders.unlocked).first()).toBeVisible();
    await expect(page.getByText(orders.locked).first()).toBeVisible();
    await expect(page.getByText(taxCodes.unlocked).first()).toBeVisible();
    expect(await page.content()).not.toContain(taxCodes.locked);

    // Negozi: elenco riconoscibile e pannello aperto da link diretto, senza azioni. Il negozio
    // in pausa per il piano rimanda alla scelta del negozio attivo nel Piano.
    await page.getByRole("link", { name: "Negozi eBay" }).first().click();
    await expect(page).toHaveTitle("FiscalBay | Negozi eBay");
    await expect(page.getByRole("heading", { name: "Negozi eBay", exact: true })).toBeVisible();
    await expect(page.getByText("Il piano Free include un solo negozio attivo.")).toBeVisible();
    for (const name of Object.values(stores)) {
      await expect(page.getByRole("table").getByText(name, { exact: true })).toBeVisible();
    }
    await page.goto(`/app/negozi/${stores.paused}`);
    const panel = page.getByRole("dialog", { name: stores.paused });
    await expect(panel.getByRole("link", { name: "Scegli il negozio attivo" })).toHaveAttribute(
      "href",
      "/app/impostazioni/piano",
    );
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/app\/negozi$/u);
    await page.goto("/app/impostazioni/piano");
    await expect(page.getByRole("combobox", { name: "Scegli il negozio attivo" })).toContainText(
      stores.active,
    );

    // Il vecchio indirizzo del profilo porta alla categoria Account delle Impostazioni.
    await page.goto("/app/profilo");
    await expect(page).toHaveURL(/\/app\/impostazioni\/account$/u);
    await expect(page).toHaveTitle("FiscalBay | Account | Impostazioni");

    // Con la sessione la radice porta agli Ordini; «Visita fiscalbay.it» mostra il sito e
    // «Apri l'app» torna agli Ordini, senza uscire.
    await page.goto("/?visita=1");
    await expect(page).toHaveURL(/\/$/u);
    await expect(page).toHaveTitle("FiscalBay | Recupera il Codice Fiscale dagli ordini eBay");
    await page.getByRole("link", { name: "Apri l’app" }).first().click();
    await expect(page).toHaveTitle("FiscalBay | Ordini");
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/app\/ordini(?:[?&]vista=[0-9a-z]+)?$/u);
    await expect(page).toHaveTitle("FiscalBay | Orders");
    await expect(page.getByText(`${stores.expired}: connection expired`)).toHaveCount(0);
    expect(await page.content()).not.toContain(taxCodes.locked);
    expect(errors).toEqual([]);
  },
);
