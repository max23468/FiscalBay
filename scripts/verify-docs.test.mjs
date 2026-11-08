import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

describe("integrità dei documenti", () => {
  it("esclude repository e worktree annidati dalla scansione", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "docs-nested-")));
    try {
      writeFileSync(path.join(directory, "README.md"), "# Piano\n");
      for (const name of ["repository", "worktree"]) {
        const nested = path.join(directory, ".claude", "worktrees", name);
        mkdirSync(nested, { recursive: true });
        if (name === "repository") mkdirSync(path.join(nested, ".git"));
        else writeFileSync(path.join(nested, ".git"), "gitdir: /tmp/example.invalid\n");
        writeFileSync(path.join(nested, "README.md"), "[Assente](mancante.md)\n");
      }
      const result = spawnSync(
        process.execPath,
        ["scripts/verify-docs.mjs", "--root", directory, "--json"],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(JSON.parse(result.stdout).stats.markdown_files, 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("verifica link, tabelle e decisioni senza un tracker separato", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "docs-")));
    const check = (text) => {
      writeFileSync(path.join(directory, "README.md"), text);
      const result = spawnSync(
        process.execPath,
        ["scripts/verify-docs.mjs", "--root", directory, "--json"],
        { encoding: "utf8" },
      );
      return { status: result.status, ...JSON.parse(result.stdout) };
    };
    try {
      assert.equal(check("# Piano\n\n[Sezione](#piano)\n").status, 0);
      for (const [text, code] of [
        ["[Assente](mancante.md)", "LINK_MISSING"],
        ["[Assente](#mancante)", "LINK_ANCHOR"],
        ['<a id="stato"></a>\n<a id="stato"></a>', "ANCHOR_DUPLICATE"],
        ["| Uno | Due |\n| Uno |\n", "TABLE"],
        ["| D999 | Scelta |\n| D999 | Duplicata |\n", "DECISION_DUPLICATE"],
        ["Riferimento a D999.", "DECISION_REFERENCE"],
      ]) {
        const result = check(text);
        assert.equal(result.status, 1);
        assert.ok(result.errors.some((error) => error.code === code));
      }
      mkdirSync(path.join(directory, "docs/archive"), { recursive: true });
      // Una decisione superata e archiviata resta citabile da quella che la supera.
      writeFileSync(
        path.join(directory, "docs/archive/superseded-decisions.md"),
        "| D998 | Superata | [Assente](mancante.md) |\n",
      );
      assert.equal(check("Supera D998.").status, 0);
      const roadmapFile = path.join(directory, "docs/ROADMAP.md");
      const pending = "# Roadmap\n";
      writeFileSync(roadmapFile, pending);
      assert.equal(check("# Roadmap\n").status, 0);
      const code = "2.1-01";
      const task = (status, words) =>
        `\n\n#### ${code} · Prova\n\n**Stato:** ${status}\n\n${"parola ".repeat(words)}\n`;
      writeFileSync(roadmapFile, pending + task("Completato", 100) + task("Da completare", 400));
      assert.equal(check("# Roadmap\n").status, 0);
      writeFileSync(roadmapFile, pending + task("Completato", 400));
      const long = check("# Roadmap\n");
      assert.equal(long.status, 1);
      assert.ok(long.errors.some((error) => error.code === "TASK_LENGTH"));
      writeFileSync(roadmapFile, pending);
      // La sigla si compone: verify:repo la rifiuta anche nei test.
      const milestone = "M" + "9-02";
      const leaked = check(`Riferimento a ${milestone}.\n`);
      assert.equal(leaked.status, 1);
      assert.ok(leaked.errors.some((error) => error.code === "MILESTONE_CODE"));
      mkdirSync(path.join(directory, "docs/decisions"));
      writeFileSync(
        path.join(directory, "docs/decisions/DECISION_REGISTER.md"),
        `Provenienza: ${milestone}.\n`,
      );
      assert.equal(check("# Roadmap\n").status, 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
