import { expect, test } from "./fixtures";

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

test("barra del sito su due righe da smartphone e lingua sulla stessa pagina", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/prezzi");
  const bar = page.getByRole("banner");
  await expect(bar.getByRole("link", { name: "Prezzi" })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: "Accedi" })).toHaveAttribute("href", "/accesso");
  await bar.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/prezzi$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");

  // Sotto i 768 px le pagine stanno in una seconda riga sempre visibile, senza menu da aprire.
  await page.setViewportSize({ width: 360, height: 780 });
  const pages = bar.getByRole("navigation", { name: "Site pages" });
  await expect(pages.getByRole("link")).toHaveText(["Features", "Pricing", "Security", "FAQ"]);
  await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Italiano" })).toHaveText("IT");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await pages.getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL(/\/en\/faq$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Frequently asked questions");

  await page.goto("/");
  await page.getByRole("link", { name: "Come funziona" }).click();
  await expect(page).toHaveURL(/\/#come-funziona$/u);
  await expect(page.getByRole("heading", { name: "Come funziona" })).toBeInViewport();
});

test("le pagine del sito mostrano le schermate reali nel tema e nella lingua della pagina", async ({
  page,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/funzionalita");
    const card = page.getByRole("img", { name: /order card/u });
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() => card.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toMatch(new RegExp(`/site/scheda-en-${scheme}\\.webp$`, "u"));
    // Sotto i 640 px la home usa la schermata degli Ordini per smartphone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const hero = page.getByRole("img", { name: /Elenco Ordini/u });
    await expect
      .poll(() => hero.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toMatch(new RegExp(`/site/ordini-mobile-it-${scheme}\\.webp$`, "u"));
  }
});
