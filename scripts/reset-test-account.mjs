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
import { databases } from "../cloudflare.config.ts";
import { testAccount } from "../e2e/test-account.ts";
import { executeLocal } from "./local-d1.mjs";

const database = databases.test;

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
    // Lingua, tema, fuso, modello e letture della campanella tornano ai predefiniti.
    `DELETE FROM user_preferences WHERE user_id = ${quote(userId)};`,
    `DELETE FROM notification_reads WHERE user_id = ${quote(userId)};`,
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
    // Le credenziali sintetiche non si aprono: alla prima lettura periodica il consenso dei negozi
    // attivi diventa da ricollegare. Segnati come appena letti, restano attivi per la cadenza Free
    // di 30 minuti, oltre la durata dei controlli dopo il deploy.
    `INSERT INTO sync_state (store_id, polled_at, updated_at)
     VALUES ${row([stores.active, iso, iso])}, ${row([stores.expiring, iso, iso])};`,
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
  const statements = await resetStatements(password);
  if (local) {
    // Le prove browser creano passkey e richieste email: ogni collaudo locale riparte pulito.
    statements.push(`DELETE FROM passkey WHERE "userId" = ${quote(testAccount.userId)};`);
    statements.push(
      `DELETE FROM account_email_changes WHERE user_id = ${quote(testAccount.userId)};`,
    );
  }
  if (sessions) {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 86400000).toISOString();
    statements.push(`INSERT OR REPLACE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", admin)
      VALUES ('collaudo-admin', 'Collaudo admin', 'admin@example.invalid', 1, '${now}', '${now}', 1);`);
    for (const role of ["member", "admin-verify", "admin-granted"])
      statements.push(
        `INSERT OR REPLACE INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt", "passkeyVerified") VALUES ('pages-${role}', 'pages-${role}', '${role === "member" ? testAccount.userId : "collaudo-admin"}', '${expires}', '${now}', '${now}', ${role === "admin-granted" ? 1 : 0});`,
      );
    // Le sessioni non recenti qualificano il richiamo unico al nuovo accesso.
    for (const browser of ["chromium", "webkit"])
      for (const language of ["it", "en"]) {
        const token = `stale-security-${language}-${browser}`;
        statements.push(`INSERT OR REPLACE INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
          VALUES ('${token}', '${token}', ${quote(testAccount.userId)}, '${expires}', '${new Date(Date.now() - day).toISOString()}', '${now}');`);
      }
    // Account separati per lingua, browser e flusso: le prove non alterano fixture concorrenti.
    const unlockAccounts = ["chromium", "webkit"].flatMap((browser) =>
      ["it", "en"].map((language) => `unlock-${language}-${browser}`),
    );
    // La prova Premium si offre dopo la prima lettura riuscita: i suoi account hanno il negozio letto.
    const trialAccounts = ["chromium", "webkit"].flatMap((browser) =>
      ["it", "en"].map((language) => `trial-${language}-${browser}`),
    );
    for (const id of [
      ...unlockAccounts,
      ...trialAccounts,
      "suggestions-it",
      "suggestions-en",
      "stores-premium",
    ]) {
      const value = `VALORE-SINTETICO-${id.split("-")[1]}`;
      statements.push(`DELETE FROM workspaces WHERE id = '${id}'; DELETE FROM "user" WHERE id = '${id}';
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        SELECT '${id}', name, '${id}@example.invalid', 1, "createdAt", "updatedAt" FROM "user" WHERE id = ${quote(testAccount.userId)};
      INSERT INTO user_profiles SELECT '${id}', first_name, last_name, account_type, company_name, updated_at
        FROM user_profiles WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO terms_acceptances SELECT '${id}', terms_version, privacy_version, language, accepted_at
        FROM terms_acceptances WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES ('${id}', '${id}', '${id}', '${expires}', '${now}', '${now}');
      INSERT INTO workspaces VALUES ('${id}', 'Collaudo sblocco', '${now}', NULL);
      INSERT INTO workspace_members VALUES ('${id}', '${id}', 'owner');
      INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
        VALUES ('${id}', '${id}', '${id}', '${now}', 'Negozio sblocco');
      INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
        SELECT '${id}' || suffix, '${id}', '${id}' || suffix, '${now}', '${now}', 'EUR', 100
        FROM (SELECT '' AS suffix UNION ALL SELECT '-2' UNION ALL SELECT '-3' UNION ALL SELECT '-4');
      INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
        SELECT id, id, 'VAT_ID', '${value}' || substr(id, ${id.length + 1}), 'synthetic_fixture', '${now}'
        FROM orders WHERE store_id = '${id}';`);
      if (id.startsWith("suggestions-")) {
        const sourceDate = new Date(Date.now() - day).toISOString();
        const olderDate = new Date(Date.now() - 2 * day).toISOString();
        statements.push(`DELETE FROM tax_identifiers WHERE order_id IN ('${id}', '${id}-2', '${id}-3');
        UPDATE orders SET buyer_eias_token = 'synthetic-stable-buyer' WHERE store_id = '${id}';
        UPDATE orders SET buyer_json = ${quote(
          JSON.stringify({
            username: "acquirente-collaudo",
            name: "Acquirente Collaudo",
            email: "Acquirente.Collaudo@Example.INVALID",
            phone: "333 000 1000",
            billingAddress: {
              addressLine1: "VIA DEL CORSO 1",
              city: "ROMA",
              postalCode: "00186",
              stateOrProvince: "RM",
              countryCode: "IT",
            },
            shipTo: null,
          }),
        )} WHERE id = '${id}';
        UPDATE orders SET creation_time = '${sourceDate}' WHERE id = '${id}-2';
        UPDATE orders SET creation_time = '${olderDate}' WHERE id = '${id}-3';
        INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES ('${id}', '${id}', 'premium', '${olderDate}', '${expires}');
        INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
          VALUES ('${id}-cf', '${id}-2', 'CODICE_FISCALE', 'IT', 'RSSMRA80A01H501U', 'ebay_trading_get_orders', '${now}'),
                 ('${id}-old', '${id}-3', 'CODICE_FISCALE', 'IT', 'BNCLGU80A01H501Z', 'ebay_trading_get_orders', '${now}');
        INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
          VALUES ('${id}', 'ebay_fulfillment', '${now}', 'absent');`);
      }
      // Premium con due negozi: entrambi ammessi, quindi il filtro del negozio compare.
      if (id === "stores-premium")
        statements.push(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
          VALUES ('${id}-2', '${id}', '${id}-2', '${now}', 'Secondo negozio');
        INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES ('${id}', '${id}', 'admin', '${now}', '${expires}');`);
      if (id.startsWith("trial-"))
        statements.push(`INSERT INTO sync_state (store_id, polled_at, last_success_at, updated_at)
          VALUES ('${id}', '${now}', '${now}', '${now}');`);
    }
    // Negozio attivo del Free: due negozi senza copertura, per lingua, browser e tentativo. La
    // sostituzione vale ogni 90 giorni, quindi un nuovo tentativo riparte da uno spazio intatto.
    for (const id of ["chromium", "webkit"].flatMap((browser) =>
      ["it", "en"].flatMap((language) =>
        [0, 1, 2].map((attempt) => `free-store-${language}-${browser}-${attempt}`),
      ),
    )) {
      statements.push(`DELETE FROM workspaces WHERE id = '${id}'; DELETE FROM "user" WHERE id = '${id}';
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        SELECT '${id}', name, '${id}@example.invalid', 1, "createdAt", "updatedAt" FROM "user" WHERE id = ${quote(testAccount.userId)};
      INSERT INTO user_profiles SELECT '${id}', first_name, last_name, account_type, company_name, updated_at
        FROM user_profiles WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO terms_acceptances SELECT '${id}', terms_version, privacy_version, language, accepted_at
        FROM terms_acceptances WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO workspaces (id, name, created_at) VALUES ('${id}', 'Collaudo negozio attivo', '${now}');
      INSERT INTO workspace_members VALUES ('${id}', '${id}', 'owner');
      INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
        VALUES ('${id}', '${id}', '${id}', '${now}', 'Negozio principale'),
               ('${id}-2', '${id}', '${id}-2', '${new Date(Date.now() + 1000).toISOString()}', 'Negozio secondario');
      INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES ('${id}', '${id}', '${id}', '${expires}', '${now}', '${now}');`);
    }
    // Abbonamenti Stripe negli stati del piano, soltanto in lettura: attivo, con il passaggio
    // all'annuale programmato al rinnovo, disdetto, pagamento da confermare, rinnovo non
    // riuscito con il prezzo ancora protetto e scelto durante la prova, con il primo addebito
    // alla sua fine.
    const period = 30 * day;
    const subscriptions = {
      active: { status: "active", start: -day, cancel: 0, paid: true },
      switching: { status: "trialing", start: -day, cancel: 0, paid: true, renewal: "annual" },
      cancelled: { status: "active", start: -day, cancel: 1, paid: true },
      pending: { status: "incomplete", start: -day, cancel: 0, paid: false },
      lapsed: { status: "past_due", start: -2 * day, cancel: 0, paid: false },
      scheduled: { status: "trialing", start: -day, cancel: 0, paid: false, trial: true },
    };
    for (const [state, subscription] of Object.entries(subscriptions)) {
      const id = `subscription-${state}`;
      const start = new Date(Date.now() + subscription.start).toISOString();
      const end = new Date(Date.now() + subscription.start + period).toISOString();
      statements.push(`DELETE FROM workspaces WHERE id = '${id}'; DELETE FROM "user" WHERE id = '${id}';
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        SELECT '${id}', name, '${id}@example.invalid', 1, "createdAt", "updatedAt" FROM "user" WHERE id = ${quote(testAccount.userId)};
      INSERT INTO user_profiles SELECT '${id}', first_name, last_name, account_type, company_name, updated_at
        FROM user_profiles WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO terms_acceptances SELECT '${id}', terms_version, privacy_version, language, accepted_at
        FROM terms_acceptances WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES ('${id}', '${id}', '${id}', '${expires}', '${now}', '${now}');
      INSERT INTO workspaces (id, name, created_at) VALUES ('${id}', 'Collaudo abbonamento', '${now}');
      INSERT INTO workspace_members VALUES ('${id}', '${id}', 'owner');
      INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
        VALUES ('${id}', '${id}', '${id}', '${now}', 'Negozio abbonamento');
      INSERT INTO sync_state (store_id, polled_at, last_success_at, updated_at)
        VALUES ('${id}', '${now}', '${now}', '${now}');
      INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id, offer,
        price_generation, status, current_period_start, current_period_end, cancel_at_period_end,
        synced_at, checked_at, renewal_offer)
        VALUES ('sub_${id}', '${id}', 'test', 'cus_${id}', 'monthly', '2026-09', '${subscription.status}',
          '${start}', '${end}', ${subscription.cancel}, '${now}', '${now}',
          '${subscription.renewal ?? "monthly"}');`);
      if (subscription.paid)
        statements.push(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at,
          stripe_invoice_id, amount_paid, currency, paid_at)
          VALUES ('${id}', '${id}', 'premium', '${start}', '${end}', 'in_${id}', 598, 'eur', '${start}');`);
      // La prova dura quanto il periodo `trialing` di Stripe, senza coperture pagate.
      if (subscription.trial)
        statements.push(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES ('${id}', '${id}', 'trial', '${start}', '${end}');`);
    }
    // Preferenze e campanella: un account per browser e per tentativo, con un negozio da
    // ricollegare. La prova salva tema, fuso e letture: un nuovo tentativo riparte pulito.
    for (const id of ["chromium", "webkit"].flatMap((browser) =>
      [0, 1, 2].map((attempt) => `preferences-${browser}-${attempt}`),
    )) {
      statements.push(`DELETE FROM workspaces WHERE id = '${id}'; DELETE FROM "user" WHERE id = '${id}';
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        SELECT '${id}', name, '${id}@example.invalid', 1, "createdAt", "updatedAt" FROM "user" WHERE id = ${quote(testAccount.userId)};
      INSERT INTO user_profiles SELECT '${id}', first_name, last_name, account_type, company_name, updated_at
        FROM user_profiles WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO terms_acceptances SELECT '${id}', terms_version, privacy_version, language, accepted_at
        FROM terms_acceptances WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO workspaces (id, name, created_at) VALUES ('${id}', 'Collaudo preferenze', '${now}');
      INSERT INTO workspace_members VALUES ('${id}', '${id}', 'owner');
      INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name)
        VALUES ('${id}', '${id}', '${id}', '${now}', 'Negozio preferenze');
      INSERT INTO ebay_store_credentials
        (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at, rejected_at)
        VALUES ('${id}', 'v1.collaudo', '2099-01-01T00:00:00.000Z', 'v1.collaudo', '2099-01-01T00:00:00.000Z', '${now}', '${new Date(Date.now() - day).toISOString()}');
      INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES ('${id}', '${id}', '${id}', '${expires}', '${now}', '${now}');`);
    }
    for (const browser of ["chromium", "webkit"]) {
      const id = `passkey-${browser}`;
      statements.push(`DELETE FROM workspaces WHERE id = '${id}'; DELETE FROM "user" WHERE id = '${id}';
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        SELECT '${id}', name, '${id}@example.invalid', 1, "createdAt", "updatedAt" FROM "user" WHERE id = ${quote(testAccount.userId)};
      INSERT INTO user_profiles SELECT '${id}', first_name, last_name, account_type, company_name, updated_at
        FROM user_profiles WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO terms_acceptances SELECT '${id}', terms_version, privacy_version, language, accepted_at
        FROM terms_acceptances WHERE user_id = ${quote(testAccount.userId)};
      INSERT INTO workspaces (id, name, created_at) VALUES ('${id}', 'Collaudo passkey', '${now}');
      INSERT INTO workspace_members VALUES ('${id}', '${id}', 'owner');
      INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES ('${id}', '${id}', '${id}', '${expires}', '${now}', '${now}');
      INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        SELECT '${id}', '${id}', 'credential', '${id}', password, "createdAt", "updatedAt"
        FROM "account" WHERE "userId" = ${quote(testAccount.userId)} AND "providerId" = 'credential';
      INSERT INTO passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", "createdAt")
        VALUES ('${id}', 'Chiave browser sintetica', 'synthetic-not-for-authentication', '${id}', '${id}', 0, 'singleDevice', 0, '${now}');`);
    }
  }
  // Un solo batch di istruzioni SQL: nessun import di file, che sospende il database.
  const sql = statements.join("\n");
  if (local) executeLocal(sql);
  else
    execFileSync("pnpm", ["exec", "cf", "d1", "raw", database.id, "--sql", sql], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  console.log(`Account di collaudo ripristinato su ${database.name}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
