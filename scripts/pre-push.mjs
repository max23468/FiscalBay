#!/usr/bin/env node
/**
 * Hook pre-push (`.githooks/pre-push`, attivato da `pnpm install` con `core.hooksPath`): formato e
 * lint dei file cambiati rispetto al remoto, poi i tipi del progetto, incrementali. Un push con
 * errori non parte; il resto del gate resta a `pnpm verify:changed` e alla CI.
 *
 * Git passa su stdin una riga per ref: `<ref locale> <sha locale> <ref remoto> <sha remoto>`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const zero = /^0+$/u;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const lines = (text) => text.split("\n").filter(Boolean);

/** File cambiati dai commit spinti; per un branch nuovo, da dove si stacca da `origin/develop`. */
export function changedFiles(input, run = git) {
  const files = new Set();
  for (const line of lines(input)) {
    const [, localSha, , remoteSha] = line.split(" ");
    if (!localSha || zero.test(localSha)) continue;
    const base =
      remoteSha && !zero.test(remoteSha)
        ? remoteSha
        : run("merge-base", "origin/develop", localSha);
    for (const file of lines(run("diff", "--name-only", "--diff-filter=d", base, localSha)))
      files.add(file);
  }
  return [...files].toSorted();
}

const formatted = /\.(?:[cm]?[jt]sx?|json|jsonc|ya?ml|css|html|toml)$/u;
const linted = /\.(?:[cm]?[jt]sx?)$/u;
const typed = /\.(?:[cm]?tsx?)$|^(?:tsconfig.*\.json|package\.json)$/u;

if (process.argv[1]?.endsWith("pre-push.mjs")) {
  const started = Date.now();
  const files = changedFiles(readFileSync(0, "utf8")).filter((file) => existsSync(file));
  const toFormat = files.filter((file) => formatted.test(file));
  const toLint = files.filter((file) => linted.test(file));
  const steps = [
    ...(toFormat.length ? [["oxfmt", ["--check", ...toFormat]]] : []),
    ...(toLint.length ? [["oxlint", toLint]] : []),
    ...(files.some((file) => typed.test(file)) ? [["tsc", ["-b"]]] : []),
  ];
  for (const [tool, args] of steps) {
    const { status } = spawnSync("pnpm", ["-s", "exec", tool, ...args], { stdio: "inherit" });
    if (status !== 0) {
      console.error(`pre-push: ${tool} non è riuscito, push annullato.`);
      process.exit(1);
    }
  }
  console.log(`pre-push: ${files.length} file, ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}
