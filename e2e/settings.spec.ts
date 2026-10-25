import type { Page } from "@playwright/test";
import { areas, enter, noPageOverflow, open } from "./components";
import { expect, networkIdle, test, watchNetwork } from "./fixtures";
import { useLocalAccount } from "./local-account";

test.afterEach(async ({ context }) => context.unrouteAll({ behavior: "ignoreErrors" }));

test.describe("area reale", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

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
    await networkIdle(page);
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
    await networkIdle(page);

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
    await networkIdle(page);

    // La lingua scelta resta anche aprendo l'area in italiano.
    const appearance = page.locator('section[aria-labelledby="settings-aspetto"]');
    await appearance.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/app\/impostazioni\/aspetto$/u);
    await page.goto("/app/ordini");
    await expect(page).toHaveURL(/\/en\/app\/ordini$/u);
    await page.goto("/en/app/impostazioni/aspetto");
    await networkIdle(page);
    await appearance.getByRole("button", { name: "Italiano", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/impostazioni\/aspetto$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    expect(errors).toEqual([]);
  });
});

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
      // Con il lifetime non resta nulla da acquistare.
      await expect(
        page.getByRole("button", { name: /Scegli a vita|Choose lifetime/u }),
      ).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`lifetime-${locale}.png`) });
      // Dall'abbonamento si passa a vita detraendo il periodo pagato non usato.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "cambio-rinnovo");
      const upgrade = page.getByRole("region", {
        name: it ? "Passa a vita" : "Switch to lifetime",
      });
      await expect(upgrade).toContainText(
        it ? "del periodo pagato non usato." : "for the unused paid period.",
      );
      await expect(upgrade).toContainText(
        it
          ? "L’abbonamento si chiude senza altri rinnovi."
          : "Your subscription ends with no further renewals.",
      );
      await expect(
        upgrade.getByRole("button", { name: it ? "Scegli a vita" : "Choose lifetime" }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`lifetime-upgrade-${locale}.png`) });
      // A posti finiti il lifetime resta visibile come esaurito; mensile e annuale restano.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "lifetime-esaurito");
      await expect(page.locator("main")).toContainText(it ? "Posti esauriti" : "Sold out");
      await expect(
        page.getByRole("button", { name: /Scegli a vita|Choose lifetime/u }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: it ? "Scegli annuale" : "Choose annual" }),
      ).toBeVisible();
      // Passaggio a vita pagato e in conferma: l'abbonamento resta, nessun secondo acquisto.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "passaggio-a-vita");
      await expect(
        page.getByText(it ? "Premium a vita in attivazione" : "Activating lifetime Premium"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Scegli a vita|Choose lifetime/u }),
      ).toHaveCount(0);
      // Lifetime in omaggio: nessun rinnovo e nessun documento su Stripe.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "premium-a-vita-concesso");
      await expect(page.locator("main")).toContainText(
        it ? "Concesso da FiscalBay, senza rinnovi." : "Granted by FiscalBay, no renewals.",
      );
      await expect(
        page.getByRole("button", {
          name: it
            ? "Consulta ricevute e fatture su Stripe"
            : "View receipts and invoices on Stripe",
        }),
      ).toHaveCount(0);
      // Premium concesso: la sua fine, senza gestione su Stripe.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "premium-concesso");
      await expect(page.locator("main")).toContainText(
        it ? "Premium concesso fino al" : "Premium granted until",
      );
      await expect(
        page.getByRole("button", { name: /Gestisci abbonamento|Manage subscription/u }),
      ).toHaveCount(0);
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
      // Il lifetime durante la prova si paga subito: il ritorno non parla del primo addebito.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "prova-premium");
      await page.getByRole("button", { name: it ? "Scegli a vita" : "Choose lifetime" }).click();
      await expect(page).toHaveURL(/\?checkout=lifetime$/u);
      await expect(
        page.getByText(it ? "Premium a vita in attivazione" : "Activating lifetime Premium"),
      ).toBeVisible();
      await expect(
        page.getByText(it ? "Scelta del piano in corso" : "Confirming your plan"),
      ).toHaveCount(0);
      // Con l'abbonamento scelto la prova continua senza addebiti né un secondo acquisto.
      await open(page, `${prefix}/anteprima/impostazioni/piano`, "prova-con-abbonamento");
      await expect(
        page.getByText(it ? "Premium mensile scelto" : "You chose Premium, monthly"),
      ).toBeVisible();
      await expect(main).toContainText(
        it ? "Fino ad allora non paghi nulla." : "Until then you pay nothing.",
      );
      // La prova non annuncia più il ritorno al Free.
      await expect(main).toContainText(
        it
          ? "Alla fine Premium continua con il primo addebito."
          : "When it ends, Premium continues with the first charge.",
      );
      await expect(main).not.toContainText(
        it ? "alla fine torni al Free" : "when it ends you go back to Free",
      );
      await expect(
        page.getByRole("button", { name: /Scegli (mensile|annuale)|Choose (monthly|annual)/u }),
      ).toHaveCount(0);
      // L'abbonamento scelto si disdice dal portale di Stripe prima del primo addebito.
      await expect(
        main.getByRole("button", {
          name: it ? "Gestisci abbonamento su Stripe" : "Manage subscription on Stripe",
        }),
      ).toBeVisible();
    }
  });
}

// La conferma si verifica nel pannello di un negozio.
test.describe("negozi", () => {
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

test.describe("negozio attivo del Free", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  for (const language of ["it", "en"] as const)
    test(`negozi reali: il secondo negozio è in pausa e la sostituzione chiede conferma ${language}`, async ({
      page,
      context,
      baseURL,
      browserName,
    }, testInfo) => {
      const it = language === "it";
      const prefix = it ? "" : "/en";
      const id = `free-store-${language}-${browserName}-${testInfo.retry}`;
      await useLocalAccount(context, "member", baseURL!, id);
      await page.goto(`${prefix}/app/negozi`);
      const paused = it ? "In pausa per il piano Free" : "Paused on the Free plan";
      const row = (name: string) =>
        page.getByRole("table", { name: it ? "Elenco negozi" : "Store list" }).getByRole("row", {
          name: new RegExp(name, "u"),
        });
      await expect(row("Negozio secondario")).toContainText(paused);
      await expect(row("Negozio principale")).not.toContainText(paused);
      await page.goto(`${prefix}/app/negozi/${id}-2`);
      const choose = it ? "Scegli il negozio attivo" : "Choose the active store";
      await page.getByRole("dialog").getByRole("link", { name: choose }).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/app/impostazioni/piano$`, "u"));
      const selection = page.getByRole("combobox", { name: choose });
      await expect(selection).toContainText("Negozio principale");
      await selection.click();
      await page.getByRole("option", { name: "Negozio secondario" }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText(
        it ? "Negozio principale va in pausa" : "Negozio principale will be paused",
      );
      await confirm.getByRole("button", { name: it ? "Rendi attivo" : "Make active" }).click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: it ? "Negozio attivo aggiornato." : "Active store updated." }),
      ).toBeVisible();
      // Dopo la sostituzione la prossima attende 90 giorni.
      await expect(selection).toBeDisabled();
      await expect(
        page.getByText(
          it
            ? /^Potrai sostituire il negozio attivo dal /
            : /^You can replace the active store from /,
        ),
      ).toBeVisible();
      await page.goto(`${prefix}/app/negozi`);
      await expect(row("Negozio principale")).toContainText(paused);
      await expect(row("Negozio secondario")).not.toContainText(paused);
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
    { account: "switching", scenario: "cambio-rinnovo" },
    { account: "cancelled", scenario: "rinnovo-disdetto" },
    { account: "pending", scenario: "pagamento-in-attivazione" },
    { account: "lapsed", scenario: "rinnovo-non-riuscito" },
    { account: "scheduled", scenario: "prova-con-abbonamento" },
    { account: "scheduled-cancelled", scenario: "prova-con-abbonamento-disdetto" },
    { account: "refunded", scenario: "pagamento-rimborsato" },
  ] as const;

  // Negli stati in attesa anche gli Ordini non propongono la prova.
  test.describe("ordini", () => {
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
            switching: {
              title: it ? "Premium mensile" : "Premium, monthly",
              text: it ? "come annuale" : "as annual",
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
            scheduled: {
              title: it ? "Prova Premium" : "Premium trial",
              text: it
                ? "Alla fine Premium continua con il primo addebito."
                : "When it ends, Premium continues with the first charge.",
            },
            // Disdetto durante la prova: nessun addebito e ritorno al Free alla fine.
            "scheduled-cancelled": {
              title: it ? "Prova Premium" : "Premium trial",
              text: it ? "Premium mensile disdetto" : "Premium, monthly cancelled",
            },
            // Periodo rimborsato: Free subito, Premium torna con il rinnovo.
            refunded: {
              title: "Free",
              text: it
                ? "Premium riprende con il rinnovo del"
                : "Premium resumes with the renewal on",
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
            // Il passaggio a vita aspetta un primo pagamento ancora da confermare; in locale l'area
            // reale non ha la chiave Stripe e non mostra acquisti.
            if (surface === "preview")
              await expect(
                section.getByRole("button", { name: it ? "Scegli a vita" : "Choose lifetime" }),
              ).toHaveCount(account === "pending" ? 0 : 1);
            await section.screenshot({
              path: test.info().outputPath(`subscription-${account}-${surface}-${language}.png`),
            });
          };
          await useLocalAccount(context, "member", baseURL!, `subscription-${account}`);
          await page.goto(`${prefix}/app/impostazioni/piano`);
          await check(page, "real");
          if (account === "pending" || account === "lapsed" || account === "refunded") {
            await page.goto(`${prefix}/app/ordini`);
            await expect(
              page.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
            ).toHaveCount(0);
          }
          // L'anteprima in un contesto proprio, anonimo e senza la sessione dell'area reale.
          const preview = await browser.newContext({ baseURL });
          try {
            watchNetwork(preview);
            const previewPage = await preview.newPage();
            await open(previewPage, `${prefix}/anteprima/impostazioni/piano`, scenario);
            await check(previewPage, "preview");
          } finally {
            await preview.close();
          }
        });
  });

  // Il lifetime rimborsato riporta al Free: il posto resta occupato e non torna in vendita
  // allo spazio, mentre mensile e annuale sì.
  for (const language of ["it", "en"] as const)
    test(`area reale e anteprima spiegano il lifetime rimborsato, ${language}`, async ({
      page,
      context,
      browser,
      baseURL,
    }) => {
      const it = language === "it";
      const prefix = it ? "" : "/en";
      const check = async (target: Page, surface: "real" | "preview") => {
        const section = target.getByRole("region", {
          name: it ? "Piano e pagamenti" : "Plan and billing",
        });
        await expect(section.getByText("Free", { exact: true })).toBeVisible();
        await expect(section).toContainText(
          it
            ? "Il pagamento di Premium a vita è stato rimborsato"
            : "The lifetime Premium payment was refunded",
        );
        await expect(
          section.getByRole("button", { name: it ? "Scegli a vita" : "Choose lifetime" }),
        ).toHaveCount(0);
        // La prova mai usata resta disponibile su entrambe le superfici.
        await expect(
          section.getByRole("button", { name: it ? "Attiva la prova" : "Start trial" }),
        ).toBeVisible();
        // In locale l'area reale non ha la chiave Stripe e non mostra acquisti.
        if (surface === "preview")
          await expect(
            section.getByRole("button", { name: it ? "Scegli mensile" : "Choose monthly" }),
          ).toBeVisible();
        await section.screenshot({
          path: test.info().outputPath(`lifetime-refunded-${surface}-${language}.png`),
        });
      };
      await useLocalAccount(context, "member", baseURL!, "lifetime-refunded");
      await page.goto(`${prefix}/app/impostazioni/piano`);
      await check(page, "real");
      const preview = await browser.newContext({ baseURL });
      try {
        watchNetwork(preview);
        const previewPage = await preview.newPage();
        await open(previewPage, `${prefix}/anteprima/impostazioni/piano`, "lifetime-rimborsato");
        await check(previewPage, "preview");
      } finally {
        await preview.close();
      }
    });
});
