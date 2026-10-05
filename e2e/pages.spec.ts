import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { localCookie } from "./local-account";
import { pageCases } from "./page-cases";
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
for (const scenario of scenarios) {
  for (const { width, scheme } of scenario.endpoint ? [matrix[0]] : matrix) {
    test(
      `${scenario.area}: ${scenario.path} ${scenario.role} ${width}px ${scheme}`,
      { tag: ["@pages", `@pages-${scenario.area}`] },
      async ({ page, context, baseURL, browserName }, info) => {
        // Una prova comprende visita, audit, ricarica e navigazione avanti/indietro.
        test.setTimeout(60_000);
        info.annotations.push(
          { type: "route", description: scenario.pattern },
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
            await context.setExtraHTTPHeaders({ cookie: `${cookie.name}=${cookie.value}` });
          } else {
            await page.goto("/");
            const signIn = page.getByRole("tabpanel", { name: "Accedi" });
            await signIn.getByRole("textbox", { name: "Email" }).fill(testAccount.email);
            await signIn
              .getByRole("textbox", { name: "Password" })
              .fill(process.env.E2E_ACCOUNT_PASSWORD!);
            await signIn.getByRole("button", { name: "Accedi", exact: true }).click();
            await expect(page).toHaveTitle("FiscalBay | Ordini");
          }
        }
        if (scenario.endpoint) {
          const response = await context.request.get(scenario.path);
          expect(response.status()).toBe(scenario.status);
          expect(await response.json()).toBeNull();
          return;
        }
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error" && !message.text().includes("404"))
            errors.push(message.text());
        });
        page.on("response", (response) => {
          if (
            response.request().resourceType() !== "document" &&
            response.status() >= 400 &&
            new URL(response.url()).origin === new URL(baseURL!).origin
          )
            errors.push(`Risorsa ${response.status()}: ${new URL(response.url()).pathname}`);
        });
        const response = await page.goto(scenario.path);
        const expectedStatus = production && scenario.preview ? 404 : scenario.status;
        expect(response?.status()).toBe(expectedStatus);
        if (scenario.redirect && !(production && scenario.preview))
          expect(new URL(page.url()).pathname).toBe(scenario.redirect);
        else expect(new URL(page.url()).pathname).toBe(new URL(scenario.path, baseURL!).pathname);
        await expect(page).toHaveTitle(/^FiscalBay \| /);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          scenario.path.startsWith("/en") ? "en" : "it",
        );
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
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
        expect(
          links.every((href) => href !== null && href !== "" && !href.startsWith("javascript:")),
        ).toBe(true);
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
        if (scenario.role === "admin-verify")
          await expect(page.getByRole("button", { name: /passkey/i })).toBeVisible();
        if (scenario.role === "member" && scenario.area === "orders") {
          await expect(page.getByText(testAccount.taxCodes.unlocked).first()).toBeVisible();
          expect(await page.content()).not.toContain(testAccount.taxCodes.locked);
        }
        const before = page.url();
        // La scoperta delle route termina prima di interromperla con un'altra navigazione.
        await page.waitForLoadState("networkidle");
        const reload = await page.reload();
        expect(reload?.status()).toBe(expectedStatus);
        await expect(page.locator("main")).toBeVisible();
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
        }
        expect(errors).toEqual([]);
      },
    );
  }
}
