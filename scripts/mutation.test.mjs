import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  checkReceipt,
  evaluate,
  identity,
  mutationInputs,
  mutationConcurrency,
  parseTarget,
  verifiedMutationOrigin,
} from "./mutation.mjs";
import { strykerPlugins as mutationPlugins } from "./mutation-vitest.mjs";

describe("esito dei mutation test", () => {
  it("limita i runner alle CPU e alla memoria senza azzerare l'esecuzione", () => {
    const gib = 1024 ** 3;
    assert.equal(mutationConcurrency(4, 8, 8 * gib), 2);
    assert.equal(mutationConcurrency(4, 4, 16 * gib), 4);
    assert.equal(mutationConcurrency(4, 2, 16 * gib), 2);
    assert.equal(mutationConcurrency(4, 8, 2 * gib), 1);
    assert.equal(mutationConcurrency(1, 8, 32 * gib), 1);
  });
  it("usa il fallback nativo per ricaricare i runner e conserva il contratto di injection", () => {
    const plugin = mutationPlugins[0];
    const runner = { capabilities: () => ({ reloadEnvironment: true }), marker: "native" };
    const injector = { provideValue: () => ({ injectClass: () => runner }) };
    assert.equal(plugin.factory(injector), runner);
    assert.deepEqual(runner.capabilities(), { reloadEnvironment: false });
    assert.equal(runner.marker, "native");
    assert.equal(plugin.factory.inject.length, 1);
  });
  it("firma sorgente completo, consumatori, fixture e strumenti senza invalidare per moduli estranei", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: 'import { value } from "./helper"; export const grant = () => value;' },
      { path: "app/domain/helper.ts", text: "export const value = true;" },
      { path: "test/grants.spec.ts", text: 'import { grant } from "../app/domain/grants.server";' },
      { path: "test/setup.ts", text: "fixture" },
      { path: "test/other.spec.ts", text: 'import { other } from "../app/other";' },
      { path: "app/other.ts", text: "export const other = true;" },
      { path: "scripts/mutation.mjs", text: "runner" },
      { path: "pnpm-lock.yaml", text: "dependencies" },
      { path: "migrations/example.sql", text: "CREATE TABLE example (id TEXT);" },
      { path: "docs/MASTER_PLAN.md", text: "stato" },
    ];
    assert.equal(mutationInputs(target, files).mode, "targeted");
    assert.deepEqual(mutationInputs(target, files).tests, ["test/grants.spec.ts"]);
    const base = identity(target, files, "runtime");
    for (const changed of [
      target,
      "app/domain/helper.ts",
      "test/grants.spec.ts",
      "test/setup.ts",
      "scripts/mutation.mjs",
      "pnpm-lock.yaml",
      "migrations/example.sql",
    ]) {
      assert.notEqual(
        identity(
          target,
          files.map((file) =>
            file.path === changed ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
        changed,
      );
    }
    for (const changed of ["app/other.ts", "test/other.spec.ts", "docs/MASTER_PLAN.md"]) {
      assert.equal(
        identity(
          target,
          files.map((file) =>
            file.path === changed ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
        changed,
      );
    }
    const newConsumer = {
      path: "test/another.spec.ts",
      text: 'import { grant } from "../app/domain/grants.server";',
    };
    assert.notEqual(identity(target, [...files, newConsumer], "runtime").key, base.key);
    const indirectConsumer = {
      path: "app/facade.ts",
      text: 'export { grant } from "./domain/grants.server";',
    };
    assert.deepEqual(
      mutationInputs(target, [
        ...files,
        indirectConsumer,
        { path: "test/facade.spec.ts", text: 'import { grant } from "../app/facade";' },
      ]).tests,
      ["test/facade.spec.ts", "test/grants.spec.ts"],
    );
    assert.equal(
      mutationInputs(
        target,
        files.filter((file) => file.path !== "app/domain/helper.ts"),
      ).mode,
      "full",
    );
    for (const text of [
      "const module = await import(name);",
      "const module = require(name);",
      'const modules = import.meta.glob("./*.ts");',
    ])
      assert.equal(
        mutationInputs(target, [...files, { path: "test/dynamic.spec.ts", text }]).mode,
        "full",
      );
  });

  it("conserva alias e mock locali nella firma mutation", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: 'import { value } from "~/helper";' },
      { path: "app/helper.ts", text: "export const value = true;" },
      { path: "test/grants.spec.ts", text: 'vi.mock("../app/domain/grants.server", () => ({}));' },
    ];
    assert.deepEqual(mutationInputs(target, files).tests, ["test/grants.spec.ts"]);
    assert.ok(mutationInputs(target, files).files.some((file) => file.path === "app/helper.ts"));
    assert.equal(
      mutationInputs(target, [
        ...files,
        { path: "test/dynamic.spec.ts", text: "vi.mock(moduleName, () => ({}));" },
      ]).mode,
      "full",
    );
    assert.equal(
      mutationInputs(target, [
        ...files,
        {
          path: "tsconfig.json",
          text: JSON.stringify({ compilerOptions: { paths: { "@/*": ["app/*"] } } }),
        },
      ]).mode,
      "full",
    );
    const types = files.map((file) =>
      file.path === target
        ? {
            ...file,
            text: 'import type { Unknown } from "./+types/grants";\n// import type is unrelated to runtime imports\nimport { value } from "~/helper";',
          }
        : file,
    );
    assert.equal(mutationInputs(target, types).mode, "targeted");
    assert.ok(mutationInputs(target, types).files.some((file) => file.path === "app/helper.ts"));
  });

  it("firma anche le dipendenze transitive del setup e dei file di configurazione", () => {
    const target = "app/domain/grants.server.ts";
    const files = [
      { path: target, text: "export const grant=true;" },
      { path: "test/grants.spec.ts", text: 'import {grant} from "../app/domain/grants.server";' },
      { path: "test/apply-migrations.ts", text: 'import {seed} from "../app/seed";' },
      { path: "app/seed.ts", text: 'export {fixture} from "./fixture";' },
      { path: "app/fixture.ts", text: "export const fixture=true;" },
      {
        path: "vitest.unit.config.ts",
        text: 'import {settings} from "./scripts/test-settings.mjs";',
      },
      { path: "scripts/test-settings.mjs", text: 'import {config} from "../app/config";' },
      { path: "app/config.ts", text: "export const config=true;" },
    ];
    const base = identity(target, files, "runtime");
    for (const path of ["app/seed.ts", "app/fixture.ts", "app/config.ts"]) {
      assert.ok(mutationInputs(target, files).files.some((file) => file.path === path));
      assert.notEqual(
        identity(
          target,
          files.map((file) =>
            file.path === path ? { ...file, text: file.text + " changed" } : file,
          ),
          "runtime",
        ).key,
        base.key,
      );
    }
  });

  it("allinea ID, nomi annidati e filtro del runner a Vitest 5", async () => {
    const runner = import.meta.resolve("@stryker-mutator/vitest-runner");
    const { collectTestName, toRawTestId } = await import(new URL("./test-helpers.js", runner));
    const { convertTestToTestResult, fromTestId } = await import(
      new URL("./vitest-helpers.js", runner)
    );
    const test = {
      name: "somma [2 + 3]",
      suite: { name: "add", suite: { name: "math (numbers)" } },
      file: { filepath: path.resolve("test/runner.spec.ts") },
      mode: "run",
      result: { state: "pass", duration: 1 },
    };
    const name = "math (numbers) > add > somma [2 + 3]";
    const result = convertTestToTestResult(test, " > ");
    assert.equal(collectTestName(test, " > "), name);
    assert.equal(toRawTestId(test, " > "), `${test.file.filepath}#${name}`);
    assert.deepEqual(fromTestId(result.id), { file: "test/runner.spec.ts", test: name });
    assert.equal(result.name, name);
    assert.equal(collectTestName(test), "math (numbers) add somma [2 + 3]");
  });

  const mutant = (status, statusReason) => ({
    mutatorName: "ConditionalExpression",
    status,
    statusReason,
    location: { start: { line: 3, column: 4 } },
  });
  const report = (...mutants) => ({ files: { "app/grants.server.ts": { mutants } } });

  it("accetta mutanti uccisi ed equivalenze motivate", () => {
    assert.deepEqual(
      evaluate(report(mutant("Killed"), mutant("Ignored", "equivalente: ordine irrilevante"))),
      [],
    );
  });

  it("non considera successo sopravvissuti, timeout, errori o esclusioni senza motivo", () => {
    const statuses = ["Survived", "NoCoverage", "Timeout", "RuntimeError", "CompileError"];
    assert.equal(
      evaluate(report(...statuses.map((status) => mutant(status)), mutant("Ignored"))).length,
      6,
    );
    assert.deepEqual(evaluate(report(mutant("Timeout"))), [
      "app/grants.server.ts:3:5: ConditionalExpression Timeout",
    ]);
  });

  it("fallisce se non viene generato alcun mutante, salvo righe cambiate senza codice", () => {
    assert.deepEqual(evaluate({ files: {} }), ["nessun mutante generato"]);
    assert.deepEqual(evaluate({ files: {} }, true), []);
    assert.equal(evaluate(report(mutant("Survived")), true).length, 1);
  });

  it("traduce gli intervalli in voci Stryker senza ricevute del modulo intero", () => {
    assert.deepEqual(parseTarget("app/grants.server.ts"), {
      file: "app/grants.server.ts",
      ranged: false,
      mutate: ["app/grants.server.ts"],
    });
    assert.deepEqual(parseTarget("app/grants.server.ts:3-5,9-9"), {
      file: "app/grants.server.ts",
      ranged: true,
      mutate: ["app/grants.server.ts:3-5", "app/grants.server.ts:9-9"],
    });
  });

  it("riusa il contesto solo quando dipendenze, test, fixture, configurazione e runtime coincidono", () => {
    const target = "app/grants.server.ts";
    const files = [
      { path: target, text: "return true" },
      { path: "app/helper.ts", text: "helper" },
      { path: "test/grants.spec.ts", text: "assertion" },
      { path: "test/setup.ts", text: "fixture" },
      { path: "pnpm-lock.yaml", text: "dependencies" },
      { path: "vitest.config.ts", text: "config" },
      { path: "docs/brand/logo.svg", text: "asset" },
      { path: "docs/MASTER_PLAN.md", text: "stato" },
    ];
    const base = identity(target, files, "node|linux|x64");
    for (const path of [
      "app/helper.ts",
      "test/grants.spec.ts",
      "test/setup.ts",
      "pnpm-lock.yaml",
      "vitest.config.ts",
      "docs/brand/logo.svg",
    ]) {
      const changed = files.map((file) =>
        file.path === path ? { ...file, text: "changed" } : file,
      );
      assert.notEqual(identity(target, changed, "node|linux|x64").prefix, base.prefix);
    }
    assert.notEqual(identity(target, files, "other-runtime").prefix, base.prefix);
    const changedSource = identity(
      target,
      files.map((file) => (file.path === target ? { ...file, text: "return false" } : file)),
      "node|linux|x64",
    );
    assert.notEqual(changedSource.prefix, base.prefix);
    assert.notEqual(changedSource.key, base.key);
    // Il mutante può restare uguale mentre cambia un helper nello stesso file.
    const helperBefore = [{ path: target, text: "const helper = true; return helper || false" }];
    const helperAfter = [{ path: target, text: "const helper = false; return helper || false" }];
    assert.notEqual(
      identity(target, helperBefore, "node|linux|x64").prefix,
      identity(target, helperAfter, "node|linux|x64").prefix,
    );
    assert.deepEqual(identity(target, [...files].reverse(), "node|linux|x64"), base);
    assert.deepEqual(
      identity(
        target,
        files.map((file) => (file.path.endsWith(".md") ? { ...file, text: "nuovo stato" } : file)),
        "node|linux|x64",
      ),
      base,
    );
    assert.throws(() => identity("missing", files));
  });

  it("rifiuta ricevute incompatibili, parziali, vuote o con mutanti non uccisi", () => {
    const target = "app/grants.server.ts";
    const expected = { target, key: "verified-inputs" };
    const source = "source";
    const complete = { files: { [target]: { source, mutants: [mutant("Killed")] } } };
    const receipt = {
      ...expected,
      passed: true,
      reportDigest: createHash("sha256").update(JSON.stringify(complete)).digest("hex"),
    };
    assert.doesNotThrow(() => checkReceipt(expected, receipt, complete, source));
    for (const invalid of [
      { ...receipt, key: "old-inputs" },
      { ...receipt, target: "other" },
      { ...receipt, passed: false },
    ])
      assert.throws(() => checkReceipt(expected, invalid, complete, source));
    assert.throws(() => checkReceipt(expected, receipt, complete, "changed-source"));
    assert.throws(() =>
      checkReceipt(expected, { ...receipt, reportDigest: "changed" }, complete, source),
    );
    assert.throws(() => checkReceipt(expected, receipt, { files: {} }, source));
    assert.throws(() =>
      checkReceipt(expected, receipt, { files: { [target]: { source, mutants: [] } } }, source),
    );
    assert.throws(() =>
      checkReceipt(
        expected,
        receipt,
        { files: { [target]: { source, mutants: [mutant("Survived")] } } },
        source,
      ),
    );
  });

  it("riusa solo artefatti non scaduti del modulo verificato nello stesso repository", () => {
    const candidate = { expired: false, workflow_run: { repository_id: 1, head_repository_id: 1 } };
    const run = { path: ".github/workflows/ci.yml", conclusion: "failure" };
    const target = "app/auth-route.server.ts";
    const job = { name: `Mutation / ${target}`, conclusion: "success" };
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 1, target), true);
    assert.equal(
      verifiedMutationOrigin({ ...candidate, expired: true }, run, [job], 1, target),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 2, target), false);
    assert.equal(
      verifiedMutationOrigin(
        { ...candidate, workflow_run: { repository_id: 1, head_repository_id: 2 } },
        run,
        [job],
        1,
        target,
      ),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, { path: "other.yml" }, [job], 1, target), false);
    assert.equal(
      verifiedMutationOrigin(candidate, run, [{ ...job, conclusion: "failure" }], 1, target),
      false,
    );
    assert.equal(
      verifiedMutationOrigin(candidate, run, [{ ...job, conclusion: "cancelled" }], 1, target),
      false,
    );
    assert.equal(verifiedMutationOrigin(candidate, run, [job], 1, "app/other.server.ts"), false);
  });
});
