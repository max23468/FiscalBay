import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { useLocalAccount, localPassword } from "./local-account";
import { testAccount } from "./test-account";

test.afterEach(async ({ context }) => context.unrouteAll({ behavior: "ignoreErrors" }));

test.describe("miglioramenti account e negozi", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  for (const language of ["it", "en"] as const) {
    const prefix = language === "it" ? "" : "/en";
    const it = language === "it";
    test(`ordini reali: suggerimenti e testo modificabile copiabile ${language}`, async ({
      page,
      context,
      baseURL,
      browserErrors: errors,
    }) => {
      const posts: string[] = [];
      page.on("request", (request) => {
        // Le misure della pagina partono da sole dopo 10 secondi: non sono un'azione della prova.
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname !== "/api/v1/page-timing"
        )
          posts.push(request.url());
      });
      await useLocalAccount(context, "member", baseURL!, `suggestions-${language}`);
      await page.setViewportSize({ width: it ? 390 : 1280, height: 900 });
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
      await page.goto(`${prefix}/app/ordini/suggestions-${language}`);
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByText(
          it ? "Suggerimento da un ordine precedente" : "Suggestion from a previous order",
        ),
      ).toBeVisible();
      await expect(dialog.getByText(/eBay Trading/)).toBeVisible();
      await expect(
        dialog.getByText(
          it
            ? /Gli ordini precedenti riportano codici diversi/
            : /Previous orders show different codes/,
        ),
      ).toBeVisible();
      await expect(dialog.getByText(new RegExp(`suggestions-${language}-2`))).toBeVisible();
      const message = dialog.getByLabel(it ? "Testo per l’acquirente" : "Text for the buyer");
      await expect(message).toHaveValue(new RegExp(`suggestions-${language}`));
      // Contatti formattati e utilizzabili; l'originale di eBay resta nel database.
      await expect(dialog.getByText("Via del Corso 1", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "+39 333 000 1000" })).toHaveAttribute(
        "href",
        "tel:+393330001000",
      );
      await expect(
        dialog.locator('a[href="mailto:Acquirente.Collaudo@example.invalid"]'),
      ).toHaveText("Acquirente.Collaudo@example.invalid");
      await dialog
        .getByRole("button", {
          name: it
            ? `Copia telefono: ordine suggestions-${language}`
            : `Copy phone: order suggestions-${language}`,
        })
        .click();
      expect(
        await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText),
      ).toBe("+393330001000");
      await dialog
        .getByRole("button", {
          name: it
            ? `Copia indirizzo di fatturazione: ordine suggestions-${language}`
            : `Copy billing address: order suggestions-${language}`,
        })
        .click();
      expect(
        await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText),
      ).toBe(`Via del Corso 1\n00186 Roma (RM)\n${it ? "Italia" : "Italy"}`);
      // La copia aggregata attraversa il loader reale, senza includere il suggerimento fiscale.
      await dialog
        .getByRole("button", {
          name: it ? "Copia dati di fatturazione" : "Copy billing details",
          exact: true,
        })
        .click();
      const billing = await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      );
      expect(billing).toContain(`Via del Corso 1\n00186 Roma (RM)\n${it ? "Italia" : "Italy"}`);
      expect(billing).not.toContain("RSSMRA80A01H501U");
      expect(billing).not.toContain("Acquirente.Collaudo@example.invalid");
      expect(billing).not.toContain("+39");
      // La richiesta si apre come email già compilata nel programma di posta.
      const request = dialog.getByRole("link", {
        name: it ? "Scrivi all’acquirente via email" : "Email the buyer",
      });
      const requestHref = new URL((await request.getAttribute("href"))!);
      expect(requestHref.protocol).toBe("mailto:");
      expect(requestHref.pathname).toBe("Acquirente.Collaudo@example.invalid");
      expect(requestHref.searchParams.get("subject")).toBe(
        it
          ? `Ordine eBay suggestions-${language}: Codice Fiscale per la fattura`
          : `eBay order suggestions-${language}: tax code for the invoice`,
      );
      expect(requestHref.searchParams.get("body")).toBe(await message.inputValue());
      await dialog
        .getByRole("combobox", { name: it ? "Lingua del messaggio" : "Message language" })
        .click();
      await page.getByRole("option", { name: it ? "English" : "Italiano", exact: true }).click();
      await expect(message).toHaveValue(it ? /^Hello/ : /^Buongiorno/);
      await message.fill(`Richiesta modificata suggestions-${language}`);
      // Oggetto nella lingua scelta e testo modificato anche nell'email.
      const edited = new URL((await request.getAttribute("href"))!);
      expect(edited.searchParams.get("subject")).toBe(
        it
          ? `eBay order suggestions-${language}: tax code for the invoice`
          : `Ordine eBay suggestions-${language}: Codice Fiscale per la fattura`,
      );
      expect(edited.searchParams.get("body")).toBe(`Richiesta modificata suggestions-${language}`);
      await dialog
        .getByRole("button", {
          name: it ? "Copia messaggio per l’acquirente" : "Copy message for the buyer",
        })
        .click();
      expect(
        await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText),
      ).toBe(`Richiesta modificata suggestions-${language}`);
      await expect(
        dialog.getByRole("status").filter({ hasText: it ? /Messaggio copiato/ : /Message copied/ }),
      ).toBeVisible();
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("denied");
            },
          },
        }),
      );
      await dialog
        .getByRole("button", {
          name: it ? "Copia messaggio per l’acquirente" : "Copy message for the buyer",
        })
        .click();
      await expect(
        dialog.getByRole("status").filter({ hasText: it ? /Copia non riuscita/ : /Copy failed/ }),
      ).toBeVisible();
      expect(posts).toEqual([]);
      expect(errors).toEqual([]);
      await dialog.getByRole("button", { name: it ? "Chiudi" : "Close", exact: true }).click();
      const card = page.getByRole("article", {
        name: `${it ? "Ordine" : "Order"} suggestions-${language}`,
        exact: true,
      });
      await expect(
        card.getByText(it ? /Da un ordine precedente:/ : /From a previous order:/),
      ).toBeVisible();
      await expect(card.getByText("RSSMRA80A01H501U", { exact: true })).toBeVisible();
    });
    test(`fatturazione copiabile, campi mascherati e testi lunghi ${language}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: it ? 390 : 1280, height: 900 });
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
      await open(page, `${prefix}/anteprima/ordini/ord-09`, "dati-discordanti");
      const dialog = page.getByRole("dialog");
      const copy = dialog.getByRole("button", {
        name: it ? "Copia dati di fatturazione" : "Copy billing details",
        exact: true,
      });
      await copy.focus();
      await page.keyboard.press("Enter");
      const copied = await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      );
      expect(copied).toContain(
        `Via dell'Orto 12B\n26866 Sant'Angelo Lodigiano (LO)\n${it ? "Italia" : "Italy"}`,
      );
      expect(copied).toContain("Codice Fiscale: MRNSRA90L41H50LE");
      await expect(copy).toHaveAttribute("data-state", "copied");
      await page.screenshot({ path: testInfo.outputPath("billing-details.png") });
      await expect(dialog.locator("time")).not.toHaveCount(0);
      for (const time of await dialog.locator("time").all()) {
        await expect(time).not.toContainText(/Europe\/Rome|GMT/u);
      }
      await expect(
        dialog.getByText(
          it
            ? "Non possiamo verificare che il codice corrisponda al nome dell’acquirente."
            : "We cannot verify that the code matches the buyer’s name.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("denied");
            },
          },
        }),
      );
      await copy.click();
      await expect(
        dialog.getByRole("status").filter({ hasText: it ? /Copia non riuscita/ : /Copy failed/ }),
      ).toBeVisible();

      await open(page, `${prefix}/anteprima/ordini/ord-03`, "dati-discordanti");
      await expect(
        dialog.getByText(it ? "Mascherato da eBay" : "Masked by eBay", { exact: true }),
      ).toHaveCount(5);
      await expect(
        dialog.getByRole("button", {
          name: it ? "Copia dati di fatturazione" : "Copy billing details",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(dialog.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);

      await open(page, `${prefix}/anteprima/ordini/ord-02`, "dati-discordanti");
      await expect(
        dialog.getByRole("definition").filter({ hasText: /^Maria Rossi$/u }),
      ).toBeVisible();
      await expect.poll(() => noPageOverflow(page)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      const addressLine = `Via ${"esempio".repeat(40).replace(/^e/u, "E")} 12B`;
      await expect(dialog.getByText(addressLine, { exact: true })).toBeVisible();
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (value: string) => {
              (window as Window & { copiedText?: string }).copiedText = value;
            },
          },
        }),
      );
      await copy.click();
      const block = await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      );
      expect(block).toBe(
        `Maria Rossi\n${addressLine}\n00100 Roma (RM)\n${it ? "Italia" : "Italy"}\nCodice Fiscale: RSSMRA80A41H501Y`,
      );
      await page.screenshot({ path: testInfo.outputPath("billing-long-text.png") });
    });
    test(`anteprima: suggerimento e messaggio coerenti con gli ordini reali ${language}`, async ({
      page,
    }) => {
      await open(page, `${prefix}/anteprima/ordini/ord-05`, "dati-discordanti");
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByText(
          it ? "Suggerimento da un ordine precedente" : "Suggestion from a previous order",
        ),
      ).toBeVisible();
      await expect(dialog.getByText("DSNGNN70E20A662P", { exact: true })).toBeVisible();
      await expect(dialog.getByText(/eBay Trading/)).toBeVisible();
      await expect(
        dialog.getByText(
          it
            ? /Gli ordini precedenti riportano codici diversi/
            : /Previous orders show different codes/,
        ),
      ).toBeVisible();
      await dialog
        .getByRole("combobox", { name: it ? "Lingua del messaggio" : "Message language" })
        .click();
      await page.getByRole("option", { name: it ? "English" : "Italiano", exact: true }).click();
      await expect(
        dialog.getByLabel(it ? "Testo per l’acquirente" : "Text for the buyer"),
      ).toHaveValue(it ? /^Hello/ : /^Buongiorno/);
    });
    test(`ordini reali: qualità formale visibile e identificativo bloccato protetto ${language}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await useLocalAccount(context, "member", baseURL!);
      await page.goto(`${prefix}/app/ordini`);
      // Come nel collaudo remoto: il consenso in scadenza si ricollega subito, lo scaduto apre
      // il pannello del negozio.
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: testAccount.stores.expiring })
          .getByRole("link", { name: it ? "Ricollega negozio" : "Reconnect store" }),
      ).toHaveAttribute(
        "href",
        `${prefix}/app/negozi/collega?ricollega=${testAccount.stores.expiring}&environment=production`,
      );
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: testAccount.stores.expired })
          .getByRole("link", { name: it ? "Apri il negozio" : "Open store" }),
      ).toHaveAttribute("href", `${prefix}/app/negozi/${testAccount.stores.expired}`);
      await expect(
        page.getByText(testAccount.taxCodes.unlocked, { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            it
              ? "Non possiamo verificare che il codice corrisponda al nome dell’acquirente."
              : "We cannot verify that the code matches the buyer’s name.",
          )
          .first(),
      ).toBeVisible();
      expect(await page.content()).not.toContain(testAccount.taxCodes.locked);
      // Come nell'anteprima il dato da sbloccare mostra il riquadro senza valore.
      await expect(
        page.getByText(it ? "Codice Fiscale da sbloccare" : "Codice Fiscale to unlock").first(),
      ).toBeAttached();
      await page
        .getByRole("link", {
          name: it
            ? `Ordine ${testAccount.orders.unlocked}`
            : `Order ${testAccount.orders.unlocked}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("dialog").getByText(testAccount.taxCodes.unlocked, { exact: true }),
      ).toBeVisible();
      expect(await page.content()).not.toContain(testAccount.taxCodes.locked);
    });
    if (language === "it")
      test("ordini reali: il dettaglio regge chiusura, collegamento diretto e ricarica come nell'anteprima", async ({
        page,
        context,
        baseURL,
      }) => {
        await useLocalAccount(context, "member", baseURL!);
        await page.goto("/app/ordini");
        // Un clic prima dell'idratazione andrebbe perso: la ricerca si attiva con la pagina.
        await expect(
          page.getByRole("searchbox", { name: "Cerca ordini", includeHidden: true }),
        ).toBeEnabled();
        const title = page.getByRole("link", {
          name: `Ordine ${testAccount.orders.unlocked}`,
          exact: true,
        });
        const entries = await page.evaluate(() => history.length);
        await title.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeFocused();
        await expect(dialog.getByText("Ultima modifica su eBay")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/\/app\/ordini(?:\?vista=[0-9a-z]+)?$/u);
        // Chiuso, il dettaglio lascia soltanto la voce in avanti: Indietro non lo riapre.
        expect(await page.evaluate(() => history.length)).toBe(entries + 1);
        await expect(title).toBeFocused();
        const href = (await title.getAttribute("href"))!;
        await page.goto(href);
        await expect(dialog).toBeVisible();
        await page.reload();
        await expect(dialog).toBeVisible();
        const direct = await page.evaluate(() => history.length);
        await dialog.getByRole("button", { name: "Chiudi", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/\/app\/ordini(?:\?vista=[0-9a-z]+)?$/u);
        expect(await page.evaluate(() => history.length)).toBe(direct);
        await expect(title).toBeFocused();
      });
    if (language === "it")
      test("ordini reali: sblocco confermato, quota e ripristino nelle impostazioni IT/EN", async ({
        page,
        context,
        baseURL,
        browserName,
        browserErrors: errors,
      }) => {
        // Due lingue nello stesso test: su WebKit in CI supera i 30 secondi predefiniti.
        test.setTimeout(60_000);
        for (const language of ["it", "en"] as const) {
          const it = language === "it";
          const prefix = it ? "" : "/en";
          // Spazio, sessione e ordini bloccati propri di ogni lingua arrivano dal seed locale:
          // la suite non scrive nel D1 mentre il server lo usa e non tocca le altre fixture.
          const id = `unlock-${language}-${browserName}`;
          await useLocalAccount(context, "member", baseURL!, id);
          await page.setViewportSize({ width: it ? 1280 : 390, height: 900 });
          await page.emulateMedia({
            reducedMotion: "reduce",
          });
          await page.goto(`${prefix}/app/ordini`);
          const card = (suffix = "") =>
            page.getByRole("article", {
              name: `${it ? "Ordine" : "Order"} ${id}${suffix}`,
              exact: true,
            });
          const secret = `VALORE-SINTETICO-${language}`;
          expect(await page.content()).not.toContain(secret);
          await card()
            .getByRole("button", { name: it ? "Sblocca ordine" : "Unlock order", exact: true })
            .click();
          const dialog = page.getByRole("alertdialog");
          const skip = dialog.getByRole("checkbox", {
            name: it ? "Non chiedermelo più" : "Don’t ask again",
          });
          await skip.check();
          await dialog
            .getByRole("button", { name: it ? "Annulla" : "Cancel", exact: true })
            .click();
          expect(await page.content()).not.toContain(secret);
          await card()
            .getByRole("button", { name: it ? "Sblocca ordine" : "Unlock order", exact: true })
            .click();
          await expect(skip).not.toBeChecked();
          await skip.check();
          await dialog
            .getByRole("button", { name: it ? "Sblocca" : "Unlock", exact: true })
            .click();
          await expect(page.getByText(secret, { exact: true }).first()).toBeVisible();
          await page.reload();
          await expect(page.getByText(secret, { exact: true }).first()).toBeVisible();
          await card("-2")
            .getByRole("button", { name: it ? "Sblocca ordine" : "Unlock order", exact: true })
            .click();
          await expect(page.getByRole("alertdialog")).toHaveCount(0);
          await expect(card("-2").getByText(`${secret}-2`, { exact: true })).toBeVisible();
          await page
            .getByRole("button", { name: it ? "Seleziona" : "Select", exact: true })
            .click();
          for (const suffix of ["-3", "-4"]) await card(suffix).getByRole("checkbox").check();
          await page
            .getByRole("button", { name: it ? "Sblocca 2" : "Unlock 2", exact: true })
            .click();
          await expect(dialog).toBeVisible();
          await expect(dialog.getByRole("checkbox")).toHaveCount(0);
          await dialog
            .getByRole("button", { name: it ? "Sblocca" : "Unlock", exact: true })
            .click();
          await expect(card("-3").getByText(`${secret}-3`, { exact: true })).toBeVisible();
          await expect(card("-4").getByText(`${secret}-4`, { exact: true })).toBeVisible();
          const select = page.getByRole("button", {
            name: it ? "Seleziona" : "Select",
            exact: true,
          });
          // Lo sblocco chiude la selezione; senza altro da sbloccare né export non si riapre.
          await expect(select).toBeDisabled();
          await page.goto(`${prefix}/app/impostazioni/piano`);
          const confirmation = page.getByRole("switch", {
            name: it
              ? "Chiedi conferma prima di sbloccare un ordine"
              : "Ask before unlocking an order",
          });
          await expect(confirmation).not.toBeChecked();
          // Si attende anche la rilettura della pagina, che una navigazione successiva
          // altrimenti annullerebbe.
          const revalidated = page.waitForResponse(
            (response) =>
              response.request().method() === "GET" &&
              response.url().includes("/impostazioni/piano.data"),
          );
          await confirmation.click();
          await revalidated;
          await expect(confirmation).toBeChecked();
          expect(errors).toEqual([]);
        }
      });
    test(`ordini: sblocco non riuscito senza consumo o preferenza salvata ${language}`, async ({
      page,
    }) => {
      await open(page, `${prefix}/anteprima/ordini`, "sblocco-non-riuscito");
      const order = page.getByRole("article", {
        name: `${it ? "Ordine" : "Order"} 05-55555-12121`,
      });
      const unlock = order.getByRole("button", {
        name: it ? "Sblocca ordine" : "Unlock order",
        exact: true,
      });
      const dialog = page.getByRole("alertdialog");
      await unlock.click();
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: it ? "Sblocca" : "Unlock", exact: true }).click();
      await expect(
        page.getByText(
          it
            ? "Sblocco non riuscito. Controlla gli ordini e gli sblocchi rimasti, poi riprova."
            : "Unlock failed. Check the orders and remaining unlocks, then try again.",
        ),
      ).toBeVisible();
      expect(await page.content()).not.toContain("BNCLCU75C12F205G");
      await page.reload();
      await unlock.click();
      await expect(dialog.getByRole("checkbox")).not.toBeChecked();
      await expect(dialog).toContainText(it ? "1 sblocco" : "1 unlock");
      await dialog.getByRole("button", { name: it ? "Sblocca" : "Unlock", exact: true }).click();
      await expect(order.getByText("BNCLCU75C12F205G")).toBeVisible();
    });
    test(`profilo: modifiche, uscita, attesa e salvataggio ${language}`, async ({ page }) => {
      await open(page, `${prefix}/anteprima/impostazioni/profilo`, "ordinario");
      const section = page.getByRole("region", { name: it ? "Profilo" : "Profile", exact: true });
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
        .getByRole("link", { name: it ? /^Sicurezza/u : /^Security/u })
        .click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni/sicurezza$`));
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
        await page.goto(`${prefix}/app/impostazioni/profilo`, { waitUntil: "commit" });
        await expect(first).toBeDisabled();
      } finally {
        continueHydration();
      }
      await page.route("**/app/impostazioni/profilo.data*", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const form = new URLSearchParams(route.request().postData()!);
        form.set("nome", "");
        await route.continue({ postData: form.toString() });
      });
      await first.fill("Valore da conservare");
      await page
        .getByRole("region", { name: it ? "Profilo" : "Profile", exact: true })
        .getByRole("button", { name: it ? "Salva" : "Save", exact: true })
        .click();
      await expect(
        page.getByRole("alert").filter({ hasText: it ? "Compila nome" : "Enter your first" }),
      ).toBeVisible();
      await expect(first).toHaveValue("Valore da conservare");
      await expect(
        page
          .getByRole("region", { name: it ? "Profilo" : "Profile", exact: true })
          .getByRole("button", { name: it ? "Salva" : "Save", exact: true }),
      ).toBeEnabled();
      await page.route("**/app/impostazioni/profilo.data*", (route) =>
        route.request().method() === "POST" ? route.abort("failed") : route.continue(),
      );
      await page
        .getByRole("region", { name: it ? "Profilo" : "Profile", exact: true })
        .getByRole("button", { name: it ? "Salva" : "Save", exact: true })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: it ? "confermare l’esito" : "outcome could not be confirmed" }),
      ).toBeVisible();
      await expect(first).toHaveValue("Valore da conservare");
    });

    test(`nuovo accesso: ritorno a Sicurezza anche dopo password errata ${language}`, async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      expect(
        (
          await page.request.post("/api/auth/sign-in/email", {
            headers: { origin: baseURL! },
            data: { email: testAccount.email, password: localPassword },
          })
        ).ok(),
      ).toBe(true);
      const target = `${prefix}/app/impostazioni/sicurezza#security-email`;
      const response = await page.request.post(`${prefix}/app/impostazioni/sicurezza`, {
        headers: { origin: baseURL! },
        form: { intent: "riautentica", returnTo: target },
        maxRedirects: 0,
      });
      await page.goto(response.headers().location);
      const form = page.getByRole("tabpanel", { name: it ? "Accedi" : "Sign in", exact: true });
      await form.getByRole("textbox", { name: "Email", exact: true }).fill(testAccount.email);
      await form.getByRole("textbox", { name: "Password", exact: true }).fill("password-errata");
      await form.getByRole("button", { name: it ? "Accedi" : "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/returnTo=/);
      await form.getByRole("textbox", { name: "Password", exact: true }).fill(localPassword);
      await form.getByRole("button", { name: it ? "Accedi" : "Sign in", exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`${prefix}/app/impostazioni/sicurezza#security-email$`),
      );
      const token = `stale-security-${language}-${testInfo.project.name}`;
      await useLocalAccount(context, "member", baseURL!, token);
      const signInAgain = page.getByRole("button", {
        name: it ? "Esci e accedi di nuovo" : "Sign out and sign in again",
        exact: true,
      });
      // Con un accesso di più di 24 ore nessun avviso fisso: l'esito arrivato nell'indirizzo sì.
      await page.goto(`${prefix}/app/impostazioni/sicurezza?accesso=nuovo-accesso`);
      await expect(signInAgain).toHaveCount(1);
      await page.goto(`${prefix}/app/impostazioni/sicurezza`);
      await expect(signInAgain).toHaveCount(0);
      // La modifica resta possibile: prima chiede la conferma dell'identità sul posto.
      const change = page.getByRole("button", {
        name: it ? "Cambia email" : "Change email",
        exact: true,
      });
      await change.click();
      await page
        .getByRole("textbox", { name: it ? "Nuova email" : "New email", exact: true })
        .fill("nuova@example.invalid");
      await page
        .getByRole("button", { name: it ? "Invia il link" : "Send the link", exact: true })
        .click();
      const confirm = page.getByRole("alertdialog", {
        name: it ? "Conferma che sei tu" : "Confirm it’s you",
      });
      await expect(confirm).toBeVisible();
      await confirm.getByLabel("Password", { exact: true }).fill("password-errata");
      await confirm.getByRole("button", { name: it ? "Conferma" : "Confirm", exact: true }).click();
      await expect(confirm.getByRole("alert")).toContainText(
        it ? "Conferma non riuscita" : "Confirmation failed",
      );
      await expect(
        confirm.getByRole("button", {
          name: it ? "Esci e accedi di nuovo" : "Sign out and sign in again",
        }),
      ).toBeVisible();
      await confirm.getByRole("button", { name: it ? "Annulla" : "Cancel", exact: true }).click();
      await expect(confirm).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`${prefix}/app/impostazioni/sicurezza$`));
    });
  }

  test("passkey: registrazione con autenticatore virtuale", async ({
    page,
    context,
    baseURL,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Non applicabile: autenticatore virtuale CDP disponibile soltanto in Chromium.",
    );
    await useLocalAccount(context, "member", baseURL!);
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    await page.goto("/app/impostazioni/sicurezza");
    const methods = page.locator('section[aria-labelledby="security-methods"]');
    await expect(methods.getByText("Questo è il tuo unico metodo", { exact: false })).toBeVisible();
    await expect(methods.getByRole("button", { name: "Rimuovi", exact: true })).toBeDisabled();
    // Il nome si chiede solo dopo la scelta di aggiungere una passkey, già compilato.
    const name = page.getByRole("textbox", { name: "Nome della passkey", exact: true });
    await expect(name).toHaveCount(0);
    await page.getByRole("button", { name: "Aggiungi passkey", exact: true }).click();
    await expect(name).not.toHaveValue("");
    await name.fill("Chiave browser sintetica");
    await page.getByRole("button", { name: "Aggiungi passkey", exact: true }).click();
    const row = methods.getByRole("group", { name: /Chiave browser sintetica/ });
    await expect(row).toBeVisible();
    // La registrazione ricarica il documento: i controlli richiedono l'idratazione successiva.
    await page.waitForLoadState("networkidle");
    await row.getByRole("button", { name: "Rimuovi", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Rimuovi", exact: true })
      .click();
    await expect(row).toHaveCount(0);
  });

  test("impostazioni reali: tema, fuso, lingua, modello e campanella restano dopo la ricarica", async ({
    page,
    context,
    baseURL,
    browserName,
    pageErrors: errors,
  }, testInfo) => {
    test.setTimeout(60_000);
    await useLocalAccount(
      context,
      "member",
      baseURL!,
      `preferences-${browserName}-${testInfo.retry}`,
    );
    await page.goto("/app/impostazioni/aspetto");
    await page.waitForLoadState("networkidle");
    // Le categorie dei servizi non ancora disponibili non compaiono.
    const categories = page.getByRole("navigation", { name: "Categorie" });
    await expect(categories.getByRole("link")).toHaveCount(8);
    await expect(categories.getByRole("link", { name: /Esportazione/u })).toHaveCount(0);

    const saved = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/app/impostazioni"),
      );
    // Dopo un salvataggio la pagina rilegge i propri dati: una ricarica che la interrompe fa
    // segnalare a WebKit la lettura annullata come errore della pagina.
    const reread = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname.endsWith("/app/impostazioni/aspetto.data"),
      );
    let save = saved();
    await page.getByRole("radio", { name: "Scuro", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect((await save).status()).toBe(200);
    const zone = page.getByRole("combobox", { name: "Fuso orario" });
    await zone.click();
    save = saved();
    let settled = reread();
    await page.getByRole("option", { name: "New York (Stati Uniti)" }).click();
    expect((await save).status()).toBe(200);
    await settled;
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(zone).toContainText("New York (Stati Uniti)");

    // Il modello non salvato protegge l'uscita dalla pagina, non il passaggio fra categorie.
    const template = page.getByRole("textbox", { name: "Italiano", exact: true });
    await template.fill("Ciao, per l'ordine {ordine} ci serve il Codice Fiscale.");
    await page.getByRole("link", { name: "Negozi eBay" }).first().click();
    const leave = page.getByRole("alertdialog");
    await expect(leave).toContainText("modifiche non salvate");
    await leave.getByRole("button", { name: "Continua a modificare" }).click();
    await expect(page).toHaveURL(/\/app\/impostazioni\/aspetto$/u);
    const templateSection = page.locator('section[aria-labelledby="settings-messaggio"]');
    settled = reread();
    await templateSection.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(templateSection.getByText("Salvato", { exact: true })).toBeVisible();
    await settled;
    await page.reload();
    await expect(template).toHaveValue("Ciao, per l'ordine {ordine} ci serve il Codice Fiscale.");
    // Il valore arriva già dal server: un clic sulla campanella prima dell'idratazione andrebbe perso.
    await page.waitForLoadState("networkidle");

    // La campanella segnala il negozio da ricollegare e ricorda la lettura.
    const bell = page.getByRole("button", { name: "Notifiche, 1 da leggere" });
    await bell.click();
    const dialog = page.getByRole("dialog", { name: "Notifiche" });
    await expect(dialog).toContainText("Negozio preferenze: la sincronizzazione è sospesa.");
    // Una lettura che il server non registra torna da leggere.
    await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 503 }));
    await dialog.getByRole("button", { name: "Segna tutte come lette" }).click();
    await expect(page.getByRole("button", { name: "Notifiche, 1 da leggere" })).toBeVisible();
    await page.unroute("**/api/v1/notifications");
    const read = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/notifications"),
    );
    await dialog.getByRole("button", { name: "Segna tutte come lette" }).click();
    expect((await read).status()).toBe(200);
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByRole("button", { name: "Notifiche", exact: true })).toBeVisible();
    // Dopo la ricarica il cambio lingua richiede l'idratazione: un clic precedente andrebbe perso.
    await page.waitForLoadState("networkidle");

    // La lingua scelta resta anche aprendo l'area in italiano.
    const appearance = page.locator('section[aria-labelledby="settings-aspetto"]');
    await appearance.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/app\/impostazioni\/aspetto$/u);
    await page.goto("/app/ordini");
    await expect(page).toHaveURL(/\/en\/app\/ordini$/u);
    await page.goto("/en/app/impostazioni/aspetto");
    await page.waitForLoadState("networkidle");
    await appearance.getByRole("button", { name: "Italiano", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/impostazioni\/aspetto$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    expect(errors).toEqual([]);
  });

  test("passkey: nome, rinomina, rimozione e unico metodo visibili nella pagina reale", async ({
    page,
    context,
    baseURL,
    browserName,
  }) => {
    await useLocalAccount(context, "member", baseURL!, `passkey-${browserName}`);
    // Prima dell'idratazione i pulsanti che aprono un modulo non reagirebbero al clic: restano
    // inattivi, così un clic durante il caricamento non va perso.
    let continueHydration = () => {};
    const hydration = new Promise<void>((resolve) => {
      continueHydration = resolve;
    });
    await page.route("**/assets/*.js", async (route) => {
      await hydration;
      await route.continue();
    });
    const methods = page.locator('section[aria-labelledby="security-methods"]');
    const row = methods.getByRole("group", { name: /Chiave browser sintetica/ });
    const openers = [
      row.getByRole("button", { name: "Rinomina", exact: true }),
      methods.getByRole("button", { name: "Aggiungi passkey", exact: true }),
      page.getByRole("button", { name: "Cambia email", exact: true }),
    ];
    try {
      await page.goto("/app/impostazioni/sicurezza", { waitUntil: "commit" });
      for (const opener of openers) await expect(opener).toBeDisabled();
    } finally {
      continueHydration();
    }
    for (const opener of openers) await expect(opener).toBeEnabled();
    await expect(row).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noPageOverflow(page)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await row.getByRole("button", { name: "Rinomina", exact: true }).click();
    await expect(row.getByRole("button", { name: "Salva", exact: true })).toBeVisible();
    const renamedName = `Chiave ${"r".repeat(73)}`;
    await row.locator('input[name="name"]').fill(renamedName);
    await row.getByRole("button", { name: "Salva", exact: true }).click();
    const renamed = methods.getByRole("group", { name: new RegExp(renamedName) });
    await expect(renamed).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noPageOverflow(page)).toBe(true);
    await renamed.getByRole("button", { name: "Rimuovi", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Rimuovi", exact: true })
      .click();
    await expect(renamed).toHaveCount(0);
    await expect(methods.getByText("Questo è il tuo unico metodo", { exact: false })).toBeVisible();
  });

  test("passkey non supportata e scheda revocata si aggiornano senza ricarica manuale", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await page.goto("/accesso");
      await page.evaluate(() =>
        Object.defineProperty(window, "PublicKeyCredential", {
          configurable: true,
          value: undefined,
        }),
      );
      await page.getByRole("button", { name: "Accedi con passkey", exact: true }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: "non supporta le passkey" }),
      ).toBeVisible();
      const form = page.getByRole("tabpanel", { name: "Accedi", exact: true });
      await form.getByRole("textbox", { name: "Email", exact: true }).fill(testAccount.email);
      await form.getByRole("textbox", { name: "Password", exact: true }).fill(localPassword);
      await form.getByRole("button", { name: "Accedi", exact: true }).click();
      await expect(page).toHaveURL(/\/app\/ordini(?:[?&]vista=[0-9a-z]+)?$/u);
      await page.goto("/app/impostazioni/sicurezza");
      await expect(page.getByRole("heading", { name: "Sicurezza", exact: true })).toBeVisible();
      await expect(page.getByText(/^Sessione aperta il/).first()).toBeVisible();
      const profile = await context.newPage();
      await profile.goto("/app/impostazioni/profilo");
      const firstName = profile.getByRole("textbox", { name: "Nome", exact: true });
      const save = profile
        .getByRole("region", { name: "Profilo", exact: true })
        .getByRole("button", { name: "Salva", exact: true });
      const originalName = await firstName.inputValue();
      await firstName.fill(`  ${originalName} aggiornato  `);
      await save.click();
      await expect(firstName).toHaveValue(`${originalName} aggiornato`);
      await expect(save).toBeDisabled();
      await firstName.fill(` ${originalName} aggiornato `);
      await expect(save).toBeDisabled();
      await firstName.fill(originalName);
      await save.click();
      await expect(save).toBeDisabled();
      await expect(firstName).toBeEnabled();
      await firstName.fill("Bozza non salvata");
      const second = await context.newPage();
      await second.goto("/app/impostazioni/sicurezza");
      await second.request.post("/accesso", {
        headers: { origin: baseURL! },
        form: { intent: "esci" },
        maxRedirects: 0,
      });
      await page.bringToFront();
      // Il browser headless non genera sempre focus quando porta avanti una scheda.
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page).toHaveURL(/\/accesso$/);
      await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
      await profile.bringToFront();
      await profile.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(profile).toHaveURL(/\/accesso$/);
    } finally {
      await context.close();
    }
  });
});

/*
 * Garanzie del design system verificate sulle schermate reali dell'anteprima:
 * form, conferme, copia, nomi lunghi, pannelli, geometria, stati, temi e
 * movimento ridotto.
 */

async function open(page: Page, path: string, scenario?: string) {
  await page.bringToFront();
  if (scenario) {
    await page.request.post("/anteprima", {
      form: { scenario, redirectTo: "/anteprima/ordini" },
      maxRedirects: 0,
    });
  }
  await page.goto(path);
  // Con un pannello aperto il resto della pagina è inerte: si attende il controllo per id.
  if (path.includes("/anteprima"))
    await expect(page.locator("#preview-scenario")).toBeEnabled({ timeout: 20_000 });
  await expect(
    page.getByRole("searchbox", { name: /Cerca ordini|Search orders/u, includeHidden: true }),
  ).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const section = /\/impostazioni\/([^/?#]+)/u.exec(path)?.[1];
  if (section) {
    // La route deve avere allineato davvero la sezione, anche con hydration differita.
    await expect(page.locator(`#settings-${section}`)).toBeInViewport({ ratio: 1 });
  }
}

/** Elenco con la ricerca: la query va nel corpo e l'indirizzo riceve la sua forma cifrata. */
async function searched(page: Page, query: string, base = "/anteprima") {
  const response = await page.request.post(`${base}/ricerca`, {
    form: { q: query },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  return response.headers().location!;
}

/**
 * Le garanzie dei componenti già presenti nell'area reale valgono anche sulle sue route, con la
 * sessione e gli ordini sintetici del database locale.
 */
const areas = [
  {
    name: "anteprima",
    base: "/anteprima",
    detail: "ord-02",
    copied: { id: "27-10293-84756", value: "RSSMRA80A41H501Y" },
  },
  {
    name: "area reale",
    base: "/app",
    detail: "collaudo-ordine-sbloccato",
    copied: { id: testAccount.orders.unlocked, value: testAccount.taxCodes.unlocked },
  },
] as const;

async function enter(page: Page, baseURL: string, area: (typeof areas)[number]) {
  if (area.base === "/app") await useLocalAccount(page.context(), "member", baseURL);
}

const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

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
        page.getByRole("status").filter({ hasText: t("Modifica non salvata", "Change not saved") }),
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
      await page.waitForLoadState("networkidle");
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
      await expect(page.locator('main a[href^="mailto:"]')).toHaveAttribute("href", /^mailto:.+$/);
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

for (const language of ["it", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`ordini: conferme, stati e dettaglio ${language} a ${width} px`, async ({
      page,
      browserErrors: errors,
    }) => {
      // Comprende oltre venti navigazioni, conferme, pannelli e screenshot.
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const prefix = language === "it" ? "" : "/en";
      const t = (it: string, en: string) => (language === "it" ? it : en);
      await open(page, `${prefix}/anteprima/ordini`, "ordinario");
      const locked = page.getByRole("article", {
        name: t("Ordine", "Order") + " 05-55555-12121",
      });
      await expect(
        page.getByText(t("2 sblocchi disponibili in questo ciclo.", "2 unlocks left this cycle."), {
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(locked).not.toContainText(
        t("Questo ordine ne usa uno.", "This order uses one."),
      );
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
      await expect(locked.getByText("BNCLCU75C12F205G")).toHaveCount(0);
      await unlock.click();
      await expect(confirm.getByRole("checkbox")).not.toBeChecked();
      await confirm
        .getByRole("checkbox", {
          name: t("Non chiedermelo più", "Don’t ask again"),
        })
        .check();
      await confirm.getByRole("button", { name: t("Sblocca", "Unlock"), exact: true }).click();
      await expect(locked.getByText("BNCLCU75C12F205G")).toBeVisible();
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
        page.getByRole("dialog").getByText("04567890126", { exact: true }),
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
      await expect(failed).toContainText(t("Verifica in corso", "Verification in progress"));
      expect((await retried).status()).toBe(200);
      await expect(
        failed.getByRole("button", { name: t("Riprova", "Try again"), exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await expect(failed).toContainText(t("Verifica in corso", "Verification in progress"));
      // Nel menu della scheda «Apri su eBay» è un collegamento al Seller Hub.
      await failed
        .getByRole("button", {
          name: t("Altre azioni per l’ordine", "More actions for order") + " 19-00001-99999",
        })
        .click();
      await expect(
        page.getByRole("menuitem", { name: t("Apri su eBay", "Open on eBay") }),
      ).toHaveAttribute(
        "href",
        /^https:\/\/www\.ebay\.it\/sh\/ord\/details\?orderid=19-00001-99999$/,
      );
      await page.keyboard.press("Escape");
      if (width === 390)
        await page.getByRole("button", { name: t("Filtri", "Filters"), exact: true }).click();
      const period = page.getByRole("combobox", { name: t("Periodo", "Period"), exact: true });
      await period.click();
      const menu = page.locator('[data-slot="select-content"]');
      await expect(
        menu.getByText(t("Disponibile con Premium", "Available with Premium")),
      ).toBeVisible();
      // Il menu è largo quanto la voce più lunga, mai meno del campo, e resta entro il
      // margine laterale di 16 px.
      await expect
        .poll(async () => {
          const [box, field] = [(await menu.boundingBox())!, (await period.boundingBox())!];
          return box.width >= field.width - 1 && box.x >= 15.5 && box.x + box.width <= width - 15.5;
        })
        .toBe(true);
      expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(
        (await period.boundingBox())!.y + (await period.boundingBox())!.height,
      );
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width, height: 600 });
      await open(page, `${prefix}/anteprima/ordini/ord-01`, "ordinario");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveCSS("outline-style", "none");
      const ebay = dialog.getByRole("link", { name: t("Apri su eBay", "Open on eBay") });
      await expect(ebay).toBeVisible();
      await expect(ebay).toHaveAttribute(
        "href",
        /^https:\/\/www\.ebay\.it\/sh\/ord\/details\?orderid=\d{2}-\d{5}-\d{5}$/,
      );
      await expect(ebay).toHaveAttribute("target", "_blank");
      await expect(
        dialog.getByRole("link", { name: t("Esporta ordine", "Export order") }),
      ).toBeVisible();
      const header = dialog.locator('[data-slot="sheet-header"]');
      const headerY = (await header.boundingBox())!.y;
      await dialog.getByRole("tab", { name: /Articoli|Items/ }).click();
      await expect(dialog).toContainText(t("Prezzo unitario", "Unit price"));
      // Un prezzo di lotto non divisibile in centesimi esatti resta l'importo della riga.
      await expect(dialog).toContainText(t("Importo della riga", "Line amount"));
      await expect(dialog.locator("li .lucide-package")).toHaveCount(4);
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
      // Riquadro ambra senza etichetta ripetuta: una sola nota sotto il codice spiega il controllo.
      const code = page.getByText("SPSNNA85T55F83", { exact: true }).locator("..");
      await expect(code).toHaveClass(/bg-warning-surface/);
      await expect(code).not.toContainText(t("Codice da controllare", "Check code"));
      await expect(code.getByRole("button", { name: /^Copia |^Copy / })).toBeVisible();
      const card = page.getByRole("article").filter({ hasText: "SPSNNA85T55F83" });
      await expect(card.getByText(t("Codice da controllare", "Check code"))).toHaveCount(1);
      await page.screenshot({ path: test.info().outputPath("elenco.png"), fullPage: true });
      await open(page, await searched(page, "zzzz", `${prefix}/anteprima`), "ordinario");
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
          t("Hai visto tutti gli ordini del periodo.", "You have seen all orders in this period."),
        ),
      ).toBeVisible();
      await open(page, `${prefix}/anteprima/ordini`, "dati-discordanti");
      await expect(page.getByRole("article").filter({ hasText: "05-55555-12121" })).toContainText(
        t("Ordine da verificare", "Order to check"),
      );
      // Valore letto in precedenza con l'ultima lettura non riuscita, dato nascosto o rimosso.
      for (const [query, order, text] of [
        [
          "Ricci",
          "25-30491-88120",
          t("Ultima lettura da eBay non riuscita", "The latest read from eBay failed"),
        ],
        [
          "Colombo",
          "09-11873-20564",
          t("eBay nasconde il Codice Fiscale", "eBay hides the tax code"),
        ],
        [
          "Tecnoufficio",
          "30-55012-90876",
          t("eBay ha rimosso il Codice Fiscale", "eBay removed the tax code"),
        ],
        [
          "08-33110-45672",
          "08-33110-45672",
          t("Acquirente estero (Spagna)", "Foreign buyer (Spain)"),
        ],
      ] as const) {
        await open(page, await searched(page, query, `${prefix}/anteprima`));
        await expect(page.getByRole("article").filter({ hasText: order })).toContainText(text);
      }
      await open(page, await searched(page, "nessun-risultato-collaudo", `${prefix}/anteprima`));
      await expect(
        page.getByRole("heading", { name: t("Nessun risultato", "No results") }),
      ).toBeVisible();
      await expect(
        page.getByText(t("Prova un’altra ricerca.", "Try another search."), { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: t("Cancella ricerca", "Clear search"), exact: true })
        .click();
      await expect(page.getByRole("article").first()).toBeVisible();
      await open(page, `${prefix}/anteprima/ordini/ord-03`, "dati-discordanti");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("status")
          .filter({ hasText: t("Ordine da verificare", "Order to check") }),
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

for (const language of ["it", "en"] as const) {
  for (const width of [500, 1440]) {
    test(`accesso e pagine standalone ${language} a ${width} px`, async ({
      page,
      browserErrors: errors,
    }) => {
      await page.setViewportSize({ width, height: 666 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const prefix = language === "it" ? "" : "/en";
      await page.goto(`${prefix}/accesso`);
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
      expect(errors).toEqual([]);
    });
  }
}

for (const language of ["it", "en"] as const) {
  test(`esito di sicurezza con focus e nuovo accesso ${language}`, async ({ page }) => {
    const prefix = language === "it" ? "/accesso" : "/en/accesso";
    await page.goto(`${prefix}?accesso=nuovo-accesso`);
    const status = page
      .getByRole("status")
      .filter({ hasText: language === "it" ? "accesso recente" : "recent sign-in" });
    await expect(status.locator("..")).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${prefix}$`));
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
    // Il pulsante resta visibile anche prima dell'invio: si attende la richiesta registrata.
    await expect.poll(() => posts).toEqual(["/anteprima/impostazioni/sicurezza"]);
    await expect(page.getByRole("button", { name: "Cambia password", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/anteprima\/impostazioni\/sicurezza$/);
  } finally {
    await context.close();
  }
});

for (const language of ["it", "en"] as const) {
  // Nessuna misura dipende dalla larghezza: basta quella mobile, la più stretta.
  const width = 390;
  test(`sicurezza condivisa e profilo coerente ${language} ${width}px`, async ({
    page,
    pageErrors: errors,
  }, testInfo) => {
    const it = language === "it";
    const prefix = it ? "" : "/en";
    await page.setViewportSize({ width, height: 844 });
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
    const addPasskey = page.getByRole("button", {
      name: it ? "Aggiungi passkey" : "Add passkey",
      exact: true,
    });
    await addPasskey.click();
    expect(posts).toHaveLength(before + 1);
    await addPasskey.click();
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
    // La rilettura dopo l'ultima azione simulata si chiude prima di cambiare pagina: WebKit
    // segnala come errore della pagina una richiesta annullata dalla navigazione.
    await page.waitForLoadState("networkidle");

    await open(page, `${prefix}/anteprima/impostazioni/profilo`);
    const profile = page.getByRole("region", { name: it ? "Profilo" : "Profile", exact: true });
    const first = profile.getByRole("textbox", { name: it ? "Nome" : "First name", exact: true });
    await expect(first).toHaveValue("Laura");
    await expect(first).not.toHaveAttribute("aria-describedby", /profile-name-hint/);
    await expect(
      profile.getByRole("textbox", { name: it ? "Cognome" : "Last name", exact: true }),
    ).toHaveValue("Martini");
    await expect(
      profile.getByRole("textbox", {
        name: it ? "Ragione sociale" : "Company name",
        exact: true,
      }),
    ).toHaveValue("Martini ricambi");
    await expect(
      page.getByText(
        it ? "Facoltativo. Compare nelle email di servizio." : "Optional. Shown in service emails.",
      ),
    ).toHaveCount(0);
    // Email e accessi restano soltanto in Sicurezza.
    await expect(
      profile.getByRole("button", { name: it ? "Cambia email" : "Change email", exact: true }),
    ).toHaveCount(0);
    await first.fill("");
    await profile.getByRole("button", { name: it ? "Salva" : "Save", exact: true }).click();
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

for (const language of ["it", "en"] as const) {
  test(`idratazione dei tempi relativi ${language}`, async ({ browser, baseURL }) => {
    const prefix = language === "it" ? "/anteprima" : "/en/anteprima";
    for (const route of ["impostazioni/aspetto", "impostazioni/supporto", "negozi", "ordini"]) {
      // Ogni caricamento diretto parte da una sessione nuova, senza richieste della pagina precedente.
      const context = await browser.newContext({
        baseURL,
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
      await expect(list).toContainText("Outlet ricambi auto e moto d’epoca - magazzino secondario");
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

const supportAddress = ["supporto", "fiscalbay.it"].join("@");

test(
  "radice pubblica, accesso e area riservata senza sessione né cache",
  { tag: "@smoke" },
  async ({ request }) => {
    for (const prefix of ["", "/en"]) {
      // Sito e accesso rispondono all'anonimo; nessuna risposta del Worker resta in cache.
      for (const path of [prefix || "/", `${prefix}/accesso`]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("no-store");
        // Fuori dalla produzione nessuna pagina è indicizzabile.
        expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      }
      // L'area riservata rimanda all'accesso, senza seguire un redirect esterno.
      for (const path of [
        "/app/ordini",
        "/app/negozi",
        "/app/negozi/collega",
        "/app/impostazioni/profilo",
      ]) {
        const response = await request.get(`${prefix}${path}?redirectTo=https://example.invalid`, {
          maxRedirects: 0,
        });
        expect(response.status()).toBe(302);
        expect(response.headers().location).toMatch(new RegExp(`^${prefix}/accesso(?:\\?|$)`));
        expect(response.headers()["cache-control"]).toBe("no-store");
      }
    }
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
  },
);

for (const language of ["it", "en"] as const) {
  for (const width of [390, 768, 1280]) {
    test(`accesso pubblico e nuova password ${language} a ${width} px`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      // Il caso percorre errore, collegamento, reset e recupero con più navigazioni.
      test.setTimeout(60_000);
      const context = await browser.newContext({
        baseURL,
        viewport: { width, height: 844 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const prefix = language === "it" ? "" : "/en";
      const title = language === "it" ? "Scegli una nuova password" : "Choose a new password";
      const back = language === "it" ? "Torna ad accedere" : "Back to sign in";
      try {
        for (const error of [
          "",
          "account_already_linked_to_different_user",
          "registration_approval_required",
        ]) {
          await page.goto(`${prefix}/auth/error?error=${error}`);
          await expect(
            page.getByRole("link", { name: new RegExp(supportAddress) }),
          ).toHaveAttribute("href", `mailto:${supportAddress}`);
          if (error === "registration_approval_required") {
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              language === "it" ? "Registrazione riservata" : "Registration restricted",
            );
            await expect(
              page.getByText(
                language === "it"
                  ? "Ambiente di test riservato. La registrazione richiede un’autorizzazione preventiva."
                  : "Private test environment. Registration requires prior approval.",
                { exact: true },
              ),
            ).toBeVisible();
          }
        }
        await testInfo.attach("errore-pubblico", {
          body: await page.screenshot({
            path: testInfo.outputPath("errore-pubblico.png"),
            fullPage: true,
          }),
          contentType: "image/png",
        });
        await page.goto(`${prefix}/accesso?negozio=altro-spazio`);
        await expect(page.getByRole("link", { name: new RegExp(supportAddress) })).toBeVisible();
        await page.goto(`${prefix}/accesso?token=synthetic-invalid-token`);
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
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(new RegExp(`${prefix}/accesso$`));
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

for (const width of [390, 768, 1440]) {
  test(`impostazioni e profilo: contesto, documenti e validazione a ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 1440 ? 720 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
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
                  .closest("nav")!
                  .querySelector('li[aria-hidden="true"]')!
                  .getBoundingClientRect();
                return (
                  Math.abs(item.y - indicator.y) < 1 && Math.abs(item.height - indicator.height) < 1
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
      // Il ciclo iniziato nella promozione conserva la quota e annuncia quella seguente.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "fine-promozione");
      await expect(page.locator("main")).toContainText(it ? "7 di 10" : "7 of 10");
      await expect(page.locator("main")).toContainText(
        it ? "Il prossimo ciclo avrà 5 sblocchi." : "The next cycle will have 5 unlocks.",
      );
      // Prezzi netti dal listino; l'acquisto porta a Stripe e torna con il pagamento in verifica.
      await expect(page.locator("main")).toContainText(it ? "4,90 € al mese" : "€4.90 per month");
      await expect(page.locator("main")).toContainText(
        it ? "12 mesi al prezzo di 10." : "12 months for the price of 10.",
      );
      await page.getByRole("button", { name: it ? "Scegli annuale" : "Choose annual" }).click();
      await expect(page).toHaveURL(/\?checkout=processing$/u);
      await expect(
        page.getByText(it ? "Attivazione Premium in corso" : "Activating Premium"),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`checkout-processing-${locale}.png`) });
      // Prima della prima lettura riuscita i prezzi restano visibili, l'acquisto no.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "prima-sincronizzazione");
      await expect(
        page.getByText(
          it
            ? "Potrai acquistare Premium dopo la prima lettura riuscita di un negozio."
            : "You can buy Premium once a store has been read successfully.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Scegli mensile|Choose monthly/u }),
      ).toHaveCount(0);
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "premium-a-vita");
      const documents = page.getByRole("button", {
        name: it ? "Consulta ricevute e fatture su Stripe" : "View receipts and invoices on Stripe",
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
      // Pagamento da confermare o rinnovo da regolarizzare: Free, senza un secondo acquisto.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "pagamento-in-attivazione");
      await expect(
        page.getByText(it ? "Attivazione Premium in corso" : "Activating Premium"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Scegli (mensile|annuale)|Choose (monthly|annual)/u }),
      ).toHaveCount(0);
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "rinnovo-non-riuscito");
      await expect(
        page.locator("main").getByText(it ? "Rinnovo non riuscito" : "Renewal failed"),
      ).toBeVisible();
      await expect(page.locator("main")).toContainText(
        it ? "per mantenere il tuo prezzo" : "to keep your price",
      );
      await page.screenshot({ path: testInfo.outputPath(`renewal-failed-${locale}.png`) });
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "stripe-non-disponibile");
      await page.getByRole("button", { name: it ? "Scegli mensile" : "Choose monthly" }).click();
      await expect(
        page
          .getByRole("status")
          .filter({
            hasText: it
              ? "Pagamento non disponibile ora. Riprova più tardi."
              : "Payment is not available right now. Try again later.",
          })
          .first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni/piano$`));

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

      await open(page, `${prefix}/anteprima/impostazioni/profilo`);
      const profile = page.getByRole("region", { name: it ? "Profilo" : "Profile", exact: true });
      const first = profile.getByRole("textbox", {
        name: it ? "Nome" : "First name",
        exact: true,
      });
      const last = profile.getByRole("textbox", {
        name: it ? "Cognome" : "Last name",
        exact: true,
      });
      await expect(first).toBeVisible();
      // Tutti i campi sono obbligatori: nessuna legenda né asterisco.
      await expect(profile.getByText(it ? "Campo obbligatorio" : "Required field")).toHaveCount(0);
      await expect(profile.locator("label span[aria-hidden=true]")).toHaveCount(0);
      // Il tipo di account è un dato in sola lettura, con etichetta e valore.
      await expect(profile.getByRole("definition")).toHaveText(it ? "Azienda" : "Business");
      // Nome e cognome affiancati da 640 px, con una larghezza contenuta.
      const [firstBox, lastBox] = [await first.boundingBox(), await last.boundingBox()];
      if (width >= 640) {
        expect(Math.abs(firstBox!.y - lastBox!.y)).toBeLessThan(1);
        expect(lastBox!.x + lastBox!.width - firstBox!.x).toBeLessThanOrEqual(672);
      } else {
        expect(lastBox!.y).toBeGreaterThan(firstBox!.y);
      }
      await expect.poll(() => noPageOverflow(page)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`profile-${locale}.png`),
        fullPage: true,
      });
    }
  });

  // Durante la prova mensile e annuale si pagano alla sua fine, che conserva i giorni residui.
  test(`piano durante la prova: acquisto con il primo addebito a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 720 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const locale of ["en", "it"] as const) {
      const it = locale === "it";
      const prefix = it ? "" : "/en";
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "prova-premium");
      const main = page.locator("main");
      await expect(main).toContainText(it ? "Prova Premium" : "Premium trial");
      await expect(main).toContainText(
        it ? "Con mensile o annuale oggi non paghi" : "With monthly or annual you don't pay today",
      );
      // Mensile e annuale hanno lo stesso primo addebito, alla fine della prova.
      await expect(
        main.getByText(it ? /Primo addebito il 6 ott 2026\./u : /First charge on 6 Oct 2026\./u),
      ).toHaveCount(2);
      await expect(
        page.getByRole("button", { name: it ? "Scegli annuale" : "Choose annual" }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`trial-purchase-${locale}.png`) });
      // Il ritorno da Stripe durante la prova non parla di pagamento: la prova continua.
      await page.getByRole("button", { name: it ? "Scegli annuale" : "Choose annual" }).click();
      await expect(page).toHaveURL(/\?checkout=processing$/u);
      await expect(main).toContainText(it ? "Prova Premium" : "Premium trial");
      await expect(
        page.getByText(it ? "Scelta del piano in corso" : "Confirming your plan"),
      ).toBeVisible();
      // Con l'abbonamento scelto la prova continua senza addebiti né un secondo acquisto.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "prova-con-abbonamento");
      await expect(
        page.getByText(it ? "Premium mensile scelto" : "You chose Premium, monthly"),
      ).toBeVisible();
      await expect(main).toContainText(
        it ? "Fino ad allora non paghi nulla." : "Until then you pay nothing.",
      );
      await expect(
        page.getByRole("button", { name: /Scegli (mensile|annuale)|Choose (monthly|annual)/u }),
      ).toHaveCount(0);
    }
  });
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

for (const area of areas)
  test(`copia fallita visibile e recupero con un nuovo tentativo, ${area.name}`, async ({
    page,
    baseURL,
  }) => {
    await enter(page, baseURL!, area);
    await open(page, `${area.base}/ordini`);
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
    const card = page.getByRole("article", { name: `Ordine ${area.copied.id}` });
    const copy = card.getByRole("button", {
      name: `Copia Codice Fiscale: ordine ${area.copied.id}`,
      exact: true,
    });
    await copy.click();
    await expect(card.getByText(/^Copia non riuscita\./)).toBeVisible();
    await copy.click();
    await expect(page.locator("html")).toHaveAttribute("data-copied", area.copied.value);
    await expect(card.getByText(/^Copia non riuscita\./)).toHaveCount(0);
    await expect(copy).toHaveAttribute("data-state", "copied");
  });

for (const locale of ["it", "en"] as const) {
  test(`nomi lunghi nel filtro dei negozi su touch, ${locale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 667 },
      hasTouch: true,
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

for (const area of areas)
  test(`pannello di dettaglio scorrevole con chiusura raggiungibile, ${area.name}`, async ({
    page,
    baseURL,
  }) => {
    await enter(page, baseURL!, area);
    await page.setViewportSize({ width: 667, height: 260 });
    await open(page, `${area.base}/ordini/${area.detail}`);
    const dialog = page.getByRole("dialog");
    // L'ordine reale di collaudo non ha ancora un controllo fiscale: chiude il pannello l'ultima
    // sezione, non la riga della fonte.
    const end =
      area.base === "/app"
        ? dialog.getByRole("tabpanel").locator(":scope > *").last()
        : dialog.getByText(/^Fonte: eBay/);
    await end.scrollIntoViewIfNeeded();
    await expect(end).toBeInViewport({ ratio: 1 });
    const close = dialog.getByRole("button", { name: "Chiudi", exact: true });
    await expect(close).toBeInViewport({ ratio: 1 });
    await close.click();
    await expect(dialog).toBeHidden();
    // L'elenco conserva la sua istantanea.
    await expect(page).toHaveURL(new RegExp(`${area.base}/ordini\\?vista=[0-9a-z]+$`, "u"));
  });

test("messaggio per l'acquirente a larghezza piena e fonte in fondo al dettaglio", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const language of ["it", "en"]) {
    const prefix = language === "it" ? "" : "/en";
    await open(page, `${prefix}/anteprima/ordini/ord-05`, "ordinario");
    const dialog = page.getByRole("dialog");
    const source = dialog.getByText(language === "it" ? /^Fonte: eBay/ : /^Source: eBay/);
    const copy = dialog.getByRole("button", {
      name: language === "it" ? "Copia messaggio per l’acquirente" : "Copy message for the buyer",
    });
    const message = dialog.getByRole("textbox");
    await expect(dialog).not.toContainText(
      language === "it"
        ? "Quando eBay non riporta il Codice Fiscale, puoi copiare questo messaggio"
        : "When eBay does not provide the tax code, you can copy this message",
    );
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(async () => {
        const boxes = await Promise.all([
          source.boundingBox(),
          copy.boundingBox(),
          message.boundingBox(),
        ]);
        expect(boxes.every(Boolean)).toBe(true);
        const [provenance, button, textarea] = boxes as Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
        expect(provenance!.y).toBeGreaterThanOrEqual(button!.y + button!.height);
        expect(Math.abs(provenance!.x - textarea!.x)).toBeLessThan(2);
        expect(Math.abs(provenance!.width - textarea!.width)).toBeLessThan(2);
      }).toPass();
      expect(await noPageOverflow(page)).toBe(true);
    }
  }
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
  await open(page, "/anteprima/ordini", "ordinario");
  await expect(
    page.getByText("2 sblocchi disponibili in questo ciclo.", { exact: true }),
  ).toHaveCount(1);
  for (const id of ["19-00001-99999", "31-77421-10058", "05-55555-12121"]) {
    const card = page.getByRole("article", { name: `Ordine ${id}` });
    await expect(card.getByRole("button", { name: /^Copia / })).toHaveCount(0);
  }
  const locked = page.getByRole("article", { name: "Ordine 05-55555-12121" });
  await expect(locked.locator(".icon-unlock")).toHaveCount(2);
  await expect(locked.locator(".lucide-crown")).toHaveCount(0);
  await expect(locked).not.toContainText("Questo ordine ne usa uno.");
  await locked.getByRole("link", { name: "Dettaglio", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Hai 2 sblocchi disponibili in questo ciclo. Questo ordine ne usa uno.",
  );
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  const missing = page.getByRole("article", { name: "Ordine 31-77421-10058" });
  await expect(missing).toContainText("Non disponibile su eBay");
  await expect(missing).not.toContainText("eBay non riporta il Codice Fiscale per questo ordine.");
  const failed = page.getByRole("article", { name: "Ordine 19-00001-99999" });
  await expect(failed).toContainText("Aggiornamento non riuscito");
  await expect(failed.getByRole("button", { name: "Riprova", exact: true })).toBeEnabled();
  await expect(failed).not.toContainText("Non siamo riusciti a recuperare il Codice Fiscale");
  await missing.getByRole("link", { name: "Dettaglio", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "eBay non riporta il Codice Fiscale per questo ordine.",
  );
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

for (const area of areas)
  // Dopo il deploy le prove @smoke girano sul dominio test, dove la sessione sintetica non esiste.
  test(
    `superfici nei due temi, ${area.name}`,
    { tag: area.base === "/anteprima" ? "@smoke" : [] },
    async ({ page, baseURL }) => {
      await enter(page, baseURL!, area);
      for (const [scheme, background, card, panel] of [
        ["light", "rgb(245, 247, 250)", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
        ["dark", "rgb(18, 20, 24)", "rgb(28, 31, 37)", "rgb(36, 40, 48)"],
      ] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, `${area.base}/ordini/${area.detail}`);
        await expect(page.locator("body")).toHaveCSS("background-color", background);
        await expect(page.locator("article").first()).toHaveCSS("background-color", card);
        await expect(page.getByRole("dialog")).toHaveCSS("background-color", panel);
      }
    },
  );

test("movimento ridotto: dato intero e nuovi ordini senza animazione", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/anteprima/ordini");
  await page
    .getByRole("article", { name: "Ordine 05-55555-12121" })
    .getByRole("button", { name: "Sblocca ordine" })
    .click();
  const value = page.getByText("BNCLCU75C12F205G", { exact: true });
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

test("un nuovo accesso ricorda soltanto il negozio, l'istantanea resta su «Carica altri»", async ({
  page,
}) => {
  await open(page, "/anteprima/ordini?periodo=30", "premium");
  await expect(page).toHaveURL(/periodo=30&vista=[0-9a-z]+$/u);
  const vista = new URL(page.url()).searchParams.get("vista");
  const firstLabel = () =>
    page
      .getByRole("article")
      .first()
      .evaluate(
        (card) => document.getElementById(card.getAttribute("aria-labelledby")!)?.textContent,
      );
  const before = await firstLabel();
  await page.getByRole("link", { name: "Carica altri" }).click();
  await expect(page).toHaveURL(new RegExp(`mostra=2&vista=${vista}$`, "u"));
  expect(await firstLabel()).toBe(before);
  const store = page.getByRole("combobox", { name: "Negozio", exact: true });
  await store.click();
  await page.getByRole("option", { name: /magazzino secondario/u }).click();
  await expect(page).toHaveURL(/negozio=[^&]+/u);
  // Il nuovo filtro apre un elenco nuovo, con un'altra istantanea e senza pagine caricate.
  await expect(page).not.toHaveURL(/mostra=/u);
  // L'ingresso dagli Ordini senza parametri riapre il negozio, non il periodo.
  await page.goto("/anteprima/ordini");
  await expect(page).toHaveURL(/\/anteprima\/ordini\?negozio=[^&]+&vista=[0-9a-z]+$/u);
  await expect(store).toContainText("magazzino secondario");
  await expect(page.getByRole("combobox", { name: "Periodo", exact: true })).toContainText("Tutti");
  // «Reimposta filtri» lo dimentica.
  await page.goto(`/anteprima/ordini?periodo=7&pagamento=refunded&vista=${vista}`);
  await page.getByRole("link", { name: "Reimposta filtri" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini\?vista=[0-9a-z]+$/u);
  await page.goto("/anteprima/ordini");
  await expect(page).toHaveURL(/\/anteprima\/ordini\?vista=[0-9a-z]+$/u);
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
    await page.goto(it ? "/accesso" : "/en/accesso");
    await page.waitForLoadState("networkidle");
    const signIn = page.getByRole("tabpanel", { name: it ? "Accedi" : "Sign in", exact: true });
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
    const signUp = page.getByRole("tabpanel", {
      name: it ? "Crea account" : "Create account",
      exact: true,
    });
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
  await page.goto("/accesso?negozio=altro-spazio");
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
});

for (const area of areas)
  test(`domande frequenti con il segno del prodotto e tastiera, ${area.name}`, async ({
    page,
    baseURL,
  }) => {
    await enter(page, baseURL!, area);
    await open(page, `${area.base}/impostazioni/supporto`);
    const summary = page.locator("details summary").first();
    expect(await summary.evaluate((node) => getComputedStyle(node).display)).toBe("flex");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details").first()).toHaveAttribute("open", "");
  });

for (const area of areas)
  test(`lingue con il proprio nome nelle Impostazioni inglesi, ${area.name}`, async ({
    page,
    baseURL,
  }) => {
    await enter(page, baseURL!, area);
    await open(page, `/en${area.base}/impostazioni/aspetto`);
    // Nell'area reale la scelta si salva con un pulsante; nell'anteprima cambia soltanto pagina.
    const language =
      area.base === "/app"
        ? page.getByRole("region", { name: "Language" }).getByRole("button")
        : page.getByRole("navigation", { name: "Language" }).getByRole("link");
    await expect(language.filter({ hasText: /^Italiano$/u })).toHaveAttribute("lang", "it");
    await open(page, `/en${area.base}/impostazioni/messaggio`);
    await expect(page.getByRole("tab", { name: "Italiano", exact: true })).toHaveAttribute(
      "lang",
      "it",
    );
  });

for (const language of ["it", "en"] as const) {
  test(`onboarding e degradazione nell'anteprima ${language}`, async ({
    page,
    pageErrors: errors,
  }) => {
    const prefix = language === "it" ? "" : "/en";
    const t = <Text>(it: Text, en: Text) => (language === "it" ? it : en);
    // Un solo negozio con le letture ferme: avviso con l'ultimo aggiornamento e campanella.
    await open(page, `${prefix}/anteprima/ordini`, "negozio-scaduto");
    const failed = page.getByRole("status").filter({
      hasText: t(
        "Vintage Garage Italia: aggiornamento non riuscito",
        "Vintage Garage Italia: update failed",
      ),
    });
    await expect(
      failed.getByRole("link", { name: t("Apri il negozio", "Open store") }),
    ).toHaveAttribute("href", `${prefix}/anteprima/negozi/neg-vintage`);
    await expect(page.getByRole("article").first()).toBeVisible();
    // Collegato e senza ordini: il periodo letto, senza errori inventati.
    await open(page, `${prefix}/anteprima/ordini`, "nessun-ordine");
    await expect(
      page.getByRole("heading", {
        name: t("Nessun ordine negli ultimi 30 giorni", "No orders in the last 30 days"),
      }),
    ).toBeVisible();
    // Prima sincronizzazione: nessun errore, importazione in corso e primi passi.
    await open(page, `${prefix}/anteprima/ordini`, "prima-sincronizzazione");
    await expect(
      page.getByRole("heading", {
        name: t("Prima sincronizzazione in corso", "First sync in progress"),
      }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText(
      t("Prima sincronizzazione", "First sync"),
    );
    // eBay non risponde: un solo avviso nella campanella e Riprova sospesa anche sul server.
    await open(page, `${prefix}/anteprima/ordini`, "ebay-non-disponibile");
    await page.getByRole("button", { name: t(/^Notifiche/u, /^Notifications/u) }).click();
    await expect(
      page
        .getByRole("dialog", { name: t("Notifiche", "Notifications") })
        .getByText(t("eBay non risponde", "eBay is not responding"), { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // Primo accesso: primi passi dal punto raggiunto, senza wizard.
    await open(page, `${prefix}/anteprima/ordini`, "primo-accesso");
    await expect(page.locator('[aria-current="step"]')).toContainText(
      t("Negozio eBay collegato", "eBay store connected"),
    );
    // Auth o database non disponibili: nessun dato e soltanto Riprova, su ogni pagina.
    await open(page, `${prefix}/anteprima/ordini`, "servizio-non-disponibile");
    for (const section of ["ordini", "negozi", "impostazioni", "impostazioni/profilo"]) {
      await page.goto(`${prefix}/anteprima/${section}`);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: t("Servizio non disponibile", "Service unavailable"),
        }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: t("Riprova", "Try again") })).toHaveAttribute(
        "href",
        `${prefix}/anteprima/${section}`,
      );
      await expect(page.getByRole("article")).toHaveCount(0);
    }
    await open(page, `${prefix}/anteprima/ordini`, "ordinario");
    expect(errors).toEqual([]);
  });
}

test.describe("caricamento degli Ordini reali", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  test("da un'altra sezione compare lo scheletro dell'elenco, non la pagina precedente", async ({
    page,
    context,
    baseURL,
  }) => {
    await useLocalAccount(context, "member", baseURL!);
    await page.goto("/app/negozi");
    await expect(
      page.getByRole("searchbox", { name: "Cerca ordini", includeHidden: true }),
    ).toBeEnabled();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/app\/ordini\.data/u, async (route) => {
      await held;
      await route.continue();
    });
    await page.getByRole("link", { name: "Ordini", exact: true }).first().click();
    const grid = page.locator('[aria-busy="true"]');
    await expect(grid).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Ordini" })).toBeVisible();
    release();
    await expect(grid).toBeHidden();
    await expect(page.getByRole("article").first()).toBeVisible();
  });
});

test.describe("prova Premium", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  for (const language of ["it", "en"] as const)
    test(`ordini reali: la prova si attiva dopo la prima lettura e compare nel Piano ${language}`, async ({
      page,
      context,
      baseURL,
      browserName,
    }) => {
      const it = language === "it";
      const prefix = it ? "" : "/en";
      // Spazio con il negozio già letto e ordini da sbloccare, proprio di lingua e browser.
      await useLocalAccount(context, "member", baseURL!, `trial-${language}-${browserName}`);
      await page.goto(`${prefix}/app/ordini`);
      const secret = `VALORE-SINTETICO-${language}`;
      expect(await page.content()).not.toContain(secret);
      await expect(
        page.getByText(
          it
            ? "Prova Premium gratis per 14 giorni, senza carta."
            : "Try Premium free for 14 days, no card needed.",
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: it ? "Attiva la prova" : "Start trial", exact: true })
        .click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: it ? "Prova Premium attivata." : "Premium trial started." }),
      ).toBeVisible();
      await expect(
        page.getByText(it ? "Prova Premium: 14 giorni rimasti" : "Premium trial: 14 days left"),
      ).toBeVisible();
      // Con la prova il dato è leggibile senza sblocco e senza consumare la quota.
      await expect(page.getByText(secret, { exact: true }).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: it ? "Sblocca ordine" : "Unlock order" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
      ).toHaveCount(0);
      await page.goto(`${prefix}/app/impostazioni/piano`);
      const plan = page.getByRole("region", {
        name: it ? "Piano e pagamenti" : "Plan and billing",
      });
      await expect(
        plan.getByText(it ? "Prova Premium" : "Premium trial", { exact: true }),
      ).toBeVisible();
      await expect(plan.getByText(it ? /14 giorni rimasti/u : /14 days left/u)).toBeVisible();
      await expect(
        plan.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
      ).toHaveCount(0);
    });
});

test.describe("abbonamento nel piano", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  // Ogni stato reale si legge accanto allo scenario dell'anteprima che lo rappresenta.
  const states = [
    { account: "active", scenario: "premium" },
    { account: "cancelled", scenario: "rinnovo-disdetto" },
    { account: "pending", scenario: "pagamento-in-attivazione" },
    { account: "lapsed", scenario: "rinnovo-non-riuscito" },
  ] as const;

  for (const language of ["it", "en"] as const)
    for (const { account, scenario } of states)
      test(`area reale e anteprima mostrano lo stesso abbonamento: ${account}, ${language}`, async ({
        page,
        context,
        browser,
        baseURL,
      }) => {
        const it = language === "it";
        const prefix = it ? "" : "/en";
        const expected = {
          active: {
            title: it ? /^Premium (mensile|annuale)$/u : /^Premium, (monthly|annual)$/u,
            text: it ? "Si rinnova il" : "Renews on",
          },
          cancelled: {
            title: it ? "Premium mensile" : "Premium, monthly",
            text: it
              ? "Rinnovo disdetto: Premium resta attivo fino al"
              : "Renewal cancelled: Premium stays active until",
          },
          pending: {
            title: "Free",
            text: it ? "Attivazione Premium in corso" : "Activating Premium",
          },
          lapsed: {
            title: "Free",
            text: it ? "per mantenere il tuo prezzo" : "to keep your price",
          },
        }[account];
        const check = async (target: Page, surface: "real" | "preview") => {
          const section = target.getByRole("region", {
            name: it ? "Piano e pagamenti" : "Plan and billing",
          });
          await expect(section.getByText(expected.title, { exact: true })).toBeVisible();
          await expect(section).toContainText(expected.text);
          // Con un abbonamento aperto né la prova né un secondo acquisto.
          await expect(
            section.getByRole("button", {
              name: /Attiva la prova|Start trial|Scegli (mensile|annuale)|Choose (monthly|annual)/u,
            }),
          ).toHaveCount(0);
          await section.screenshot({
            path: test.info().outputPath(`subscription-${account}-${surface}-${language}.png`),
          });
        };
        await useLocalAccount(context, "member", baseURL!, `subscription-${account}`);
        await page.goto(`${prefix}/app/impostazioni/piano`);
        await check(page, "real");
        if (account === "pending" || account === "lapsed") {
          await page.goto(`${prefix}/app/ordini`);
          await expect(
            page.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
          ).toHaveCount(0);
        }
        // L'anteprima in un contesto proprio, anonimo e senza la sessione dell'area reale.
        const preview = await browser.newContext({ baseURL });
        try {
          const previewPage = await preview.newPage();
          await open(previewPage, `${prefix}/anteprima/impostazioni/piano`, scenario);
          await check(previewPage, "preview");
        } finally {
          await preview.close();
        }
      });
});
