import { describe, expect, it } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  loadScenario,
  previewNow,
  scenarioIds,
  scenarioOptions,
} from "../app/preview/scenarios.server";
import { formatDate } from "../app/view-models";

describe("stato sintetico dell'anteprima", () => {
  for (const language of ["it", "en"] as const) {
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
      expect(t.legal.version("bozza-2026-09-28")).toContain("bozza-2026-09-28");
      expect(t.legal.version("2026-10-03")).not.toMatch(/Bozza|Draft/);
    });
  }
});
