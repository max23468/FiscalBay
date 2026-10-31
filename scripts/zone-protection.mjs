#!/usr/bin/env node
/**
 * Protezioni della zona e della posta (§24, D168). Descrive, convalida con `dry_run`, applica e
 * rilegge sulla zona comune ai due ambienti:
 *
 * - header di sicurezza e HSTS graduale per gli host dell'ambiente, con una Response Header
 *   Transform Rule: l'impostazione HSTS della zona varrebbe anche per l'altro ambiente;
 * - regole WAF personalizzate: i webhook firmati senza controlli da browser e il blocco delle
 *   sonde osservate nei log del test (file nascosti, PHP, WordPress, backup e configurazioni);
 * - una regola di rate limiting sulle raffiche verso gli endpoint di accesso, prima del binding
 *   Rate Limiting del Worker e dei contatori D1;
 * - DMARC Management, con l'indirizzo `rua` di Cloudflare aggiunto al record esistente, e
 *   Certificate Transparency Monitoring verso l'indirizzo dell'owner.
 *
 * Le regole dell'ambiente si riconoscono dal `ref`: `apply` sostituisce soltanto quelle e lascia
 * le altre della fase. Il readback controlla configurazione, impostazioni conservate (DNSSEC,
 * HTTPS, piano, Bot Fight Mode, posta) e risposte reali dell'ambiente. `remove` toglie le regole
 * dell'ambiente: è il percorso di rientro, insieme alla cronologia delle versioni dei ruleset.
 * Le chiamate passano dal profilo della CLI `cf`.
 *
 * Uso: node scripts/zone-protection.mjs <plan|validate|apply|readback|remove> [--mode live]
 *      node scripts/zone-protection.mjs readback --burst   (prova anche il rate limiting)
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { webhookPaths } from "../app/webhook-paths.ts";
import config, { zone } from "../cloudflare.config.ts";
import * as provider from "./lib/provider.mjs";

/** Indirizzo che riceve gli alert dei certificati: la casella generale dell'owner. */
export const alertEmail = "info@fiscalbay.it";

/** Piano della zona atteso: nessun upgrade implicito. */
export const zonePlan = "free";

/**
 * Scala di HSTS: si sale di un gradino soltanto dopo il readback del precedente. Né
 * `includeSubDomains` né `preload`, finché tutti i sottodomini non sono inventariati e provati.
 * Il test parte da un giorno perché il suo host serve soltanto HTTPS dal bootstrap del dominio.
 */
export const hstsStages = [300, 86_400, 604_800, 31_536_000];
export const hstsStage = { test: 1, live: 0 };

/** Header statici di ogni risposta degli host dell'ambiente; la CSP resta del Worker. */
export const staticHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

/** Raffiche verso gli endpoint di accesso, per IP: sul Free un periodo e un blocco di 10 s. */
export const authBurst = { path: "/api/auth/", requests: 30, period: 10, timeout: 10 };

/** Percorsi delle sonde osservate: nessuna pagina, asset o API dell'app li usa. */
export const probeSuffixes = [".php", ".env", ".sql", ".bak", ".git", ".yml", ".yaml", ".ini"];
export const probePrefixes = ["/wp-", "/phpinfo", "/symfony/", "/vendor/", "/appsettings"];

/** Fasi dei ruleset gestiti, nell'ordine in cui si applicano. */
export const phases = [
  "http_request_firewall_custom",
  "http_ratelimit",
  "http_response_headers_transform",
];

const quote = (value) => JSON.stringify(value);
const set = (values) => `{${values.map(quote).join(" ")}}`;

/** Zona, host, origine e gradino HSTS dell'ambiente, da `cloudflare.config.ts`. */
export function targetOf(mode) {
  const live = mode === "live";
  const { worker } = config({ mode: live ? "live" : "development" });
  const environment = live ? "live" : "test";
  // L'apice porta con sé `www`, che la zona reindirizza all'apice.
  const hosts = worker.domains.flatMap((domain) =>
    domain === zone ? [domain, `www.${zone}`] : [domain],
  );
  return {
    zone,
    environment,
    hosts,
    origin: `https://${worker.domains[0]}`,
    maxAge: hstsStages[hstsStage[environment]],
    prefix: `fiscalbay-${environment}-`,
  };
}

const hostExpression = (target) => `http.host in ${set(target.hosts)}`;

/** Una sola regola di header per ambiente: HSTS al gradino corrente e header statici. */
export function headerRule(target) {
  const headers = {
    "strict-transport-security": `max-age=${target.maxAge}`,
    ...staticHeaders,
  };
  return {
    ref: `${target.prefix}headers`,
    description: "Header di sicurezza e HSTS",
    expression: hostExpression(target),
    action: "rewrite",
    action_parameters: {
      headers: Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [name, { operation: "set", value }]),
      ),
    },
    enabled: true,
  };
}

/**
 * I provider dei webhook non superano controlli da browser: niente Browser Integrity Check né
 * challenge della modalità sotto attacco sui soli percorsi esatti. Firma, segreto e limiti
 * restano del Worker.
 */
export function webhookRule(target) {
  return {
    ref: `${target.prefix}webhooks`,
    description: "Webhook firmati senza controlli da browser",
    expression: `${hostExpression(target)} and http.request.uri.path in ${set(webhookPaths)}`,
    action: "skip",
    action_parameters: { products: ["bic", "securityLevel"] },
    enabled: true,
  };
}

/** Le sonde si fermano all'edge, senza invocare il Worker. `/.well-known/` resta aperto. */
export function probeRule(target) {
  const uri = "lower(http.request.uri.path)";
  const probes = [
    `(${uri} contains "/." and not starts_with(${uri}, "/.well-known/"))`,
    ...probeSuffixes.map((suffix) => `ends_with(${uri}, ${quote(suffix)})`),
    ...probePrefixes.map((prefix) => `starts_with(${uri}, ${quote(prefix)})`),
  ];
  return {
    ref: `${target.prefix}probes`,
    description: "Sonde di file nascosti, PHP e configurazioni",
    expression: `${hostExpression(target)} and (${probes.join(" or ")})`,
    action: "block",
    enabled: true,
  };
}

/**
 * Sul Free la regola di rate limiting è una sola e vede soltanto il percorso: vale per la zona,
 * quindi per entrambi gli ambienti, e ha un `ref` senza ambiente.
 */
export function authRule() {
  return {
    ref: "fiscalbay-auth-burst",
    description: "Raffiche verso gli endpoint di accesso",
    expression: `starts_with(http.request.uri.path, ${quote(authBurst.path)})`,
    action: "block",
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period: authBurst.period,
      requests_per_period: authBurst.requests,
      mitigation_timeout: authBurst.timeout,
    },
    enabled: true,
  };
}

/** Regole previste per fase. */
export function desiredRules(target) {
  return {
    http_request_firewall_custom: [webhookRule(target), probeRule(target)],
    http_ratelimit: [authRule()],
    http_response_headers_transform: [headerRule(target)],
  };
}

const ruleKeys = [
  "ref",
  "description",
  "expression",
  "action",
  "action_parameters",
  "ratelimit",
  "enabled",
  "logging",
];

/** Campi scrivibili di una regola letta dal provider. */
export function writableRule(rule) {
  return Object.fromEntries(
    ruleKeys.filter((key) => rule[key] !== undefined).map((key) => [key, rule[key]]),
  );
}

/**
 * Regole della fase dopo l'applicazione: quelle previste prendono il posto delle omonime o si
 * aggiungono in fondo; restano quelle di altri ambienti o create a mano, tolte le regole
 * dell'ambiente non più previste.
 */
export function mergeRules(existing, desired, target) {
  const refs = new Set(desired.map((rule) => rule.ref));
  const kept = (existing ?? [])
    .filter((rule) => refs.has(rule.ref) || !rule.ref?.startsWith(target.prefix))
    .map((rule) => desired.find((wanted) => wanted.ref === rule.ref) ?? writableRule(rule));
  const placed = new Set(kept.map((rule) => rule.ref));
  return [...kept, ...desired.filter((rule) => !placed.has(rule.ref))];
}

/** Regole della fase senza quelle dell'ambiente; la regola di zona resta all'ultimo ambiente. */
export function removeRules(existing, target, otherPrefix) {
  const others = (existing ?? []).some((rule) => rule.ref?.startsWith(otherPrefix));
  return (existing ?? [])
    .filter(
      (rule) => !rule.ref?.startsWith(target.prefix) && (others || rule.ref !== authRule().ref),
    )
    .map(writableRule);
}

const dmarcMailbox = "dmarc-reports.cloudflare.net";

/**
 * Record DMARC con l'indirizzo `rua` di Cloudflare aggiunto agli eventuali altri; policy,
 * allineamento e ogni altro tag restano com'erano.
 */
export function dmarcWithReports(content, ruaPrefix) {
  const address = `mailto:${ruaPrefix}@${dmarcMailbox}`;
  const tags = content
    .replace(/^"|"$/gu, "")
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const index = tags.findIndex((tag) => /^rua\s*=/iu.test(tag));
  if (index === -1) return [...tags, `rua=${address}`].join("; ");
  const addresses = tags[index].replace(/^rua\s*=\s*/iu, "").split(",");
  if (!addresses.map((value) => value.trim()).includes(address))
    tags[index] = `rua=${[...addresses.map((value) => value.trim()), address].join(",")}`;
  return tags.join("; ");
}

/** Valore di un tag DMARC, o `undefined`. */
export function dmarcTag(content, name) {
  for (const tag of String(content ?? "")
    .replace(/^"|"$/gu, "")
    .split(";")) {
    const [key, ...value] = tag.split("=");
    if (key.trim().toLowerCase() === name) return value.join("=").trim();
  }
  return undefined;
}

/** Piano stampabile: regole, impostazioni della posta e risposte attese. */
export function plan(target) {
  return {
    zone: target.zone,
    environment: target.environment,
    hosts: target.hosts,
    rules: desiredRules(target),
    ctAlerting: { enabled: true, emails: [alertEmail] },
    dmarcReports: { enabled: true, rua: `mailto:<prefisso della zona>@${dmarcMailbox}` },
    hsts: { stages: hstsStages, current: target.maxAge },
  };
}

/** `expected` contenuto in `actual`: il provider aggiunge valori predefiniti alle regole. */
export function contains(actual, expected) {
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => contains(actual[index], value))
    );
  return (
    actual !== null &&
    typeof actual === "object" &&
    Object.entries(expected).every(([key, value]) => contains(actual[key], value))
  );
}

const header = (response, name) => response?.headers?.[name] ?? null;
const mitigated = (response) => header(response, "cf-mitigated") !== null;

/** Header di sicurezza attesi su una risposta reale. */
function securedHeaders(target, response) {
  return (
    header(response, "strict-transport-security") === `max-age=${target.maxAge}` &&
    Object.entries(staticHeaders).every(([name, value]) => header(response, name) === value)
  );
}

/** Reindirizzamento permanente verso l'indirizzo atteso, percorso e query compresi. */
const redirectsTo = (response, location) =>
  [301, 308].includes(response?.status) && header(response, "location") === location;

/**
 * Controlli del readback: regole previste attive, impostazioni della posta e della zona
 * conservate, risposte reali dell'ambiente.
 */
export function checkReadback(target, state) {
  const desired = desiredRules(target);
  const rulesIn = (phase) => state.rulesets?.[phase]?.rules ?? [];
  const ruleChecks = phases.flatMap((phase) =>
    desired[phase].map((rule) => [
      `regola ${rule.ref}`,
      rulesIn(phase).filter((actual) => actual.ref === rule.ref).length === 1 &&
        contains(
          rulesIn(phase).find((actual) => actual.ref === rule.ref),
          rule,
        ),
    ]),
  );
  const dmarcRecords = (state.dns ?? []).filter(
    (record) => record.type === "TXT" && record.name === `_dmarc.${target.zone}`,
  );
  const dmarc = dmarcRecords[0]?.content;
  const spf = (state.dns ?? []).filter(
    (record) => record.type === "TXT" && /^"?v=spf1/iu.test(record.content),
  );
  const mx = (state.dns ?? [])
    .filter((record) => record.type === "MX" && record.name === target.zone)
    .map((record) => record.content)
    .sort();
  const hsts = state.settings?.security_header?.strict_transport_security ?? {};
  const responses = state.responses ?? {};
  const [host] = target.hosts;
  const checks = [
    ...ruleChecks,
    ["piano della zona invariato", state.zone?.plan?.legacy_id === zonePlan],
    ["DNSSEC attivo", state.dnssec?.status === "active"],
    ["HTTPS sempre", state.settings?.always_use_https === "on"],
    ["TLS 1.2 minimo", ["1.2", "1.3"].includes(state.settings?.min_tls_version)],
    [
      "HSTS di zona senza sottodomini né preload",
      hsts.include_subdomains !== true && hsts.preload !== true,
    ],
    ["Bot Fight Mode spento", state.botManagement?.fight_mode === false],
    [
      "alert dei certificati",
      state.ctAlerting?.enabled === true &&
        Array.isArray(state.ctAlerting.emails) &&
        state.ctAlerting.emails.includes(alertEmail),
    ],
    ["DMARC Management attivo", state.dmarcReports?.enabled === true],
    [
      "un solo record DMARC con i report",
      dmarcRecords.length === 1 &&
        Boolean(state.dmarcReports?.rua_prefix) &&
        dmarcWithReports(dmarc, state.dmarcReports.rua_prefix) === dmarc.replace(/^"|"$/gu, ""),
    ],
    [
      "policy DMARC conservata",
      dmarcTag(dmarc, "p") === "quarantine" &&
        dmarcTag(dmarc, "adkim") === "r" &&
        dmarcTag(dmarc, "aspf") === "r",
    ],
    ["un solo SPF per nome", new Set(spf.map((record) => record.name)).size === spf.length],
    ["MX iCloud conservati", mx.join() === ["mx01.mail.icloud.com", "mx02.mail.icloud.com"].join()],
    [
      "pagina con header e CSP",
      responses.page?.status === 200 &&
        securedHeaders(target, responses.page) &&
        /frame-ancestors 'none'/u.test(header(responses.page, "content-security-policy") ?? "") &&
        header(responses.page, "cache-control") === "no-store",
    ],
    [
      "asset con header",
      responses.asset?.status === 200 && securedHeaders(target, responses.asset),
    ],
    [
      "pagina assente con header",
      responses.missing?.status === 404 && securedHeaders(target, responses.missing),
    ],
    ["sonda bloccata dalla zona", responses.probe?.status === 403],
    [
      "webhook invalido rifiutato dal Worker",
      [400, 401, 404, 412].includes(responses.webhook?.status) && !mitigated(responses.webhook),
    ],
    [
      "HTTP verso HTTPS con percorso e query",
      redirectsTo(responses.http, `https://${host}/percorso?q=1`),
    ],
  ];
  if (target.hosts.includes(`www.${target.zone}`))
    checks.push([
      "www verso l'apice con percorso e query",
      redirectsTo(responses.www, `https://${target.zone}/percorso?q=1`),
    ]);
  if (responses.burst)
    checks.push([
      "raffica di accessi limitata",
      responses.burst.limited === true && responses.burst.first !== 429,
    ]);
  return { ok: checks.every(([, ok]) => ok), checks: Object.fromEntries(checks) };
}

/** CLI `cf` sulla zona del sito. */
const cf = (args, options) => provider.cf([...args, "--zone", zone], options);
const cfJson = (args, options) => provider.cfJson([...args, "--zone", zone], options);

// Le letture facoltative tacciono gli errori, come per una fase ancora vuota.
const optional = (args) => {
  try {
    return cfJson(args, { stderr: "ignore" });
  } catch {
    return null;
  }
};

/** Esegue la CLI con il corpo in un file temporaneo. */
function withBodyFile(body, run) {
  const directory = mkdtempSync(path.join(tmpdir(), "zone-protection-"));
  const file = path.join(directory, "body.json");
  try {
    writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
    return run(`@${file}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const readRuleset = (phase) => optional(["rulesets", "entrypoint", "get", phase]);

/** Scrive la fase; con `validate` il provider convalida soltanto (`dry_run=true`). */
function writeRules(phase, rules, { validate = false } = {}) {
  withBodyFile({ rules }, (file) =>
    cf([
      "rulesets",
      "entrypoint",
      "update",
      phase,
      "--body",
      file,
      ...(validate ? ["--validate-only"] : []),
      "-q",
    ]),
  );
}

function plannedRules(target) {
  const desired = desiredRules(target);
  return Object.fromEntries(
    phases.map((phase) => [phase, mergeRules(readRuleset(phase)?.rules, desired[phase], target)]),
  );
}

function validate(target) {
  const rules = plannedRules(target);
  for (const phase of phases) writeRules(phase, rules[phase], { validate: true });
  return rules;
}

function applyMail() {
  cf(["ssl", "ct-alerting", "update", "--enabled", "true", "--emails", alertEmail, "-q"]);
  cf(["email-auth", "dmarc-reports", "edit", "--enabled", "true", "--skip-wizard", "true", "-q"]);
  const reports = cfJson(["email-auth", "dmarc-reports", "get"]);
  const [record] = reports.records?.dmarc_records ?? [];
  if (!record) throw new Error("Nessun record DMARC nella zona.");
  const content = dmarcWithReports(record.content, reports.rua_prefix);
  if (content !== record.content.replace(/^"|"$/gu, ""))
    cf([
      "dns",
      "records",
      "edit",
      record.id,
      "--body",
      JSON.stringify({ type: "TXT", content: quote(content) }),
      "-q",
    ]);
}

function apply(target) {
  // La convalida di tutte le fasi precede ogni scrittura.
  const rules = validate(target);
  for (const phase of phases) writeRules(phase, rules[phase]);
  applyMail();
}

function remove(target) {
  const other = targetOf(target.environment === "live" ? "test" : "live");
  for (const phase of phases) {
    const existing = readRuleset(phase)?.rules;
    if (existing?.length) writeRules(phase, removeRules(existing, target, other.prefix));
  }
}

const headersOf = (response) =>
  Object.fromEntries([...response.headers].map(([name, value]) => [name.toLowerCase(), value]));

async function request(url, init = {}) {
  const response = await fetch(url, { redirect: "manual", ...init });
  await response.body?.cancel();
  return { status: response.status, headers: headersOf(response) };
}

/** Raffica sul percorso di accesso: il primo esito e se arriva un 429 prima della fine. */
async function burst(target) {
  const url = `${target.origin}${authBurst.path}zona-raffica`;
  const statuses = [];
  for (let index = 0; index < authBurst.requests + 10; index++) {
    statuses.push((await request(url)).status);
    if (statuses.at(-1) === 429) break;
  }
  return { first: statuses[0], limited: statuses.at(-1) === 429, requests: statuses.length };
}

async function readResponses(target, withBurst) {
  const [host] = target.hosts;
  const responses = {
    page: await request(`${target.origin}/`),
    asset: await request(`${target.origin}/favicon.ico`),
    missing: await request(`${target.origin}/pagina-inesistente-zona`),
    probe: await request(`${target.origin}/.env`),
    webhook: await request(`${target.origin}/webhooks/stripe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    http: await request(`http://${host}/percorso?q=1`),
  };
  if (target.hosts.includes(`www.${target.zone}`))
    responses.www = await request(`https://www.${target.zone}/percorso?q=1`);
  if (withBurst) responses.burst = await burst(target);
  return responses;
}

async function readState(target, withBurst) {
  const setting = (name) => optional(["zones", "settings", "get", name])?.value;
  return {
    rulesets: Object.fromEntries(phases.map((phase) => [phase, readRuleset(phase)])),
    zone: optional(["zones", "get"]),
    dnssec: optional(["dns", "dnssec", "get"]),
    settings: {
      always_use_https: setting("always_use_https"),
      min_tls_version: setting("min_tls_version"),
      security_header: setting("security_header"),
    },
    botManagement: optional(["bot-management", "get"]),
    ctAlerting: optional(["ssl", "ct-alerting", "get"]),
    dmarcReports: optional(["email-auth", "dmarc-reports", "get"]),
    dns: optional(["dns", "records", "list"]) ?? [],
    responses: await readResponses(target, withBurst),
  };
}

const print = (value) => console.log(JSON.stringify(value, null, 2));

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string" }, burst: { type: "boolean", default: false } },
  });
  const [name] = positionals;
  const target = targetOf(values.mode);
  if (name === "plan") return print(plan(target));
  if (name === "validate") {
    validate(target);
    return print({ ok: true, validated: phases });
  }
  if (name === "remove") {
    remove(target);
    return print({ ok: true, removed: target.prefix });
  }
  if (name === "apply") apply(target);
  if (name !== "apply" && name !== "readback")
    throw new Error("Comandi: plan, validate, apply, readback, remove");
  const result = checkReadback(target, await readState(target, values.burst));
  print(result);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
