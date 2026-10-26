import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  consumerTests,
  crashedRanges,
  criticalModule,
  evaluate,
  mergeRetry,
  mutationConcurrency,
  mutationMatrix,
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

  it("non considera successo sopravvissuti, timeout, errori, esclusioni senza motivo o nessun mutante", () => {
    const statuses = ["Survived", "NoCoverage", "Timeout", "RuntimeError", "CompileError"];
    assert.equal(
      evaluate(report(...statuses.map((status) => mutant(status)), mutant("Ignored"))).length,
      6,
    );
    assert.deepEqual(evaluate(report(mutant("Timeout"))), [
      "app/grants.server.ts:3:5: ConditionalExpression Timeout",
    ]);
    assert.deepEqual(evaluate({ files: {} }), ["nessun mutante generato"]);
  });

  it("ripete una volta soltanto i mutanti interrotti dal pool fuori da ogni prova", () => {
    const crash = "An error occurred outside of a test run: Error: [vitest-pool]";
    const at = (line, status, statusReason, replacement = "false") => ({
      mutatorName: "ConditionalExpression",
      replacement,
      status,
      statusReason,
      location: { start: { line, column: 4 }, end: { line: line + 1, column: 2 } },
    });
    const first = report(
      at(3, "RuntimeError", crash),
      at(3, "RuntimeError", crash, "true"),
      at(7, "RuntimeError", "TypeError durante la prova"),
      at(9, "Killed"),
    );
    assert.deepEqual(crashedRanges(first), ["app/grants.server.ts:3-4"]);
    const merged = mergeRetry(
      first,
      report(at(3, "Killed"), at(3, "Survived", undefined, "true"), at(9, "Survived")),
    );
    assert.deepEqual(
      merged.files["app/grants.server.ts"].mutants.map(({ status }) => status),
      ["Killed", "Survived", "RuntimeError", "Killed"],
    );
    assert.deepEqual(evaluate(merged), [
      "app/grants.server.ts:3:5: ConditionalExpression Survived",
      "app/grants.server.ts:7:5: ConditionalExpression RuntimeError",
    ]);
  });

  it("prova ogni modulo con i test che lo importano, anche indirettamente", () => {
    const files = [
      { path: "app/domain/grants.server.ts", text: 'import { value } from "~/helper";' },
      { path: "app/helper.ts", text: "export const value = true;" },
      { path: "app/facade.ts", text: 'export { grant } from "./domain/grants.server";' },
      { path: "test/grants.spec.ts", text: 'import { grant } from "../app/facade";' },
      { path: "test/other.spec.ts", text: 'import { value } from "../app/helper";' },
      { path: "test/tax.unit.ts", text: 'import { taxQuality } from "../app/tax-quality";' },
      { path: "app/tax-quality.ts", text: "export const taxQuality = () => true;" },
    ];
    assert.deepEqual(consumerTests("app/domain/grants.server.ts", files), ["test/grants.spec.ts"]);
    assert.deepEqual(consumerTests("app/tax-quality.ts", files), ["test/tax.unit.ts"]);
    // Senza consumatori riconoscibili resta l'intera suite.
    assert.deepEqual(consumerTests("app/domain/stores.server.ts", files), [
      "test/grants.spec.ts",
      "test/other.spec.ts",
    ]);
  });

  it("seleziona i moduli critici per la campagna settimanale o manuale", () => {
    const files = [
      "app/domain/orders.server.ts",
      "app/domain/order-import.server.ts",
      "app/i18n.ts",
      "app/tax-quality.ts",
    ];
    assert.equal(criticalModule("app/i18n.ts"), false);
    assert.equal(criticalModule("app/domain/billing.server.ts"), true);
    assert.equal(criticalModule("app/domain/refunds.server.ts"), true);
    assert.equal(criticalModule("app/domain/telegram.server.ts"), true);
    assert.equal(criticalModule("app/integrations/telegram.server.ts"), true);
    assert.deepEqual(mutationMatrix("", files), {
      target: [
        "app/domain/order-import.server.ts",
        "app/domain/orders.server.ts",
        "app/tax-quality.ts",
      ],
    });
    assert.deepEqual(mutationMatrix(" app/tax-quality.ts ", files), {
      target: ["app/tax-quality.ts"],
    });
    assert.deepEqual(mutationMatrix('{"target":["app/tax-quality.ts"]}', files), {
      target: ["app/tax-quality.ts"],
    });
    assert.throws(() => mutationMatrix("app/i18n.ts", files), /Modulo critico inesistente/u);
    assert.throws(() => mutationMatrix('{"target":["app/i18n.ts"]}', files), /non valida/u);
  });
});
