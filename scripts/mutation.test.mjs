import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  consumerTests,
  criticalModule,
  evaluate,
  incrementalSafe,
  lineMatrix,
  lineParts,
  mergeReports,
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
    const shardsOf = async (file) => Array.from({ length: parts[file] }, () => ({ mutants: 1 }));
    assert.deepEqual(await mutationJobs(Object.keys(parts), shardsOf), {
      include: [
        { target: "app/a.server.ts", shard: "1/1" },
        { target: "app/b.server.ts", shard: "1/2" },
        { target: "app/b.server.ts", shard: "2/2" },
      ],
    });
    assert.deepEqual(await mutationJobs([], shardsOf), { include: [] });
  });

  it("avvia per prime le parti con più mutanti per test", async () => {
    const mutants = { "app/a.server.ts": [90], "app/b.server.ts": [10, 150] };
    const tests = { "app/a.server.ts": 2, "app/b.server.ts": 20 };
    const { include } = await mutationJobs(
      Object.keys(mutants),
      async (file) => mutants[file].map((count) => ({ mutants: count })),
      (file) => tests[file],
    );
    assert.deepEqual(include, [
      { target: "app/b.server.ts", shard: "2/2" },
      { target: "app/b.server.ts", shard: "1/2" },
      { target: "app/a.server.ts", shard: "1/1" },
    ]);
  });

  it("divide le righe cambiate in parti di circa cinquanta mutanti senza tagliare un mutante", () => {
    const mutants = (from, to) =>
      Array.from({ length: to - from + 1 }, (_, index) => ({
        start: from + index,
        end: from + index,
      }));
    // Intervalli piccoli si riuniscono, uno grande si divide.
    assert.deepEqual(lineParts("1-10,20-30", [...mutants(1, 10), ...mutants(20, 30)]), [
      "1-10,20-30",
    ]);
    const large = lineParts("100-219", mutants(100, 219));
    assert.equal(large.length, 3);
    assert.equal(large[0].split("-")[0], "100");
    assert.equal(large.at(-1).split("-")[1], "219");
    // Un mutante su più righe resta in una sola parte.
    const spanning = [...mutants(1, 49), { start: 50, end: 52 }, ...mutants(53, 60)];
    for (const part of lineParts("1-60", spanning))
      for (const range of part.split(",")) {
        const [start, end] = range.split("-").map(Number);
        assert.ok(!(start > 50 && start <= 52) && !(end >= 50 && end < 52), range);
      }
    // Senza mutanti resta una parte, che conferma l'assenza.
    assert.deepEqual(lineParts("5-6,9-9", []), ["5-6,9-9"]);
  });

  it("riusa la base incrementale soltanto dopo cambi di test e documenti", () => {
    for (const file of ["test/orders.spec.ts", "test/x.unit.ts", "docs/a.md", "changes/b.md"])
      assert.ok(incrementalSafe(file), file);
    for (const file of [
      "app/auth.server.ts",
      "test/fixtures/account-fixtures.ts",
      "vitest.config.ts",
      "pnpm-lock.yaml",
    ])
      assert.ok(!incrementalSafe(file), file);
  });

  it("conserva il nome del job quando le righe stanno in una parte", async () => {
    const target = "app/auth.server.ts";
    const many = Array.from({ length: 120 }, (_, index) => ({ start: index + 1, end: index + 1 }));
    const single = await lineMatrix({ include: [{ target, lines: "1-3" }] }, async () => many);
    assert.deepEqual(single.include, [{ target, lines: "1-3", part: "" }]);
    const split = await lineMatrix({ include: [{ target, lines: "1-120" }] }, async () => many);
    assert.deepEqual(
      split.include.map(({ part }) => part),
      ["1/3", "2/3", "3/3"],
    );
    await assert.rejects(lineMatrix({ include: [{ target: "app/format.ts", lines: "1-1" }] }));
  });

  it("riunisce le parti di una prova in un report incrementale senza doppioni né esiti instabili", () => {
    const mutant = (line, status, mutatorName = "BooleanLiteral") => ({
      id: String(line),
      mutatorName,
      replacement: "false",
      status,
      location: { start: { line, column: 1 }, end: { line, column: 5 } },
    });
    const report = (mutants, tests = {}) => ({
      schemaVersion: "2",
      files: { "app/a.server.ts": { language: "typescript", source: "sorgente", mutants } },
      testFiles: tests,
    });
    const merged = mergeReports([
      report([mutant(1, "Killed"), mutant(2, "Timeout")], {
        "test/a.spec.ts": { tests: [{ id: "a" }] },
      }),
      report([mutant(1, "Killed"), mutant(3, "Survived"), mutant(4, "RuntimeError")], {
        "test/b.spec.ts": { tests: [{ id: "b" }] },
      }),
    ]);
    assert.deepEqual(
      merged.files["app/a.server.ts"].mutants.map(({ location, status }) => [
        location.start.line,
        status,
      ]),
      [
        [1, "Killed"],
        [3, "Survived"],
      ],
    );
    assert.deepEqual(Object.keys(merged.testFiles).sort(), ["test/a.spec.ts", "test/b.spec.ts"]);
    assert.equal(mergeReports([]), undefined);
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
    // Il file che importa il modulo precede quelli che lo raggiungono attraverso altri moduli.
    assert.deepEqual(
      consumerTests("app/helper.ts", [
        ...files,
        { path: "test/a.spec.ts", text: 'import { grant } from "../app/facade";' },
      ]),
      ["test/other.spec.ts", "test/a.spec.ts", "test/grants.spec.ts"],
    );
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
      .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
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
