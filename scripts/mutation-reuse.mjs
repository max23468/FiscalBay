/**
 * Mutation incrementale del candidato. Sulla prova di `develop` un modulo critico non si ripete
 * se la sua ultima mutation, in una qualifica o in una campagna precedente su un commit antenato,
 * è riuscita in ogni parte e da allora nessun sorgente che importa, anche indirettamente, è
 * cambiato. Un pacchetto di `dependencies` aggiunto, tolto o cambiato, anche fra quelli da cui
 * dipende, conta come sorgente modificato nei file che lo importano. Strumenti e prove modificate
 * non fanno ripetere nulla: li copre la campagna settimanale, che resta completa.
 * Uso: MATRIX='{"target":[...]}' REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/mutation-reuse.mjs
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criticalModule } from "./mutation.mjs";
import { importGraph, importPattern } from "./verify-repo.mjs";
import { ghJson, retry } from "./lib/provider.mjs";

/** Workflow le cui mutation valgono come ricevuta. */
const mutationWorkflows = [".github/workflows/candidate.yml", ".github/workflows/mutation.yml"];

/** Ultima parte del nome del job: `<modulo> <parte>/<parti>`. */
export function mutationJob(name) {
  const match = /^((?:app|workers)\/\S+) (\d+)\/(\d+)$/u.exec(name.split(" / ").at(-1) ?? "");
  return match ? { target: match[1], part: Number(match[2]), parts: Number(match[3]) } : null;
}

/**
 * Esito della mutation di un modulo in una run: `passed` solo con ogni parte riuscita. In una
 * run annullata, per esempio per avviarne una nuova, un job annullato non ha un esito.
 */
export function moduleOutcomes(jobs, cancelledRun = false) {
  const modules = new Map();
  const interrupted = new Set();
  for (const job of jobs) {
    const parsed = mutationJob(job.name);
    if (!parsed) continue;
    // Un job annullato o saltato prima di partire non ha provato nulla; uno interrotto mentre
    // girava, anche per il limite di tempo, vale come fallito, salvo nella run annullata.
    if (["cancelled", "skipped"].includes(job.conclusion) && !job.steps?.length) continue;
    if (cancelledRun && job.conclusion === "cancelled") {
      interrupted.add(parsed.target);
      continue;
    }
    const entry = modules.get(parsed.target) ?? { parts: parsed.parts, passed: new Set(), ran: 0 };
    entry.ran += 1;
    if (job.conclusion === "success" && entry.parts === parsed.parts) entry.passed.add(parsed.part);
    modules.set(parsed.target, entry);
  }
  return new Map(
    [...modules]
      .filter(([target]) => !interrupted.has(target))
      .map(([target, entry]) => [
        target,
        entry.ran === entry.parts && entry.passed.size === entry.parts ? "passed" : "failed",
      ]),
  );
}

/** Nome del pacchetto di una chiave del lockfile o di un import, senza versione né percorso. */
export function packageName(specifier) {
  const bare = specifier.replace(/^'|'$/gu, "");
  const parts = bare.split("/");
  const name = bare.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const version = name.indexOf("@", 1);
  return version > 0 ? name.slice(0, version) : name;
}

/**
 * Blocchi del lockfile di pnpm: ogni sezione di primo livello e, in `packages` e `snapshots`,
 * ogni voce; in `importers` ogni gruppo di dipendenze di ogni importer. I due documenti del file
 * (dipendenze di configurazione e progetto) si distinguono per posizione.
 */
export function lockBlocks(text) {
  const blocks = new Map();
  let document = -1;
  let section = "";
  let importer = "";
  let key = "";
  for (const line of text.split("\n")) {
    if (line === "---" || document < 0) {
      document += 1;
      section = "";
      if (line === "---") continue;
    }
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const name = line.trim().replace(/:.*$/u, "");
    if (indent === 0) {
      section = name;
      key = `${document}/${section}`;
    } else if (indent === 2 && ["packages", "snapshots"].includes(section))
      key = `${document}/${section}/${line.trim().replace(/:\s*(?:\{\})?$/u, "")}`;
    else if (indent === 2 && section === "importers") {
      importer = name;
      key = `${document}/importers/${importer}`;
    } else if (indent === 4 && section === "importers")
      key = `${document}/importers/${importer}/${name}`;
    blocks.set(key, `${blocks.get(key) ?? ""}${line}\n`);
  }
  return blocks;
}

/** Dipendenze di ogni pacchetto nelle voci `snapshots`, per nome. */
function snapshotDependencies(blocks) {
  const dependencies = new Map();
  for (const [key, text] of blocks) {
    const entry = /^\d+\/snapshots\/(.+)$/u.exec(key)?.[1];
    if (!entry) continue;
    const children = dependencies.get(packageName(entry)) ?? new Set();
    for (const [, child] of text.matchAll(/^ {6}('?[^\s:']+'?):/gmu))
      children.add(packageName(child));
    dependencies.set(packageName(entry), children);
  }
  return dependencies;
}

/**
 * Pacchetti cambiati fra due versioni del lockfile: quelli con una voce diversa e
 * quelli che ne dipendono, anche indirettamente. Contano soltanto per chi li importa.
 */
export function changedPackages(before, after) {
  const oldBlocks = lockBlocks(before.lockfile);
  const newBlocks = lockBlocks(after.lockfile);
  const changed = new Set();
  for (const key of new Set([...oldBlocks.keys(), ...newBlocks.keys()])) {
    if (oldBlocks.get(key) === newBlocks.get(key)) continue;
    const entry = /^\d+\/(?:packages|snapshots)\/(.+)$/u.exec(key)?.[1];
    if (entry) changed.add(packageName(entry));
  }
  const dependencies = snapshotDependencies(new Map([...oldBlocks, ...newBlocks]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, children] of dependencies)
      if (!changed.has(name) && [...children].some((child) => changed.has(child))) {
        changed.add(name);
        grew = true;
      }
  }
  return changed;
}

/** Sorgenti che importano direttamente uno dei pacchetti indicati. */
export function packageImporters(sources, packages) {
  return sources
    .filter(({ text }) =>
      [...text.matchAll(importPattern)].some(([, from, dynamic]) => {
        const specifier = from ?? dynamic;
        return !/^(?:[./~]|[\w-]+:)/u.test(specifier) && packages.has(packageName(specifier));
      }),
    )
    .map(({ path: file }) => file);
}

/** Testi dell'interfaccia e documenti legali: un loro cambio non tocca chi li importa (D244). */
const copyFiles = /^app\/copy\//u;

/**
 * Moduli critici che importano, anche indirettamente, uno dei sorgenti modificati. Un testo
 * cambiato conta soltanto per sé.
 */
export function affectedModules(changed, graph) {
  const sources = changed.filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file));
  const affected = new Set(sources.filter((file) => !copyFiles.test(file)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [file, imports] of graph)
      if (!affected.has(file) && [...imports].some((target) => affected.has(target))) {
        affected.add(file);
        grew = true;
      }
  }
  return new Set([...affected, ...sources].filter(criticalModule));
}

/**
 * Divide i moduli fra da provare e riusati. `runs` sono le run precedenti su commit antenati,
 * dalla più recente, con gli esiti per modulo; `affectedSince(commit)` restituisce i moduli
 * toccati dal diff fino alla testa. Conta soltanto l'ultima run che ha provato il modulo: un fallimento recente non si copre con un successo
 * più vecchio.
 */
export function reusePlan(targets, runs, affectedSince) {
  const run = [];
  const reused = [];
  for (const target of targets) {
    const last = runs.find((entry) => entry.outcomes.has(target));
    if (last?.outcomes.get(target) === "passed" && !affectedSince(last.commit).has(target))
      reused.push({ target, run: last.id, commit: last.commit });
    else run.push(target);
  }
  return { run, reused };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

/** Commit antenato della testa, leggibile nel clone. */
function available(commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Run precedenti con gli esiti per modulo, dalla più recente; gli errori dell'API si ripetono. */
async function previousRuns(repository, repositoryId) {
  const api = (url) =>
    retry(() => ghJson("api", url), { attempts: 6, delay: (attempt) => attempt * 10_000 });
  const runs = [];
  // Per workflow: fra le run di tutto il repository CI e CodeQL spingono fuori le qualifiche.
  const candidates = [];
  for (const workflow of mutationWorkflows)
    candidates.push(
      ...(
        await api(
          `repos/${repository}/actions/workflows/${path.basename(workflow)}/runs?status=completed&exclude_pull_requests=true&per_page=30`,
        )
      ).workflow_runs,
    );
  candidates.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const candidate of candidates) {
    if (
      !mutationWorkflows.includes(candidate.path) ||
      candidate.event === "pull_request" ||
      candidate.repository?.id !== repositoryId ||
      candidate.head_repository?.id !== repositoryId ||
      !available(candidate.head_sha)
    )
      continue;
    // Pagine piccole: con cento job per pagina l'API risponde 502 per alcune run ripetute.
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = await api(
        `repos/${repository}/actions/runs/${candidate.id}/jobs?filter=latest&per_page=30&page=${page}`,
      );
      jobs.push(...batch.jobs);
      if (batch.jobs.length < 30 || jobs.length >= batch.total_count) break;
    }
    runs.push({
      id: candidate.id,
      commit: candidate.head_sha,
      outcomes: moduleOutcomes(jobs, candidate.conclusion === "cancelled"),
    });
  }
  return runs;
}

async function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const targets = JSON.parse(process.env.MATRIX ?? '{"target":[]}').target;
  // Senza esiti leggibili la pianificazione fallisce e si ripete: la mutation completa resta
  // alla campagna settimanale, mai un ripiego della prova del candidato.
  const runs = await previousRuns(repository, repositoryId);
  const sources = git("ls-files")
    .split("\n")
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const graph = importGraph(sources);
  const cache = new Map();
  const affectedSince = (commit) => {
    if (!cache.has(commit)) {
      const changed = git("diff", "--name-only", commit, "HEAD").split("\n").filter(Boolean);
      const packages = ["package.json", "pnpm-lock.yaml"].some((file) => changed.includes(file))
        ? changedPackages(
            {
              lockfile: git("show", `${commit}:pnpm-lock.yaml`),
            },
            {
              lockfile: readFileSync("pnpm-lock.yaml", "utf8"),
            },
          )
        : new Set();
      cache.set(
        commit,
        affectedModules([...changed, ...packageImporters(sources, packages)], graph),
      );
    }
    return cache.get(commit);
  };
  const { run, reused } = reusePlan(targets, runs, affectedSince);
  const list = (entries) => entries.map((entry) => `- ${entry}`).join("\n");
  const summary = [
    `Mutation incrementale: ${run.length} moduli da provare, ${reused.length} riusati.`,
    ...(reused.length
      ? [
          "",
          "Riusati:",
          list(
            reused.map(
              ({ target, run: id, commit }) => `${target}: run ${id} su ${commit.slice(0, 8)}`,
            ),
          ),
        ]
      : []),
    ...(run.length ? ["", "Da provare:", list(run)] : []),
    "",
  ].join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `mutation-matrix=${JSON.stringify({ target: run })}\n`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
