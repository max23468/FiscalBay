import { expect, test } from "@playwright/test";

/*
 * Confronto visivo del campione con catture di riferimento generate in CI.
 * Il rendering dei font cambia fra sistemi operativi: fuori da Linux la
 * prova viene saltata invece di produrre falsi errori.
 */
test.skip(process.platform !== "linux", "Catture di riferimento generate su Linux in CI");

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 1280]) {
    test(`campione ${colorScheme} a ${width} px`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({
        baseURL,
        colorScheme,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      try {
        await page.goto("/design");
        await expect(page.getByRole("radio", { name: "Chiaro", exact: true })).toBeVisible({
          timeout: 20_000,
        });
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`design-${colorScheme}-${width}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.002,
        });
      } finally {
        await context.close();
      }
    });
  }
}
