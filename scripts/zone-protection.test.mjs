import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alertEmail,
  authRule,
  checkReadback,
  contains,
  desiredRules,
  dmarcTag,
  dmarcWithReports,
  headerRule,
  mergeRules,
  phases,
  plan,
  probeRule,
  removeRules,
  targetOf,
  webhookRule,
  writableRule,
} from "./zone-protection.mjs";

const target = targetOf();
const live = targetOf("live");
const prefix = "4cdebd31f45f4d94b2623834adce9912";
const dmarc = "v=DMARC1; p=quarantine; adkim=r; aspf=r";
const withReports = `${dmarc}; rua=mailto:${prefix}@dmarc-reports.cloudflare.net`;

const secured = (overrides = {}) => ({
  "strict-transport-security": `max-age=${target.maxAge}`,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  ...overrides,
});

/** Stato del provider e risposte reali come li rilegge `apply`, configurati come previsto. */
const configured = () => {
  const rules = desiredRules(target);
  // Il provider aggiunge identificativi e valori predefiniti alle regole scritte.
  const stored = (rule) => ({ id: `id-${rule.ref}`, version: "2", ...rule });
  return {
    rulesets: Object.fromEntries(
      phases.map((phase) => [
        phase,
        {
          rules: [
            { ref: "regola-manuale", expression: "true", action: "log" },
            ...rules[phase].map(stored),
          ],
        },
      ]),
    ),
    zone: { plan: { legacy_id: "free" } },
    dnssec: { status: "active" },
    settings: {
      always_use_https: "on",
      min_tls_version: "1.2",
      security_header: { strict_transport_security: { enabled: false } },
    },
    botManagement: { fight_mode: false },
    ctAlerting: { enabled: true, emails: [alertEmail] },
    dmarcReports: { enabled: true, rua_prefix: prefix },
    dns: [
      { type: "TXT", name: "_dmarc.fiscalbay.it", content: `"${withReports}"` },
      { type: "TXT", name: "_dmarc.auth.fiscalbay.it", content: '"v=DMARC1; p=reject;"' },
      { type: "TXT", name: "fiscalbay.it", content: '"v=spf1 include:icloud.com ~all"' },
      {
        type: "TXT",
        name: "cf-bounce.fiscalbay.it",
        content: '"v=spf1 include:_spf.mx.cloudflare.net ~all"',
      },
      { type: "MX", name: "fiscalbay.it", content: "mx02.mail.icloud.com" },
      { type: "MX", name: "fiscalbay.it", content: "mx01.mail.icloud.com" },
      { type: "MX", name: "cf-bounce.fiscalbay.it", content: "route1.mx.cloudflare.net" },
    ],
    responses: {
      page: {
        status: 200,
        headers: secured({
          "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
          "cache-control": "no-store",
        }),
      },
      asset: { status: 200, headers: secured() },
      missing: { status: 404, headers: secured() },
      probe: { status: 403, headers: {} },
      webhook: { status: 412, headers: secured() },
      http: {
        status: 301,
        headers: { location: "https://test.fiscalbay.it/percorso?q=1" },
      },
    },
  };
};

describe("protezioni della zona", () => {
  it("legge zona, host e prefisso delle regole dalla configurazione", () => {
    assert.equal(target.zone, "fiscalbay.it");
    assert.deepEqual(target.hosts, ["test.fiscalbay.it"]);
    assert.equal(target.origin, "https://test.fiscalbay.it");
    assert.deepEqual(live.hosts, ["fiscalbay.it", "www.fiscalbay.it"]);
    // Nessun prefisso contiene l'altro: un ambiente non tocca mai le regole dell'altro.
    assert.ok(!target.prefix.startsWith(live.prefix) && !live.prefix.startsWith(target.prefix));
    assert.ok(!authRule().ref.startsWith(target.prefix) && !authRule().ref.startsWith(live.prefix));
  });

  it("limita header e HSTS agli host dell'ambiente, senza sottodomini né preload", () => {
    const rule = headerRule(target);
    assert.equal(rule.expression, 'http.host in {"test.fiscalbay.it"}');
    const hsts = rule.action_parameters.headers["strict-transport-security"].value;
    assert.equal(hsts, "max-age=86400");
    assert.doesNotMatch(hsts, /includeSubDomains|preload/u);
    assert.equal(
      headerRule(live).action_parameters.headers["strict-transport-security"].value,
      "max-age=300",
    );
    assert.equal(rule.action_parameters.headers["x-frame-options"].value, "DENY");
    assert.ok(!("content-security-policy" in rule.action_parameters.headers));
  });

  it("esenta dai controlli da browser soltanto i percorsi esatti dei webhook", () => {
    const rule = webhookRule(target);
    assert.equal(rule.action, "skip");
    assert.deepEqual(rule.action_parameters, { products: ["bic", "securityLevel"] });
    assert.match(rule.expression, /^http\.host in \{"test\.fiscalbay\.it"\} and /u);
    for (const path of [
      "/webhooks/ebay",
      "/webhooks/ebay/sandbox",
      "/webhooks/stripe",
      "/webhooks/telegram",
    ])
      assert.ok(rule.expression.includes(`"${path}"`), path);
    assert.doesNotMatch(rule.expression, /starts_with|contains/u);
  });

  it("blocca le sonde osservate senza toccare /.well-known/", () => {
    const { expression, action } = probeRule(target);
    assert.equal(action, "block");
    assert.match(expression, /lower\(http\.request\.uri\.path\) contains "\/\."/u);
    assert.match(
      expression,
      /not starts_with\(lower\(http\.request\.uri\.path\), "\/\.well-known\/"\)/u,
    );
    for (const probe of ['".php"', '".env"', '"/wp-"', '"/appsettings"'])
      assert.ok(expression.includes(probe), probe);
    // Le esportazioni e i dati delle route non hanno estensioni bloccate.
    assert.doesNotMatch(expression, /"\.(?:zip|csv|data|json|js|css)"/u);
  });

  it("conta per IP le raffiche verso gli endpoint di accesso con i limiti del Free", () => {
    const rule = authRule();
    assert.equal(rule.expression, 'starts_with(http.request.uri.path, "/api/auth/")');
    assert.deepEqual(rule.ratelimit, {
      characteristics: ["cf.colo.id", "ip.src"],
      period: 10,
      requests_per_period: 30,
      mitigation_timeout: 10,
    });
  });

  it("sostituisce le regole dell'ambiente e conserva quelle degli altri", () => {
    const desired = desiredRules(target).http_request_firewall_custom;
    const existing = [
      { id: "1", ref: "fiscalbay-live-probes", expression: "x", action: "block", version: "3" },
      { id: "2", ref: "fiscalbay-test-probes", expression: "vecchia", action: "block" },
      { id: "3", ref: "fiscalbay-test-dismessa", expression: "y", action: "block" },
      { id: "4", expression: "z", action: "log", description: "manuale" },
    ];
    const merged = mergeRules(existing, desired, target);
    assert.deepEqual(
      merged.map((rule) => rule.ref),
      ["fiscalbay-live-probes", "fiscalbay-test-probes", undefined, "fiscalbay-test-webhooks"],
    );
    assert.equal(merged[1].expression, probeRule(target).expression);
    // Le regole conservate perdono i campi di sola lettura.
    assert.deepEqual(merged[0], { ref: "fiscalbay-live-probes", expression: "x", action: "block" });
    assert.deepEqual(merged[2], { expression: "z", action: "log", description: "manuale" });
    assert.deepEqual(mergeRules(null, desired, target), desired);
  });

  it("toglie le regole dell'ambiente e lascia quella di zona finché l'altro la usa", () => {
    const shared = { id: "9", ...authRule() };
    const others = [{ id: "1", ref: "fiscalbay-live-headers", action: "rewrite", expression: "x" }];
    assert.deepEqual(removeRules([...others, headerRule(target), shared], target, live.prefix), [
      writableRule(others[0]),
      writableRule(shared),
    ]);
    assert.deepEqual(removeRules([headerRule(target), shared], target, live.prefix), []);
  });

  it("aggiunge l'indirizzo dei report al record DMARC e conserva la policy", () => {
    assert.equal(dmarcWithReports(dmarc, prefix), withReports);
    assert.equal(dmarcWithReports(`"${dmarc}"`, prefix), withReports);
    assert.equal(dmarcWithReports(withReports, prefix), withReports);
    assert.equal(
      dmarcWithReports("v=DMARC1; p=none; rua=mailto:owner@example.org", prefix),
      `v=DMARC1; p=none; rua=mailto:owner@example.org,mailto:${prefix}@dmarc-reports.cloudflare.net`,
    );
    assert.equal(dmarcTag(`"${withReports}"`, "p"), "quarantine");
    assert.equal(dmarcTag(withReports, "rua"), `mailto:${prefix}@dmarc-reports.cloudflare.net`);
    assert.equal(dmarcTag(undefined, "p"), undefined);
  });

  it("confronta le regole lette con quelle scritte ammettendo i valori predefiniti", () => {
    const rule = authRule();
    const stored = {
      ...rule,
      id: "x",
      ratelimit: { ...rule.ratelimit, requests_to_origin: false },
    };
    assert.ok(contains(stored, rule));
    assert.ok(!contains({ ...stored, ratelimit: { ...stored.ratelimit, period: 60 } }, rule));
    assert.ok(
      !contains({ ...rule, action_parameters: { products: ["bic"] } }, webhookRule(target)),
    );
  });

  it("descrive il piano senza scrivere", () => {
    const described = plan(target);
    assert.deepEqual(described.ctAlerting, { enabled: true, emails: [alertEmail] });
    assert.deepEqual(Object.keys(described.rules), phases);
    assert.equal(described.hsts.current, 86_400);
  });

  it("accetta il readback configurato", () => {
    const result = checkReadback(target, configured());
    assert.equal(result.ok, true, JSON.stringify(result.checks));
    assert.ok(!("www verso l'apice con percorso e query" in result.checks));
  });

  it("controlla il reindirizzamento di www e la raffica soltanto quando previsti", () => {
    const state = configured();
    state.responses.www = {
      status: 301,
      headers: { location: "https://fiscalbay.it/percorso?q=1" },
    };
    state.responses.http.headers.location = "https://fiscalbay.it/percorso?q=1";
    const liveState = {
      ...state,
      rulesets: Object.fromEntries(
        phases.map((phase) => [phase, { rules: desiredRules(live)[phase] }]),
      ),
    };
    for (const name of ["page", "asset", "missing"])
      liveState.responses[name].headers["strict-transport-security"] = "max-age=300";
    const result = checkReadback(live, liveState);
    assert.equal(result.ok, true, JSON.stringify(result.checks));
    liveState.responses.www.headers.location = "https://fiscalbay.it/";
    assert.equal(
      checkReadback(live, liveState).checks["www verso l'apice con percorso e query"],
      false,
    );

    const burst = configured();
    burst.responses.burst = { first: 404, limited: true, requests: 31 };
    assert.equal(checkReadback(target, burst).ok, true);
    burst.responses.burst.limited = false;
    assert.equal(checkReadback(target, burst).checks["raffica di accessi limitata"], false);
  });

  it("rifiuta un readback diverso dalla configurazione prevista", () => {
    const rule = (state, phase, ref) =>
      state.rulesets[phase].rules.find((candidate) => candidate.ref === ref);
    const cases = {
      "regola fiscalbay-test-webhooks": (state) =>
        (rule(state, "http_request_firewall_custom", "fiscalbay-test-webhooks").enabled = false),
      "regola fiscalbay-test-probes": (state) =>
        state.rulesets.http_request_firewall_custom.rules.push(
          rule(state, "http_request_firewall_custom", "fiscalbay-test-probes"),
        ),
      "regola fiscalbay-auth-burst": (state) => (state.rulesets.http_ratelimit = null),
      "regola fiscalbay-test-headers": (state) =>
        (rule(state, "http_response_headers_transform", "fiscalbay-test-headers").expression =
          "true"),
      "piano della zona invariato": (state) => (state.zone.plan.legacy_id = "pro"),
      "DNSSEC attivo": (state) => (state.dnssec.status = "pending"),
      "HTTPS sempre": (state) => (state.settings.always_use_https = "off"),
      "TLS 1.2 minimo": (state) => (state.settings.min_tls_version = "1.0"),
      "HSTS di zona senza sottodomini né preload": (state) =>
        (state.settings.security_header.strict_transport_security.include_subdomains = true),
      "Bot Fight Mode spento": (state) => (state.botManagement.fight_mode = true),
      "alert dei certificati": (state) => (state.ctAlerting.emails = ["altro@example.org"]),
      "DMARC Management attivo": (state) => (state.dmarcReports.enabled = false),
      "un solo record DMARC con i report": (state) => (state.dns[0].content = `"${dmarc}"`),
      "policy DMARC conservata": (state) =>
        (state.dns[0].content = withReports.replace("quarantine", "none")),
      "un solo SPF per nome": (state) =>
        state.dns.push({ type: "TXT", name: "fiscalbay.it", content: '"v=spf1 -all"' }),
      "MX iCloud conservati": (state) => state.dns.splice(4, 1),
      "pagina con header e CSP": (state) =>
        delete state.responses.page.headers["content-security-policy"],
      "asset con header": (state) =>
        (state.responses.asset.headers["strict-transport-security"] = "max-age=31536000"),
      "pagina assente con header": (state) =>
        delete state.responses.missing.headers["x-frame-options"],
      "sonda bloccata dalla zona": (state) => (state.responses.probe.status = 404),
      "webhook invalido rifiutato dal Worker": (state) =>
        (state.responses.webhook.headers["cf-mitigated"] = "challenge"),
      "HTTP verso HTTPS con percorso e query": (state) =>
        (state.responses.http.headers.location = "https://test.fiscalbay.it/"),
    };
    for (const [check, change] of Object.entries(cases)) {
      const state = configured();
      change(state);
      const result = checkReadback(target, state);
      assert.equal(result.ok, false, check);
      assert.equal(result.checks[check], false, check);
    }
  });
});
