#!/usr/bin/env node
/** Provenienza, migration e readback. Nessun effetto remoto nei comandi manifest/verify. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { cf as cfCli, cfJson, ghJson, retry } from "../lib/provider.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
// `mode` è la modalità registrata dalla Build Output: test usa quella predefinita di Vite.
const targets = {
  test: {
    worker: "fiscalbay-test",
    origin: "https://test.fiscalbay.it",
    ref: "develop",
    mode: "production",
  },
  production: { worker: "fiscalbay", origin: "https://fiscalbay.it", ref: "main", mode: "live" },
};
const output = ".cloudflare/output";
const readOutput = () => ({
  root: JSON.parse(readFileSync(`${output}/v0/config.json`, "utf8")),
  worker: JSON.parse(readFileSync(`${output}/v0/workers/default/worker.config.json`, "utf8")),
});

export function digestDirectory(directory) {
  const files = [];
  const visit = (relative) => {
    for (const item of readdirSync(path.join(directory, relative), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const name = path.join(relative, item.name);
      if (item.isSymbolicLink()) throw new Error("Link simbolico nell'artefatto.");
      if (item.isDirectory()) visit(name);
      else if (name !== "release-manifest.json")
        files.push([name, hash(readFileSync(path.join(directory, name)))]);
    }
  };
  visit("");
  if (!files.length) throw new Error("Artefatto vuoto.");
  return hash(JSON.stringify(files));
}

/** Migration che toccano schema o dati esistenti: richiedono il digest approvato. */
export function unsafeMigrations(pending) {
  return pending.filter(({ sql }) => {
    // Azioni referenziali e nuove colonne non toccano dati esistenti: restano additive.
    const text = sql
      .replace(/--[^\n]*|\/\*[\s\S]*?\*\//gu, "")
      .replace(/\bON\s+(?:DELETE|UPDATE)\b/giu, "")
      .replace(/\bALTER\s+TABLE\s+\S+\s+ADD\s+(?:COLUMN\s+)?(?!CONSTRAINT\b)/giu, "");
    return /\b(?:DROP|DELETE|UPDATE|INSERT|REPLACE|RENAME|TRIGGER|ALTER)\b/iu.test(text);
  });
}

const migrationDigest = (pending) =>
  hash(JSON.stringify(pending.map(({ name, digest }) => ({ name, digest }))));

/** Digest approvato nel corpo della PR con la riga `reviewed-migrations: <digest>`. */
export function declaredReview(body) {
  return body?.match(/^reviewed-migrations:\s*([0-9a-f]{64})\s*$/imu)?.[1] ?? "";
}

/** Voce di una migration per digest e controllo: nome, hash dei byte e testo. */
export const migrationEntry = (file, bytes) => ({
  name: path.basename(file),
  digest: hash(bytes),
  sql: bytes.toString("utf8"),
});

/** Migration aggiunte fra due commit, lette da Git. */
export function addedMigrations(base, head) {
  return git("diff", "--name-only", "--diff-filter=A", base, head, "--", "migrations")
    .split("\n")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => migrationEntry(file, execFileSync("git", ["show", `${head}:${file}`])));
}

/** Migration non additive fra quelle aggiunte e digest da approvare; `undefined` se mancano. */
export function requiredReview(added) {
  const unsafe = unsafeMigrations(added);
  if (!unsafe.length) return undefined;
  return { names: unsafe.map(({ name }) => name), digest: migrationDigest(added) };
}

/**
 * Le migration non additive aggiunte da una PR si approvano prima del merge: il digest
 * coincide con quello del deploy test quando il test distribuisce già la base della PR.
 */
export function reviewAdded(added, body) {
  const required = requiredReview(added);
  if (!required) return "";
  if (declaredReview(body) !== required.digest)
    throw new Error(
      `Migration da approvare prima del merge: ${required.names.join(", ")}. ` +
        `Dopo l'esame aggiungere al corpo della PR la riga "reviewed-migrations: ${required.digest}".`,
    );
  return required.digest;
}

export function migrationPlan(migrations, applied, reviewed = "", approved) {
  if (applied.some((name) => !migrations.some((migration) => migration.name === name)))
    throw new Error("Schema remoto contiene migration assenti dal candidato.");
  const pending = migrations.filter(({ name }) => !applied.includes(name));
  const digest = migrationDigest(pending);
  const unsafe = unsafeMigrations(pending);
  const resumed =
    approved &&
    reviewed === approved.digest &&
    hash(JSON.stringify(approved.pending)) === approved.digest &&
    approved.pending.every((entry) =>
      migrations.some((item) => item.name === entry.name && item.digest === entry.digest),
    ) &&
    pending.every((entry) =>
      approved.pending.some((item) => item.name === entry.name && item.digest === entry.digest),
    );
  if (unsafe.length && reviewed !== digest && !resumed)
    throw new Error(
      `Migration da approvare: ${unsafe.map(({ name }) => name).join(", ")}. Digest ${digest}`,
    );
  return { pending, digest, rollbackCompatible: pending.length === 0 };
}

/** Release candidate in cima al changelog; `undefined` se la prima versione non è una RC. */
export function candidateVersion(changelog) {
  const version = topVersion(changelog);
  return /^2\.\d+\.\d+-rc\.\d+$/u.test(version ?? "") ? version : undefined;
}

const parseVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/u.exec(version ?? "");
  return match && { core: match.slice(1, 4).map(Number), rc: match[4] && Number(match[4]) };
};
const coreOf = ({ core }) => core.join(".");
const compareCores = (left, right) =>
  left.core[0] - right.core[0] || left.core[1] - right.core[1] || left.core[2] - right.core[2];

/** Versioni ammesse dopo l'ultima pubblicata: patch, minor o major, sempre di un solo passo. */
export function nextVersions(released) {
  if (!released) return ["2.0.0"];
  const [major, minor, patch] = parseVersion(released).core;
  return [`${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`, `${major + 1}.0.0`];
}

/** Prima versione in cima al changelog: la versione in preparazione o l'ultima pubblicata. */
export const topVersion = (changelog) => changelog.match(/^## \[?([^\]\s]+)\]?/mu)?.[1];

/** Giorno di calendario in Italia (AAAA-MM-GG): il giorno della pubblicazione di una versione. */
export const romeDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);

/** Intestazione della prima versione: `## [2.0.1]` in preparazione, `## [2.0.1] - AAAA-MM-GG` pubblicata. */
export function topSection(changelog) {
  const match = /^## \[?([^\]\s]+)\]?(?: - (\S+))?[ \t]*$/mu.exec(changelog);
  return match && { header: match[0], version: match[1], day: match[2] };
}

/**
 * Changelog della promozione: la versione in cima riceve il giorno della pubblicazione, che
 * pagina Novità e campanella mostrano in Production.
 */
export function datedChangelog(changelog, version, day) {
  const top = topSection(changelog);
  if (top?.version !== version)
    throw new Error(
      `In cima al changelog c'è la ${top?.version ?? "nessuna versione"}, non la ${version}.`,
    );
  if (top.day !== undefined) throw new Error(`La ${version} porta già il giorno ${top.day}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) throw new Error(`Giorno non valido: ${day}.`);
  return changelog.replace(top.header, `## [${version}] - ${day}`);
}

/** Branch della promozione di una versione: `develop` con il solo giorno nel changelog. */
export const promotionBranch = (version) => `promuovi/${version}`;

/**
 * Le PR verso `main` partono da `develop` oppure da `promuovi/<versione>`, che differisce da
 * `develop` soltanto per il giorno della versione in cima al changelog.
 */
export function assertPromotionSource({ headRef, files, develop, head }) {
  if (headRef === "develop") return;
  const version = /^promuovi\/(\d+\.\d+\.\d+)$/u.exec(headRef)?.[1];
  if (!version)
    throw new Error(
      `Le PR verso main partono da develop o da promuovi/<versione>, non da ${headRef}.`,
    );
  const day = topSection(head ?? "")?.day;
  if (files.join("\n") !== "CHANGELOG.md" || !day || datedChangelog(develop, version, day) !== head)
    throw new Error(
      `${headRef} deve differire da develop soltanto per il giorno della ${version}.`,
    );
}

const releasedTags = () => git("tag", "--list", "v2.*").split("\n");

const latestReleased = (releasedTags) =>
  releasedTags
    .map((tag) => tag.replace(/^v/u, ""))
    .map(parseVersion)
    .filter((version) => version && !version.rc && version.core[0] >= 2)
    .map(coreOf)
    .sort((left, right) => compareCores(parseVersion(left), parseVersion(right)))
    .at(-1);

/**
 * Il lotto su `develop` porta una sola versione: la prima PR con una modifica visibile apre in
 * cima al changelog la versione successiva all'ultima pubblicata, di un solo passo; le seguenti la
 * riusano o ne alzano il livello. Una RC già aperta prosegue soltanto con la successiva o con la
 * propria versione finale.
 */
export function assertVersionStep(changelog, baseChangelog, releasedTags = []) {
  const head = topVersion(changelog);
  const base = topVersion(baseChangelog);
  if (head === base) return;
  const released = latestReleased(releasedTags);
  const next = parseVersion(head);
  if (!next) throw new Error(`In cima al changelog serve una versione, non "${head ?? ""}".`);
  const previous = parseVersion(base);
  const open = previous && coreOf(previous) !== released ? previous : undefined;
  if (open?.rc && coreOf(open) === coreOf(next)) {
    if (next.rc && next.rc !== open.rc + 1)
      throw new Error(`La ${head} non segue la ${base}: la RC sale di uno.`);
    return;
  }
  if (next.rc) throw new Error(`La ${head} apre una RC: le versioni si preparano senza RC.`);
  if (!nextVersions(released).includes(coreOf(next)))
    throw new Error(
      `La ${head} non è un passo dalla ${released ?? "prima pubblicazione"}: ammesse ${nextVersions(released).join(", ")}.`,
    );
  if (open && compareCores(next, open) < 0)
    throw new Error(`La versione del lotto scende da ${base} a ${head}.`);
}

/**
 * Etichetta della versione del Worker. Fino alla prima versione 2.x pubblicata resta il prefisso
 * del commit; dopo, in Production è la versione pubblicata e sul test la versione in cima al
 * changelog con `-dev.` e il tree distribuito.
 */
export function deployTag({ changelog, environment, sha, tree, releasedTags, expected }) {
  if (!latestReleased(releasedTags)) return sha.slice(0, 12);
  const version = topVersion(changelog);
  const parsed = parseVersion(version);
  if (!parsed) throw new Error("Nessuna versione in cima al changelog.");
  if (environment !== "production") return `${version}-dev.${tree.slice(0, 12)}`;
  if (parsed.rc || expected !== version)
    throw new Error(`In Production si distribuisce la versione ${expected}, non la ${version}.`);
  if (!topSection(changelog).day)
    throw new Error(`La ${version} non ha il giorno: la promozione lo scrive nel changelog.`);
  return version;
}

/**
 * Con una RC in cima al changelog `develop` accetta soltanto correzioni: il titolo della PR, che
 * diventa il commit integrato, non può annunciare una funzione o una modifica incompatibile. Una
 * correzione che cambia ciò che si distribuisce porta la RC successiva rispetto alla base.
 */
export function assertFreeze(changelog, title, { baseChangelog, deploy = false } = {}) {
  const version = candidateVersion(changelog);
  if (version && /^(?:feat\b|[a-z]+(?:\([a-z0-9._-]+\))?!:)/u.test(title.trim()))
    throw new Error(
      `Release candidate ${version} congelata: su develop entrano soltanto correzioni, non "${title.trim()}".`,
    );
  const base = baseChangelog === undefined ? undefined : candidateVersion(baseChangelog);
  if (deploy && base && version === base)
    throw new Error(
      `La PR cambia ciò che si distribuisce: aggiungere in cima a CHANGELOG.md la RC successiva alla ${base}.`,
    );
  return version;
}

/** Collaudo remoto completo del test sullo stesso commit: smoke e pagine dopo il deploy. */
export function assertTestEvidence(report, sha) {
  if (
    report.status !== "passed" ||
    report.partial ||
    report.dirty !== false ||
    report.sha !== sha ||
    report.environment !== "test" ||
    report.baseURL !== targets.test.origin ||
    !(report.counts?.passed > 0)
  )
    throw new Error("Collaudo remoto test incompleto o di un altro candidato.");
}

export function assertResume(receipt, manifest) {
  if (
    receipt &&
    (receipt.tree !== manifest.tree ||
      receipt.digest !== manifest.digest ||
      receipt.environment !== manifest.environment)
  )
    throw new Error("Ricevuta di un candidato diverso.");
}

export function assertAppliedMigrations(migrations, previous, applied) {
  for (const name of applied) {
    const current = migrations.find((migration) => migration.name === name);
    const prior = previous.find((migration) => migration.name === name);
    if (!current || !prior || current.digest !== prior.digest)
      throw new Error(`Migration applicata modificata: ${name}.`);
  }
}

/** Identità registrata nel messaggio della versione Cloudflare, entro 100 caratteri. */
export const releaseIdentity = (manifest) => `${manifest.sha}:${manifest.digest.slice(0, 32)}`;

/** Passi riprendibili: la fonte dell'esito remoto viene riletta anche dopo un'interruzione. */
export async function publish(manifest, io, receipt = {}) {
  assertResume(Object.keys(receipt).length ? receipt : null, manifest);
  const state = {
    ...receipt,
    sha: manifest.sha,
    tree: manifest.tree,
    digest: manifest.digest,
    environment: manifest.environment,
  };
  await io.assertCurrent();
  await io.preflight();
  state.readback = false;
  delete state.rolledBack;
  const migrations = await io.migrations();
  const current = await io.current();
  const identity = releaseIdentity(manifest);
  if (current.identity?.startsWith(`${manifest.sha}:`) && current.identity !== identity)
    throw new Error(
      "Commit già distribuito con artefatto diverso: recuperare l'artefatto originale.",
    );
  if (migrations.pending.length) {
    await io.assertCurrent();
    state.schemaChanged = true;
    state.rollbackCompatible = false;
    state.migrationPlan ??= {
      digest: migrations.digest,
      pending: migrations.pending.map(({ name, digest }) => ({ name, digest })),
    };
    await io.save(state);
    await io.migrate(migrations);
  }
  state.schema = await io.schema();
  await io.save(state);
  if ((await io.current()).version !== current.version)
    throw new Error("Stato remoto cambiato durante il preflight: deploy rifiutato.");
  let deployError;
  if (current.identity !== identity) {
    await io.assertCurrent();
    state.previous = current.version;
    state.rollbackCompatible =
      migrations.rollbackCompatible && !state.schemaChanged && (await io.canRollback(current));
    state.deployAttempted = true;
    state.deployed = false;
    await io.save(state);
    try {
      await io.deploy(identity);
    } catch (error) {
      deployError = error;
    }
  }
  const deployed = await io.current();
  if (deployed.identity !== identity)
    throw new Error("Versione distribuita diversa dall'artefatto atteso.");
  state.version = deployed.version;
  state.deployed = true;
  await io.save(state);
  if (deployError) throw deployError;
  await io.readback(deployed.version);
  state.readback = true;
  await io.save(state);
  return state;
}

function manifests(environment) {
  if (git("status", "--porcelain"))
    throw new Error("Sorgenti non salvati nel commit: provenienza non attestabile.");
  const { root, worker } = readOutput();
  const target = targets[environment];
  if (
    !target ||
    worker.name !== target.worker ||
    worker.env.APP_ORIGIN?.value !== target.origin ||
    root.buildContext?.mode !== target.mode
  )
    throw new Error("Build o configurazione dell'ambiente errata.");
  const migrations = readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, digest: hash(readFileSync(`migrations/${name}`)) }));
  return {
    sha: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
    digest: digestDirectory(output),
    environment,
    config: hash(readFileSync("cloudflare.config.ts")),
    lockfile: hash(readFileSync("pnpm-lock.yaml")),
    migrations,
    node: process.version,
    packageManager: JSON.parse(readFileSync("package.json", "utf8")).packageManager,
  };
}

function verify(environment) {
  const saved = JSON.parse(readFileSync(`${output}/release-manifest.json`, "utf8"));
  const current = manifests(environment);
  for (const key of [
    "tree",
    "digest",
    "environment",
    "config",
    "lockfile",
    "node",
    "packageManager",
  ])
    if (saved[key] !== current[key]) throw new Error(`Provenienza non valida: ${key}.`);
  if (JSON.stringify(saved.migrations) !== JSON.stringify(current.migrations))
    throw new Error("Migration diverse da quelle verificate.");
  // Un merge può cambiare SHA conservando esattamente lo stesso tree verificato.
  return { ...saved, sha: current.sha };
}

/**
 * Dopo un deploy l'edge può servire ancora la versione precedente per qualche secondo:
 * il readback riprova entro una finestra limitata e fallisce con l'ultimo errore.
 */
export const retryReadback = (check, attempts = 12, delayMs = 5000) =>
  retry(check, { attempts, delay: () => delayMs });

export function productionReadiness(plan, requireCompleted = true) {
  const sections = plan.split(/^### Gate per la pubblicazione Production\s*$/mu);
  const section = sections.length === 2 ? sections[1].split(/^#{1,3} |^<a id=/mu)[0] : "";
  const rows = section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .split("|")
        .map((cell) => cell.trim()),
    );
  for (const gate of ["commerciale", "ripristino", "operativita"]) {
    const matches = rows.filter((row) => row[1] === gate);
    if (
      matches.length !== 1 ||
      matches[0].length !== 5 ||
      matches[0][4] !== "" ||
      !["COMPLETATO", "DA COMPLETARE"].includes(matches[0][2]) ||
      (requireCompleted && matches[0][2] !== "COMPLETATO") ||
      (matches[0][2] === "COMPLETATO" && (!matches[0][3] || matches[0][3] === "-"))
    )
      throw new Error("Checkpoint Production non chiusi nel Master Plan.");
  }
}

export function receiptArtifact(artifacts, prefix, runId, attempt) {
  const start = `${prefix}-${runId}-`;
  return artifacts
    .filter((artifact) => {
      const suffix = artifact.name.startsWith(start) ? artifact.name.slice(start.length) : "";
      return !artifact.expired && /^\d+$/u.test(suffix) && Number(suffix) < attempt;
    })
    .sort((a, b) => Number(b.name.slice(start.length)) - Number(a.name.slice(start.length)))[0];
}

export function readReceipt(directory, manifest) {
  const file = path.join(directory, "reports/release.json");
  if (!existsSync(file)) return null;
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  assertResume(receipt, manifest);
  return receipt;
}

/** Via Production: interruttore del workflow e approvazione dell'owner sullo stesso commit. */
export function assertProductionApproval(manifest, expectedSha, env) {
  if (
    env.PRODUCTION_PUBLISH_ENABLED !== "true" ||
    env.OWNER_APPROVED_SHA !== manifest.sha ||
    expectedSha !== manifest.sha
  )
    throw new Error("Manca il via Production sul commit atteso.");
}

/** Vero al primo tentativo della run: non c'è una ricevuta precedente da ripristinare. */
export function firstAttempt(runId, attempt, prefix) {
  if (!/^\d+$/u.test(runId ?? "") || !["deployed", "release-receipt"].includes(prefix))
    throw new Error("Run o ricevuta non identificata.");
  return attempt <= 1;
}

/** Vero se la ricevuta richiede il ritorno alla versione precedente; errore se non è sicuro. */
export function rollbackRequired(receipt) {
  if (!receipt.deployed || !receipt.previous) return false;
  if (!receipt.rollbackCompatible)
    throw new Error(
      receipt.schemaChanged
        ? "Rollback automatico escluso: schema modificato, serve forward-fix o compatibilità qualificata."
        : "Rollback automatico escluso: versione precedente senza provenienza attestata o con migration e configurazione diverse.",
    );
  return true;
}

/** La conferma vale soltanto per il candidato ancora in testa e ancora distribuito. */
export function assertConfirmable(manifest, receipt, remote, current) {
  if (
    remote !== manifest.sha ||
    !receipt.readback ||
    receipt.rolledBack ||
    current.version !== receipt.version ||
    current.identity !== releaseIdentity(manifest)
  )
    throw new Error("Distribuzione o candidato cambiato: release rifiutata.");
}

/** Righe per `GITHUB_OUTPUT` e riepilogo del passo dopo un deploy riuscito. */
export function deployReport(state) {
  return {
    output: `deployed=true\nversion=${state.version}\nrollback-compatible=${state.rollbackCompatible === true}\nprevious=${state.previous || ""}\n`,
    summary: `\n### Distribuzione e readback\n\nCommit ${state.sha}; tree ${state.tree}; SHA256 ${state.digest}; versione ${state.version}; schema ${state.schema.length} migration. Collaudo browser nel passo successivo.\n`,
  };
}

function reviewMigrations(base) {
  if (!/^[0-9a-f]{40}$/u.test(base ?? "")) throw new Error("Base della PR richiesta.");
  const added = addedMigrations(base, "HEAD");
  const digest = reviewAdded(added, process.env.PR_BODY);
  console.log(
    digest
      ? `Migration non additive approvate nella PR: ${digest}.`
      : "Nessuna migration non additiva aggiunta.",
  );
}

const readPlan = () => readFileSync("docs/MASTER_PLAN.md", "utf8");

function writeManifest(environment) {
  writeFileSync(`${output}/release-manifest.json`, JSON.stringify(manifests(environment), null, 2));
}

/** Ricevuta del tentativo precedente della stessa run, per riprendere un deploy interrotto. */
function restoreReceipt(manifest, prefix) {
  const runId = process.env.GITHUB_RUN_ID;
  const attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  if (firstAttempt(runId, attempt, prefix)) return;
  const pages = ghJson(
    "api",
    "--paginate",
    "--slurp",
    `repos/${process.env.GH_REPO}/actions/runs/${runId}/artifacts?per_page=100`,
  );
  const artifact = receiptArtifact(
    pages.flatMap((page) => page.artifacts),
    prefix,
    runId,
    attempt,
  );
  if (!artifact) return;
  const directory = mkdtempSync(path.join(tmpdir(), "release-receipt-"));
  try {
    execFileSync(
      "gh",
      [
        "run",
        "download",
        runId,
        "--repo",
        process.env.GH_REPO,
        "--name",
        artifact.name,
        "--dir",
        directory,
      ],
      { stdio: "inherit" },
    );
    const receipt = readReceipt(directory, manifest);
    if (!receipt) return;
    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/release.json", JSON.stringify(receipt, null, 2));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Accesso al Worker e al D1 dell'ambiente con `cf` e l'API REST Cloudflare. */
function provider(target) {
  const cf = (...args) => cfCli(args, { ci: true });
  const json = (...args) => cfJson(args, { ci: true });
  const { worker: config } = readOutput();
  const database = config.env.DB;
  // Il primo deployment dell'elenco è quello che serve il traffico.
  const activeDeployment = () =>
    json("workers", "deployments", "list", "--worker", target.worker, "--per-page", "1")
      .deployments[0];
  const currentVersion = async () => {
    const version = activeDeployment()?.versions.find(
      ({ percentage }) => percentage === 100,
    )?.version_id;
    if (!version) throw new Error("Deployment non interamente assegnato a una versione.");
    const metadata = json("workers", "versions", "get", version, "--worker-id", target.worker);
    return { version, identity: metadata.annotations?.["workers/message"] };
  };
  const liveReadback = (version) =>
    retryReadback(async () => {
      for (const pathname of ["/", "/en", "/api/auth/get-session"]) {
        const response = await fetch(`${target.origin}${pathname}`, {
          headers: { "cache-control": "no-cache" },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok || response.headers.get("x-fiscalbay-version") !== version)
          throw new Error(`Readback della versione non riuscito: ${pathname}.`);
        if (pathname === "/api/auth/get-session" && (await response.json()) !== null)
          throw new Error("Risposta anonima Auth non valida.");
      }
    });
  const query = async (sql, params = []) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${database.id}/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.success || body.result.some(({ success }) => !success))
      throw new Error("Readback D1 non riuscito.");
    return body.result[0].results;
  };
  const applied = async () => {
    const tables = await query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'",
    );
    return tables.length
      ? (await query("SELECT name FROM d1_migrations ORDER BY id")).map(({ name }) => name)
      : [];
  };
  return { cf, json, config, database, activeDeployment, currentVersion, liveReadback, applied };
}

const receiptFile = "reports/release.json";
const remoteHead = (target) =>
  git("ls-remote", "origin", `refs/heads/${target.ref}`).split(/\s/u)[0];

async function confirmRelease(manifest, environment, target, remote, receipt) {
  assertResume(receipt, manifest);
  // Sul test la conferma chiude il job di deploy: richiede anche il collaudo remoto completo.
  // Production lo verifica in `release-notes.mjs`, prima del tag.
  if (environment === "test")
    for (const name of ["test-smoke", "test-pages"]) {
      const evidence = `test-results/browser/${name}.json`;
      if (!existsSync(evidence)) throw new Error(`Collaudo remoto non disponibile: ${name}.`);
      assertTestEvidence(JSON.parse(readFileSync(evidence, "utf8")), manifest.sha);
    }
  const head = remoteHead(target);
  const current = await remote.currentVersion();
  assertConfirmable(manifest, receipt, head, current);
  await remote.liveReadback(current.version);
}

async function rollbackRelease(manifest, target, remote, receipt) {
  assertResume(Object.keys(receipt).length ? receipt : null, manifest);
  if (!rollbackRequired(receipt)) return;
  const current = remote.activeDeployment();
  if (current?.versions.length !== 1 || current.versions[0].version_id !== receipt.version)
    throw new Error("Stato remoto cambiato: rollback rifiutato.");
  remote.cf(
    "workers",
    "deployments",
    "create",
    "--worker",
    target.worker,
    "--body",
    JSON.stringify({
      strategy: "percentage",
      versions: [{ version_id: receipt.previous, percentage: 100 }],
      annotations: { "workers/message": "Collaudo non superato" },
    }),
  );
  const after = remote.activeDeployment();
  if (after?.versions[0]?.version_id !== receipt.previous || after.versions[0].percentage !== 100)
    throw new Error("Rollback non confermato.");
  await remote.liveReadback(receipt.previous);
  writeFileSync(receiptFile, JSON.stringify({ ...receipt, rolledBack: true }, null, 2));
}

async function deployRelease(manifest, target, remote, receipt, reviewed) {
  const { cf, json, config, database, currentVersion, liveReadback, applied } = remote;
  const state = await publish(
    manifest,
    {
      assertCurrent: async () => {
        if (remoteHead(target) !== manifest.sha)
          throw new Error("Candidato superato: il branch remoto è avanzato.");
      },
      preflight: async () => {
        if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
          throw new Error("Accesso provider non configurato.");
        const bindings = json("workers", "secrets", "list", "--worker", target.worker);
        const required = Object.keys(config.env).filter(
          (name) => config.env[name].type === "secret",
        );
        if (required.some((name) => !bindings.some((binding) => binding.name === name)))
          throw new Error("Segreti runtime richiesti assenti.");
      },
      migrations: async () => {
        const names = await applied();
        const previousSha = (await currentVersion()).identity?.split(":")[0];
        if (/^[0-9a-f]{40}$/u.test(previousSha ?? "") && previousSha !== manifest.sha) {
          const previous = names.map((name) => ({
            name,
            digest: hash(execFileSync("git", ["show", `${previousSha}:migrations/${name}`])),
          }));
          assertAppliedMigrations(manifest.migrations, previous, names);
        }
        return migrationPlan(
          manifest.migrations.map((entry) => ({
            ...entry,
            sql: readFileSync(`migrations/${entry.name}`, "utf8"),
          })),
          names,
          // L'approvazione esplicita del dispatch prevale su quella della PR integrata.
          reviewed || declaredReview(process.env.PR_BODY),
          receipt.migrationPlan,
        );
      },
      migrate: async () => {
        cf("d1", "migrations", "apply", database.id, "--dir", "migrations");
      },
      schema: async () => {
        const names = await applied();
        if (manifest.migrations.some(({ name }) => !names.includes(name)))
          throw new Error("Migration non applicate.");
        // D1 espone i nomi applicati, non l'hash SQL: non attribuire al remoto i digest locali.
        return names.map((name) => ({ name }));
      },
      current: currentVersion,
      deploy: async (identity) => {
        // Nessuna risorsa creata al deploy: binding e code devono già esistere.
        cf(
          "deploy",
          "--prebuilt",
          "--mode",
          target.mode,
          "--no-provision",
          "--tag",
          deployTag({
            changelog: readFileSync("CHANGELOG.md", "utf8"),
            environment: target === targets.production ? "production" : "test",
            sha: manifest.sha,
            tree: manifest.tree,
            releasedTags: releasedTags(),
            expected: process.env.VERSION,
          }),
          "--message",
          identity,
        );
      },
      canRollback: async (current) => {
        const previousSha = current.identity?.split(":")[0];
        if (!/^[0-9a-f]{40}$/u.test(previousSha ?? "")) return false;
        try {
          git(
            "diff",
            "--exit-code",
            previousSha,
            manifest.sha,
            "--",
            "migrations",
            "cloudflare.config.ts",
          );
          return true;
        } catch {
          return false;
        }
      },
      readback: liveReadback,
      save: async (state) => {
        mkdirSync("reports", { recursive: true });
        writeFileSync(receiptFile, JSON.stringify(state, null, 2));
      },
    },
    receipt,
  );
  const report = deployReport(state);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, report.output);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      environment: { type: "string", default: "test" },
      "reviewed-migrations": { type: "string", default: "" },
      "expected-sha": { type: "string" },
      "receipt-prefix": { type: "string" },
      base: { type: "string" },
    },
  });
  const environment = values.environment;
  const target = targets[environment];
  if (!target) throw new Error("Ambiente non supportato.");
  const command = positionals[0];
  if (command === "review") return reviewMigrations(values.base);
  if (command === "freeze") {
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    const baseChangelog = values.base
      ? execFileSync("git", ["show", `${values.base}:CHANGELOG.md`], { encoding: "utf8" })
      : undefined;
    const version = assertFreeze(changelog, process.env.PR_TITLE ?? "", {
      baseChangelog,
      deploy: process.env.DEPLOY === "true",
    });
    if (baseChangelog !== undefined) assertVersionStep(changelog, baseChangelog, releasedTags());
    console.log(version ? `Correzione ammessa nella ${version}.` : "Nessuna RC congelata.");
    return;
  }
  if (command === "readiness") return productionReadiness(readPlan());
  if (command === "manifest") return writeManifest(environment);
  // Ogni altro comando, anche sconosciuto, parte dalla provenienza verificata dell'artefatto.
  const manifest = verify(environment);
  if (command === "restore") return restoreReceipt(manifest, values["receipt-prefix"]);
  if (command === "verify") {
    console.log("Provenienza dell'artefatto confermata.");
    return;
  }
  if (!["deploy", "rollback", "confirm"].includes(command))
    throw new Error("Comando non supportato.");
  if (environment === "production") {
    assertProductionApproval(manifest, values["expected-sha"], process.env);
    productionReadiness(readPlan());
  }
  const remote = provider(target);
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : {};
  if (command === "confirm") return confirmRelease(manifest, environment, target, remote, receipt);
  if (command === "rollback") return rollbackRelease(manifest, target, remote, receipt);
  await deployRelease(manifest, target, remote, receipt, values["reviewed-migrations"]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
