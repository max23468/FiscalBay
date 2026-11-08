import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import {
  consumerTests,
  criticalModule,
  evaluate,
  incrementalBase,
  mergeReports,
  mutationConcurrency,
  mutationCoverageGaps,
  mutationJobs,
  mutationMatrix,
  prTargets,
  shardPlan,
  shardRanges,
  timedMutants,
  validateRanges,
  backgroundConcurrency,
  completeTimings,
  changedRange,
  retestEstimate,
  moduleReferences,
  mutantsPerShard,
  pullRequestShards,
  unsplitRetests,
} from "./mutation.mjs";
import { strykerPlugins as mutationPlugins } from "./mutation-vitest.mjs";

describe("esito dei mutation test", () => {
  it("con la riusabilità della PR la matrice parte senza restare in attesa del proprio modulo", () => {
    // Un import dinamico di `mutation-reuse.mjs` durante l'await di primo livello non si chiudeva
    // mai (codice 13): ora la matrice arriva ai controlli e segnala i dati mancanti.
    const base = { ...process.env };
    for (const name of ["REPOSITORY", "REPOSITORY_ID", "HEAD_SHA"]) delete base[name];
    const result = spawnSync(
      process.execPath,
      [
        "scripts/mutation.mjs",
        "--matrix",
        JSON.stringify({ target: ["app/domain/orders.server.ts"] }),
      ],
      { encoding: "utf8", env: { ...base, MUTATION_PR_BRANCH: "prova" }, timeout: 60_000 },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PR, repository o testa non indicati/u);
  });

  it("riduce le sole campagne in presenza di PR o cicli, mai la qualifica del candidato", () => {
    const pr = [{ event: "pull_request", status: "queued" }];
    assert.equal(backgroundConcurrency([]), 8);
    assert.equal(backgroundConcurrency([], { campaign: true }), 16);
    assert.equal(backgroundConcurrency(pr), 4);
    assert.equal(backgroundConcurrency(pr, { campaign: true }), 4);
    assert.equal(
      backgroundConcurrency([{ path: ".github/workflows/cycle.yml", status: "in_progress" }]),
      4,
    );
    // Il ciclo in corso è il `Promuovi` che attende la qualifica: non le toglie posti.
    assert.equal(
      backgroundConcurrency([{ path: ".github/workflows/cycle.yml", status: "in_progress" }], {
        qualification: true,
      }),
      8,
    );
    assert.equal(backgroundConcurrency(pr, { qualification: true }), 6);
    assert.equal(backgroundConcurrency(pr, { qualification: true, campaign: true }), 6);
    assert.equal(backgroundConcurrency([], { qualification: true, campaign: true }), 16);
    assert.equal(backgroundConcurrency([{ event: "pull_request", status: "completed" }]), 8);
  });
  it("conserva le durate soltanto se coprono tutto il modulo", () => {
    const digest = "a".repeat(64);
    const part = (start, end, change = {}) => ({
      start,
      end,
      digest,
      lines: 10,
      mutationMs: 1000,
      preparationMs: 100,
      ...change,
    });
    assert.equal(completeTimings([part(1, 5), part(6, 10)]), true);
    assert.equal(completeTimings([part(6, 10)]), false);
    assert.equal(completeTimings([part(1, 4), part(6, 10)]), false);
    assert.equal(completeTimings([part(1, 5), part(6, 10, { digest: "b".repeat(64) })]), false);
    assert.equal(completeTimings([part(1, 5), part(6, 10, { lines: 11 })]), false);
    assert.equal(completeTimings([part(1, 10, { digest: "forged" })]), false);
    assert.equal(completeTimings([part(1, 10, { mutationMs: "1" })]), false);
    assert.equal(completeTimings([]), false);
  });
  it("bilancia i tempi senza saltare mutanti e rifiuta piani incompleti", () => {
    const mutants = Array.from({ length: 12 }, (_, index) => ({
      start: index + 1,
      end: index + 1,
    }));
    const history = [
      { digest: "same", start: 1, end: 6, mutants: 6, mutationMs: 600000, preparationMs: 1000 },
      { digest: "same", start: 7, end: 12, mutants: 6, mutationMs: 6000, preparationMs: 1000 },
    ];
    const timed = timedMutants(mutants, history, "same");
    assert.equal(timed[0].weight, 100000);
    assert.deepEqual(timedMutants(mutants, history, "changed"), mutants);
    assert.deepEqual(timedMutants(mutants, [], "same"), mutants);
    const ranges = shardPlan(timed, 12, 1000);
    assert.ok(ranges.length > 1);
    assert.equal(
      ranges.reduce((sum, range) => sum + range.mutants, 0),
      12,
    );
    assert.doesNotThrow(() => validateRanges(ranges, 12, mutants));
    assert.throws(() => validateRanges(ranges.slice(1), 12, mutants));
    assert.throws(() =>
      validateRanges(
        [
          { start: 1, end: 6 },
          { start: 6, end: 12 },
        ],
        12,
        mutants,
      ),
    );
    assert.throws(() =>
      validateRanges(
        [
          { start: 1, end: 6 },
          { start: 7, end: 12 },
        ],
        12,
        [{ start: 4, end: 8 }],
      ),
    );
    assert.equal(shardPlan(timed, 12, 10000000).length, 1);
  });
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

  it("aggiunge parti finché nessuna supera il limite dei mutanti", () => {
    // Settanta righe semplici e due funzioni da 81 mutanti: con due parti il taglio migliore
    // lascia 151 mutanti nella prima, con tre nessuna supera il limite.
    const lines = (from, length) =>
      Array.from({ length }, (_, index) => ({ start: from + index, end: from + index }));
    const mutants = [
      ...lines(1, 70),
      { start: 100, end: 180 },
      ...lines(100, 80),
      { start: 200, end: 280 },
      ...lines(200, 80),
    ];
    const inside = ({ start, end }) =>
      mutants.filter((mutant) => mutant.start >= start && mutant.end <= end).length;
    assert.deepEqual(shardRanges(mutants, 2, 300).map(inside), [151, 81]);
    assert.deepEqual(
      shardPlan(mutants, 300).map((part) => part.mutants),
      [70, 81, 81],
    );
    // Senza tagli possibili resta la divisione minima.
    const whole = [{ start: 1, end: 300 }, ...mutants];
    assert.deepEqual(
      shardPlan(whole, 300).map((part) => part.mutants),
      [233],
    );
  });

  it("assegna a ogni modulo una parte per intervallo", async () => {
    const parts = { "app/a.server.ts": 1, "app/b.server.ts": 2 };
    const shardsOf = async (file) => Array.from({ length: parts[file] }, () => ({ mutants: 1 }));
    const digestOf = () => "d";
    assert.deepEqual(await mutationJobs(Object.keys(parts), shardsOf, undefined, { digestOf }), {
      include: [
        { target: "app/a.server.ts", shard: "1/1", digest: "d" },
        { target: "app/b.server.ts", shard: "1/2", digest: "d" },
        { target: "app/b.server.ts", shard: "2/2", digest: "d" },
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
      { digestOf: () => "d" },
    );
    assert.deepEqual(include, [
      { target: "app/b.server.ts", shard: "2/2", digest: "d" },
      { target: "app/b.server.ts", shard: "1/2", digest: "d" },
      { target: "app/a.server.ts", shard: "1/1", digest: "d" },
    ]);
  });

  it("stima le righe cambiate dal riferimento e i mutanti che le toccano", () => {
    assert.equal(changedRange("a\nb\nc", "a\nb\nc"), null);
    assert.deepEqual(changedRange("a\nb\nc", "a\nB\nc"), { start: 2, end: 2 });
    // Due modifiche distanti contano come un solo blocco; una riga tolta tocca il punto del taglio.
    assert.deepEqual(changedRange("a\nb\nc\nd", "A\nb\nc\nD"), { start: 1, end: 4 });
    assert.deepEqual(changedRange("a\nb\nc", "a\nc"), { start: 2, end: 2 });
    assert.deepEqual(changedRange("a\nc", "a\nb\nc"), { start: 2, end: 2 });
    const mutants = [
      { start: 1, end: 1 },
      { start: 2, end: 5 },
      { start: 6, end: 6 },
    ];
    assert.equal(retestEstimate(mutants, null), 0);
    assert.equal(retestEstimate(mutants, { start: 4, end: 6 }), 2);
  });

  it("riunisce soltanto i moduli con tutte le parti riuscite", () => {
    const outcome = (status) => ({
      files: { x: { mutants: [{ status, location: { start: {} } }] } },
    });
    const incremental = (line) => ({
      files: {
        x: {
          source: "s",
          mutants: [
            {
              mutatorName: "M",
              status: "Killed",
              location: { start: { line, column: 1 }, end: { line, column: 2 } },
            },
          ],
        },
      },
      testFiles: {},
    });
    const part = (target, index, parts, status = "Killed") => ({
      target,
      part: index,
      parts,
      report: outcome(status),
      incremental: incremental(index),
    });
    const references = moduleReferences([
      part("app/a.server.ts", 1, 2),
      part("app/a.server.ts", 2, 2),
      part("app/b.server.ts", 1, 2),
      part("app/c.server.ts", 1, 1, "Survived"),
      part("app/d.server.ts", 1, 1),
    ]);
    assert.deepEqual([...references.keys()], ["app/a.server.ts", "app/d.server.ts"]);
    assert.equal(references.get("app/a.server.ts").files.x.mutants.length, 2);
  });

  it("prova in un solo job il modulo con il riferimento completo e pochi mutanti da ripetere", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mutation-references-"));
    const split = async () => [{ mutants: 20 }, { mutants: 17 }];
    try {
      // Senza riferimento completo il modulo si divide come nella campagna.
      assert.deepEqual(await pullRequestShards("app/time.ts", directory, split), await split());
      const reference = path.join(directory, "app_time.ts.json");
      const source = readFileSync("app/time.ts", "utf8");
      writeFileSync(reference, JSON.stringify({ files: { "app/time.ts": { source } } }));
      assert.deepEqual(await pullRequestShards("app/time.ts", directory, split), [
        { mutants: 0, reference },
      ]);
      // Un sorgente riscritto ripete tutti i suoi 264 mutanti: oltre il limite si divide.
      writeFileSync(
        path.join(directory, "app_tax-quality.ts.json"),
        JSON.stringify({ files: { "app/tax-quality.ts": { source: "" } } }),
      );
      assert.ok(unsplitRetests < mutantsPerShard);
      assert.deepEqual(
        await pullRequestShards("app/tax-quality.ts", directory, split),
        await split(),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("porta il riferimento completo nel job del modulo", async () => {
    const reference = ".mutation-references/app_a.server.ts.json";
    const { include } = await mutationJobs(
      ["app/a.server.ts"],
      async () => [{ mutants: 0, reference }],
      undefined,
      { digestOf: () => "d" },
    );
    assert.deepEqual(include, [
      { target: "app/a.server.ts", shard: "1/1", digest: "d", reference },
    ]);
  });

  it("parte dal report più recente della PR su un antenato, preferendo la stessa parte", async () => {
    const run = (id, sha, minute, repo = 1) => ({
      id,
      head_sha: sha,
      created_at: `2026-11-08T10:${String(minute).padStart(2, "0")}:00Z`,
      head_repository: { id: repo },
    });
    const statuses = { h1: "ahead", h2: "ahead", h3: "diverged", h4: "ahead" };
    const choose = (runs, found, extra = {}) =>
      incrementalBase(
        { runs, head: "h5", current: 10, repositoryId: 1, ...extra },
        { status: async (sha) => statuses[sha], reports: async (id) => found[id] ?? null },
      );
    const runs = [run(10, "h5", 50), run(9, "h4", 40), run(8, "h3", 30), run(7, "h2", 20)];
    // Codice cambiato da allora non scarta più il report: basta un commit antenato.
    assert.deepEqual(await choose(runs, { 9: { same: "r9" } }), {
      run: 9,
      report: "r9",
      same: true,
    });
    // Un commit non antenato non vale; la stessa parte vince su una run più recente con altre.
    assert.deepEqual(
      await choose(runs, { 9: { any: "a9" }, 8: { same: "r8" }, 7: { same: "r7" } }),
      { run: 7, report: "r7", same: true },
    );
    assert.deepEqual(await choose(runs, { 9: { any: "a9" }, 7: { any: "a7" } }), {
      run: 9,
      report: "a9",
      same: false,
    });
    // Senza report, o di un altro repository, si ripiega sul riferimento di develop.
    assert.equal(await choose(runs, {}), null);
    assert.equal(await choose([run(9, "h4", 40, 2)], { 9: { same: "r9" } }), null);
    // La run in corso vale soltanto per una ripetizione dei job falliti.
    assert.equal(await choose([runs[0]], { 10: { same: "r10" } }), null);
    assert.deepEqual(await choose([runs[0]], { 10: { same: "r10" } }, { attempt: "2" }), {
      run: 10,
      report: "r10",
      same: true,
    });
  });

  it("limita la matrice alle parti mancanti con gli intervalli del piano", async () => {
    const ranges = [
      { start: 1, end: 10, mutants: 5 },
      { start: 11, end: 20, mutants: 9 },
      { start: 21, end: 30, mutants: 7 },
    ];
    const { include } = await mutationJobs(["app/a.server.ts"], async () => ranges, undefined, {
      keep: new Map([["app/a.server.ts", new Set([1, 3])]]),
      digestOf: () => "d",
    });
    assert.deepEqual(
      include.map(({ shard, ranges: plan, digest }) => [shard, JSON.parse(plan), digest]),
      [
        ["3/3", ranges, "d"],
        ["1/3", ranges, "d"],
      ],
    );
  });

  it("prova nella PR i moduli critici cambiati e quelli importati da un test cambiato", () => {
    const files = [
      { path: "app/domain/orders.server.ts", text: 'import { a } from "../time";' },
      { path: "app/time.ts", text: "" },
      { path: "app/format.ts", text: "" },
      { path: "app/auth.server.ts", text: "" },
      { path: "test/orders.spec.ts", text: 'import { b } from "../app/domain/orders.server";' },
      { path: "test/helpers.ts", text: 'import { c } from "../app/auth.server";' },
    ];
    assert.deepEqual(prTargets(["app/auth.server.ts", "app/format.ts"], files), [
      "app/auth.server.ts",
    ]);
    // Un modulo raggiunto soltanto attraverso un altro import resta al candidato.
    assert.deepEqual(prTargets(["test/orders.spec.ts"], files), ["app/domain/orders.server.ts"]);
    // Gli helper dei test e i file eliminati non scelgono moduli.
    assert.deepEqual(prTargets(["test/helpers.ts", "app/domain/gone.server.ts"], files), []);
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
