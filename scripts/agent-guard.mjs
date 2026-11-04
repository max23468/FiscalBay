#!/usr/bin/env node
/**
 * Hook `PreToolUse` degli agenti (`.claude/settings.json`): ferma prima dell'esecuzione le
 * insidie già costate lavoro, con il motivo e la strada giusta. Riceve su stdin l'evento JSON
 * dello strumento; esce con 2 e il messaggio su stderr per bloccarlo, con 0 per lasciarlo passare.
 * Le stesse regole valgono per chi lavora a mano: il gate le ritrova in `verify:repo`, nel
 * classificatore o nel deploy, ma soltanto dopo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
 * Esito per l'evento dello strumento: il messaggio che lo blocca, oppure null. `root` dà la radice
 * della repository che contiene il file, null fuori da ogni repository: vale anche per un
 * worktree diverso dalla cartella della sessione. `applied` dice se una migration esiste già su
 * `develop` in quella repository, cioè se il database l'ha registrata.
 */
export function guard(event, { root = () => null, applied = () => false } = {}) {
  const input = event.tool_input ?? {};
  if (event.tool_name === "Bash") {
    const command = String(input.command ?? "");
    return commandRules.find(([pattern]) => pattern.test(command))?.[1] ?? null;
  }
  if (!["Edit", "MultiEdit", "Write", "NotebookEdit"].includes(event.tool_name)) return null;
  const file = path.resolve(
    event.cwd ?? process.cwd(),
    String(input.file_path ?? input.notebook_path ?? ""),
  );
  // Memoria, scratchpad e altri file fuori dalla repository seguono le proprie regole.
  const repository = root(file);
  if (!repository) return null;
  const relative = path.relative(repository, file);
  if (/^migrations\/.+\.sql$/u.test(relative) && applied(repository, relative))
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

/** Radice della repository Git che contiene il file, anche se il file non esiste ancora. */
function repositoryRoot(file) {
  let directory = path.dirname(file);
  while (!existsSync(directory) && path.dirname(directory) !== directory)
    directory = path.dirname(directory);
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** La migration esiste nel `develop` remoto conosciuto dalla repository. */
function onDevelop(repository, file) {
  try {
    execFileSync("git", ["cat-file", "-e", `origin/develop:${file}`], {
      cwd: repository,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const event = JSON.parse(readFileSync(0, "utf8") || "{}");
  const reason = guard(event, { root: repositoryRoot, applied: onDevelop });
  if (reason) {
    console.error(reason);
    process.exitCode = 2;
  }
}
