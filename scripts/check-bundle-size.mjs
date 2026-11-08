#!/usr/bin/env node
/**
 * Budget del JavaScript client per pagina: per ogni route con una pagina somma il gzip
 * dei moduli che il browser carica all'apertura (entry, route e antenati con i loro
 * import statici, letti dal manifest di React Router), più i testi della lingua più
 * pesante, che il browser scarica prima dell'idratazione. Gli altri import dinamici arrivano
 * dopo il primo disegno e restano fuori. La build fallisce se una pagina supera la soglia
 * della sua classe; rivedere i valori solo con una motivazione. Il totale di tutti i
 * file è soltanto informativo: cresce con ogni pagina anche se nessuna diventa più pesante.
 * La build fallisce anche se `_headers` perde la cache permanente degli asset con l'hash.
 * Uso: node scripts/check-bundle-size.mjs [cartella]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

/**
 * Soglie in KiB gzip: sito, documenti legali ed errori; area riservata, accesso e anteprima.
 * Lasciano una ventina di KiB sopra la pagina più pesante: fermano un aumento accidentale, non
 * la crescita ordinaria dei testi (D182).
 */
export const budgetKiB = { public: 170, app: 300 };

// In inglese anteprima e accesso hanno i segmenti tradotti, come gli indirizzi dell'app.
const appPath = /^(?:en\/)?(?:app|admin|anteprima|preview|accesso|sign-in)(?:\/|$)/u;

const jsFiles = (directory) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.m?js$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

/** JavaScript iniziale di ogni pagina, dalla più pesante, e totale di tutti i file. */
export function measure(directory) {
  const files = jsFiles(directory);
  const manifestFile = files.find((file) => /^manifest-[\w-]+\.js$/u.test(path.basename(file)));
  if (!manifestFile)
    throw new Error("Manifest di React Router assente: la build non è stata prodotta.");
  const context = { window: {} };
  runInNewContext(readFileSync(manifestFile, "utf8"), context);
  const { entry, routes } = context.window.__reactRouterManifest;

  const sizes = new Map();
  const gzip = (url) => {
    if (!sizes.has(url)) sizes.set(url, gzipSync(readFileSync(path.join(directory, url))).length);
    return sizes.get(url);
  };
  // Testi di una lingua (`copy-<lingua>`) con i loro import statici, dai nomi dei chunk.
  const assets = new Map(files.map((file) => [path.relative(directory, file), file]));
  const closure = (relative, seen = new Set()) => {
    if (seen.has(relative)) return seen;
    seen.add(relative);
    const source = readFileSync(assets.get(relative), "utf8");
    for (const [, target] of source.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/gu))
      closure(path.join(path.dirname(relative), target), seen);
    return seen;
  };
  const copies = [...assets.keys()]
    .filter((relative) => /^copy-[a-z]{2}-[\w-]+\.js$/u.test(path.basename(relative)))
    .map((relative) => [...closure(relative)].map((file) => `/${file}`));
  const chain = (id) => (id ? [...chain(routes[id].parentId), routes[id]] : []);

  const pages = Object.values(routes)
    // Una layout senza percorso non è una pagina: pesa nelle pagine figlie.
    .filter(
      (route) =>
        route.hasDefaultExport && route.id !== "root" && (route.path !== undefined || route.index),
    )
    .map((route) => {
      const ancestors = chain(route.id);
      const urls = new Set([entry.module, ...entry.imports]);
      for (const { module, imports = [] } of ancestors)
        [module, ...imports].forEach((url) => urls.add(url));
      const fullPath = ancestors
        .map((item) => item.path ?? "")
        .filter(Boolean)
        .join("/");
      const copy = copies.toSorted(
        (a, b) =>
          b.filter((url) => !urls.has(url)).reduce((sum, url) => sum + gzip(url), 0) -
          a.filter((url) => !urls.has(url)).reduce((sum, url) => sum + gzip(url), 0),
      )[0];
      copy?.forEach((url) => urls.add(url));
      const bytes = [...urls].reduce((sum, url) => sum + gzip(url), 0);
      const heaviest = [...urls].toSorted((a, b) => gzip(b) - gzip(a)).slice(0, 5);
      return {
        id: route.id,
        path: `/${fullPath}`,
        kind: appPath.test(fullPath) ? "app" : "public",
        bytes,
        heaviest: heaviest.map((url) => ({ url, bytes: gzip(url) })),
      };
    })
    .toSorted((a, b) => b.bytes - a.bytes);
  const total = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
  return { pages, total, files: files.length };
}

/** Percorsi con l'hash o la versione nel nome: senza cache permanente il browser li riconvalida. */
const immutablePaths = ["/assets/*", "/site/*"];

/** Percorsi della cache permanente che `_headers` non dichiara. */
export function missingCacheRules(directory) {
  const rules = readFileSync(path.join(directory, "_headers"), "utf8").split("\n");
  return immutablePaths.filter((rule) => {
    const line = rules.indexOf(rule);
    return line < 0 || !/max-age=31536000, immutable/u.test(rules[line + 1] ?? "");
  });
}

const kib = (bytes) => (bytes / 1024).toFixed(1);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ?? ".cloudflare/output/v0/workers/default/assets";
  let result;
  let missing;
  try {
    result = measure(directory);
    missing = missingCacheRules(directory);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (missing.length > 0) {
    console.error(`Cache permanente assente in _headers: ${missing.join(", ")}.`);
    process.exit(1);
  }
  const { pages, total, files } = result;
  const over = pages.filter((page) => page.bytes > budgetKiB[page.kind] * 1024);
  for (const kind of ["public", "app"]) {
    const heaviest = pages.find((page) => page.kind === kind);
    if (heaviest)
      console.log(
        `JavaScript iniziale ${kind === "app" ? "area riservata" : "pagine pubbliche"}: ` +
          `${kib(heaviest.bytes)} KiB gzip su ${budgetKiB[kind]} KiB (${heaviest.path}).`,
      );
  }
  console.log(`Totale informativo: ${kib(total)} KiB gzip in ${files} file.`);
  if (over.length > 0) {
    console.error("Budget superato:");
    for (const page of over) {
      console.error(
        `  ${page.path} ${kib(page.bytes)} KiB su ${budgetKiB[page.kind]} KiB. File più pesanti:`,
      );
      for (const { url, bytes } of page.heaviest) console.error(`    ${kib(bytes)} KiB ${url}`);
    }
    process.exit(1);
  }
}
