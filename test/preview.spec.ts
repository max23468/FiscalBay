import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";
import {
  loadScenario,
  previewLifetime,
  previewNow,
  scenarioIds,
  scenarioOptions,
} from "../app/preview/scenarios.server";
import { trialDaysLeft, trialEnding } from "../app/view-models";
import { formatDate, formatRelative } from "../app/format";
import { taxQuality } from "../app/tax-quality";
import {
  readPreviewState,
  writePreviewState,
  type PreviewState,
} from "../app/preview/state.server";
import { action as previewSearch } from "../app/routes/preview-search";
import { action as previewSettingsAction } from "../app/routes/preview-settings";
import { loader as previewOrders } from "../app/routes/preview-orders";
import { loader as previewStores } from "../app/routes/preview-stores";
import { previewListing } from "../app/preview/order-list.server";
import { orderCriteria } from "../app/domain/orders.server";
import type { SearchResults } from "../app/components/shell-search";
import { routeData, routeResponse } from "./fixtures/route-fixtures";

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
              [order.buyerName, order.shipTo?.name],
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
      expect(Date.parse(store.consentExpiresAt!)).toBeLessThan(Date.parse(expired.now));
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
        // In lista d'attesa nessun ciclo del Free è erogato.
        if (scenario.account.quota && !scenario.account.waitlisted) {
          const quota = scenario.account.quota;
          expect(Date.parse(quota.cycleEndsAt!)).toBeGreaterThan(Date.parse(scenario.now));
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
      // Come nell'area reale, la quota del ciclo seguente compare solo quando cambia.
      expect(loadScenario("fine-promozione", language, new Set()).account.quota).toEqual({
        used: 7,
        limit: 10,
        cycleEndsAt: "2026-10-02T12:20:00Z",
        nextLimit: 5,
      });
      expect(loadScenario("ordinario", language, new Set()).account.quota).not.toHaveProperty(
        "nextLimit",
      );
    });

    it(`mostra Free inattivo, ripresa, lista d'attesa e acquisti sospesi, ${language}`, () => {
      const inactive = loadScenario("free-inattivo", language, new Set());
      expect(inactive.stores.map((store) => store.pauseReason)).toEqual(["inactivity", "plan"]);
      expect(inactive.notifications[0]).toMatchObject({
        title: appCopy[language].shell.storeNotifications.inactivityTitle,
        href: "negozi",
      });
      const resumed = loadScenario("free-inattivo", language, new Set(), { resumed: true });
      expect(resumed.stores.map((store) => store.pauseReason)).toEqual([undefined, "plan"]);
      const waiting = loadScenario("lista-d-attesa", language, new Set());
      expect(waiting.account).toMatchObject({ waitlisted: true, trialAvailable: true });
      expect(waiting.notices).toEqual([{ kind: "waitlist", purchase: true }]);
      // In attesa nessun dato fiscale è mai stato sbloccato.
      expect(waiting.orders.some((order) => order.fiscal.state === "available")).toBe(false);
      expect(waiting.orders.some((order) => order.fiscal.state === "locked")).toBe(true);
      const closed = loadScenario("acquisti-sospesi", language, new Set());
      expect(closed).toMatchObject({ purchasesClosed: true, account: { trialAvailable: false } });
    });

    it(`mostra il negozio in pausa dall'assistenza come l'area reale, ${language}`, () => {
      const paused = loadScenario("negozio-sospeso", language, new Set());
      // Stessa forma del negozio reale con la pausa `admin`: nessuna ripresa dal venditore.
      expect(paused.stores).toEqual([
        expect.objectContaining({ connection: "paused", pauseReason: "admin" }),
      ]);
      expect(paused.orders.length).toBeGreaterThan(0);
    });

    it(`mostra la prova attiva, in scadenza e già usata, ${language}`, () => {
      const active = loadScenario("prova-premium", language, new Set());
      const ending = loadScenario("prova-in-scadenza", language, new Set());
      const ended = loadScenario("prova-terminata", language, new Set());
      expect(active.account).toMatchObject({ plan: "premium", trialAvailable: false });
      expect(trialDaysLeft(active.account.trial!.endsAt, previewNow)).toBe(8);
      expect(trialEnding(active.account.trial!.endsAt, previewNow)).toBe(false);
      expect(trialDaysLeft(ending.account.trial!.endsAt, previewNow)).toBe(1);
      expect(trialEnding(ending.account.trial!.endsAt, previewNow)).toBe(true);
      // Come il Checkout di Stripe si contano i giorni interi: l'ultimo è «meno di un giorno».
      expect(trialDaysLeft("2026-09-28T12:59:59Z", previewNow)).toBe(0);
      expect(appCopy[language].orders.trialStatus(0)).toBe(
        language === "it"
          ? "Prova Premium: meno di un giorno rimasto"
          : "Premium trial: less than a day left",
      );
      // Durante la prova nessun ordine resta da sbloccare.
      expect(active.orders.some((order) => order.fiscal.state === "locked")).toBe(false);
      expect(active.diagnostics.rights).toBe(language === "it" ? "Prova Premium" : "Premium trial");
      expect(ended.account).toMatchObject({ plan: "free", trialAvailable: false });
      expect(ended.account.trial).toBeUndefined();
      // Prima della prima lettura riuscita la prova non si offre.
      expect(
        loadScenario("prima-sincronizzazione", language, new Set()).account.trialAvailable,
      ).toBe(false);
      const started = loadScenario("quota-esaurita", language, new Set(), { trialStarted: true });
      expect(started.account.trial).toEqual({ endsAt: "2026-10-11T13:00:00.000Z" });
      expect(started.notices.some((notice) => notice.kind === "quota")).toBe(false);
      // Come nell'area reale la prova toglie la pausa del piano, legge ogni 10 minuti, comprende
      // le notifiche e la lettura successiva importa il resto dell'anno.
      const storeState = (scenario: ReturnType<typeof loadScenario>) =>
        scenario.stores.map(
          ({ pauseReason, targetMinutes, historyDays, importing, notifications }) => ({
            pauseReason,
            targetMinutes,
            historyDays,
            importing,
            notifications,
          }),
        );
      const importingYear = {
        pauseReason: undefined,
        targetMinutes: 10,
        historyDays: 365,
        importing: true,
        notifications: false,
      };
      expect(storeState(started)).toEqual([importingYear, importingYear]);
      expect(started.notices).toContainEqual({ kind: "importing", count: 174 });
      expect(storeState(active)).toEqual(Array(2).fill({ ...importingYear, importing: false }));
      expect(
        storeState(ended).map(({ historyDays, targetMinutes }) => [historyDays, targetMinutes]),
      ).toEqual([
        [30, 30],
        [30, 30],
      ]);
      // Una prova già usata non riparte neppure nell'anteprima.
      expect(
        loadScenario("prova-terminata", language, new Set(), { trialStarted: true }).account.plan,
      ).toBe("free");
    });

    it(`mostra pagamento in attivazione, rinnovo non riuscito o disdetto, rimborsi e Stripe non disponibile, ${language}`, () => {
      expect(loadScenario("pagamento-in-attivazione", language, new Set()).account).toMatchObject({
        plan: "free",
        payment: { state: "pending" },
      });
      expect(loadScenario("rinnovo-non-riuscito", language, new Set()).account).toMatchObject({
        plan: "free",
        payment: { state: "renewal-failed", protectedUntil: "2026-10-02T10:00:00Z" },
      });
      const cancelled = loadScenario("rinnovo-disdetto", language, new Set());
      expect(cancelled.account).toMatchObject({
        plan: "premium",
        premium: { period: "monthly", renewsAt: null, endsAt: "2026-10-13T10:00:00Z" },
      });
      expect(cancelled.diagnostics.rights).toBe(
        language === "it" ? "Premium mensile" : "Premium, monthly",
      );
      // Rimborsati: il periodo con il rinnovo che riporta Premium, il lifetime senza offerta.
      expect(loadScenario("pagamento-rimborsato", language, new Set()).account).toMatchObject({
        plan: "free",
        payment: { state: "refunded", renewsAt: "2026-10-13T10:00:00Z" },
      });
      const refunded = loadScenario("lifetime-rimborsato", language, new Set());
      expect(refunded.account).toMatchObject({
        plan: "free",
        payment: { state: "refunded", lifetime: true },
        trialAvailable: true,
      });
      expect(previewLifetime(refunded)).toBeNull();
      expect(previewLifetime(loadScenario("pagamento-rimborsato", language, new Set()))).toEqual({
        state: "available",
        credit: 0,
        replaces: true,
      });
      const down = loadScenario("stripe-non-disponibile", language, new Set());
      expect(down.stripeDown).toBe(true);
      expect(down.account.payment).toBeUndefined();
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
      for (const text of [t.settings.support.faqItems[1]!.a, t.orders.quotaBody("date")]) {
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

describe("prova simulata dell'anteprima", () => {
  const start = (cookie: string) =>
    routeResponse(previewSettingsAction, "/anteprima/impostazioni/piano", {
      cookie,
      fields: { intent: "start-trial" },
    });

  it("attiva la prova disponibile una sola volta nello scenario", async () => {
    const cookie = (
      await writePreviewState({ scenario: "ordinario", unlocked: [], saveFailed: false })
    ).split(";")[0]!;
    const first = await start(cookie);
    expect(await first.json()).toEqual({ ok: true, notice: appCopy.it.settings.plan.trialStarted });
    const started = first.headers.get("Set-Cookie")!.split(";")[0]!;
    expect(
      await readPreviewState(
        new Request("http://localhost:5173", { headers: { cookie: started } }),
      ),
    ).toMatchObject({ scenario: "ordinario", trialStarted: true });
    const again = await start(started);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({
      ok: false,
      notice: appCopy.it.settings.plan.trialUnavailable,
    });
  });
});

describe("ricerca dell'anteprima", () => {
  const search = (query: string, json = true, path = "/anteprima/ricerca") =>
    routeResponse(previewSearch, path, {
      headers: json ? { accept: "application/json" } : {},
      fields: { q: query },
    });

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
    const listed = await routeData(previewOrders, submitted.headers.get("location")!);
    expect(listed).toMatchObject({ search: "rossi", total: found.total });
  });
});

describe("elenco ordini dell'anteprima", () => {
  const list = async (path: string, scenario: "aggiornamento" | "ordinario") => {
    const cookie = (await writePreviewState({ scenario, unlocked: [], saveFailed: false })).split(
      ";",
    )[0]!;
    return routeData(previewOrders, path, { cookie }) as Promise<{
      orders: Array<{ id: string }>;
      total: number;
      incoming: number;
      snapshot: string;
      nextHref: string | null;
      freshHref: string | null;
      incomingAtTop: boolean;
    }>;
  };

  it("conta gli ordini in arrivo e li mostra in cima con la nuova istantanea", async () => {
    const opened = await list("/anteprima/ordini", "aggiornamento");
    expect(opened.incoming).toBeGreaterThan(0);
    // Gli ordini in arrivo sono più recenti del primo mostrato: entrano da soli in cima.
    expect(opened.incomingAtTop).toBe(true);
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

describe("criteri dell'elenco dell'anteprima", () => {
  const scenario = loadScenario("ordinario", "it", new Set());
  const daysAgo = (days: number) =>
    new Date(new Date(scenario.now).getTime() - days * 86_400_000).toISOString();
  const [first, second] = scenario.orders;
  // Ordini oltre i 30 giorni: separano i periodi di Free e Premium.
  const orders = [
    ...scenario.orders,
    { ...first!, id: "ord-60-giorni", createdAt: daysAgo(60) },
    { ...second!, id: "ord-120-giorni", createdAt: daysAgo(120) },
    { ...first!, id: "ord-300-giorni", createdAt: daysAgo(300) },
  ];
  const listed = (query: string, plan: "free" | "premium") =>
    previewListing(orders, [], new URLSearchParams(query), null, scenario.now, plan)
      .filtered.map(({ id }) => id)
      .sort();
  /** Gli stessi criteri dell'area reale, applicati in memoria come fa la query D1. */
  const expected = (query: string, plan: "free" | "premium") => {
    const criteria = orderCriteria(new URLSearchParams(query), new Date(scenario.now), plan);
    return orders
      .filter(
        (order) =>
          (!criteria.storeId || order.storeId === criteria.storeId) &&
          (!criteria.since || Date.parse(order.createdAt) >= Date.parse(criteria.since)) &&
          (!criteria.payment || order.payment.status === criteria.payment),
      )
      .map(({ id }) => id)
      .sort();
  };

  it("legge l'indirizzo con orderCriteria, come l'area reale", () => {
    const all = listed("", "premium");
    expect(all).toHaveLength(orders.length);
    const longStore = "s".repeat(65);
    for (const plan of ["free", "premium"] as const)
      for (const query of [
        "",
        `negozio=${first!.storeId}`,
        `negozio=${longStore}`,
        "periodo=7",
        "periodo=30",
        "periodo=90",
        "periodo=365",
        "periodo=6m",
        "periodo=12m",
        "pagamento=paid",
        "pagamento=sconosciuto",
      ])
        expect(listed(query, plan), `${plan} ${query}`).toEqual(expected(query, plan));
    // Un negozio oltre i 64 caratteri non filtra, invece di svuotare l'elenco.
    expect(listed(`negozio=${longStore}`, "premium")).toEqual(all);
    // I 90 giorni valgono soltanto per Premium; in Free l'opzione vale «Tutti».
    expect(listed("periodo=90", "premium")).toContain("ord-60-giorni");
    expect(listed("periodo=90", "premium")).not.toContain("ord-120-giorni");
    expect(listed("periodo=90", "free")).toEqual(all);
    expect(listed("periodo=30", "free")).not.toContain("ord-60-giorni");
    expect(listed("periodo=6m", "premium")).toContain("ord-120-giorni");
    expect(listed("periodo=6m", "premium")).not.toContain("ord-300-giorni");
    expect(listed("periodo=12m", "premium")).toContain("ord-300-giorni");
    expect(listed("periodo=12m", "free")).toEqual(all);
  });
});

describe("negozi dell'anteprima", () => {
  it("avvisa allo scollegamento negli stessi stati dell'abbonamento dell'area reale", async () => {
    const renews = async (scenario: PreviewState["scenario"]) => {
      const cookie = (await writePreviewState({ scenario, unlocked: [], saveFailed: false })).split(
        ";",
      )[0]!;
      const page = (await routeData(previewStores, "/anteprima/negozi", { cookie })) as {
        subscriptionRenews: boolean;
      };
      return page.subscriptionRenews;
    };
    // Un abbonamento che addebiterà ancora, anche in attivazione o dopo un periodo rimborsato.
    expect(await renews("pagamento-in-attivazione")).toBe(true);
    expect(await renews("pagamento-rimborsato")).toBe(true);
    // Il lifetime rimborsato e il rinnovo disdetto non addebitano più.
    expect(await renews("lifetime-rimborsato")).toBe(false);
    expect(await renews("rinnovo-disdetto")).toBe(false);
  });
});
