import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/design");
  await expect(page).toHaveTitle("FiscalBay | Design system");
  // Il nome proviene dal collegamento della label completato durante l'idratazione.
  await expect(page.getByRole("radio", { name: "Chiaro", exact: true })).toBeVisible({
    timeout: 20_000,
  });
});

test("errori associati al campo, annullamento e ritorno del focus", async ({ page }) => {
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription(/Inserisci un indirizzo email/);
  const trigger = page
    .getByRole("region", { name: "Dialog e pannello", exact: true })
    .getByRole("button", { name: "Scollega negozio", exact: true });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Annulla", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "Caricamento", exact: true })).toHaveCount(1);
});

test("copia fallita visibile e recupero con un nuovo tentativo", async ({ page }) => {
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
  const sample = page.getByRole("region", { name: "Identità", exact: true });
  const copy = sample.getByRole("button", {
    name: "Copia Codice Fiscale: Maria Rossi",
    exact: true,
  });
  await copy.click();
  await expect(sample.getByText(/^Copia non riuscita\./)).toBeVisible();
  await copy.click();
  await expect(page.locator("html")).toHaveAttribute("data-copied", "RSSMRA80A41H501U");
  await expect(sample.getByText(/^Copia non riuscita\./)).toHaveCount(0);
  await expect(copy).toHaveAttribute("data-state", "copied");
});

for (const locale of ["it", "en"] as const) {
  test(`nomi lunghi e scheda su touch, ${locale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      colorScheme: "dark",
    });
    const mobile = await context.newPage();
    try {
      await mobile.goto(locale === "it" ? "/design" : "/en/design");
      await expect(
        mobile.getByRole("radio", { name: locale === "it" ? "Chiaro" : "Light", exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      const select = mobile.getByRole("combobox", {
        name: locale === "it" ? "Negozio" : "Store",
        exact: true,
      });
      await select.tap();
      const option = mobile.getByRole("option", {
        name: "Outlet ricambi auto e moto d’epoca - magazzino secondario",
        exact: true,
      });
      await expect(option).toBeVisible();
      await expect.poll(() => option.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await option.tap();
      await expect(select).toContainText("magazzino secondario");
      const card = mobile.getByRole("article", {
        name: locale === "it" ? "Scheda ordine" : "Order card",
        exact: true,
      });
      await expect(card).toBeVisible();
      await expect.poll(() => card.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await expect
        .poll(() => mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await expect(mobile.locator("html")).toHaveAttribute("lang", locale);
      const motion = mobile.getByRole("region", {
        name: locale === "it" ? "Movimento" : "Motion",
        exact: true,
      });
      const amount = motion.getByText("€ 49,90", { exact: true });
      await expect(amount).toHaveCSS("white-space", "nowrap");
      await expect.poll(() => motion.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await expect(card).toHaveCSS("box-shadow", "none");
      const empty = mobile.getByRole("region", {
        name: locale === "it" ? "Stati vuoti" : "Empty states",
        exact: true,
      });
      await expect(empty.getByRole("heading", { level: 3 })).toHaveCount(3);
      await expect(empty.getByRole("button")).toHaveCount(3);
      const compact = mobile.getByRole("list", {
        name: locale === "it" ? "Elenco ordini" : "Order list",
        exact: true,
      });
      await expect(compact.getByRole("listitem")).toHaveCount(5);
      await expect.poll(() => compact.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await card.locator("summary").click();
      await expect(
        card.getByText(
          locale === "it" ? "Custodia protettiva e accessori" : "Protective case and accessories",
          { exact: false },
        ),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test("pannello scorrevole e chiusura raggiungibile con poco spazio", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 260 });
  const trigger = page.getByRole("button", { name: "Dettaglio ordine", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const total = dialog.getByText("€ 49,90", { exact: true });
  await total.scrollIntoViewIfNeeded();
  await expect(total).toBeInViewport({ ratio: 1 });
  const close = dialog.getByRole("button", { name: "Chiudi", exact: true });
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const locale of ["it", "en"] as const) {
  test(`geometria del campione e allineamento delle azioni, ${locale}`, async ({ page }) => {
    if (locale === "en") await page.goto("/en/design");
    await page
      .getByRole("radio", { name: locale === "it" ? "Chiaro" : "Light", exact: true })
      .check();
    const list = page.getByRole("list", {
      name: locale === "it" ? "Elenco ordini" : "Order list",
      exact: true,
    });
    const card = page.getByRole("article", {
      name: locale === "it" ? "Scheda ordine" : "Order card",
      exact: true,
    });
    for (const width of [320, 375, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      const fields = list
        .getByRole("button", { name: locale === "it" ? /^Copia / : /^Copy / })
        .locator("..");
      const bounds = await fields.evaluateAll((elements) =>
        elements.map((element) => {
          const field = element.getBoundingClientRect();
          const code = element.querySelector("span")!.getBoundingClientRect();
          const button = element.querySelector("button")!.getBoundingClientRect();
          return {
            x: field.x,
            width: field.width,
            codeRight: code.right,
            buttonLeft: button.left,
            codeMiddle: code.y + code.height / 2,
            buttonMiddle: button.y + button.height / 2,
          };
        }),
      );
      expect(bounds).toHaveLength(2);
      expect(Math.abs(bounds[0].x - bounds[1].x)).toBeLessThan(1);
      expect(Math.abs(bounds[0].width - bounds[1].width)).toBeLessThan(1);
      for (const bound of bounds) {
        expect(bound.codeRight).toBeLessThanOrEqual(bound.buttonLeft);
        expect(Math.abs(bound.codeMiddle - bound.buttonMiddle)).toBeLessThan(1);
      }
      const name = card.locator('[data-slot="card-title"]');
      await expect
        .poll(() => name.evaluate((element) => element.scrollWidth <= element.clientWidth))
        .toBe(true);
      if (width >= 640) {
        const columns = await list
          .locator("li > div:last-child")
          .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().x));
        expect(Math.max(...columns) - Math.min(...columns)).toBeLessThan(1);
      }
      const empty = page.getByRole("region", {
        name: locale === "it" ? "Stati vuoti" : "Empty states",
        exact: true,
      });
      const actions = empty.getByRole("button");
      for (const action of await actions.all()) {
        await expect
          .poll(() =>
            action.evaluate((element) => {
              const box = element.getBoundingClientRect();
              return box.left >= 0 && box.right <= innerWidth;
            }),
          )
          .toBe(true);
      }
    }
  });
}

test("schede verticali: freccia giù, orientamento e pannello", async ({ page }) => {
  const tabs = page.getByRole("tablist", { name: "Schede verticali", exact: true });
  await expect(tabs).toHaveAttribute("aria-orientation", "vertical");
  await tabs.getByRole("tab", { name: "Ordini", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  const stores = tabs.getByRole("tab", { name: "Negozi", exact: true });
  await expect(stores).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(stores).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Negozi", exact: true })).toBeVisible();
});

test("stati fiscali e azioni simulate senza copia su dato assente", async ({ page }) => {
  const card = page.getByRole("article", { name: "Scheda ordine", exact: true });
  const select = page.getByRole("combobox", { name: "Stato del campione", exact: true });
  for (const state of ["Non disponibile su eBay", "Aggiornamento non riuscito", "Da sbloccare"]) {
    await select.click();
    await page.getByRole("option", { name: state, exact: true }).click();
    await expect(card.getByRole("button", { name: /^Copia / })).toHaveCount(0);
  }
  await expect(card).toContainText("2 ordini disponibili");
  await expect(card.locator(".lucide-lock")).toHaveCount(1);
  await expect(card.locator(".lucide-sparkles")).toHaveCount(0);
  await card.getByRole("button", { name: "Sblocca ordine", exact: true }).click();
  await expect(card.getByRole("status").filter({ hasText: "Ti resta 1 ordine" })).toBeVisible();
  await expect(
    card.getByRole("button", {
      name: "Copia Partita IVA: Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(card.getByRole("heading", { name: "Partita IVA", exact: true })).toBeVisible();
});

test("identità: Premium distinto dallo sblocco e superfici nei due temi", async ({ page }) => {
  const states = page.getByRole("region", { name: "Stati", exact: true });
  await expect(states.getByText("Premium", { exact: true }).locator("svg")).toHaveClass(
    /lucide-sparkles/,
  );
  await expect(states.getByText("Da sbloccare", { exact: true }).locator("svg")).toHaveClass(
    /lucide-lock/,
  );
  const surfaces = page.getByRole("region", { name: "Superfici", exact: true });
  for (const theme of ["Chiaro", "Scuro"]) {
    await page.getByRole("radio", { name: theme, exact: true }).check();
    const light = surfaces.getByText("Chiaro · Pagina", { exact: true }).locator("..");
    const dark = surfaces.getByText("Scuro · Pagina", { exact: true }).locator("..");
    await expect(light).toHaveCSS("background-color", "rgb(245, 247, 250)");
    await expect(dark).toHaveCSS("background-color", "rgb(18, 20, 24)");
    await expect(dark.getByText("Contenuto", { exact: true }).locator("..")).toHaveCSS(
      "background-color",
      "rgb(28, 31, 37)",
    );
    await expect(dark.getByText("Dialog e pannelli", { exact: true })).toHaveCSS(
      "background-color",
      "rgb(36, 40, 48)",
    );
  }
  await surfaces.screenshot({ path: "test-results/surfaces.png" });
  await page
    .getByRole("region", { name: "Stati vuoti", exact: true })
    .screenshot({ path: "test-results/empty-states.png" });
});

test("movimento ridotto: dato intero e nuovo ordine senza animazione", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  const value = page.getByText("BNCLCU75C12F205X", { exact: true });
  await expect(value).toBeVisible();
  await expect(value).toHaveCSS("animation-name", "none");
  await expect(value).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "Simula nuovo ordine", exact: true }).click();
  const motion = page.getByRole("region", { name: "Movimento", exact: true });
  const row = motion.getByRole("listitem").filter({ hasText: "31-77421-10058" });
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Mostra il nuovo ordine", exact: true }).click();
  await expect(row).toHaveCSS("opacity", "1");
  await expect(row).toHaveCSS("filter", "none");
  await expect
    .poll(() =>
      row.evaluate((e) => e.getAnimations().filter((a) => a.playState === "running").length),
    )
    .toBe(0);
});

test("copie con nomi distinti nelle righe e dato etichettato per tipo", async ({ page }) => {
  const containers = [
    page.getByRole("list", { name: "Elenco ordini", exact: true }),
    page.getByRole("region", { name: "Tabella", exact: true }),
  ];
  for (const container of containers) {
    const names = await container
      .getByRole("button", { name: /^Copia / })
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(names.length);
  }
  const table = page.getByRole("region", { name: "Tabella", exact: true });
  await expect(
    table.getByRole("button", {
      name: "Copia Partita IVA: Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
      exact: true,
    }),
  ).toBeVisible();
});
