#!/usr/bin/env node
/**
 * Checklist operativa del go-live (§41). Rilegge in sola lettura le risorse dell'ambiente e
 * raccoglie in un solo esito i readback degli script di area, più le prove che restano
 * all'owner o a un'osservazione successiva.
 *
 * Due fasi. `prima` vale prima di `Promuovi`: Worker e dominio, segreti dichiarati, D1, code,
 * bucket dei file, widget Turnstile, registro delle scadenze, ambiente GitHub della pubblicazione
 * e account Stripe.
 * `dopo` vale dopo il deploy e prima di aprire le iscrizioni: superficie pubblica (robots,
 * sitemap, pagine indicizzabili e `noindex`), consumer della coda, protezioni della zona sulle
 * risposte reali, archivio dei log, sottoscrizioni eBay, bot Telegram e promozione. Sul test le due fasi si
 * rileggono insieme, perché il Worker è già distribuito.
 *
 * Il resoconto riporta soltanto nomi ed esiti, mai valori di segreti o dati degli utenti. Esce
 * con 1 se un controllo automatico non passa o non si esegue; le voci dell'owner restano da
 * attestare e non cambiano l'esito.
 *
 * Uso: node scripts/go-live.mjs [plan|check] [--mode live] [--phase prima|dopo|tutte]
 * Telegram si rilegge soltanto con `TELEGRAM_BOT_TOKEN` dell'ambiente nelle variabili del
 * comando, come per `telegram-bot.mjs`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import config, { databases } from "../cloudflare.config.ts";
import { declaredSecrets, defaultFile, parseRegistry, review } from "./credential-expiries.mjs";
import { cfJson, ghJson } from "./lib/provider.mjs";

/** Retention delle code e regola dei file esportati, come in RELEASE. */
export const queueRetention = 14 * 86_400;
export const exportsMaxAge = 86_400;

/** Ambiente letto da `cloudflare.config.ts` con la stessa modalità della build. */
export function targetOf(mode) {
  const live = mode === "live";
  const { worker } = config({ mode: live ? "live" : "development" });
  const environment = live ? "live" : "test";
  const queue = worker.triggers.find(({ type }) => type === "queue");
  return {
    live,
    environment,
    worker: worker.name,
    domain: worker.domains[0],
    origin: new URL(worker.env.APP_ORIGIN.value).origin,
    database: databases[environment],
    queue,
    exports: worker.env.EXPORT_FILES.name,
    turnstile: worker.name,
    secrets: declaredSecrets(mode),
    // Ambiente GitHub del deploy: in Production anche con l'interruttore.
    github: live
      ? { environment: "production", branch: "main", enabled: "PRODUCTION_PUBLISH_ENABLED" }
      : { environment: "test", branch: "develop" },
  };
}

const modeArgs = (target) => (target.live ? ["--mode", "live"] : []);

/**
 * Readback degli script di area, ciascuno con il proprio resoconto ed esito. `needs` elenca le
 * variabili del processo senza le quali la voce non si esegue.
 */
export function scriptSteps(target) {
  const mode = modeArgs(target);
  return [
    {
      phase: "prima",
      area: "Stripe",
      item: "account, listino, imposte, webhook e portale",
      args: [
        "scripts/stripe-account.mjs",
        ...mode,
        ...(target.live ? [] : ["--project-name", "fiscalbay-sandbox"]),
      ],
    },
    {
      // Il readback richiede anche il Worker con Logpush, che arriva con il deploy.
      phase: "dopo",
      area: "Alert",
      item: "archivio dei log a 90 giorni e job Logpush",
      args: ["scripts/log-archive.mjs", "readback", ...mode],
    },
    {
      phase: "dopo",
      area: "DNS e TLS",
      item: "protezioni della zona, header, www, HTTP e posta",
      args: ["scripts/zone-protection.mjs", "readback", ...mode],
    },
    {
      phase: "dopo",
      area: "eBay",
      item: "email di avviso, destinazione e sottoscrizioni dell'applicazione",
      args: ["scripts/ebay-notifications.mjs", ...mode],
    },
    {
      phase: "dopo",
      area: "Telegram",
      item: "webhook e menu del bot",
      args: ["scripts/telegram-bot.mjs", ...mode],
      needs: ["TELEGRAM_BOT_TOKEN"],
    },
    {
      phase: "dopo",
      area: "Stripe",
      item: "promozione, quote, ammissione e posti lifetime",
      args: [
        "scripts/commercial.mjs",
        "preflight",
        ...mode,
        ...(target.live ? [] : ["--project-name", "fiscalbay-sandbox"]),
      ],
    },
  ];
}

/**
 * Prove che nessuno script attesta: restano all'owner o a un'osservazione, con il luogo in cui
 * si registra l'esito. Non cambiano l'esito del comando.
 */
export const ownerItems = [
  {
    phase: "prima",
    area: "Legali",
    item: "garanzie dei trasferimenti extra UE per fornitore, obblighi 28 CFR Part 202 del DPA eBay, trattamento dei dati di OpenAI prima di usare Codex su dati reali",
  },
  {
    phase: "prima",
    area: "Supporto",
    item: "casella supporto@ senza conversazioni oltre 24 mesi, notifica immediata per i mittenti Stripe e Link",
  },
  {
    phase: "prima",
    area: "Stripe",
    item: "voci a vista della dashboard live: termini e privacy del checkout, sede fiscale, Smart Retries, metodi Managed Payments",
  },
  {
    phase: "prima",
    area: "eBay",
    item: "RuName Production con nome, privacy, URL di ritorno e logo di fiscalbay.it e OAuth attivo",
  },
  {
    phase: "dopo",
    area: "Auth",
    item: "password, Google, passkey e Accedi con eBay con un account business su fiscalbay.it",
  },
  {
    phase: "dopo",
    area: "Alert",
    item: "primo report DMARC e primo alert dei certificati letti",
  },
  {
    phase: "dopo",
    area: "KPI",
    item: "console Production con KPI, metriche tecniche e anomalie leggibili",
  },
  {
    phase: "dopo",
    area: "Rollback",
    item: "versione precedente o forward-fix pronti secondo il ciclo di Promuovi",
  },
];

const byName = (items, name, key = "name") => items?.find((item) => item?.[key] === name);

/**
 * Ambiente GitHub del deploy: soltanto il branch dell'ambiente, poi account, token e, in
 * Production, interruttore.
 */
export function checkPublication(expected, state) {
  const policy = state?.environment?.deployment_branch_policy;
  const variables = new Map((state?.variables ?? []).map(({ name, value }) => [name, value]));
  const missing = [
    ...["CLOUDFLARE_ACCOUNT_ID", ...(expected.enabled ? [expected.enabled] : [])].filter(
      (name) => !variables.get(name),
    ),
    ...((state?.secrets ?? []).includes("CLOUDFLARE_API_TOKEN") ? [] : ["CLOUDFLARE_API_TOKEN"]),
  ];
  return [
    {
      area: "Rollback",
      item: `ambiente GitHub ${expected.environment} soltanto per ${expected.branch}`,
      ok:
        policy?.custom_branch_policies === true &&
        JSON.stringify(state?.branches ?? []) === JSON.stringify([expected.branch]),
    },
    {
      area: "Rollback",
      item: `${expected.enabled ? "account, token e interruttore" : "account e token"} nell'ambiente ${expected.environment}`,
      ok:
        Boolean(state?.environment) &&
        missing.length === 0 &&
        (!expected.enabled || variables.get(expected.enabled) === "true"),
      detail: missing.length ? `mancano ${missing.join(", ")}` : undefined,
    },
  ];
}

/** Controlli sulle risorse dell'ambiente, da uno stato letto con la CLI. */
export function checkResources(target, state, phase) {
  const worker = byName(state.workers, target.worker);
  const secrets = new Set(state.secrets ?? []);
  const missing = target.secrets.filter((name) => !secrets.has(name));
  const queue = byName(state.queues, target.queue.name, "queue_name");
  const failed = byName(state.queues, target.queue.deadLetterQueue, "queue_name");
  const rules = state.lifecycle?.rules ?? [];
  const widget = byName(state.widgets, target.turnstile);
  const registry = state.registry;
  const pending = [
    ...(registry?.rows ?? [])
      .filter(({ state: entry }) => entry !== "valid" && entry !== "never")
      .map(({ name }) => name),
    ...(registry?.missing ?? []),
  ];
  const results = [
    {
      area: "DNS e TLS",
      item: `Worker con dominio ${target.domain}`,
      ok: Boolean(worker?.references?.domains?.some(({ hostname }) => hostname === target.domain)),
    },
    {
      area: "Auth",
      item: "segreti dichiarati sul Worker",
      ok: Boolean(state.secrets) && missing.length === 0,
      detail: missing.length ? `mancano ${missing.join(", ")}` : undefined,
    },
    { area: "Dati", item: "D1 dell'ambiente in UE", ok: state.database?.jurisdiction === "eu" },
    ...[queue, failed].map((entry, index) => ({
      area: "Quote",
      item: `coda ${index ? target.queue.deadLetterQueue : target.queue.name} in UE a 14 giorni`,
      ok:
        entry?.jurisdiction === "eu" &&
        entry?.settings?.message_retention_period === queueRetention,
    })),
    {
      area: "Dati",
      item: `bucket ${target.exports} in UE senza accesso pubblico`,
      ok:
        state.bucket?.jurisdiction === "eu" &&
        state.managedDomain?.enabled === false &&
        Array.isArray(state.customDomains?.domains) &&
        state.customDomains.domains.length === 0,
    },
    {
      area: "Dati",
      item: "file esportati eliminati dopo un giorno",
      ok:
        rules.length === 1 &&
        rules[0].enabled === true &&
        (rules[0].conditions?.prefix ?? "") === "" &&
        rules[0].deleteObjectsTransition?.condition?.maxAge === exportsMaxAge &&
        rules[0].abortMultipartUploadsTransition?.condition?.maxAge === exportsMaxAge,
    },
    {
      area: "Auth",
      item: `widget Turnstile gestito sul solo ${target.domain}`,
      ok:
        widget?.mode === "managed" &&
        JSON.stringify(widget?.domains ?? []) === JSON.stringify([target.domain]),
    },
    {
      area: "Alert",
      item: "registro delle scadenze senza voci scadute, in scadenza o senza data",
      ok: Boolean(registry) && !registry.error && pending.length === 0,
      detail: registry?.error ?? (pending.length ? pending.join(", ") : undefined),
    },
    ...checkPublication(target.github, state.github),
  ];
  if (phase === "prima") return results;
  const consumer = queue?.consumers?.find(({ script }) => script === target.worker);
  return [
    ...results,
    {
      area: "Quote",
      item: "consumer della coda con retry e coda dei falliti",
      ok:
        consumer?.dead_letter_queue === target.queue.deadLetterQueue &&
        consumer?.settings?.batch_size === target.queue.maxBatchSize &&
        consumer?.settings?.max_retries === target.queue.maxRetries &&
        consumer?.settings?.max_concurrency === target.queue.maxConcurrency &&
        Boolean(queue?.producers?.some(({ script }) => script === target.worker)),
    },
  ];
}

/**
 * Percorsi letti oltre alle pagine della sitemap: legali, accesso e area riservata, anteprima.
 * Le pagine pubbliche vengono dalla sitemap servita, che il Worker compone dal codice.
 */
export const surfacePaths = {
  legal: ["/termini", "/privacy", "/en/termini", "/en/privacy"],
  private: ["/accesso", "/app/ordini", "/en/accesso"],
  preview: "/anteprima",
};

/** Pagine elencate nella sitemap dell'origine, come percorsi. */
export function sitemapPaths(origin, body = "") {
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/gu)]
    .map(([, loc]) => loc)
    .filter((loc) => loc.startsWith(`${origin}/`))
    .map((loc) => loc.slice(origin.length));
}

const noindex = (response) => /noindex/iu.test(response?.headers?.["x-robots-tag"] ?? "");

/**
 * Superficie pubblica. In Production robots chiude soltanto le aree private e indica la
 * sitemap, le cui pagine, in italiano e in inglese, rispondono senza `noindex`; altrove robots
 * chiude il dominio e ogni pagina è `noindex`. Ovunque Termini e Privacy rispondono `noindex`,
 * accesso e area riservata pure, e le risposte dichiarano la versione del Worker; in Production
 * l'anteprima non esiste.
 */
export function checkSurface(target, responses) {
  const pages = sitemapPaths(target.origin, responses.sitemap?.body);
  const robotsBody = responses.robots?.body ?? "";
  const read = (page) => responses.pages[page];
  return [
    {
      area: "SEO",
      item: target.live ? "robots.txt con aree private e sitemap" : "robots.txt chiude il dominio",
      ok:
        responses.robots?.status === 200 &&
        (target.live
          ? robotsBody.includes(`Sitemap: ${target.origin}/sitemap.xml`) &&
            ["/app/", "/accesso", "/admin", "/api/"].every((prefix) =>
              robotsBody.includes(`Disallow: ${prefix}`),
            ) &&
            !/^Disallow: \/$/mu.test(robotsBody)
          : robotsBody === "User-agent: *\nDisallow: /\n"),
    },
    {
      area: "SEO",
      item: "sitemap con home e pagine in due lingue",
      ok:
        responses.sitemap?.status === 200 &&
        pages.includes("/") &&
        pages.includes("/en") &&
        pages.every((page) => !surfacePaths.legal.includes(page)),
    },
    {
      area: "SEO",
      item: "pagine della sitemap raggiungibili",
      ok: pages.length > 0 && pages.every((page) => read(page)?.status === 200),
    },
    {
      area: "SEO",
      item: target.live
        ? "pagine della sitemap indicizzabili"
        : "pagine noindex fuori da Production",
      ok: pages.length > 0 && pages.every((page) => noindex(read(page)) !== target.live),
    },
    {
      area: "Legali",
      item: "Termini e Privacy raggiungibili e noindex",
      ok: surfacePaths.legal.every((page) => read(page)?.status === 200 && noindex(read(page))),
    },
    {
      area: "SEO",
      item: "accesso e area riservata noindex",
      ok: surfacePaths.private.every((page) => noindex(read(page))),
    },
    ...(target.live
      ? [{ area: "SEO", item: "anteprima assente", ok: read(surfacePaths.preview)?.status === 404 }]
      : []),
    {
      area: "Rollback",
      item: "versione del Worker dichiarata nelle risposte",
      ok: Boolean(read("/")?.headers?.["x-fiscalbay-version"]),
    },
  ];
}

/** Esito di uno script di area: non eseguito senza le variabili, altrimenti l'uscita. */
export function runStep(step, { env = process.env, spawn = spawnSync } = {}) {
  const absent = (step.needs ?? []).filter((name) => !env[name]?.trim());
  if (absent.length)
    return { ...step, ok: false, detail: `non eseguito, servono ${absent.join(", ")}` };
  const result = spawn(process.execPath, step.args, { encoding: "utf8", env });
  return {
    ...step,
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

const mark = (ok) => (ok === true ? "✓" : ok === false ? "✗" : "○");

/** Resoconto per area: esito, voce, dettaglio e, per gli script, la loro uscita rientrata. */
export function report(results) {
  return results
    .map(({ ok, area, item, detail, output }) => {
      const line = `${mark(ok)} ${area} · ${item}${detail ? ` (${detail})` : ""}`;
      return output ? `${line}\n${output.replace(/^/gmu, "    ")}` : line;
    })
    .join("\n");
}

/** Elenco delle voci per fase, senza letture. */
export function plan(target) {
  const lines = [`Checklist operativa · ${target.environment}`];
  const before = checkResources(target, {}, "prima");
  const checks = {
    prima: before,
    dopo: [
      ...checkResources(target, {}, "dopo").slice(before.length),
      ...checkSurface(target, { pages: {} }),
    ],
  };
  for (const phase of ["prima", "dopo"]) {
    lines.push(`Fase ${phase}:`);
    const steps = scriptSteps(target).filter((step) => step.phase === phase);
    const owner = ownerItems.filter((entry) => entry.phase === phase);
    for (const { area, item } of checks[phase]) lines.push(`  ${area} · ${item}`);
    for (const { area, item, args } of steps)
      lines.push(`  ${area} · ${item}: node ${args.join(" ")}`);
    for (const { area, item } of owner) lines.push(`  ${area} · ${item} (owner)`);
  }
  return lines.join("\n");
}

// Le letture facoltative tacciono gli errori, come per una risorsa non ancora creata.
function optional(args) {
  try {
    return cfJson(args, { stderr: "ignore" });
  } catch {
    return null;
  }
}

const jurisdiction = ["--cf-r2-jurisdiction", "eu"];

function readRegistry(target) {
  try {
    return review(
      parseRegistry(readFileSync(defaultFile(), "utf8"), target.environment),
      target.secrets,
    );
  } catch (error) {
    return { rows: [], missing: [], error: error.message };
  }
}

function readResources(target) {
  return {
    workers: optional(["workers", "list"]),
    secrets: optional(["workers", "secrets", "list", "--worker", target.worker])?.map(
      ({ name }) => name,
    ),
    database: optional(["d1", "get", target.database.id]),
    queues: optional(["queues", "list"]),
    bucket: optional(["r2", "buckets", "get", target.exports, ...jurisdiction]),
    lifecycle: optional(["r2", "buckets", "lifecycle", "get", target.exports, ...jurisdiction]),
    managedDomain: optional([
      "r2",
      "buckets",
      "domains",
      "managed",
      "list",
      "--bucket-name",
      target.exports,
      ...jurisdiction,
    ]),
    customDomains: optional([
      "r2",
      "buckets",
      "domains",
      "custom",
      "list",
      "--bucket-name",
      target.exports,
      ...jurisdiction,
    ]),
    widgets: optional(["turnstile", "widgets", "list"]),
    registry: readRegistry(target),
    github: readPublication(target.github),
  };
}

function readPublication({ environment }) {
  const api = (route) => {
    try {
      return ghJson("api", `repos/{owner}/{repo}/environments/${environment}${route}`);
    } catch {
      return null;
    }
  };
  return {
    environment: api(""),
    branches: api("/deployment-branch-policies")?.branch_policies?.map(({ name }) => name),
    variables: api("/variables")?.variables,
    secrets: api("/secrets")?.secrets?.map(({ name }) => name),
  };
}

async function read(url, body = false) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = body ? await response.text() : (await response.body?.cancel(), undefined);
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: text,
    };
  } catch {
    return null;
  }
}

async function readSurface(target) {
  const sitemap = await read(`${target.origin}/sitemap.xml`, true);
  const all = [
    ...sitemapPaths(target.origin, sitemap?.body),
    ...surfacePaths.legal,
    ...surfacePaths.private,
    surfacePaths.preview,
  ];
  const pages = Object.fromEntries(
    await Promise.all(all.map(async (page) => [page, await read(`${target.origin}${page}`)])),
  );
  return { robots: await read(`${target.origin}/robots.txt`, true), sitemap, pages };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string", default: "test" }, phase: { type: "string" } },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const target = targetOf(values.mode);
  const command = positionals[0] ?? "check";
  if (command === "plan") return console.log(plan(target));
  if (command !== "check") throw new Error("Comandi: plan, check.");
  // Il test è già distribuito: senza fase esplicita si rilegge tutto.
  const phase = values.phase ?? (target.live ? "prima" : "tutte");
  if (!["prima", "dopo", "tutte"].includes(phase))
    throw new Error("--phase accetta prima, dopo o tutte.");
  const after = phase !== "prima";
  const phases = phase === "tutte" ? ["prima", "dopo"] : [phase];
  const results = checkResources(target, readResources(target), after ? "dopo" : "prima");
  if (after) results.push(...checkSurface(target, await readSurface(target)));
  for (const step of scriptSteps(target).filter((entry) => phases.includes(entry.phase)))
    results.push(runStep(step));
  results.push(
    ...ownerItems
      .filter((entry) => phases.includes(entry.phase))
      .map((entry) => ({ ...entry, ok: null })),
  );
  console.log(report(results));
  const failed = results.filter(({ ok }) => ok === false).length;
  const owner = results.filter(({ ok }) => ok === null).length;
  console.log(`\n${failed} controlli non superati, ${owner} voci da attestare.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
