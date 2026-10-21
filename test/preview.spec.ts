import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  loadScenario,
  previewNow,
  scenarioIds,
  scenarioOptions,
} from "../app/preview/scenarios.server";
import { formatDate, formatRelative } from "../app/view-models";
import { taxQuality } from "../app/tax-quality";
import { readPreviewState, writePreviewState } from "../app/preview/state.server";
import { action as previewSearch } from "../app/routes/preview-search";
import { loader as previewOrders } from "../app/routes/preview-orders";
import type { SearchResults } from "../app/components/app-shell";

describe("stato sintetico dell'anteprima", () => {
  it("conserva lo stato sui cookie HTTP locali e mantiene Secure sul dominio HTTPS", async () => {
    const previous = env.APP_ORIGIN;
    const state = { scenario: "dati-discordanti", unlocked: ["ord-03"], saveFailed: true } as const;
    try {
      for (const [origin, secure] of [
        ["http://localhost:5186", false],
        ["https://test.fiscalbay.it", true],
      ] as const) {
        Object.assign(env, { APP_ORIGIN: origin });
        const cookie = await writePreviewState({ ...state, unlocked: [...state.unlocked] });
        expect(/; Secure(?:;|$)/u.test(cookie)).toBe(secure);
        expect(cookie).toContain("; HttpOnly");
        expect(cookie).toContain("; SameSite=Lax");
        expect(
          await readPreviewState(
            new Request(origin, { headers: { cookie: cookie.split(";")[0]! } }),
          ),
        ).toMatchObject(state);
      }
    } finally {
      Object.assign(env, { APP_ORIGIN: previous });
    }
  });

  it("gli scenari UI usano gli stessi esiti formali degli identificativi importati", () => {
    for (const id of scenarioIds) {
      const scenario = loadScenario(id, "it", new Set(["ord-03", "ord-09"]));
      for (const order of scenario.orders) {
        if (order.fiscal.state !== "available") continue;
        for (const identifier of order.fiscal.identifiers) {
          expect(
            taxQuality(
              {
                type:
                  identifier.type === "CF"
                    ? "CODICE_FISCALE"
                    : identifier.type === "PIVA"
                      ? "VAT_ID"
                      : "OTHER",
                issuingCountry: "IT",
                value: identifier.value,
              },
              [order.buyerName, order.shipTo.name],
            ),
            `${id}/${order.id}`,
          ).toBe(identifier.quality);
        }
      }
    }
  });
  it("conserva i tempi relativi e normalizza gli apostrofi delle implementazioni ICU", () => {
    const now = "2026-09-27T13:00:00.000Z";
    for (const [minutes, itText, enText] of [
      [0, "questo minuto", "this minute"],
      [-5, "5 minuti fa", "5 minutes ago"],
      [-60, "1 ora fa", "1 hour ago"],
      [-1440, "ieri", "yesterday"],
      [-2900, "l’altro ieri", "2 days ago"],
      [1440, "domani", "tomorrow"],
      [2880, "dopodomani", "in 2 days"],
    ] as const) {
      const value = new Date(Date.parse(now) + minutes * 60_000).toISOString();
      expect(formatRelative(value, now, "it")).toBe(itText);
      expect(formatRelative(value, now, "en")).toBe(enText);
    }
    for (const text of ["l'altro ieri", "l’altro ieri"]) {
      const format = vi.spyOn(Intl.RelativeTimeFormat.prototype, "format").mockReturnValue(text);
      try {
        expect(formatRelative("2026-09-25T12:40:00.000Z", now, "it")).toBe("l’altro ieri");
      } finally {
        format.mockRestore();
      }
    }
  });

  for (const language of ["it", "en"] as const) {
    it(`i negozi sintetici conservano scadenza e ultima lettura coerenti, ${language}`, () => {
      const expired = loadScenario("negozio-scaduto", language, new Set());
      const store = expired.stores.find((entry) => entry.connection === "reconnect_required")!;
      expect(Date.parse(store.consentExpiresAt)).toBeLessThan(Date.parse(expired.now));
      for (const scenario of scenarioIds.map((id) => loadScenario(id, language, new Set()))) {
        for (const paused of scenario.stores.filter((entry) => entry.connection === "paused")) {
          for (const update of paused.recent.filter((entry) => entry.ok)) {
            expect(Date.parse(update.at)).toBeLessThanOrEqual(Date.parse(paused.lastSyncAt!));
          }
        }
      }
    });
    it(`gli importi delle righe dell'ordine con più articoli compongono il totale, ${language}`, () => {
      const order = loadScenario("ordinario", language, new Set()).orders.find(
        (order) => order.id === "ord-01",
      )!;
      expect(order.items.reduce((sum, item) => sum + item.totalMinor!, 0)).toBe(order.totalMinor);
    });
    it(`deriva la diagnostica dalla quota aggiornata, ${language}`, () => {
      const before = loadScenario("ordinario", language, new Set());
      const after = loadScenario("ordinario", language, new Set(["ord-09"]));
      expect(before.account.quota?.used).toBe(3);
      expect(after.account.quota?.used).toBe(4);
      expect(after.diagnostics.rights).toBe(
        language === "it" ? "Free, 4 di 5 ordini sbloccati" : "Free, 4 of 5 orders unlocked",
      );
      expect(after.orders.find((order) => order.id === "ord-09")?.fiscal).toMatchObject({
        state: "available",
        identifiers: [{ type: "PIVA", value: "04567890126" }],
      });
      expect(
        loadScenario("ordinario", language, new Set(["ord-09", "ord-09"])).account.quota?.used,
      ).toBe(4);
      expect(loadScenario("ordinario", language, new Set()).account.quota?.used).toBe(3);
    });

    it(`mantiene calendario e contatori coerenti negli scenari, ${language}`, () => {
      expect(scenarioIds).toContain("sblocco-non-riuscito");
      for (const id of scenarioIds) {
        const scenario = loadScenario(id, language, new Set());
        expect(scenario.now).toBe(previewNow);
        const option = scenarioOptions(language).find((entry) => entry.id === id)!;
        expect(option.focus).toContain(formatDate(scenario.now, language));
        expect(option.focus).toContain("Europe/Rome");
        if (scenario.account.quota) {
          const quota = scenario.account.quota;
          expect(Date.parse(quota.cycleEndsAt)).toBeGreaterThan(Date.parse(scenario.now));
          expect(scenario.diagnostics.rights).toContain(
            language === "it"
              ? `${quota.used} di ${quota.limit}`
              : `${quota.used} of ${quota.limit}`,
          );
          for (const notice of scenario.notices) {
            if (notice.kind === "quota") expect(notice.until).toBe(quota.cycleEndsAt);
          }
        }
        for (const store of scenario.stores) {
          if (store.lastSyncAt)
            expect(Date.parse(store.lastSyncAt)).toBeLessThanOrEqual(Date.parse(scenario.now));
          for (const update of store.recent)
            expect(Date.parse(update.at)).toBeLessThanOrEqual(Date.parse(scenario.now));
        }
      }
      expect(loadScenario("importazione", language, new Set()).account.quota?.used).toBe(0);
      expect(loadScenario("quota-esaurita", language, new Set()).account.quota?.used).toBe(5);
    });

    it(`localizza descrittori e spiega entrambi gli identificativi, ${language}`, () => {
      const scenario = loadScenario("ordinario", language, new Set());
      expect(scenario.sessions.map((session) => session.device)).toEqual(
        language === "it"
          ? ["Safari su macOS", "Safari su iPhone", "Chrome su Windows"]
          : ["Safari on macOS", "Safari on iPhone", "Chrome on Windows"],
      );
      expect(scenario.diagnostics.version).toBe(
        language === "it" ? "2.0.0 (anteprima)" : "2.0.0 (preview)",
      );
      const t = appCopy[language];
      for (const text of [t.settings.faqItems[1]!.a, t.orders.quotaBody("date")]) {
        expect(text).toContain("Codice Fiscale");
        expect(text).toContain("Partita IVA");
      }
      expect(t.legal.version("bozza-2026-09-28")).toContain(language === "it" ? "Bozza" : "Draft");
      expect(t.legal.version("bozza-2026-09-28")).toContain(
        language === "it" ? "28 settembre 2026" : "28 September 2026",
      );
      expect(t.legal.version("bozza-2026-09-28")).not.toContain("bozza-");
      expect(t.legal.version("2026-10-03")).not.toMatch(/Bozza|Draft/);
    });
  }
});

describe("ricerca dell'anteprima", () => {
  const search = (query: string, json = true, path = "/anteprima/ricerca") =>
    previewSearch({
      request: new Request(`http://localhost:5173${path}`, {
        method: "POST",
        headers: json ? { accept: "application/json" } : {},
        body: new URLSearchParams({ q: query }),
      }),
    } as Parameters<typeof previewSearch>[0]);

  it("suggerisce dagli scenari con le regole dell'area reale e cifra la ricerca", async () => {
    // «SOCIETA» trova «Società»: maiuscole e accenti non contano.
    const accents = (await (await search("SOCIETA")).json()) as SearchResults;
    expect(accents.items.map((item) => item.id)).toEqual(["ord-01"]);
    const found = (await (await search("rossi")).json()) as SearchResults;
    expect(found.href).toMatch(/^\/anteprima\/ordini\?ricerca=[\w-]+$/u);
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.items.every((item) => item.href.startsWith("/anteprima/ordini/ord-"))).toBe(true);
    // Un valore da sbloccare non trova l'ordine; uno disponibile sì, anche normalizzato.
    expect(((await (await search("BNCLCU75C12F205G")).json()) as SearchResults).total).toBe(0);
    const english = (await (
      await search("rossi", true, "/en/anteprima/ricerca")
    ).json()) as SearchResults;
    expect(english.href).toMatch(/^\/en\/anteprima\/ordini\?ricerca=/u);
    const submitted = await search("rossi", false);
    expect(submitted.status).toBe(303);
    const listed = await previewOrders({
      request: new Request(`http://localhost:5173${submitted.headers.get("location")}`),
      params: {},
    } as Parameters<typeof previewOrders>[0]);
    expect(listed).toMatchObject({ search: "rossi", total: found.total });
  });
});

describe("elenco ordini dell'anteprima", () => {
  const list = async (path: string, scenario: "aggiornamento" | "ordinario") => {
    const cookie = (await writePreviewState({ scenario, unlocked: [] })).split(";")[0]!;
    return previewOrders({
      request: new Request(`http://localhost:5173${path}`, { headers: { cookie } }),
      params: {},
    } as Parameters<typeof previewOrders>[0]) as Promise<{
      orders: Array<{ id: string }>;
      total: number;
      incoming: number;
      snapshot: string;
      nextHref: string | null;
      freshHref: string | null;
    }>;
  };

  it("conta gli ordini in arrivo e li mostra in cima con la nuova istantanea", async () => {
    const opened = await list("/anteprima/ordini", "aggiornamento");
    expect(opened.incoming).toBeGreaterThan(0);
    expect(opened.orders.map(({ id }) => id)).not.toContain("ord-20");
    // «Carica altri» resta sull'istantanea e non porta gli ordini in arrivo.
    expect(opened.nextHref).toBe(`/anteprima/ordini?mostra=2&vista=${opened.snapshot}`);
    const more = await list(opened.nextHref!, "aggiornamento");
    expect(more).toMatchObject({ incoming: opened.incoming, total: opened.total });
    const fresh = await list(opened.freshHref!, "aggiornamento");
    expect(fresh.orders.slice(0, opened.incoming).map(({ id }) => id)).toContain("ord-20");
    expect(fresh).toMatchObject({ incoming: 0, freshHref: null });
    expect(fresh.total).toBe(opened.total + opened.incoming);
    // Uno scenario senza ordini in arrivo non ha l'indicatore.
    expect(await list("/anteprima/ordini", "ordinario")).toMatchObject({
      incoming: 0,
      freshHref: null,
    });
  });
});
