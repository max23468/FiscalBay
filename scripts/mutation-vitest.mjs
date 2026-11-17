/** Il pool Cloudflare richiede un runner nuovo per ricaricare i mutanti statici. */

import { writeFileSync } from "node:fs";

import { strykerPlugins as nativePlugins } from "@stryker-mutator/vitest-runner";
export { strykerValidationSchema } from "@stryker-mutator/vitest-runner";

const native = nativePlugins.find((plugin) => plugin.name === "vitest");
function createRunner(injector) {
  const runner = native.factory(injector);
  // Il fallback di Stryker ricrea il processo solo quando deve ricaricare l'ambiente.
  runner.capabilities = () => ({ reloadEnvironment: false });
  return runner;
}
createRunner.inject = native.factory.inject;

export class TimingReporter {
  started = Number(process.env.MUTATION_STARTED_AT) || Date.now();
  onDryRunCompleted() {
    if (process.env.MUTATION_TIMING_FILE)
      writeFileSync(
        process.env.MUTATION_TIMING_FILE,
        JSON.stringify({ preparationMs: Date.now() - this.started }),
      );
  }
}

export const strykerPlugins = [
  { ...native, factory: createRunner },
  { kind: "Reporter", name: "timing", injectableClass: TimingReporter },
];
