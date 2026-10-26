import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers as siteHeaders, loader as loadSite } from "../app/routes/site";
import { loader as loadRobots } from "../app/routes/robots";
import { indexable, isProductionOrigin } from "../app/app-links";
import { appCopy } from "../app/app-copy";
import { formatDate } from "../app/view-models";
import { resetDatabase } from "./fixtures/database-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { accessForm } from "./fixtures/account-route-fixtures";
import { callRoute } from "./fixtures/route-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("radice pubblica e area riservata", () => {
  const root = (path: string, cookie?: string) =>
    callRoute(loadSite, path, { cookie }).catch((thrown: Response) => thrown);

  it("porta agli Ordini ogni utente con la sessione e mostra il sito all'anonimo, senza cache", async () => {
    const first = await verifiedSession("radice-uno@example.invalid");
    const second = await verifiedSession("radice-due@example.invalid");
    // Stesso indirizzo, tre visitatori: la pagina dell'anonimo non contiene dati di account.
    expect(await root("/")).toEqual({
      language: "it",
      signedIn: false,
      origin: "http://localhost:5173",
      baseFreeQuota: 5,
      freePromotion: null,
    });
    expect(await root("/en")).toMatchObject({ language: "en", signedIn: false });
    for (const { cookie } of [first, second]) {
      for (const base of ["", "/en"]) {
        const response = (await root(base || "/", cookie)) as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`${base}/app/ordini`);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    }
    expect(siteHeaders()).toEqual({ "cache-control": "no-store" });
  });

  it("annuncia la promozione Free fino alla sua fine, poi la quota base", async () => {
    await env.DB.prepare(
      `INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
       VALUES ('lancio', '2026-09-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 10, ?1)`,
    )
      .bind(new Date().toISOString())
      .run();
    const promotion = { quota: 10, endsAt: "2026-11-01T00:00:00.000Z" };
    expect(await root("/")).toMatchObject({ freePromotion: promotion });
    const t = appCopy.it.site;
    expect(t.freePromotion(10, formatDate(promotion.endsAt, "it"), 5)).toBe(
      "Promozione Free: 10 ordini da sbloccare ogni 7 giorni nei cicli che iniziano entro il 1 nov 2026, 01:00, poi 5.",
    );
    vi.setSystemTime(new Date(promotion.endsAt));
    expect(await root("/en")).toMatchObject({ baseFreeQuota: 5, freePromotion: null });
  });

  it("visita il sito pubblico mantenendo la sessione e torna all'app senza ciclo", async () => {
    const user = await verifiedSession("radice-visita@example.invalid");
    const session = user.cookie.split(";")[0]!;
    const visit = (await root("/en?visita=1", session)) as Response;
    expect(visit.status).toBe(302);
    expect(visit.headers.get("location")).toBe("/en");
    expect(visit.headers.get("cache-control")).toBe("no-store");
    expect(visit.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=1; Path=/; HttpOnly; SameSite=Lax",
    ]);
    const visiting = `${session}; fiscalbay_visita=1`;
    expect(await root("/en", visiting)).toMatchObject({ language: "en", signedIn: true });
    expect(await root("/", visiting)).toMatchObject({ language: "it", signedIn: true });
    // La scelta di visita senza sessione non apre nulla.
    expect(await root("/", "fiscalbay_visita=1")).toMatchObject({ signedIn: false });

    const back = (await root("/en?visita=0", visiting)) as Response;
    expect(back.headers.get("location")).toBe("/en/app/ordini");
    expect(back.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    ]);
    expect(((await root("/", session)) as Response).headers.get("location")).toBe("/app/ordini");

    // L'uscita riporta al sito pubblico e dimentica la scelta.
    const signOut = await accessForm("/accesso", { intent: "esci" }, visiting);
    expect(signOut.headers.get("location")).toBe("/");
    expect(signOut.headers.getSetCookie()).toContain("fiscalbay_visita=; Path=/; Max-Age=0");
  });

  it("indicizza solo le pagine pubbliche del dominio di produzione", async () => {
    for (const path of ["/", "/en", "/termini", "/en/privacy"]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(true);
      expect(indexable("https://test.fiscalbay.it", path)).toBe(false);
    }
    for (const path of ["/app/ordini", "/en/app/negozi/x", "/accesso", "/admin", "/anteprima"]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(false);
    }
    // Production si riconosce dall'host, non dalla grafia dell'origine. Le varianti si
    // compongono dall'host: nelle fixture compaiono soltanto host ammessi.
    for (const origin of [
      "https://fiscalbay.it",
      "https://fiscalbay.it/",
      "https://FiscalBay.it:443",
      "http://fiscalbay.it",
      ...["www.fiscalbay.it", "fiscalbay.it."].map((host) => `https://${host}`),
    ])
      expect(isProductionOrigin(origin), origin).toBe(true);
    for (const origin of [
      "https://test.fiscalbay.it",
      "http://localhost:5173",
      "https://fiscalbay.it.esempio.invalid",
      "https://esempio.invalid/fiscalbay.it",
    ])
      expect(isProductionOrigin(origin), origin).toBe(false);
    // Fuori dalla produzione robots.txt chiude tutto il dominio.
    expect(await loadRobots().text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
