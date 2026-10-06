#!/usr/bin/env node
/**
 * Riporta l'account di collaudo del dominio di test a uno stato noto, prima dei controlli
 * dopo il deploy. Lavora soltanto sulla D1 `fiscalbay-test` e soltanto sulle righe con gli
 * identificativi fissi di `e2e/test-account.ts`: utente, credenziale e spazio vengono riscritti, non creati
 * a ogni esecuzione. L'indirizzo `example.invalid` non riceve email e il recupero password
 * non parte mai da qui.
 *
 * Uso: E2E_ACCOUNT_PASSWORD=... node scripts/reset-test-account.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { hashPassword } from "better-auth/crypto";

import { legalVersions } from "../app/domain/registration.server.ts";
import { testAccount } from "../e2e/test-account.ts";

const database = "fiscalbay-test";

const day = 24 * 60 * 60 * 1000;

function quote(value) {
  return value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function row(values) {
  return `(${values.map(quote).join(", ")})`;
}

export async function resetStatements(password, now = new Date()) {
  const at = (offset) => new Date(now.getTime() + offset).toISOString();
  const iso = at(0);
  const { email, userId, workspaceId, stores, orders, taxCodes } = testAccount;
  // Token mai validi per eBay e lontani dalla scadenza: il rinnovo in background li ignora.
  const credential = (store, refreshExpiresAt, rejectedAt) =>
    row([
      store,
      "v1.collaudo",
      "2099-01-01T00:00:00.000Z",
      "v1.collaudo",
      refreshExpiresAt,
      iso,
      rejectedAt,
    ]);
  const buyer = JSON.stringify({
    username: "acquirente-collaudo",
    name: null,
    email: null,
    phone: null,
    billingAddress: null,
    shipTo: null,
  });
  const order = (id, ebayOrderId, offset) =>
    row([
      id,
      stores.active,
      ebayOrderId,
      at(offset),
      at(offset),
      "EUR",
      1250,
      "PAID",
      "NOT_STARTED",
      buyer,
    ]);
  const item = (orderId, title) =>
    row([
      `${orderId}-riga`,
      orderId,
      `riga-${title}`,
      `Articolo di collaudo ${title}`,
      1,
      1250,
      "EUR",
    ]);

  return [
    `DELETE FROM session WHERE "userId" = ${quote(userId)};`,
    // Lo spazio porta con sé negozi, token, pause, ordini, identificativi, sblocchi e cicli.
    `DELETE FROM workspaces WHERE id = ${quote(workspaceId)};`,
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ${row([userId, "Collaudo", email, 1, iso, iso])}
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email,
       "emailVerified" = 1, "updatedAt" = excluded."updatedAt";`,
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ${row([`${userId}-credenziale`, userId, "credential", userId, await hashPassword(password), iso, iso])}
     ON CONFLICT(id) DO UPDATE SET password = excluded.password, "updatedAt" = excluded."updatedAt";`,
    `DELETE FROM "account" WHERE "userId" = ${quote(userId)} AND id <> ${quote(`${userId}-credenziale`)};`,
    `INSERT INTO user_profiles (user_id, first_name, last_name, account_type, company_name, updated_at)
     VALUES ${row([userId, "Utente", "Collaudo", "private", null, iso])}
     ON CONFLICT(user_id) DO UPDATE SET first_name = excluded.first_name,
       last_name = excluded.last_name, account_type = excluded.account_type,
       company_name = NULL, updated_at = excluded.updated_at;`,
    `INSERT OR IGNORE INTO terms_acceptances (user_id, terms_version, privacy_version, language, accepted_at)
     VALUES ${row([userId, legalVersions.terms, legalVersions.privacy, "it", iso])};`,
    `INSERT INTO workspaces (id, name, created_at) VALUES ${row([workspaceId, "Spazio di collaudo", iso])};`,
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ${row([workspaceId, userId, "owner"])};`,
    `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name) VALUES
     ${Object.values(stores)
       .map((store, index) =>
         row([store, workspaceId, `${store}-ebay`, at(-day + index * 1000), store]),
       )
       .join(",\n     ")};`,
    `INSERT INTO ebay_store_credentials
       (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at, rejected_at)
     VALUES
     ${credential(stores.active, at(300 * day), null)},
     ${credential(stores.expiring, at(20 * day), null)},
     ${credential(stores.expired, at(300 * day), at(-day))},
     ${credential(stores.paused, at(300 * day), at(-day))};`,
    `INSERT INTO ebay_store_pauses (store_id, reason, paused_at)
     VALUES ${row([stores.paused, "manual", iso])};`,
    `INSERT INTO orders
       (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor,
        payment_status, fulfillment_status, buyer_json)
     VALUES
     ${order("collaudo-ordine-sbloccato", orders.unlocked, -2 * 60 * 60 * 1000)},
     ${order("collaudo-ordine-bloccato", orders.locked, -60 * 60 * 1000)};`,
    `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
     VALUES
     ${item("collaudo-ordine-sbloccato", "A")},
     ${item("collaudo-ordine-bloccato", "B")};`,
    `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
     VALUES
     ${row(["collaudo-cf-sbloccato", "collaudo-ordine-sbloccato", "CODICE_FISCALE", "IT", taxCodes.unlocked, "synthetic_fixture", iso])},
     ${row(["collaudo-cf-bloccato", "collaudo-ordine-bloccato", "CODICE_FISCALE", "IT", taxCodes.locked, "synthetic_fixture", iso])};`,
    `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
     VALUES ${row(["collaudo-sblocco", workspaceId, "collaudo-ordine-sbloccato", null, "admin", iso])};`,
  ];
}

async function main() {
  const local = process.argv.includes("--local");
  const sessions = process.argv.includes("--sessions");
  if (sessions && !local)
    throw new Error("Le sessioni sintetiche privilegiate sono ammesse soltanto in locale.");
  const password = process.env.E2E_ACCOUNT_PASSWORD ?? "";
  if (password.length < 32) {
    throw new Error("E2E_ACCOUNT_PASSWORD deve contenere almeno 32 caratteri.");
  }
  // `--command` esegue le istruzioni senza l'import di `--file`, che sospende il database.
  const statements = await resetStatements(password);
  if (sessions) {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 86400000).toISOString();
    statements.push(`INSERT OR REPLACE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", admin)
      VALUES ('collaudo-admin', 'Collaudo admin', 'admin@example.invalid', 1, '${now}', '${now}', 1);`);
    for (const role of ["member", "admin-verify", "admin-granted"])
      statements.push(
        `INSERT OR REPLACE INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt", "passkeyVerified") VALUES ('pages-${role}', 'pages-${role}', '${role === "member" ? testAccount.userId : "collaudo-admin"}', '${expires}', '${now}', '${now}', ${role === "admin-granted" ? 1 : 0});`,
      );
  }
  execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      database,
      local ? "--local" : "--remote",
      "--command",
      statements.join("\n"),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  console.log(`Account di collaudo ripristinato su ${database}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
