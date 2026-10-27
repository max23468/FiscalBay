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

test("barra del sito, menu su smartphone e lingua sulla stessa pagina", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/prezzi");
  const bar = page.getByRole("banner");
  await expect(bar.getByRole("link", { name: "Prezzi" })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: "Accedi" })).toHaveAttribute("href", "/accesso");
  await bar.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/prezzi$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bar.getByRole("link", { name: "FAQ" })).toBeHidden();
  await bar.getByLabel("Menu").click();
  await bar
    .getByRole("navigation", { name: "Site pages" })
    .getByRole("link", { name: "FAQ" })
    .click();
  await expect(page).toHaveURL(/\/en\/faq$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Frequently asked questions");

  await page.goto("/");
  await page.getByRole("link", { name: "Come funziona" }).click();
  await expect(page).toHaveURL(/\/#come-funziona$/u);
  await expect(page.getByRole("heading", { name: "Come funziona" })).toBeInViewport();
});
