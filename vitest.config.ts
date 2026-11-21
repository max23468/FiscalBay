import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

const measured: Record<string, number> = JSON.parse(readFileSync("test/durations.json", "utf8"));
const known = Object.values(measured).toSorted((a, b) => a - b);
const median = known[Math.floor(known.length / 2)] ?? 1;

/**
 * Ordine casuale dei file con il seme della run, stampato da Vitest: un file che dipende da ciò che
 * un altro lascia indietro emerge e si riproduce con `--sequence.seed`. Gli shard della CI si
 * dividono per durata misurata (`test/durations.json`, aggiornato con `pnpm test:durations`): ogni
 * file va in un solo shard, quello con il carico minore, nello stesso modo su ogni macchina.
 */
class MeasuredShards extends BaseSequencer {
  private key(spec: TestSpecification) {
    return relative(this.ctx.config.root, spec.moduleId).split("\\").join("/");
  }

  override sort(specs: TestSpecification[]) {
    let state = this.ctx.config.sequence.seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
    const order = [...specs].toSorted((a, b) => (this.key(a) < this.key(b) ? -1 : 1));
    for (let index = order.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other]!, order[index]!];
    }
    return Promise.resolve(order);
  }

  override shard(specs: TestSpecification[]) {
    const { index, count } = this.ctx.config.shard!;
    const duration = (spec: TestSpecification) => measured[this.key(spec)] ?? median;
    const loads = Array.from({ length: count }, () => 0);
    const assigned: TestSpecification[][] = Array.from({ length: count }, () => []);
    const longest = [...specs].toSorted(
      (a, b) => duration(b) - duration(a) || (this.key(a) < this.key(b) ? -1 : 1),
    );
    for (const spec of longest) {
      const lightest = loads.indexOf(Math.min(...loads));
      loads[lightest]! += duration(spec);
      assigned[lightest]!.push(spec);
    }
    return Promise.resolve(assigned[index - 1]!);
  }
}

export default defineConfig({
  test: {
    projects: ["./vitest.cloudflare.config.ts", "./vitest.unit.config.ts"],
    sequence: { shuffle: { files: true, tests: false }, sequencer: MeasuredShards },
    coverage: {
      provider: "istanbul",
      include: ["app/**/*.{ts,tsx}", "workers/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reportsDirectory: "reports/coverage",
      reporter: ["text", "html", "json", "json-summary", "lcov"],
      reportOnFailure: true,
    },
  },
});
