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
      mkdirSync(path.join(directory, "docs"));
      const planFile = path.join(directory, "docs/MASTER_PLAN.md");
      const pending =
        "### Gate per la pubblicazione Production\n\n" +
        ["commerciale", "ripristino", "operativita"]
          .map((gate) => `| ${gate} | DA COMPLETARE | - |`)
          .join("\n");
      writeFileSync(planFile, pending);
      assert.equal(check("# Piano\n").status, 0);
      const task = (status, words) =>
        `\n\n#### M1-01 · Prova\n\n**Stato:** ${status}\n\n${"parola ".repeat(words)}\n`;
      writeFileSync(planFile, pending + task("Completato", 100) + task("Da completare", 400));
      assert.equal(check("# Piano\n").status, 0);
      writeFileSync(planFile, pending + task("Completato", 400));
      const long = check("# Piano\n");
      assert.equal(long.status, 1);
      assert.ok(long.errors.some((error) => error.code === "TASK_LENGTH"));
      for (const invalid of [
        "",
        pending.replace("commerciale", "assente"),
        pending.replace("DA COMPLETARE", "COMPLETATO"),
        pending + "\n| commerciale | DA COMPLETARE | - |",
      ]) {
        writeFileSync(planFile, invalid);
        const result = check("# Piano\n");
        assert.equal(result.status, 1);
        assert.ok(result.errors.some((error) => error.code === "PRODUCTION_GATES"));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
