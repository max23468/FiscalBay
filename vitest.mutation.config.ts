import { defineConfig } from "vitest/config";
import cloudflare from "./vitest.cloudflare.config";
import unit from "./vitest.unit.config";

const selection: unknown = JSON.parse(process.env.MUTATION_TEST_FILES ?? "null");
const valid = (file: unknown): file is string =>
  typeof file === "string" && /^test\/[\w./-]+\.(?:unit|spec)\.ts$/u.test(file);
if (!Array.isArray(selection) || selection.length === 0 || !selection.every(valid))
  throw new Error("Selezione dei test mutation assente o non valida.");
const files: string[] = selection;
// `scripts/mutation.mjs` sceglie i test di una sola suite: il suffisso indica il progetto.
const units = files.filter((file) => file.endsWith(".unit.ts")).length;
if (units !== 0 && units !== files.length)
  throw new Error("La selezione mutation mescola test Node e Cloudflare.");
const base = units === 0 ? cloudflare : unit;

// La prova iniziale con la copertura per test, su più processi del runner di GitHub, porta oltre i 5
// secondi predefiniti test che di solito ne impiegano uno. Il timeout di Stryker resta più lungo
// (`stryker.config.json`): un test bloccato da un mutante cade comunque su quello di Vitest.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: files,
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 20_000,
  },
});
