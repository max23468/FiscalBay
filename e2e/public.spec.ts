import { webAnalyticsCollector, webAnalyticsScript } from "../app/web-analytics";
import { expect, test, pagePath } from "./fixtures";

test(
  "radice pubblica, accesso e area riservata senza sessione né cache",
  { tag: "@smoke" },
  async ({ request }) => {
    for (const prefix of ["", "/en"]) {
      // Sito e accesso rispondono all'anonimo; nessuna risposta del Worker resta in cache.
      for (const path of [prefix || "/", pagePath(prefix, "/accesso")]) {
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
        "/app/impostazioni/account",
      ]) {
        const response = await request.get(
          `${pagePath(prefix, path)}?redirectTo=https://example.invalid`,
          {
            maxRedirects: 0,
          },
        );
        expect(response.status()).toBe(302);
        expect(response.headers().location).toMatch(
          new RegExp(`^${pagePath(prefix, "/accesso")}(?:\\?|$)`),
        );
        expect(response.headers()["cache-control"]).toBe("no-store");
      }
    }
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
  },
);

test("beacon delle statistiche soltanto sulle pagine pubbliche, ammesso dalla CSP", async ({
  page,
  browserErrors,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Il token sintetico esiste soltanto in locale.");
  const beacon = page.locator(`script[src="${webAnalyticsScript}"]`);
  const loaded = page.waitForResponse(webAnalyticsScript);
  await page.goto("/prezzi");
  expect((await loaded).status()).toBe(200);
  expect(JSON.parse((await beacon.getAttribute("data-cf-beacon")) ?? "{}")).toEqual({
    token: "local-web-analytics-token",
    spa: false,
  });
  // Fuori dalla rete Cloudflare il beacon invia alla raccolta, che la CSP deve ammettere.
  await page.evaluate(
    (collector) => fetch(`${collector}/cdn-cgi/rum`, { method: "POST", mode: "no-cors" }),
    webAnalyticsCollector,
  );
  expect(browserErrors).toEqual([]);
  for (const path of ["/accesso", "/anteprima/ordini"]) {
    await page.goto(path);
    await expect(beacon).toHaveCount(0);
  }
});

test("barra del sito su due righe da smartphone e lingua sulla stessa pagina", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/prezzi");
  const bar = page.getByRole("banner");
  await expect(bar.getByRole("link", { name: "Prezzi" })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: "Accedi" })).toHaveAttribute(
    "href",
    /^\/accesso\?via=direct%3A%2Fprezzi$/u,
  );
  await bar.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/pricing$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");

  // Sotto i 1024 px le pagine stanno in una seconda riga sempre visibile, senza menu da aprire.
  const pages = bar.getByRole("navigation", { name: "Site pages" });
  await page.setViewportSize({ width: 768, height: 900 });
  // Le voci nascoste escono dai ruoli: resta soltanto la seconda riga, sotto il logo. Durante il
  // ridimensionamento le due righe possono essere visibili insieme per un frame.
  await expect(pages).toHaveCount(1);
  await expect.poll(async () => (await pages.boundingBox())?.y).toBeGreaterThan(50);
  await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(pages.getByRole("link")).toHaveText([
    "Features",
    "Pricing",
    "Security",
    "FAQ",
    "Guides",
  ]);
  // «Sign in» e «Start for free» restano a ogni larghezza; la lingua mostra soltanto l'altra.
  await expect(bar.getByRole("link", { name: "Start for free" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Italiano" })).toHaveText("IT");
  await expect(bar.getByRole("link", { name: "English" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Sotto i 360 px la lingua passa nel footer.
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Italiano" })).toBeHidden();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Italiano" })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 780 });
  await pages.getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL(/\/en\/faq$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Frequently asked questions");

  await page.goto("/");
  await page.getByRole("link", { name: "Come funziona" }).click();
  await expect(page).toHaveURL(/\/#come-funziona$/u);
  await expect(page.getByRole("heading", { name: "Come funziona" })).toBeInViewport();
});

test("il documento di ogni pagina resta entro il peso previsto", async ({ request }) => {
  const budgets = [
    { limit: 100, pages: ["/", "/prezzi", "/funzionalita", "/faq"] },
    { limit: 180, pages: ["/anteprima/ordini", "/anteprima/negozi", "/anteprima/impostazioni"] },
  ];
  for (const { limit, pages } of budgets)
    for (const path of pages) {
      const html = await (await request.get(path)).text();
      expect(html.length, path).toBeLessThanOrEqual(limit * 1024);
    }
});

test("font e testi della lingua partono con il documento", async ({ request }) => {
  for (const [path, language] of [
    ["/", "it"],
    ["/en", "en"],
  ] as const) {
    const html = await (await request.get(path)).text();
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="font"[^>]+inter-latin-wght-normal/u);
    expect(html).toMatch(new RegExp(`rel="modulepreload" href="/assets/copy-${language}-`, "u"));
  }
});

test("le Impostazioni portano la categoria aperta e completano le altre nella pagina", async ({
  page,
  request,
}) => {
  const waiting = /class="grid gap-6 min-h-64"/gu;
  const first = await (await request.get("/anteprima/impostazioni")).text();
  expect(first.match(waiting)?.length).toBeGreaterThan(3);
  // Aprendo l'ultima categoria il documento porta anche quelle che la precedono.
  const last = await (await request.get("/anteprima/impostazioni/supporto")).text();
  expect(last.match(waiting)).toBeNull();
  await page.goto("/anteprima/impostazioni");
  await expect(page.locator("section .min-h-64")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Supporto" }).getByRole("textbox")).not.toHaveCount(
    0,
  );
});

test("le pagine del sito mostrano le schermate reali nel tema e nella lingua della pagina", async ({
  page,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/features");
    const card = page.getByRole("img", { name: /order card/u });
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() => card.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toMatch(new RegExp(`/site/scheda-en-${scheme}\\.webp\\?v=\\w+$`, "u"));
    // Sotto i 640 px la home usa la schermata degli Ordini per smartphone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const hero = page.getByRole("img", { name: /Elenco Ordini/u });
    await expect
      .poll(() => hero.evaluate((image: HTMLImageElement) => image.currentSrc))
      // L'immagine del primo schermo arriva in AVIF, con il WebP per i browser che non lo leggono.
      .toMatch(new RegExp(`/site/ordini-mobile-it-${scheme}\\.(?:avif|webp)\\?v=\\w+$`, "u"));
  }
});
