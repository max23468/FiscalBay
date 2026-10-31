import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Ricevuta senza DOM, cookie, password o dati applicativi; fallimenti nei trace locali. */
export default class Report implements Reporter {
  rows: Array<{
    id: string;
    retry: number;
    page: string;
    project: string;
    status: string;
    reason: string;
    durationMs: number;
    route: string;
    expected: string;
    checks: string[];
    omissions: string[];
  }> = [];
  onTestEnd(test: TestCase, result: TestResult) {
    // Con la ripetizione remota conta l'ultimo tentativo; `retry` distingue le prove instabili.
    this.rows = this.rows.filter((row) => row.id !== test.id);
    this.rows.push({
      id: test.id,
      retry: result.retry,
      page: test.title,
      project: test.parent.project()?.name ?? "",
      status: result.status,
      durationMs: result.duration,
      route: test.annotations.find(({ type }) => type === "route")?.description ?? "",
      expected: test.annotations.find(({ type }) => type === "expected")?.description ?? "",
      checks: test.annotations
        .filter(({ type }) => type === "check")
        .map(({ description }) => description ?? ""),
      omissions: test.annotations
        .filter(({ type }) => type === "omission")
        .map(({ description }) => description ?? ""),
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
    const flaky = this.rows.filter((row) => row.status === "passed" && row.retry > 0);
    counts.flaky = flaky.length;
    for (const row of flaky)
      console.log(`::warning::Prova instabile, riuscita alla ripetizione: ${row.page}`);
    const partial = this.rows.some(
      (row) => row.status === "skipped" && !row.reason.startsWith("Non applicabile:"),
    );
    const summary = JSON.stringify(
      {
        status: result.status,
        partial,
        counts,
        rows: this.rows,
        sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
        baseURL: process.env.E2E_BASE_URL || "locale",
        environment:
          process.env.E2E_PRODUCTION === "1"
            ? "production"
            : process.env.E2E_BASE_URL
              ? "test"
              : "local",
      },
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
        `\n### Collaudo browser: ${result.status}${partial ? ", parziale" : ""}\n\n${JSON.stringify(counts)}\n\n| Pagina o scenario | Browser | Esito | Secondi | Controlli eseguiti | Omissioni |\n|---|---|---|---|---|---|\n${this.rows.map((row) => `| ${escape(row.page)} | ${row.project} | ${row.status} | ${(row.durationMs / 1000).toFixed(1)} | ${escape(row.checks.join(", "))} | ${escape([row.reason, ...row.omissions, ...(row.retry ? [`riuscita alla ripetizione ${row.retry}`] : [])].filter(Boolean).join("; "))} |`).join("\n")}\n`,
      );
    }
  }
}
