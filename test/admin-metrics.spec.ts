import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { listAnomalies } from "../app/domain/admin-operations.server";

import { quotaAnomalies, readEbayQuotas } from "../app/domain/ebay-quotas.server";

import { readTechnicalMetrics } from "../app/domain/technical-metrics.server";

import { cpuValues, metricQueries, metricSql, pageCpuQuery } from "../app/metrics-queries";

import { now } from "./fixtures/database-fixtures";

import { at, hour, later, admin, audit, act, setupScenarios } from "./fixtures/admin-scenarios";

setupScenarios();

describe("quote delle API eBay", () => {
  const daily = (name: string, used: number, reset = "2026-09-14T07:00:00.000Z", limit = 5000) => ({
    name,
    rates: [
      {
        count: used,
        limit,
        remaining: limit - used,
        reset,
        timeWindow: 86_400,
      },
      { count: 1, limit: 300, remaining: 299, reset: now, timeWindow: 300 },
    ],
  });

  /** eBay sintetico: token dell'applicazione e quote di Trading e Fulfillment. */
  function analytics(
    trading: ReturnType<typeof daily>[],
    fulfillment = [daily("sell.fulfillment", 10)],
  ) {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      calls.push(url.pathname + url.search);
      if (url.pathname.endsWith("/oauth2/token"))
        return Response.json({ access_token: "app-token" });
      const context = url.searchParams.get("api_context");
      return Response.json({
        rateLimits:
          context === "tradingapi"
            ? [{ apiContext: "tradingapi", apiName: "TradingAPI", resources: trading }]
            : [{ apiContext: "sell", apiName: "fulfillment", resources: fulfillment }],
      });
    }) as unknown as typeof fetch;
    return { fetcher, calls };
  }

  it("apre un'anomalia al giorno oltre il 70% e la chiude al rientro", async () => {
    await env.DB.prepare(
      "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com#GetItem', ?)",
    )
      .bind(later(3 * hour))
      .run();
    const over = analytics([
      daily("GetOrders", 3600),
      daily("GetItem", 4600),
      daily("GetUser", 10),
    ]);
    const [production] = await readEbayQuotas(env, over.fetcher, at(now));
    expect(production).toMatchObject({
      environment: "production",
      read: "ok",
      suspended: [{ call: "GetItem", until: later(3 * hour) }],
    });
    expect(production!.rows.find((row) => row.resource === "GetOrders")).toMatchObject({
      api: "Trading",
      daily: true,
      over: true,
      used: true,
      rate: { limit: 5000, used: 3600, remaining: 1400, resetAt: "2026-09-14T07:00:00.000Z" },
    });
    expect(production!.rows.find((row) => row.resource === "GetUser")).toMatchObject({
      over: false,
    });
    // Nessuna chiamata per conto dei negozi: soltanto token dell'applicazione e Analytics.
    expect(
      over.calls.every((path) => path.includes("oauth2/token") || path.includes("rate_limit")),
    ).toBe(true);
    const open = await quotaAnomalies(env.DB, at(now));
    expect(open.map(({ subject, severity }) => ({ subject, severity }))).toEqual([
      { subject: "production:Trading:GetItem", severity: "p1" },
      { subject: "production:Trading:GetOrders", severity: "p2" },
    ]);
    // Rilette nello stesso giorno restano le stesse anomalie.
    await readEbayQuotas(env, over.fetcher, at(later(hour)));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_anomalies").first()).toEqual({
      n: 2,
    });
    expect(
      (await listAnomalies(env.DB, at(later(hour)))).filter((a) => a.kind === "ebay_quota"),
    ).toHaveLength(2);

    // Una lettura non riuscita non è una quota piena né vuota e non chiude nulla.
    const failing = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    expect(await readEbayQuotas(env, failing, at(later(2 * hour)))).toEqual([
      {
        environment: "production",
        read: "failed",
        rows: [],
        suspended: [{ call: "GetItem", until: later(3 * hour) }],
      },
    ]);
    expect((await quotaAnomalies(env.DB, at(later(2 * hour)))).every((a) => !a.resolvedAt)).toBe(
      true,
    );

    // Dopo l'azzeramento il consumo rientra e le anomalie si chiudono.
    const reset = analytics([daily("GetOrders", 100), daily("GetItem", 100)]);
    await readEbayQuotas(env, reset.fetcher, at("2026-09-14T08:00:00.000Z"));
    const closed = await quotaAnomalies(env.DB, at("2026-09-14T08:00:00.000Z"));
    expect(closed.every((a) => a.resolvedAt === "2026-09-14T08:00:00.000Z")).toBe(true);
    // Nella finestra successiva un nuovo superamento apre una nuova anomalia, e quella della
    // finestra precedente non resta aperta accanto: per chiamata ne resta aperta una.
    const next = "2026-09-15T07:00:00.000Z";
    await readEbayQuotas(env, over.fetcher, at("2026-09-14T09:00:00.000Z"));
    const reopened = analytics([daily("GetOrders", 3600, next), daily("GetItem", 4600, next)]);
    await readEbayQuotas(env, reopened.fetcher, at("2026-09-14T09:00:00.000Z"));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_anomalies").first()).toEqual({
      n: 4,
    });
    expect(
      (await quotaAnomalies(env.DB, at("2026-09-14T09:00:00.000Z"))).filter((a) => !a.resolvedAt),
    ).toHaveLength(2);
  });

  it("apre l'anomalia alla soglia scelta nella console", async () => {
    const { cookie } = await admin();
    const usage = analytics([daily("GetOrders", 3250)]);
    const orders = async () =>
      (await readEbayQuotas(env, usage.fetcher, at(now)))[0]!.rows.find(
        (row) => row.resource === "GetOrders",
      );
    expect(await orders()).toMatchObject({ over: false });
    for (const soglia of ["49", "86", "sessanta"])
      expect(
        await act(cookie, { intent: "quota-attention", soglia, motivo: "Prova" }),
      ).toMatchObject({ status: 400 });
    // I valori fuori intervallo restano nel registro come rifiuti.
    expect(await audit()).toEqual(
      ["49", "86", "sessanta"].map((soglia) => ({
        operation: "quota-attention",
        target: `setting:quota_attention:${soglia}`,
        reason: "Prova",
        outcome: "out_of_range",
      })),
    );
    await env.DB.prepare("DELETE FROM admin_audit").run();
    expect(await act(cookie, { intent: "quota-attention", soglia: "60", motivo: "Prova" })).toEqual(
      {
        ok: true,
        notice: "Operazione registrata.",
      },
    );
    expect(await orders()).toMatchObject({ over: true });
    expect(await quotaAnomalies(env.DB, at(now))).toHaveLength(1);
    expect(
      await act(cookie, { intent: "quota-attention", soglia: "60", motivo: "Prova" }),
    ).toMatchObject({ ok: false });
    expect(await audit()).toEqual([
      {
        operation: "quota-attention",
        target: "setting:quota_attention:60",
        reason: "Prova",
        outcome: "done",
      },
      {
        operation: "quota-attention",
        target: "setting:quota_attention:60",
        reason: "Prova",
        outcome: "unchanged",
      },
    ]);
  });

  it("tratta la quota Trading condivisa come una sola, sulle chiamate di FiscalBay", async () => {
    // eBay riporta lo stesso residuo per ogni chiamata Trading: la quota è unica.
    const pooled = (name: string, count: number) => ({
      name,
      rates: [
        {
          count,
          limit: 5000,
          remaining: 1200,
          reset: "2026-09-14T07:00:00.000Z",
          timeWindow: 86_399,
        },
      ],
    });
    const shared = analytics(
      [pooled("GetOrders", 3000), pooled("GetItem", 800), pooled("AddItem", 0)],
      [daily("sell.fulfillment.refund", 99_000, "2026-09-14T07:00:00.000Z", 100_000)],
    );
    const [production] = await readEbayQuotas(env, shared.fetcher, at(now));
    const getOrders = production!.rows.find((row) => row.resource === "GetOrders")!;
    // Il consumo è della quota condivisa, non delle sole chiamate della voce.
    expect(getOrders).toMatchObject({ share: 0.76, over: true, daily: true, used: true });
    expect(getOrders.rate).toMatchObject({ used: 3000, consumed: 3800 });
    // Prima le chiamate di FiscalBay nell'ordine di importanza, poi le altre.
    expect(production!.rows.map((row) => row.resource)).toEqual([
      "GetOrders",
      "GetItem",
      "sell.fulfillment.refund",
      "AddItem",
    ]);
    expect(production!.rows.find((row) => row.resource === "AddItem")).toMatchObject({
      used: false,
    });
    // Fulfillment oltre soglia su una risorsa che FiscalBay non usa: nessuna anomalia.
    expect(
      production!.rows.find((row) => row.resource === "sell.fulfillment.refund"),
    ).toMatchObject({ over: true, used: false });
    expect(
      (await quotaAnomalies(env.DB, at(now))).map(({ subject, severity }) => ({
        subject,
        severity,
      })),
    ).toEqual([{ subject: "production:Trading:GetOrders", severity: "p2" }]);
  });

  it("nella stessa finestra la quota resta la stessa anomalia se cambiano chiamate o azzeramento", async () => {
    const pooled = (name: string, count: number, reset: string, remaining = 1200) => ({
      name,
      rates: [{ count, limit: 5000, remaining, reset, timeWindow: 86_399 }],
    });
    const reset = "2026-09-14T07:00:00.000Z";
    // Prima lettura: la quota condivisa con una sola chiamata oltre soglia nell'elenco.
    await readEbayQuotas(env, analytics([pooled("GetOrders", 3800, reset)]).fetcher, at(now));
    // Poi eBay elenca altre chiamate della stessa quota e sposta l'azzeramento di qualche secondo.
    const shifted = "2026-09-14T06:59:57.000Z";
    await readEbayQuotas(
      env,
      analytics([
        pooled("GetOrders", 3000, shifted, 1100),
        pooled("GetItem", 900, shifted, 1100),
        pooled("AddItem", 0, shifted, 1100),
      ]).fetcher,
      at(later(hour)),
    );
    const anomalies = await env.DB.prepare(
      "SELECT key, subject, resolved_at FROM admin_anomalies WHERE kind = 'ebay_quota'",
    ).all();
    expect(anomalies.results).toEqual([
      {
        key: `ebay_quota:production:Trading:GetOrders:${reset}`,
        subject: "production:Trading:GetOrders",
        resolved_at: null,
      },
    ]);
  });
});

describe("prestazioni da Analytics Engine", () => {
  it("pesa ogni conteggio, somma, media e quantile con il campionamento", () => {
    for (const query of metricQueries) {
      const sql = metricSql(query, "fiscalbay_test_metrics", 24);
      expect(sql).toContain("FROM fiscalbay_test_metrics");
      expect(sql).toContain("timestamp > NOW() - INTERVAL '24' HOUR");
      // Nessun conteggio di righe: con il campionamento una riga vale `_sample_interval` eventi.
      expect(sql).not.toMatch(/count\(|avg\(/iu);
      for (const aggregate of sql.match(/(SUM|quantileExactWeighted\([\d.]+\))\([^\n]*/gu)!)
        expect(aggregate).toContain("_sample_interval");
    }
    expect(metricSql("pages", "fiscalbay_metrics", 2160)).toContain(
      "quantileExactWeighted(0.95)(double3, if(double3 >= 0, _sample_interval, 0)) AS lcp_p95_ms",
    );
    // Numero, media e quantili delle invocazioni hanno la stessa unità: l'invocazione.
    expect(metricSql("invocations", "fiscalbay_metrics", 24)).toContain(
      "quantileExactWeighted(0.5)(double2, _sample_interval) AS p50_ms",
    );
    // Dataset e finestra sono controllati: niente testo libero nella query.
    expect(() => metricSql("phases", "dati; DROP", 24)).toThrow("INVALID_DATASET");
    for (const hours of [0, 1.5, 2161])
      expect(() => metricSql("phases", "fiscalbay_metrics", hours)).toThrow("INVALID_WINDOW");
  });

  it("conta le invocazioni della coda per invocazione su un campione con pesi diversi", async () => {
    // Campione controllato: un gruppo di quattro messaggi da 400 ms con peso 1 e tre invocazioni
    // stimate da un messaggio e 100 ms ciascuna (peso 3). Le funzioni di Analytics Engine che D1
    // non conosce (finestra e quantili) restano fuori: i quantili usano le stesse colonne.
    const sql = metricSql("invocations", "metriche_campione", 24)
      .replace(/timestamp > NOW\(\) - INTERVAL '24' HOUR/u, "1 = 1")
      .replaceAll(/quantileExactWeighted\([\d.]+\)\(double2, _sample_interval\)/gu, "NULL")
      .replace("FORMAT JSON", "");
    await env.DB.prepare(
      `CREATE TABLE metriche_campione (timestamp TEXT, blob1 TEXT, blob2 TEXT, blob3 TEXT,
        blob4 TEXT, blob5 TEXT, double1 REAL, double2 REAL, _sample_interval REAL)`,
    ).run();
    try {
      await env.DB.prepare(
        `INSERT INTO metriche_campione VALUES
          (?1, 'invocation', 'queue', 'sync', '', 'ok', 4, 400, 1),
          (?1, 'invocation', 'queue', 'sync', '', 'ok', 1, 100, 3)`,
      )
        .bind(now)
        .run();
      const { results } = await env.DB.prepare(sql).all();
      expect(results).toEqual([
        expect.objectContaining({ invocation: "queue", count: 4, messages: 7, mean_ms: 175 }),
      ]);
    } finally {
      await env.DB.prepare("DROP TABLE metriche_campione").run();
    }
  });

  it("legge le tre query con il token di sola lettura e distingue i valori assenti dagli zeri", async () => {
    expect(await readTechnicalMetrics({ ...env, ANALYTICS_READ_TOKEN: undefined }, fetch)).toEqual({
      read: "unconfigured",
    });
    const requests: { url: string; authorization: string | null; body: string }[] = [];
    const rows = {
      invocations: [
        {
          invocation: "http",
          detail: "document",
          method: "GET",
          outcome: "2xx",
          count: "40",
          mean_ms: 85.5,
          p50_ms: 70,
          p95_ms: 190,
          p99_ms: 240,
        },
      ],
      phases: [
        {
          invocation: "queue",
          phase: "ebay",
          operation: "request",
          outcome: "ok",
          calls: "12",
          invocations: "4",
          mean_ms: 300,
          p50_ms: 280,
          p95_ms: 410,
          p99_ms: 500,
        },
      ],
      pages: [
        {
          page: "orders",
          reports: "8",
          ttfb_reports: "8",
          ttfb_p75_ms: 120,
          ttfb_p95_ms: 180,
          lcp_reports: "0",
          lcp_p75_ms: 0,
          lcp_p95_ms: 0,
        },
      ],
    };
    const telemetry = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body);
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization"),
        body,
      });
      if (String(input) === telemetry) {
        // Soltanto Ordini documento ha invocazioni nella finestra.
        const measured =
          (JSON.parse(body) as { queryId: string }).queryId === "page-cpu-orders-document";
        const aggregate = (value: number) => [{ value, count: measured ? 30 : 0 }];
        return Response.json({
          success: true,
          result: {
            calculations: [
              { alias: "invocations", aggregates: aggregate(measured ? 30 : 0) },
              { alias: "cpu_p50_ms", aggregates: aggregate(measured ? 42 : 0) },
              { alias: "cpu_p95_ms", aggregates: aggregate(measured ? 170 : 0) },
              { alias: "wall_p50_ms", aggregates: aggregate(measured ? 760 : 0) },
            ],
          },
        });
      }
      const query = body.includes("'phase'")
        ? "phases"
        : body.includes("'page'")
          ? "pages"
          : "invocations";
      return Response.json({ meta: [], data: rows[query], rows: 1 });
    }) as unknown as typeof fetch;
    const metrics = await readTechnicalMetrics(
      { ...env, ANALYTICS_READ_TOKEN: "token-di-lettura" },
      fetcher,
    );
    expect(requests).toHaveLength(7);
    for (const request of requests) {
      expect(request.authorization).toBe("Bearer token-di-lettura");
      if (request.url === telemetry) expect(request.body).toContain(`"value":"${env.WORKER_NAME}"`);
      else {
        expect(request.url).toBe(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
        );
        expect(request.body).toContain(`FROM ${env.METRICS_DATASET}`);
      }
    }
    expect(metrics).toMatchObject({
      read: "ok",
      windowHours: 24,
      invocations: [{ detail: "document", count: 40, p95Ms: 190 }],
      phases: [{ phase: "ebay", calls: 12, invocations: 4, p95Ms: 410 }],
      pages: [
        {
          page: "orders",
          reports: 8,
          // Nessun report con LCP o con la fase eBay: il valore manca, non è zero.
          measures: {
            ttfb: { p75: 120, p95: 180 },
            lcp: { p75: null, p95: null },
            server_ebay: { p75: null, p95: null },
          },
        },
      ],
      cpu: [
        {
          page: "orders",
          kind: "document",
          invocations: 30,
          cpuP50Ms: 42,
          cpuP95Ms: 170,
          wallP50Ms: 760,
        },
        // Nessuna invocazione nella finestra: i tempi mancano, non sono zero.
        {
          page: "orders",
          kind: "data",
          invocations: 0,
          cpuP50Ms: null,
          cpuP95Ms: null,
          wallP50Ms: null,
        },
        { page: "stores", kind: "document", invocations: 0, cpuP50Ms: null },
        { page: "stores", kind: "data", invocations: 0, cpuP50Ms: null },
      ],
    });
    expect(
      await readTechnicalMetrics(
        { ...env, ANALYTICS_READ_TOKEN: "token", WORKER_NAME: "" },
        fetcher,
      ),
    ).toEqual({ read: "unconfigured" });
    // Una risposta non riuscita resta una lettura non riuscita, mai zero.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const failing of [
        async () => new Response("{}", { status: 403 }),
        async () => Response.json({ errors: [] }),
        // Telemetry senza `result.calculations`, SQL corretta.
        async (input: RequestInfo | URL) =>
          String(input).endsWith("/telemetry/query")
            ? Response.json({ success: true, result: {} })
            : Response.json({ data: [] }),
        async () => {
          throw new DOMException("timeout", "TimeoutError");
        },
      ])
        expect(
          await readTechnicalMetrics(
            { ...env, ANALYTICS_READ_TOKEN: "token" },
            vi.fn(failing) as unknown as typeof fetch,
          ),
        ).toEqual({ read: "failed" });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("tempo CPU delle pagine dai Workers Logs", () => {
  const filterOf = (page: "orders" | "stores", kind: "document" | "data") =>
    new RegExp(
      pageCpuQuery("fiscalbay-test", page, kind, 24, 0).parameters.filters.find(
        (filter) => filter.key === "$workers.event.request.url",
      )!.value,
      "u",
    );

  it("separa documento e dati della pagina, in entrambe le lingue e con il dettaglio", () => {
    const document = filterOf("orders", "document");
    const data = filterOf("orders", "data");
    for (const url of [
      "https://test.fiscalbay.it/app/ordini",
      "https://test.fiscalbay.it/en/app/orders?negozio=collaudo",
      "https://test.fiscalbay.it/app/ordini/12-00000-00001",
    ]) {
      expect(url).toMatch(document);
      expect(url).not.toMatch(data);
    }
    for (const url of [
      "https://test.fiscalbay.it/app/ordini.data",
      "https://test.fiscalbay.it/app/ordini/12-00000-00001.data?_routes=routes%2Forders",
    ]) {
      expect(url).toMatch(data);
      expect(url).not.toMatch(document);
    }
    // Altre pagine e percorsi più profondi non entrano nel conteggio.
    for (const url of [
      "https://test.fiscalbay.it/app/negozi",
      "https://test.fiscalbay.it/app/ordini/esporta/file",
      "https://test.fiscalbay.it/anteprima/ordini",
    ])
      expect(url).not.toMatch(document);
    expect("https://test.fiscalbay.it/app/negozi/collaudo-attivo").toMatch(
      filterOf("stores", "document"),
    );
    // Il collegamento di un negozio è un'altra route, anche in inglese e come dati; i negozi con
    // un nome vicino restano di Negozi.
    for (const kind of ["document", "data"] as const) {
      const stores = filterOf("stores", kind);
      const suffix = kind === "data" ? ".data" : "";
      for (const path of ["/app/negozi/collega", "/en/app/stores/link"])
        expect(`https://test.fiscalbay.it${path}${suffix}?esito=ok`).not.toMatch(stores);
      for (const detail of ["", "/c", "/coll", "/collegamento", "/collegb", "/xcollega", "/s-1"])
        expect(`https://test.fiscalbay.it/app/negozi${detail}${suffix}`).toMatch(stores);
    }
    // Nessun segmento di Ordini è escluso: un ordine può chiamarsi come un percorso.
    expect("https://test.fiscalbay.it/app/ordini/collega").toMatch(filterOf("orders", "document"));
  });

  it("controlla Worker e finestra e legge i valori senza confondere assenze e zeri", () => {
    const query = pageCpuQuery("fiscalbay", "stores", "data", 168, 1_000_000_000);
    expect(query.timeframe).toEqual({ from: 1_000_000_000 - 168 * 3_600_000, to: 1_000_000_000 });
    expect(query.parameters.calculations.map((calculation) => calculation.alias)).toEqual([
      "invocations",
      "cpu_p50_ms",
      "cpu_p95_ms",
      "wall_p50_ms",
    ]);
    expect(() => pageCpuQuery('fiscalbay" OR 1', "orders", "document", 24)).toThrow(
      "INVALID_SERVICE",
    );
    for (const hours of [0, 2.5, 169])
      expect(() => pageCpuQuery("fiscalbay", "orders", "document", hours)).toThrow(
        "INVALID_WINDOW",
      );
    expect(cpuValues(undefined)).toBeNull();
    expect(cpuValues([{ alias: "invocations", aggregates: [{ value: 0 }] }])).toEqual({
      invocations: 0,
      cpuP50Ms: null,
      cpuP95Ms: null,
      wallP50Ms: null,
    });
    const complete = (invocations: unknown) => [
      { alias: "invocations", aggregates: [{ value: invocations }] },
      { alias: "cpu_p50_ms", aggregates: [{ value: 4 }] },
      { alias: "cpu_p95_ms", aggregates: [{ value: "9" }] },
      { alias: "wall_p50_ms", aggregates: [{ value: 30 }] },
    ];
    expect(cpuValues(complete(3))).toEqual({
      invocations: 3,
      cpuP50Ms: 4,
      cpuP95Ms: 9,
      wallP50Ms: 30,
    });
    // Una risposta di forma diversa è una lettura non riuscita, non zero.
    for (const calculations of [
      [],
      [{ alias: "invocations" }],
      [{ alias: "invocations", aggregates: [{ value: "molti" }] }],
      complete(null),
      complete(3).slice(0, 3),
      complete(3).map((entry) =>
        entry.alias === "cpu_p95_ms" ? { ...entry, aggregates: [{ value: {} }] } : entry,
      ),
    ])
      expect(cpuValues(calculations)).toBeNull();
  });
});
