import type { Page } from "@playwright/test";
import { expect, networkIdle } from "./fixtures";
import { useLocalAccount } from "./local-account";
import { testAccount } from "./test-account";

/*
 * Garanzie del design system verificate sulle schermate reali dell'anteprima:
 * form, conferme, copia, nomi lunghi, pannelli, geometria, stati, temi e
 * movimento ridotto. Qui gli aiuti condivisi dalle spec delle aree.
 */

export async function open(page: Page, path: string, scenario?: string) {
  await page.bringToFront();
  if (scenario) {
    await page.request.post("/anteprima", {
      form: { scenario, redirectTo: "/anteprima/ordini" },
      maxRedirects: 0,
    });
  }
  await page.goto(path);
  // Con un pannello aperto il resto della pagina è inerte: si attende il controllo per id.
  if (path.includes("/anteprima"))
    await expect(page.locator("#preview-scenario")).toBeEnabled({ timeout: 20_000 });
  await expect(
    page.getByRole("searchbox", { name: /Cerca ordini|Search orders/u, includeHidden: true }),
  ).toBeEnabled();
  await networkIdle(page);
  await page.evaluate(() => document.fonts.ready);
  const section = /\/impostazioni\/([^/?#]+)/u.exec(path)?.[1];
  if (section) {
    // La route deve avere allineato davvero la sezione, anche con hydration differita.
    await expect(page.locator(`#settings-${section}`)).toBeInViewport({ ratio: 1 });
  }
}

/**
 * Le garanzie dei componenti già presenti nell'area reale valgono anche sulle sue route, con la
 * sessione e gli ordini sintetici del database locale.
 */
export const areas = [
  {
    name: "anteprima",
    base: "/anteprima",
    detail: "ord-02",
    copied: { id: "27-10293-84756", value: "RSSMRA80A41H501Y" },
  },
  {
    name: "area reale",
    base: "/app",
    detail: "collaudo-ordine-sbloccato",
    copied: { id: testAccount.orders.unlocked, value: testAccount.taxCodes.unlocked },
  },
] as const;

export async function enter(page: Page, baseURL: string, area: (typeof areas)[number]) {
  if (area.base === "/app") await useLocalAccount(page.context(), "member", baseURL);
}

export const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
