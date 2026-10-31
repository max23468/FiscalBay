import { strToU8, zipSync } from "fflate";

import { accountExportCopy } from "../copy/account-export";
import type { Language } from "../i18n";
import { csvLine, exportDateTime } from "./order-export.server";

/**
 * Dati dell'account in un archivio ZIP (§12.2, D076), per tutti i piani: un JSON completo e
 * CSV leggibili di profilo, accessi, negozi, piano e configurazioni dell'esportazione. Ogni
 * campo è scelto qui: nessuna password, token, chiave passkey, identificativo della chat o del
 * cliente Stripe, importo, fattura o ricevuta di pagamento, nessun motivo o autore delle
 * concessioni e nessun ordine, che resta nell'esportazione degli ordini con i suoi sblocchi.
 */

type Row = Record<string, string | number | null>;

/** Dati dell'utente letti con un solo batch; ogni lettura parte dall'utente o dal suo spazio. */
async function readAccount(db: D1Database, userId: string) {
  const workspace = "(SELECT workspace_id FROM workspace_members WHERE user_id = ?1)";
  const queries = {
    user: `SELECT u.email, u.emailVerified AS email_verified, u.createdAt AS created_at,
             p.first_name, p.last_name, p.account_type, p.company_name,
             pr.language, pr.theme, pr.time_zone, pr.template_it, pr.template_en,
             (SELECT confirm_unlock FROM unlock_preferences WHERE user_id = u.id) AS confirm_unlock
        FROM "user" u LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN user_preferences pr ON pr.user_id = u.id WHERE u.id = ?1`,
    marketing: `SELECT granted, text_version, recorded_at FROM marketing_consents
        WHERE user_id = ?1 ORDER BY recorded_at DESC, id DESC LIMIT 1`,
    terms: `SELECT terms_version, privacy_version, accepted_at FROM terms_acceptances
        WHERE user_id = ?1 ORDER BY accepted_at DESC LIMIT 1`,
    signIn: `SELECT providerId AS method, NULL AS name, createdAt AS created_at FROM account
        WHERE userId = ?1
        UNION ALL SELECT 'passkey', name, createdAt FROM passkey WHERE userId = ?1
        ORDER BY created_at, method`,
    stores: `SELECT COALESCE(s.store_name, s.display_name) AS name, s.ebay_user_id,
             s.ebay_environment, s.linked_at, s.disconnected_at, s.data_deleted_at,
             (SELECT group_concat(reason, ' ') FROM
               (SELECT reason FROM ebay_store_pauses WHERE store_id = s.id ORDER BY reason)) AS pauses,
             (SELECT enabled FROM telegram_store_preferences WHERE store_id = s.id) AS telegram
        FROM ebay_stores s WHERE s.workspace_id = ${workspace} ORDER BY s.linked_at, s.id`,
    coverages: `SELECT source, starts_at, ends_at, revoked_at FROM workspace_entitlements
        WHERE workspace_id = ${workspace} ORDER BY starts_at, id`,
    subscriptions: `SELECT offer, status, current_period_start, current_period_end,
             cancel_at_period_end FROM stripe_subscriptions
        WHERE workspace_id = ${workspace} ORDER BY current_period_start, id`,
    lifetime: `SELECT kind, status, activated_at FROM lifetime_allocations
        WHERE workspace_id = ${workspace}`,
    extensions: `SELECT months, granted_at, revoked_at FROM history_extensions
        WHERE workspace_id = ${workspace} ORDER BY granted_at, id`,
    cycles: `SELECT starts_at, ends_at, quota, used FROM free_cycles
        WHERE workspace_id = ${workspace} ORDER BY starts_at, id`,
    telegram: `SELECT l.chat_label, l.linked_at, p.enabled, p.filter, p.mode, p.digest_time,
             p.time_zone FROM telegram_links l
        LEFT JOIN telegram_preferences p ON p.workspace_id = l.workspace_id
        WHERE l.workspace_id = ${workspace}`,
    configurations: `SELECT name, format, granularity, columns FROM export_configurations
        WHERE user_id = ?1 ORDER BY name`,
  };
  const names = Object.keys(queries) as Array<keyof typeof queries>;
  const results = await db.batch<Row>(names.map((name) => db.prepare(queries[name]).bind(userId)));
  return Object.fromEntries(names.map((name, index) => [name, results[index]!.results])) as Record<
    keyof typeof queries,
    Row[]
  >;
}

/** Dati dell'account, con le date in UTC come nel database. */
export async function accountData(db: D1Database, userId: string) {
  const data = await readAccount(db, userId);
  const user = data.user[0]!;
  const marketing = data.marketing[0];
  const terms = data.terms[0];
  const telegram = data.telegram[0];
  const bool = (value: string | number | null) => (value === null ? null : value === 1);
  return {
    profile: {
      email: user.email,
      emailVerified: bool(user.email_verified),
      firstName: user.first_name,
      lastName: user.last_name,
      accountType: user.account_type,
      companyName: user.company_name,
      createdAt: user.created_at,
      language: user.language,
      theme: user.theme ?? "system",
      timeZone: user.time_zone ?? "auto",
      confirmUnlock: user.confirm_unlock === null ? true : user.confirm_unlock === 1,
      marketing: marketing
        ? {
            granted: marketing.granted === 1,
            version: marketing.text_version,
            recordedAt: marketing.recorded_at,
          }
        : null,
      terms: terms
        ? {
            termsVersion: terms.terms_version,
            privacyVersion: terms.privacy_version,
            acceptedAt: terms.accepted_at,
          }
        : null,
      templates: { it: user.template_it, en: user.template_en },
    },
    signIn: data.signIn.map((row) => ({
      method: row.method,
      name: row.name,
      createdAt: row.created_at,
    })),
    stores: data.stores.map((row) => ({
      name: row.name,
      ebayUser: row.ebay_user_id,
      environment: row.ebay_environment,
      linkedAt: row.linked_at,
      disconnectedAt: row.disconnected_at,
      dataDeletedAt: row.data_deleted_at,
      pauses: row.pauses ? String(row.pauses).split(" ") : [],
      telegram: bool(row.telegram),
    })),
    plan: {
      coverages: data.coverages.map((row) => ({
        source: row.source,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        revokedAt: row.revoked_at,
      })),
      subscriptions: data.subscriptions.map((row) => ({
        offer: row.offer,
        status: row.status,
        periodStart: row.current_period_start,
        periodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end === 1,
      })),
      lifetime: data.lifetime.map((row) => ({
        kind: row.kind,
        status: row.status,
        activatedAt: row.activated_at,
      })),
      historyExtensions: data.extensions.map((row) => ({
        months: row.months,
        grantedAt: row.granted_at,
        revokedAt: row.revoked_at,
      })),
      freeCycles: data.cycles.map((row) => ({
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        quota: row.quota,
        used: row.used,
      })),
    },
    telegram: telegram
      ? {
          chat: telegram.chat_label,
          linkedAt: telegram.linked_at,
          enabled: telegram.enabled === null ? true : telegram.enabled === 1,
          filter: telegram.filter ?? "fiscal",
          mode: telegram.mode ?? "each",
          digestTime: telegram.digest_time ?? "18:00",
          timeZone: telegram.time_zone,
        }
      : null,
    exportConfigurations: data.configurations.map((row) => ({
      name: row.name,
      format: row.format,
      rows: row.granularity,
      columns: String(row.columns).split(","),
    })),
  };
}

export type AccountData = Awaited<ReturnType<typeof accountData>>;

/** CSV con BOM e celle neutralizzate come quelli degli ordini. */
const csv = (header: readonly string[], rows: Array<Array<string | number | null>>) =>
  `﻿${[header, ...rows].map((row) => csvLine(row.map((value) => String(value ?? "")))).join("")}`;

/** Nome dell'archivio senza dati personali, con la data nel fuso dell'utente. */
export function accountArchiveName(language: Language, now: Date, timeZone: string) {
  return `${accountExportCopy[language].archive}-${exportDateTime(now.toISOString(), timeZone).slice(0, 10)}.zip`;
}

/**
 * Archivio dei dati: il JSON con le date in UTC e i CSV con le date nel fuso dell'utente,
 * intestazioni e nomi dei file nella sua lingua.
 */
export function accountArchive(
  data: AccountData,
  language: Language,
  timeZone: string,
  now: Date,
): Uint8Array {
  const t = accountExportCopy[language];
  const date = (value: string | number | null) =>
    typeof value === "string" ? exportDateTime(value, timeZone) : "";
  const flag = (value: boolean | null) => (value === null ? "" : value ? t.yes : t.no);
  const { profile, telegram } = data;
  const profileRows: Array<[keyof typeof t.profile.rows, string | number | null]> = [
    ["email", profile.email],
    ["emailVerified", flag(profile.emailVerified)],
    ["firstName", profile.firstName],
    ["lastName", profile.lastName],
    ["accountType", profile.accountType],
    ["companyName", profile.companyName],
    ["createdAt", date(profile.createdAt)],
    ["language", profile.language],
    ["theme", profile.theme],
    // Il fuso delle date dei CSV; la scelta salvata, anche «auto», resta nel JSON.
    ["timeZone", timeZone],
    ["confirmUnlock", flag(profile.confirmUnlock)],
    ["marketing", flag(profile.marketing?.granted ?? null)],
    ["marketingAt", date(profile.marketing?.recordedAt ?? null)],
    ["termsVersion", profile.terms?.termsVersion ?? null],
    ["privacyVersion", profile.terms?.privacyVersion ?? null],
    ["termsAt", date(profile.terms?.acceptedAt ?? null)],
    ["templateIt", profile.templates.it],
    ["templateEn", profile.templates.en],
    ...(telegram
      ? ([
          ["telegramChat", telegram.chat],
          ["telegramLinkedAt", date(telegram.linkedAt)],
          ["telegramEnabled", flag(telegram.enabled)],
          ["telegramFilter", telegram.filter],
          ["telegramMode", telegram.mode],
          ["telegramDigestTime", telegram.digestTime],
          ["telegramTimeZone", telegram.timeZone],
        ] satisfies Array<[keyof typeof t.profile.rows, string | number | null]>)
      : []),
  ];
  const plan = [
    ...data.plan.coverages.map((row) => [
      "coverage",
      row.source,
      date(row.startsAt),
      date(row.endsAt),
      row.revokedAt ? `revoked ${date(row.revokedAt)}` : "",
    ]),
    ...data.plan.subscriptions.map((row) => [
      "subscription",
      row.offer,
      date(row.periodStart),
      date(row.periodEnd),
      row.cancelAtPeriodEnd ? `${row.status} cancel_at_period_end` : row.status,
    ]),
    ...data.plan.lifetime.map((row) => [
      "lifetime",
      row.kind,
      date(row.activatedAt),
      "",
      row.status,
    ]),
    ...data.plan.historyExtensions.map((row) => [
      "history_extension",
      `${row.months}`,
      date(row.grantedAt),
      "",
      row.revokedAt ? `revoked ${date(row.revokedAt)}` : "",
    ]),
    ...data.plan.freeCycles.map((row) => [
      "free_cycle",
      `${row.used}/${row.quota}`,
      date(row.startsAt),
      date(row.endsAt),
      "",
    ]),
  ];
  const files = {
    "fiscalbay-account.json": JSON.stringify({ exportedAt: now.toISOString(), ...data }, null, 2),
    [t.profile.file]: csv(
      t.profile.header,
      profileRows.map(([key, value]) => [t.profile.rows[key], value]),
    ),
    [t.signIn.file]: csv(
      t.signIn.header,
      data.signIn.map((row) => [row.method, row.name, date(row.createdAt)]),
    ),
    [t.stores.file]: csv(
      t.stores.header,
      data.stores.map((row) => [
        row.name,
        row.ebayUser,
        row.environment,
        date(row.linkedAt),
        date(row.disconnectedAt),
        date(row.dataDeletedAt),
        row.pauses.join(" "),
        flag(row.telegram),
      ]),
    ),
    [t.plan.file]: csv(t.plan.header, plan),
    [t.configurations.file]: csv(
      t.configurations.header,
      data.exportConfigurations.map((row) => [
        row.name,
        row.format,
        row.rows,
        row.columns.join(", "),
      ]),
    ),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, text]) => [name, [strToU8(text), { mtime: now }]]),
    ),
  );
}
