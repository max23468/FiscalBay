import type { BrowserContext, Page } from "@playwright/test";
import { expect, networkIdle, test } from "./fixtures";
import { useLocalAccount } from "./local-account";
import { testAccount } from "./test-account";

/*
 * Garanzie del design system verificate sulle schermate reali dell'anteprima:
 * form, conferme, copia, nomi lunghi, pannelli, geometria, stati, temi e
 * movimento ridotto. Qui gli aiuti condivisi dalle spec delle aree.
 */

/**
 * Sceglie lo scenario dell'anteprima come il selettore della pagina. Il modulo dichiara la
 * propria origine, come il browser: le action dell'anteprima rifiutano gli altri siti.
 */
export async function setScenario(page: Page, scenario: string, base = "/anteprima") {
  await page.request.post(base, {
    headers: { origin: new URL(test.info().project.use.baseURL!).origin },
    form: { scenario, redirectTo: `${base}/ordini` },
    maxRedirects: 0,
  });
}

export async function open(page: Page, path = "/anteprima/ordini", scenario?: string) {
  await page.bringToFront();
  if (scenario) await setScenario(page, scenario);
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
    locked: "02-44519-70831",
    copied: { id: "27-10293-84756", value: "RSSMRA80A41H501Y" },
  },
  {
    name: "area reale",
    base: "/app",
    detail: "collaudo-ordine-sbloccato",
    locked: testAccount.orders.locked,
    copied: { id: testAccount.orders.unlocked, value: testAccount.taxCodes.unlocked },
  },
] as const;

/** Nell'area reale la sessione sintetica locale attraversa loader e azioni senza bypass. */
export async function enter(
  context: BrowserContext,
  baseURL: string,
  area: (typeof areas)[number],
) {
  if (area.base === "/app") await useLocalAccount(context, "member", baseURL);
}

/** Elenco con la ricerca: la query va nel corpo e l'indirizzo riceve la sua forma cifrata. */
export async function searched(page: Page, query: string, base = "/anteprima") {
  // L'area reale accetta la ricerca soltanto dalla propria origine.
  const response = await page.request.post(
    base === "/app" ? "/api/v1/orders/search" : `${base}/ricerca`,
    { form: { q: query }, headers: { origin: new URL(page.url()).origin }, maxRedirects: 0 },
  );
  expect(response.status()).toBe(303);
  return response.headers().location!;
}

export const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
