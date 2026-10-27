import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { areas, enter, noPageOverflow, open, searched } from "./components";
import { expect, test, watchNetwork } from "./fixtures";
import { useLocalAccount } from "./local-account";
import { testAccount } from "./test-account";

test.describe("area reale", () => {
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
      // Come nel collaudo remoto: nel Free i negozi oltre a quello attivo sono in pausa per il
      // piano e non avvisano del consenso.
      await expect(page.getByText(testAccount.taxCodes.unlocked).first()).toBeVisible();
      for (const store of [testAccount.stores.expiring, testAccount.stores.expired])
        await expect(page.getByRole("status").filter({ hasText: store })).toHaveCount(0);
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
        watchNetwork(context);
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
          // Il dialogo dello sblocco si apre solo dopo l'idratazione: un clic anticipato va perso.
          await open(page, `${prefix}/app/ordini`);
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
          // Anche dopo la ricarica il clic attende l'idratazione: sotto carico andrebbe perso.
          await expect(
            page.getByRole("searchbox", {
              name: it ? "Cerca ordini" : "Search orders",
              includeHidden: true,
            }),
          ).toBeEnabled();
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
          // Lo sblocco chiude la selezione; resta disponibile per esportare.
          await expect(select).toBeEnabled();
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
    test(`ordini reali: Esporta crea il CSV della selezione con i soli dati sbloccati ${language}`, async ({
      page,
      context,
      baseURL,
      browserName,
      browserErrors: errors,
    }) => {
      const id = `export-${language}-${browserName}`;
      const secret = `VALORE-SINTETICO-${language}`;
      await useLocalAccount(context, "member", baseURL!, id);
      // La selezione e il clic su Esporta richiedono la pagina idratata.
      await open(page, `${prefix}/app/ordini`);
      await page.getByRole("button", { name: it ? "Seleziona" : "Select", exact: true }).click();
      for (const suffix of ["", "-2"])
        await page
          .getByRole("article", { name: `${it ? "Ordine" : "Order"} ${id}${suffix}`, exact: true })
          .getByRole("checkbox")
          .check();
      await page.getByRole("button", { name: it ? "Esporta" : "Export", exact: true }).click();
      await expect(page).toHaveURL(/\/app\/impostazioni\/esportazione\?.*ordini=/u);
      const status = page
        .getByRole("region", { name: it ? "Ordini da esportare" : "Orders to export" })
        .getByRole("status");
      await expect(status).toHaveText(
        it
          ? "2 ordini. Per 1 ordine da sbloccare il Codice Fiscale resta vuoto."
          : "2 orders. For 1 order to unlock, the tax code stays empty.",
      );
      // Nessun file prima della conferma: il download parte soltanto da «Crea file».
      const create = page.getByRole("button", {
        name: it ? "Crea file" : "Create file",
        exact: true,
      });
      const downloaded = page.waitForEvent("download");
      await create.click();
      const download = await downloaded;
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`^fiscalbay-${it ? "ordini" : "orders"}-\\d{4}-\\d{2}-\\d{2}\\.csv$`, "u"),
      );
      const csv = await readFile(await download.path(), "utf8");
      const [header, ...rows] = csv
        .replace(/^\uFEFF/u, "")
        .trimEnd()
        .split("\r\n");
      expect(header).toMatch(it ? /^"Numero ordine","Data",/u : /^"Order number","Date",/u);
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.startsWith(`"${id}",`))).toContain(secret);
      expect(rows.find((row) => row.startsWith(`"${id}-2",`))).toContain(
        it ? '"Da sbloccare"' : '"To unlock"',
      );
      expect(csv).not.toContain(`${secret}-2`);
      // Il file resta fra quelli creati e si scarica di nuovo dal suo percorso autenticato.
      const files = page.getByRole("region", { name: it ? "File creati" : "Created files" });
      // Il più recente in testa; un nuovo tentativo della prova trova anche il file precedente.
      const latest = files.getByRole("listitem").first();
      await expect(latest).toContainText(download.suggestedFilename());
      const again = page.waitForEvent("download");
      await latest.getByRole("button", { name: it ? "Scarica" : "Download", exact: true }).click();
      expect(await readFile(await (await again).path(), "utf8")).toBe(csv);
      await page
        .getByRole("radio", {
          name: it ? "Solo con dati fiscali disponibili" : "Only with tax data available",
        })
        .check();
      await expect(status).toHaveText(it ? "1 ordine." : "1 order.");
      expect(errors).toEqual([]);
    });
    test(`ordini reali: con Premium l'XLSX segue le colonne scelte e la configurazione salvata ${language}`, async ({
      page,
      context,
      baseURL,
      browserName,
      browserErrors: errors,
    }) => {
      const id = `xlsx-${language}-${browserName}`;
      await useLocalAccount(context, "member", baseURL!, id);
      await open(page, `${prefix}/app/impostazioni/esportazione`);
      const section = page.getByRole("region", {
        name: it ? "Ordini da esportare" : "Orders to export",
      });
      await section.getByRole("radio", { name: "XLSX" }).check();
      await section.getByRole("radio", { name: it ? "Articolo" : "Item", exact: true }).check();
      const columns = section.getByRole("group", { name: it ? "Colonne" : "Columns" });
      // Si tengono numero ordine e altri identificativi, con questi ultimi in testa.
      for (const checkbox of await columns.getByRole("checkbox").all()) await checkbox.uncheck();
      await columns.getByRole("checkbox", { name: it ? "Numero ordine" : "Order number" }).check();
      const other = it ? "Altri identificativi fiscali" : "Other tax identifiers";
      await columns.getByRole("checkbox", { name: other }).check();
      const up = columns.getByRole("button", {
        name: it ? `Sposta su: ${other}` : `Move up: ${other}`,
      });
      for (let moves = 0; moves < 24; moves++) await up.click();
      await expect(
        section.getByText(it ? `${other} in posizione 1 di 28.` : `${other} in position 1 of 28.`),
      ).toBeAttached();
      const downloaded = page.waitForEvent("download");
      await section
        .getByRole("button", { name: it ? "Crea file" : "Create file", exact: true })
        .click();
      const download = await downloaded;
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`^fiscalbay-${it ? "ordini" : "orders"}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`, "u"),
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(await download.path());
      const rows = (workbook.worksheets[0]!.getSheetValues().slice(1) as unknown[][]).map((row) =>
        row.slice(1),
      );
      expect(rows[0]).toEqual([other, it ? "Numero ordine" : "Order number"]);
      // Con Premium ogni ordine ha il suo dato, come testo.
      expect(rows.slice(1).sort()).toEqual(
        ["", "-2", "-3", "-4"].map((suffix) => [
          `VAT_ID: VALORE-SINTETICO-${language}${suffix}`,
          `${id}${suffix}`,
        ]),
      );
      // La forma scelta si salva con un nome e torna dopo una nuova apertura.
      await section
        .getByRole("button", { name: it ? "Salva configurazione" : "Save configuration" })
        .click();
      await section
        .getByRole("textbox", { name: it ? "Nome della configurazione" : "Configuration name" })
        .fill("Commercialista");
      await section.getByRole("button", { name: it ? "Salva" : "Save", exact: true }).click();
      // L'esito arriva dopo il salvataggio e la rilettura della pagina.
      await expect(
        page.getByText(it ? "Configurazione salvata." : "Configuration saved."),
      ).toBeVisible({
        timeout: 20_000,
      });
      await open(page, `${prefix}/app/impostazioni/esportazione`);
      const configuration = section.getByRole("combobox", {
        name: it ? "Configurazione" : "Configuration",
      });
      await configuration.click();
      await page.getByRole("option", { name: "Commercialista" }).click();
      await expect(section.getByRole("radio", { name: "XLSX" })).toBeChecked();
      await expect(columns.getByRole("checkbox", { checked: true })).toHaveCount(2);
      await section
        .getByRole("button", { name: it ? "Elimina configurazione" : "Delete configuration" })
        .click();
      // L'esito arriva dopo il salvataggio e la rilettura della pagina.
      await expect(
        page.getByText(it ? "Configurazione eliminata." : "Configuration deleted."),
      ).toBeVisible({
        timeout: 20_000,
      });
      await expect(configuration).toHaveCount(0);
      expect(errors).toEqual([]);
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
  }
});

/** Elenco con la ricerca: la query va nel corpo e l'indirizzo riceve la sua forma cifrata. */
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
      // Nel Free i periodi oltre i 30 giorni sono Premium: 90 giorni, 6 e 12 mesi.
      await expect(
        menu.getByText(t("Disponibile con Premium", "Available with Premium")),
      ).toHaveCount(3);
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

for (const area of areas)
  test(`copia fallita visibile e recupero con un nuovo tentativo, ${area.name}`, async ({
    page,
    baseURL,
  }) => {
    await enter(page.context(), baseURL!, area);
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
    watchNetwork(context);
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
    await enter(page.context(), baseURL!, area);
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
      await enter(page.context(), baseURL!, area);
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
  // In cima, senza selezione né dettaglio, l'indirizzo resta senza istantanea.
  await expect(page).toHaveURL(/\/anteprima\/ordini\?periodo=30$/u);
  const firstLabel = () =>
    page
      .getByRole("article")
      .first()
      .evaluate(
        (card) => document.getElementById(card.getAttribute("aria-labelledby")!)?.textContent,
      );
  const before = await firstLabel();
  await page.getByRole("link", { name: "Carica altri" }).click();
  await expect(page).toHaveURL(/periodo=30&mostra=2&vista=[0-9a-z]+$/u);
  const vista = new URL(page.url()).searchParams.get("vista");
  expect(await firstLabel()).toBe(before);
  const store = page.getByRole("combobox", { name: "Negozio", exact: true });
  await store.click();
  await page.getByRole("option", { name: /magazzino secondario/u }).click();
  await expect(page).toHaveURL(/negozio=[^&]+/u);
  // Il nuovo filtro apre un elenco nuovo, con un'altra istantanea e senza pagine caricate.
  await expect(page).not.toHaveURL(/mostra=/u);
  // L'ingresso dagli Ordini senza parametri riapre il negozio, non il periodo.
  await page.goto("/anteprima/ordini");
  await expect(page).toHaveURL(/\/anteprima\/ordini\?negozio=[^&]+$/u);
  await expect(store).toContainText("magazzino secondario");
  await expect(page.getByRole("combobox", { name: "Periodo", exact: true })).toContainText("Tutti");
  // «Reimposta filtri» lo dimentica.
  await page.goto(`/anteprima/ordini?periodo=7&pagamento=refunded&vista=${vista}`);
  await page.getByRole("link", { name: "Reimposta filtri" }).click();
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);
  await page.goto("/anteprima/ordini");
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);
  // Lontano dalla cima l'elenco riceve l'istantanea, senza una nuova lettura.
  await page.mouse.wheel(0, 600);
  await expect(page).toHaveURL(/\/anteprima\/ordini\?vista=[0-9a-z]+$/u);
});

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

// Queste prove proseguono nelle Impostazioni.
test.describe("impostazioni", () => {
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
    await expect(missing).not.toContainText(
      "eBay non riporta il Codice Fiscale per questo ordine.",
    );
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
        watchNetwork(context);
        // «Attiva la prova» risponde solo dopo l'idratazione: un clic anticipato va perso.
        await open(page, `${prefix}/app/ordini`);
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
          page.getByText(it ? "Prova Premium: 13 giorni rimasti" : "Premium trial: 13 days left"),
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
        await expect(plan.getByText(it ? /13 giorni rimasti/u : /13 days left/u)).toBeVisible();
        await expect(
          plan.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
        ).toHaveCount(0);
      });
  });
});

// Queste prove attraversano anche Negozi e Impostazioni.
test.describe("negozi e impostazioni", () => {
  for (const language of ["it", "en"] as const) {
    test(`idratazione dei tempi relativi ${language}`, async ({ browser, baseURL }) => {
      const prefix = language === "it" ? "/anteprima" : "/en/anteprima";
      for (const route of ["impostazioni/aspetto", "impostazioni/supporto", "negozi", "ordini"]) {
        // Ogni caricamento diretto parte da una sessione nuova, senza richieste della pagina precedente.
        const context = await browser.newContext({
          baseURL,
          viewport: { width: 1440, height: 900 },
        });
        watchNetwork(context);
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
});
