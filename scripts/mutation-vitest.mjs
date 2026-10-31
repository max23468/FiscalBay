/** Il pool Cloudflare richiede un runner nuovo per ricaricare i mutanti statici. */
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

export const strykerPlugins = [{ ...native, factory: createRunner }];
