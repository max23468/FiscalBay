#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { gh, ghJson } from "../lib/provider.mjs";

export function releaseNotes(changelog, version) {
  if (!/^2\.\d+\.\d+(?:-(?:alpha|rc)\.\d+)?$/u.test(version))
    throw new Error("Versione di pubblicazione non valida.");
  const sections = changelog.split(/^## /mu).slice(1);
  const section = sections.find(
    (section) =>
      section.split("\n")[0].replaceAll("[", "").replaceAll("]", "").split(/\s/u)[0] === version,
  );
  if (!section || !section.slice(section.indexOf("\n") + 1).trim())
    throw new Error("Versione assente o vuota nel changelog.");
  // Le Novità in inglese servono soltanto all'app: le note restano in italiano.
  return section
    .slice(section.indexOf("\n") + 1)
    .replace(/^### What's new\n[\s\S]*?(?=^### |(?![\s\S]))/mu, "")
    .trim();
}

export function assertBrowserEvidence(browser, sha) {
  if (
    browser.status !== "passed" ||
    browser.partial ||
    !(browser.counts?.passed > 0) ||
    browser.sha !== sha ||
    browser.dirty !== false ||
    browser.baseURL !== "https://fiscalbay.it" ||
    browser.environment !== "production"
  )
    throw new Error("Collaudo incompleto o di un altro candidato/ambiente.");
}

/**
 * Passo del tag nella ripresa: «done» se tag e release pubblicata esistono già sul commit,
 * «create» se manca la release, anche con il tag già creato da un tentativo interrotto. Un tag
 * su un altro commit non si riscrive.
 */
export function releaseStep(tagTarget, releases, tag, sha) {
  if (tagTarget === undefined) return "create";
  if (tagTarget !== sha) throw new Error("Tag già pubblicato su un altro commit.");
  return releases.some((release) => release.tag_name === tag && !release.draft) ? "done" : "create";
}

async function main() {
  const {
    positionals: [version],
    values: { publish: sha },
  } = parseArgs({ allowPositionals: true, options: { publish: { type: "string" } } });
  const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version);
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/release-notes.md", `${notes}\n`);
  if (sha === undefined) return;
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("Commit non valido.");
  const receipt = JSON.parse(readFileSync("reports/release.json", "utf8"));
  if (receipt.sha !== sha || !receipt.readback || receipt.rolledBack)
    throw new Error("Distribuzione non confermata.");
  const browser = JSON.parse(readFileSync("test-results/browser/summary.json", "utf8"));
  assertBrowserEvidence(browser, sha);
  // Rilegge provider e branch subito prima del tag, senza ridistribuire una versione confermata.
  execFileSync(
    process.execPath,
    [
      "scripts/release/release.mjs",
      "confirm",
      "--environment",
      "production",
      "--expected-sha",
      sha,
    ],
    { stdio: "inherit" },
  );
  const repo = process.env.GH_REPO;
  const tag = `v${version}`;
  const refs = ghJson("api", `repos/${repo}/git/matching-refs/tags/${tag}`);
  const existing = refs.find((ref) => ref.ref === `refs/tags/${tag}`);
  const target =
    existing?.object.type === "tag"
      ? ghJson("api", `repos/${repo}/git/tags/${existing.object.sha}`).object.sha
      : existing?.object.sha;
  const releases = existing
    ? ghJson("api", "--paginate", "--slurp", `repos/${repo}/releases?per_page=100`).flat()
    : [];
  if (releaseStep(target, releases, tag, sha) === "done") return;
  gh(
    "release",
    "create",
    tag,
    "--target",
    sha,
    "--title",
    version,
    "--notes-file",
    "reports/release-notes.md",
    ...(version.includes("-") ? ["--prerelease"] : []),
  );
  const release = ghJson("release", "view", tag, "--json", "url,tagName,isDraft");
  if (release.tagName !== tag || release.isDraft) throw new Error("GitHub Release non confermata.");
  console.log(`Release confermata: ${release.url}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
