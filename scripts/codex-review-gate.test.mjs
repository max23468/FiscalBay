import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CODEX_REVIEW_POLLING,
  classifyCodexReview,
  hasSuccessfulCodexStatus,
  isRetryableGitHubResponse,
  latestCodexInvocation,
  pullRequestNumber,
} from "./codex-review-gate.mjs";

const headSha = "0123456789abcdef0123456789abcdef01234567";
const oldSha = "abcdef0123456789abcdef0123456789abcdef01";
const requestedAt = "2026-08-04T12:00:00Z";
const bot = { login: "chatgpt-codex-connector[bot]" };
const classify = (overrides = {}) =>
  classifyCodexReview({
    headSha,
    requestedAt,
    now: new Date(requestedAt).getTime() + 60_000,
    comments: [],
    reactions: [],
    reviewComments: [],
    ...overrides,
  });

test("resta pending senza un esito Codex", () => {
  assert.equal(classify().state, "pending");
});

test("approva soltanto il verdetto testuale sull'HEAD esatto", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abcdef0123`",
        },
      ],
    }).state,
    "pending",
  );
});

test("una review vuota con commit_id approva l'HEAD con la reazione successiva", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("il pollice sulla singola invocazione approva l'HEAD", () => {
  const reaction = { user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" };
  assert.equal(
    classify({
      exactReactions: [reaction],
      reactions: [reaction],
      requiresReviewedCommit: true,
    }).state,
    "success",
  );
});

test("non riusa approvazioni o reazioni di SHA e tentativi precedenti", () => {
  const reaction = { user: bot, content: "+1", created_at: "2026-08-04T11:59:59Z" };
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abcdef0123`",
        },
      ],
      exactReactions: [reaction],
      reactions: [reaction],
      requiresReviewedCommit: true,
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      requestedAt: 0,
      exactReactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" }],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" }],
      requiresReviewedCommit: true,
    }).state,
    "pending",
  );
});

test("un finding P0/P1 corrente prevale su ogni approvazione", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Correggi questo caso",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "failure",
  );
});

test("i finding P2/P3 passano dopo la review conclusa", () => {
  assert.equal(
    classify({
      now: new Date("2026-08-04T12:01:00Z").getTime(),
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Suggerimento advisory che cita P0/P1 nella spiegazione",
        },
      ],
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
        },
      ],
    }).state,
    "success",
  );
});

test("l'assestamento advisory parte dal segnale più recente", () => {
  const input = {
    reviewComments: [
      {
        user: bot,
        commit_id: headSha,
        created_at: "2026-08-04T12:00:29Z",
        body: "**P2** Suggerimento advisory",
      },
    ],
    reviews: [{ user: bot, commit_id: headSha, submitted_at: "2026-08-04T12:00:00Z" }],
  };
  assert.equal(classify({ ...input, now: new Date("2026-08-04T12:00:30Z").getTime() }).state, "pending");
  assert.equal(classify({ ...input, now: new Date("2026-08-04T12:01:00Z").getTime() }).state, "success");
});

test("un advisory top-level marcato sull'HEAD completa il gate", () => {
  assert.equal(
    classify({
      now: new Date("2026-08-04T12:01:00Z").getTime(),
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `**P2** Suggerimento advisory\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("ignora finding vecchi dopo rebase, nuovo commit e nuovo tentativo", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          original_commit_id: oldSha,
          commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Finding già corretto",
        },
        {
          user: bot,
          original_commit_id: oldSha,
          commit_id: oldSha,
          created_at: "2026-08-04T12:00:02Z",
          body: "**P2** Finding sul commit precedente",
        },
      ],
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          commit_id: headSha,
          created_at: "2026-08-04T11:59:59Z",
          body: "**P1** Finding del tentativo precedente",
        },
      ],
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("ignora finding top-level appartenenti a SHA o tentativi precedenti", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Finding precedente.\n\n**Reviewed commit:** `abcdef0123`",
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
  assert.equal(
    classify({
      requestedAt: 0,
      requiresReviewedCommit: true,
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:01Z", body: "**P2** Vecchio." },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("un finding senza SHA arrivato da un tentativo concorrente non blocca l'HEAD", () => {
  assert.equal(
    classify({
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Finding senza prova del commit recensito.",
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "success",
  );
});

test("usage limit e unknown error chiudono il tentativo corrente", () => {
  for (const body of [
    "You have reached your Codex usage limits for code reviews.",
    "Codex Review: Something went wrong. Try again later.\n\nUnknown error",
  ]) {
    assert.equal(
      classify({ comments: [{ user: bot, created_at: "2026-08-04T12:00:01Z", body }] })
        .state,
      "failure",
    );
  }
});

test("eyes protegge un tentativo pulito e non nasconde errori successivi", () => {
  const eyes = [{ user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" }];
  assert.equal(
    classify({
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:01Z", body: "Codex could not complete" },
      ],
      progressReactions: eyes,
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      progressReactions: eyes,
    }).state,
    "failure",
  );
});

test("un retry sullo stesso SHA ignora errori storici e usa l'esito nuovo", () => {
  assert.equal(
    classify({
      requestedAt: 0,
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex could not complete the review",
        },
      ],
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
});

test("seleziona solo l'ultima invocazione umana del tentativo corrente", () => {
  assert.equal(
    latestCodexInvocation(
      [
        { id: 1, user: bot, body: "@codex review", created_at: "2026-08-04T12:00:03Z" },
        {
          id: 2,
          user: { login: "max23468" },
          body: "@codex review",
          created_at: "2026-08-04T11:59:59Z",
        },
        {
          id: 3,
          user: { login: "max23468" },
          body: "@codex review",
          created_at: "2026-08-04T12:00:02Z",
        },
      ],
      requestedAt,
    ).id,
    3,
  );
});

test("classifica soltanto gli errori GitHub recuperabili", () => {
  assert.equal(isRetryableGitHubResponse(429, null), true);
  assert.equal(isRetryableGitHubResponse(502, null), true);
  assert.equal(isRetryableGitHubResponse(403, "0"), true);
  assert.equal(isRetryableGitHubResponse(403, "4999"), false);
  assert.equal(isRetryableGitHubResponse(404, null), false);
});

test("il polling dura cinque ore e limita cinque PR a 500 richieste/ora", () => {
  assert.equal(CODEX_REVIEW_POLLING.attempts, 100);
  assert.equal(CODEX_REVIEW_POLLING.intervalMs, 180_000);
  assert.equal(CODEX_REVIEW_POLLING.attempts * CODEX_REVIEW_POLLING.intervalMs, 18_000_000);
  assert.ok((5 * 5 * 60 * 60 * 1000) / CODEX_REVIEW_POLLING.intervalMs <= 500);
});

test("rifiuta input PR non numerici", () => {
  assert.equal(pullRequestNumber({ pull_request: { number: 42 } }), "42");
  assert.equal(pullRequestNumber({}, "208"), "208");
  assert.throws(() => pullRequestNumber({}, "208/merge"), /Numero PR non valido/);
});

test("un rerun riusa solo l'ultimo status riuscito dello stesso SHA", () => {
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "success" },
      { context: "codex-review", state: "pending" },
    ]),
    true,
  );
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "failure" },
      { context: "codex-review", state: "success" },
    ]),
    false,
  );
});

test("l'import del modulo non avvia accidentalmente la CLI", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `import(${JSON.stringify(import.meta.resolve("./codex-review-gate.mjs"))})`],
    {
      env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: "/non-esiste" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("il workflow usa eventi, permessi e codice trusted corretti", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const source = fs.readFileSync(`${root}.github/workflows/codex-review-gate.yml`, "utf8");

  assert.match(source, /pull_request_target:/);
  assert.match(source, /types:\s*\[opened, synchronize, reopened, ready_for_review\]/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /type:\s*number/);
  assert.match(source, /contents:\s*read/);
  assert.match(source, /issues:\s*read/);
  assert.match(source, /pull-requests:\s*read/);
  assert.match(source, /statuses:\s*write/);
  assert.match(source, /cancel-in-progress:\s*true/);
  assert.match(source, /timeout-minutes:\s*310/);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(source, /ref:\s*\$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(source, /node scripts\/codex-review-gate\.mjs/);
});
