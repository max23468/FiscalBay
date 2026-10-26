import type { Page } from "@playwright/test";
import { noPageOverflow, open } from "./components";
import { expect, networkIdle, test, watchNetwork } from "./fixtures";
import { useLocalAccount } from "./local-account";

test.describe("miglioramenti account e negozi", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  for (const language of ["it", "en"] as const) {
    const prefix = language === "it" ? "" : "/en";
    const it = language === "it";
    test(`conferma negozio: resta aperta durante la richiesta e si chiude al successo ${language}`, async ({
      page,
    }) => {
      await open(page, `${prefix}/anteprima/negozi/neg-vintage`, "ordinario");
      await page.getByRole("button", { name: it ? "Scollega" : "Disconnect", exact: true }).click();
      const dialog = page.getByRole("alertdialog");
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/anteprima/negozi/*.data*", async (route) => {
        if (route.request().method() === "POST") await gate;
        await route.continue();
      });
      await dialog
        .getByRole("button", { name: it ? "Scollega" : "Disconnect", exact: true })
        .click();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: it ? "Salvataggio…" : "Saving…" }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      release();
      await expect(dialog).toHaveCount(0);
    });
  }
});

// La prova prosegue nelle Impostazioni e nel profilo.
test.describe("impostazioni e profilo", () => {
  for (const language of ["it", "en"] as const) {
    for (const width of [390, 1280]) {
      test(`negozi, preferenze e identità coerenti ${language} ${width}px`, async ({
        page,
        pageErrors: errors,
      }, testInfo) => {
        test.setTimeout(120_000);
        const t = (it: string, en: string) => (language === "it" ? it : en);
        const prefix = language === "it" ? "" : "/en";
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 844 });
        await open(page, `${prefix}/anteprima/negozi`, "ordinario");
        await expect(
          page.getByText(
            t(
              "Il piano Free include un solo negozio attivo.",
              "The Free plan includes one active store.",
            ),
            { exact: true },
          ),
        ).toBeVisible();
        await expect(page.locator("main")).not.toContainText(
          t("Le notifiche Telegram dei nuovi ordini", "Telegram notifications for new orders"),
        );
        await page.getByRole("link", { name: /Outlet ricambi/u }).click();
        const panel = page.getByRole("dialog");
        await expect(panel).toContainText(
          t("Storico di 30 giorni importato", "30-day history imported"),
        );
        await expect(panel).not.toContainText(
          t("Prima della scadenza ti chiederemo", "Before it expires we will ask"),
        );
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
        // La sostituzione chiede conferma: annullare lascia il negozio attivo com'era.
        await page.getByRole("option").filter({ hasText: "Outlet" }).click();
        const replace = page.getByRole("alertdialog");
        await expect(replace).toContainText(
          t("Vintage Garage Italia va in pausa", "Vintage Garage Italia will be paused"),
        );
        await replace.getByRole("button", { name: t("Annulla", "Cancel") }).click();
        await expect(selection).toContainText("Vintage Garage Italia");
        await selection.click();
        await page.getByRole("option").filter({ hasText: "Outlet" }).click();
        await replace.getByRole("button", { name: t("Rendi attivo", "Make active") }).click();
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
          t("Storico di 30 giorni importato", "30-day history imported"),
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
          name: t("Scollega ed elimina negozio", "Disconnect and delete store"),
          exact: true,
        });
        await remove.click();
        const confirm = page.getByRole("alertdialog");
        await expect(confirm.getByRole("heading")).toHaveText(
          t("Scollega ed elimina negozio", "Disconnect and delete store"),
        );
        const overlay = page.locator("[data-slot=alert-dialog-overlay]");
        expect(await overlay.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
          await page
            .locator("[data-slot=sheet-content]")
            .evaluate((el) => Number(getComputedStyle(el).zIndex)),
        );
        const deleteButton = confirm.getByRole("button", {
          name: t("Scollega ed elimina negozio", "Disconnect and delete store"),
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
        // Il salvataggio fallisce e lo switch torna acceso: `uncheck` pretenderebbe il nuovo stato.
        await enabled.click();
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
        // Lo switch resta disattivato finché il salvataggio non finisce: il nuovo clic aspetta.
        const saved = page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URLSearchParams(response.request().postData() ?? "").get("name") === "telegram",
        );
        await enabled.uncheck();
        await saved;
        await expect(enabled).not.toHaveAttribute("data-disabled");
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
        ).toContainText(t("Automatico", "Automatic"));
        await page.getByRole("radio", { name: t("Scuro", "Dark"), exact: true }).check();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await page.reload();
        await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
        await networkIdle(page);
        if (width >= 768) {
          // L'indicatore nasce nel layout effect, poi il frame allinea la route ripristinata.
          await expect(page.locator('main nav li[aria-hidden="true"]')).toBeVisible();
          await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
          );
          await expect(page.locator("#settings-aspetto")).toBeInViewport({ ratio: 1 });
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
        const requiredLabels = page
          .locator("main label[data-slot=field-label]")
          .filter({ has: page.locator("span[aria-hidden=true]") });
        await expect(requiredLabels).not.toHaveCount(0);
        for (const label of await requiredLabels.all()) {
          expect(
            await label.evaluate((element) => parseFloat(getComputedStyle(element).columnGap)),
          ).toBe(2);
        }
        await open(page, `${prefix}/anteprima/impostazioni/profilo`);
        await expect(
          page.getByRole("textbox", { name: t("Nome", "First name"), exact: true }),
        ).toHaveAttribute("required", "");
        await expect(
          page.getByRole("textbox", { name: t("Cognome", "Last name"), exact: true }),
        ).toHaveAttribute("required", "");
        await expect.poll(() => noPageOverflow(page)).toBe(true);
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("profile.png"), fullPage: true });
      });
    }
  }
});

const notice = (page: Page) => page.locator('[role="status"][aria-live="polite"] > p');

// Queste prove proseguono negli Ordini.
test.describe("ordini", () => {
  for (const locale of ["it", "en"] as const) {
    for (const width of [390, 768, 1280]) {
      test(`negozi e contatti completi, ${locale}, ${width} px`, async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        await page.emulateMedia({ reducedMotion: "reduce" });
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
          name: locale === "it" ? "Scollega ed elimina negozio" : "Disconnect and delete store",
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
          name: locale === "it" ? "Scollega ed elimina negozio" : "Disconnect and delete store",
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
          .getByRole("tab", { name: locale === "it" ? "Articoli (4)" : "Items (4)", exact: true })
          .click();
        const items = page.getByRole("tabpanel", {
          name: locale === "it" ? "Articoli (4)" : "Items (4)",
          exact: true,
        });
        await expect(
          items.getByText(locale === "it" ? "Senza SKU" : "No SKU", { exact: true }).first(),
        ).toBeVisible();
        await expect(items).not.toContainText(locale === "it" ? "SKU: Senza SKU" : "SKU: No SKU");
        await expect(items).toContainText("MSC-OL-44");
        await expect(items).toContainText("CUS-12");
        await expect.poll(() => noPageOverflow(page)).toBe(true);
      });
    }
  }

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
      // Anche durante la selezione «Riprova» risponde con un avviso breve.
      await page
        .getByRole("article", { name: "Ordine 19-00001-99999" })
        .getByRole("button", { name: "Riprova", exact: true })
        .click();
      await expect(notice(page)).toBeVisible();
      const bar = page
        .getByRole("button", { name: "Esporta", exact: true })
        .locator("xpath=../../..");
      const toast = (await notice(page).boundingBox())!;
      expect(toast.y + toast.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
    });
  }
});

test.describe("abbonamento nel piano", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  // Scollegare l'unico negozio con un abbonamento che si rinnova non lo disdice: lo dicono
  // entrambe le superfici.
  for (const language of ["it", "en"] as const)
    test(`scollegare l'ultimo negozio avvisa che l'abbonamento continua, ${language}`, async ({
      page,
      context,
      browser,
      baseURL,
    }) => {
      const it = language === "it";
      const prefix = it ? "" : "/en";
      const check = async (target: Page) => {
        await target
          .getByRole("dialog")
          .getByRole("button", { name: it ? "Scollega" : "Disconnect", exact: true })
          .click();
        const confirm = target.getByRole("alertdialog");
        await expect(confirm).toContainText(
          it
            ? "Scollegare il negozio non disdice l’abbonamento Premium"
            : "Disconnecting the store does not cancel the Premium subscription",
        );
        await expect(
          confirm.getByRole("link", {
            name: it ? "Gestisci l’abbonamento" : "Manage subscription",
          }),
        ).toHaveAttribute(
          "href",
          `${prefix}/${target.url().includes("/anteprima/") ? "anteprima" : "app"}/impostazioni/piano`,
        );
        await confirm.getByRole("button", { name: it ? "Annulla" : "Cancel" }).click();
      };
      await useLocalAccount(context, "member", baseURL!, "subscription-active");
      await page.goto(`${prefix}/app/negozi/subscription-active`);
      await check(page);
      const preview = await browser.newContext({ baseURL });
      try {
        watchNetwork(preview);
        const previewPage = await preview.newPage();
        await open(previewPage, `${prefix}/anteprima/negozi/neg-vintage`, "cambio-rinnovo");
        await check(previewPage);
      } finally {
        await preview.close();
      }
    });
});
