import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Ricevuta senza DOM, cookie, password o dati applicativi; fallimenti nei trace locali. */
export default class Report implements Reporter {
  rows: Array<{
    page: string;
    project: string;
    status: string;
    reason: string;
    durationMs: number;
  }> = [];
  onTestEnd(test: TestCase, result: TestResult) {
    this.rows.push({
      page: test.title,
      project: test.parent.project()?.name ?? "",
      status: result.status,
      durationMs: result.duration,
      reason: test.annotations
        .filter(({ type }) => type === "skip")
        .map(({ description }) => description)
        .join("; "),
    });
  }
  onEnd(result: FullResult) {
    const directory = process.env.E2E_REPORT_DIR || "test-results/browser";
    mkdirSync(directory, { recursive: true });
    const counts = Object.fromEntries(
      ["passed", "failed", "skipped", "timedOut", "interrupted"].map((status) => [
        status,
        this.rows.filter((row) => row.status === status).length,
      ]),
    );
    const partial = this.rows.some(
      (row) => row.status === "skipped" && !row.reason.startsWith("Non applicabile:"),
    );
    const summary = JSON.stringify(
      { status: result.status, partial, counts, rows: this.rows },
      null,
      2,
    );
    writeFileSync(`${directory}/summary.json`, summary);
    const runId = process.env.E2E_RUN_ID || (process.env.E2E_BASE_URL ? "deployed" : "local");
    if (!/^[a-z0-9-]+$/u.test(runId)) throw new Error("Identificativo del collaudo non valido.");
    writeFileSync(`${directory}/${runId}.json`, summary);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\n### Collaudo browser: ${result.status}${partial ? ", parziale" : ""}\n\n${JSON.stringify(counts)}\n\n| Pagina o scenario | Browser | Esito | Motivo |\n|---|---|---|---|\n${this.rows.map((row) => `| ${escape(row.page)} | ${row.project} | ${row.status} | ${escape(row.reason)} |`).join("\n")}\n`,
      );
    }
  }
}
