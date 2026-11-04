#!/usr/bin/env node
/**
 * Hook `PreToolUse` degli agenti (`.claude/settings.json`): ferma prima dell'esecuzione le
 * insidie già costate lavoro, con il motivo e la strada giusta. Riceve su stdin l'evento JSON
 * dello strumento; esce con 2 e il messaggio su stderr per bloccarlo, con 0 per lasciarlo passare.
 * Le stesse regole valgono per chi lavora a mano: il gate le ritrova in `verify:repo`, nel
 * classificatore o nel deploy, ma soltanto dopo.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Comandi che perdono lavoro altrui o riscrivono la storia, e quelli fuori dal provider fissato. */
const commandRules = [
  [
    /\bgit\s+reset\s+(?:\S+\s+)*--hard\b/u,
    "git reset --hard perde le modifiche non committate, anche di altre sessioni.",
  ],
  [
    /\bgit\s+push\b[^|;&]*\s(?:--force(?:-with-lease)?|-f)\b/u,
    "Niente riscritture della storia condivisa: un nuovo commit corregge il precedente.",
  ],
  [
    /\bgit\s+stash(?!\s+(?:list|show)\b)/u,
    "git stash sposta le modifiche delle altre sessioni che usano lo stesso checkout.",
  ],
  [/\bgit\s+clean\s+(?:\S+\s+)*-\w*f/u, "git clean -f cancella file nuovi non ancora versionati."],
  [
    /\bgit\s+(?:checkout\s+--|restore)\s+(?:\S+\s+)*\.(?:\s|$)/u,
    "Ripristinare tutto il checkout scarta il lavoro non committato di altre sessioni.",
  ],
  [
    /\bwrangler\s+(?:deploy|versions\s+(?:upload|deploy)|secret\s+put|d1\s+\S+(?:\s+\S+)*\s+--remote)\b/u,
    "Cloudflare si gestisce con `pnpm exec cf` e `cloudflare.config.ts`; Wrangler resta per `tail` e D1 locale (D170).",
  ],
];

const emDash = String.fromCodePoint(0x2014);

/**
 * Esito per l'evento dello strumento: il messaggio che lo blocca, oppure null. `applied` dice se
 * una migration esiste già su `develop`, cioè se il database l'ha registrata.
 */
export function guard(event, applied = () => false) {
  const input = event.tool_input ?? {};
  if (event.tool_name === "Bash") {
    const command = String(input.command ?? "");
    return commandRules.find(([pattern]) => pattern.test(command))?.[1] ?? null;
  }
  if (!["Edit", "MultiEdit", "Write", "NotebookEdit"].includes(event.tool_name)) return null;
  const file = String(input.file_path ?? input.notebook_path ?? "");
  const relative = path.relative(event.cwd ?? process.cwd(), file);
  if (/^migrations\/.+\.sql$/u.test(relative) && applied(relative))
    return `${relative} è già su develop: una migration applicata non si modifica, nemmeno in un commento, perché il deploy confronta il testo registrato. Scrivi una migration nuova.`;
  const written = [
    input.content,
    input.new_string,
    input.new_source,
    ...(input.edits ?? []).map((edit) => edit.new_string),
  ].filter((text) => typeof text === "string");
  if (written.some((text) => text.includes(emDash)))
    return "Em dash (U+2014) non ammesso in nessun file della repository: usa una virgola, i due punti o una frase nuova.";
  return null;
}

/** La migration esiste nel `develop` remoto conosciuto dal checkout. */
function onDevelop(file, cwd) {
  try {
    execFileSync("git", ["cat-file", "-e", `origin/develop:${file}`], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const event = JSON.parse(readFileSync(0, "utf8") || "{}");
  const cwd = event.cwd ?? process.cwd();
  const reason = guard(event, (file) => onDevelop(file, cwd));
  if (reason) {
    console.error(reason);
    process.exitCode = 2;
  }
}
