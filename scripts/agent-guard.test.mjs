import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guard } from "./agent-guard.mjs";

const bash = (command) => guard({ tool_name: "Bash", tool_input: { command } });
const edit = (file_path, input = {}, applied = () => false) =>
  guard({ tool_name: "Edit", cwd: "/repo", tool_input: { file_path, ...input } }, applied);

describe("hook degli agenti", () => {
  it("ferma i comandi che perdono lavoro altrui o riscrivono la storia", () => {
    for (const command of [
      "git reset --hard origin/develop",
      "git reset -q --hard",
      "git push --force origin branch",
      "git push origin branch -f",
      "git push --force-with-lease",
      "git stash",
      "git stash push -m prova",
      "git clean -fd",
      "git checkout -- .",
      "git restore .",
      "pnpm exec wrangler deploy",
      "wrangler d1 execute fiscalbay --remote --command 'SELECT 1'",
    ])
      assert.ok(bash(command), command);
  });

  it("lascia passare letture, commit e i comandi Wrangler ammessi", () => {
    for (const command of [
      "git status",
      "git stash list",
      "git push -u origin branch",
      "git reset --soft HEAD~1",
      "git restore app/routes/site.tsx",
      "git checkout -b nuovo",
      "pnpm exec wrangler tail fiscalbay-test",
      "wrangler d1 execute fiscalbay --local --command 'SELECT 1'",
      "pnpm exec cf deploy",
    ])
      assert.equal(bash(command), null, command);
  });

  it("protegge le migration già su develop, non quelle nuove del branch", () => {
    const applied = (file) => file === "migrations/0002_better_auth.sql";
    assert.match(edit("/repo/migrations/0002_better_auth.sql", {}, applied), /migration nuova/u);
    assert.equal(edit("/repo/migrations/0099_nuova.sql", {}, applied), null);
    assert.equal(edit("/repo/app/i18n.ts", {}, applied), null);
  });

  it("rifiuta l'em dash in ogni testo scritto, anche nelle modifiche multiple", () => {
    const dash = String.fromCodePoint(0x2014);
    assert.ok(edit("/repo/a.md", { new_string: `uno ${dash} due` }));
    assert.ok(
      guard({
        tool_name: "Write",
        cwd: "/repo",
        tool_input: { file_path: "/repo/b.ts", content: dash },
      }),
    );
    assert.ok(
      guard({
        tool_name: "MultiEdit",
        cwd: "/repo",
        tool_input: {
          file_path: "/repo/c.ts",
          edits: [{ new_string: "ok" }, { new_string: dash }],
        },
      }),
    );
    assert.equal(edit("/repo/a.md", { new_string: "uno, due" }), null);
  });

  it("ignora gli altri strumenti", () => {
    assert.equal(guard({ tool_name: "Read", tool_input: { file_path: "/repo/x" } }), null);
  });
});
