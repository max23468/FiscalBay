/**
 * Mutation incrementale del candidato. Sulla prova di `develop` un modulo critico non si ripete
 * se la sua ultima mutation, in una qualifica o in una campagna precedente su un commit antenato,
 * è riuscita in ogni parte e da allora nessun sorgente che importa, anche indirettamente, è
 * cambiato. Un pacchetto di `dependencies` aggiunto, tolto o cambiato, anche fra quelli da cui
 * dipende, conta come sorgente modificato nei file che lo importano. Un cambio degli strumenti
 * (`devDependencies`, impostazioni e override di pnpm, configurazione della mutation) fa
 * ripetere tutto; le prove modificate non contano, come nella scelta dei moduli dopo un
 * rilascio, e la campagna settimanale resta completa.
 * Con `--identical`, in `Promuovi` su `main`, un modulo si riusa soltanto dall'ultima run riuscita
 * che l'ha provato su contenuti identici: modulo, test che lo coprono, file che tutti questi
 * importano anche indirettamente, testi e changelog compresi, file di preparazione dei test,
 * pacchetti e strumenti. Del changelog non conta il giorno della versione in cima, che la
 * promozione aggiunge (D256).
 * Uso: MATRIX='{"target":[...]}' REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/mutation-reuse.mjs [--identical]
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { consumerTests, criticalModule } from "./mutation.mjs";
import { undatedChangelog } from "./release/release.mjs";
import { importGraph, importPattern } from "./verify-repo.mjs";
import { ghJson, retry } from "./lib/provider.mjs";

/** Workflow le cui mutation valgono come ricevuta. */
const mutationWorkflows = [".github/workflows/publish.yml", ".github/workflows/mutation.yml"];

/**
 * File che cambiano l'esito di ogni mutation: con uno di questi modificato nulla si riusa.
 * Manifest e lockfile seguono `changedPackages`.
 */
export const toolFiles = [
  /^stryker\.config\.json$/u,
  /^vitest(?:\.[\w-]+)?\.config\.ts$/u,
  /^scripts\/mutation(?:-vitest)?\.mjs$/u,
  /^\.github\/actions\//u,
];

/**
 * Con `--identical` contano anche ambiente dei test, scelta dei test che coprono il modulo e job
 * della mutation.
 */
export const identicalToolFiles = [
  ...toolFiles,
  /^tsconfig[\w.-]*\.json$/u,
  /^cloudflare\.config\.ts$/u,
  /^migrations\//u,
  /^scripts\/verify-repo\.mjs$/u,
  /^\.github\/workflows\/(?:mutation|qualify)\.yml$/u,
];

/** File che un modulo, i suoi test o la loro preparazione possono importare, anche come testo. */
const inputScope = /^(?:(?:app|workers|test)\/.+|CHANGELOG\.md)$/u;

/** File di `test/` che le configurazioni di Vitest caricano prima dei test o al posto di un import. */
export function vitestRoots(configs) {
  return [
    ...new Set(
      configs.flatMap((text) =>
        [...text.matchAll(/\.\/(test\/[\w./-]+\.ts)\b/gu)].map(([, file]) => file),
      ),
    ),
  ].sort();
}

/**
 * Ingressi della mutation di un modulo: i test che lo coprono e i file raggiunti dal modulo, da
 * quei test e dai file di preparazione.
 */
export function moduleInputs(target, files, roots) {
  const tests = consumerTests(target, files);
  const graph = importGraph(files, inputScope);
  const closure = new Set();
  const queue = [target, ...tests, ...roots];
  while (queue.length) {
    const file = queue.pop();
    if (closure.has(file)) continue;
    closure.add(file);
    queue.push(...(graph.get(file) ?? []));
  }
  return { tests, closure };
}

/**
 * File cambiati fra due commit, senza il changelog se differisce soltanto per il giorno della
 * versione in cima.
 */
export function contentChanges(changed, changelogs) {
  return changelogs && undatedChangelog(changelogs.before) === undatedChangelog(changelogs.after)
    ? changed.filter((file) => file !== "CHANGELOG.md")
    : changed;
}

/**
 * Vero se la mutation del modulo ha gli stessi ingressi nei due commit: stessi test, stessi file
 * raggiunti e nessuno di questi fra i cambiati, che comprendono chi importa un pacchetto cambiato.
 */
export function identicalInputs(target, before, after, changed, roots) {
  const old = moduleInputs(target, before, roots);
  const current = moduleInputs(target, after, roots);
  return (
    old.tests.join("\n") === current.tests.join("\n") &&
    old.closure.size === current.closure.size &&
    [...current.closure].every((file) => old.closure.has(file) && !changed.has(file))
  );
}

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
 * Pacchetti cambiati fra due versioni di manifest e lockfile: quelli con una voce diversa e
 * quelli che ne dipendono, anche indirettamente. `null` se cambia uno strumento: fuori da
 * `dependencies` nel manifest, impostazioni, override o `devDependencies` del progetto nel
 * lockfile, oppure un pacchetto cambiato fra le `devDependencies`.
 */
export function changedPackages(before, after) {
  const manifest = (text) => {
    const { dependencies, ...rest } = JSON.parse(text);
    return { dependencies, rest: JSON.stringify(rest) };
  };
  const oldManifest = manifest(before.manifest);
  const newManifest = manifest(after.manifest);
  if (oldManifest.rest !== newManifest.rest) return null;
  const oldBlocks = lockBlocks(before.lockfile);
  const newBlocks = lockBlocks(after.lockfile);
  const changed = new Set();
  for (const key of new Set([...oldBlocks.keys(), ...newBlocks.keys()])) {
    if (oldBlocks.get(key) === newBlocks.get(key)) continue;
    const entry = /^\d+\/(?:packages|snapshots)\/(.+)$/u.exec(key)?.[1];
    if (entry) changed.add(packageName(entry));
    // Le dipendenze del progetto cambiano anche le voci dei pacchetti, contate sopra; gli altri
    // importer non entrano nella mutation.
    else if (!/^1\/importers\/(?:\.\/dependencies|(?!\.\/|\.$)[^/]+(?:\/.*)?)$/u.test(key))
      return null;
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
  const tools = (blocks) =>
    [
      ...(blocks.get("1/importers/./devDependencies") ?? "").matchAll(/^ {6}('?[^\s:']+'?):/gmu),
    ].map(([, name]) => packageName(name));
  if ([...tools(oldBlocks), ...tools(newBlocks)].some((name) => changed.has(name))) return null;
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
 * toccati dal diff fino alla testa, oppure `null` se gli strumenti sono cambiati. Conta soltanto
 * l'ultima run che ha provato il modulo: un fallimento recente non si copre con un successo
 * più vecchio. Con `identical` conta l'ultima run che l'ha provato su contenuti identici.
 */
export function reusePlan(targets, runs, affectedSince, { identical = false } = {}) {
  const run = [];
  const reused = [];
  const untouched = (entry, target) => {
    const affected = affectedSince(entry.commit);
    return Boolean(affected) && !affected.has(target);
  };
  for (const target of targets) {
    const last = runs.find(
      (entry) => entry.outcomes.has(target) && (!identical || untouched(entry, target)),
    );
    const affected = last ? affectedSince(last.commit) : null;
    if (last?.outcomes.get(target) === "passed" && affected && !affected.has(target))
      reused.push({ target, run: last.id, commit: last.commit });
    else run.push(target);
  }
  return { run, reused };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

/**
 * Esiti che valgono per il riuso su contenuti identici: in una run annullata un modulo superato
 * non conta, uno fallito resta un fallimento recente. In una run conclusa conta l'esito del
 * modulo, anche se è fallito un altro job.
 */
export function identicalOutcomes(outcomes, conclusion) {
  return conclusion !== "cancelled"
    ? outcomes
    : new Map([...outcomes].filter(([, outcome]) => outcome === "failed"));
}

/** Commit leggibile nel clone: con `--identical` le run non devono precedere il candidato. */
function available(commit, identical) {
  try {
    execFileSync(
      "git",
      identical
        ? ["cat-file", "-e", `${commit}^{commit}`]
        : ["merge-base", "--is-ancestor", commit, "HEAD"],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

/** Run precedenti con gli esiti per modulo, dalla più recente; gli errori dell'API si ripetono. */
async function previousRuns(repository, repositoryId, identical) {
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
      // Su contenuti identici valgono soltanto le run dei branch protetti: un avvio manuale da un
      // altro branch esegue i workflow di quel branch.
      (identical && !["develop", "main"].includes(candidate.head_branch)) ||
      !available(candidate.head_sha, identical)
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
    const outcomes = moduleOutcomes(jobs, candidate.conclusion === "cancelled");
    runs.push({
      id: candidate.id,
      commit: candidate.head_sha,
      outcomes: identical ? identicalOutcomes(outcomes, candidate.conclusion) : outcomes,
    });
  }
  return runs;
}

/** File di `app/`, `workers/`, `test/` e changelog di un commit, letti dal clone. */
function filesAt(commit) {
  const paths = git("ls-tree", "-r", "--name-only", commit)
    .split("\n")
    .filter((file) => inputScope.test(file));
  const output = execFileSync("git", ["cat-file", "--batch"], {
    input: paths.map((file) => `${commit}:${file}\n`).join(""),
    maxBuffer: 256 * 1024 * 1024,
  });
  const files = [];
  let offset = 0;
  for (const file of paths) {
    const header = output.subarray(offset, output.indexOf(10, offset)).toString();
    const size = Number(header.split(" ")[2]);
    const start = offset + header.length + 1;
    files.push({ path: file, text: output.subarray(start, start + size).toString("utf8") });
    offset = start + size + 1;
  }
  return files;
}

async function main() {
  const identical = process.argv.includes("--identical");
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const targets = JSON.parse(process.env.MATRIX ?? '{"target":[]}').target;
  // Senza esiti leggibili la pianificazione fallisce e si ripete: la mutation completa resta
  // alla campagna settimanale, mai un ripiego della prova del candidato.
  const runs = await previousRuns(repository, repositoryId, identical);
  const listed = git("ls-files").split("\n");
  const tracked = listed
    .filter((file) => inputScope.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const sources = tracked.filter(({ path: file }) => /^(?:app|workers)\/.+\.tsx?$/u.test(file));
  const graph = importGraph(sources);
  const tools = identical ? identicalToolFiles : toolFiles;
  const roots = vitestRoots(
    listed
      .filter((file) => /^vitest(?:\.[\w-]+)?\.config\.ts$/u.test(file))
      .map((file) => readFileSync(file, "utf8")),
  );
  const cache = new Map();
  const affectedSince = (commit) => {
    if (!cache.has(commit)) {
      const changed = git("diff", "--name-only", commit, "HEAD").split("\n").filter(Boolean);
      const packages = ["package.json", "pnpm-lock.yaml"].some((file) => changed.includes(file))
        ? changedPackages(
            {
              manifest: git("show", `${commit}:package.json`),
              lockfile: git("show", `${commit}:pnpm-lock.yaml`),
            },
            {
              manifest: readFileSync("package.json", "utf8"),
              lockfile: readFileSync("pnpm-lock.yaml", "utf8"),
            },
          )
        : new Set();
      let affected = null;
      if (packages && !changed.some((file) => tools.some((pattern) => pattern.test(file)))) {
        const importers = packageImporters(identical ? tracked : sources, packages);
        if (!identical) affected = affectedModules([...changed, ...importers], graph);
        else {
          const content = new Set([
            ...contentChanges(
              changed,
              changed.includes("CHANGELOG.md") && {
                before: git("show", `${commit}:CHANGELOG.md`),
                after: readFileSync("CHANGELOG.md", "utf8"),
              },
            ),
            ...importers,
          ]);
          const before = filesAt(commit);
          affected = new Set(
            targets.filter((target) => !identicalInputs(target, before, tracked, content, roots)),
          );
        }
      }
      cache.set(commit, affected);
    }
    return cache.get(commit);
  };
  const { run, reused } = reusePlan(targets, runs, affectedSince, { identical });
  const list = (entries) => entries.map((entry) => `- ${entry}`).join("\n");
  const summary = [
    `Mutation incrementale${identical ? " su contenuti identici" : ""}: ${run.length} moduli da provare, ${reused.length} riusati.`,
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
