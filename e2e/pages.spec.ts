import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, test } from "@playwright/test";
import { localCookie } from "./local-account";
import { pageCases, knownPagePath } from "./page-cases";
import { testAccount } from "./test-account";

const remote = Boolean(process.env.E2E_BASE_URL);
const production = process.env.E2E_PRODUCTION === "1";
const matrix =
  process.env.E2E_MATRIX === "full"
    ? ([
        { width: 390, scheme: "light" },
        { width: 390, scheme: "dark" },
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
test.afterEach(async ({ context }) => context.unrouteAll({ behavior: "ignoreErrors" }));

for (const scenario of scenarios) {
  for (const { width, scheme } of scenario.endpoint ? [matrix[0]] : matrix) {
    test(
      `${scenario.area}: ${scenario.path} ${scenario.role} ${width}px ${scheme}`,
      { tag: ["@pages", `@pages-${scenario.area}`] },
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
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        if (scenario.role !== "anonymous") {
          if (!remote) {
            const cookie = localCookie(scenario.role, baseURL!);
            const origin = new URL(baseURL!).origin;
            // Il browser non accetta un Cookie iniettato né, in WebKit Linux, un cookie Secure
            // su http: le richieste locali passano dal client HTTP di Playwright con la sessione.
            await context.route(
              (url) => url.origin === origin,
              async (route) =>
                route.fulfill({
                  response: await route.fetch({
                    headers: {
                      ...route.request().headers(),
                      cookie: `${cookie.name}=${cookie.value}`,
                    },
                    maxRedirects: 0,
                  }),
                }),
            );
          } else if (remoteSession) {
            await context.addCookies(remoteSession);
          } else {
            await page.goto("/");
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
          expect(response.status()).toBe(scenario.status);
          expect(await response.json()).toBeNull();
          checked("HTTP e contratto JSON anonimo");
          return;
        }
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error" && !message.text().includes("404"))
            errors.push(message.text());
        });
        const expectedStatus = production && scenario.preview ? 404 : scenario.status;
        // Tornando su una pagina 404 il router richiede di nuovo i suoi dati con lo stesso esito.
        const ownData = `${new URL(scenario.path, baseURL!).pathname.replace(/\/$/u, "")}.data`;
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
        const response = await page.goto(scenario.path);
        expect(response?.status()).toBe(expectedStatus);
        if (scenario.redirect && !(production && scenario.preview))
          expect(new URL(page.url()).pathname).toBe(scenario.redirect);
        else expect(new URL(page.url()).pathname).toBe(new URL(scenario.path, baseURL!).pathname);
        checked("HTTP e percorso/redirect");
        await expect(page).toHaveTitle(/^FiscalBay \| /);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          scenario.path.startsWith("/en") ? "en" : "it",
        );
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        checked("titolo, contenuto e lingua");
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
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
        await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
        expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
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
        checked("tastiera e axe WCAG A/AA");
        if (scenario.role === "admin-verify") {
          await expect(page.getByRole("button", { name: /passkey/i })).toBeVisible();
          checked("secondo fattore richiesto per admin");
        }
        if (scenario.role === "member" && scenario.area === "orders") {
          await expect(page.getByText(testAccount.taxCodes.unlocked).first()).toBeVisible();
          expect(await page.content()).not.toContain(testAccount.taxCodes.locked);
          checked("dato sbloccato presente e dato bloccato assente dall'HTML");
        }
        const before = page.url();
        // La scoperta delle route termina prima di interromperla con un'altra navigazione.
        await page.waitForLoadState("networkidle");
        const reload = await page.reload();
        expect(reload?.status()).toBe(expectedStatus);
        await expect(page.locator("main")).toBeVisible();
        checked("ricarica");
        await page.waitForLoadState("networkidle");
        const home = scenario.path.startsWith("/en") ? "/en" : "/";
        const homeLink = page.locator(`a[href="${home}"]`).first();
        if ((await homeLink.isVisible()) && new URL(before).pathname !== home) {
          await homeLink.click();
          await expect(page).toHaveURL(new URL(home, baseURL!).href);
          await page.waitForLoadState("networkidle");
          await page.goBack();
          await expect(page).toHaveURL(before);
          await page.waitForLoadState("networkidle");
          await page.goForward();
          await expect(page).toHaveURL(new URL(home, baseURL!).href);
          await page.waitForLoadState("networkidle");
          await page.goBack();
          await expect(page).toHaveURL(before);
          await page.waitForLoadState("networkidle");
          checked("navigazione interna, indietro e avanti");
        } else {
          info.annotations.push({
            type: "omission",
            description:
              "Navigazione interna non applicabile: pagina iniziale o collegamento iniziale assente.",
          });
        }
        expect(errors).toEqual([]);
        checked("JavaScript, idratazione e risorse senza errori");
      },
    );
  }
}
