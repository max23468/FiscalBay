import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { duringServiceActivity, waitUntil } from "../app/service-activity.server";

import worker from "../workers/app";

import * as site from "../app/routes/site";

import * as features from "../app/routes/features";

import * as pricing from "../app/routes/pricing";

import * as siteSecurity from "../app/routes/site-security";

import * as faq from "../app/routes/faq";

import * as support from "../app/routes/support";

import * as legal from "../app/routes/legal";

import { fakeQueue, queued } from "./fixtures/queue-fixture";

import {
  now,
  send,
  environment,
  workerFetch,
  fetcher,
  receive,
  setupScenarios,
} from "./fixtures/webhooks-scenarios";

const router = vi.hoisted(() => ({ handle: vi.fn(), create: vi.fn() }));

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  createRequestHandler: router.create,
}));

setupScenarios(router);

it("lascia pagine e callback OAuth al router e rifiuta i metodi diversi", async () => {
  expect(await receive(new Request("https://test.fiscalbay.it/api/auth/callback/ebay"))).toBeNull();
  expect(await receive(new Request("https://test.fiscalbay.it/"))).toBeNull();
  const response = await receive(
    new Request("https://test.fiscalbay.it/webhooks/ebay", { method: "PUT" }),
  );
  expect(response?.status).toBe(405);
  expect(response?.headers.get("allow")).toBe("GET, POST");
  expect(send).not.toHaveBeenCalled();
});

it("il Worker intercetta il webhook prima di caricare la build React Router", async () => {
  expect(
    (
      await workerFetch(
        new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "PUT" }),
        environment,
      )
    )?.status,
  ).toBe(405);
  expect(
    (
      await workerFetch(
        new Request("https://test.fiscalbay.it/webhooks/ebay", { method: "POST", body: "{}" }),
        environment,
      )
    )?.status,
  ).toBe(412);
  expect(router.create).not.toHaveBeenCalled();
  expect(router.handle).not.toHaveBeenCalled();
});

it.each([
  ["https://test.fiscalbay.it", "/", "noindex, nofollow", undefined],
  ["https://fiscalbay.it", "/en/prezzi", null, undefined],
  // Termini e Privacy restano raggiungibili ma fuori dagli indici (D204).
  ["https://fiscalbay.it", "/en/privacy", "noindex, nofollow", undefined],
  ["https://fiscalbay.it", "/app/ordini", "noindex, nofollow", "synthetic-version"],
  ["https://fiscalbay.it", "/", null, "synthetic-version"],
])(
  "il Worker inoltra la richiesta e applica gli header per %s%s",
  async (origin, path, robots, version) => {
    router.handle.mockResolvedValue(new Response("pagina sintetica", { status: 201 }));
    const response = await workerFetch(
      new Request(`${origin}${path}`, {
        method: "POST",
        body: "campo=sintetico",
        headers: { cookie: "session=synthetic", "x-correlation-id": "forged" },
      }),
      {
        ...environment,
        APP_ORIGIN: origin,
        VERSION_METADATA: version ? { id: version } : undefined,
      } as Env,
    );
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("pagina sintetica");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(robots);
    expect(response.headers.get("x-fiscalbay-version")).toBe(version ?? null);
    expect(router.handle).toHaveBeenCalledOnce();
    const forwarded = router.handle.mock.calls[0]![0] as Request;
    expect(forwarded.url).toBe(`${origin}${path}`);
    expect(forwarded.method).toBe("POST");
    expect(await forwarded.text()).toBe("campo=sintetico");
    expect(forwarded.headers.get("cookie")).toBe("session=synthetic");
    const correlation = response.headers.get("x-correlation-id");
    expect(correlation).toMatch(/^[\da-f-]{36}$/u);
    expect(correlation).not.toBe("forged");
    expect(forwarded.headers.get("x-correlation-id")).toBe(correlation);
  },
);

it("il Worker risponde no-store a ogni pagina pubblica e in Production noindex ai soli legali", async () => {
  // Il router esegue il loader reale della pagina con gli header che la route dichiara, come
  // React Router: una route che chiedesse una cache pubblica la vedrebbe conservata.
  const pages: Record<string, { loader: (args: never) => unknown; headers?: () => HeadersInit }> = {
    "/": site,
    "/funzionalita": features,
    "/prezzi": pricing,
    "/sicurezza": siteSecurity,
    "/faq": faq,
    "/supporto": support,
    "/termini": legal,
    "/privacy": legal,
  };
  router.handle.mockImplementation(async (request: Request) => {
    const path = new URL(request.url).pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
    const page = pages[path]!;
    const data = await page.loader({ request, params: {}, context: {} } as never);
    return Response.json(data, { headers: page.headers?.() ?? {} });
  });
  try {
    for (const prefix of ["", "/en"])
      for (const path of Object.keys(pages)) {
        const url = `https://fiscalbay.it${prefix}${path === "/" && prefix ? "" : path}`;
        const response = await workerFetch(new Request(url), {
          ...environment,
          APP_ORIGIN: "https://fiscalbay.it",
        } as Env);
        expect(response.status, url).toBe(200);
        expect(response.headers.get("cache-control"), url).toBe("no-store");
        expect(response.headers.get("x-robots-tag"), url).toBe(
          path === "/termini" || path === "/privacy" ? "noindex, nofollow" : null,
        );
      }
  } finally {
    router.handle.mockReset();
  }
});

it("il Worker conserva cache e redirect dichiarati dal router anche con header immutabili", async () => {
  router.handle.mockResolvedValue(Response.redirect("https://test.fiscalbay.it/accesso", 303));
  const request = new Request("https://test.fiscalbay.it/app/ordini");
  const redirect = await workerFetch(request, environment);
  expect(redirect.status).toBe(303);
  expect(redirect.headers.get("location")).toBe("https://test.fiscalbay.it/accesso");
  expect(redirect.headers.get("cache-control")).toBe("no-store");
  router.handle.mockResolvedValue(
    new Response("pubblico", {
      headers: { "cache-control": "public, max-age=60" },
    }),
  );
  expect((await workerFetch(request, environment)).headers.get("cache-control")).toBe(
    "public, max-age=60",
  );
});

it("il Worker risponde all'errore del router con 500 correlato e senza dettagli riservati", async () => {
  router.handle.mockRejectedValue(new Error("NON-ESPORRE"));
  const response = await workerFetch(
    new Request("https://test.fiscalbay.it/app/ordini"),
    environment,
  );
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("");
  const forwarded = router.handle.mock.calls[0]![0] as Request;
  expect(response.headers.get("x-correlation-id")).toBe(forwarded.headers.get("x-correlation-id"));
  expect(response.headers.get("x-correlation-id")).toMatch(/^[\da-f-]{36}$/u);
});

it("la coda senza webhook chiude le sole sincronizzazioni senza riprovare messaggi inesistenti", async () => {
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  await worker.queue({ messages: [sync] } as unknown as MessageBatch<unknown>, environment);
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(sync.retry).not.toHaveBeenCalled();
  await worker.queue({ messages: [] } as unknown as MessageBatch<unknown>, environment);
  expect(send).not.toHaveBeenCalled();
});

it("un errore fuori dal consumer rimanda il messaggio con l'attesa, senza consumare i tentativi", async () => {
  const points: AnalyticsEngineDataPoint[] = [];
  const dataset: AnalyticsEngineDataset = { writeDataPoint: (point) => void points.push(point!) };
  const down = {
    ...environment,
    METRICS: dataset,
    DB: {
      prepare: () => {
        throw new Error("D1_ERROR: internal error");
      },
    } as unknown as D1Database,
  };
  const task = {
    body: { task: "telegram", slot: "2026-10-31T11:50:00.000Z" },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 2,
  };
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(
      worker.queue({ messages: [task] } as unknown as MessageBatch<unknown>, down),
    ).resolves.toBeUndefined();
  } finally {
    logged.mockRestore();
  }
  expect(task.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 60 });
  expect(task.ack).not.toHaveBeenCalled();
  expect(points.map(({ blobs }) => blobs?.slice(0, 5))).toContainEqual(
    expect.arrayContaining(["invocation", "queue", "unknown", "error"]),
  );
});

it("un errore dopo la chiusura di un messaggio non lo rimette in coda", async () => {
  const task = {
    body: { task: "telegram", slot: "2026-10-31T11:50:00.000Z" },
    ack: vi.fn(() => {
      throw new Error("ack non riuscito");
    }),
    retry: vi.fn(),
    attempts: 1,
  };
  await env.DB.prepare(
    `INSERT INTO scheduled_tasks (task, slot, queued_at, done_at) VALUES ('telegram', ?1, ?1, ?1)
      ON CONFLICT(task) DO UPDATE SET slot = ?1, done_at = ?1, locked_until = NULL`,
  )
    .bind(task.body.slot)
    .run();
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await worker.queue({ messages: [task] } as unknown as MessageBatch<unknown>, environment);
  } finally {
    logged.mockRestore();
  }
  expect(task.ack).toHaveBeenCalledOnce();
  expect(task.retry).not.toHaveBeenCalled();
});

it("coda, cron e ingresso dei webhook scrivono esito e durata su Analytics Engine", async () => {
  const points: AnalyticsEngineDataPoint[] = [];
  const dataset: AnalyticsEngineDataset = { writeDataPoint: (point) => void points.push(point!) };
  const metrics = { ...environment, METRICS: dataset };
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const unknown = { body: { altro: true }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await worker.queue({ messages: [sync, unknown] } as unknown as MessageBatch<unknown>, metrics);
  } finally {
    logged.mockRestore();
  }
  // Il consumer riceve i messaggi osservati: ack e retry arrivano a quelli originali.
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(unknown.retry).toHaveBeenCalledOnce();
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, {
    ...metrics,
    WORK_QUEUE: fakeQueue({ send, sendBatch: vi.fn().mockResolvedValue(queued) }),
  });
  const response = await workerFetch(
    new Request("https://test.fiscalbay.it/webhooks/stripe"),
    metrics,
  );
  expect(response.status).toBe(405);
  expect(
    points
      .filter((point) => point.blobs![0] === "invocation")
      .map((point) => point.blobs!.slice(1, 5)),
  ).toEqual([
    ["queue", "unknown", "", "retry"],
    ["queue", "sync", "", "ok"],
    ["cron", "dispatch", "", "ok"],
    ["http", "webhook", "GET", "4xx"],
  ]);
});

it("durante la sospensione pagine, webhook, coda e cron non toccano i dati", async () => {
  const sendBatch = vi.fn<Queue["sendBatch"]>().mockResolvedValue(queued);
  const suspended: Env = {
    ...environment,
    SERVICE_FROZEN: "true",
    WORK_QUEUE: fakeQueue({ send, sendBatch }),
  };
  const page = await workerFetch(new Request("https://test.fiscalbay.it/app/ordini"), suspended);
  expect(page.status).toBe(503);
  expect(page.headers.get("x-fiscalbay-frozen")).toBe("1");
  expect(page.headers.get("retry-after")).toBe("600");
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(await page.text()).toContain("<title>FiscalBay | Manutenzione</title>");
  const webhook = await workerFetch(
    new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "POST", body: "{}" }),
    suspended,
  );
  expect(webhook.status).toBe(503);
  expect(await webhook.text()).toBe("");
  expect(router.handle).not.toHaveBeenCalled();
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  await worker.queue({ messages: [sync] } as unknown as MessageBatch<unknown>, suspended);
  expect(sync.ack).not.toHaveBeenCalled();
  expect(sync.retry).toHaveBeenCalledWith({ delaySeconds: 43_200 });
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, suspended);
  expect(sendBatch).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  // Un valore diverso da «true» non sospende nulla.
  const open = await workerFetch(new Request("https://test.fiscalbay.it/webhooks/stripe"), {
    ...environment,
    SERVICE_FROZEN: "false",
  });
  expect(open.status).toBe(405);
});

it("il blocco D1 ferma coda e cron; le pagine si fermano con il segreto", async () => {
  await env.DB.prepare(`INSERT INTO service_settings (name, value, updated_at)
    VALUES ('recovery_frozen', 'true', ?)`)
    .bind(now.toISOString())
    .run();
  const sync = { body: { syncStore: "synthetic-store" }, retry: vi.fn() };
  await worker.queue({ messages: [sync] } as unknown as MessageBatch<unknown>, environment);
  expect(sync.retry).toHaveBeenCalledWith({ delaySeconds: 43_200 });
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, environment);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(0);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM scheduled_tasks").first("n")).toBe(0);
});

it("una richiesta HTTP non scrive nel registro delle attività", async () => {
  router.handle.mockImplementationOnce(async () => {
    const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n");
    return new Response(String(active));
  });
  const page = await workerFetch(new Request("https://test.fiscalbay.it/app/ordini"), environment);
  expect(await page.text()).toBe("0");
});

it("il ripristino vede un lavoro già entrato fino alla sua conclusione", async () => {
  let complete!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const run = duringServiceActivity(
    env.DB,
    async () => {
      entered();
      await pending;
    },
    () => {},
  );
  await started;
  await env.DB.prepare(`INSERT INTO service_settings (name, value, updated_at)
    VALUES ('recovery_frozen', 'true', ?)`)
    .bind(now.toISOString())
    .run();
  const next = vi.fn(async () => {});
  await duringServiceActivity(env.DB, next, () => {});
  expect(next).not.toHaveBeenCalled();
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(1);
  complete();
  await run;
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(0);
  await expect(
    duringServiceActivity(
      env.DB,
      async () => {
        throw new Error("not-entered");
      },
      () => {},
    ),
  ).resolves.toBeUndefined();
});

it("il lavoro in background mantiene attiva l'operazione dopo la risposta", async () => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  await duringServiceActivity(
    env.DB,
    async () => {
      waitUntil(pending);
    },
    () => {},
  );
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(1);
  complete();
  // Il rilascio attende le promise registrate con waitUntil, senza ritardi fissi.
  await vi.waitFor(async () => {
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(0);
  });
});

it("un lavoro fallito libera il proprio ingresso senza nascondere l'errore", async () => {
  await expect(
    duringServiceActivity(
      env.DB,
      async () => {
        throw new Error("synthetic");
      },
      () => {},
    ),
  ).rejects.toThrow("synthetic");
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(0);
});

it("il cron del Worker accoda i turni dell'orario pianificato, anche se eseguito in ritardo", async () => {
  const sendBatch = vi.fn<Queue["sendBatch"]>().mockResolvedValue(queued);
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, {
    ...environment,
    WORK_QUEUE: fakeQueue({ send, sendBatch }),
  });
  expect(sendBatch).toHaveBeenNthCalledWith(1, [
    { body: { task: "maintenance", slot: "2026-10-11T00:00:00.000Z" } },
    { body: { task: "export_files", slot: now.toISOString() } },
    { body: { task: "token_refresh", slot: now.toISOString() } },
    { body: { task: "inactivity", slot: now.toISOString() } },
    { body: { task: "billing", slot: now.toISOString() } },
    { body: { task: "telegram", slot: now.toISOString() } },
    { body: { task: "telegram_commands", slot: "2026-10-11T00:00:00.000Z" } },
    { body: { task: "ebay_quotas", slot: now.toISOString() } },
    { body: { task: "owner_incidents", slot: now.toISOString() } },
    { body: { task: "account_deletion", slot: now.toISOString() } },
  ]);
  expect(sendBatch).toHaveBeenNthCalledWith(2, [{ body: { syncStores: ["webhook-store"] } }]);
  expect(sendBatch).toHaveBeenCalledTimes(2);
  expect(fetcher).not.toHaveBeenCalled();
});
