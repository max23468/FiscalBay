import { expect, test } from "@playwright/test";

import { testAccount } from "./test-account";

const password = process.env.E2E_ACCOUNT_PASSWORD;

// Solo sul dominio distribuito, dopo il ripristino dell'account di collaudo.
test.skip(
  !process.env.E2E_BASE_URL || !password,
  "Richiede E2E_BASE_URL e la password dell'account di collaudo.",
);

test(
  "l'account di collaudo entra e vede ordini, sblocchi e avvisi dei negozi",
  { tag: "@smoke" },
  async ({ page }) => {
    const { stores, orders, taxCodes } = testAccount;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    const signIn = page.getByRole("tabpanel", { name: "Accedi" });
    await signIn.getByRole("textbox", { name: "Email" }).fill(testAccount.email);
    await signIn.getByRole("textbox", { name: "Password" }).fill(password!);
    await signIn.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(page).toHaveTitle("FiscalBay | Ordini");

    // Il collegamento scaduto precede quello in scadenza; il negozio in pausa non avvisa.
    const alerts = page
      .getByRole("status")
      .filter({ hasText: /collegamento scaduto|autorizzazione in scadenza/u });
    await expect(alerts).toHaveCount(2);
    await expect(alerts.nth(0)).toContainText(`${stores.expired}: collegamento scaduto`);
    await expect(alerts.nth(0).getByRole("link", { name: "Apri il negozio" })).toHaveAttribute(
      "href",
      `/negozi/${stores.expired}`,
    );
    await expect(alerts.nth(1)).toContainText(`${stores.expiring}: autorizzazione in scadenza`);
    await expect(alerts.nth(1).getByRole("link", { name: "Ricollega negozio" })).toHaveAttribute(
      "href",
      "/negozi/collega?ricollega&environment=production",
    );
    await expect(page.getByText(stores.paused)).toHaveCount(0);

    // Il codice dell'ordine sbloccato è visibile, quello bloccato non arriva al browser.
    await expect(page.getByText(orders.unlocked).first()).toBeVisible();
    await expect(page.getByText(orders.locked).first()).toBeVisible();
    await expect(page.getByText(taxCodes.unlocked).first()).toBeVisible();
    expect(await page.content()).not.toContain(taxCodes.locked);

    // Negozi: elenco con il piano dello spazio e pannello aperto da link diretto, senza azioni.
    await page.getByRole("link", { name: "Negozi eBay" }).first().click();
    await expect(page).toHaveTitle("FiscalBay | Negozi eBay");
    await expect(page.getByText("Il piano Free è del tuo spazio FiscalBay")).toBeVisible();
    for (const name of Object.values(stores)) {
      await expect(page.getByRole("table").getByText(name, { exact: true })).toBeVisible();
    }
    await page.goto(`/negozi/${stores.paused}`);
    const panel = page.getByRole("dialog", { name: stores.paused });
    await expect(panel.getByRole("button", { name: "Riprendi" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/negozi$/u);

    await page.goto("/profilo");
    await expect(page).toHaveTitle("FiscalBay | Profilo");

    await page.goto("/en");
    await expect(page).toHaveTitle("FiscalBay | Orders");
    await expect(page.getByText(`${stores.expired}: connection expired`)).toBeVisible();
    expect(await page.content()).not.toContain(taxCodes.locked);
    expect(errors).toEqual([]);
  },
);
