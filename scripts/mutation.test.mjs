import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  consumerTests,
  criticalModule,
  evaluate,
  mutationConcurrency,
  mutationCoverageGaps,
  mutationJobs,
  mutationMatrix,
  shardRanges,
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

  it("divide un modulo in parti bilanciate senza tagliare un mutante", () => {
    const at = (start, end = start) => ({ start, end });
    // Una funzione dalla riga 3 alla 8 contiene i suoi mutanti: nessun taglio fra 4 e 8.
    const mutants = [at(1), at(2), at(3, 8), at(4), at(5), at(6), at(9), at(10), at(11)];
    const ranges = shardRanges(mutants, 3, 12);
    assert.deepEqual(ranges, [at(1, 2), at(3, 8), at(9, 12)]);
    const inside = ({ start, end }) =>
      mutants.filter((mutant) => mutant.start >= start && mutant.end <= end).length;
    assert.deepEqual(ranges.map(inside), [2, 4, 3]);
    assert.deepEqual(shardRanges(mutants, 1, 12), [at(1, 12)]);
    // Senza tagli possibili resta una sola parte, che li comprende tutti.
    assert.deepEqual(shardRanges([at(1, 12), at(5)], 3, 12), [at(1, 12)]);
  });

  it("assegna a ogni modulo una parte per intervallo", async () => {
    const parts = { "app/a.server.ts": 1, "app/b.server.ts": 2 };
    const shardsOf = async (file) => Array.from({ length: parts[file] }, () => ({}));
    assert.deepEqual(await mutationJobs(Object.keys(parts), shardsOf), {
      include: [
        { target: "app/a.server.ts", shard: "1/1" },
        { target: "app/b.server.ts", shard: "1/2" },
        { target: "app/b.server.ts", shard: "2/2" },
      ],
    });
    assert.deepEqual(await mutationJobs([], shardsOf), { include: [] });
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
    assert.equal(criticalModule("app/domain/order-export.server.ts"), true);
    assert.equal(criticalModule("app/domain/xlsx.server.ts"), true);
    assert.equal(criticalModule("app/domain/export-configurations.server.ts"), true);
    assert.equal(criticalModule("app/integrations/telegram.server.ts"), true);
    for (const file of [
      "app/time.ts",
      "app/sealed.server.ts",
      "app/orders/order-list.ts",
      "app/domain/work-timing.ts",
      "app/domain/order-observation.server.ts",
      "app/domain/store-marks.server.ts",
      "app/domain/billing-subscriptions.server.ts",
      "app/integrations/ebay/environment.server.ts",
    ])
      assert.equal(criticalModule(file), true, file);
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
  it("tiene sotto mutation le regole che i moduli critici importano", () => {
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file))
      .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
    assert.deepEqual(mutationCoverageGaps(files), []);
    const extracted = [
      ...files,
      { path: "app/domain/estratta.server.ts", text: "export const regola = 1;" },
      {
        path: "app/domain/grants.server.ts",
        text: 'import { regola } from "./estratta.server";',
      },
    ].filter(
      (file, index, all) => all.findLastIndex((other) => other.path === file.path) === index,
    );
    assert.ok(
      mutationCoverageGaps(extracted).includes(
        "app/domain/grants.server.ts importa app/domain/estratta.server.ts, non critico",
      ),
    );
  });
});
