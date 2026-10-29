import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";

import {
  applicationEvent,
  checkReadback,
  correlationTrail,
  dayPrefixes,
  describeDestination,
  errorsByCode,
  exportedFields,
  failedInvocations,
  jobBody,
  lifecycleRules,
  parseObject,
  plan,
  targetOf,
  verifyRecords,
  webhookOperations,
} from "./log-archive.mjs";

const target = targetOf();
const credentials = { accessKeyId: "chiave-di-prova", secretAccessKey: "segreto-di-prova" };
const correlation = "c0a8f3e1-5b2d-4e7a-9c11-7d2f0b6e4a90";

const message = (value) => ({
  Level: "error",
  Message: [JSON.stringify(value)],
  TimestampMs: 1_793_000_000_000,
});

const record = (overrides = {}) => ({
  // Forma osservata nell'archivio del test: millisecondi e versione con `ID`.
  EventTimestampMs: Date.parse("2026-10-29T10:00:00Z"),
  EventType: "fetch",
  Outcome: "ok",
  ScriptName: "fiscalbay-test",
  ScriptVersion: { ID: "v1", Message: "", Tag: "" },
  CPUTimeMs: 3,
  WallTimeMs: 12,
  Logs: [],
  ...overrides,
});

const failure = (fields) =>
  message({ event: "application_error", code: "INTERNAL_ERROR", ...fields });

/** Stato del provider come lo rilegge `apply`, configurato come previsto. */
const configured = () => {
  const body = jobBody(target, credentials);
  return {
    bucket: { name: target.bucket, jurisdiction: "eu", location: "EEUR" },
    lifecycle: { rules: lifecycleRules() },
    managedDomain: { enabled: false },
    customDomains: { domains: [] },
    jobs: [
      { id: 7, name: "altro-progetto", destination_conf: "s3://altro/x?region=auto" },
      {
        id: 8,
        ...body,
        filter: JSON.stringify(JSON.parse(body.filter), null, 1),
        destination_conf: body.destination_conf.replace(/secret-access-key=[^&]+/u, ""),
        last_complete: "2026-10-29T10:05:00Z",
      },
    ],
    worker: { name: target.worker, logpush: true },
  };
};

describe("archivio dei log", () => {
  it("legge Worker, account e bucket dell'ambiente dalla configurazione", () => {
    assert.equal(target.worker, "fiscalbay-test");
    assert.equal(target.bucket, "fiscalbay-test-logs");
    assert.equal(target.account, "98195e505f42abaaeb4827f71a924b1a");
    const live = targetOf("live");
    assert.equal(live.worker, "fiscalbay");
    assert.equal(live.bucket, "fiscalbay-logs");
    assert.notEqual(live.keychain.secretAccessKey, target.keychain.secretAccessKey);
  });

  it("esporta soltanto il Worker dell'ambiente e i campi ammessi verso l'endpoint UE", () => {
    const body = jobBody(target, credentials);
    assert.equal(body.dataset, "workers_trace_events");
    assert.deepEqual(JSON.parse(body.filter), {
      where: { and: [{ key: "ScriptName", operator: "eq", value: "fiscalbay-test" }] },
    });
    for (const field of ["Event", "Exceptions", "ScriptTags", "DispatchNamespace", "Entrypoint"])
      assert.ok(!body.output_options.field_names.includes(field), field);
    assert.ok(body.output_options.field_names.includes("Logs"));
    assert.equal(body.output_options.sample_rate, 1);
    assert.deepEqual(describeDestination(body.destination_conf), {
      bucket: "fiscalbay-test-logs",
      path: "{DATE}",
      region: "auto",
      endpoint: "98195e505f42abaaeb4827f71a924b1a.eu.r2.cloudflarestorage.com",
      credentials: true,
    });
    assert.match(body.destination_conf, /secret-access-key=segreto-di-prova/u);
  });

  it("non stampa le credenziali nel piano", () => {
    const printed = JSON.stringify(plan(target));
    assert.doesNotMatch(printed, /access-key|segreto|chiave-di-prova/u);
    assert.equal(plan(target).job.destination_conf.credentials, true);
  });

  it("elimina gli oggetti dopo 90 giorni e i caricamenti incompleti dopo un giorno", () => {
    const [rule] = lifecycleRules();
    assert.equal(rule.deleteObjectsTransition.condition.maxAge, 90 * 86_400);
    assert.equal(rule.abortMultipartUploadsTransition.condition.maxAge, 86_400);
    assert.equal(rule.conditions.prefix, "");
  });

  it("accetta il readback configurato e ignora i job degli altri progetti", () => {
    const result = checkReadback(target, configured());
    assert.equal(result.ok, true, JSON.stringify(result.checks));
    assert.deepEqual(result.job, {
      id: 8,
      lastComplete: "2026-10-29T10:05:00Z",
      lastError: null,
    });
  });

  it("rifiuta un readback diverso dalla configurazione prevista", () => {
    const cases = {
      "bucket UE": (state) => (state.bucket.jurisdiction = "default"),
      "r2.dev disattivato": (state) => (state.managedDomain.enabled = true),
      "nessun dominio": (state) => state.customDomains.domains.push({ domain: "log.example" }),
      "lifecycle a 90 giorni": (state) =>
        (state.lifecycle.rules[0].deleteObjectsTransition.condition.maxAge = 86_400),
      "un solo job verso il bucket": (state) =>
        state.jobs.push({ ...state.jobs[1], id: 9, name: "copia" }),
      "job attivo": (state) => (state.jobs[1].enabled = false),
      "filtro sul Worker dell'ambiente": (state) =>
        (state.jobs[1].filter = state.jobs[1].filter.replace("fiscalbay-test", "fiscalbay")),
      "campi ammessi": (state) =>
        (state.jobs[1].output_options = {
          ...state.jobs[1].output_options,
          field_names: [...exportedFields, "Event"],
        }),
      "campionamento completo": (state) =>
        (state.jobs[1].output_options = { ...state.jobs[1].output_options, sample_rate: 0.1 }),
      "endpoint UE": (state) =>
        (state.jobs[1].destination_conf = state.jobs[1].destination_conf.replace(".eu.", ".")),
      "job senza errori": (state) =>
        Object.assign(state.jobs[1], {
          last_error: "2026-10-29T10:06:00Z",
          error_message: "access denied",
        }),
      "Worker con Logpush": (state) => (state.worker.logpush = false),
    };
    for (const [check, change] of Object.entries(cases)) {
      const state = configured();
      change(state);
      const result = checkReadback(target, state);
      assert.equal(result.ok, false, check);
      assert.equal(result.checks[check], false, check);
    }
    assert.equal(checkReadback(target, { jobs: [] }).ok, false);
    const recovered = configured();
    Object.assign(recovered.jobs[1], { last_error: "2026-10-29T10:00:00Z", error_message: "x" });
    assert.equal(checkReadback(target, recovered).checks["job senza errori"], true);
  });

  it("legge oggetti NDJSON compressi e non compressi", () => {
    const text = `${JSON.stringify(record())}\n\n${JSON.stringify(record({ Outcome: "exception" }))}\nnon json\n`;
    for (const bytes of [Buffer.from(text), gzipSync(text)]) {
      const records = parseObject(bytes);
      assert.equal(records.length, 3);
      assert.equal(records[1].Outcome, "exception");
      assert.deepEqual(records[2], { invalid: true });
    }
  });

  it("riconosce soltanto i messaggi applicativi degli elenchi chiusi", () => {
    assert.deepEqual(
      applicationEvent(failure({ operation: "route", correlationId: correlation, status: 503 })),
      {
        event: "application_error",
        code: "INTERNAL_ERROR",
        operation: "route",
        correlationId: correlation,
        status: 503,
      },
    );
    assert.deepEqual(applicationEvent(message({ event: "phase", phase: "loader" })), {
      event: "phase",
      phase: "loader",
    });
    const refused = [
      failure({ email: "venditore@example.invalid" }),
      message({ event: "sconosciuto" }),
      failure({ operation: "https://test.fiscalbay.it/app?ordine=1" }),
      failure({ operation: "a".repeat(65) }),
      failure({ operation: { nested: true } }),
      { Level: "log", Message: ["Errore: venditore@example.invalid"] },
      { Level: "log", Message: [JSON.stringify({ event: "phase" }), "altro"] },
      { Level: "log", Message: [JSON.stringify(["application_error"])] },
    ];
    for (const entry of refused) assert.equal(applicationEvent(entry), null, JSON.stringify(entry));
  });

  it("verifica allowlist e Worker di ogni record esportato senza riportarne il contenuto", () => {
    const valid = [
      record({ Logs: [failure({ operation: "route", correlationId: correlation })] }),
      record({
        EventType: "queue",
        Logs: [
          {
            Level: "error",
            Message: ['{"event":"application_er<<<Logpush: log messages truncated>>>'],
          },
          { Level: "log", Message: ["<<<Logpush: logs truncated>>>"] },
        ],
      }),
    ];
    assert.deepEqual(verifyRecords(valid, "fiscalbay-test"), {
      ok: true,
      records: 2,
      scripts: { "fiscalbay-test": 2 },
      events: { application_error: 1 },
      problems: {},
    });
    const result = verifyRecords(
      [
        ...valid,
        record({ Event: { Request: { URL: "https://test.fiscalbay.it/?q=1" } } }),
        record({ Exceptions: [{ Name: "Error", Message: "venditore@example.invalid" }] }),
        record({ ScriptName: "cf-ready" }),
        record({
          Logs: [
            { Level: "warn", Message: ["testo libero"] },
            { Level: "log", Message: ["venditore@example.invalid<<<Logpush: logs truncated>>>"] },
          ],
        }),
        { invalid: true },
      ],
      "fiscalbay-test",
    );
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, {
      "altro Worker": 1,
      "campo Event": 1,
      "campo Exceptions": 1,
      "messaggio fuori allowlist": 2,
      "riga illeggibile": 1,
    });
    assert.doesNotMatch(JSON.stringify(result), /venditore|testo libero|q=1/u);
    assert.equal(verifyRecords([], "fiscalbay-test").ok, false);
  });

  it("conta gli errori per codice, operazione e guasto, anche dei soli webhook", () => {
    const records = [
      record({ Logs: [failure({ operation: "route" }), failure({ operation: "route" })] }),
      record({
        Logs: [
          failure({
            code: "UPSTREAM_UNAVAILABLE",
            operation: "webhook_consumer",
            failure: "rate_limited",
          }),
          message({ event: "stale_order_observation", count: 1 }),
        ],
      }),
      record({ Logs: [failure({ operation: "stripe_webhook" })] }),
    ];
    assert.deepEqual(errorsByCode(records), {
      "INTERNAL_ERROR route": 2,
      "INTERNAL_ERROR stripe_webhook": 1,
      "UPSTREAM_UNAVAILABLE webhook_consumer rate_limited": 1,
    });
    assert.deepEqual(errorsByCode(records, webhookOperations), {
      "INTERNAL_ERROR stripe_webhook": 1,
      "UPSTREAM_UNAVAILABLE webhook_consumer rate_limited": 1,
    });
  });

  it("conta le invocazioni non riuscite per tipo, esito e versione", () => {
    assert.deepEqual(
      failedInvocations([
        record(),
        record({ EventType: "queue", Outcome: "exception" }),
        record({ EventType: "queue", Outcome: "exception" }),
        record({ EventType: "scheduled", Outcome: "canceled", ScriptVersion: undefined }),
        { invalid: true },
      ]),
      { "queue exception v1": 2, "scheduled canceled -": 1 },
    );
  });

  it("ricostruisce le invocazioni di un correlation ID in ordine di tempo", () => {
    const trail = correlationTrail(
      [
        record({
          EventTimestampMs: Date.parse("2026-10-29T10:02:00Z"),
          Logs: [failure({ operation: "checkout", correlationId: correlation })],
        }),
        record({ Logs: [failure({ operation: "route", correlationId: crypto.randomUUID() })] }),
        record({
          EventTimestampMs: Date.parse("2026-10-29T10:01:00Z"),
          Outcome: "exception",
          Logs: [failure({ operation: "route", correlationId: correlation })],
        }),
      ],
      correlation,
    );
    assert.deepEqual(
      trail.map(({ at, outcome, events }) => [at, outcome, events[0].operation]),
      [
        ["2026-10-29T10:01:00.000Z", "exception", "route"],
        ["2026-10-29T10:02:00.000Z", "ok", "checkout"],
      ],
    );
    assert.ok(trail.every(({ events }) => events.every((event) => !("correlationId" in event))));
  });

  it("legge le sottocartelle giornaliere UTC dalla più recente", () => {
    assert.deepEqual(dayPrefixes(3, new Date("2026-11-01T00:30:00Z")), [
      "20261101/",
      "20261031/",
      "20261030/",
    ]);
  });

  it("scrive i log del Worker soltanto dal modulo con gli elenchi chiusi", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const sources = ["app", "workers"].flatMap((folder) =>
      readdirSync(path.join(root, folder), { recursive: true })
        .filter((file) => /\.tsx?$/u.test(file))
        .map((file) => path.join(folder, file)),
    );
    const writers = sources.filter((file) =>
      /\bconsole(?:\.(?:log|info|warn|error|debug|trace)\(|\[)/u.test(
        readFileSync(path.join(root, file), "utf8"),
      ),
    );
    assert.deepEqual(writers, [path.join("app", "log-records.ts")]);
  });
});
