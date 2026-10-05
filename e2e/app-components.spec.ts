import { expect, test, type Page } from "@playwright/test";

/*
 * Garanzie del design system verificate sulle schermate reali dell'anteprima:
 * form, conferme, copia, nomi lunghi, pannelli, geometria, stati, temi e
 * movimento ridotto.
 */

async function open(page: Page, path: string, scenario?: string) {
  if (scenario) {
    await page.request.post("/anteprima", {
      form: { scenario, redirectTo: "/anteprima/ordini" },
      maxRedirects: 0,
    });
  }
  await page.goto(path);
  // Con un pannello aperto il resto della pagina è inerte: si attende il controllo per id.
  await expect(page.locator("#preview-scenario")).toBeEnabled({ timeout: 20_000 });
}

const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 1280]) {
      test(`negozi, preferenze e identità coerenti ${language} ${colorScheme} ${width}px`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(120_000);
        const t = (it: string, en: string) => (language === "it" ? it : en);
        const prefix = language === "it" ? "" : "/en";
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 844 });
        await open(page, `${prefix}/anteprima/negozi/neg-outlet`, "ordinario");
        const panel = page.getByRole("dialog");
        await expect(panel.locator("#store-sync + ul")).not.toContainText(
          t("Aggiornamento previsto", "Expected update"),
        );
        // La causa della pausa compare una volta e il testo resta allineato all'elenco.
        await expect(
          panel.getByText(t("In pausa per il piano Free:", "Paused by the Free plan:")),
        ).toHaveCount(1);
        const syncLeft = await panel.locator("#store-sync + ul > li").evaluateAll((items) =>
          items.slice(0, 2).map((item) => {
            const range = document.createRange();
            range.selectNodeContents(item);
            return [...range.getClientRects()].find((rect) => rect.width > 0)?.left ?? 0;
          }),
        );
        expect(Math.abs(syncLeft[0]! - syncLeft[1]!)).toBeLessThan(1);
        const choose = panel.getByRole("link", {
          name: t("Scegli il negozio attivo", "Choose the active store"),
        });
        await choose.click();
        const selection = page.getByRole("combobox", {
          name: t("Scegli il negozio attivo", "Choose the active store"),
        });
        await expect(selection).toContainText("Vintage Garage Italia");
        await selection.click();
        await expect(page.getByRole("option")).toHaveCount(2);
        await page.getByRole("option").filter({ hasText: "Outlet" }).click();
        await expect(selection).toContainText("Outlet");
        await expect(
          page.getByRole("button", { name: t("Scegli annuale", "Choose annual") }).locator(".."),
        ).toHaveClass(/border-primary/);

        await open(page, `${prefix}/anteprima/negozi/neg-outlet`, "negozio-scaduto");
        await expect(
          panel.getByRole("button", { name: t("Reimporta storico", "Re-import history") }),
        ).toBeDisabled();
        await expect(panel.locator("#store-sync + ul")).toContainText(
          t("Sincronizzazione sospesa", "Sync is suspended"),
        );
        await expect(panel.locator("section[aria-labelledby=store-connection]")).toContainText(
          t("Scaduta", "Expired"),
        );
        await open(page, `${prefix}/anteprima/negozi/neg-retro`);
        await expect(panel).toContainText(
          t("Importazione dello storico non iniziata", "History import not started"),
        );
        await expect(panel).not.toContainText(
          t("Importazione dello storico completata", "History import complete"),
        );
        await expect(panel.locator("[data-slot=badge]").first()).toHaveClass(/warning/);
        // Senza autorizzazione non arrivano ordini: la preferenza attiva resta sospesa.
        await expect(panel.locator("section[aria-labelledby=store-notifications]")).toContainText(
          t("Sospese finché la sincronizzazione non riprende", "Paused until sync resumes"),
        );
        // L'elenco usa l'etichetta breve per non stringere la colonna dei nomi.
        await expect(page.locator("main")).toContainText(t("Sospese", "Paused"));
        await expect(page.locator("main")).not.toContainText(
          t("finché la sincronizzazione", "until sync resumes"),
        );
        await open(page, `${prefix}/anteprima/negozi/neg-bottega`);
        await expect(
          panel.getByRole("link", {
            name: t("Contatta il supporto", "Contact support"),
            exact: true,
          }),
        ).toHaveAttribute("href", `${prefix}/anteprima/impostazioni/supporto`);
        await open(page, `${prefix}/anteprima/negozi/neg-vintage`, "ebay-non-disponibile");
        await expect(
          page.getByRole("button", {
            name: t("Collega negozio eBay", "Connect eBay store"),
            includeHidden: true,
          }),
        ).toBeDisabled();
        await expect(
          panel.getByRole("button", { name: t("Reimporta storico", "Re-import history") }),
        ).toBeDisabled();
        const remove = panel.getByRole("button", {
          name: t("Scollega ed elimina dati", "Disconnect and delete data"),
          exact: true,
        });
        await remove.click();
        const confirm = page.getByRole("alertdialog");
        await expect(confirm.getByRole("heading")).toHaveText(
          t("Scollega ed elimina dati", "Disconnect and delete data"),
        );
        const overlay = page.locator("[data-slot=alert-dialog-overlay]");
        expect(await overlay.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
          await page
            .locator("[data-slot=sheet-content]")
            .evaluate((el) => Number(getComputedStyle(el).zIndex)),
        );
        const deleteButton = confirm.getByRole("button", {
          name: t("Scollega ed elimina", "Disconnect and delete"),
          exact: true,
        });
        await expect(deleteButton).toBeDisabled();
        await confirm.getByRole("textbox").fill("Vintage Garage Italia");
        await expect(deleteButton).toBeEnabled();
        await page.screenshot({ path: testInfo.outputPath("store-confirmation.png") });
        await page.keyboard.press("Escape");
        await expect(remove).toBeFocused();

        await open(page, `${prefix}/anteprima/negozi/neg-outlet`, "premium-a-vita");
        await expect(panel.locator("#store-sync + ul")).toContainText(
          t("La pausa manuale", "A manual pause"),
        );
        await expect(panel.locator("#store-sync + ul")).not.toContainText(
          t("Aggiornamento previsto", "Expected update"),
        );
        await expect(
          panel.getByRole("button", { name: t("Riprendi", "Resume"), exact: true }),
        ).toBeEnabled();
        await open(page, `${prefix}/anteprima/negozi`, "premium");
        if (width >= 1024) {
          const geometry = await page.getByRole("table").evaluate((table) => {
            const heads = table.querySelectorAll("th");
            const cells = table.querySelectorAll("tbody tr:first-child td");
            const sync = cells[2]!.querySelector("span")!.getBoundingClientRect();
            const badge = cells[1]!.querySelector("[data-slot=badge]")!.getBoundingClientRect();
            const head = heads[2]!.getBoundingClientRect();
            return {
              label: Math.abs(
                head.left + parseFloat(getComputedStyle(heads[2]!).paddingLeft) - sync.left - 24,
              ),
              center: Math.abs(badge.top + badge.height / 2 - sync.top - sync.height / 2),
            };
          });
          expect(geometry.label).toBeLessThan(1);
          expect(geometry.center).toBeLessThan(1);
        }

        await open(page, `${prefix}/anteprima/impostazioni/notifiche`, "premium");
        const enabled = page.getByRole("switch", {
          name: t("Invia notifiche degli ordini", "Send order notifications"),
        });
        const allOrders = page.getByRole("radio", {
          name: t("Tutti i nuovi ordini", "All new orders"),
        });
        await enabled.uncheck();
        await expect(enabled).toBeChecked();
        await expect(allOrders).toBeEnabled();
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: t("Modifica non salvata", "Change not saved") }),
        ).toBeVisible();
        await allOrders.check();
        await expect(allOrders).toBeChecked();
        const digest = page.getByRole("radio", {
          name: t("Riepilogo giornaliero", "Daily summary"),
        });
        await digest.check();
        const time = page.getByRole("combobox", {
          name: t("Orario del riepilogo", "Summary time"),
        });
        await enabled.uncheck();
        await expect(enabled).not.toBeChecked();
        await expect(allOrders).toBeDisabled();
        await expect(digest).toBeDisabled();
        await expect(time).toBeDisabled();
        const storeSwitch = page.getByRole("switch", {
          name: "Vintage Garage Italia",
          exact: true,
        });
        await expect(storeSwitch).toBeDisabled();
        await enabled.check();
        await expect(allOrders).toBeEnabled();
        await expect(allOrders).toBeChecked();
        await expect(digest).toBeChecked();
        await expect(time).toBeEnabled();

        await open(page, `${prefix}/anteprima/impostazioni/aspetto`);
        await expect(
          page.getByRole("combobox", { name: t("Fuso orario", "Time zone") }),
        ).toContainText(t("Roma (Italia)", "Rome (Italy)"));
        await page.getByRole("radio", { name: t("Scuro", "Dark"), exact: true }).check();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await page.reload();
        await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
        if (width >= 768) {
          await page
            .locator("#settings-privacy")
            .evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 210));
          await expect(
            page.locator('nav a[aria-current=true][href$="/impostazioni/privacy"]'),
          ).toBeVisible();
          await page
            .locator("#settings-aspetto")
            .evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 210));
          await expect(
            page.locator('nav a[aria-current=true][href$="/impostazioni/aspetto"]'),
          ).toBeVisible();
        }
        await open(page, `${prefix}/anteprima/impostazioni/privacy`);
        await page
          .getByRole("button", { name: t("Elimina account", "Delete account"), exact: true })
          .click();
        await expect(
          confirm.getByRole("button", {
            name: t("Conferma con un nuovo accesso", "Confirm by signing in again"),
          }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await open(page, `${prefix}/anteprima/impostazioni/supporto`);
        await expect(
          page.getByRole("textbox", { name: t("Messaggio", "Message"), exact: true }),
        ).toHaveAttribute("placeholder", /.+/);
        await expect(page.locator('main a[href^="mailto:"]')).toHaveAttribute(
          "href",
          /^mailto:.+$/,
        );
        await open(page, `${prefix}/anteprima/profilo`);
        await expect(
          page.locator("main").getByText("laura.martini@esempio.invalid", { exact: true }),
        ).toHaveCount(1);
        await expect(
          page.getByRole("textbox", { name: t("Nome", "First name"), exact: true }),
        ).toHaveAttribute("required", "");
        await expect(
          page.getByRole("textbox", { name: t("Cognome", "Last name"), exact: true }),
        ).toHaveAttribute("required", "");
        const requiredLabels = page
          .locator("main label[data-slot=field-label]")
          .filter({ has: page.locator("span[aria-hidden=true]") });
        for (const label of await requiredLabels.all()) {
          expect(
            await label.evaluate((element) => parseFloat(getComputedStyle(element).columnGap)),
          ).toBe(2);
        }
        await expect(
          page.getByRole("link", { name: t("Apri Sicurezza", "Open Security"), exact: true }),
        ).toHaveAttribute("href", `${prefix}/anteprima/impostazioni/sicurezza`);
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("profile.png"), fullPage: true });
      });
    }
  }
}

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 1280]) {
      test(`ordini: conferme, stati e dettaglio ${language} ${colorScheme} a ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        const prefix = language === "it" ? "" : "/en";
        const t = (it: string, en: string) => (language === "it" ? it : en);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await open(page, `${prefix}/anteprima/ordini`, "ordinario");
        const locked = page.getByRole("article", {
          name: t("Ordine", "Order") + " 05-55555-12121",
        });
        const unlock = locked.getByRole("button", { name: t("Sblocca ordine", "Unlock order") });
        await unlock.click();
        const confirm = page.getByRole("alertdialog");
        await expect(confirm).toContainText(t("1 sblocco", "1 unlock"));
        const cancel = confirm.getByRole("button", { name: t("Annulla", "Cancel"), exact: true });
        await expect(cancel).toBeFocused();
        await confirm
          .getByRole("checkbox", { name: t("Non chiedermelo più", "Don’t ask again") })
          .check();
        await cancel.click();
        await expect(unlock).toBeFocused();
        await expect(locked.getByText("BNCLCU75C12F205X")).toHaveCount(0);
        await unlock.click();
        await expect(confirm.getByRole("checkbox")).not.toBeChecked();
        await confirm
          .getByRole("checkbox", {
            name: t("Non chiedermelo più", "Don’t ask again"),
          })
          .check();
        await confirm.getByRole("button", { name: t("Sblocca", "Unlock"), exact: true }).click();
        await expect(locked.getByText("BNCLCU75C12F205X")).toBeVisible();
        await page.reload();
        const restore = page.getByRole("button", {
          name: t("Riattiva conferma sblocco", "Restore unlock confirmation"),
        });
        await expect(restore).toBeVisible();
        await open(page, `${prefix}/anteprima/ordini/ord-09`);
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t("Sblocca ordine", "Unlock order") })
          .click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(
          page.getByRole("dialog").getByText("04567890123", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t("Chiudi", "Close"), exact: true })
          .click();
        await restore.click();
        await expect(restore).toHaveCount(0);
        await open(page, `${prefix}/anteprima/ordini`, "ordinario");
        const select = page.getByRole("button", { name: t("Seleziona", "Select"), exact: true });
        await select.click();
        const zero = page.getByRole("button", { name: t("Sblocca 0", "Unlock 0"), exact: true });
        await expect(zero).toBeDisabled();
        await expect(zero).toHaveClass(/bg-muted/);
        await page.getByRole("button", { name: t("Annulla", "Cancel"), exact: true }).click();
        await expect(select).toBeFocused();
        const failed = page.getByRole("article", {
          name: t("Ordine", "Order") + " 19-00001-99999",
        });
        const retried = page.waitForResponse(
          (response) =>
            response.url().includes("/ordini.data") && response.request().method() === "POST",
        );
        await failed.getByRole("button", { name: t("Riprova", "Try again"), exact: true }).click();
        await expect(failed).toContainText(t("In verifica", "Checking"));
        expect((await retried).status()).toBe(200);
        await expect(
          failed.getByRole("button", { name: t("Riprova", "Try again"), exact: true }),
        ).toHaveCount(0);
        await page.reload();
        await expect(failed).toContainText(t("In verifica", "Checking"));
        if (width === 390)
          await page.getByRole("button", { name: t("Filtri", "Filters"), exact: true }).click();
        const period = page.getByRole("combobox", { name: t("Periodo", "Period"), exact: true });
        await period.click();
        const menu = page.locator('[data-slot="select-content"]');
        await expect(
          menu.getByText(t("Disponibile con Premium", "Available with Premium")),
        ).toBeVisible();
        await expect
          .poll(async () =>
            Math.abs((await menu.boundingBox())!.width - (await period.boundingBox())!.width),
          )
          .toBeLessThan(2);
        expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(
          (await period.boundingBox())!.y + (await period.boundingBox())!.height,
        );
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width, height: 600 });
        await open(page, `${prefix}/anteprima/ordini/ord-01`, "ordinario");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toHaveCSS("outline-style", "none");
        await expect(
          dialog.getByRole("button", { name: t("Apri su eBay", "Open on eBay") }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", { name: t("Esporta ordine", "Export order") }),
        ).toBeVisible();
        const header = dialog.locator('[data-slot="sheet-header"]');
        const headerY = (await header.boundingBox())!.y;
        await dialog.getByRole("tab", { name: /Articoli|Items/ }).click();
        await expect(dialog).toContainText(t("Prezzo unitario", "Unit price"));
        await expect(dialog.locator("li .lucide-package")).toHaveCount(3);
        await dialog
          .locator("[data-slot=sheet-header] + div")
          .evaluate((el) => (el.scrollTop = el.scrollHeight));
        expect(
          await dialog.locator("[data-slot=sheet-header] + div").evaluate((el) => el.scrollTop),
        ).toBeGreaterThan(0);
        expect((await header.boundingBox())!.y).toBe(headerY);
        await expect(dialog.getByRole("tablist")).toBeInViewport();
        await expect(
          dialog.getByRole("tab", { name: t("Dettagli", "Details"), exact: true }),
        ).toBeInViewport();
        await page.screenshot({ path: test.info().outputPath("dettaglio.png") });
        expect(await noPageOverflow(page)).toBe(true);
        await page.setViewportSize({ width, height: 844 });
        await open(page, `${prefix}/anteprima/ordini`, "ordinario");
        const warning = page.getByText("SPSNNA85T55F83", { exact: true }).locator("..");
        await expect(warning).toContainText(t("Da verificare", "Needs review"));
        await expect(warning).toHaveClass(/bg-warning-surface/);
        await expect(warning.getByRole("button", { name: /^Copia |^Copy / })).toBeVisible();
        await page.screenshot({ path: test.info().outputPath("elenco.png"), fullPage: true });
        await open(page, `${prefix}/anteprima/ordini?q=zzzz`, "ordinario");
        const clear = page.getByRole("link", {
          name: t("Cancella ricerca", "Clear search"),
          exact: true,
        });
        await expect(clear).toBeVisible();
        await expect(
          page.getByRole("button", { name: t("Cancella ricerca", "Clear search"), exact: true }),
        ).toHaveCount(0);
        await expect(clear.locator("../..")).toHaveClass(/rounded-xl/);
        await open(page, `${prefix}/anteprima/ordini?mostra=10`, "ordinario");
        await expect(
          page.getByText(
            t("Hai visto tutti gli ordini disponibili.", "You have seen all available orders."),
          ),
        ).toBeVisible();
        await open(page, `${prefix}/anteprima/ordini?periodo=7&mostra=10`, "ordinario");
        await expect(
          page.getByText(
            t(
              "Hai visto tutti gli ordini del periodo.",
              "You have seen all orders in this period.",
            ),
          ),
        ).toBeVisible();
        await open(page, `${prefix}/anteprima/ordini`, "ebay-non-disponibile");
        await expect(page.locator("main > div > header [role=status]")).toHaveClass(/text-warning/);
        await expect(
          page.getByRole("button", { name: t("Riprova", "Try again"), exact: true }).first(),
        ).toBeDisabled();
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [500, 1440]) {
      test(`accesso e pagine standalone ${language} ${colorScheme} a ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 666 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        const prefix = language === "it" ? "" : "/en";
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(prefix || "/");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveTitle(
          language === "it" ? "FiscalBay | Accedi" : "FiscalBay | Sign in",
        );
        const legal = page.getByRole("navigation", {
          name: language === "it" ? "Documenti legali" : "Legal documents",
        });
        await expect(legal.getByRole("link")).toHaveCount(2);
        if (width === 500) {
          const card = page.locator("main .rounded-2xl");
          expect((await card.boundingBox())!.x).toBe(16);
          expect((await page.locator("main header img:visible").boundingBox())!.x).toBe(16);
        }
        const passkey = page.getByRole("button", {
          name: language === "it" ? "Accedi con passkey" : "Sign in with a passkey",
          exact: true,
        });
        await expect(passkey).toBeVisible();
        if (width === 1440) await expect(passkey).toBeInViewport();
        const ebay = page.locator('button[value="ebay"]:visible img');
        await expect(ebay).toBeVisible();
        expect(await ebay.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        const headline = page.locator("aside p").first();
        const top = width === 1440 ? (await headline.boundingBox())!.y : 0;
        await page
          .getByRole("tab", {
            name: language === "it" ? "Crea account" : "Create account",
            exact: true,
          })
          .click();
        await page
          .getByRole("radio", { name: language === "it" ? "Azienda" : "Business", exact: true })
          .click();
        if (width === 1440) expect((await headline.boundingBox())!.y).toBeCloseTo(top, 0);
        await page
          .getByRole("tab", { name: language === "it" ? "Accedi" : "Sign in", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: language === "it" ? "Hai dimenticato la password?" : "Forgot your password?",
            exact: true,
          })
          .click();
        await expect(passkey).toHaveCount(0);
        await expect(
          page.locator('button[value="google"]:visible,button[value="ebay"]:visible'),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: language === "it" ? "Torna ad accedere" : "Back to sign in",
            exact: true,
          })
          .click();
        await expect(passkey).toBeVisible();
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        await page.screenshot({
          path: `/tmp/fiscalbay-accesso-${language}-${colorScheme}-${width}.png`,
          fullPage: true,
        });
        for (const path of ["/termini", "/privacy", "/auth/error"]) {
          await page.goto(`${prefix}${path}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(
            page.getByRole("link", {
              name: language === "it" ? "Torna a FiscalBay" : "Back to FiscalBay",
              exact: true,
            }),
          ).toBeVisible();
          const logo = page.locator("header img:visible");
          const card = page.locator("main > div");
          expect(
            (await card.boundingBox())!.y -
              ((await logo.boundingBox())!.y + (await logo.boundingBox())!.height),
          ).toBeLessThan(40);
          await expect.poll(() => noPageOverflow(page)).toBe(true);
          if (path !== "/auth/error") {
            await expect(page.locator("main")).not.toContainText("bozza-2026");
            await expect(page.locator("main")).toContainText(
              language === "it" ? "28 settembre 2026" : "28 September 2026",
            );
          }
        }
        for (const provider of ["google", "ebay", "unknown"]) {
          await page.goto(
            `${prefix}/auth/error?error=account_already_linked_to_different_user&provider=${provider}`,
          );
          const body = page.locator("main p");
          await expect(body).toContainText(
            provider === "google"
              ? "Google"
              : provider === "ebay"
                ? "eBay"
                : language === "it"
                  ? "L’account che hai appena usato"
                  : "The account you just used",
          );
        }
        await page.screenshot({
          path: `/tmp/fiscalbay-standalone-${language}-${colorScheme}-${width}.png`,
          fullPage: true,
        });
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const language of ["it", "en"] as const) {
  test(`esito di sicurezza con focus e nuovo accesso ${language}`, async ({ page }) => {
    const prefix = language === "it" ? "/" : "/en";
    await page.goto(`${prefix}?accesso=nuovo-accesso`);
    const status = page
      .getByRole("status")
      .filter({ hasText: language === "it" ? "accesso recente" : "recent sign-in" });
    await expect(status.locator("..")).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${prefix === "/" ? "/" : "/en"}$`));
    const button = page.getByRole("button", {
      name: language === "it" ? "Esci e accedi di nuovo" : "Sign out and sign in again",
    });
    await expect(button).toBeVisible();
    await expect(button.locator("..")).toHaveAttribute(
      "action",
      language === "it" ? "/accesso" : "/en/accesso",
    );
    await page.goto(`${prefix}?accesso=password-link`);
    const notice = page.getByRole("status").filter({
      hasText: language === "it" ? "impostare una nuova password" : "set a new password",
    });
    await expect(notice.locator("..")).toBeFocused();
  });
}

test("sicurezza nell'anteprima senza JavaScript resta simulata", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(new URL(request.url()).pathname);
  });
  try {
    await page.goto("/anteprima/impostazioni/sicurezza");
    await expect(page.getByRole("button", { name: "Cambia password", exact: true })).toBeVisible();
    await expect(page.locator('form[action="/accesso"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Cambia password", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cambia password", exact: true })).toBeVisible();
    expect(posts).toEqual(["/anteprima/impostazioni/sicurezza"]);
    await expect(page).toHaveURL(/\/anteprima\/impostazioni\/sicurezza$/);
  } finally {
    await context.close();
  }
});

for (const language of ["it", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`sicurezza condivisa e profilo coerente ${language} ${width}px`, async ({
      page,
    }, testInfo) => {
      const it = language === "it";
      const prefix = it ? "" : "/en";
      await page.setViewportSize({ width, height: 844 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const posts: Array<{ path: string; fields: URLSearchParams }> = [];
      page.on("request", (request) => {
        if (request.method() === "POST")
          posts.push({
            path: new URL(request.url()).pathname,
            fields: new URLSearchParams(request.postData() ?? ""),
          });
      });
      await open(page, `${prefix}/anteprima/impostazioni/sicurezza`, "ordinario");
      const removeText = it ? "Rimuovi" : "Remove";
      const cancelText = it ? "Annulla" : "Cancel";
      const methods = page.locator('section[aria-labelledby="security-methods"]');
      await expect(methods.getByRole("button", { name: removeText, exact: true })).toHaveCount(3);
      for (const [label, intent, field, value] of [
        [it ? "Email e password" : "Email and password", "rimuovi-metodo", "metodo", "password"],
        ["Google", "rimuovi-metodo", "metodo", "google"],
        ["Passkey", "passkey-remove", "id", "preview-passkey"],
      ]) {
        const row = methods.getByRole("group", { name: new RegExp(`^${label}`) });
        const trigger = row.getByRole("button", { name: removeText, exact: true });
        const before = posts.length;
        await trigger.click();
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("button", { name: cancelText, exact: true })).toBeFocused();
        expect(posts).toHaveLength(before);
        await dialog.getByRole("button", { name: cancelText, exact: true }).click();
        await expect(trigger).toBeFocused();
        expect(posts).toHaveLength(before);
        await trigger.click();
        await dialog.getByRole("button", { name: removeText, exact: true }).click();
        await expect.poll(() => posts.length).toBe(before + 1);
        expect(posts.at(-1)!.path).toBe(`${prefix}/anteprima/impostazioni/sicurezza.data`);
        expect(posts.at(-1)!.fields.get("intent")).toBe(intent);
        expect(posts.at(-1)!.fields.get(field)).toBe(value);
        await expect(dialog).toHaveCount(0);
        await expect(
          page.getByText(
            it ? "Anteprima: l’azione è simulata." : "Preview: this action is simulated.",
            { exact: true },
          ),
        ).toBeVisible();
      }
      const before = posts.length;
      await page
        .getByRole("button", { name: it ? "Cambia email" : "Change email", exact: true })
        .click();
      await page
        .getByRole("button", { name: it ? "Invia il link" : "Send the link", exact: true })
        .click();
      const email = page.getByRole("textbox", {
        name: it ? "Nuova email" : "New email",
        exact: true,
      });
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toBeFocused();
      expect(posts).toHaveLength(before);
      await email.fill("new@example.invalid");
      await page
        .getByRole("button", { name: it ? "Invia il link" : "Send the link", exact: true })
        .click();
      await expect.poll(() => posts.length).toBe(before + 1);
      expect(posts.at(-1)!.fields.get("intent")).toBe("cambia-email");
      await page
        .getByRole("button", { name: it ? "Aggiungi passkey" : "Add passkey", exact: true })
        .click();
      await expect.poll(() => posts.length).toBe(before + 2);
      expect(posts.at(-1)!.fields.get("intent")).toBe("passkey-add");
      expect(
        posts.some((post) => post.path.includes("/api/auth") || post.path.endsWith("/accesso")),
      ).toBe(false);
      await expect.poll(() => noPageOverflow(page)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`security-${language}-${width}.png`),
        fullPage: true,
      });

      await open(page, `${prefix}/anteprima/profilo`);
      const first = page.getByRole("textbox", { name: it ? "Nome" : "First name", exact: true });
      await expect(first).toHaveValue("Laura");
      await expect(
        page.getByRole("textbox", { name: it ? "Cognome" : "Last name", exact: true }),
      ).toHaveValue("Martini");
      await expect(
        page.getByRole("textbox", { name: it ? "Ragione sociale" : "Company name", exact: true }),
      ).toHaveValue("Martini ricambi");
      await expect(
        page.getByText(
          it
            ? "Facoltativo. Compare nelle email di servizio."
            : "Optional. Shown in service emails.",
        ),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: it ? "Cambia email" : "Change email", exact: true }),
      ).toHaveCount(0);
      await first.fill("");
      await page.getByRole("button", { name: it ? "Salva" : "Save", exact: true }).click();
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute("aria-invalid", "true");
      await expect.poll(() => noPageOverflow(page)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`profile-${language}-${width}.png`),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
}

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`idratazione dei tempi relativi ${language} ${colorScheme}`, async ({
      browser,
      baseURL,
    }) => {
      const prefix = language === "it" ? "/anteprima" : "/en/anteprima";
      for (const route of ["impostazioni/aspetto", "impostazioni/supporto", "negozi", "ordini"]) {
        // Ogni caricamento diretto parte da una sessione nuova, senza richieste della pagina precedente.
        const context = await browser.newContext({
          baseURL,
          colorScheme,
          viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await open(page, `${prefix}/${route}`, "ordinario");
          expect(errors, route).toEqual([]);
          if (route.startsWith("impostazioni/")) {
            await expect(
              page.getByText(
                language === "it" ? "Ultima attività l’altro ieri" : "Last active 2 days ago",
                { exact: true },
              ),
            ).toBeVisible();
          }
          await page
            .getByRole("button", { name: language === "it" ? /Notifiche/ : /Notifications/ })
            .click();
          await expect(
            page.getByRole("dialog", { name: language === "it" ? "Notifiche" : "Notifications" }),
          ).toBeVisible();
          expect(errors, `${route}, notifiche`).toEqual([]);
        } finally {
          await context.close();
        }
      }
    });
  }
}

for (const locale of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 768, 1280]) {
      test(`negozi e contatti completi, ${locale}, ${colorScheme}, ${width} px`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(90_000);
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        const prefix = locale === "it" ? "/anteprima" : "/en/anteprima";
        await page.setViewportSize({ width, height: 900 });
        await open(page, `${prefix}/negozi`, "premium-a-vita");
        const list =
          width < 1024
            ? page.getByRole("list", { name: locale === "it" ? "Elenco negozi" : "Store list" })
            : page.getByRole("table");
        await expect(list).toBeVisible();
        await expect(list).toContainText(
          "Outlet ricambi auto e moto d’epoca - magazzino secondario",
        );
        await expect(list).toContainText("outlet_ricambi_epoca");
        await expect(list).toContainText(locale === "it" ? "Disattivate" : "Off");
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`stores-${width}.png`), fullPage: true });

        await open(page, `${prefix}/negozi/neg-vintage`);
        const dialog = page.getByRole("dialog");
        const disconnect = dialog.getByRole("button", {
          name: locale === "it" ? "Scollega" : "Disconnect",
          exact: true,
        });
        const remove = dialog.getByRole("button", {
          name: locale === "it" ? "Scollega ed elimina dati" : "Disconnect and delete data",
          exact: true,
        });
        await remove.scrollIntoViewIfNeeded();
        for (const button of [disconnect, remove]) {
          await expect(button).toBeInViewport({ ratio: 1 });
          expect(
            await button.evaluate((e) => {
              const panel = e.closest('[role="dialog"]')!.getBoundingClientRect();
              const bounds = e.getBoundingClientRect();
              return (
                e.scrollWidth <= e.clientWidth &&
                bounds.left >= panel.left &&
                bounds.right <= panel.right
              );
            }),
          ).toBe(true);
        }
        const updates = dialog.locator("section[aria-labelledby='store-recent'] li");
        expect(await updates.count()).toBeGreaterThan(1);
        for (const update of await updates.all()) {
          expect(
            await update.evaluate((e) => {
              const outcome = e.querySelector("span")!.getBoundingClientRect();
              const time = e.querySelector("time")!.getBoundingClientRect();
              return time.top >= outcome.bottom;
            }),
          ).toBe(true);
        }
        await page.screenshot({ path: testInfo.outputPath(`store-actions-${width}.png`) });
        await remove.click();
        const confirm = page.getByRole("alertdialog");
        const deletion = confirm.getByRole("button", {
          name: locale === "it" ? "Scollega ed elimina" : "Disconnect and delete",
          exact: true,
        });
        await expect(deletion).toBeDisabled();
        await confirm.getByRole("textbox").fill("Vintage Garage Italia");
        await expect(deletion).toBeEnabled();
        await page.keyboard.press("Escape");
        await expect(remove).toBeFocused();
        await disconnect.click();
        await expect(page.getByRole("alertdialog").getByRole("textbox")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(disconnect).toBeFocused();

        await open(page, `${prefix}/ordini?mostra=2`, "ordinario");
        const email = page
          .getByRole("article")
          .getByText("amministrazione@galli-restauri.invalid", { exact: true });
        await expect(email).toBeVisible();
        expect(
          await email.evaluate((e) => {
            const domain = e.querySelector("span:last-child")!;
            const range = document.createRange();
            range.selectNodeContents(domain);
            return range.getClientRects().length === 1 && e.scrollWidth <= e.clientWidth;
          }),
        ).toBe(true);
        await expect(
          page
            .getByRole("article")
            .filter({ hasText: "amministrazione@galli-restauri.invalid" })
            .getByRole("link", { name: locale === "it" ? "Dettaglio" : "Details", exact: true }),
        ).toBeVisible();
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        await email.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`contacts-${width}.png`) });

        await open(page, `${prefix}/ordini/ord-10`);
        await expect(
          page
            .getByRole("dialog")
            .getByText("amministrazione@galli-restauri.invalid", { exact: true }),
        ).toBeVisible();
        await open(page, `${prefix}/ordini/ord-01`);
        await page
          .getByRole("tab", { name: locale === "it" ? "Articoli (3)" : "Items (3)", exact: true })
          .click();
        const items = page.getByRole("tabpanel");
        await expect(
          items.getByText(locale === "it" ? "Senza SKU" : "No SKU", { exact: true }),
        ).toBeVisible();
        await expect(items).not.toContainText(locale === "it" ? "SKU: Senza SKU" : "SKU: No SKU");
        await expect(items).toContainText("MSC-OL-44");
        await expect(items).toContainText("CUS-12");
        await expect.poll(() => noPageOverflow(page)).toBe(true);
      });
    }
  }
}

const supportAddress = ["supporto", "fiscalbay.it"].join("@");

test(
  "GET delle azioni pubbliche torna all'accesso nella lingua richiesta",
  { tag: "@smoke" },
  async ({ request }) => {
    for (const prefix of ["", "/en"]) {
      for (const path of ["/accesso", "/negozi/collega"]) {
        const response = await request.get(`${prefix}${path}?redirectTo=https://example.invalid`, {
          maxRedirects: 0,
        });
        expect(response.status()).toBe(302);
        expect(response.headers().location).toBe(prefix || "/");
        expect(response.headers()["cache-control"]).toBe("no-store");
      }
    }
  },
);

for (const language of ["it", "en"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 768, 1280]) {
      test(`accesso pubblico e nuova password ${language} ${colorScheme} a ${width} px`, async ({
        browser,
        baseURL,
      }, testInfo) => {
        // Il caso percorre errore, collegamento, reset e recupero con più navigazioni.
        test.setTimeout(60_000);
        const context = await browser.newContext({
          baseURL,
          colorScheme,
          viewport: { width, height: 844 },
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const prefix = language === "it" ? "" : "/en";
        const title = language === "it" ? "Scegli una nuova password" : "Choose a new password";
        const back = language === "it" ? "Torna ad accedere" : "Back to sign in";
        try {
          for (const error of ["", "account_already_linked_to_different_user"]) {
            await page.goto(`${prefix}/auth/error?error=${error}`);
            await expect(
              page.getByRole("link", { name: new RegExp(supportAddress) }),
            ).toHaveAttribute("href", `mailto:${supportAddress}`);
          }
          await testInfo.attach("errore-pubblico", {
            body: await page.screenshot({
              path: testInfo.outputPath("errore-pubblico.png"),
              fullPage: true,
            }),
            contentType: "image/png",
          });
          await page.goto(`${prefix || "/"}?negozio=altro-spazio`);
          await expect(page.getByRole("link", { name: new RegExp(supportAddress) })).toBeVisible();
          await page.goto(`${prefix || "/"}?token=synthetic-invalid-token`);
          await expect(page).toHaveTitle(`FiscalBay | ${title}`);
          await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
          const form = page.locator("form");
          await expect(form).toHaveAttribute("action", `${prefix}/accesso`);
          await expect(form.locator('input[name="token"]')).toHaveValue("synthetic-invalid-token");
          await expect(form.locator('input[name="password"]')).toHaveAttribute(
            "autocomplete",
            "new-password",
          );
          const backLink = page.getByRole("link", { name: back, exact: true });
          await expect(backLink).toBeInViewport();
          await expect.poll(() => noPageOverflow(page)).toBe(true);
          if (width < 1024) {
            const heading = page.getByRole("heading", { name: title, level: 2 });
            expect((await heading.boundingBox())!.y).toBeLessThan(320);
          }
          await page.evaluate(() => document.fonts.ready);
          await testInfo.attach("nuova-password", {
            body: await page.screenshot({
              path: testInfo.outputPath("nuova-password.png"),
              fullPage: true,
            }),
            contentType: "image/png",
          });
          await backLink.click();
          await expect(page).toHaveURL(new RegExp(`${prefix || "/"}$`));
          await expect(
            page.getByRole("tab", { name: language === "it" ? "Accedi" : "Sign in", exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: language === "it" ? "Hai dimenticato la password?" : "Forgot your password?",
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("button", {
              name: language === "it" ? "Invia il link" : "Send link",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page
              .getByRole("tabpanel", {
                name: language === "it" ? "Accedi" : "Sign in",
                exact: true,
              })
              .locator('input[name="email"]'),
          ).toBeVisible();
        } finally {
          await context.close();
        }
      });
    }
  }
}

for (const width of [390, 768, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`impostazioni e profilo: contesto, documenti e validazione a ${width}px ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: width === 1440 ? 720 : 844 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await open(page, "/anteprima/impostazioni/aspetto");
      for (const locale of ["en", "it"] as const) {
        const it = locale === "it";
        const prefix = it ? "" : "/en";
        await page.getByRole("link", { name: it ? "Italiano" : "English", exact: true }).click();
        await expect(page).toHaveURL(
          `${testInfo.project.use.baseURL}${prefix}/anteprima/impostazioni/aspetto`,
        );
        const appearance = page.locator("#settings-aspetto");
        await expect(appearance).toHaveText(it ? "Aspetto e lingua" : "Appearance and language");
        await expect(appearance).toBeInViewport({ ratio: 1 });
        if (width >= 768) {
          await expect(
            page.locator('a[aria-current="true"][href$="/impostazioni/aspetto"]'),
          ).toBeVisible();
          await expect
            .poll(async () => {
              const heading = await appearance.boundingBox();
              const header = await page.locator("header").boundingBox();
              return heading!.y >= header!.y + header!.height && heading!.y < 180;
            })
            .toBe(true);
          await expect
            .poll(() =>
              page
                .locator('a[aria-current="true"][href$="/impostazioni/aspetto"]')
                .evaluate((link) => {
                  const item = link.parentElement!.getBoundingClientRect();
                  const indicator = link
                    .closest("ul")!
                    .querySelector('[aria-hidden="true"]')!
                    .getBoundingClientRect();
                  return (
                    Math.abs(item.y - indicator.y) < 1 &&
                    Math.abs(item.height - indicator.height) < 1
                  );
                }),
            )
            .toBe(true);
        }
        const timezone = it ? "Fuso orario" : "Time zone";
        await expect(page.getByRole("combobox", { name: timezone, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: timezone, exact: true })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath(`appearance-${locale}.png`) });
      }

      for (const locale of ["it", "en"] as const) {
        const it = locale === "it";
        const prefix = it ? "" : "/en";
        await open(page, `${prefix}/anteprima/impostazioni/piano`, "premium");
        // Premium non anticipa il downgrade: la scelta del negozio attivo è solo nel Free.
        await expect(page.locator("main")).not.toContainText(
          it ? "Negozio attivo se torni al piano Free" : "Active store if you return to Free",
        );
        await open(page, `${prefix}/anteprima/impostazioni/piano`, "premium-a-vita");
        const documents = page.getByRole("button", {
          name: it
            ? "Consulta ricevute e fatture su Stripe"
            : "View receipts and invoices on Stripe",
        });
        await expect(documents).toBeVisible();
        await expect(
          page.getByRole("button", { name: /Gestisci abbonamento|Manage subscription/ }),
        ).toHaveCount(0);
        await documents.click();
        await expect(page.getByRole("status").filter({ hasText: "simulat" }).first()).toBeVisible({
          timeout: 20_000,
        });
        await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni/piano$`));
        await page.screenshot({ path: testInfo.outputPath(`lifetime-${locale}.png`) });

        await open(page, `${prefix}/anteprima/impostazioni/supporto`);
        await page.getByRole("button", { name: it ? "Invia" : "Send", exact: true }).click();
        const message = page.getByRole("textbox", {
          name: it ? "Messaggio" : "Message",
          exact: true,
        });
        await expect(message).toBeFocused();
        await expect(page.locator('[role="alert"][data-slot="alert"]')).toBeInViewport({
          ratio: 1,
        });
        await expect(message).toHaveAttribute("aria-invalid", "true");
        await expect(message).toHaveAccessibleDescription(
          it ? "Scrivi il messaggio." : "Write your message.",
        );
        await expect(message).toBeInViewport({ ratio: 1 });
        const contact = page.getByRole("heading", {
          name: it ? "Scrivi all’assistenza" : "Contact support",
          exact: true,
        });
        await expect
          .poll(async () => {
            const heading = await contact.boundingBox();
            const header = await page.locator("header").boundingBox();
            return heading!.y >= header!.y + header!.height;
          })
          .toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`support-${locale}.png`) });

        await open(page, `${prefix}/anteprima/profilo`);
        await expect(
          page.getByRole("textbox", { name: it ? "Nome" : "First name", exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.locator("main > div").evaluate((element) => {
              const own = element.getBoundingClientRect();
              const parent = element.parentElement!.getBoundingClientRect();
              return Math.abs(own.left + own.width / 2 - parent.left - parent.width / 2);
            }),
          )
          .toBeLessThan(1);
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`profile-${locale}.png`),
          fullPage: true,
        });
      }
    });
  }
}

test("errori del form associati al campo e focus restituito dalla conferma", async ({ page }) => {
  await open(page, "/anteprima/impostazioni/supporto");
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  const message = page.getByRole("textbox", { name: "Messaggio", exact: true });
  await expect(message).toBeFocused();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await expect(message).toHaveAccessibleDescription(/Scrivi il messaggio/);

  await open(page, "/anteprima/negozi/neg-vintage");
  const trigger = page.getByRole("dialog").getByRole("button", { name: "Scollega", exact: true });
  await trigger.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByRole("button", { name: "Annulla", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("copia fallita visibile e recupero con un nuovo tentativo", async ({ page }) => {
  await open(page, "/anteprima/ordini");
  await page.evaluate(() => {
    let attempts = 0;
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (value: string) => {
        if (++attempts === 1) throw new DOMException("Denied", "NotAllowedError");
        document.documentElement.dataset.copied = value;
      },
    });
  });
  const card = page.getByRole("article", { name: "Ordine 27-10293-84756" });
  const copy = card.getByRole("button", {
    name: "Copia Codice Fiscale: ordine 27-10293-84756",
    exact: true,
  });
  await copy.click();
  await expect(card.getByText(/^Copia non riuscita\./)).toBeVisible();
  await copy.click();
  await expect(page.locator("html")).toHaveAttribute("data-copied", "RSSMRA80A41H501U");
  await expect(card.getByText(/^Copia non riuscita\./)).toHaveCount(0);
  await expect(copy).toHaveAttribute("data-state", "copied");
});

for (const locale of ["it", "en"] as const) {
  test(`nomi lunghi nel filtro dei negozi su touch, ${locale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    try {
      await open(page, locale === "it" ? "/anteprima/ordini" : "/en/anteprima/ordini", "premium");
      await page.getByRole("button", { name: locale === "it" ? /^Filtri/ : /^Filters/ }).tap();
      const select = page.getByRole("combobox", {
        name: locale === "it" ? "Negozio" : "Store",
        exact: true,
      });
      await select.tap();
      const option = page.getByRole("option", {
        name: "Outlet ricambi auto e moto d’epoca - magazzino secondario",
        exact: true,
      });
      await expect(option).toBeVisible();
      await expect.poll(() => option.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await option.tap();
      await expect(select).toContainText("magazzino secondario");
      await expect.poll(() => noPageOverflow(page)).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    } finally {
      await context.close();
    }
  });
}

test("pannello di dettaglio scorrevole con chiusura raggiungibile", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 260 });
  await open(page, "/anteprima/ordini/ord-01");
  const dialog = page.getByRole("dialog");
  const source = dialog.getByText(/^Fonte: eBay/);
  await source.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport({ ratio: 1 });
  const close = dialog.getByRole("button", { name: "Chiudi", exact: true });
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);
});

test("geometria dei codici e delle colonne fiscali da 320 a 1280 px", async ({ page }) => {
  await open(page, "/anteprima/ordini");
  for (const width of [320, 375, 640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => noPageOverflow(page)).toBe(true);
    const bounds = await page
      .getByRole("region", { name: "Elenco ordini" })
      .getByRole("button", { name: /^Copia / })
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const field = button.parentElement!.getBoundingClientRect();
          const code = button.parentElement!.querySelector("span")!.getBoundingClientRect();
          const own = button.getBoundingClientRect();
          return {
            cardLeft: Math.round(button.closest("article")!.getBoundingClientRect().left),
            x: field.x,
            codeRight: code.right,
            buttonLeft: own.left,
            codeMiddle: code.y + code.height / 2,
            buttonMiddle: own.y + own.height / 2,
          };
        }),
      );
    expect(bounds.length).toBeGreaterThanOrEqual(3);
    for (const bound of bounds) {
      expect(bound.codeRight).toBeLessThanOrEqual(bound.buttonLeft);
      expect(Math.abs(bound.codeMiddle - bound.buttonMiddle)).toBeLessThan(1);
    }
    // Nella stessa colonna di schede i codici partono dallo stesso punto.
    for (const left of new Set(bounds.map((bound) => bound.cardLeft))) {
      const xs = bounds.filter((bound) => bound.cardLeft === left).map((bound) => bound.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1);
    }
  }
});

test("stati senza valore senza Copia, sblocco e Premium distinti", async ({ page }) => {
  await open(page, "/anteprima/ordini");
  for (const id of ["19-00001-99999", "31-77421-10058", "05-55555-12121"]) {
    const card = page.getByRole("article", { name: `Ordine ${id}` });
    await expect(card.getByRole("button", { name: /^Copia / })).toHaveCount(0);
  }
  const locked = page.getByRole("article", { name: "Ordine 05-55555-12121" });
  await expect(locked.locator(".icon-unlock")).toHaveCount(2);
  await expect(locked.locator(".lucide-crown")).toHaveCount(0);
  await open(page, "/anteprima/impostazioni/esportazione");
  await expect(page.getByText("Premium", { exact: true }).locator("svg")).toHaveClass(
    /lucide-crown/,
  );
});

test("nomi distinti dei pulsanti Copia nell'elenco", async ({ page }) => {
  await open(page, "/anteprima/ordini");
  const names = await page
    .getByRole("region", { name: "Elenco ordini" })
    .getByRole("button", { name: /^Copia / })
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(names.length).toBeGreaterThan(1);
  expect(new Set(names).size).toBe(names.length);
});

test("superfici nei due temi", { tag: "@smoke" }, async ({ page }) => {
  for (const [scheme, background, card, panel] of [
    ["light", "rgb(245, 247, 250)", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
    ["dark", "rgb(18, 20, 24)", "rgb(28, 31, 37)", "rgb(36, 40, 48)"],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, "/anteprima/ordini/ord-02");
    await expect(page.locator("body")).toHaveCSS("background-color", background);
    await expect(page.locator("article").first()).toHaveCSS("background-color", card);
    await expect(page.getByRole("dialog")).toHaveCSS("background-color", panel);
  }
});

test("movimento ridotto: dato intero e nuovi ordini senza animazione", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/anteprima/ordini");
  await page
    .getByRole("article", { name: "Ordine 05-55555-12121" })
    .getByRole("button", { name: "Sblocca ordine" })
    .click();
  const value = page.getByText("BNCLCU75C12F205X", { exact: true });
  await page.getByRole("alertdialog").getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(value).toBeVisible();
  await expect(value).toHaveCSS("animation-name", "none");
  await expect(value).toHaveCSS("filter", "none");

  // In cima alla lista i nuovi ordini entrano subito, senza pulsante.
  await open(page, "/anteprima/ordini", "aggiornamento");
  // La riapertura ripristina lo scorrimento dello sblocco: tornando in cima i nuovi ordini entrano.
  await page.evaluate(() => scrollTo(0, 0));
  const incoming = page.getByRole("article", { name: "Ordine 40-10001-20002" });
  await expect(incoming).toBeVisible();
  await expect(page.getByRole("button", { name: /nuovi ordini/ })).toHaveCount(0);
  await expect(incoming).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      incoming.evaluate((e) => e.getAnimations().filter((a) => a.playState === "running").length),
    )
    .toBe(0);
});

const notice = (page: Page) => page.locator('[role="status"][aria-live="polite"] > p');

for (const width of [390, 1280]) {
  test(`avviso breve sopra il pannello e sopra la barra di selezione a ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, "/anteprima/negozi/neg-vintage");
    await page.getByRole("dialog").getByRole("button", { name: "Metti in pausa" }).click();
    await expect(notice(page)).toBeVisible();
    // Il punto centrale dell'avviso appartiene all'avviso, non alla velatura del pannello.
    expect(
      await notice(page).evaluate((node) => {
        // L'avviso non intercetta i clic: per la prova si rende colpibile.
        (node as HTMLElement).style.pointerEvents = "auto";
        const box = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
    ).toBe(true);

    await open(page, "/anteprima/ordini", "ordinario");
    await page.getByRole("button", { name: "Seleziona", exact: true }).click();
    await page.getByRole("checkbox", { name: "Seleziona l’ordine 05-55555-12121" }).click();
    await page.getByRole("button", { name: "Esporta", exact: true }).click();
    await expect(notice(page)).toBeVisible();
    const bar = page
      .getByRole("button", { name: "Esporta", exact: true })
      .locator("xpath=../../..");
    const toast = (await notice(page).boundingBox())!;
    expect(toast.y + toast.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
  });
}

test("azioni distruttive con lo stesso aspetto e senza rientro", async ({ page }) => {
  await open(page, "/anteprima/impostazioni/sicurezza");
  const style = (name: string) =>
    page
      .getByRole("button", { name, exact: true })
      .first()
      .evaluate((node) => {
        const css = getComputedStyle(node);
        return { color: css.color, border: css.borderTopWidth, background: css.backgroundColor };
      });
  const remove = await style("Rimuovi");
  expect(remove).toEqual(await style("Esci da tutti gli altri dispositivi"));
  expect(remove.border).toBe("1px");
  expect(remove.color).not.toBe((await style("Cambia password")).color);
});

for (const language of ["it", "en"] as const) {
  test(`errori dei campi di accesso e registrazione accanto al campo, ${language}`, async ({
    page,
  }) => {
    const it = language === "it";
    await page.goto(it ? "/" : "/en");
    await page.waitForLoadState("networkidle");
    const signIn = page.getByRole("tabpanel");
    await signIn.getByRole("button", { name: it ? "Accedi" : "Sign in", exact: true }).click();
    const email = signIn.getByRole("textbox", { name: "Email" });
    await expect(signIn.locator('label[for="email"] [aria-hidden="true"]')).toHaveText("*");
    await expect(email).toHaveAttribute("required", "");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(
      it ? "Compila questo campo." : "Fill in this field.",
    );
    await email.fill("nome");
    await signIn.getByRole("button", { name: it ? "Accedi" : "Sign in", exact: true }).click();
    await expect(email).toHaveAccessibleDescription(/nome@dominio\.it|name@example\.com/);
    await email.fill("nome@example.invalid");
    await expect(email).not.toHaveAttribute("aria-invalid");

    await page.getByRole("tab", { name: it ? "Crea account" : "Create account" }).click();
    const signUp = page.getByRole("tabpanel");
    const submit = signUp.getByRole("button", {
      name: it ? "Crea account" : "Create account",
      exact: true,
    });
    await expect(signUp.locator('label[for="first-name"] [aria-hidden="true"]')).toHaveText("*");
    await submit.click();
    await expect(
      signUp.getByRole("textbox", { name: it ? "Nome" : "First name", exact: true }),
    ).toBeFocused();
    await signUp
      .getByRole("textbox", { name: it ? "Nome" : "First name", exact: true })
      .fill("Maria");
    await signUp.getByRole("textbox", { name: it ? "Cognome" : "Last name" }).fill("Rossi");
    await signUp.getByRole("textbox", { name: "Email" }).fill("maria@example.invalid");
    const password = signUp.getByLabel(/Password/);
    await password.fill("corta");
    await submit.click();
    await expect(password).toBeFocused();
    await expect(password).toHaveAccessibleDescription(
      it ? "Usa almeno 8 caratteri." : "Use at least 8 characters.",
    );
    await password.fill("una-password-lunga");
    await submit.click();
    const terms = signUp.getByRole("checkbox").first();
    await expect(terms).toBeFocused();
    await expect(terms).toHaveAttribute("aria-invalid", "true");
    await expect(
      signUp.getByText(
        it
          ? "Accetta i Termini di servizio per continuare."
          : "Accept the Terms of Service to continue.",
      ),
    ).toBeVisible();
  });
}

test("l'esito dell'accesso esce dall'indirizzo e non torna alla ricarica", async ({ page }) => {
  const text = "Negozio già collegato a un altro account";
  await page.goto("/?negozio=altro-spazio");
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
});

test("domande frequenti con il segno del prodotto e tastiera", async ({ page }) => {
  await open(page, "/anteprima/impostazioni/supporto");
  const summary = page.locator("details summary").first();
  expect(await summary.evaluate((node) => getComputedStyle(node).display)).toBe("flex");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
});

test("lingue con il proprio nome nelle Impostazioni inglesi", async ({ page }) => {
  await open(page, "/en/anteprima/impostazioni/aspetto");
  const language = page.getByRole("navigation", { name: "Language" });
  await expect(language.getByRole("link", { name: "Italiano", exact: true })).toHaveAttribute(
    "lang",
    "it",
  );
  await open(page, "/en/anteprima/impostazioni/messaggio");
  await expect(page.getByRole("tab", { name: "Italiano", exact: true })).toHaveAttribute(
    "lang",
    "it",
  );
});
