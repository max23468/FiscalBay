import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affectedModules,
  changedPackages,
  moduleOutcomes,
  mutationJob,
  packageImporters,
  reusePlan,
} from "./mutation-reuse.mjs";

/** Lockfile di pnpm con i due documenti, dipendenze del progetto e della pagina provvisoria. */
function lockfile({ dependencies = "", devDependencies = "", extra = "", settings = "" } = {}) {
  return `---
lockfileVersion: '9.0'

importers:

  .:
    configDependencies: {}

---
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true${settings}

importers:

  .:
    dependencies:
      '@scope/auth':
        specifier: 1.0.0
        version: 1.0.0
${dependencies}    devDependencies:
      vitest:
        specifier: 5.0.0
        version: 5.0.0
${devDependencies}
  placeholder:
    devDependencies:
      cf:
        specifier: 1.0.0
        version: 1.0.0

packages:

  '@scope/auth@1.0.0':
    resolution: {integrity: sha512-a}

  vitest@5.0.0:
    resolution: {integrity: sha512-v}
${extra}
snapshots:

  '@scope/auth@1.0.0':
    dependencies:
      zod: 4.0.0

  vitest@5.0.0: {}

  zod@4.0.0: {}
`;
}

const manifest = (dependencies = {}, rest = {}) =>
  JSON.stringify({ dependencies: { "@scope/auth": "1.0.0", ...dependencies }, ...rest });

describe("mutation incrementale della prova del candidato", () => {
  it("riconosce i job di mutation della qualifica e della campagna", () => {
    assert.deepEqual(
      mutationJob("Qualifica candidato / Mutation / app/domain/orders.server.ts 2/3"),
      {
        target: "app/domain/orders.server.ts",
        part: 2,
        parts: 3,
      },
    );
    assert.deepEqual(mutationJob("app/markup.ts 1/1"), {
      target: "app/markup.ts",
      part: 1,
      parts: 1,
    });
    for (const name of ["Qualifica candidato / browser (source, 1)", "Mutation / Select modules"])
      assert.equal(mutationJob(name), null);
  });

  it("considera superato un modulo soltanto con ogni parte riuscita", () => {
    const job = (name, conclusion = "success") => ({
      name: `Mutation / ${name}`,
      conclusion,
      steps: [{}],
    });
    const outcomes = moduleOutcomes([
      job("app/a.server.ts 1/2"),
      job("app/a.server.ts 2/2"),
      job("app/b.server.ts 1/2"),
      job("app/b.server.ts 2/2", "failure"),
      job("app/c.server.ts 1/2"),
      job("app/d.server.ts 1/1", "cancelled"),
      job("app/e.server.ts 1/1"),
      job("app/e.server.ts 1/1"),
      { name: "Mutation / app/f.server.ts 1/1", conclusion: "cancelled", steps: [] },
      { name: "Mutation / app/g.server.ts 1/1", conclusion: "cancelled", steps: [{}] },
    ]);
    assert.deepEqual(Object.fromEntries(outcomes), {
      "app/a.server.ts": "passed",
      "app/b.server.ts": "failed",
      "app/c.server.ts": "failed",
      "app/d.server.ts": "failed",
      "app/e.server.ts": "failed",
      "app/g.server.ts": "failed",
    });
  });

  it("in una run annullata ignora i moduli interrotti, non li conta come falliti", () => {
    const job = (name, conclusion = "success") => ({
      name: `Mutation / ${name}`,
      conclusion,
      steps: [{}],
    });
    const jobs = [
      job("app/a.server.ts 1/2"),
      job("app/a.server.ts 2/2", "cancelled"),
      job("app/b.server.ts 1/1"),
      job("app/c.server.ts 1/1", "failure"),
    ];
    assert.deepEqual(Object.fromEntries(moduleOutcomes(jobs, true)), {
      "app/b.server.ts": "passed",
      "app/c.server.ts": "failed",
    });
    assert.equal(moduleOutcomes(jobs).get("app/a.server.ts"), "failed");
  });

  it("un testo cambiato conta per sé, non per chi lo importa", () => {
    const graph = new Map([
      ["app/domain/telegram.server.ts", new Set(["app/copy/copy-it.ts"])],
      ["app/copy/copy-it.ts", new Set()],
    ]);
    assert.deepEqual([...affectedModules(["app/copy/copy-it.ts"], graph)], []);
  });

  it("ripete i moduli critici che importano un sorgente modificato, anche di supporto", () => {
    const graph = new Map([
      ["app/domain/orders.server.ts", new Set(["app/domain/sql.server.ts"])],
      ["app/domain/export-jobs.server.ts", new Set(["app/domain/orders.server.ts"])],
      ["app/domain/billing.server.ts", new Set()],
      ["app/domain/sql.server.ts", new Set()],
    ]);
    assert.deepEqual(
      [...affectedModules(["app/domain/sql.server.ts", "test/orders.spec.ts", "docs/x.md"], graph)],
      ["app/domain/orders.server.ts", "app/domain/export-jobs.server.ts"],
    );
    assert.deepEqual([...affectedModules(["test/orders.spec.ts"], graph)], []);
  });

  it("riusa solo l'ultimo esito riuscito e non toccato, mai con strumenti cambiati", () => {
    const outcomes = (entries) => new Map(Object.entries(entries));
    const runs = [
      { id: 3, commit: "c3", outcomes: outcomes({ "app/a.ts": "failed", "app/b.ts": "passed" }) },
      { id: 2, commit: "c2", outcomes: outcomes({ "app/a.ts": "passed", "app/c.ts": "passed" }) },
      { id: 1, commit: "c1", outcomes: outcomes({ "app/d.ts": "passed", "app/e.ts": "passed" }) },
    ];
    const affected = { c3: new Set(["app/b.ts"]), c2: new Set(), c1: null };
    const plan = reusePlan(
      ["app/a.ts", "app/b.ts", "app/c.ts", "app/d.ts", "app/f.ts"],
      runs,
      (commit) => affected[commit],
    );
    // Fallito di recente, toccato dal diff, strumenti cambiati o mai provato: si ripete.
    assert.deepEqual(plan.run, ["app/a.ts", "app/b.ts", "app/d.ts", "app/f.ts"]);
    assert.deepEqual(plan.reused, [{ target: "app/c.ts", run: 2, commit: "c2" }]);
  });

  it("con un pacchetto cambiato ripete soltanto chi lo importa o dipende da lui", () => {
    const before = { manifest: manifest(), lockfile: lockfile() };
    const added = {
      manifest: manifest({ "@scope/dash": "0.4.0" }),
      lockfile: lockfile({
        dependencies: "      '@scope/dash':\n        specifier: 0.4.0\n        version: 0.4.0\n",
        extra: "\n  '@scope/dash@0.4.0':\n    resolution: {integrity: sha512-d}\n",
      }),
    };
    assert.deepEqual([...changedPackages(before, added)], ["@scope/dash"]);
    // Una dipendenza aggiornata cambia anche il pacchetto che la usa.
    const zod = lockfile().replace("zod: 4.0.0", "zod: 4.1.0").replace("zod@4.0.0", "zod@4.1.0");
    assert.deepEqual([...changedPackages(before, { manifest: manifest(), lockfile: zod })].sort(), [
      "@scope/auth",
      "zod",
    ]);
    // La pagina provvisoria non entra nella mutation.
    const placeholder = lockfile().replace(
      "cf:\n        specifier: 1.0.0",
      "cf:\n        specifier: 1.1.0",
    );
    assert.deepEqual(
      [...changedPackages(before, { manifest: manifest(), lockfile: placeholder })],
      [],
    );
  });

  it("con uno strumento cambiato ripete tutto", () => {
    const before = { manifest: manifest(), lockfile: lockfile() };
    for (const after of [
      { manifest: manifest({}, { scripts: { test: "vitest" } }), lockfile: lockfile() },
      {
        manifest: manifest(),
        lockfile: lockfile({ settings: "\n  excludeLinksFromLockfile: false" }),
      },
      {
        manifest: manifest(),
        lockfile: lockfile({
          devDependencies: "      stryker:\n        specifier: 9.0.0\n        version: 9.0.0\n",
        }),
      },
      {
        manifest: manifest(),
        lockfile: lockfile().replace(
          "vitest@5.0.0: {}",
          "vitest@5.0.0:\n    dependencies:\n      zod: 4.0.0",
        ),
      },
    ])
      assert.equal(changedPackages(before, after), null);
  });

  it("riconosce gli import dei pacchetti, anche per percorso, ma non i moduli locali o di piattaforma", () => {
    const sources = [
      { path: "app/auth.server.ts", text: 'import { dash } from "@scope/dash/plugins";' },
      { path: "app/lazy.ts", text: 'const zod = await import("zod");' },
      {
        path: "app/local.ts",
        text: 'import "~/scope/dash";\nimport { env } from "cloudflare:workers";',
      },
      { path: "app/other.ts", text: 'import { auth } from "@scope/auth";' },
    ];
    assert.deepEqual(packageImporters(sources, new Set(["@scope/dash", "zod"])), [
      "app/auth.server.ts",
      "app/lazy.ts",
    ]);
  });
});
