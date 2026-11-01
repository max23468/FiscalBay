import { open } from "./components";
import { expect, test } from "./fixtures";
import { useLocalAccount } from "./local-account";
import { testAccount } from "./test-account";

test.describe("area reale", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  // Il profilo è una categoria delle Impostazioni.
  test.describe("impostazioni", () => {
    for (const language of ["it", "en"] as const) {
      const prefix = language === "it" ? "" : "/en";
      const it = language === "it";
      test(`profilo: modifiche, uscita, attesa e salvataggio ${language}`, async ({ page }) => {
        await open(page, `${prefix}/anteprima/impostazioni/account`, "ordinario");
        const section = page.getByRole("region", { name: "Account", exact: true });
        const first = section.getByRole("textbox", {
          name: it ? "Nome" : "First name",
          exact: true,
        });
        const save = section.getByRole("button", { name: it ? "Salva" : "Save", exact: true });
        const orders = page
          .locator("header")
          .getByRole("link", { name: it ? "Ordini" : "Orders", exact: true });
        const original = await first.inputValue();
        await expect(save).toBeDisabled();
        await first.fill(`${original} modificato`);
        await expect(save).toBeEnabled();
        // Fra le categorie delle Impostazioni la bozza resta senza chiedere conferma.
        await page
          .getByRole("navigation", { name: it ? "Categorie" : "Categories" })
          .getByRole("link", { name: it ? /^Piano e pagamenti/u : /^Plan and billing/u })
          .click();
        await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni/piano$`));
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toHaveCount(0);
        await expect(first).toHaveValue(`${original} modificato`);
        await orders.click();
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(
          it ? "modifiche non salvate al profilo" : "unsaved changes to your profile",
        );
        await dialog
          .getByRole("button", { name: it ? "Continua a modificare" : "Keep editing" })
          .click();
        await expect(first).toHaveValue(`${original} modificato`);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(`**${prefix}/anteprima/impostazioni/*.data*`, async (route) => {
          if (route.request().method() === "POST") await gate;
          await route.continue();
        });
        await save.click();
        await expect(
          section.getByRole("button", { name: it ? "Salvataggio…" : "Saving…", exact: true }),
        ).toBeDisabled();
        await expect(first).toBeDisabled();
        await orders.click();
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByRole("button", { name: it ? "Lascia la pagina" : "Leave page" }),
        ).toBeDisabled();
        await dialog
          .getByRole("button", { name: it ? "Continua a modificare" : "Keep editing" })
          .click();
        release();
        await expect(save).toBeDisabled();
        await expect(first).toBeEnabled();
        await expect(
          section
            .getByRole("status")
            .filter({ hasText: it ? "profilo non salvato" : "profile not saved" }),
        ).toBeVisible();
        await orders.click();
        await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/ordini`));
      });

      test(`errore eliminazione negozio e profilo: conserva finestra e valori ${language}`, async ({
        page,
        context,
        baseURL,
      }) => {
        await useLocalAccount(context, "member", baseURL!);
        await page.goto(`${prefix}/app/negozi/${testAccount.stores.paused}`);
        await page
          .getByRole("button", {
            name: it ? "Scollega ed elimina negozio" : "Disconnect and delete store",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("alertdialog");
        const input = dialog.getByRole("textbox");
        await input.fill(testAccount.stores.paused);
        await page.route("**/app/negozi/*.data*", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const form = new URLSearchParams(route.request().postData()!);
          form.set("conferma", "conferma-errata");
          await route.continue({ postData: form.toString() });
        });
        await dialog
          .getByRole("button", {
            name: it ? "Scollega ed elimina negozio" : "Disconnect and delete store",
            exact: true,
          })
          .click();
        await expect(dialog.getByRole("alert")).toBeVisible();
        await expect(input).toHaveValue(testAccount.stores.paused);
        await page.route("**/app/negozi/*.data*", (route) =>
          route.request().method() === "POST" ? route.abort("failed") : route.continue(),
        );
        await dialog
          .getByRole("button", {
            name: it ? "Scollega ed elimina negozio" : "Disconnect and delete store",
            exact: true,
          })
          .click();
        await expect(dialog.getByRole("alert")).toContainText(
          it ? "confermare l’esito" : "outcome could not be confirmed",
        );
        await expect(input).toHaveValue(testAccount.stores.paused);
        await dialog.getByRole("button", { name: it ? "Annulla" : "Cancel", exact: true }).click();
        let continueHydration = () => {};
        const hydration = new Promise<void>((resolve) => {
          continueHydration = resolve;
        });
        await page.route("**/assets/settings-main-*.js", async (route) => {
          await hydration;
          await route.continue();
        });
        const first = page.getByRole("textbox", { name: it ? "Nome" : "First name", exact: true });
        try {
          await page.goto(`${prefix}/app/impostazioni/account`, { waitUntil: "commit" });
          await expect(first).toBeDisabled();
        } finally {
          continueHydration();
        }
        await page.route("**/app/impostazioni/account.data*", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const form = new URLSearchParams(route.request().postData()!);
          form.set("nome", "");
          await route.continue({ postData: form.toString() });
        });
        await first.fill("Valore da conservare");
        await page
          .getByRole("region", { name: "Account", exact: true })
          .getByRole("button", { name: it ? "Salva" : "Save", exact: true })
          .click();
        await expect(
          page.getByRole("alert").filter({ hasText: it ? "Compila nome" : "Enter your first" }),
        ).toBeVisible();
        await expect(first).toHaveValue("Valore da conservare");
        await expect(
          page
            .getByRole("region", { name: "Account", exact: true })
            .getByRole("button", { name: it ? "Salva" : "Save", exact: true }),
        ).toBeEnabled();
        await page.route("**/app/impostazioni/account.data*", (route) =>
          route.request().method() === "POST" ? route.abort("failed") : route.continue(),
        );
        await page
          .getByRole("region", { name: "Account", exact: true })
          .getByRole("button", { name: it ? "Salva" : "Save", exact: true })
          .click();
        await expect(
          page
            .getByRole("alert")
            .filter({ hasText: it ? "confermare l’esito" : "outcome could not be confirmed" }),
        ).toBeVisible();
        await expect(first).toHaveValue("Valore da conservare");
      });
    }
  });
});
