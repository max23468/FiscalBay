#!/usr/bin/env node
/**
 * Riuso delle visite del catalogo nella qualifica del candidato: la matrice completa non si ripete
 * per le aree che le modifiche non toccano, rispetto all'ultima qualifica su un commit antenato
 * che ha visitato tutte le pagine. Quell'artefatto dura sette giorni, quindi almeno una volta alla
 * settimana la matrice gira per intero. Modifiche che non si riconducono a un'area provano tutto.
 * Uso: REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/pages-reuse.mjs
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import {
  areaTags,
  plan,
  moduleAreas,
  sharedModules,
  undeclaredModules,
} from "./classify-changes.mjs";
import { importGraph } from "./verify-repo.mjs";
import { ghJson, git, isAncestor } from "./lib/provider.mjs";

/** Aree riusabili dal piano delle modifiche: tutte tranne quelle toccate, oppure nessuna. */
export function reusableAreas(selected) {
  if (!selected.e2e) return areaTags;
  if (selected.browserGrep === "." || selected.matrix || !selected.areas.length) return [];
  return areaTags.filter((area) => !selected.areas.includes(area));
}

/** Espressione delle visite da saltare. */
export const skippedPages = (areas) =>
  areas.length ? `^(?!.*@remote).*@pages-(?:${areas.join("|")})\\b` : "";

/** Ultimo commit antenato con la qualifica completa delle pagine, dagli artefatti `pages-full`. */
export function lastFullQualification(artifacts, repositoryId, isAncestor, qualified) {
  return artifacts.find(
    ({ expired, workflow_run: run }) =>
      !expired &&
      run?.repository_id === repositoryId &&
      run.head_repository_id === repositoryId &&
      isAncestor(run.head_sha) &&
      qualified(run.id),
  )?.workflow_run.head_sha;
}

/** Dipendenze delle route e dichiarazioni esplicite: ogni esclusione ha file e digest verificabili. */
export function pageCoverage(sources, auxiliary = []) {
  const graph = importGraph(sources);
  // Raw import e glob di Vite non fanno parte del grafo TypeScript. Le Novità sono
  // consumate da questo modulo: si propagano lungo i suoi import, anche transitivi.
  const news = auxiliary.filter(
    ({ path: file }) => file === "CHANGELOG.md" || /^changes\/.+\.md$/u.test(file),
  );
  graph.set(
    "app/whats-new.server.ts",
    new Set([
      ...(graph.get("app/whats-new.server.ts") ?? []),
      ...news.map(({ path: file }) => file),
    ]),
  );
  const unknown = undeclaredModules(sources.map(({ path: file }) => file));
  if (unknown.length) throw new Error(`Moduli senza copertura dichiarata: ${unknown.join(", ")}.`);
  const byPath = new Map([...sources, ...auxiliary].map((source) => [source.path, source.text]));
  const routes = sources
    .filter(({ path: file }) => file.startsWith("app/routes/"))
    .map(({ path: file }) => {
      const selected = plan([file], sources);
      return { path: file, areas: selected.browserGrep === "." ? areaTags : selected.areas };
    });
  const dependencies = (file, found = new Set()) => {
    if (found.has(file)) return found;
    found.add(file);
    for (const child of graph.get(file) ?? []) dependencies(child, found);
    return found;
  };
  // La shell monta soltanto queste pagine. Le route di servizio importano anche utility
  // dallo stesso modulo: non per questo rendono le Novità nel sito pubblico.
  const newsAreas = {
    "app/routes/account.tsx": ["orders", "stores", "settings"],
    "app/routes/language.ts": ["orders", "stores", "settings", "profile"],
    "app/routes/export-file.ts": ["orders", "settings"],
    "app/routes/notifications.ts": ["orders", "stores", "settings"],
    "app/routes/page-timing.ts": [],
    "app/routes/password-check.ts": [],
  };
  const globalNews = [...dependencies("app/root.tsx")].includes("app/whats-new.server.ts");
  const areas = Object.fromEntries(
    areaTags.map((area) => {
      const files = new Set(
        auxiliary.filter((entry) => !news.includes(entry)).map(({ path: file }) => file),
      );
      for (const route of routes.filter((entry) => entry.areas.includes(area)))
        for (const file of dependencies(route.path))
          if (
            !news.some(({ path: newsPath }) => newsPath === file) ||
            (newsAreas[route.path] ?? route.areas).includes(area)
          )
            files.add(file);
      if (globalNews) for (const { path: file } of news) files.add(file);
      for (const { path: file } of sources) {
        const declaration = moduleAreas.find(([pattern]) => pattern.test(file));
        if (declaration ? declaration[1].includes(area) : sharedModules.test(file))
          for (const dependency of dependencies(file))
            if (!news.some(({ path: newsPath }) => newsPath === dependency)) files.add(dependency);
      }
      const ordered = [...files].sort();
      const digest = createHash("sha256")
        .update(JSON.stringify(ordered.map((file) => [file, byPath.get(file) ?? null])))
        .digest("hex");
      return [area, { files: ordered, digest }];
    }),
  );
  return { areas, routes };
}

export function coveredAreas(previous, current) {
  return areaTags.filter((area) => previous?.areas?.[area]?.digest === current.areas[area].digest);
}

function currentCoverage() {
  const files = [
    ...new Set(git("ls-files", "--cached", "--others", "--exclude-standard").split("\n")),
  ].filter((file) => file && existsSync(file));
  const sources = files
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const auxiliary = files
    .filter((file) =>
      /^(?:e2e\/|migrations\/|public\/|app\/.+\.(?:css|json|mjs)$|CHANGELOG\.md$|changes\/|\.github\/actions\/|\.github\/workflows\/(?:ci|candidate|qualify)\.yml$|scripts\/(?:browser-tests|pages-reuse|classify-changes|local-preview|local-d1)\.mjs$|(?:cloudflare|vite|playwright)\.config\.ts$|package\.json$|pnpm-(?:lock|workspace)\.yaml$|tsconfig.*\.json$)/u.test(
        file,
      ),
    )
    .map((file) => ({
      path: file,
      text: createHash("sha256").update(readFileSync(file)).digest("hex"),
    }));
  return {
    sha: git("rev-parse", "HEAD").trim(),
    environments: ["test", "production"],
    ...pageCoverage(sources, auxiliary),
  };
}

function main() {
  if (process.argv[2] === "--record") {
    writeFileSync(process.argv[3], JSON.stringify(currentCoverage(), null, 2));
    return;
  }
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const { artifacts } = ghJson(
    "api",
    `repos/${repository}/actions/artifacts?name=pages-full&per_page=30`,
  );
  const qualified = (id) => {
    const run = ghJson("api", `repos/${repository}/actions/runs/${id}`);
    return (
      run.path === ".github/workflows/candidate.yml" &&
      run.head_branch === "develop" &&
      run.conclusion === "success"
    );
  };
  const base = lastFullQualification(artifacts, repositoryId, isAncestor, qualified);
  let skip = "";
  if (base) {
    const artifact = artifacts.find(
      (entry) =>
        entry.workflow_run.head_sha === base && !entry.expired && qualified(entry.workflow_run.id),
    );
    const directory = path.join(process.env.RUNNER_TEMP ?? "/tmp", `page-coverage-${artifact.id}`);
    execFileSync(
      "gh",
      [
        "run",
        "download",
        String(artifact.workflow_run.id),
        "--repo",
        repository,
        "--name",
        "pages-full",
        "--dir",
        directory,
      ],
      { stdio: "inherit" },
    );
    const previous = JSON.parse(readFileSync(path.join(directory, "pages-full.json"), "utf8"));
    if (previous.sha !== base) throw new Error("Copertura delle pagine di un altro commit.");
    if (!previous.environments?.includes("test") || !previous.environments.includes("production"))
      throw new Error("Copertura delle pagine senza entrambi gli ambienti qualificati.");
    skip = skippedPages(coveredAreas(previous, currentCoverage()));
  }
  console.log(
    skip ? `Visite riusate da ${base}: ${skip}.` : "Visite del catalogo: tutte le aree da provare.",
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `skip-pages=${skip}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nVisite del catalogo riusate: ${skip || "nessuna"}.\n`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
