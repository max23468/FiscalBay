import { describe, expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  loadScenario,
  previewNow,
  scenarioIds,
  scenarioOptions,
} from "../app/preview/scenarios.server";
import { formatDate, formatRelative } from "../app/view-models";

describe("stato sintetico dell'anteprima", () => {
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
    it(`il prezzo unitario e le quantità dell'ordine con più articoli compongono il totale, ${language}`, () => {
      const order = loadScenario("ordinario", language, new Set()).orders.find(
        (order) => order.id === "ord-01",
      )!;
      expect(order.items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0)).toBe(
        order.totalMinor,
      );
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
        identifiers: [{ type: "PIVA", value: "04567890123" }],
      });
      expect(
        loadScenario("ordinario", language, new Set(["ord-09", "ord-09"])).account.quota?.used,
      ).toBe(4);
      expect(loadScenario("ordinario", language, new Set()).account.quota?.used).toBe(3);
    });

    it(`mantiene calendario e contatori coerenti nei dodici scenari, ${language}`, () => {
      expect(scenarioIds).toHaveLength(12);
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
