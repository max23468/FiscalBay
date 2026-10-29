import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Response } from "@playwright/test";
import { expect, networkIdle, test } from "./fixtures";
import { useLocalAccount } from "./local-account";
import { abortedDataRequest, pageCases, knownPagePath, expectedPageError } from "./page-cases";
import { testAccount } from "./test-account";

const remote = Boolean(process.env.E2E_BASE_URL);
const production = process.env.E2E_PRODUCTION === "1";
const matrix =
  process.env.E2E_MATRIX === "full"
    ? ([
        { width: 390, scheme: "light" },
        { width: 390, scheme: "dark" },
        { width: 768, scheme: "light" },
        { width: 768, scheme: "dark" },
        { width: 1280, scheme: "light" },
        { width: 1280, scheme: "dark" },
      ] as const)
    : process.env.E2E_MATRIX === "single"
      ? // Dopo il deploy: layout e temi sono già provati sullo stesso artefatto.
        ([{ width: 390, scheme: "dark" }] as const)
      : ([
          { width: 390, scheme: "dark" },
          { width: 1280, scheme: "light" },
        ] as const);

const scenarios = production
  ? pageCases.filter(
      (scenario, index) =>
        !scenario.preview ||
        pageCases.findIndex((entry) => entry.preview && entry.pattern === scenario.pattern) ===
          index,
    )
  : pageCases;
// Sul dominio remoto l'accesso avviene una volta per worker: le visite riusano la sessione,
// l'accesso ripetuto resta provato dalla suite funzionale remota.
let remoteSession: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;

// Le richieste locali ancora intercettate a fine prova non sono errori del collaudo.

for (const scenario of scenarios) {
  for (const { width, scheme } of scenario.endpoint ? [matrix[0]] : matrix) {
    test(
      `${scenario.area}: ${scenario.path} ${scenario.role} ${width}px ${scheme}`,
      { tag: ["@pages", `@pages-${scenario.area}`, ...(scenario.remote ? ["@remote"] : [])] },
      async ({ page, context, baseURL, browserName }, info) => {
        // Una prova comprende visita, audit, ricarica e navigazione avanti/indietro.
        test.setTimeout(60_000);
        const checked = (description: string) =>
          info.annotations.push({ type: "check", description });
        info.annotations.push(
          { type: "route", description: scenario.pattern },
          {
            type: "expected",
            description: `HTTP ${production && scenario.preview ? 404 : scenario.status}; percorso ${scenario.redirect && !(production && scenario.preview) ? scenario.redirect : new URL(scenario.path, baseURL!).pathname}`,
          },
          {
            type: "ambito",
            description: scenario.preview ? "anteprima sintetica" : "pagina reale",
          },
        );
        const admin = scenario.role.startsWith("admin");
        test.skip(
          remote && !production && admin,
          "Non applicabile: sessioni admin sintetiche soltanto nel database locale; MFA remota richiede prova autorizzata.",
        );
        test.skip(
          remote && !production && scenario.role === "member" && !process.env.E2E_ACCOUNT_PASSWORD,
          "Account di collaudo non disponibile: collaudo parziale.",
        );
        test.skip(
          production && scenario.role !== "anonymous",
          "Non applicabile: Production in sola lettura anonima, nessun account sintetico inserito.",
        );
        // Le richieste del collaudo remoto lasciano nei log del Worker le fasi superate; l'header
        // va solo al dominio collaudato, altrove farebbe fallire il preflight CORS.
        if (remote) {
          const origin = new URL(baseURL!).origin;
          await context.route(
            (url) => url.origin === origin,
            (route) =>
              route.continue({
                headers: { ...route.request().headers(), "x-fiscalbay-trace": "1" },
              }),
          );
        }
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        if (scenario.role !== "anonymous") {
          if (!remote) {
            await useLocalAccount(context, scenario.role, baseURL!);
          } else if (remoteSession) {
            await context.addCookies(remoteSession);
          } else {
            await page.goto("/accesso");
            const signIn = page.getByRole("tabpanel", { name: "Accedi" });
            await signIn.getByRole("textbox", { name: "Email" }).fill(testAccount.email);
            await signIn
              .getByRole("textbox", { name: "Password" })
              .fill(process.env.E2E_ACCOUNT_PASSWORD!);
            const started = Date.now();
            const [answer] = await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.request().method() === "POST" &&
                  new URL(response.url()).pathname.endsWith("/accesso"),
                { timeout: 30_000 },
              ),
              signIn.getByRole("button", { name: "Accedi", exact: true }).click(),
            ]);
            await expect(
              page,
              `Accesso: HTTP ${answer.status()} in ${Date.now() - started} ms`,
            ).toHaveTitle("FiscalBay | Ordini", { timeout: 15_000 });
            remoteSession = await context.cookies();
          }
        }
        if (scenario.endpoint) {
          const response = await context.request.get(scenario.path);
          // L'anteprima non esiste in Production, nemmeno con i suoi endpoint.
          expect(response.status()).toBe(production && scenario.preview ? 404 : scenario.status);
          if (scenario.path.endsWith("/robots.txt")) {
            // In produzione chiude l'area riservata con la barra finale, così l'icona
            // `/apple-touch-icon.png` resta raggiungibile; altrove chiude tutto il dominio.
            expect(await response.text()).toMatch(
              production ? /^Disallow: \/app\/$/mu : /^User-agent: \*\nDisallow: \/\n/u,
            );
            checked("HTTP e robots.txt");
            return;
          }
          if (scenario.path.endsWith("/sitemap.xml")) {
            // Pagine canoniche dell'origine dell'app, senza Termini e Privacy `noindex`: la build
            // Production dichiara il proprio dominio anche quando la serve la preview locale.
            expect(response.headers()["content-type"]).toMatch(/^application\/xml/u);
            const xml = await response.text();
            const origin = production ? "https://fiscalbay.it" : baseURL;
            expect(xml).toContain(`<loc>${new URL("/prezzi", origin).href}</loc>`);
            expect(xml).not.toMatch(/termini|privacy/u);
            checked("HTTP e sitemap");
            return;
          }
          if (response.status() === 405) {
            expect(response.headers().allow).toBe("POST");
            checked("HTTP e metodo ammesso");
            return;
          }
          expect(await response.json()).toBeNull();
          checked("HTTP e contratto JSON anonimo");
          return;
        }
        const errors: string[] = [];
        const expectedStatus = production && scenario.preview ? 404 : scenario.status;
        const ownPage = new URL(scenario.path, baseURL!);
        const ownData = `${ownPage.pathname.replace(/\/$/u, "")}.data`;
        page.on("pageerror", (error) => {
          if (!abortedDataRequest(error, ownPage.origin)) errors.push(error.message);
        });
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          if (!expectedPageError(message.text(), message.location().url, expectedStatus, ownPage))
            errors.push(message.text());
        });
        // Tornando su una pagina 404 il router richiede di nuovo i suoi dati con lo stesso esito.
        page.on("response", (response) => {
          const url = new URL(response.url());
          if (
            response.request().resourceType() !== "document" &&
            response.status() >= 400 &&
            url.origin === new URL(baseURL!).origin &&
            !(url.pathname === ownData && response.status() === expectedStatus) &&
            // Cloudflare rifiuta i precaricamenti speculativi verso il Worker: la navigazione
            // reale carica comunque la pagina, quindi il rifiuto non è un errore visibile.
            !response.headers()["cf-speculation-refused"]
          )
            errors.push(`Risorsa ${response.status()}: ${url.pathname}`);
        });
        const documents: Response[] = [];
        page.on("response", (response) => {
          if (response.request().isNavigationRequest() && response.frame() === page.mainFrame())
            documents.push(response);
        });
        const response = await page.goto(scenario.path);
        expect(response?.status()).toBe(expectedStatus);
        if (scenario.redirect && !(production && scenario.preview))
          // In locale, con la sessione, il redirect arriva come navigazione del documento.
          await expect(page).toHaveURL((url) => url.pathname === scenario.redirect);
        else expect(new URL(page.url()).pathname).toBe(new URL(scenario.path, baseURL!).pathname);
        checked("HTTP e percorso/redirect");
        // Ogni documento ha la CSP con il proprio nonce, portato da tutti gli script inline:
        // una violazione comparirebbe anche fra gli errori della console raccolti sopra.
        // In locale il proxy della sessione trasforma un redirect in una pagina che cambia
        // indirizzo: conta l'ultimo documento caricato, non quello restituito da `goto`.
        const policy = (await documents.at(-1)!.allHeaders())["content-security-policy"] ?? "";
        const nonce = /'nonce-([^']+)'/u.exec(policy)?.[1];
        expect(policy).toContain("frame-ancestors 'none'");
        expect(nonce).toBeTruthy();
        const nonces = await page
          .locator("script:not([src]):not([type='application/ld+json'])")
          .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
        expect(nonces.length).toBeGreaterThan(0);
        expect(new Set(nonces)).toEqual(new Set([nonce]));
        checked("CSP e nonce degli script");
        await expect(page).toHaveTitle(/^FiscalBay \| /);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          scenario.path.startsWith("/en") ? "en" : "it",
        );
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        const modal = scenario.dialog && !(production && scenario.preview);
        if (modal) await expect(page.getByRole("dialog")).toBeVisible();
        checked("titolo, contenuto e lingua");
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        // Le immagini sotto la piega si caricano tardi: qui si caricano tutte, così una rotta emerge.
        await page.locator("img").evaluateAll((images) =>
          Promise.all(
            images.map((image) => {
              (image as HTMLImageElement).loading = "eager";
              return (image as HTMLImageElement).decode().catch(() => undefined);
            }),
          ),
        );
        expect(
          await page
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        ).toBe(true);
        const links = await page
          .getByRole("link")
          .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
        // Solo destinazioni navigabili: nessun schema eseguibile o dati incorporati.
        expect(
          links.every(
            (href) =>
              href !== null &&
              href !== "" &&
              ["http:", "https:", "mailto:", "tel:"].includes(new URL(href, page.url()).protocol),
          ),
        ).toBe(true);
        for (const href of links) {
          const url = new URL(href!, page.url());
          if (url.origin === new URL(baseURL!).origin)
            expect(
              knownPagePath(url.pathname),
              `Collegamento interno senza route: ${url.pathname}`,
            ).toBe(true);
        }
        checked("font, layout, immagini e collegamenti interni");
        // I primi elementi raggiunti con la tastiera mostrano il focus: contorno o anello.
        const unmarked: string[] = [];
        for (let stop = 0; stop < 6; stop++) {
          await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
          const focus = await page.evaluate(() => {
            const element = document.activeElement;
            if (!element || element === document.body) return null;
            const style = getComputedStyle(element);
            const outline =
              style.outlineStyle !== "none" &&
              parseFloat(style.outlineWidth) > 0 &&
              !/rgba\([^)]*,\s*0\)|transparent/u.test(style.outlineColor);
            const ring = style.boxShadow !== "none";
            return {
              visible: outline || ring,
              name: `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? ""}`,
            };
          });
          if (stop === 0) expect(focus, "Nessun elemento raggiunto con Tab").not.toBeNull();
          if (!focus) break;
          if (!focus.visible) unmarked.push(focus.name);
        }
        expect(unmarked, "Focus senza indicatore visibile").toEqual([]);
        // Con il movimento ridotto nessuna animazione o transizione dura più di un istante.
        expect(
          await page.evaluate(() =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running")
              .map((animation) => Number(animation.effect?.getComputedTiming().duration ?? 0))
              .filter((duration) => duration > 1),
          ),
          "Animazioni con il movimento ridotto",
        ).toEqual([]);
        checked("focus visibile e movimento ridotto");
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          // Base UI usa sentinelle invisibili role=button per intercettare il cursore
          // VoiceOver in WebKit. Non sono comandi: il nome non descriverebbe un'azione.
          // Si esclude soltanto questa regola sulle sentinelle, mai i comandi reali.
          accessibility.violations
            .map(({ id, nodes }) => ({
              id,
              targets: nodes
                .filter(
                  ({ target }) =>
                    !(
                      browserName === "webkit" &&
                      id === "aria-command-name" &&
                      target.every(
                        (selector) =>
                          typeof selector === "string" &&
                          selector.startsWith("span[") &&
                          selector.includes("[data-base-ui-focus-guard"),
                      )
                    ),
                )
                .map(({ target }) => target),
            }))
            .filter(({ targets }) => targets.length > 0),
        ).toEqual([]);
        checked("axe WCAG 2.2 A/AA");
        if (scenario.role === "admin-verify") {
          await expect(page.getByRole("button", { name: /passkey/i })).toBeVisible();
          checked("secondo fattore richiesto per admin");
        }
        if (scenario.role === "member" && scenario.area === "orders" && scenario.status === 200) {
          await expect(page.getByText(testAccount.taxCodes.unlocked).first()).toBeVisible();
          expect(await page.content()).not.toContain(testAccount.taxCodes.locked);
          checked("dato sbloccato presente e dato bloccato assente dall'HTML");
        }
        const before = page.url();
        // La scoperta delle route termina prima di interromperla con un'altra navigazione.
        await networkIdle(page);
        const reload = await page.reload();
        expect(reload?.status()).toBe(expectedStatus);
        await expect(page.locator("main")).toBeVisible();
        if (modal) await expect(page.getByRole("dialog")).toBeVisible();
        checked("ricarica");
        await networkIdle(page);
        // Con la sessione la radice porta agli Ordini: la pagina iniziale è quella dell'app.
        const prefix = scenario.path.startsWith("/en") ? "/en" : "";
        const home = scenario.role === "anonymous" ? prefix || "/" : `${prefix}/app/ordini`;
        const homeLink = page.locator(`a[href="${home}"]`).first();
        // I pannelli dichiarati dal catalogo coprono i collegamenti sotto: l'assenza prima
        // dell'idratazione non rende navigabile il logo.
        // Gli Ordini aggiungono all'indirizzo soltanto l'istantanea dell'elenco.
        const atHome = (url: URL) =>
          url.pathname === new URL(home, baseURL!).pathname &&
          [...url.searchParams.keys()].every((key) => key === "vista");
        if (!modal && (await homeLink.isVisible()) && new URL(before).pathname !== home) {
          await homeLink.click();
          await expect(page).toHaveURL(atHome);
          await networkIdle(page);
          await page.goBack();
          await expect(page).toHaveURL(before);
          await networkIdle(page);
          await page.goForward();
          await expect(page).toHaveURL(atHome);
          await networkIdle(page);
          await page.goBack();
          await expect(page).toHaveURL(before);
          await networkIdle(page);
          checked("navigazione interna, indietro e avanti");
        } else {
          info.annotations.push({
            type: "omission",
            description:
              "Navigazione interna non applicabile: pagina iniziale, collegamento iniziale assente o coperto da un pannello modale.",
          });
        }
        if (scenario.role === "member" && scenario.area === "orders" && scenario.status === 200) {
          // La barra superiore trova il codice sbloccato e non quello da sbloccare; la query
          // resta fuori dall'indirizzo.
          const searchFor = async (query: string) => {
            const search = page.getByRole("searchbox", { name: /Cerca ordini|Search orders/u });
            // Sugli schermi stretti il campo si apre dal pulsante della barra: un tocco arrivato
            // prima dell'idratazione non apre il foglio, quindi si ripete finché il campo è pronto.
            await expect(async () => {
              if (!(await search.isVisible()))
                await page
                  .getByRole("button", { name: /^(Cerca ordini|Search orders)$/u })
                  .click({ timeout: 2_000 });
              await expect(search).toBeEditable({ timeout: 2_000 });
            }).toPass({ timeout: 20_000 });
            await search.fill(query);
            await search.press("Enter");
          };
          await searchFor(testAccount.taxCodes.unlocked);
          // L'indirizzo cambia dopo due richieste in sequenza, la ricerca e i dati dell'elenco:
          // sul dominio remoto possono superare insieme i 5 secondi predefiniti.
          await expect(page).toHaveURL(/\/app\/ordini\?ricerca=[\w-]+(?:[?&]vista=[0-9a-z]+)?$/u, {
            timeout: 15_000,
          });
          expect(page.url()).not.toContain(testAccount.taxCodes.unlocked);
          await expect(page.getByText(testAccount.taxCodes.unlocked).first()).toBeVisible();
          await searchFor(testAccount.taxCodes.locked);
          await expect(page.getByRole("article")).toHaveCount(0, { timeout: 15_000 });
          expect(page.url()).not.toContain(testAccount.taxCodes.locked);
          checked("ricerca sui soli valori autorizzati, query fuori dall'indirizzo");
        }
        expect(errors).toEqual([]);
        checked("JavaScript, idratazione e risorse senza errori");
      },
    );
  }
}
