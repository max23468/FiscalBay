import { env } from "cloudflare:workers";

import { sign } from "node:crypto";

import { afterEach, expect, it, vi } from "vitest";

import { receiveWebhook, consumeWebhooks } from "../app/webhooks.server";

import {
  admitOrigin,
  NotificationLimit,
  verifyEbayNotification,
} from "../app/integrations/ebay/notifications.server";

import {
  resumeEbayAccountDeletions,
  runEbayAccountDeletion,
} from "../app/domain/ebay-account-deletion.server";

import { listAnomalies } from "../app/domain/admin-operations.server";

import { bulkDataAnomalies, recordBulkDataThreshold } from "../app/domain/ebay-quotas.server";

import {
  now,
  grantedAt,
  pair,
  publicKey,
  notification,
  send,
  environment,
  fetcher,
  ebayRequest,
  receive,
  batch,
  acquire,
  receipt,
  revocation,
  revokedBy,
  threshold,
  accountDeletion,
  deletions,
  setupScenarios,
} from "./fixtures/webhooks-scenarios";

const router = vi.hoisted(() => ({ handle: vi.fn(), create: vi.fn() }));

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  createRequestHandler: router.create,
}));

setupScenarios(router);
// Uno spy lasciato da una prova non sostituisce l'implementazione reale nelle successive.
afterEach(() => vi.restoreAllMocks());

it("la revoca del consenso porta il negozio da ricollegare senza toccare i dati", async () => {
  expect((await receive(ebayRequest(revocation)))?.status).toBe(204);
  const row = await env.DB.prepare(
    "SELECT id, topic, object_id, store_id, consent_granted_at, event_at FROM webhook_receipts",
  ).first();
  expect(row).toMatchObject({
    topic: "AUTHORIZATION_REVOCATION",
    object_id: "seller-synthetic",
    store_id: "webhook-store",
    consent_granted_at: grantedAt,
    event_at: "2026-10-11T11:00:00.000Z",
  });
  expect(send).toHaveBeenCalledExactlyOnceWith({ receiptId: row?.id });
  const { message, value } = batch({ receiptId: row?.id });
  await consumeWebhooks(value, environment, fetcher, now);
  expect(message.ack).toHaveBeenCalledOnce();
  expect(
    await env.DB.prepare(
      "SELECT c.rejected_at, c.refresh_token IS NOT NULL AS kept, s.disconnected_at, s.data_deleted_at FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id",
    ).first(),
  ).toEqual({
    rejected_at: now.toISOString(),
    kept: 1,
    disconnected_at: null,
    data_deleted_at: null,
  });
  // Nessuna lettura eBay per conto del negozio: solo chiave pubblica e token dell'applicazione.
  expect(fetcher.mock.calls.every(([url]) => !String(url).includes("/sell/"))).toBe(true);
  expect((await receipt())?.completed_at).toBe(now.toISOString());
});

it("una revoca consegnata oltre i sette giorni porta comunque il negozio da ricollegare", async () => {
  const late = new Date(now.getTime() + 8 * 86_400_000);
  expect((await receiveWebhook(ebayRequest(revocation), environment, fetcher, late))?.status).toBe(
    204,
  );
  const row = await receipt();
  expect(await env.DB.prepare("SELECT expires_at FROM webhook_receipts").first("expires_at")).toBe(
    new Date(late.getTime() + 7 * 86_400_000).toISOString(),
  );
  const { message, value } = batch({ receiptId: row?.id });
  await consumeWebhooks(value, environment, fetcher, late);
  expect(message.ack).toHaveBeenCalledOnce();
  expect(
    await env.DB.prepare("SELECT rejected_at FROM ebay_store_credentials").first("rejected_at"),
  ).toBe(late.toISOString());
});

it("una revoca senza negozio attivo, anteriore al consenso o di prova non accoda nulla", async () => {
  for (const payload of [
    revokedBy({ userId: "other-seller" }),
    revokedBy({ revocationDate: "2026-10-09T12:00:00.000Z" }),
    revokedBy({ userId: undefined }),
    // Valori segnaposto di una consegna di prova.
    revokedBy({ userId: "" }),
  ])
    expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?").bind(grantedAt).run();
  expect((await receive(ebayRequest(revocation)))?.status).toBe(204);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it("una data della revoca in un altro formato vale, una illeggibile lascia la data dell'evento", async () => {
  expect(
    (await receive(ebayRequest(revokedBy({ revocationDate: "2026-10-11T13:00:00+02:00" }))))
      ?.status,
  ).toBe(204);
  expect(await env.DB.prepare("SELECT event_at FROM webhook_receipts").first("event_at")).toBe(
    "2026-10-11T11:00:00.000Z",
  );
  await env.DB.prepare("DELETE FROM webhook_receipts").run();
  expect(
    (
      await receive(
        ebayRequest({
          ...revokedBy({ revocationDate: "string" }),
          notification: {
            ...revokedBy({ revocationDate: "string" }).notification,
            notificationId: "revocation-placeholder",
          },
        }),
      )
    )?.status,
  ).toBe(204);
  expect(await env.DB.prepare("SELECT event_at FROM webhook_receipts").first("event_at")).toBe(
    now.toISOString(),
  );
});

it("il 412 di una consegna firmata registra soltanto il motivo, le sonde nulla", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const malformed = ebayRequest();
    malformed.headers.set("x-ebay-signature", "invalid");
    expect((await receive(malformed))?.status).toBe(412);
    const altered = ebayRequest();
    const body = await altered.text();
    expect(
      (
        await receive(
          new Request(altered.url, { method: "POST", headers: altered.headers, body: body + " " }),
        )
      )?.status,
    ).toBe(412);
    expect(
      (
        await receive(
          ebayRequest({ ...notification, metadata: { topic: "OTHER", schemaVersion: "1.0" } }),
        )
      )?.status,
    ).toBe(412);
    const logged = errors.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toEqual(
      ["signature", "schema"].map((failure) => ({
        event: "application_error",
        code: "INVALID_REQUEST",
        operation: "webhook_ingress",
        failure,
        status: 412,
      })),
    );
    expect(JSON.stringify(logged)).not.toContain(notification.notification.notificationId);
  } finally {
    errors.mockRestore();
  }
});

it("la soglia Bulk Data Transfer apre un'anomalia della console fino alla fine della finestra", async () => {
  expect((await receive(ebayRequest(threshold("WARNING"))))?.status).toBe(204);
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(204);
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(204);
  // Un avviso ritentato da eBay dopo la soglia raggiunta non abbassa gravità e conteggio.
  expect((await receive(ebayRequest(threshold("WARNING"))))?.status).toBe(204);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
  const { results } = await env.DB.prepare(
    "SELECT key, severity, json_extract(detail, '$.share') AS share, resolved_at FROM admin_anomalies",
  ).all();
  expect(results).toEqual([
    {
      key: "ebay_bulk_data:production:US:PersonalFinancialData:2026-10-01T00:00:00.000Z",
      severity: "p1",
      share: 1,
      resolved_at: "2026-10-31T00:00:00.000Z",
    },
  ]);
  expect(
    (await listAnomalies(env.DB, now)).filter((anomaly) => anomaly.kind === "ebay_bulk_data"),
  ).toMatchObject([
    { severity: "p1", subjects: [{ id: "production:US:PersonalFinancialData", href: "quote" }] },
  ]);
  expect(await bulkDataAnomalies(env.DB, now)).toMatchObject([
    {
      severity: "p1",
      subject: "production:US:PersonalFinancialData",
      share: 1,
      until: "2026-10-31T00:00:00.000Z",
    },
  ]);
  const closed = (await listAnomalies(env.DB, new Date("2026-10-31T00:00:00.000Z"))).filter(
    (anomaly) => anomaly.kind === "ebay_bulk_data",
  );
  expect(closed).toEqual([]);
  // Con il database guasto risponde 503, così eBay ritenta.
  const failing = vi
    .spyOn(env.DB, "batch")
    .mockRejectedValueOnce(new Error("database_unavailable"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(503);
  expect(logged).toHaveBeenCalledTimes(1);
  failing.mockRestore();
  logged.mockRestore();
  // Una soglia senza metriche non è un avviso valido.
  const empty = threshold("WARNING");
  empty.notification.data.metricData = [];
  expect((await receive(ebayRequest(empty)))?.status).toBe(412);
  // Registrata comunque, si conclude senza scrivere: un batch D1 vuoto non terminerebbe.
  await env.DB.prepare("DELETE FROM admin_anomalies").run();
  await recordBulkDataThreshold(
    env.DB,
    "production",
    empty.notification.data as Parameters<typeof recordBulkDataThreshold>[2],
    now,
  );
  expect(await env.DB.prepare("SELECT count(*) AS n FROM admin_anomalies").first("n")).toBe(0);
});

it("la cancellazione di un utente eBay sconosciuto risponde 204 senza lasciare traccia", async () => {
  const payload = accountDeletion({
    userId: "unknown-user",
    eiasToken: "eias-unknown",
    username: "unknown-name",
  });
  expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  // Anche oltre la finestra delle ricevute: eBay ritenta la stessa notifica per giorni.
  expect(
    (
      await receiveWebhook(
        ebayRequest(payload),
        environment,
        fetcher,
        new Date(now.getTime() + 30 * 86_400_000),
      )
    )?.status,
  ).toBe(204);
  expect((await deletions()).results).toEqual([]);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it("registra e accoda una sola volta la cancellazione di un venditore noto, anche se tardiva", async () => {
  const payload = accountDeletion({
    userId: "seller-synthetic",
    eiasToken: "eias-seller",
    username: "seller-name",
  });
  const later = new Date(now.getTime() + 10 * 86_400_000);
  expect((await receiveWebhook(ebayRequest(payload), environment, fetcher, later))?.status).toBe(
    204,
  );
  expect((await receiveWebhook(ebayRequest(payload), environment, fetcher, later))?.status).toBe(
    204,
  );
  const { results } = await deletions();
  expect(results).toEqual([
    {
      id: expect.any(String),
      ebay_environment: "production",
      ebay_user_id: "seller-synthetic",
      eias_token: "eias-seller",
      username: "seller-name",
      notified_at: now.toISOString(),
      completed_at: null,
    },
  ]);
  expect(send.mock.calls).toEqual([
    [{ ebayAccountDeletion: results[0]!.id }],
    [{ ebayAccountDeletion: results[0]!.id }],
  ]);
  // Nessuna ricevuta: la cancellazione ha una richiesta propria e non scade dopo sette giorni.
  expect(await receipt()).toBeNull();
});

it("una coda non disponibile risponde 503 e il compito periodico conclude la cancellazione", async () => {
  send.mockRejectedValueOnce(new Error("queue_unavailable"));
  const payload = accountDeletion({ userId: "seller-synthetic" });
  expect((await receive(ebayRequest(payload)))?.status).toBe(503);
  expect((await deletions()).results).toMatchObject([{ completed_at: null }]);
  await resumeEbayAccountDeletions(environment, now);
  expect((await deletions()).results).toMatchObject([{ completed_at: now.toISOString() }]);
  expect(
    await env.DB.prepare(
      "SELECT ebay_user_id, ebay_account_id, data_deleted_at FROM ebay_stores WHERE id = 'webhook-store'",
    ).first(),
  ).toEqual({
    ebay_user_id: "webhook-store",
    ebay_account_id: null,
    data_deleted_at: now.toISOString(),
  });
  // eBay ritenta la consegna: l'utente non è più noto e nulla riparte.
  expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  expect(send).toHaveBeenCalledOnce();
  expect((await deletions()).results).toMatchObject([{ completed_at: now.toISOString() }]);
});

it("una cancellazione con firma o schema non validi non registra nulla", async () => {
  const valid = ebayRequest(accountDeletion({ userId: "seller-synthetic" }));
  const altered = new Request(valid.url, {
    method: "POST",
    headers: valid.headers,
    body: JSON.stringify(accountDeletion({ userId: "webhook-store" })),
  });
  expect((await receive(altered))?.status).toBe(412);
  for (const data of [{ userId: "" }, { userId: "seller-synthetic", eiasToken: "x".repeat(257) }])
    expect((await receive(ebayRequest(accountDeletion(data as { userId: string }))))?.status).toBe(
      412,
    );
  expect((await deletions()).results).toEqual([]);
  expect(send).not.toHaveBeenCalled();
});

it("l'ordine di un acquirente cancellato da eBay non ritorna con una nuova conferma", async () => {
  await acquire(fetcher);
  await env.DB.prepare("UPDATE orders SET buyer_eias_token = 'eias-buyer'").run();
  expect(
    (
      await receive(
        ebayRequest(accountDeletion({ userId: "buyer-synthetic", eiasToken: "eias-buyer" })),
      )
    )?.status,
  ).toBe(204);
  const { results } = await deletions();
  expect(await runEbayAccountDeletion(environment, String(results[0]!.id), now)).toBe("done");
  expect((await env.DB.prepare("SELECT id FROM orders").all()).results).toEqual([]);
  // Una nuova conferma dello stesso ordine, anche già in coda, non lo importa di nuovo.
  const again = {
    ...notification,
    notification: { ...notification.notification, notificationId: "again" },
  };
  expect((await receive(ebayRequest(again)))?.status).toBe(204);
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect((await env.DB.prepare("SELECT id FROM orders").all()).results).toEqual([]);
  // Il negozio resta collegato: la cancellazione riguarda soltanto l'acquirente.
  expect(
    await env.DB.prepare("SELECT ebay_account_id, data_deleted_at FROM ebay_stores").first(),
  ).toEqual({ ebay_account_id: "seller-synthetic", data_deleted_at: null });
});

it("limita le consegne per origine prima di leggere il corpo, con memoria limitata", async () => {
  const empty = (origin: string, at = now) =>
    receiveWebhook(
      new Request("https://test.fiscalbay.it/webhooks/ebay", {
        method: "POST",
        headers: { "cf-connecting-ip": origin, "content-length": "0" },
      }),
      environment,
      fetcher,
      at,
    );
  const start = new Date(now.getTime() + 3_600_000);
  for (let i = 0; i < 600; i++) expect((await empty("192.0.2.1", start))?.status).toBe(400);
  expect((await empty("192.0.2.1", start))?.status).toBe(429);
  expect((await empty("192.0.2.2", start))?.status).toBe(400);
  // Stripe e Telegram non condividono il limite dell'ingresso eBay.
  expect(
    (
      await receiveWebhook(
        new Request("https://test.fiscalbay.it/webhooks/stripe", {
          method: "POST",
          headers: { "cf-connecting-ip": "192.0.2.1" },
        }),
        environment,
        fetcher,
        start,
      )
    )?.status,
  ).not.toBe(429);
  expect((await empty("192.0.2.1", new Date(start.getTime() + 59_999)))?.status).toBe(429);
  expect((await empty("192.0.2.1", new Date(start.getTime() + 60_000)))?.status).toBe(400);

  // Oltre mille origini la meno recente esce dal conteggio e ricomincia.
  const at = start.getTime() + 120_000;
  for (let i = 0; i < 600; i++) admitOrigin("198.51.100.1", at);
  expect(() => admitOrigin("198.51.100.1", at)).toThrow(NotificationLimit);
  for (let i = 0; i < 999; i++) admitOrigin(`203.0.113.${i}`, at);
  expect(() => admitOrigin("198.51.100.1", at)).toThrow(NotificationLimit);
  admitOrigin("203.0.114.1", at);
  expect(() => admitOrigin("198.51.100.1", at)).not.toThrow();
});

it("un'origine che riparte con una nuova finestra diventa la più recente", () => {
  // Mille origini scadute sostituiscono quelle rimaste dalle altre prove.
  const start = Date.parse("2027-01-01T00:00:00.000Z");
  for (let i = 0; i < 1000; i++) admitOrigin(`198.18.0.${i}`, start - 120_000);
  admitOrigin("198.18.1.1", start);
  admitOrigin("198.18.1.2", start + 1);
  // La prima origine riparte e raggiunge il limite: altre 999 origini fanno uscire le scadute e
  // la seconda, non la prima, che resta al limite.
  for (let i = 0; i < 600; i++) admitOrigin("198.18.1.1", start + 60_000);
  for (let i = 0; i < 999; i++) admitOrigin(`198.18.2.${i}`, start + 60_001);
  expect(() => admitOrigin("198.18.1.1", start + 60_002)).toThrow(NotificationLimit);
});

it("accetta la firma SHA-1 delle notifiche di cancellazione dichiarata dalla chiave di eBay", async () => {
  const signed = (payload: object, digest: "SHA1" | "sha1" | "SHA256", kid: string) => {
    const body = JSON.stringify(payload);
    const signature = sign(
      digest.toLowerCase() === "sha1" ? "sha1" : "sha256",
      Buffer.from(body),
      pair.privateKey,
    ).toString("base64");
    return new Request("https://test.fiscalbay.it/webhooks/ebay", {
      method: "POST",
      headers: {
        "x-ebay-signature": btoa(JSON.stringify({ alg: "ecdsa", kid, signature, digest })),
      },
      body,
    });
  };
  const sha1Key = vi.fn<typeof fetch>(async (input, init) =>
    String(input).includes("/public_key/")
      ? Response.json({
          algorithm: "ECDSA",
          digest: "SHA1",
          key: publicKey.replaceAll("\n", ""),
        })
      : fetcher(input, init),
  );
  const payload = accountDeletion({ userId: "seller-synthetic", eiasToken: "eias-seller" });
  expect(
    (await receiveWebhook(signed(payload, "SHA1", "sha1-key"), environment, sha1Key, now))?.status,
  ).toBe(204);
  expect((await deletions()).results).toHaveLength(1);
  // Il digest dell'header vale in maiuscolo e in minuscolo.
  expect(
    (await receiveWebhook(signed(payload, "sha1", "sha1-key"), environment, sha1Key, now))?.status,
  ).toBe(204);
  // La chiave dichiara SHA-1: un header con un altro digest, anche firmato, non vale.
  expect(
    (await receiveWebhook(signed(payload, "SHA256", "sha1-key"), environment, sha1Key, now))
      ?.status,
  ).toBe(412);
  const mismatch = signed(payload, "SHA256", "sha1-key");
  await expect(
    verifyEbayNotification(
      await mismatch.text(),
      mismatch.headers.get("x-ebay-signature"),
      environment,
      "production",
      sha1Key,
      now.getTime(),
    ),
  ).rejects.toMatchObject({ failure: "signature" });
  // Una firma SHA-1 senza il digest dichiarato dalla chiave segue l'header.
  expect(
    (await receiveWebhook(signed(payload, "SHA1", "plain-key"), environment, fetcher, now))?.status,
  ).toBe(204);
});
