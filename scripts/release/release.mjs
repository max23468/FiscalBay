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
import { fragmentEntries, headings, withChanges } from "../../app/changelog-fragments.mjs";
import { downloadRecord, observedRelease } from "./records.mjs";

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

const parseVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version ?? "");
  return match && { core: match.slice(1, 4).map(Number) };
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
 * Changelog dopo una pubblicazione: la versione riceve il giorno, ovunque si trovi, perché nel
 * frattempo può esserne stata aperta un'altra. Una versione che ha già il giorno resta com'è.
 */
export function datedChangelog(changelog, version, day) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) throw new Error(`Giorno non valido: ${day}.`);
  const escaped = version.replaceAll(".", "\\.");
  const header = new RegExp(`^## \\[?${escaped}\\]?(?: - \\S+)?[ \\t]*$`, "mu");
  const found = header.exec(changelog)?.[0];
  if (!found) throw new Error(`La ${version} non è nel changelog.`);
  return found.includes(" - ") ? changelog : changelog.replace(found, `## [${version}] - ${day}`);
}

const releasedTags = () => git("tag", "--list", "v2.*").split("\n");

/** Frammento di una PR: voci del changelog e righe del registro delle decisioni. */
export const changeFile = /^changes\/[^/]+\.md$/u;
export const decisionRegister = "docs/decisions/DECISION_REGISTER.md";

/** Frammenti di `changes/` in ordine di nome, nel checkout o in un commit. */
export function changeFiles(ref) {
  const files = ref
    ? git("ls-tree", "--name-only", ref, "changes/").split("\n")
    : existsSync("changes")
      ? readdirSync("changes").map((name) => `changes/${name}`)
      : [];
  return files.filter((file) => changeFile.test(file)).sort();
}

/** Changelog con i frammenti, nel checkout o in un commit: quello che build e note leggono. */
export function fullChangelog(ref) {
  const read = (file) => (ref ? git("show", `${ref}:${file}`) : readFileSync(file, "utf8"));
  return withChanges(read("CHANGELOG.md"), changeFiles(ref).map(read));
}

/** Righe delle decisioni nella parte `## Decisioni` di un frammento. */
export function fragmentDecisions(fragment) {
  const lines = fragment.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Decisioni");
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((line) => /^\| D\d+ \|/u.test(line));
}

/**
 * Registro con le righe dei frammenti dopo l'ultima decisione della tabella. Una decisione già
 * registrata non si ripete: un secondo giorno della stessa versione rilegge frammenti già riuniti.
 */
export function withDecisions(register, rows) {
  if (!rows.length) return register;
  const lines = register.split("\n");
  const last = lines.findLastIndex((line) => /^\| D\d+ \|/u.test(line));
  if (last === -1) throw new Error("Tabella delle decisioni non trovata.");
  const id = (line) => /^\| (D\d+) \|/u.exec(line)?.[1];
  const known = new Set(lines.map(id).filter(Boolean));
  lines.splice(last + 1, 0, ...rows.filter((row) => !known.has(id(row))));
  return lines.join("\n");
}

/** Link relativi di un testo spostato dalla cartella `from` alla cartella `to`. */
export function rebaseLinks(text, from, to) {
  return text.replace(/(\]\()([^\s)#]+)((?:#[^\s)]*)?\))/gu, (match, open, target, rest) =>
    /^[a-z][a-z\d+.-]*:/iu.test(target) || target.startsWith("/")
      ? match
      : `${open}${path.posix.relative(to, path.posix.join(from, target)) || "."}${rest}`,
  );
}

/**
 * Voci di un frammento per gli utenti dell'app, nelle parti «Novità» e «What's new»: soltanto
 * queste chiedono una versione nuova e cambiano ciò che l'app mostra. «Altre modifiche», come i
 * cambi del sito pubblico, della console o interni, viaggiano con la versione già pubblicata.
 * @param {string} fragment
 */
export const userEntries = (fragment) =>
  fragmentEntries(fragment).filter(({ title }) => title === headings.it || title === headings.en);

/**
 * Ciò che la pagina Novità mostra di un changelog: per ogni versione con Novità, intestazione con
 * il giorno e righe delle parti «Novità» e «What's new». Due changelog con la stessa impronta
 * producono la stessa pagina, anche se cambiano le altre parti o versioni senza Novità.
 * @param {string} changelog
 */
export function visibleNews(changelog) {
  /** @type {string[]} */
  const visible = [];
  /** @type {string | null} */
  let header = null;
  let shown = false;
  /** @type {string[]} */
  let own = [];
  const flush = () => {
    if (header && own.some((line) => line.trim())) visible.push(header, ...own);
  };
  for (const line of changelog.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      header = line.trim();
      own = [];
      shown = false;
    } else if (line.startsWith("### ")) {
      const title = line.slice(4).trim();
      shown = title === headings.it || title === headings.en;
      if (shown) own.push(line.trim());
    } else if (shown && line.trim()) own.push(line.trim());
  }
  flush();
  return visible.join("\n");
}

/**
 * Giorno della pubblicazione su `develop`: i frammenti del commit pubblicato entrano nella
 * versione, che riceve il giorno, e le loro decisioni nel registro; poi si eliminano. Frammenti
 * con Novità entrati dopo quel commit restano e aprono la versione di correzione successiva, perché
 * non appartengono a quella pubblicata; quelli con le sole altre modifiche restano senza aprirla.
 * Un lotto senza Novità ripubblica la versione già datata: i suoi frammenti vi si aggiungono.
 */
export function publicationDay({ changelog, register, published, later }, version, day) {
  const dated = datedChangelog(
    withChanges(
      changelog,
      published.map((fragment) => rebaseLinks(fragment, "changes", ".")),
      version,
    ),
    version,
    day,
  );
  const open =
    later.some((fragment) => userEntries(fragment).length) && topSection(dated)?.day
      ? openedChangelog(dated, nextVersions(version)[0])
      : dated;
  return {
    changelog: open,
    register: withDecisions(
      register,
      published
        .flatMap(fragmentDecisions)
        .map((row) => rebaseLinks(row, "changes", "docs/decisions")),
    ),
  };
}

/**
 * Parte di un frammento entrata dopo la pubblicazione: senza le voci e le decisioni già
 * pubblicate; vuota se non resta nessuna voce né decisione.
 */
export function laterPart(current, published) {
  if (current === published) return "";
  const sent = new Set(
    published.split("\n").filter((line) => line.startsWith("- ") || /^\| D\d+ \|/u.test(line)),
  );
  const rest = current
    .split("\n")
    .filter((line) => !sent.has(line))
    .join("\n");
  return fragmentEntries(rest).length || fragmentDecisions(rest).length ? rest : "";
}

/**
 * Le Novità di un frammento appartengono alla versione in preparazione: con la versione in cima
 * già pubblicata la PR apre prima quella successiva. Le sole altre modifiche non la chiedono.
 */
export function assertChangesVersion(changelog, fragments, releasedTags = []) {
  const top = topVersion(changelog);
  if (
    fragments.some((fragment) => userEntries(fragment).length) &&
    (topSection(changelog)?.day || releasedTags.includes(`v${top}`))
  )
    throw new Error(
      `Le Novità di changes/ richiedono una versione in preparazione: in cima c'è la ${top}, già pubblicata.`,
    );
}

/**
 * Il controllo al merge: le voci della PR vanno nella versione in cima a `develop`, oppure in
 * quella che la PR stessa apre sopra, come chiede la prima PR con una modifica visibile dopo una
 * pubblicazione. Con la stessa versione in cima vale `develop`, che può averla pubblicata nel
 * frattempo.
 */
export function assertMergedChangesVersion(developChangelog, headChangelog, fragments, tags) {
  const opened = topVersion(headChangelog) !== topVersion(developChangelog);
  assertChangesVersion(opened ? headChangelog : developChangelog, fragments, tags);
}

/**
 * Versione che il ciclo apre quando unisce la PR alla base: le voci dei frammenti vogliono una
 * versione in preparazione e, se quella in cima è stata pubblicata mentre la PR aspettava, si
 * apre la patch successiva all'ultima pubblicata. Una PR che apre già una versione libera la
 * tiene. Null quando non serve aprirne una.
 */
export function versionToOpen(developChangelog, headChangelog, fragments, releasedTags) {
  try {
    assertMergedChangesVersion(developChangelog, headChangelog, fragments, releasedTags);
    return null;
  } catch {
    return nextVersions(latestReleased(releasedTags))[0];
  }
}

/** Changelog con `version` aperta in cima, sopra la prima versione. */
export function openedChangelog(changelog, version) {
  const at = changelog.search(/^## /mu);
  if (at < 0) throw new Error("Nessuna versione nel changelog.");
  return `${changelog.slice(0, at)}## [${version}]\n\n${changelog.slice(at)}`;
}

/** Versione in cima senza testo propria: le sue voci stanno ancora soltanto nei frammenti. */
const emptyTop = (changelog) => {
  const lines = changelog.split("\n");
  const top = lines.findIndex((line) => line.startsWith("## "));
  const next = lines.findIndex((line, index) => index > top && line.startsWith("## "));
  return lines.slice(top + 1, next === -1 ? undefined : next).every((line) => !line.trim());
};

export const latestReleased = (releasedTags) =>
  releasedTags
    .map((tag) => tag.replace(/^v/u, ""))
    .map(parseVersion)
    .filter((version) => version && version.core[0] >= 2)
    .map(coreOf)
    .sort((left, right) => compareCores(parseVersion(left), parseVersion(right)))
    .at(-1);

/**
 * Il lotto su `develop` porta una sola versione: la prima PR con una Novità apre in cima al
 * changelog la versione successiva all'ultima pubblicata, di un solo passo; le seguenti la riusano
 * o ne alzano il livello. Una PR può richiudere una versione aperta e mai pubblicata, tornando
 * all'ultima pubblicata.
 */
export function assertVersionStep(changelog, baseChangelog, releasedTags = []) {
  const head = topVersion(changelog);
  const base = topVersion(baseChangelog);
  if (head === base) return;
  const released = latestReleased(releasedTags);
  // Una versione promossa e ritirata perde il tag e la sezione, una aperta e ancora vuota si può
  // richiudere: in entrambi i casi torna l'ultima pubblicata.
  if (
    head === released &&
    !releasedTags.includes(`v${base}`) &&
    (topSection(baseChangelog)?.day || emptyTop(baseChangelog))
  )
    return;
  const next = parseVersion(head);
  if (!next) throw new Error(`In cima al changelog serve una versione, non "${head ?? ""}".`);
  const previous = parseVersion(base);
  const open = previous && coreOf(previous) !== released ? previous : undefined;
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
 * changelog con `-dev.` e il tree distribuito. Un deploy Production di sole modifiche interne,
 * con la versione già pubblicata, aggiunge il commit: `2.0.0+<commit>`.
 */
export function deployTag({ changelog, environment, sha, tree, releasedTags, expected, day }) {
  if (!latestReleased(releasedTags)) return sha.slice(0, 12);
  const version = topVersion(changelog);
  const parsed = parseVersion(version);
  if (!parsed) throw new Error("Nessuna versione in cima al changelog.");
  if (environment !== "production") return `${version}-dev.${tree.slice(0, 12)}`;
  if (expected !== version)
    throw new Error(`In Production si distribuisce la versione ${expected}, non la ${version}.`);
  // Un lotto di sole modifiche interne riusa la versione pubblicata; una versione nuova entra
  // nella build con il giorno della pubblicazione.
  if (latestReleased(releasedTags) === version) return `${version}+${sha.slice(0, 12)}`;
  if (!topSection(changelog).day && !day)
    throw new Error(`La ${version} non ha il giorno della pubblicazione.`);
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

/**
 * SQL di una migration applicata secondo la versione attiva. Una migration che quella versione non
 * contiene vale soltanto se, fra la versione e il candidato, il file è stato aggiunto una volta e
 * mai modificato: ogni candidato intermedio, anche ritirato dopo averla applicata, ne aveva gli
 * stessi byte del candidato.
 * @param {(sha: string) => Buffer | undefined} show
 * @param {string[]} changes commit che toccano il file fra la versione attiva e il candidato
 */
export function previousMigration(previousSha, sha, show, changes) {
  const before = show(previousSha);
  if (before !== undefined) return before;
  return changes.length === 1 ? show(sha) : undefined;
}

/** SQL precedente oppure piano salvato prima dell'effetto D1, per una ripresa parziale. */
export function appliedMigrationHistory(applied, readPrevious, receipt) {
  const saved = receipt.schemaChanged && receipt.migrationPlan;
  const approved =
    saved && hash(JSON.stringify(saved.pending)) === saved.digest ? saved.pending : [];
  return applied.map((name) => {
    const bytes = readPrevious(name);
    if (bytes !== undefined) return { name, digest: hash(bytes) };
    const pending = approved.find((entry) => entry.name === name);
    if (!pending) throw new Error(`Migration applicata senza storia o piano di ripresa: ${name}.`);
    return pending;
  });
}

/** Identità registrata nel messaggio della versione Cloudflare, entro 100 caratteri. */
export const releaseIdentity = (manifest) => `${manifest.sha}:${manifest.digest.slice(0, 32)}`;

/** Header che manda una richiesta alla versione caricata, ancora senza traffico. */
export const versionOverride = (worker, version) => `${worker}="${version}"`;

/**
 * Passi riprendibili: la fonte dell'esito remoto viene riletta anche dopo un'interruzione. La
 * versione si carica al 0% del traffico quando la configurazione non cambia: il collaudo la prova
 * sul dominio reale e `activate` la porta al 100%. Con una configurazione diversa, che soltanto
 * un deploy applica a route e cron, il traffico passa subito.
 */
export async function publish(manifest, io, receipt = {}) {
  assertResume(Object.keys(receipt).length ? receipt : null, manifest);
  if (receipt.rolledBack)
    throw new Error("Candidato ritirato: serve una nuova correzione, non una ripresa del deploy.");
  const state = {
    ...receipt,
    sha: manifest.sha,
    tree: manifest.tree,
    digest: manifest.digest,
    environment: manifest.environment,
    requestedAt:
      receipt.requestedAt ?? process.env.RELEASE_REQUESTED_AT ?? new Date().toISOString(),
    startedAt: receipt.startedAt ?? new Date().toISOString(),
    certifiedAt: receipt.certifiedAt ?? process.env.RELEASE_CERTIFIED_AT,
  };
  await io.assertCurrent();
  await io.preflight();
  state.readback = false;
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
    state.previousIdentity = current.identity;
    state.rollbackCompatible =
      migrations.rollbackCompatible && !state.schemaChanged && (await io.canRollback(current));
    state.deployAttempted = true;
    state.activationStartedAt ??= new Date().toISOString();
    state.deployed = false;
    state.staged = await io.canStage(current);
    await io.save(state);
    if (state.staged) {
      state.stagedVersion = await io.stage(identity, current.version);
      await io.save(state);
      return state;
    }
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
  state.activatedAt ??= new Date().toISOString();
  await io.save(state);
  if (deployError) throw deployError;
  await io.readback(deployed.version);
  state.readback = true;
  await io.save(state);
  return state;
}

/** Porta al 100% la versione provata senza traffico, solo se nel frattempo nulla è cambiato. */
export async function activate(manifest, io, receipt) {
  assertResume(receipt, manifest);
  if (receipt.rolledBack) throw new Error("Candidato ritirato: attivazione rifiutata.");
  if (!receipt.staged) return receipt;
  const identity = releaseIdentity(manifest);
  const state = { ...receipt };
  const current = await io.current();
  if (current.identity !== identity) {
    if (current.version !== receipt.previous)
      throw new Error("Stato remoto cambiato: attivazione rifiutata.");
    state.activationAttempted = true;
    state.version = receipt.stagedVersion;
    await io.save(state);
    try {
      await io.activate(receipt.stagedVersion);
    } catch (error) {
      if ((await io.current()).identity !== identity) throw error;
    }
  }
  // L'API del provider può riportare per qualche secondo il deployment precedente: la conferma
  // rilegge entro la stessa finestra del readback prima di dichiarare l'attivazione fallita.
  const active = await (io.confirm ?? retryReadback)(async () => {
    const current = await io.current();
    if (current.identity !== identity) throw new Error("Attivazione non confermata.");
    return current;
  });
  state.version = active.version;
  state.deployed = true;
  state.activatedAt ??= new Date().toISOString();
  await io.save(state);
  await io.readback(active.version);
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

/** Via Production: interruttore del workflow e commit atteso uguale a quello dell'artefatto. */
export function assertProductionApproval(manifest, expectedSha, env) {
  if (env.PRODUCTION_PUBLISH_ENABLED !== "true" || expectedSha !== manifest.sha)
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

/**
 * La conferma vale soltanto per il candidato ancora distribuito. `onBranch` dice se il candidato è
 * ancora quello atteso: in Production la testa di `main`, sul test un commit di `develop`, perché
 * un merge successivo si distribuisce con il proprio deploy.
 */
export function assertConfirmable(manifest, receipt, onBranch, current) {
  if (
    !onBranch ||
    !receipt.readback ||
    receipt.rolledBack ||
    current.version !== receipt.version ||
    current.identity !== releaseIdentity(manifest)
  )
    throw new Error("Distribuzione o candidato cambiato: release rifiutata.");
}

/** Righe per `GITHUB_OUTPUT` e riepilogo del passo dopo un deploy riuscito. */
export function deployReport(state, worker) {
  const version = state.staged ? state.stagedVersion : state.version;
  return {
    output: `deployed=true\nversion=${version}\nrollback-compatible=${state.rollbackCompatible === true}\nprevious=${state.previous || ""}\noverride=${state.staged ? versionOverride(worker, version) : ""}\n`,
    summary: `\n### Distribuzione e readback\n\nCommit ${state.sha}; tree ${state.tree}; SHA256 ${state.digest}; versione ${version}${state.staged ? " al 0% del traffico" : ""}; schema ${state.schema.length} migration. Collaudo browser nel passo successivo.\n`,
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
  // Il rollback d'incidente non ha un artefatto: legge soltanto il Worker.
  const config = existsSync(`${output}/v0/config.json`) ? readOutput().worker : undefined;
  let database = config?.env.DB;
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
  const deployment = (versions, message) =>
    cf(
      "workers",
      "deployments",
      "create",
      "--worker",
      target.worker,
      "--body",
      JSON.stringify({
        strategy: "percentage",
        versions,
        annotations: { "workers/message": message },
      }),
    );
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
    if (!database) {
      const { version } = await currentVersion();
      const metadata = json("workers", "versions", "get", version, "--worker-id", target.worker);
      database = metadata.bindings?.find(({ name }) => name === "DB");
      if (!database?.id && database?.database_id) database.id = database.database_id;
      if (!database?.id) throw new Error("Database del Worker attivo non identificato.");
    }
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
  return {
    cf,
    json,
    config,
    database,
    activeDeployment,
    currentVersion,
    deployment,
    liveReadback,
    applied,
  };
}

const receiptFile = "reports/release.json";
export function saveReceipt(state) {
  mkdirSync("reports", { recursive: true });
  writeFileSync(receiptFile, JSON.stringify(state, null, 2));
}

/** Readback finale condiviso da rollback e coordinatore. Salva anche un ritiro. */
export async function reconcileReceipt(receipt, io, requireCandidate = true) {
  const current = await io.current();
  await io.readback(current.version);
  const schema = await io.schema();
  const active = observedRelease(current, schema);
  const candidateActive = !receipt.rolledBack && current.identity === releaseIdentity(receipt);
  const state = { ...receipt, active, candidateActive, reconciledAt: new Date().toISOString() };
  await io.save(state);
  if (requireCandidate && !candidateActive)
    throw new Error("Il candidato non è attivo: rilascio ritirato o versione diversa.");
  return state;
}

function restoreState(environment, expectedSha) {
  const repository = process.env.GH_REPO;
  const run = process.env.GITHUB_RUN_ID;
  if (!repository || !run) throw new Error("Run non identificata.");
  const artifacts = ghJson(
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/actions/runs/${run}/artifacts?per_page=100`,
  )
    .flatMap((page) => page.artifacts)
    .filter(
      (artifact) =>
        !artifact.expired && /^(?:production-state-|release-receipt-)/u.test(artifact.name),
    )
    .sort((a, b) => b.id - a.id);
  for (const artifact of artifacts) {
    const state = downloadRecord(repository, { ...artifact, workflow_run: { id: run } });
    if (state.environment === environment && state.sha === expectedSha) {
      saveReceipt(state);
      return;
    }
  }
  throw new Error("Ricevuta della pubblicazione non disponibile.");
}
const remoteHead = (target) =>
  git("ls-remote", "origin", `refs/heads/${target.ref}`).split(/\s/u)[0];

/**
 * Vero se il candidato è ancora valido sul branch: in Production soltanto la testa di `main`; sul
 * test anche un antenato della testa di `develop`, che ha un deploy proprio.
 */
function onBranch(target, sha) {
  const head = remoteHead(target);
  if (head === sha) return true;
  if (target !== targets.test) return false;
  try {
    git("fetch", "--quiet", "origin", target.ref);
    git("merge-base", "--is-ancestor", sha, head);
    return true;
  } catch {
    return false;
  }
}

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
  const current = await remote.currentVersion();
  assertConfirmable(manifest, receipt, onBranch(target, manifest.sha), current);
  await remote.liveReadback(current.version);
}

export async function rollbackRelease(manifest, target, remote, receipt, save = saveReceipt) {
  assertResume(Object.keys(receipt).length ? receipt : null, manifest);
  if (!receipt.deployAttempted && !receipt.staged && !receipt.deployed) return;
  // Versione mai arrivata al traffico: esce dal deployment, senza limiti di compatibilità.
  const unused = receipt.staged && !receipt.deployed && !receipt.activationAttempted;
  const current = remote.activeDeployment();
  const expected = unused ? receipt.stagedVersion : receipt.version;
  const restored =
    current?.versions.length === 1 &&
    current.versions[0].version_id === receipt.previous &&
    current.versions[0].percentage === 100;
  const traffic = current?.versions.find(({ version_id }) => version_id === expected)?.percentage;
  if (!restored && !current?.versions.some(({ version_id }) => version_id === expected))
    throw new Error("Stato remoto cambiato: rollback rifiutato.");
  if (
    !restored &&
    !(unused && traffic === 0) &&
    !rollbackRequired({
      ...receipt,
      deployed: traffic > 0 || receipt.activationAttempted || receipt.deployed,
    })
  )
    return;
  if (!restored)
    remote.deployment([{ version_id: receipt.previous, percentage: 100 }], "Collaudo non superato");
  const after = remote.activeDeployment();
  if (after?.versions[0]?.version_id !== receipt.previous || after.versions[0].percentage !== 100)
    throw new Error("Rollback non confermato.");
  await remote.liveReadback(receipt.previous);
  await save({
    ...receipt,
    rolledBack: true,
    rolledBackAt: receipt.rolledBackAt ?? new Date().toISOString(),
    readback: false,
  });
}

/**
 * Versione a cui tornare in un incidente: la prima diversa da quella attiva e interamente assegnata.
 * `compatible` confronta configurazione e migration dei due commit: senza compatibilità serve una
 * correzione in avanti, perché il codice precedente potrebbe non capire lo schema attuale.
 */
export function incidentTarget(deployments, identityOf, compatible) {
  const single = deployments.filter(({ versions }) => versions.length === 1);
  const active = deployments[0]?.versions.find(({ percentage }) => percentage === 100)?.version_id;
  if (!active) throw new Error("Deployment attivo non interamente assegnato a una versione.");
  const previous = single
    .map(({ versions }) => versions[0])
    .find(({ version_id, percentage }) => version_id !== active && percentage === 100)?.version_id;
  if (!previous) throw new Error("Nessuna versione precedente a cui tornare.");
  const [from, to] = [active, previous].map((version) => identityOf(version)?.split(":")[0]);
  if (![from, to].every((sha) => /^[0-9a-f]{40}$/u.test(sha ?? "")) || !compatible(to, from))
    throw new Error("Versione precedente non compatibile: serve una correzione in avanti.");
  return { active, previous };
}

async function incidentRollback(target, remote, expectedSha) {
  const receipt = existsSync(receiptFile)
    ? JSON.parse(readFileSync(receiptFile, "utf8"))
    : undefined;
  const current = await remote.currentVersion();
  if (receipt?.rolledBack && (receipt.active?.version ?? receipt.previous) === current.version) {
    await remote.liveReadback(current.version);
    return;
  }
  if (expectedSha && current.identity?.split(":")[0] !== expectedSha)
    throw new Error("Versione attiva diversa dal candidato: rollback d'incidente rifiutato.");
  const { deployments } = remote.json(
    "workers",
    "deployments",
    "list",
    "--worker",
    target.worker,
    "--per-page",
    "10",
  );
  const { active, previous } = incidentTarget(
    deployments,
    (version) =>
      remote.json("workers", "versions", "get", version, "--worker-id", target.worker)
        .annotations?.["workers/message"],
    (from, to) => {
      try {
        git("diff", "--exit-code", from, to, "--", "migrations", "cloudflare.config.ts");
        return true;
      } catch {
        return false;
      }
    },
  );
  remote.deployment([{ version_id: previous, percentage: 100 }], `Incidente: ritiro di ${active}`);
  await remote.liveReadback(previous);
  const identity = (await remote.currentVersion()).identity;
  const base = receipt ?? {
    environment: target === targets.production ? "production" : "test",
    sha: current.identity?.split(":")[0],
  };
  saveReceipt({
    ...base,
    rolledBack: true,
    readback: false,
    candidateActive: false,
    rolledBackAt: new Date().toISOString(),
    active: observedRelease({ version: previous, identity }, await remote.applied()),
  });
  console.log(`Versione ${previous} attiva al posto di ${active}.`);
}

async function deployRelease(manifest, target, remote, receipt, reviewed) {
  const { cf, json, config, database, currentVersion, deployment, liveReadback, applied } = remote;
  const environment = target === targets.production ? "production" : "test";
  const tag = () =>
    deployTag({
      changelog: readFileSync("CHANGELOG.md", "utf8"),
      environment,
      sha: manifest.sha,
      tree: manifest.tree,
      releasedTags: releasedTags(),
      expected: process.env.VERSION,
      day: process.env.RELEASE_DAY,
    });
  const unchanged = (current, paths) => {
    const previousSha = current.identity?.split(":")[0];
    if (!/^[0-9a-f]{40}$/u.test(previousSha ?? "")) return false;
    try {
      git("diff", "--exit-code", previousSha, manifest.sha, "--", ...paths);
      return true;
    } catch {
      return false;
    }
  };
  const state = await publish(
    manifest,
    {
      assertCurrent: async () => {
        if (!onBranch(target, manifest.sha))
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
          const previous = appliedMigrationHistory(
            names,
            (name) =>
              previousMigration(
                previousSha,
                manifest.sha,
                (sha) => {
                  try {
                    return execFileSync("git", ["show", `${sha}:migrations/${name}`], {
                      stdio: ["ignore", "pipe", "ignore"],
                    });
                  } catch {
                    return undefined;
                  }
                },
                git(
                  "log",
                  "--format=%H",
                  `${previousSha}..${manifest.sha}`,
                  "--",
                  `migrations/${name}`,
                )
                  .split("\n")
                  .filter(Boolean),
              ),
            receipt,
          );
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
          tag(),
          "--message",
          identity,
        );
      },
      canStage: async (current) => unchanged(current, ["cloudflare.config.ts"]),
      stage: async (identity, previous) => {
        const findVersion = () => {
          const listed = json(
            "workers",
            "versions",
            "list",
            "--worker-id",
            target.worker,
            "--per-page",
            "50",
          );
          return (Array.isArray(listed) ? listed : (listed.items ?? [])).find(
            (entry) =>
              (entry.annotations?.["workers/message"] ??
                json("workers", "versions", "get", entry.id, "--worker-id", target.worker)
                  .annotations?.["workers/message"]) === identity,
          )?.id;
        };
        let version = findVersion();
        let uploadError;
        if (!version)
          try {
            cf(
              "workers",
              "versions",
              "create",
              "--prebuilt",
              "--mode",
              target.mode,
              "--tag",
              tag(),
              "--message",
              identity,
            );
          } catch (error) {
            uploadError = error;
          }
        version ??= findVersion();
        if (!version) throw uploadError ?? new Error("Versione caricata non trovata.");
        try {
          deployment(
            [
              { version_id: version, percentage: 0 },
              { version_id: previous, percentage: 100 },
            ],
            identity,
          );
        } catch (error) {
          const versions = remote.activeDeployment()?.versions ?? [];
          if (
            !versions.some((entry) => entry.version_id === version && entry.percentage === 0) ||
            !versions.some((entry) => entry.version_id === previous && entry.percentage === 100)
          )
            throw error;
        }
        return version;
      },
      canRollback: async (current) => unchanged(current, ["migrations", "cloudflare.config.ts"]),
      readback: liveReadback,
      save: async (state) => {
        mkdirSync("reports", { recursive: true });
        writeFileSync(receiptFile, JSON.stringify(state, null, 2));
      },
    },
    receipt,
  );
  const report = deployReport(state, target.worker);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, report.output);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary);
}

/** Conferma che l'override raggiunge la versione caricata: se non vale, Cloudflare lo ignora. */
function stagedReadback(target, version, worker) {
  return retryReadback(async () => {
    const response = await fetch(`${target.origin}/`, {
      headers: {
        "cache-control": "no-cache",
        "cloudflare-workers-version-overrides": versionOverride(worker, version),
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || response.headers.get("x-fiscalbay-version") !== version)
      throw new Error("La versione caricata non risponde all'override.");
  });
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
      version: { type: "string" },
      day: { type: "string" },
      sha: { type: "string" },
    },
  });
  const environment = values.environment;
  const target = targets[environment];
  if (!target) throw new Error("Ambiente non supportato.");
  const command = positionals[0];
  if (command === "review") return reviewMigrations(values.base);
  if (command === "date") {
    if (!/^[0-9a-f]{40}$/u.test(values.sha ?? "")) throw new Error("Commit pubblicato richiesto.");
    // Si riunisce il contenuto pubblicato, non quello attuale: una PR successiva può aver
    // modificato lo stesso frammento, e quelle righe restano al lotto seguente.
    const published = changeFiles(values.sha).map((file) => ({
      file,
      text: git("show", `${values.sha}:${file}`),
    }));
    const read = (file) => readFileSync(file, "utf8");
    const remaining = changeFiles()
      .map((file) => {
        const sent = published.find((entry) => entry.file === file)?.text;
        return { file, text: sent === undefined ? read(file) : laterPart(read(file), sent) };
      })
      .filter(({ text }) => text !== "");
    const day = publicationDay(
      {
        changelog: read("CHANGELOG.md"),
        register: read(decisionRegister),
        published: published.map(({ text }) => text),
        later: remaining.map(({ text }) => text),
      },
      values.version,
      values.day,
    );
    writeFileSync("CHANGELOG.md", day.changelog);
    writeFileSync(decisionRegister, day.register);
    for (const { file } of published) if (existsSync(file)) rmSync(file);
    for (const { file, text } of remaining) writeFileSync(file, text);
    return;
  }
  if (command === "version-step") {
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    const baseChangelog = execFileSync("git", ["show", `${values.base}:CHANGELOG.md`], {
      encoding: "utf8",
    });
    assertVersionStep(changelog, baseChangelog, releasedTags());
    assertChangesVersion(
      changelog,
      changeFiles().map((file) => readFileSync(file, "utf8")),
      releasedTags(),
    );
    console.log(
      topSection(changelog)?.day || releasedTags().includes(`v${topVersion(changelog)}`)
        ? `Nessuna versione nuova: senza Novità il lotto resta sulla ${topVersion(changelog)}.`
        : `Versione in preparazione: ${topVersion(changelog)}.`,
    );
    return;
  }
  // Senza artefatto: il Worker dichiara le versioni, Git la loro compatibilità.
  if (command === "incident-rollback")
    return incidentRollback(target, provider(target), values["expected-sha"]);
  if (command === "restore-state") return restoreState(environment, values["expected-sha"]);
  if (command === "record" || command === "finalize") {
    const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
    if (values["expected-sha"] && receipt.sha !== values["expected-sha"])
      throw new Error("Ricevuta di un altro candidato.");
    const remote = provider(target);
    const state = await reconcileReceipt(
      receipt,
      {
        current: remote.currentVersion,
        readback: remote.liveReadback,
        schema: async () => (await remote.applied()).map((name) => ({ name })),
        save: saveReceipt,
      },
      command === "finalize",
    );
    if (command === "finalize") saveReceipt({ ...state, completedAt: new Date().toISOString() });
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `version=${state.active.version}\n`);
    return;
  }
  if (command === "manifest") return writeManifest(environment);
  // Ogni altro comando, anche sconosciuto, parte dalla provenienza verificata dell'artefatto.
  const manifest = verify(environment);
  if (command === "restore") return restoreReceipt(manifest, values["receipt-prefix"]);
  if (command === "verify") {
    console.log("Provenienza dell'artefatto confermata.");
    return;
  }
  if (!["deploy", "staged-check", "activate", "rollback", "confirm"].includes(command))
    throw new Error("Comando non supportato.");
  if (environment === "production")
    assertProductionApproval(manifest, values["expected-sha"], process.env);
  const remote = provider(target);
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : {};
  if (command === "confirm") return confirmRelease(manifest, environment, target, remote, receipt);
  if (command === "rollback") return rollbackRelease(manifest, target, remote, receipt);
  if (command === "staged-check")
    return receipt.staged
      ? stagedReadback(target, receipt.stagedVersion, target.worker)
      : console.log("Versione già attiva: nessun override da provare.");
  if (command === "activate") {
    await activate(
      manifest,
      {
        current: remote.currentVersion,
        activate: async (version) =>
          remote.deployment([{ version_id: version, percentage: 100 }], releaseIdentity(manifest)),
        readback: remote.liveReadback,
        save: async (state) => writeFileSync(receiptFile, JSON.stringify(state, null, 2)),
      },
      receipt,
    );
    return;
  }
  await deployRelease(manifest, target, remote, receipt, values["reviewed-migrations"]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
