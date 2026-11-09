import type { FullConfig, Reporter, Suite } from "@playwright/test/reporter";

/**
 * Inventario per `--list`: l'identità di ogni prova in ogni progetto, la stessa che `report.ts`
 * registra nelle partizioni. Il reporter JSON di Playwright unisce i progetti in una sola voce
 * con l'identità del primo, quindi non basta a confrontare le prove WebKit.
 */
export default class Inventory implements Reporter {
  onBegin(_config: FullConfig, suite: Suite) {
    process.stdout.write(`${JSON.stringify(suite.allTests().map((test) => test.id))}\n`);
  }
  printsToStdio() {
    return true;
  }
}
