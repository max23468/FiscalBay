import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { budgets, overruns, split } from "./ci-budget.mjs";

const time = (seconds) => new Date(Date.UTC(2026, 10, 21, 10, 0, seconds)).toISOString();
const step = (name, from, to, conclusion = "success") => ({
  name,
  started_at: time(from),
  completed_at: time(to),
  conclusion,
});
const job = (name, steps, { created = 0, started = 2, completed = 60 } = {}) => ({
  name,
  status: "completed",
  conclusion: "success",
  created_at: time(created),
  started_at: time(started),
  completed_at: time(completed),
  steps,
});

describe("budget dei job della CI", () => {
  it("divide attesa, setup fino al primo passo di lavoro ed esecuzione", () => {
    const measured = split(
      job("Vitest 1/3", [
        step("Set up job", 2, 3),
        step("Checkout", 3, 5),
        step("Set up Node and dependencies", 5, 20),
        step("Run tests", 20, 55),
        // Un passo di download dopo il lavoro resta esecuzione.
        step("Restore something", 55, 58),
        // La chiusura del runner non conta.
        step("Post Checkout", 58, 59),
        step("Complete job", 59, 60),
      ]),
    );
    assert.deepEqual(measured, { wait: 2, setup: 18, run: 38 });
  });

  it("salta i passi non eseguiti senza chiudere il setup", () => {
    const measured = split(
      job("Verify", [
        step("Checkout", 2, 4),
        step("Check dispatched commit", 4, 4, "skipped"),
        step("Classify changes", 4, 10),
      ]),
    );
    assert.equal(measured.setup, 2);
  });

  it("segnala ogni valore oltre il budget del job e ignora i job saltati o senza budget", () => {
    const slow = job("Check check:lint", [step("Checkout", 20, 22), step("Run check", 22, 60)], {
      started: 20,
    });
    const skipped = { ...slow, conclusion: "skipped" };
    const unknown = job("Altro", [step("Run", 2, 500)], { completed: 500 });
    assert.deepEqual(overruns([slow, skipped, unknown]), [
      { job: "Check check:lint", kind: "wait", seconds: 20, budget: 10 },
      { job: "Check check:lint", kind: "run", seconds: 38, budget: 5 },
    ]);
  });

  it("dà un budget a ogni job del gate rapido", () => {
    for (const name of [
      "Verify",
      "Check check:lint",
      "Check typecheck",
      "Check check:tooling",
      "Check doctor:react",
      "Check build:live",
      "Vitest 1/3",
      "Vitest coverage",
      "Browser 3/8",
    ])
      assert.ok(
        budgets.some(({ job: pattern }) => pattern.test(name)),
        name,
      );
  });
});
