#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  return section.slice(section.indexOf("\n") + 1).trim();
}

async function main() {
  const version = process.argv[2];
  const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version);
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/release-notes.md", `${notes}\n`);
  if (process.argv[3] !== "--publish") return;
  const sha = process.argv[4];
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("Commit non valido.");
  const receipt = JSON.parse(readFileSync("reports/release.json", "utf8"));
  if (receipt.sha !== sha || !receipt.readback || receipt.rolledBack)
    throw new Error("Distribuzione non confermata.");
  const browser = JSON.parse(readFileSync("test-results/browser/summary.json", "utf8"));
  if (browser.status !== "passed" || browser.partial) throw new Error("Collaudo incompleto.");
  // Rilegge provider e branch subito prima del tag, senza ridistribuire una versione confermata.
  execFileSync(
    process.execPath,
    ["scripts/release.mjs", "deploy", "--environment", "production", "--expected-sha", sha],
    { stdio: "inherit" },
  );
  const repo = process.env.GH_REPO;
  const gh = (...args) =>
    execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const tag = `v${version}`;
  const refs = JSON.parse(gh("api", `repos/${repo}/git/matching-refs/tags/${tag}`));
  const existing = refs.find((ref) => ref.ref === `refs/tags/${tag}`);
  if (existing) {
    const target =
      existing.object.type === "tag"
        ? JSON.parse(gh("api", `repos/${repo}/git/tags/${existing.object.sha}`)).object.sha
        : existing.object.sha;
    if (target !== sha) throw new Error("Tag già pubblicato su un altro commit.");
    const releases = JSON.parse(
      gh("api", "--paginate", "--slurp", `repos/${repo}/releases?per_page=100`),
    ).flat();
    if (releases.some((release) => release.tag_name === tag && !release.draft)) return;
  }
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
  const release = JSON.parse(gh("release", "view", tag, "--json", "url,tagName,isDraft"));
  if (release.tagName !== tag || release.isDraft) throw new Error("GitHub Release non confermata.");
  console.log(`Release confermata: ${release.url}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
