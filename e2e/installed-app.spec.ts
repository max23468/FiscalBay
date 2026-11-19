import { inflateSync } from "node:zlib";

import type { Page } from "@playwright/test";

import { expect, localOnly, networkIdle, test } from "./fixtures";
import { bellName, whatsNewUnread } from "./page-cases";

/*
 * App installabile: manifest, installabilità secondo Chromium, pagina offline del service worker e
 * badge dell'icona. Le funzioni dell'app installata esistono soltanto nei browser Chromium.
 */

/** Larghezza e altezza di un PNG, dall'intestazione del file. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Il PNG non ha trasparenze: un'icona maskable riempie tutto il quadrato. */
function opaquePng(bytes: Buffer) {
  // Tipo di colore 2 (RGB) oppure 6 (RGBA) con ogni alfa a 255.
  const colorType = bytes[25];
  if (colorType === 2) return true;
  if (colorType !== 6) return false;
  const chunks: Buffer[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString("latin1", at + 4, at + 8) === "IDAT")
      chunks.push(bytes.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const { width } = pngSize(bytes);
  const pixels = inflateSync(Buffer.concat(chunks));
  const row = width * 4 + 1;
  for (let at = 0; at < pixels.length; at += row)
    for (let alpha = at + 4; alpha < at + row; alpha += 4) if (pixels[alpha] !== 255) return false;
  return true;
}

test.describe("app installabile", () => {
  test("manifest nelle due lingue, con icone e schermate alle misure dichiarate", async ({
    request,
  }) => {
    for (const [path, language, start] of [
      ["/site.webmanifest", "it", "/"],
      ["/en/site.webmanifest", "en", "/en"],
    ] as const) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/manifest+json");
      const manifest = await response.json();
      expect(manifest).toMatchObject({
        id: "/",
        name: "FiscalBay",
        lang: language,
        start_url: start,
        scope: "/",
        display: "standalone",
      });
      expect(manifest.shortcuts.map(({ url }: { url: string }) => url)).toEqual(
        language === "it"
          ? ["/app/ordini", "/app/negozi", "/app/impostazioni"]
          : ["/en/app/orders", "/en/app/stores", "/en/app/settings"],
      );
      for (const icon of manifest.icons) {
        const image = await request.get(icon.src);
        expect(image.status(), icon.src).toBe(200);
        const bytes = await image.body();
        const { width, height } = pngSize(bytes);
        expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
        if (icon.purpose === "maskable") expect(opaquePng(bytes), icon.src).toBe(true);
      }
      for (const screenshot of manifest.screenshots) {
        const image = await request.get(screenshot.src);
        expect(image.status(), screenshot.src).toBe(200);
        expect(image.headers()["content-type"]).toBe(screenshot.type);
      }
    }
  });

  test("Chromium la considera installabile, nelle due lingue", async ({
    page,
    browserName,
    browserErrors,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Non applicabile: WebKit non espone i controlli di installabilità delle web app.",
    );
    const session = await page.context().newCDPSession(page);
    for (const path of ["/", "/en"]) {
      await page.goto(path);
      await networkIdle(page);
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
        "href",
        path === "/" ? "/site.webmanifest" : "/en/site.webmanifest",
      );
      const { installabilityErrors } = await session.send("Page.getInstallabilityErrors");
      expect(installabilityErrors).toEqual([]);
    }
    expect(browserErrors).toEqual([]);
  });

  test.describe("service worker", () => {
    test.use({ serviceWorkers: "allow" });

    /** Pagina controllata dal worker attivo, come alla seconda visita. */
    async function controlled(page: Page, path: string) {
      await page.goto(path);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    }

    test("senza rete la navigazione mostra la pagina offline, e Riprova riapre la pagina", async ({
      page,
      context,
      browserName,
      browserErrors,
    }) => {
      test.skip(
        browserName !== "chromium",
        "Non applicabile: Playwright simula l'assenza di rete del service worker soltanto in Chromium.",
      );
      await controlled(page, "/prezzi");
      await context.setOffline(true);
      await page.goto("/faq").catch(() => undefined);
      await expect(page).toHaveTitle("Sei offline | FiscalBay");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sei offline");
      const retry = page.getByRole("link", { name: "Riprova" });
      await expect(retry).toHaveAttribute("href", /\/faq$/u);
      await page.goto("/en/pricing").catch(() => undefined);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("You’re offline");
      await page.goBack();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sei offline");
      await context.setOffline(false);
      await page.getByRole("link", { name: "Riprova" }).click();
      await expect(
        page.getByRole("heading", { name: "Domande frequenti", level: 1 }),
      ).toBeVisible();
      // Gli invii dei moduli e le altre richieste non passano dal worker: nessuna violazione CSP.
      expect(browserErrors).toEqual([]);
    });
  });

  test.describe("area reale", () => {
    localOnly();

    test("«Installa l'app» apre le istruzioni in Safari", async ({
      page,
      browserName,
      localIdentity,
    }) => {
      test.skip(
        browserName !== "webkit",
        "Non applicabile: le istruzioni servono soltanto dove Safari non propone l'installazione.",
      );
      expect(localIdentity.token).toBeTruthy();
      await page.goto("/app/ordini");
      await networkIdle(page);
      // WebKit si presenta come Safari per Mac: la voce c'è senza alcuna offerta del browser.
      await page.getByRole("button", { name: "Account" }).click();
      await page.getByRole("menu").getByRole("menuitem", { name: "Installa l’app" }).click();
      const guide = page.getByRole("dialog", { name: "Installa l’app" });
      await expect(guide).toContainText("Nel menu Archivio di Safari scegli «Aggiungi al Dock».");
      // Il dialog nativo è modale: il focus resta dentro e Esc lo chiude come il pulsante.
      await page.keyboard.press("Escape");
      await expect(guide).toBeHidden();
      await page.getByRole("button", { name: "Account" }).click();
      await page.getByRole("menu").getByRole("menuitem", { name: "Installa l’app" }).click();
      await guide.getByRole("button", { name: "Chiudi" }).click();
      await expect(guide).toBeHidden();
    });

    test("«Installa l'app» compare con l'offerta del browser e la apre una volta", async ({
      page,
      browserName,
      localIdentity,
    }) => {
      test.skip(
        browserName !== "chromium",
        "Non applicabile: soltanto Chromium offre l'installazione alla pagina.",
      );
      expect(localIdentity.token).toBeTruthy();
      await page.goto("/app/ordini");
      await networkIdle(page);
      const account = page.getByRole("button", { name: "Account" });
      const menu = page.getByRole("menu");
      const install = menu.getByRole("menuitem", { name: "Installa l’app" });
      /** Menu aperto e completo: l'ultima voce è sempre «Esci». */
      const openMenu = async () => {
        await expect(menu).toBeHidden();
        await account.click();
        await expect(menu.getByRole("menuitem", { name: "Esci" })).toBeVisible();
      };
      await openMenu();
      await expect(install).toHaveCount(0);
      await page.keyboard.press("Escape");
      // Chrome ed Edge offrono l'installazione con questo evento; qui lo si simula.
      await page.evaluate(() => {
        const offer = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: async () => void Object.assign(window, { installPrompted: true }),
        });
        window.dispatchEvent(offer);
      });
      await openMenu();
      await install.click();
      expect(await page.evaluate(() => "installPrompted" in window)).toBe(true);
      // L'offerta vale una volta: la voce sparisce finché il browser non la ripropone.
      await openMenu();
      await expect(install).toHaveCount(0);
    });

    test("riporta le notifiche da leggere della campanella e sparisce all'uscita", async ({
      page,
      request,
      // Account e sessione sintetici, eliminati alla fine della prova.
      localIdentity,
    }) => {
      expect(localIdentity.token).toBeTruthy();
      // Il browser mostra il badge soltanto all'app installata: qui si registrano le chiamate.
      await page.addInitScript(() => {
        const calls: (number | null)[] = [];
        Object.assign(window, { badgeCalls: calls });
        Object.assign(navigator, {
          setAppBadge: async (count: number) => void calls.push(count),
          clearAppBadge: async () => void calls.push(null),
        });
      });
      const badge = () =>
        page.evaluate(() =>
          (window as unknown as { badgeCalls: (number | null)[] }).badgeCalls.at(-1),
        );
      await page.goto("/app/ordini");
      await networkIdle(page);
      await expect(page.getByRole("button", { name: bellName("it", 0) })).toBeVisible();
      await expect.poll(badge).toBe(whatsNewUnread > 0 ? whatsNewUnread : null);
      // Il numero letto dal service worker ad app chiusa è lo stesso; senza sessione non c'è.
      const unread = await page.evaluate(async () => (await fetch("/api/v1/notifications")).json());
      expect(unread).toEqual({ unread: whatsNewUnread });
      expect((await request.get("/api/v1/notifications")).status()).toBe(401);

      await page.getByRole("button", { name: "Account" }).click();
      await page.getByRole("menuitem", { name: "Esci" }).click();
      // L'uscita porta al sito e svuota la memoria del sito, con il segno del badge.
      await expect(page).toHaveURL(/\/$/u);
      await expect.poll(badge).toBe(null);
    });
  });
});
