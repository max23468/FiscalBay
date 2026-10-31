import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkResources,
  checkSurface,
  exportsMaxAge,
  ownerItems,
  plan,
  queueRetention,
  report,
  runStep,
  scriptSteps,
  sitemapPaths,
  surfacePaths,
  targetOf,
} from "./go-live.mjs";

const test = targetOf("test");
const live = targetOf("live");

/** Stato della CLI con le risorse dell'ambiente configurate come in RELEASE. */
function resources(target) {
  const queue = (name, consumers = []) => ({
    queue_name: name,
    jurisdiction: "eu",
    settings: { message_retention_period: queueRetention },
    consumers,
    producers: consumers.length ? [{ script: target.worker, type: "worker" }] : [],
  });
  const transition = { condition: { type: "Age", maxAge: exportsMaxAge } };
  return {
    workers: [
      { name: target.worker, references: { domains: [{ hostname: target.domain }] } },
      { name: "altro", references: { domains: [] } },
    ],
    secrets: [...target.secrets],
    database: { jurisdiction: "eu" },
    queues: [
      queue(target.queue.name, [
        {
          script: target.worker,
          dead_letter_queue: target.queue.deadLetterQueue,
          settings: { batch_size: 1, max_retries: 5, max_concurrency: 5 },
        },
      ]),
      queue(target.queue.deadLetterQueue),
    ],
    bucket: { jurisdiction: "eu" },
    lifecycle: {
      rules: [
        {
          id: "file-scaduti",
          enabled: true,
          conditions: { prefix: "" },
          deleteObjectsTransition: transition,
          abortMultipartUploadsTransition: transition,
        },
      ],
    },
    managedDomain: { enabled: false },
    customDomains: { domains: [] },
    widgets: [{ name: target.turnstile, mode: "managed", domains: [target.domain] }],
    registry: { rows: [{ name: "EBAY_CLIENT_SECRET", state: "never" }], missing: [] },
    github: {
      environment: {
        protection_rules: target.live
          ? [
              {
                type: "required_reviewers",
                reviewers: [{ type: "User", reviewer: { login: "owner" } }],
              },
            ]
          : [],
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      },
      branches: [target.github.branch],
      variables: [
        { name: "CLOUDFLARE_ACCOUNT_ID", value: "account" },
        ...(target.live ? [{ name: "PRODUCTION_PUBLISH_ENABLED", value: "true" }] : []),
      ],
      secrets: ["CLOUDFLARE_API_TOKEN"],
    },
  };
}

const failing = (results) => results.filter(({ ok }) => !ok).map(({ item }) => item);

describe("ambiente", () => {
  it("legge Worker, coda, bucket e segreti da cloudflare.config.ts", () => {
    assert.equal(live.worker, "fiscalbay");
    assert.equal(live.domain, "fiscalbay.it");
    assert.equal(live.origin, "https://fiscalbay.it");
    assert.equal(live.queue.deadLetterQueue, "fiscalbay-webhooks-failed");
    assert.equal(live.exports, "fiscalbay-exports");
    assert.equal(test.worker, "fiscalbay-test");
    assert.ok(live.secrets.includes("STRIPE_WEBHOOK_SECRET"));
    assert.ok(!live.secrets.includes("EBAY_SANDBOX_CLIENT_ID"));
    assert.ok(test.secrets.includes("EBAY_SANDBOX_CLIENT_ID"));
  });

  it("passa la modalità live agli script e il profilo sandbox di Stripe al test", () => {
    const [stripe] = scriptSteps(live);
    assert.deepEqual(stripe.args, ["scripts/stripe-account.mjs", "--mode", "live"]);
    assert.deepEqual(scriptSteps(test)[0].args, [
      "scripts/stripe-account.mjs",
      "--project-name",
      "fiscalbay-sandbox",
    ]);
    assert.ok(scriptSteps(live).every(({ phase }) => ["prima", "dopo"].includes(phase)));
    // Prima del deploy la pagina provvisoria non ha Logpush: l'archivio si rilegge dopo.
    const archive = scriptSteps(live).find(({ args }) => args[0] === "scripts/log-archive.mjs");
    assert.equal(archive.phase, "dopo");
  });
});

describe("risorse", () => {
  it("passa con le risorse configurate, prima e dopo il deploy", () => {
    assert.deepEqual(failing(checkResources(live, resources(live), "prima")), []);
    const after = checkResources(live, resources(live), "dopo");
    assert.deepEqual(failing(after), []);
    assert.equal(after.length, checkResources(live, resources(live), "prima").length + 1);
  });

  it("richiede l'ambiente GitHub della pubblicazione con approvazione e interruttore", () => {
    assert.deepEqual(failing(checkResources(test, resources(test), "prima")), []);
    const state = resources(live);
    state.github.environment.protection_rules = [];
    state.github.branches = ["main", "develop"];
    state.github.variables = [{ name: "PRODUCTION_PUBLISH_ENABLED", value: "false" }];
    const results = checkResources(live, state, "prima").filter(({ area }) => area === "Rollback");
    assert.deepEqual(failing(results), [
      "ambiente GitHub production soltanto per main con l'approvazione dell'owner",
      "account, token e interruttore nell'ambiente production",
    ]);
    assert.equal(results[1].detail, "mancano CLOUDFLARE_ACCOUNT_ID");
    // Un ambiente assente non passa, anche con le altre risorse configurate.
    assert.equal(
      failing(checkResources(live, { ...resources(live), github: {} }, "prima")).length,
      2,
    );
  });

  it("elenca i segreti mancanti senza valori", () => {
    const state = { ...resources(live), secrets: ["BETTER_AUTH_SECRET"] };
    const result = checkResources(live, state, "prima").find(({ area }) => area === "Auth");
    assert.equal(result.ok, false);
    assert.match(result.detail, /^mancano .*STRIPE_SECRET_KEY/u);
    assert.doesNotMatch(result.detail, /BETTER_AUTH_SECRET/u);
  });

  it("non passa con risorse assenti o lette senza esito", () => {
    const results = checkResources(live, { registry: { rows: [], missing: [] } }, "dopo");
    assert.deepEqual(
      results.filter(({ ok }) => ok).map(({ item }) => item),
      ["registro delle scadenze senza voci scadute, in scadenza o senza data"],
    );
  });

  it("rifiuta coda fuori UE o con altra retention, bucket pubblico e regola diversa", () => {
    const state = resources(live);
    state.queues[0].settings.message_retention_period = 345_600;
    state.queues[1].jurisdiction = undefined;
    state.managedDomain = { enabled: true };
    state.lifecycle.rules[0].deleteObjectsTransition = { condition: { maxAge: 7 * 86_400 } };
    state.widgets[0].domains = ["fiscalbay.it", "test.fiscalbay.it"];
    assert.deepEqual(failing(checkResources(live, state, "prima")), [
      "coda fiscalbay-webhooks in UE a 14 giorni",
      "coda fiscalbay-webhooks-failed in UE a 14 giorni",
      "bucket fiscalbay-exports in UE senza accesso pubblico",
      "file esportati eliminati dopo un giorno",
      "widget Turnstile gestito sul solo fiscalbay.it",
    ]);
  });

  it("segnala voci del registro da completare e un registro illeggibile", () => {
    const pending = {
      ...resources(live),
      registry: {
        rows: [
          { name: "STRIPE_SECRET_KEY", state: "expiring" },
          { name: "EBAY_RUNAME", state: "never" },
        ],
        missing: ["TURNSTILE_SITE_KEY"],
      },
    };
    const registry = (state) =>
      checkResources(live, state, "prima").find(({ item }) => item.startsWith("registro"));
    assert.deepEqual(
      { ok: registry(pending).ok, detail: registry(pending).detail },
      { ok: false, detail: "STRIPE_SECRET_KEY, TURNSTILE_SITE_KEY" },
    );
    const broken = { ...resources(live), registry: { rows: [], missing: [], error: "assente" } };
    assert.deepEqual(
      { ok: registry(broken).ok, detail: registry(broken).detail },
      { ok: false, detail: "assente" },
    );
  });

  it("dopo il deploy richiede consumer con coda dei falliti e produttore", () => {
    const state = resources(live);
    state.queues[0].consumers[0].settings.max_retries = 3;
    assert.deepEqual(failing(checkResources(live, state, "dopo")), [
      "consumer della coda con retry e coda dei falliti",
    ]);
    state.queues[0].consumers[0].settings.max_retries = 5;
    state.queues[0].producers = [];
    assert.equal(failing(checkResources(live, state, "dopo")).length, 1);
  });
});

/** Risposte della superficie pubblica come le serve il Worker dell'ambiente. */
function surface(target) {
  const pages = ["/", "/funzionalita", "/prezzi"].flatMap((page) => [
    page,
    page === "/" ? "/en" : `/en${page}`,
  ]);
  const robots = target.live
    ? { "x-fiscalbay-version": "v1" }
    : { "x-robots-tag": "noindex, nofollow", "x-fiscalbay-version": "v1" };
  const noindex = { "x-robots-tag": "noindex, nofollow" };
  return {
    robots: {
      status: 200,
      body: target.live
        ? "User-agent: *\nDisallow: /app/\nDisallow: /accesso\nDisallow: /admin\nDisallow: /api/\nDisallow: /en/app/\n\nSitemap: https://fiscalbay.it/sitemap.xml\n"
        : "User-agent: *\nDisallow: /\n",
    },
    sitemap: {
      status: 200,
      body: pages.map((page) => `<url><loc>${target.origin}${page}</loc></url>`).join("\n"),
    },
    pages: {
      ...Object.fromEntries(pages.map((page) => [page, { status: 200, headers: robots }])),
      ...Object.fromEntries(
        surfacePaths.legal.map((page) => [page, { status: 200, headers: noindex }]),
      ),
      ...Object.fromEntries(
        surfacePaths.private.map((page) => [page, { status: 302, headers: noindex }]),
      ),
      [surfacePaths.preview]: { status: target.live ? 404 : 200, headers: noindex },
    },
  };
}

describe("superficie pubblica", () => {
  it("legge dalla sitemap soltanto le pagine dell'origine", () => {
    assert.deepEqual(
      sitemapPaths(
        "https://fiscalbay.it",
        "<loc>https://fiscalbay.it/</loc><loc>https://fiscalbay.it/en/prezzi</loc><loc>https://altro.it/x</loc>",
      ),
      ["/", "/en/prezzi"],
    );
    assert.deepEqual(sitemapPaths("https://fiscalbay.it", undefined), []);
  });

  it("passa in Production con pagine indicizzabili e anteprima assente", () => {
    const results = checkSurface(live, surface(live));
    assert.deepEqual(failing(results), []);
    assert.ok(results.some(({ item }) => item === "anteprima assente"));
  });

  it("passa sul test con dominio chiuso e pagine noindex", () => {
    const results = checkSurface(test, surface(test));
    assert.deepEqual(failing(results), []);
    assert.ok(!results.some(({ item }) => item === "anteprima assente"));
  });

  it("rifiuta un noindex in Production, robots chiuso e legali indicizzabili", () => {
    const responses = surface(live);
    responses.pages["/prezzi"].headers = { "x-robots-tag": "noindex" };
    responses.robots.body = "User-agent: *\nDisallow: /\n";
    responses.pages["/privacy"].headers = {};
    responses.pages["/anteprima"].status = 200;
    assert.deepEqual(failing(checkSurface(live, responses)), [
      "robots.txt con aree private e sitemap",
      "pagine della sitemap indicizzabili",
      "Termini e Privacy raggiungibili e noindex",
      "anteprima assente",
    ]);
  });

  it("non passa con la pagina provvisoria: niente sitemap, robots o versione", () => {
    const placeholder = { status: 200, headers: {} };
    const results = checkSurface(live, {
      robots: { status: 404, body: "" },
      sitemap: { status: 404, body: "<html>" },
      pages: Object.fromEntries(
        [...surfacePaths.legal, ...surfacePaths.private, "/", "/anteprima"].map((page) => [
          page,
          placeholder,
        ]),
      ),
    });
    assert.deepEqual(failing(results), [
      "robots.txt con aree private e sitemap",
      "sitemap con home e pagine in due lingue",
      "pagine della sitemap raggiungibili",
      "pagine della sitemap indicizzabili",
      "Termini e Privacy raggiungibili e noindex",
      "accesso e area riservata noindex",
      "anteprima assente",
      "versione del Worker dichiarata nelle risposte",
    ]);
  });

  it("rifiuta Termini o Privacy nella sitemap", () => {
    const responses = surface(live);
    responses.sitemap.body += "\n<loc>https://fiscalbay.it/privacy</loc>";
    assert.deepEqual(failing(checkSurface(live, responses)), [
      "sitemap con home e pagine in due lingue",
      "pagine della sitemap indicizzabili",
    ]);
  });
});

describe("script di area e resoconto", () => {
  const step = { phase: "dopo", area: "Telegram", item: "bot", args: ["x.mjs"], needs: ["TOKEN"] };

  it("non esegue uno script senza le variabili richieste", () => {
    let called = false;
    const result = runStep(step, { env: {}, spawn: () => (called = true) });
    assert.equal(called, false);
    assert.deepEqual([result.ok, result.detail], [false, "non eseguito, servono TOKEN"]);
  });

  it("riporta esito e uscita dello script", () => {
    const calls = [];
    const spawn = (command, args) => {
      calls.push(args);
      return { status: 1, stdout: "✗ webhook\n", stderr: "" };
    };
    const result = runStep(step, { env: { TOKEN: "t" }, spawn });
    assert.deepEqual(calls, [["x.mjs"]]);
    assert.deepEqual([result.ok, result.output], [false, "✗ webhook"]);
    assert.equal(runStep(step, { env: { TOKEN: "t" }, spawn: () => ({ status: 0 }) }).ok, true);
  });

  it("segna esiti, voci da attestare e rientra l'uscita degli script", () => {
    assert.equal(
      report([
        { ok: true, area: "Dati", item: "D1" },
        { ok: false, area: "Auth", item: "segreti", detail: "mancano X" },
        { ok: null, area: "Legali", item: "DPA" },
        { ok: false, area: "eBay", item: "sottoscrizioni", output: "✓ email\n✗ destinazione" },
      ]),
      "✓ Dati · D1\n✗ Auth · segreti (mancano X)\n○ Legali · DPA\n✗ eBay · sottoscrizioni\n    ✓ email\n    ✗ destinazione",
    );
  });

  it("elenca nel piano ogni voce una volta, nella sua fase", () => {
    const text = plan(live);
    assert.match(text, /^Checklist operativa · live\nFase prima:\n/u);
    const [before, after] = text.split("Fase dopo:\n");
    assert.match(before, /segreti dichiarati sul Worker/u);
    assert.doesNotMatch(before, /consumer della coda/u);
    assert.match(after, /consumer della coda/u);
    assert.match(after, /anteprima assente/u);
    assert.match(after, /node scripts\/zone-protection\.mjs readback --mode live/u);
    for (const { item } of ownerItems) assert.equal(text.split(item).length, 2);
  });
});
