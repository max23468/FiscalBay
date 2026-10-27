import { noPageOverflow, open } from "./components";
import { expect, networkIdle, test, watchNetwork } from "./fixtures";
import { useLocalAccount, localPassword } from "./local-account";
import { testAccount } from "./test-account";

test.describe("area reale", () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    "Prove con dati sintetici soltanto sul database locale.",
  );

  // Sicurezza e passkey sono una categoria delle Impostazioni.
  test.describe("impostazioni", () => {
    for (const language of ["it", "en"] as const) {
      const prefix = language === "it" ? "" : "/en";
      const it = language === "it";
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
        await confirm
          .getByRole("button", { name: it ? "Conferma" : "Confirm", exact: true })
          .click();
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
        // Con la password giusta la conferma apre una sessione nuova e la modifica riparte da sola.
        await page
          .getByRole("button", { name: it ? "Invia il link" : "Send the link", exact: true })
          .click();
        await expect(confirm).toBeVisible();
        await confirm.getByLabel("Password", { exact: true }).fill(localPassword);
        await confirm
          .getByRole("button", { name: it ? "Conferma" : "Confirm", exact: true })
          .click();
        // L'esito arriva con l'indirizzo, che la pagina ripulisce subito dopo averlo mostrato.
        await expect(confirm).toHaveCount(0);
        await expect(
          page.getByText(
            it
              ? "Controlla la posta e apri il link per confermare il nuovo indirizzo."
              : "Check your inbox and open the link to confirm the new address.",
          ),
        ).toBeVisible();
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
      await expect(
        methods.getByText("Questo è il tuo unico metodo", { exact: false }),
      ).toBeVisible();
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
      await networkIdle(page);
      await row.getByRole("button", { name: "Rimuovi", exact: true }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Rimuovi", exact: true })
        .click();
      await expect(row).toHaveCount(0);
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
      await networkIdle(page);
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
      await networkIdle(page);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await noPageOverflow(page)).toBe(true);
      await renamed.getByRole("button", { name: "Rimuovi", exact: true }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Rimuovi", exact: true })
        .click();
      await expect(renamed).toHaveCount(0);
      await expect(
        methods.getByText("Questo è il tuo unico metodo", { exact: false }),
      ).toBeVisible();
    });
  });

  // La scheda revocata attraversa anche Sicurezza e profilo nelle Impostazioni.
  test.describe("impostazioni e profilo", () => {
    test("passkey non supportata e scheda revocata si aggiornano senza ricarica manuale", async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({ baseURL });
      watchNetwork(context);
      try {
        const page = await context.newPage();
        await page.goto("/accesso");
        // Prima dell'idratazione il pulsante passkey non ha ancora il gestore che mostra l'avviso.
        await networkIdle(page);
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
        const email = form.getByRole("textbox", { name: "Email", exact: true });
        const password = form.getByRole("textbox", { name: "Password", exact: true });
        // Una password errata resta sul modulo con l'email già scritta e la password vuota.
        await email.fill(testAccount.email);
        await password.fill(`${localPassword}-errata`);
        await form.getByRole("button", { name: "Accedi", exact: true }).click();
        await expect(page.getByText("Controlla email e password.")).toBeVisible();
        await expect(page).toHaveURL(/\/accesso$/);
        await expect(email).toHaveValue(testAccount.email);
        await expect(password).toHaveValue("");
        await password.fill(localPassword);
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
});

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
      await networkIdle(page);
      await expect(page).toHaveTitle(
        language === "it" ? "FiscalBay | Accedi" : "FiscalBay | Sign in",
      );
      const legal = page.getByRole("navigation", {
        name: language === "it" ? "Documenti legali" : "Legal documents",
      });
      await expect(legal.getByRole("link")).toHaveCount(3);
      // Il footer resta su una riga per elemento anche sugli smartphone più stretti.
      if (width === 500) {
        await page.setViewportSize({ width: 360, height: 666 });
        const footer = page.locator("footer");
        const lines = await footer
          .locator("p, nav")
          .evaluateAll((elements) =>
            elements.map((element) =>
              Math.round(
                element.getBoundingClientRect().height /
                  parseFloat(getComputedStyle(element).lineHeight),
              ),
            ),
          );
        expect(lines).toEqual([1, 1, 1, 1]);
        await page.setViewportSize({ width, height: 666 });
      }
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
      // Termini e Privacy sono pagine del sito, con la sua barra e l'operatore (D217).
      for (const path of ["/termini", "/privacy"]) {
        await page.goto(`${prefix}${path}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(
          page
            .getByRole("banner")
            .getByRole("link", {
              name: language === "it" ? "Accedi" : "Sign in",
              // Sotto i 768 px l'azione sta nel menu chiuso.
              includeHidden: true,
            })
            .first(),
        ).toHaveAttribute("href", `${prefix}/accesso`);
        const main = page.locator("main");
        await expect(main).toContainText("Temisfera");
        // Il contatto è `info@`, non l'assistenza clienti.
        await expect(main.getByRole("link", { name: /^info@/u })).toBeVisible();
        await expect(main).not.toContainText("bozza-2026");
        await expect(main).toContainText(
          language === "it" ? "28 settembre 2026" : "28 September 2026",
        );
        await expect.poll(() => noPageOverflow(page)).toBe(true);
      }
      // La pagina d'errore dell'accesso resta una scheda vicino al logo.
      await page.goto(`${prefix}/auth/error`);
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

// Sicurezza è una categoria delle Impostazioni.
test.describe("impostazioni", () => {
  test("sicurezza nell'anteprima senza JavaScript resta simulata", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(new URL(request.url()).pathname);
    });
    try {
      await page.goto("/anteprima/impostazioni/sicurezza");
      await expect(
        page.getByRole("button", { name: "Cambia password", exact: true }),
      ).toBeVisible();
      await expect(page.locator('form[action="/accesso"]')).toHaveCount(0);
      await page.getByRole("button", { name: "Cambia password", exact: true }).click();
      // Il pulsante resta visibile anche prima dell'invio: si attende la richiesta registrata.
      await expect.poll(() => posts).toEqual(["/anteprima/impostazioni/sicurezza"]);
      await expect(
        page.getByRole("button", { name: "Cambia password", exact: true }),
      ).toBeVisible();
      // Come nell'area reale l'esito torna nell'indirizzo della Sicurezza.
      await expect(page).toHaveURL(/\/anteprima\/impostazioni\/sicurezza\?accesso=password-link$/);
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
      const removed = it ? "Metodo di accesso rimosso." : "Sign-in method removed.";
      for (const [label, intent, field, value, notice] of [
        [
          it ? "Email e password" : "Email and password",
          "rimuovi-metodo",
          "metodo",
          "password",
          removed,
        ],
        ["Google", "rimuovi-metodo", "metodo", "google", removed],
        [
          "Passkey",
          "passkey-remove",
          "id",
          "preview-passkey",
          it ? "Passkey rimossa." : "Passkey removed.",
        ],
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
        expect(posts.at(-1)!.path).toBe(`${prefix}/anteprima/impostazioni/sicurezza`);
        expect(posts.at(-1)!.fields.get("intent")).toBe(intent);
        expect(posts.at(-1)!.fields.get(field)).toBe(value);
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText(notice!, { exact: true })).toBeVisible();
        // Dopo l'idratazione l'esito esce dall'indirizzo e i pulsanti rispondono di nuovo.
        await expect(page).toHaveURL(new RegExp(`${prefix}/anteprima/impostazioni/sicurezza$`));
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
      await networkIdle(page);

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
          it
            ? "Facoltativo. Compare nelle email di servizio."
            : "Optional. Shown in service emails.",
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
});

const supportAddress = ["supporto", "fiscalbay.it"].join("@");

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
      watchNetwork(context);
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
        // Anche il footer porta l'indirizzo: l'avviso è il collegamento con il suo invito.
        await expect(
          page.getByRole("link", {
            name: new RegExp(
              `${language === "it" ? "Contatta il supporto" : "Contact support"}: ${supportAddress}`,
            ),
          }),
        ).toBeVisible();
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
        await networkIdle(page);
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

for (const language of ["it", "en"] as const) {
  test(`errori dei campi di accesso e registrazione accanto al campo, ${language}`, async ({
    page,
  }) => {
    const it = language === "it";
    await page.goto(it ? "/accesso" : "/en/accesso");
    await networkIdle(page);
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
