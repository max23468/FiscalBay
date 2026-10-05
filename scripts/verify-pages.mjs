#!/usr/bin/env node
import routes from "../app/routes.ts";
import { pageCases } from "../e2e/page-cases.ts";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export function routePatterns(entries, prefix = "") {
  return entries.flatMap((entry) => {
    const route = `${prefix}/${entry.path ?? ""}`.replace(/\/+$/u, "") || "/";
    return [route, ...routePatterns(entry.children ?? [], route === "/" ? "" : route)];
  });
}

export function missingPages(patterns, cases) {
  const covered = new Set(cases.map(({ pattern }) => pattern));
  return patterns.filter((pattern) => !covered.has(pattern));
}

export function missingSections(sections, cases) {
  const paths = new Set(cases.map(({ path }) => path));
  return sections
    .flatMap((section) =>
      ["", "/en"].map((prefix) => `${prefix}/anteprima/impostazioni/${section}`),
    )
    .filter((path) => !paths.has(path));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const patterns = routePatterns(routes);
  const missing = missingPages(patterns, pageCases);
  if (missing.length) throw new Error(`Route senza collaudo: ${missing.join(", ")}`);
  const obsolete = pageCases.filter(
    ({ pattern }) => pattern !== "*" && !patterns.includes(pattern),
  );
  if (obsolete.length)
    throw new Error(
      `Scenari di route rimosse: ${obsolete.map(({ pattern }) => pattern).join(", ")}`,
    );
  // Node non carica direttamente il modulo runtime con i suoi import TS senza estensioni.
  const declared = readFileSync("app/view-models.ts", "utf8").match(
    /export const settingsSections = \[([\s\S]*?)\] as const/u,
  )?.[1];
  if (!declared)
    throw new Error("Elenco delle sezioni non riconosciuto: copertura non attestabile.");
  const sections = [...declared.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  const missingSettings = missingSections(sections, pageCases);
  if (!sections.length || missingSettings.length)
    throw new Error(`Sezioni senza collaudo: ${missingSettings.join(", ")}`);
  console.log(
    `Pagine: ${routePatterns(routes).length} route, ${pageCases.length} scenari dichiarati.`,
  );
}
