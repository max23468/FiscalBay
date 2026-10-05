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
    const alerts = page.getByRole("status").filter({ hasText: "Ricollega negozio" });
    await expect(alerts).toHaveCount(2);
    await expect(alerts.nth(0)).toContainText(`${stores.expired}: collegamento scaduto`);
    await expect(alerts.nth(1)).toContainText(`${stores.expiring}: autorizzazione in scadenza`);
    for (const link of await alerts.getByRole("link", { name: "Ricollega negozio" }).all()) {
      await expect(link).toHaveAttribute("href", "/negozi/collega?ricollega");
    }
    await expect(page.getByText(stores.paused)).toHaveCount(0);

    // Il codice dell'ordine sbloccato è visibile, quello bloccato non arriva al browser.
    await expect(page.getByText(orders.unlocked).first()).toBeVisible();
    await expect(page.getByText(orders.locked).first()).toBeVisible();
    await expect(page.getByText(taxCodes.unlocked).first()).toBeVisible();
    expect(await page.content()).not.toContain(taxCodes.locked);

    await page.goto("/en");
    await expect(page).toHaveTitle("FiscalBay | Orders");
    await expect(page.getByText(`${stores.expired}: connection expired`)).toBeVisible();
    expect(await page.content()).not.toContain(taxCodes.locked);
    expect(errors).toEqual([]);
  },
);
