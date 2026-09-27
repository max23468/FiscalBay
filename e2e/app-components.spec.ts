import { expect, test, type Page } from "@playwright/test";

/*
 * Garanzie del design system verificate sulle schermate reali dell'anteprima:
 * form, conferme, copia, nomi lunghi, pannelli, geometria, stati, temi e
 * movimento ridotto.
 */

async function open(page: Page, path: string, scenario?: string) {
  if (scenario) {
    await page.request.post("/anteprima", {
      form: { scenario, redirectTo: "/anteprima/ordini" },
      maxRedirects: 0,
    });
  }
  await page.goto(path);
  // Con un pannello aperto il resto della pagina è inerte: si attende il controllo per id.
  await expect(page.locator("#preview-scenario")).toBeEnabled({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

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

test("copia fallita visibile e recupero con un nuovo tentativo", async ({ page }) => {
  await open(page, "/anteprima/ordini");
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
  const card = page.getByRole("article", { name: "Ordine 27-10293-84756" });
  const copy = card.getByRole("button", {
    name: "Copia Codice Fiscale: ordine 27-10293-84756",
    exact: true,
  });
  await copy.click();
  await expect(card.getByText(/^Copia non riuscita\./)).toBeVisible();
  await copy.click();
  await expect(page.locator("html")).toHaveAttribute("data-copied", "RSSMRA80A41H501U");
  await expect(card.getByText(/^Copia non riuscita\./)).toHaveCount(0);
  await expect(copy).toHaveAttribute("data-state", "copied");
});

for (const locale of ["it", "en"] as const) {
  test(`nomi lunghi nel filtro dei negozi su touch, ${locale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      colorScheme: "dark",
    });
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

test("pannello di dettaglio scorrevole con chiusura raggiungibile", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 260 });
  await open(page, "/anteprima/ordini/ord-01");
  const dialog = page.getByRole("dialog");
  const source = dialog.getByText(/^Fonte: eBay/);
  await source.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport({ ratio: 1 });
  const close = dialog.getByRole("button", { name: "Chiudi", exact: true });
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/anteprima\/ordini$/u);
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

test("stati senza valore senza Copia, lucchetto e Premium distinti", async ({ page }) => {
  await open(page, "/anteprima/ordini");
  for (const id of ["19-00001-99999", "31-77421-10058", "05-55555-12121"]) {
    const card = page.getByRole("article", { name: `Ordine ${id}` });
    await expect(card.getByRole("button", { name: /^Copia / })).toHaveCount(0);
  }
  const locked = page.getByRole("article", { name: "Ordine 05-55555-12121" });
  await expect(locked.locator(".lucide-lock")).toHaveCount(1);
  await expect(locked.locator(".lucide-sparkles")).toHaveCount(0);
  await open(page, "/anteprima/impostazioni/esportazione");
  await expect(page.getByText("Premium", { exact: true }).locator("svg")).toHaveClass(
    /lucide-sparkles/,
  );
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

test("superfici nei due temi", async ({ page }) => {
  for (const [scheme, background, card, panel] of [
    ["light", "rgb(245, 247, 250)", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
    ["dark", "rgb(18, 20, 24)", "rgb(28, 31, 37)", "rgb(36, 40, 48)"],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, "/anteprima/ordini/ord-02");
    await expect(page.locator("body")).toHaveCSS("background-color", background);
    await expect(page.locator("article").first()).toHaveCSS("background-color", card);
    await expect(page.getByRole("dialog")).toHaveCSS("background-color", panel);
  }
});

test("movimento ridotto: dato intero e nuovi ordini senza animazione", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/anteprima/ordini");
  await page
    .getByRole("article", { name: "Ordine 05-55555-12121" })
    .getByRole("button", { name: "Sblocca ordine" })
    .click();
  const value = page.getByText("BNCLCU75C12F205X", { exact: true });
  await expect(value).toBeVisible();
  await expect(value).toHaveCSS("animation-name", "none");
  await expect(value).toHaveCSS("filter", "none");

  // In cima alla lista i nuovi ordini entrano subito, senza pulsante.
  await open(page, "/anteprima/ordini", "aggiornamento");
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
