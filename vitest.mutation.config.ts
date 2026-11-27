import { relative } from "node:path";

import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

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

// Vitest ordinerebbe per dimensione: conta l'ordine di `scripts/mutation.mjs`, che anticipa i test
// diretti del modulo. Il test che uccide un mutante statico arriva così prima del timeout.
class SelectionOrder extends BaseSequencer {
  override sort(specs: TestSpecification[]) {
    const position = ({ moduleId }: TestSpecification) =>
      files.indexOf(relative(process.cwd(), moduleId));
    return Promise.resolve(
      [...specs].toSorted((first, second) => position(first) - position(second)),
    );
  }
}

// I limiti di tempo dei test vengono dalla suite: quelli Cloudflare restano sotto il timeout di
// Stryker (`stryker.config.json`), così un test bloccato da un mutante cade su quello di Vitest.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: files,
    fileParallelism: false,
    // Il pool Cloudflare invia la cache dei moduli in un solo messaggio WebSocket, che può
    // superare il limite di workerd durante la mutation (cloudflare/workers-sdk#16349).
    ...(units === 0 ? { fsModuleCache: false } : {}),
    // Stryker attiva i mutanti fra un'esecuzione e l'altra: ogni file resta in un isolate proprio,
    // nell'ordine scelto qui e non in quello casuale della suite.
    isolate: true,
    sequence: { ...base.test?.sequence, shuffle: false, sequencer: SelectionOrder },
  },
});
