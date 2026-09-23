#!/usr/bin/env node
/**
 * Controlli locali della documentazione. Nessuna dipendenza o richiesta di rete.
 * Non verifica semantica del prodotto, conformità o stato live dei provider.
 * Uso: node scripts/verify-docs.mjs [--assets] [--json] [--root DIRECTORY]
 * Audit e snapshot in docs/archive non partecipano ai controlli ordinari.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let assets = false,
  jsonOutput = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--assets") assets = true;
  else if (args[i] === "--json") jsonOutput = true;
  else if (args[i] === "--root" && args[i + 1] && !args[i + 1].startsWith("--"))
    root = path.resolve(args[++i]);
  else {
    console.error("Uso: node scripts/verify-docs.mjs [--assets] [--json] [--root DIRECTORY]");
    process.exit(2);
  }
}
const errors = [],
  stats = {},
  graph = {};
const error = (code, detail) => errors.push({ code, detail });
const relative = (p) => path.relative(root, p).split(path.sep).join("/");
const inside = (p) => {
  const s = path.relative(root, p);
  return s !== ".." && !s.startsWith(`..${path.sep}`) && !path.isAbsolute(s);
};
const skipped = new Set([".git", "node_modules", "dist", "build", ".cache", ".next", ".wrangler"]);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const p = path.join(dir, item.name);
    if (skipped.has(item.name) || relative(p) === "docs/archive" || item.isSymbolicLink())
      return [];
    return item.isDirectory() ? walk(p) : item.isFile() && p.endsWith(".md") ? [p] : [];
  });
}
function stripFences(text, name) {
  let open = null;
  const result = text
    .split("\n")
    .map((line, i) => {
      const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
      if (match && !open) {
        open = { char: match[1][0], len: match[1].length, line: i + 1 };
        return "";
      }
      if (
        open &&
        match &&
        match[1][0] === open.char &&
        match[1].length >= open.len &&
        !match[2].trim()
      ) {
        open = null;
        return "";
      }
      return open ? "" : line;
    })
    .join("\n");
  if (open) error("FENCE", `${name}:${open.line}`);
  return result;
}
function getAnchors(text, name) {
  const found = new Set(),
    seen = new Map();
  for (const m of text.matchAll(/<[a-z][\w-]*\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)) {
    if (found.has(m[1])) error("ANCHOR_DUPLICATE", `${name}#${m[1]}`);
    found.add(m[1]);
  }
  for (const m of text.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?$/gm)) {
    const slug = m[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    found.add(n ? `${slug}-${n}` : slug);
  }
  return found;
}
function columns(line) {
  return line
    .replace(/`+[^`]*`+/g, "x")
    .replace(/\\\|/g, "x")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|").length;
}
function duplicateIds(values, code) {
  const seen = new Set();
  for (const id of values) {
    if (seen.has(id)) error(code, id);
    seen.add(id);
  }
  return seen;
}
function main() {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error("Directory root inesistente");
  const files = walk(root),
    documents = new Map(),
    anchors = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (/(?:filecite|cite|genui)|sandbox:\/|\/mnt\/data\/|file_000000/.test(text))
      error("NONPORTABLE", relative(file));
    const plain = stripFences(text, relative(file));
    documents.set(file, plain);
    anchors.set(file, getAnchors(plain, relative(file)));
    let expected = null;
    for (const [i, line] of plain.split("\n").entries()) {
      if (!/^\s*\|/.test(line)) {
        expected = null;
        continue;
      }
      const n = columns(line);
      if (expected !== null && n !== expected)
        error("TABLE", `${relative(file)}:${i + 1}: ${n} colonne, attese ${expected}`);
      expected = n;
    }
  }
  stats.markdown_files = files.length;
  stats.local_links = 0;
  stats.external_links_not_network_checked = 0;
  for (const [file, text] of documents)
    for (const m of text.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^(?:https?:|mailto:)/i.test(target)) {
        stats.external_links_not_network_checked++;
        continue;
      }
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
        error("LINK_SCHEME", `${relative(file)}: ${target}`);
        continue;
      }
      stats.local_links++;
      let filename, fragment;
      try {
        const i = target.indexOf("#");
        filename = decodeURIComponent(i < 0 ? target : target.slice(0, i)).split("?")[0];
        fragment = i < 0 ? "" : decodeURIComponent(target.slice(i + 1));
      } catch {
        error("LINK_ENCODING", `${relative(file)}: ${target}`);
        continue;
      }
      const dest = filename ? path.resolve(path.dirname(file), filename) : file;
      if (path.isAbsolute(filename) || !inside(dest)) {
        error("LINK_NONPORTABLE", `${relative(file)}: ${target}`);
        continue;
      }
      if (!fs.existsSync(dest)) {
        error("LINK_MISSING", `${relative(file)}: ${target}`);
        continue;
      }
      if (!inside(fs.realpathSync(dest))) {
        error("LINK_ESCAPE", `${relative(file)}: ${target}`);
        continue;
      }
      if (fragment && dest.endsWith(".md")) {
        const set =
          anchors.get(dest) ||
          getAnchors(stripFences(fs.readFileSync(dest, "utf8"), relative(dest)), relative(dest));
        if (!set.has(fragment)) error("LINK_ANCHOR", `${relative(file)}: ${target}`);
      }
    }
  const decisionIds = [];
  for (const text of documents.values())
    for (const m of text.matchAll(/^\|\s*(D\d+)\s*\|/gm)) decisionIds.push(m[1]);
  const decisions = duplicateIds(decisionIds, "DECISION_DUPLICATE");
  stats.decisions = decisions.size;
  // Il backlog è l'unico tracker; il numero di task/milestone non è un vincolo.
  const backlogFile = path.join(root, "BACKLOG.md");
  if (!documents.has(backlogFile)) {
    error("BACKLOG_MISSING", "BACKLOG.md");
    return;
  }
  const backlog = documents.get(backlogFile),
    matches = [...backlog.matchAll(/^### (M\d+-\d+) — .+$/gm)];
  const tasks = duplicateIds(
    matches.map((m) => m[1]),
    "TASK_DUPLICATE",
  );
  const milestoneTasks = new Map();
  for (const id of tasks) {
    const ms = id.split("-")[0];
    if (!milestoneTasks.has(ms)) milestoneTasks.set(ms, []);
    milestoneTasks.get(ms).push(id);
  }
  const expand = (expr, owner) => {
    const result = new Set();
    const addMilestone = (ms) => {
      if (!milestoneTasks.has(ms)) error("MILESTONE_UNKNOWN", `${owner}: ${ms}`);
      for (const x of milestoneTasks.get(ms) || []) result.add(x);
    };
    expr = expr
      .replace(/(M\d+)-(\d+)\.\.(M\d+)-(\d+)/g, (_, a, start, b, end) => {
        if (a !== b || +start > +end || +end - +start > 10000) {
          error("TASK_RANGE", owner);
          return "";
        }
        for (let n = +start; n <= +end; n++)
          result.add(`${a}-${String(n).padStart(start.length, "0")}`);
        return "";
      })
      .replace(/M(\d+)\.\.M(\d+)/g, (_, start, end) => {
        if (+start > +end || +end - +start > 1000) {
          error("MILESTONE_RANGE", owner);
          return "";
        }
        for (let n = +start; n <= +end; n++) addMilestone(`M${n}`);
        return "";
      })
      .replace(/\bM\d+-\d+\b/g, (id) => {
        result.add(id);
        return "";
      });
    for (const m of expr.matchAll(/\bM\d+\b/g)) addMilestone(m[0]);
    for (const id of result) if (!tasks.has(id)) error("TASK_UNKNOWN", `${owner}: ${id}`);
    return [...result].filter((id) => tasks.has(id));
  };
  stats.task_states = {};
  for (const [i, match] of matches.entries()) {
    const id = match[1];
    let body = backlog.slice(match.index, matches[i + 1]?.index ?? backlog.length);
    body = body.split(/\n<a id="m\d+">/)[0];
    const meta = body.match(
      /\*\*Stato:\*\* ([A-Z ]+) · \*\*Prerequisiti:\*\* (.+?) · \*\*Contratto:/,
    );
    if (!meta) {
      error("TASK_META", id);
      continue;
    }
    const state = meta[1].trim();
    stats.task_states[state] = (stats.task_states[state] || 0) + 1;
    if (!["TODO", "IN PROGRESS", "BLOCKED", "DONE", "DEFERRED"].includes(state))
      error("TASK_STATE", `${id}: ${state}`);
    if (!/\*\*Criterio di completamento:\*\*\s*\S/.test(body)) error("TASK_DOD", id);
    graph[id] = {
      start: expand(meta[2], id),
      close: expand(body.match(/\*\*Per chiudere:\*\* ([^\n]+)/)?.[1] || "", id),
    };
  }
  const visiting = new Set(),
    visited = new Set();
  function visit(id, chain = []) {
    if (visiting.has(id)) {
      error("TASK_CYCLE", [...chain, id].join(" → "));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of new Set([...(graph[id]?.start || []), ...(graph[id]?.close || [])]))
      visit(dep, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of tasks) visit(id);
  for (const [file, text] of documents) {
    for (const m of text.matchAll(/\bM\d+-\d+\b/g))
      if (!tasks.has(m[0])) error("TASK_REFERENCE", `${relative(file)}: ${m[0]}`);
    for (const m of text.matchAll(/\bD\d{3,}\b/g))
      if (!decisions.has(m[0])) error("DECISION_REFERENCE", `${relative(file)}: ${m[0]}`);
  }
  stats.tasks = tasks.size;
  stats.milestones = milestoneTasks.size;
  stats.start_dependencies = Object.values(graph).reduce((n, x) => n + x.start.length, 0);
  stats.close_dependencies = Object.values(graph).reduce((n, x) => n + x.close.length, 0);
  if (assets) {
    const manifestFile = path.join(root, "docs/brand/references/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (!Array.isArray(manifest)) throw new Error("Manifest immagini non è un array");
    const seen = new Set();
    stats.assets_checked = 0;
    for (const asset of manifest) {
      if (
        typeof asset.file !== "string" ||
        !/^[a-f\d]{64}$/i.test(asset.sha256) ||
        !Number.isSafeInteger(asset.bytes)
      ) {
        error("ASSET_SCHEMA", String(asset.file));
        continue;
      }
      const file = path.resolve(path.dirname(manifestFile), asset.file);
      if (
        !inside(file) ||
        seen.has(file) ||
        !fs.existsSync(file) ||
        !inside(fs.realpathSync(file))
      ) {
        error("ASSET_PATH", asset.file);
        continue;
      }
      seen.add(file);
      const bytes = fs.readFileSync(file);
      stats.assets_checked++;
      if (
        bytes.length !== asset.bytes ||
        crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256
      )
        error("ASSET_HASH", asset.file);
    }
  }
}
try {
  main();
} catch (e) {
  error("READ_OR_PARSE", e.message);
}
const result = { ok: errors.length === 0, stats, errors, dependencies: graph };
if (jsonOutput) console.log(JSON.stringify(result, null, 2));
else {
  console.log(
    result.ok ? "Documentazione: controlli superati." : "Documentazione: errori rilevati.",
  );
  console.log(JSON.stringify(stats));
  for (const e of errors) console.error(`${e.code}: ${e.detail}`);
}
process.exitCode = result.ok ? 0 : 1;
