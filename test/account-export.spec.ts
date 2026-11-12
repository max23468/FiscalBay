import { env } from "cloudflare:workers";

import { strFromU8, unzipSync } from "fflate";

import { expect, it } from "vitest";

import { action as settingsAction } from "../app/routes/settings";

import { insertEntitlement, insertSubscription, now } from "./fixtures/database-fixtures";

import { callRoute } from "./fixtures/route-fixtures";

import {
  cookie,
  userId,
  settingsIntent,
  download,
  gone,
  expiry,
  hours,
  setupScenarios,
} from "./fixtures/order-export-scenarios";

setupScenarios();

it("lo ZIP dell'account in inglese scrive le date nel fuso dell'utente, senza cliente né importi Stripe", async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO user_preferences (user_id, time_zone, updated_at) VALUES (?1, 'America/New_York', ?2)
         ON CONFLICT (user_id) DO UPDATE SET time_zone = excluded.time_zone`,
    ).bind(userId, now),
    insertSubscription({
      id: "sub_segreto",
      customerId: "cus_segreto",
      generation: "g-segreta",
      periodEnd: hours(24 * 30),
    }),
    env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at,
           stripe_invoice_id, amount_paid, currency, paid_at)
         VALUES ('e-paid', 'w-a', 'premium', ?1, ?2, 'in_segreta', 73914286, 'EUR', ?1)`,
    ).bind(now, hours(24 * 30)),
  ]);
  const result = (await callRoute(settingsAction, "/en/app/settings/export", {
    cookie,
    fields: { intent: "account-export" },
  })) as { ok: boolean; download: string };
  expect(result).toEqual({
    ok: true,
    download: expect.stringMatching(/^\/en\/api\/v1\/exports\//u),
  });
  const id = result.download.split("/").at(-1)!;
  const response = await download(id);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="fiscalbay-account-data-2026-09-13.zip"',
  );
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  expect(Object.keys(files).sort()).toEqual([
    "export-configurations.csv",
    "fiscalbay-account.json",
    "plan.csv",
    "profile.csv",
    "sign-in.csv",
    "stores.csv",
  ]);
  const text = Object.values(files)
    .map((bytes) => strFromU8(bytes))
    .join("\n");
  for (const secret of [
    "cus_segreto",
    "sub_segreto",
    "in_segreta",
    "73914286",
    "739142.86",
    "g-segreta",
  ])
    expect(text).not.toContain(secret);
  // Le 20:00 UTC sono le 16:00 a New York; il JSON resta in UTC.
  const plan = strFromU8(files["plan.csv"]!);
  expect(plan).toContain('"Item","Type","From","To","Status"\r\n');
  expect(plan).toContain('"coverage","premium","2026-09-13 16:00:00","2026-10-13 16:00:00",""\r\n');
  expect(plan).toContain(
    '"subscription","monthly","2026-09-13 16:00:00","2026-10-13 16:00:00","active"\r\n',
  );
  expect(strFromU8(files["profile.csv"]!)).toContain('"Time zone","America/New_York"\r\n');
  expect(JSON.parse(strFromU8(files["fiscalbay-account.json"]!)).plan.subscriptions).toEqual([
    {
      offer: "monthly",
      status: "active",
      periodStart: now,
      periodEnd: hours(24 * 30),
      cancelAtPeriodEnd: false,
    },
  ]);
});

it("i dati dell'account si scaricano in uno ZIP senza segreti né ordini", async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO passkey (id, name, publicKey, userId, credentialID, counter, deviceType,
           backedUp, createdAt)
         VALUES ('pk-1', 'MacBook', 'chiave-pubblica-segreta', ?1, 'credenziale-segreta', 0,
                 'multiDevice', 1, ?2)`,
    ).bind(userId, now),
    env.DB.prepare(
      `INSERT INTO telegram_links (workspace_id, id, chat_id, chat_label, language, linked_at)
         VALUES ('w-a', 'tl-1', '987654321', '@venditore', 'it', ?)`,
    ).bind(now),
    env.DB.prepare(
      `INSERT INTO export_configurations (id, user_id, name, format, granularity, columns, updated_at)
         VALUES ('cfg-1', ?1, '=Commercialista', 'xlsx', 'order', 'order,taxCode', ?2)`,
    ).bind(userId, now),
    env.DB.prepare(
      `INSERT INTO signup_sources (user_id, channel, first_page, recorded_at)
         VALUES (?1, 'ebay_community', '/faq', ?2)`,
    ).bind(userId, now),
  ]);
  await insertEntitlement({
    source: "admin",
    endsAt: hours(48),
    grantedBy: "owner",
    grantReason: "motivo interno",
  }).run();
  const result = await settingsIntent({ intent: "account-export" });
  expect(result.status).toBe(200);
  const download_ = (result.body as { ok: boolean; download: string }).download;
  expect(result.body).toEqual({
    ok: true,
    download: expect.stringMatching(/^\/api\/v1\/exports\//u),
  });
  const id = download_.split("/").at(-1)!;
  const response = await download(id);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/zip");
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="fiscalbay-dati-account-2026-09-13.zip"',
  );
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  expect(Object.keys(files).sort()).toEqual([
    "accessi.csv",
    "configurazioni-esportazione.csv",
    "fiscalbay-account.json",
    "negozi.csv",
    "piano.csv",
    "profilo.csv",
  ]);
  const text = Object.values(files)
    .map((bytes) => strFromU8(bytes))
    .join("\n");
  // Nessuna password, chiave, credenziale, chat, motivo interno, ordine o dato dell'acquirente.
  const password = await env.DB.prepare(
    "SELECT password FROM account WHERE userId = ? AND password IS NOT NULL",
  )
    .bind(userId)
    .first<string>("password");
  expect(password).toBeTruthy();
  for (const secret of [
    password!,
    "chiave-pubblica-segreta",
    "credenziale-segreta",
    "987654321",
    "motivo interno",
    "ebay-a",
    "RSSMRA80A01H501U",
    "Articolo A",
  ])
    expect(text).not.toContain(secret);
  const data = JSON.parse(strFromU8(files["fiscalbay-account.json"]!));
  expect(data).toMatchObject({
    exportedAt: now,
    profile: { signupSource: { channel: "ebay_community", firstPage: "/faq" } },
    signIn: [
      { method: "credential", name: null, createdAt: now },
      { method: "passkey", name: "MacBook", createdAt: now },
    ],
    stores: [expect.objectContaining({ ebayUser: "e-a", environment: "production" })],
    plan: {
      coverages: [
        { source: "admin", startsAt: expect.any(String), endsAt: hours(48), revokedAt: null },
      ],
    },
    telegram: expect.objectContaining({ chat: "@venditore", linkedAt: now }),
    exportConfigurations: [
      { name: "=Commercialista", format: "xlsx", rows: "order", columns: ["order", "taxCode"] },
    ],
  });
  // I CSV seguono la lingua, con le date nel fuso dell'utente e le formule neutralizzate.
  const configurations = files["configurazioni-esportazione.csv"]!;
  expect([...configurations.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(strFromU8(configurations)).toBe(
    '"Nome","Formato","Una riga per","Colonne"\r\n"\'=Commercialista","xlsx","order","order, taxCode"\r\n',
  );
  expect(strFromU8(files["profilo.csv"]!)).toContain('"Chat Telegram","\'@venditore"\r\n');
  expect(strFromU8(files["profilo.csv"]!)).toContain(
    '"Provenienza dell\'iscrizione","ebay_community"\r\n"Prima pagina vista","/faq"\r\n',
  );
  // Il file vale 24 ore e una revoca dello spazio lo nega come gli altri.
  expect(await expiry(id)).toBe(hours(24));
  await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ?").bind(now).run();
  await gone(await download(id));
});
