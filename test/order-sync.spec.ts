import { env } from "cloudflare:workers";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { acquireOrders, consumeOrderConfirmation } from "../app/domain/order-acquisition.server";

import { setSwitch } from "../app/domain/service-settings.server";

import { refreshExpiringTokens } from "../app/domain/token-refresh.server";

import {
  consumeStoreSync,
  dispatchStoreSyncs,
  requestStoreSync,
  syncOrder,
} from "../app/domain/order-sync.server";

import {
  consumeTask,
  dispatchScheduledWork,
  dispatchTasks,
} from "../app/domain/scheduled-work.server";

import { listStores } from "../app/domain/stores.server";

import {
  saveStoreCredentials,
  sealToken,
} from "../app/integrations/ebay/seller-credentials.server";

import {
  insertCredentials,
  insertEntitlement,
  insertStorePause,
  now,
} from "./fixtures/database-fixtures";

import { fakeQueue, queueMessage, queued } from "./fixtures/queue-fixture";

import { withSandbox } from "./fixtures/ebay-fixtures";

import { access, order } from "./fixtures/ebay-client-fixtures";

import {
  grantedAt,
  ebay,
  slices,
  count,
  cronTurn,
  setupScenarios,
} from "./fixtures/order-acquisition-scenarios";

setupScenarios();

describe("lettura periodica e richieste manuali", () => {
  const start = Date.parse("2026-09-02T00:00:00.000Z");
  const minutes = (value: number) => new Date(start + value * 60_000);
  const send = vi.fn<Queue["send"]>();
  const queueEnv = { ...env, WORK_QUEUE: fakeQueue({ send }) };
  const message = () => {
    const ack = vi.fn();
    const retry = vi.fn();
    return { body: { syncStore: "s-a" }, ack, retry } as unknown as Message<unknown> & {
      ack: typeof ack;
      retry: typeof retry;
    };
  };
  const state = () =>
    env.DB.prepare(
      `SELECT polled_at, requested_at, dispatched_at, history_from, history_until,
                history_done_at FROM sync_state WHERE store_id = 's-a'`,
    ).first<Record<string, string | null>>();
  const runs = async () =>
    (
      await env.DB.prepare(
        "SELECT started_at, ok, new_orders FROM sync_runs WHERE store_id = 's-a' ORDER BY id",
      ).all()
    ).results;
  const request = (at: Date, options: { reimport?: boolean } = {}, userId = "u-a") =>
    requestStoreSync(queueEnv, userId, "s-a", options, at);

  beforeEach(async () => {
    send.mockReset();
    send.mockResolvedValue(queued);
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET access_token = ? WHERE store_id = 's-a'",
    )
      .bind(await sealToken(env.BETTER_AUTH_SECRET, "s-a", "access", "token-s-a"))
      .run();
  });

  it("ordina per piano, richiesta, arretrato e turno, escludendo chi non è dovuto", () => {
    const at = minutes(60);
    const candidate = (
      id: string,
      plan: "free" | "premium",
      polledMinute: number | null,
      extra: { requested?: boolean; backlog?: boolean } = {},
    ) => ({
      id,
      plan,
      polledAt: polledMinute === null ? null : minutes(polledMinute).toISOString(),
      requestedAt: extra.requested ? minutes(55).toISOString() : null,
      backlog: extra.backlog ?? false,
    });
    const order = syncOrder(
      [
        candidate("free-arretrato", "free", 50, { backlog: true }),
        candidate("free-recente", "free", 40),
        candidate("free-dovuto", "free", 31),
        candidate("premium-arretrato", "premium", 55, { backlog: true }),
        candidate("free-mai", "free", null),
        candidate("premium-dovuto", "premium", 51),
        candidate("premium-recente", "premium", 52),
        candidate("free-richiesto", "free", 58, { requested: true }),
        candidate("free-vecchio", "free", 10),
      ],
      at,
    ).map(({ id }) => id);
    expect(order).toEqual([
      "premium-dovuto",
      "free-richiesto",
      "free-mai",
      "free-vecchio",
      "free-dovuto",
      "premium-arretrato",
      "free-arretrato",
    ]);
  });

  it("dopo la lettura sottoscrive gli ordini una volta per consenso e riprova dopo un giorno", async () => {
    const outcome = () =>
      env.DB.prepare(
        "SELECT order_events, order_events_checked_at FROM ebay_store_credentials WHERE store_id = 's-a'",
      ).first();
    const notificationCalls = (fetcher: ReturnType<typeof ebay>) =>
      fetcher.mock.calls
        .map(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`)
        .filter((call) => call.includes("/commerce/notification/"));
    let created = 503;
    const provider = () =>
      ebay({
        fail: (url, init) => {
          if (url.pathname.endsWith("/destination"))
            return Response.json({
              destinations: [
                {
                  destinationId: "locale",
                  status: "ENABLED",
                  deliveryConfig: { endpoint: "http://localhost:5173/webhooks/ebay" },
                },
              ],
            });
          if (url.pathname.endsWith("/subscription") && init?.method === "POST") {
            // Il token del venditore, non quello dell'applicazione.
            expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-s-a");
            return new Response(null, { status: created });
          }
        },
      });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // eBay non risponde: la lettura riesce, il tentativo resta registrato e non si ripete
      // prima di un giorno.
      const failing = provider();
      await cronTurn(env, failing, minutes(0));
      expect(await state()).toMatchObject({ polled_at: minutes(0).toISOString() });
      expect(notificationCalls(failing)).toEqual([
        "GET /commerce/notification/v1/destination",
        "POST /commerce/notification/v1/subscription",
      ]);
      expect(await outcome()).toEqual({
        order_events: null,
        order_events_checked_at: minutes(0).toISOString(),
      });
      expect(
        errors.mock.calls.filter(([line]) => String(line).includes('"operation":"order_events"')),
      ).toHaveLength(1);
      await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
        .bind(minutes(60).toISOString())
        .run();
      const early = provider();
      await cronTurn(env, early, minutes(60));
      expect(notificationCalls(early)).toEqual([]);

      // Il giorno dopo la sottoscrizione riesce e non si ripete più per questo consenso.
      created = 201;
      const later = provider();
      await cronTurn(env, later, minutes(24 * 60 + 60));
      expect(notificationCalls(later)).toHaveLength(2);
      expect(await outcome()).toMatchObject({ order_events: "subscribed" });
      await env.DB.prepare(
        "UPDATE ebay_store_credentials SET order_events_checked_at = '2026-01-01T00:00:00.000Z'",
      ).run();
      await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
        .bind(minutes(3 * 24 * 60).toISOString())
        .run();
      const done = provider();
      await cronTurn(env, done, minutes(3 * 24 * 60));
      expect(notificationCalls(done)).toEqual([]);

      // Un nuovo consenso azzera l'esito: il ricollegamento riprova subito.
      await saveStoreCredentials(
        env,
        "s-a",
        {
          accessToken: "token-s-a",
          accessExpiresAt: minutes(4 * 24 * 60 + 120).toISOString(),
          refreshToken: "refresh",
          refreshExpiresAt: minutes(400 * 24 * 60).toISOString(),
        },
        minutes(4 * 24 * 60).toISOString(),
      );
      expect(await outcome()).toEqual({ order_events: null, order_events_checked_at: null });

      // Un consenso senza lo scope delle notifiche resta senza eventi fino al ricollegamento.
      created = 403;
      await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
        .bind(minutes(4 * 24 * 60 + 1).toISOString())
        .run();
      await cronTurn(env, provider(), minutes(4 * 24 * 60 + 1));
      expect(await outcome()).toMatchObject({ order_events: "unauthorized" });
      await env.DB.prepare(
        "UPDATE ebay_store_credentials SET order_events_checked_at = '2026-01-01T00:00:00.000Z'",
      ).run();
      await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
        .bind(minutes(6 * 24 * 60).toISOString())
        .run();
      const unauthorized = provider();
      await cronTurn(env, unauthorized, minutes(6 * 24 * 60));
      expect(notificationCalls(unauthorized)).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it("il cron legge con la cadenza Free e l'evento non attende il turno", async () => {
    const fetcher = ebay();
    await cronTurn(env, fetcher, minutes(0));
    expect(await state()).toMatchObject({ polled_at: minutes(0).toISOString() });
    expect(await runs()).toEqual([{ started_at: minutes(0).toISOString(), ok: 1, new_orders: 1 }]);

    // Dieci e venti minuti dopo il negozio Free non è dovuto e non ha arretrati.
    fetcher.mockClear();
    await cronTurn(env, fetcher, minutes(10));
    await cronTurn(env, fetcher, minutes(20));
    expect(fetcher).not.toHaveBeenCalled();

    // Un evento è letto subito e non sposta il turno della lettura periodica.
    fetcher.orders[0] = order({ lastModifiedDate: minutes(21).toISOString() });
    expect(
      await acquireOrders({
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: access(fetcher),
        now: minutes(22),
        budget: { calls: 12, pages: 0 },
        confirmedOrderId: "12-34567-89012",
      }),
    ).toBe("complete");
    expect(fetcher).toHaveBeenCalled();
    expect(await state()).toMatchObject({ polled_at: minutes(0).toISOString() });
    expect(await runs()).toHaveLength(1);

    fetcher.mockClear();
    await cronTurn(env, fetcher, minutes(30));
    expect(slices(fetcher, "lastmodifieddate")).toHaveLength(1);
    expect(await state()).toMatchObject({ polled_at: minutes(30).toISOString() });

    // Una richiesta rende il negozio dovuto anche se il cron l'aveva letto da poco: così si
    // riprende quella che la coda non ha consegnato.
    await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
      .bind(minutes(35).toISOString())
      .run();
    fetcher.mockClear();
    await cronTurn(env, fetcher, minutes(40));
    expect(slices(fetcher, "lastmodifieddate")).toHaveLength(1);
    expect(await state()).toMatchObject({ requested_at: null });

    // Lo storico ancora da importare è lavoro arretrato: si legge a ogni esecuzione utile.
    await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
    fetcher.mockClear();
    await cronTurn(env, fetcher, minutes(50));
    expect(slices(fetcher, "creationdate")).toHaveLength(1);
    fetcher.mockClear();
    await cronTurn(env, fetcher, minutes(60));
    expect(fetcher).not.toHaveBeenCalled();
    expect((await runs()).map(({ ok, new_orders }) => [ok, new_orders])).toEqual([
      [1, 0],
      [1, 0],
      [1, 0],
    ]);
  });

  it("unisce le richieste ripetute e le serve una volta, anche con consegne ripetute", async () => {
    expect(await request(minutes(0))).toBe("queued");
    expect(await request(minutes(1))).toBe("merged");
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ syncStore: "s-a" });
    expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

    const fetcher = ebay();
    const first = message();
    await consumeStoreSync(first, queueEnv, fetcher, minutes(2));
    expect(first.ack).toHaveBeenCalledOnce();
    expect(await state()).toMatchObject({
      requested_at: null,
      polled_at: minutes(2).toISOString(),
    });
    expect(await runs()).toEqual([{ started_at: minutes(2).toISOString(), ok: 1, new_orders: 1 }]);

    // La stessa consegna ripetuta trova la richiesta servita e non chiama eBay.
    fetcher.mockClear();
    const repeated = message();
    const errors = vi.spyOn(console, "error");
    await consumeStoreSync(repeated, queueEnv, fetcher, minutes(3));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(fetcher).not.toHaveBeenCalled();
    expect(repeated.ack).toHaveBeenCalledOnce();
    expect(await runs()).toHaveLength(1);

    // Dopo la lettura una nuova richiesta riparte; solo lo spazio proprietario la chiede, e
    // un negozio in pausa non legge.
    expect(await request(minutes(4))).toBe("queued");
    expect(await request(minutes(4), {}, "u-b")).toBe("not_found");
    await insertStorePause({ pausedAt: minutes(5).toISOString() }).run();
    expect(await request(minutes(5))).toBe("invalid");
    const paused = message();
    await consumeStoreSync(paused, queueEnv, fetcher, minutes(5));
    expect(fetcher).not.toHaveBeenCalled();
    expect(paused.ack).toHaveBeenCalledOnce();
    expect(await state()).toMatchObject({ requested_at: minutes(4).toISOString() });
  });

  it("con le chiamate eBay spente registra richieste ed eventi e li serve alla riaccensione", async () => {
    const fetcher = ebay();
    await setSwitch(env.DB, "ebay_calls", false, minutes(0));
    expect(await request(minutes(0))).toBe("suspended");
    expect(send).not.toHaveBeenCalled();
    expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

    // Né il cron né una consegna già in coda chiamano eBay; la richiesta resta.
    expect(await cronTurn(queueEnv, fetcher, minutes(10))).toEqual([]);
    const held = message();
    await consumeStoreSync(held, queueEnv, fetcher, minutes(11));
    expect(held.ack).toHaveBeenCalledOnce();
    expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

    // Un evento di eBay diventa una richiesta di lettura del negozio.
    await env.DB.prepare("UPDATE sync_state SET requested_at = NULL").run();
    await consumeOrderConfirmation(
      queueEnv,
      {
        storeId: "s-a",
        grantedAt,
        environment: "production",
        orderId: "12-34567-89012",
        eventAt: minutes(12).toISOString(),
      },
      fetcher,
      minutes(12),
    );
    expect(await state()).toMatchObject({ requested_at: minutes(12).toISOString() });

    // Nessun rinnovo dei token, nemmeno di quelli in scadenza.
    const { access_expires_at: expiresAt } = (await env.DB.prepare(
      "SELECT access_expires_at FROM ebay_store_credentials WHERE store_id = 's-a'",
    ).first<{ access_expires_at: string }>())!;
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
      .bind(minutes(20).toISOString())
      .run();
    expect(await refreshExpiringTokens(queueEnv, fetcher, minutes(13))).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
      .bind(expiresAt)
      .run();

    // Alla riaccensione il cron serve la richiesta rimasta.
    await setSwitch(env.DB, "ebay_calls", true, minutes(14));
    expect(await cronTurn(queueEnv, fetcher, minutes(20))).toEqual(["s-a"]);
    expect(await state()).toMatchObject({
      requested_at: null,
      polled_at: minutes(20).toISOString(),
    });
  });

  it("con invii Telegram spenti, acquisti chiusi e Stripe irraggiungibile legge eBay", async () => {
    for (const name of ["telegram_sends", "purchases_open"] as const)
      await setSwitch(env.DB, name, false, minutes(0));
    const fetcher = ebay({
      fail: (url) =>
        ["api.stripe.com", "api.telegram.org"].includes(url.hostname)
          ? new Response(null, { status: 503 })
          : undefined,
    });
    expect(await request(minutes(0))).toBe("queued");
    const read = message();
    await consumeStoreSync(read, queueEnv, fetcher, minutes(1));
    expect(read.ack).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalled();
    expect(
      fetcher.mock.calls.every(([input]) => new URL(String(input)).hostname.includes("ebay")),
    ).toBe(true);
    expect(await runs()).toMatchObject([{ started_at: minutes(1).toISOString(), ok: 1 }]);
  });

  it("dopo la lettura anticipa le notifiche Telegram del solo spazio del negozio", async () => {
    // Bot configurato e una consegna in attesa di un altro spazio senza Premium: la chiude
    // soltanto il compito periodico, non la lettura di questo negozio.
    const telegram = {
      ...queueEnv,
      TELEGRAM_BOT_USERNAME: "fiscalbay_test_bot",
      TELEGRAM_BOT_TOKEN: "000000:telegram-local-synthetic",
      TELEGRAM_WEBHOOK_SECRET: "telegram-local-synthetic-webhook-secret",
    } as Env;
    await env.DB.prepare(`INSERT INTO telegram_deliveries (id, workspace_id, link_id, kind,
          event_key, event_at, created_at) VALUES ('altro', 'w-b', 'l-b', 'digest', 'turno', ?1, ?1)`)
      .bind(minutes(0).toISOString())
      .run();
    const pending = () =>
      env.DB.prepare("SELECT failed_at FROM telegram_deliveries WHERE id = 'altro'").first();
    expect(await request(minutes(0))).toBe("queued");
    await consumeStoreSync(message(), telegram, ebay(), minutes(1));
    expect(await pending()).toEqual({ failed_at: null });

    // Un errore delle notifiche si registra e non annulla la lettura già scritta.
    const unavailable = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare")
          return (sql: string) => {
            if (sql.includes("FROM telegram_links l")) throw new Error("telegram_unavailable");
            return target.prepare(sql);
          };
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await request(minutes(10))).toBe("queued");
    const read = message();
    await consumeStoreSync(read, { ...telegram, DB: unavailable } as Env, ebay(), minutes(11));
    expect(read.ack).toHaveBeenCalledOnce();
    expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)).operation)).toEqual([
      "telegram",
    ]);
    errors.mockRestore();
    expect((await runs()).at(-1)).toMatchObject({ started_at: minutes(11).toISOString(), ok: 1 });
  });

  it("riprende una richiesta dopo una coda non disponibile o un'esecuzione interrotta", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // La coda rifiuta l'invio: la richiesta resta in D1 e il cron la serve.
      send.mockRejectedValueOnce(new Error("queue unavailable"));
      expect(await request(minutes(0))).toBe("queued");
      expect(String(errors.mock.calls.at(-1)?.[0])).toContain('"operation":"order_acquisition"');
      expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
      const fetcher = ebay();
      await cronTurn(env, fetcher, minutes(0.5));
      expect(fetcher).toHaveBeenCalled();
      expect(await state()).toMatchObject({ requested_at: null });

      // Un'esecuzione interrotta lascia il negozio tenuto: la consegna riprova più tardi
      // senza chiamare eBay, poi alla scadenza del blocco la richiesta si completa.
      expect(await request(minutes(1))).toBe("queued");
      await env.DB.prepare("UPDATE sync_state SET locked_until = ?")
        .bind(minutes(16).toISOString())
        .run();
      fetcher.mockClear();
      const held = message();
      await consumeStoreSync(held, queueEnv, fetcher, minutes(2));
      expect(fetcher).not.toHaveBeenCalled();
      expect(held.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
      expect(held.ack).not.toHaveBeenCalled();
      const resumed = message();
      await consumeStoreSync(resumed, queueEnv, fetcher, minutes(16));
      expect(resumed.ack).toHaveBeenCalledOnce();
      expect(await state()).toMatchObject({ requested_at: null });
      // La rilettura non duplica l'ordine già acquisito.
      expect(await count("SELECT count(*) AS total FROM orders WHERE store_id = 's-a'")).toBe(1);
    } finally {
      errors.mockRestore();
    }
  });

  it("rispetta l'attesa chiesta da eBay per tutto il keyset", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await request(minutes(0))).toBe("queued");
      const limited = ebay({
        fail: () => new Response(null, { status: 429, headers: { "retry-after": "600" } }),
      });
      const first = message();
      await consumeStoreSync(first, queueEnv, limited, minutes(1));
      expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 600 });
      expect(String(errors.mock.calls.at(-1)?.[0])).toContain('"operation":"order_acquisition"');
      // La richiesta resta per la ripresa; la lettura non riuscita compare fra le ultime.
      expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
      expect(await runs()).toEqual([
        { started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 },
      ]);

      // Durante l'attesa né la coda né il cron chiamano eBay e l'utente lo sa.
      expect(await request(minutes(2))).toBe("limited");
      const fetcher = ebay();
      const early = message();
      await consumeStoreSync(early, queueEnv, fetcher, minutes(6));
      expect(early.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
      // Il cron esclude il keyset in attesa senza tentare né registrare errori.
      errors.mockClear();
      await cronTurn(env, fetcher, minutes(10));
      expect(fetcher).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();

      await cronTurn(env, fetcher, minutes(11));
      expect(fetcher).toHaveBeenCalled();
      expect(await state()).toMatchObject({ requested_at: null });
    } finally {
      errors.mockRestore();
    }
  });

  it("dopo un limite il cron non tenta gli altri negozi dello stesso keyset", async () => {
    await insertCredentials({
      storeId: "s-b",
      accessToken: await sealToken(env.BETTER_AUTH_SECRET, "s-b", "access", "token-s-b"),
      accessExpiresAt: now,
      grantedAt,
    }).run();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = (status: number) =>
      ebay({
        fail: (_, init) =>
          new Headers(init?.headers).get("authorization") === "Bearer token-s-a"
            ? new Response(null, { status })
            : undefined,
      });
    const polledB = () =>
      env.DB.prepare("SELECT polled_at FROM sync_state WHERE store_id = 's-b'").first();
    try {
      // Un errore del solo negozio non ferma gli altri.
      const rejected = failing(401);
      await cronTurn(env, rejected, minutes(0));
      expect(await polledB()).toEqual({ polled_at: minutes(0).toISOString() });
      expect(errors).toHaveBeenCalledOnce();

      // Un limite sì: il negozio non tentato resta il primo del prossimo turno utile.
      errors.mockClear();
      const limited = failing(429);
      await cronTurn(env, limited, minutes(30));
      expect(limited).toHaveBeenCalledOnce();
      expect(errors).toHaveBeenCalledOnce();
      expect(await polledB()).toEqual({ polled_at: minutes(0).toISOString() });
    } finally {
      errors.mockRestore();
    }
  });

  it("i negozi di un keyset in attesa non tolgono il turno a quelli dell'altro ambiente", async () => {
    const sandbox = withSandbox(env);
    await env.DB.prepare(
      `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, ebay_environment)
         VALUES ('s-c', 'w-a', 'e-c', ?1, 'production'), ('s-d', 'w-a', 'e-d', ?1, 'production'),
                ('s-e', 'w-a', 'e-e', ?1, 'sandbox')`,
    )
      .bind(now)
      .run();
    for (const storeId of ["s-c", "s-d", "s-e"])
      await insertCredentials({
        storeId,
        accessToken: await sealToken(env.BETTER_AUTH_SECRET, storeId, "access", `token-${storeId}`),
        accessExpiresAt: now,
        grantedAt,
      }).run();
    // La quota esaurita di una sola chiamata Trading non ferma le letture dell'origine.
    await env.DB.prepare(
      `INSERT INTO ebay_rate_limits (api_origin, until)
         VALUES ('https://api.ebay.com', ?1), ('https://api.sandbox.ebay.com#GetOrders', ?1)`,
    )
      .bind(minutes(15).toISOString())
      .run();
    const fetcher = ebay();
    await cronTurn(sandbox, fetcher, minutes(0));
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).origin)).toContain(
      "https://api.sandbox.ebay.com",
    );
    expect(
      fetcher.mock.calls.every(
        ([input]) => new URL(String(input)).origin === "https://api.sandbox.ebay.com",
      ),
    ).toBe(true);
  });

  it("mostra nella schermata le letture non riuscite e nessuna per un negozio mai letto", async () => {
    await env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at) VALUES ('s-c', 'w-a', 'e-c', ?)",
    )
      .bind(now)
      .run();
    await env.DB.prepare(
      "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES ('s-a', ?, 0, 0)",
    )
      .bind(minutes(0).toISOString())
      .run();
    const stores = await listStores(env.DB, "u-a", minutes(1));
    expect(Object.fromEntries(stores.map((store) => [store.id, store.recent]))).toEqual({
      "s-a": [{ at: minutes(0).toISOString(), ok: false, newOrders: 0 }],
      "s-c": [],
    });
  });

  it("un evento non riuscito non compare fra le letture e non serve la richiesta", async () => {
    expect(await request(minutes(0))).toBe("queued");
    await expect(
      acquireOrders({
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: access(ebay({ fail: () => new Response(null, { status: 503 }) })),
        now: minutes(1),
        budget: { calls: 12, pages: 0 },
        confirmedOrderId: "12-34567-89012",
      }),
    ).rejects.toMatchObject({ failure: "unavailable" });
    expect(await runs()).toEqual([]);
    expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
  });

  it("una lettura fallita serve la richiesta e un'attesa nota ferma l'acquisizione", async () => {
    expect(await request(minutes(0))).toBe("queued");
    const rejected = ebay({ fail: () => new Response(null, { status: 401 }) });
    const read = (fetcher: typeof fetch, at: Date) =>
      acquireOrders({
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: access(fetcher),
        now: at,
        budget: { calls: 12, pages: 3 },
      });
    await expect(read(rejected, minutes(1))).rejects.toMatchObject({ failure: "credentials" });
    expect(await state()).toMatchObject({ requested_at: null });
    expect(await runs()).toEqual([{ started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 }]);

    await env.DB.prepare(
      "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
    )
      .bind(minutes(7).toISOString())
      .run();
    const fetcher = ebay();
    await expect(read(fetcher, minutes(2))).rejects.toMatchObject({
      failure: "rate_limited",
      details: { retryAfter: 300 },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("dopo una lettura non riuscita l'arretrato attende la cadenza del piano", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // Storico mai importato e lettura rifiutata: nessun nuovo tentativo ogni dieci minuti.
      await cronTurn(env, ebay({ fail: () => new Response(null, { status: 401 }) }), minutes(0));
      const fetcher = ebay();
      await cronTurn(env, fetcher, minutes(10));
      await cronTurn(env, fetcher, minutes(20));
      expect(fetcher).not.toHaveBeenCalled();
      await cronTurn(env, fetcher, minutes(30));
      expect(slices(fetcher, "creationdate")).toHaveLength(1);

      // Dopo una lettura riuscita l'arretrato riprende al turno successivo.
      await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(40));
      expect(slices(fetcher, "creationdate")).toHaveLength(1);
    } finally {
      errors.mockRestore();
    }
  });

  it("non anticipa l'arretrato di un negozio letto da meno di nove minuti", async () => {
    await cronTurn(env, ebay(), minutes(0));
    await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
    const fetcher = ebay();
    await cronTurn(env, fetcher, minutes(8));
    expect(fetcher).not.toHaveBeenCalled();
    await cronTurn(env, fetcher, minutes(9));
    expect(slices(fetcher, "creationdate")).toHaveLength(1);
  });

  it("con il token in rinnovo lascia la richiesta al cron e chiude gli altri errori", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await request(minutes(0))).toBe("queued");
      await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
        .bind(minutes(4).toISOString())
        .run();
      const fetcher = ebay();
      const renewing = message();
      await consumeStoreSync(renewing, queueEnv, fetcher, minutes(0));
      expect(fetcher).not.toHaveBeenCalled();
      expect(renewing.ack).toHaveBeenCalledOnce();
      expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

      // Un errore diverso dal limite chiude la consegna: l'esito resta fra le ultime letture.
      await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
        .bind(now)
        .run();
      const rejected = message();
      await consumeStoreSync(
        rejected,
        queueEnv,
        ebay({ fail: () => new Response(null, { status: 401 }) }),
        minutes(1),
      );
      expect(rejected.ack).toHaveBeenCalledOnce();
      expect(rejected.retry).not.toHaveBeenCalled();
      expect(await state()).toMatchObject({ requested_at: null });
      expect(await runs()).toEqual([
        { started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 },
      ]);
    } finally {
      errors.mockRestore();
    }
  });

  it("non registra richieste per un negozio in pausa o scollegato, neanche in importazione", async () => {
    await cronTurn(env, ebay(), minutes(0));
    await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
    await insertStorePause({ pausedAt: minutes(1).toISOString() }).run();
    expect(await request(minutes(1), { reimport: true })).toBe("invalid");
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
    await env.DB.prepare("DELETE FROM ebay_store_credentials").run();
    expect(await request(minutes(2), { reimport: true })).toBe("invalid");
    expect(await state()).toMatchObject({ requested_at: null });
    expect(send).not.toHaveBeenCalled();
  });

  it("reimporta lo storico solo a importazione conclusa", async () => {
    // Prima del primo avvio la richiesta avvia l'importazione.
    expect(await request(minutes(0), { reimport: true })).toBe("queued");
    await consumeStoreSync(message(), queueEnv, ebay(), minutes(1));
    expect(await state()).toMatchObject({
      history_from: "2026-08-03T00:01:00.000Z",
      history_done_at: minutes(1).toISOString(),
    });

    expect(await request(minutes(60 * 24), { reimport: true })).toBe("queued");
    expect(await state()).toMatchObject({
      history_from: "2026-08-04T00:00:00.000Z",
      history_until: minutes(60 * 24).toISOString(),
      history_done_at: null,
    });
    // Una seconda richiesta durante l'importazione non la fa ripartire.
    expect(await request(minutes(60 * 24 + 1), { reimport: true })).toBe("importing");
    expect(await state()).toMatchObject({ history_until: minutes(60 * 24).toISOString() });
    expect(send).toHaveBeenCalledTimes(2);

    const fetcher = ebay();
    await consumeStoreSync(message(), queueEnv, fetcher, minutes(60 * 24 + 2));
    expect(slices(fetcher, "creationdate")).toHaveLength(1);
    expect(await state()).toMatchObject({
      history_done_at: minutes(60 * 24 + 2).toISOString(),
    });
  });

  it("con una copertura la reimportazione riparte da un anno di storico", async () => {
    expect(await request(minutes(0), { reimport: true })).toBe("queued");
    await consumeStoreSync(message(), queueEnv, ebay(), minutes(1));
    await insertEntitlement({
      id: "e-reimport",
      source: "premium",
      startsAt: minutes(2).toISOString(),
      endsAt: minutes(60 * 24 * 30).toISOString(),
    }).run();
    expect(await request(minutes(60), { reimport: true })).toBe("queued");
    expect(await state()).toMatchObject({
      history_from: "2025-09-02T01:00:00.000Z",
      history_until: minutes(60).toISOString(),
      history_done_at: null,
    });
  });

  it("conserva le ultime tre letture con gli ordini nuovi di ciascuna", async () => {
    const fetcher = ebay({ orders: [] });
    for (let index = 0; index < 6; index += 1) {
      if (index === 3)
        fetcher.orders.push(
          order({
            orderId: "12-nuovo",
            creationDate: minutes(80).toISOString(),
            lastModifiedDate: minutes(80).toISOString(),
          }),
        );
      await cronTurn(env, fetcher, minutes(index * 30));
    }
    expect((await runs()).map(({ started_at, new_orders }) => [started_at, new_orders])).toEqual([
      [minutes(90).toISOString(), 1],
      [minutes(120).toISOString(), 0],
      [minutes(150).toISOString(), 0],
    ]);
  });

  it("rinnovo del token e ricollegamento durante una lettura non ripristinano stati superati", async () => {
    // Il rinnovo cambia soltanto il token: la lettura partita prima scrive con lo stesso consenso.
    expect(await request(minutes(0))).toBe("queued");
    const refreshed = ebay({
      before: async () => {
        await env.DB.prepare(
          "UPDATE ebay_store_credentials SET access_token = 'rinnovato', refreshed_at = ?",
        )
          .bind(minutes(1).toISOString())
          .run();
      },
    });
    const first = message();
    await consumeStoreSync(first, queueEnv, refreshed, minutes(1));
    expect(first.ack).toHaveBeenCalledOnce();
    expect(await count("SELECT count(*) AS total FROM orders WHERE store_id = 's-a'")).toBe(1);

    // Un ricollegamento a metà lettura cambia il consenso: nessuna scrittura né lettura
    // registrata, e la richiesta resta per il nuovo consenso.
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_token = ?")
      .bind(await sealToken(env.BETTER_AUTH_SECRET, "s-a", "access", "token-s-a"))
      .run();
    expect(await request(minutes(2))).toBe("queued");
    const reconnected = ebay({
      orders: [order({ orderId: "12-dopo", lastModifiedDate: minutes(2).toISOString() })],
      before: async () => {
        await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
          .bind(minutes(2).toISOString())
          .run();
      },
    });
    const second = message();
    await consumeStoreSync(second, queueEnv, reconnected, minutes(3));
    expect(second.ack).toHaveBeenCalledOnce();
    expect(
      await count("SELECT count(*) AS total FROM orders WHERE ebay_order_id = '12-dopo'"),
    ).toBe(0);
    expect(await runs()).toHaveLength(1);
    expect(await state()).toMatchObject({ requested_at: minutes(2).toISOString() });
  });

  describe("smistamento del cron", () => {
    const sendBatch = vi.fn<Queue["sendBatch"]>();
    const cron = { ...env, WORK_QUEUE: { send, sendBatch } } as unknown as Env;

    beforeEach(async () => {
      sendBatch.mockReset();
      sendBatch.mockResolvedValue(queued);
    });

    it("accoda un negozio una volta anche con trigger ripetuti e riaccoda un turno perso", async () => {
      expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
      expect(sendBatch).toHaveBeenCalledWith([{ body: { syncStores: ["s-a"] } }]);
      // Lo stesso turno ricevuto più volte, anche con orari a pochi secondi di distanza.
      expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual([]);
      expect(await dispatchStoreSyncs(cron, minutes(0.1))).toEqual([]);
      expect(sendBatch).toHaveBeenCalledOnce();

      // Il messaggio accettato non arriva più (scaduto o nella DLQ): il checkpoint resta e
      // dopo un'ora il turno si riaccoda.
      expect(await dispatchStoreSyncs(cron, minutes(59))).toEqual([]);
      expect(await dispatchStoreSyncs(cron, minutes(60))).toEqual(["s-a"]);
      const fetcher = ebay();
      const served = message();
      await consumeStoreSync(served, env, fetcher, minutes(61));
      expect(served.ack).toHaveBeenCalledOnce();
      expect(await state()).toMatchObject({
        polled_at: minutes(61).toISOString(),
        dispatched_at: null,
      });
      // Il messaggio originale consegnato in ritardo trova il turno già servito.
      fetcher.mockClear();
      const late = message();
      await consumeStoreSync(late, env, fetcher, minutes(62));
      expect(fetcher).not.toHaveBeenCalled();
      expect(late.ack).toHaveBeenCalledOnce();

      // Il prossimo turno segue la cadenza Free.
      expect(await dispatchStoreSyncs(cron, minutes(80))).toEqual([]);
      expect(await dispatchStoreSyncs(cron, minutes(90))).toEqual(["s-a"]);
    });

    it("durante la prova legge con la cadenza Premium e poi torna a quella Free", async () => {
      expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
      await consumeStoreSync(message(), env, ebay(), minutes(1));
      expect(await dispatchStoreSyncs(cron, minutes(11))).toEqual([]);
      await insertEntitlement({
        id: "prova",
        source: "trial",
        startsAt: minutes(5).toISOString(),
        endsAt: minutes(20).toISOString(),
      }).run();
      expect(await dispatchStoreSyncs(cron, minutes(11))).toEqual(["s-a"]);
      await consumeStoreSync(message(), env, ebay(), minutes(12));
      // Alla fine della prova il turno segue di nuovo la cadenza Free.
      expect(await dispatchStoreSyncs(cron, minutes(23))).toEqual([]);
      expect(await dispatchStoreSyncs(cron, minutes(42))).toEqual(["s-a"]);
    });

    it("fra trigger sovrapposti uno solo prende il turno di un negozio", async () => {
      const turns = await Promise.all([
        dispatchStoreSyncs(cron, minutes(0)),
        dispatchStoreSyncs(cron, minutes(0)),
      ]);
      expect(turns.flat()).toEqual(["s-a"]);
      expect(sendBatch).toHaveBeenCalledOnce();
    });

    it("accoda anche un negozio di un ambiente non configurato, che poi passa il turno", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await env.DB.prepare("UPDATE ebay_stores SET ebay_environment = 'sandbox'").run();
        await env.DB.prepare(
          "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
        )
          .bind(minutes(15).toISOString())
          .run();
        expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
        const fetcher = ebay();
        const turn = message();
        await consumeStoreSync(turn, env, fetcher, minutes(1));
        expect(fetcher).not.toHaveBeenCalled();
        expect(turn.ack).toHaveBeenCalledOnce();
        expect(errors).toHaveBeenCalledOnce();
        expect(await state()).toMatchObject({
          polled_at: minutes(1).toISOString(),
          dispatched_at: null,
        });
      } finally {
        errors.mockRestore();
      }
    });

    it("con la coda non disponibile libera il turno per il trigger successivo", async () => {
      sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));
      await expect(dispatchStoreSyncs(cron, minutes(0))).rejects.toThrow("queue unavailable");
      expect(await state()).toMatchObject({ dispatched_at: null, polled_at: null });
      expect(await dispatchStoreSyncs(cron, minutes(10))).toEqual(["s-a"]);
    });

    /** Altri negozi dello spazio con le credenziali di `s-a`, che per loro non si aprono. */
    const otherStores = async (count: number) => {
      await env.DB.prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ?1)
           INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
           SELECT printf('s-%03d', n), workspace_id, printf('e-%03d', n), linked_at
             FROM ebay_stores, seq WHERE id = 's-a'`,
      )
        .bind(count)
        .run();
      await env.DB.prepare(
        `INSERT INTO ebay_store_credentials
             (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
           SELECT s.id, c.access_token, c.access_expires_at, c.refresh_token, c.refresh_expires_at,
                  c.granted_at
             FROM ebay_stores s, ebay_store_credentials c
            WHERE c.store_id = 's-a' AND s.id GLOB 's-[0-9][0-9][0-9]'`,
      ).run();
    };
    const turns = async () =>
      (
        await env.DB.prepare(
          `SELECT s.id, ss.dispatched_at, ss.polled_at FROM ebay_stores s
               LEFT JOIN sync_state ss ON ss.store_id = s.id
              WHERE s.id = 's-a' OR s.id GLOB 's-[0-9][0-9][0-9]' ORDER BY s.id`,
        ).all<{ id: string; dispatched_at: string | null; polled_at: string | null }>()
      ).results;

    it("accoda i negozi dovuti a gruppi da dieci in un solo invio", async () => {
      await otherStores(249);
      const claimed = await dispatchStoreSyncs(cron, minutes(0));
      expect(claimed).toHaveLength(250);
      expect(sendBatch).toHaveBeenCalledOnce();
      const groups = [...sendBatch.mock.calls[0]![0]].map(
        ({ body }) => (body as { syncStores: string[] }).syncStores,
      );
      expect(groups.flat()).toEqual(claimed);
      expect(groups.slice(0, -1).every((group) => group.length === 10)).toBe(true);
      expect(groups.at(-1)!.length).toBe(claimed.length - (groups.length - 1) * 10);
      expect((await turns()).every(({ dispatched_at }) => dispatched_at !== null)).toBe(true);
    });

    it("un gruppo serve i negozi in sequenza e chiude ogni turno anche dopo un errore", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await otherStores(2);
        await dispatchStoreSyncs(cron, minutes(0));
        const [[[{ body }]]] = sendBatch.mock.calls as [[MessageSendRequest[]]];
        expect(body).toEqual({ syncStores: ["s-001", "s-002", "s-a"] });
        const fetcher = ebay();
        const group = queueMessage(body);
        await consumeStoreSync(group, env, fetcher, minutes(1));
        expect(group.ack).toHaveBeenCalledOnce();
        expect(group.retry).not.toHaveBeenCalled();
        // I due token che non si aprono chiudono il turno con l'errore; `s-a` legge da eBay.
        expect(errors).toHaveBeenCalledTimes(2);
        expect(fetcher).toHaveBeenCalled();
        expect(await turns()).toMatchObject([
          { id: "s-001", dispatched_at: null },
          { id: "s-002", dispatched_at: null },
          { id: "s-a", dispatched_at: null, polled_at: minutes(1).toISOString() },
        ]);
      } finally {
        errors.mockRestore();
      }
    });

    it("con un limite di eBay il gruppo si chiude e i negozi tornano al cron dopo l'attesa", async () => {
      await otherStores(2);
      await dispatchStoreSyncs(cron, minutes(0));
      const [[[{ body }]]] = sendBatch.mock.calls as [[MessageSendRequest[]]];
      await env.DB.prepare(
        "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
      )
        .bind(minutes(15).toISOString())
        .run();
      const fetcher = ebay();
      const group = queueMessage(body);
      await consumeStoreSync(group, env, fetcher, minutes(1));
      expect(group.ack).toHaveBeenCalledOnce();
      expect(group.retry).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(await turns()).toEqual(
        ["s-001", "s-002", "s-a"].map((id) => ({ id, dispatched_at: null, polled_at: null })),
      );
      expect(await dispatchStoreSyncs(cron, minutes(2))).toEqual([]);
      expect((await dispatchStoreSyncs(cron, minutes(16))).sort()).toEqual([
        "s-001",
        "s-002",
        "s-a",
      ]);
    });

    it("un negozio occupato torna al cron da solo e il gruppo prosegue", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await otherStores(1);
        await dispatchStoreSyncs(cron, minutes(0));
        await env.DB.prepare("UPDATE sync_state SET locked_until = ? WHERE store_id = 's-a'")
          .bind(minutes(10).toISOString())
          .run();
        const group = queueMessage({ syncStores: ["s-a", "s-001"] });
        await consumeStoreSync(group, env, ebay(), minutes(1));
        expect(group.ack).toHaveBeenCalledOnce();
        expect(group.retry).not.toHaveBeenCalled();
        // `s-a` resta al cron senza chiamare eBay; `s-001` viene servito dopo e chiude il
        // turno con l'errore del token, che per lui non si apre.
        expect(errors).toHaveBeenCalledOnce();
        expect(await turns()).toMatchObject([
          { id: "s-001", dispatched_at: null },
          { id: "s-a", dispatched_at: null, polled_at: null },
        ]);
      } finally {
        errors.mockRestore();
      }
    });

    it("un limite di eBay a metà gruppo ferma anche i negozi di un'altra origine che seguono", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await otherStores(2);
        await dispatchStoreSyncs(cron, minutes(0));
        // `s-002` è di un ambiente senza configurazione, con una richiesta manuale in attesa:
        // servito, registrerebbe un errore e passerebbe il turno.
        await env.DB.prepare(
          "UPDATE ebay_stores SET ebay_environment = 'sandbox' WHERE id = 's-002'",
        ).run();
        // Attesa già nota per Production e limite ricevuto da eBay durante la lettura.
        for (const [known, group] of [
          [true, ["s-001", "s-002"]],
          [false, ["s-a", "s-002"]],
        ] as const) {
          await env.DB.prepare("DELETE FROM ebay_rate_limits").run();
          await env.DB.prepare(
            `UPDATE sync_state SET dispatched_at = ?1, polled_at = NULL, locked_until = NULL,
                  requested_at = CASE WHEN store_id = 's-002' THEN ?1 END`,
          )
            .bind(minutes(0).toISOString())
            .run();
          if (known)
            await env.DB.prepare(
              "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
            )
              .bind(minutes(15).toISOString())
              .run();
          errors.mockClear();
          const message = queueMessage({ syncStores: [...group] });
          await consumeStoreSync(
            message,
            env,
            ebay({ fail: () => new Response(null, { status: 429 }) }),
            minutes(1),
          );
          expect(message.ack).toHaveBeenCalledOnce();
          // Ogni turno del gruppo torna al cron e il negozio che segue non viene servito: se lo
          // fosse, registrerebbe l'errore dell'ambiente senza configurazione. Il limite ricevuto
          // da eBay ne registra uno.
          const served = await turns();
          for (const id of group)
            expect(served.find((turn) => turn.id === id)!.dispatched_at).toBeNull();
          expect(errors).toHaveBeenCalledTimes(known ? 0 : 1);
        }
      } finally {
        errors.mockRestore();
      }
    });

    it("non accoda negozi di un keyset in attesa né negozi in pausa", async () => {
      await env.DB.prepare(
        "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
      )
        .bind(minutes(15).toISOString())
        .run();
      expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual([]);
      await env.DB.prepare("DELETE FROM ebay_rate_limits").run();
      await insertStorePause({ pausedAt: minutes(1).toISOString() }).run();
      expect(await dispatchStoreSyncs(cron, minutes(1))).toEqual([]);
      expect(sendBatch).not.toHaveBeenCalled();
    });

    it("il cron accoda compiti e letture senza chiamare eBay e un passo fallito non ferma gli altri", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetcher = vi.spyOn(globalThis, "fetch");
      try {
        sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));
        await dispatchScheduledWork(cron, minutes(0));
        expect(JSON.parse(String(errors.mock.calls[0]![0]))).toMatchObject({
          operation: "scheduling",
        });
        expect(sendBatch).toHaveBeenLastCalledWith([{ body: { syncStores: ["s-a"] } }]);
        // I compiti non accodati restano al trigger successivo dello stesso periodo.
        await dispatchScheduledWork(cron, minutes(1));
        expect(sendBatch).toHaveBeenLastCalledWith([
          { body: { task: "maintenance", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "export_files", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "token_refresh", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "inactivity", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "billing", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "telegram", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "telegram_commands", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "ebay_quotas", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "owner_incidents", slot: "2026-09-02T00:00:00.000Z" } },
          { body: { task: "account_deletion", slot: "2026-09-02T00:00:00.000Z" } },
        ]);
        expect(sendBatch).toHaveBeenCalledTimes(3);
        expect(fetcher).not.toHaveBeenCalled();
      } finally {
        errors.mockRestore();
        fetcher.mockRestore();
      }
    });

    it("accoda ogni compito una volta per periodo con trigger ripetuti, sovrapposti o saltati", async () => {
      const slot = (minute: number) => ({ slot: minutes(minute).toISOString() });
      expect(await dispatchTasks(cron, minutes(0))).toEqual([
        "maintenance",
        "export_files",
        "token_refresh",
        "inactivity",
        "billing",
        "telegram",
        "telegram_commands",
        "ebay_quotas",
        "owner_incidents",
        "account_deletion",
      ]);
      expect(sendBatch).toHaveBeenCalledWith([
        { body: { task: "maintenance", ...slot(0) } },
        { body: { task: "export_files", ...slot(0) } },
        { body: { task: "token_refresh", ...slot(0) } },
        { body: { task: "inactivity", ...slot(0) } },
        { body: { task: "billing", ...slot(0) } },
        { body: { task: "telegram", ...slot(0) } },
        { body: { task: "telegram_commands", ...slot(0) } },
        { body: { task: "ebay_quotas", ...slot(0) } },
        { body: { task: "owner_incidents", ...slot(0) } },
        { body: { task: "account_deletion", ...slot(0) } },
      ]);
      // Ripetuto a pochi secondi, o un trigger precedente consegnato in ritardo.
      expect(await dispatchTasks(cron, minutes(0.05))).toEqual([]);
      expect(await dispatchTasks(cron, minutes(-0.05))).toEqual([]);
      // Il periodo successivo del rinnovo; inattività e riconciliazione sono orarie, la pulizia
      // giornaliera.
      const everyTen = ["token_refresh", "telegram", "owner_incidents", "account_deletion"];
      expect(await dispatchTasks(cron, minutes(10))).toEqual(everyTen);
      // Trigger saltati fra 20 e 40: il primo che arriva prende il turno.
      expect(await dispatchTasks(cron, minutes(50))).toEqual(everyTen);
      expect(sendBatch).toHaveBeenLastCalledWith([
        { body: { task: "token_refresh", ...slot(50) } },
        { body: { task: "telegram", ...slot(50) } },
        { body: { task: "owner_incidents", ...slot(50) } },
        { body: { task: "account_deletion", ...slot(50) } },
      ]);
      expect(await dispatchTasks(cron, minutes(24 * 60 + 3))).toEqual([
        "maintenance",
        "export_files",
        "token_refresh",
        "inactivity",
        "billing",
        "telegram",
        "telegram_commands",
        "ebay_quotas",
        "owner_incidents",
        "account_deletion",
      ]);
      expect(sendBatch).toHaveBeenLastCalledWith([
        { body: { task: "maintenance", ...slot(24 * 60) } },
        { body: { task: "export_files", ...slot(24 * 60) } },
        { body: { task: "token_refresh", ...slot(24 * 60) } },
        { body: { task: "inactivity", ...slot(24 * 60) } },
        { body: { task: "billing", ...slot(24 * 60) } },
        { body: { task: "telegram", ...slot(24 * 60) } },
        { body: { task: "telegram_commands", ...slot(24 * 60) } },
        { body: { task: "ebay_quotas", ...slot(24 * 60) } },
        { body: { task: "owner_incidents", ...slot(24 * 60) } },
        { body: { task: "account_deletion", ...slot(24 * 60) } },
      ]);
    });

    it("esegue un compito una volta e riaccoda il turno il cui messaggio è andato perso", async () => {
      const expired = () =>
        env.DB.prepare(
          `INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
             VALUES ('compito-scaduto', 'compito', 'x', ?1, ?1, ?1)`,
        )
          .bind(minutes(-1).toISOString())
          .run();
      const remaining = async () =>
        (await env.DB.prepare(
          'SELECT count(*) AS total FROM "verification" WHERE "identifier" = \'compito\'',
        ).first<{ total: number }>())!.total;
      await expired();
      await dispatchTasks(cron, minutes(0));
      const body = { task: "maintenance", slot: minutes(0).toISOString() };

      // Accettato e mai consegnato: entro l'ora non si riaccoda, dopo sì, con lo stesso turno.
      expect(await dispatchTasks(cron, minutes(59))).toEqual([
        "token_refresh",
        "telegram",
        "owner_incidents",
        "account_deletion",
      ]);
      expect(await dispatchTasks(cron, minutes(60))).toEqual([
        "maintenance",
        "export_files",
        "token_refresh",
        "inactivity",
        "billing",
        "telegram",
        "telegram_commands",
        "ebay_quotas",
        "owner_incidents",
        "account_deletion",
      ]);
      expect(sendBatch).toHaveBeenLastCalledWith(expect.arrayContaining([{ body }]));

      const first = queueMessage(body);
      await consumeTask(first, env, fetch, minutes(61));
      expect(first.ack).toHaveBeenCalledOnce();
      expect(await remaining()).toBe(0);
      // Una consegna ripetuta, o un turno ormai superato, non ripete il lavoro.
      await expired();
      const repeated = queueMessage(body);
      await consumeTask(repeated, env, fetch, minutes(62));
      expect(repeated.ack).toHaveBeenCalledOnce();
      const older = queueMessage({
        task: "maintenance",
        slot: minutes(-24 * 60).toISOString(),
      });
      await consumeTask(older, env, fetch, minutes(62));
      expect(older.ack).toHaveBeenCalledOnce();
      expect(await remaining()).toBe(1);
      // Un turno concluso non si riaccoda nello stesso giorno.
      expect(await dispatchTasks(cron, minutes(180))).toEqual([
        "export_files",
        "token_refresh",
        "inactivity",
        "billing",
        "telegram",
        "telegram_commands",
        "ebay_quotas",
        "owner_incidents",
        "account_deletion",
      ]);
    });

    it("serializza due consegne dello stesso compito e riprende una lease scaduta", async () => {
      await dispatchTasks(cron, minutes(0));
      const body = { task: "maintenance", slot: minutes(0).toISOString() };
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const original = env.DB.batch.bind(env.DB);
      const batch = vi.spyOn(env.DB, "batch").mockImplementation(async (statements) => {
        entered();
        await blocked;
        return original(statements);
      });
      const first = queueMessage(body);
      const running = consumeTask(first, env, fetch, minutes(1));
      try {
        await started;
        const duplicate = queueMessage(body);
        await consumeTask(duplicate, env, fetch, minutes(1));
        expect(duplicate.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
        expect(duplicate.ack).not.toHaveBeenCalled();
        expect(batch).toHaveBeenCalledOnce();
      } finally {
        release();
        await running;
        batch.mockRestore();
      }
      expect(first.ack).toHaveBeenCalledOnce();
      await env.DB.prepare(
        "UPDATE scheduled_tasks SET done_at = NULL, lease = 'interrupted', locked_until = ? WHERE task = 'maintenance'",
      )
        .bind(minutes(2).toISOString())
        .run();
      const resumed = queueMessage(body);
      await consumeTask(resumed, env, fetch, minutes(3));
      expect(resumed.ack).toHaveBeenCalledOnce();
      expect(
        await env.DB.prepare(
          "SELECT lease, locked_until, done_at FROM scheduled_tasks WHERE task = 'maintenance'",
        ).first(),
      ).toEqual({ lease: null, locked_until: null, done_at: minutes(3).toISOString() });
    });

    it("fra trigger sovrapposti uno solo accoda il turno di un compito", async () => {
      const turns = await Promise.all([
        dispatchTasks(cron, minutes(0)),
        dispatchTasks(cron, minutes(0)),
      ]);
      expect(turns.flat().sort()).toEqual([
        "account_deletion",
        "billing",
        "ebay_quotas",
        "export_files",
        "inactivity",
        "maintenance",
        "owner_incidents",
        "telegram",
        "telegram_commands",
        "token_refresh",
      ]);
      expect(sendBatch).toHaveBeenCalledOnce();
    });

    it("ogni passo del cron fallito si registra senza fermare gli altri", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await env.DB.prepare(
          `INSERT INTO webhook_receipts
               (id, provider, environment, provider_id, topic, object_id, event_at, expires_at)
             VALUES ('ricevuta-cron', 'stripe', 'test', 'evt-cron', 'evento', 'oggetto', ?1, ?2)`,
        )
          .bind(minutes(0).toISOString(), minutes(60).toISOString())
          .run();
        sendBatch.mockRejectedValue(new Error("queue unavailable"));
        send.mockRejectedValue(new Error("queue unavailable"));
        await dispatchScheduledWork(cron, minutes(0));
        expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)).operation)).toEqual([
          "scheduling",
          "webhook_ingress",
          "scheduling",
        ]);
        expect(sendBatch).toHaveBeenCalledTimes(2);
      } finally {
        errors.mockRestore();
        await env.DB.prepare("DELETE FROM webhook_receipts").run();
      }
    });

    it("il compito di rinnovo rinnova i token in scadenza dal consumer", async () => {
      await env.DB.prepare(
        "UPDATE ebay_store_credentials SET refresh_token = ?, access_expires_at = ?",
      )
        .bind(
          await sealToken(env.BETTER_AUTH_SECRET, "s-a", "refresh", "refresh-sintetico"),
          minutes(20).toISOString(),
        )
        .run();
      await dispatchTasks(cron, minutes(0));
      const token = vi.fn<typeof fetch>(async () =>
        Response.json({ access_token: "token-rinnovato", expires_in: 7200 }),
      );
      const turn = queueMessage({ task: "token_refresh", slot: minutes(0).toISOString() });
      await consumeTask(turn, env, token, minutes(1));
      expect(turn.ack).toHaveBeenCalledOnce();
      expect(token).toHaveBeenCalledOnce();
      expect(
        await env.DB.prepare(
          "SELECT access_expires_at, refreshed_at FROM ebay_store_credentials WHERE store_id = 's-a'",
        ).first(),
      ).toEqual({
        access_expires_at: minutes(121).toISOString(),
        refreshed_at: minutes(1).toISOString(),
      });
    });

    it("un compito fallito riprova con backoff e resta da concludere", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await dispatchTasks(cron, minutes(0));
        const failing = {
          ...env,
          DB: {
            prepare: (sql: string) => env.DB.prepare(sql),
            batch: () => Promise.reject(new Error("d1 unavailable")),
          },
        } as unknown as Env;
        const body = { task: "maintenance", slot: minutes(0).toISOString() };
        const attempt = queueMessage(body, 3);
        await consumeTask(attempt, failing, fetch, minutes(1));
        expect(attempt.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
        expect(attempt.ack).not.toHaveBeenCalled();
        expect(JSON.parse(String(errors.mock.calls[0]![0]))).toMatchObject({
          operation: "maintenance",
        });
        const resumed = queueMessage(body, 4);
        await consumeTask(resumed, env, fetch, minutes(5));
        expect(resumed.ack).toHaveBeenCalledOnce();
      } finally {
        errors.mockRestore();
      }
    });
  });
});
