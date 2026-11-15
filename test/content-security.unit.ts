import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentSecurityPolicy,
  documentSecurityHeaders,
  reportOnlyPolicy,
  scriptNonce,
} from "../app/content-security.server";
import { cspViolations, logCspViolations, maxViolationsPerReport } from "../app/csp-report.server";
import { speculationRules } from "../app/speculation-rules";

const directivesOf = (policy: string) =>
  new Map(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name!, sources] as const;
    }),
  );

describe("CSP dei documenti", () => {
  it("genera un nonce diverso per ogni risposta, di 128 bit", () => {
    const nonces = new Set(Array.from({ length: 100 }, scriptNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });

  it("esegue soltanto gli script con il nonce e quelli che caricano, senza inclusione in frame", () => {
    const directives = directivesOf(contentSecurityPolicy("bm9uY2U="));
    // `https:` vale soltanto nei browser senza `'strict-dynamic'`; nessun host in elenco.
    expect(directives.get("script-src")).toEqual([
      "'nonce-bm9uY2U='",
      "'strict-dynamic'",
      "'report-sample'",
      "https:",
    ]);
    // Il solo frame ammesso è il widget Turnstile.
    expect(directives.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("connect-src")).toEqual(["'self'", "https://cloudflareinsights.com"]);
    for (const name of ["object-src", "base-uri", "frame-ancestors"])
      expect(directives.get(name), name).toEqual(["'none'"]);
    // Immagini: origine, segnaposto `data:` dell'anteprima e i soli host eBay qualificati.
    expect(directives.get("img-src")).toEqual([
      "'self'",
      "data:",
      "https://i.ebayimg.com",
      "https://i.ebayimg.sandbox.ebay.com",
    ]);
    expect([...directives.values()].flat()).not.toContain("'unsafe-eval'");
    expect(directives.get("report-uri")).toEqual(["/api/v1/csp-report"]);
    expect(directives.get("report-to")).toEqual(["csp"]);
  });

  it("osserva Trusted Types senza bloccare e invia le segnalazioni all'endpoint dell'origine", () => {
    expect(directivesOf(reportOnlyPolicy())).toEqual(
      new Map([
        ["require-trusted-types-for", ["'script'"]],
        ["report-uri", ["/api/v1/csp-report"]],
        ["report-to", ["csp"]],
      ]),
    );
    expect(documentSecurityHeaders("bm9uY2U=")).toEqual({
      "Content-Security-Policy": contentSecurityPolicy("bm9uY2U="),
      "Content-Security-Policy-Report-Only": reportOnlyPolicy(),
      "Reporting-Endpoints": 'csp="/api/v1/csp-report"',
    });
  });
});

describe("segnalazioni CSP", () => {
  const origin = "https://fiscalbay.it";
  const violation = (body: Record<string, unknown>) => ({
    type: "csp-violation",
    age: 10,
    url: `${origin}/app/ordini/ord-1`,
    user_agent: "Mozilla/5.0",
    body: {
      documentURL: `${origin}/en/app/orders/ord-1?q=giulia`,
      effectiveDirective: "script-src-elem",
      blockedURL: "https://script-estraneo.invalid/x.js?token=1",
      disposition: "enforce",
      originalPolicy: "script-src 'none'",
      sourceFile: `${origin}/assets/entry-abc.js`,
      lineNumber: 12,
      columnNumber: 4,
      sample: "",
      statusCode: 200,
      ...body,
    },
  });

  afterEach(() => vi.restoreAllMocks());

  it("riduce indirizzi e campioni a origini, percorsi brevi e parole chiave", () => {
    expect(cspViolations([violation({})], origin)).toEqual([
      {
        directive: "script-src-elem",
        disposition: "enforce",
        blocked: "https://script-estraneo.invalid",
        page: "/app/ordini",
        source: "/assets/entry-abc.js",
        line: 12,
        column: 4,
        sample: undefined,
      },
    ]);
    // Trusted Types: soltanto il punto del DOM, mai il valore scritto.
    expect(
      cspViolations(
        [
          violation({
            effectiveDirective: "require-trusted-types-for",
            blockedURL: "trusted-types-sink",
            disposition: "report",
            sample: "Element innerHTML|<b>Giulia Rossi</b>",
          }),
        ],
        origin,
      )[0],
    ).toMatchObject({
      blocked: "trusted-types-sink",
      disposition: "report",
      sample: "Element innerHTML",
    });
    // I JSON dei dati strutturati e delle regole di speculazione scritti da React non contano.
    for (const sample of [
      'Element innerHTML|{"@context":"https://dati.invalid"',
      'Element innerHTML|{"prefetch":[{"source":"document"',
    ])
      expect(
        cspViolations(
          [
            violation({
              effectiveDirective: "require-trusted-types-for",
              blockedURL: "trusted-types-sink",
              disposition: "report",
              sample,
            }),
          ],
          origin,
        ),
      ).toEqual([]);
    // Uno script inline porta i primi 40 caratteri del codice; eval nulla.
    expect(
      cspViolations([violation({ blockedURL: "inline", sample: "x".repeat(60) })], origin)[0]
        ?.sample,
    ).toBe("x".repeat(40));
    expect(
      cspViolations([violation({ blockedURL: "eval", sample: "segreto()" })], origin)[0]?.sample,
    ).toBeUndefined();
  });

  it("legge il formato di report-uri e scarta documenti di altre origini e lotti troppo lunghi", () => {
    expect(
      cspViolations(
        {
          "csp-report": {
            "document-uri": `${origin}/prezzi`,
            "violated-directive": "script-src-elem",
            "blocked-uri": "",
            "line-number": 3,
          },
        },
        origin,
      ),
    ).toEqual([
      expect.objectContaining({
        directive: "script-src-elem",
        blocked: "inline",
        page: "/prezzi",
        line: 3,
      }),
    ]);
    expect(
      cspViolations([violation({ documentURL: "https://altro-sito.invalid/" })], origin),
    ).toEqual([]);
    expect(cspViolations([{ type: "deprecation", body: {} }, "x", null], origin)).toEqual([]);
    expect(cspViolations({ altro: 1 }, origin)).toEqual([]);
    expect(
      cspViolations(
        Array.from({ length: 20 }, () => violation({})),
        origin,
      ),
    ).toHaveLength(maxViolationsPerReport);
  });

  it("registra una riga per violazione con le sole chiavi ammesse", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    logCspViolations(cspViolations([violation({}), violation({ lineNumber: -1 })], origin));
    expect(log.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
      {
        event: "csp_violation",
        directive: "script-src-elem",
        disposition: "enforce",
        blocked: "https://script-estraneo.invalid",
        page: "/app/ordini",
        source: "/assets/entry-abc.js",
        line: 12,
        column: 4,
      },
      {
        event: "csp_violation",
        directive: "script-src-elem",
        disposition: "enforce",
        blocked: "https://script-estraneo.invalid",
        page: "/app/ordini",
        source: "/assets/entry-abc.js",
        column: 4,
      },
    ]);
  });
});

describe("regole di speculazione delle pagine pubbliche", () => {
  const patterns = (signedIn: boolean) => {
    const rules = JSON.parse(speculationRules(signedIn)) as {
      prefetch: Array<{
        eagerness: string;
        where: { and: Array<{ href_matches?: string; not?: { href_matches: string } }> };
      }>;
    };
    const [rule] = rules.prefetch;
    expect(rule?.eagerness).toBe("moderate");
    return rule!.where.and.flatMap((condition) =>
      condition.not ? [condition.not.href_matches] : [],
    );
  };

  it("esclude le sezioni private nelle due lingue e, con la sessione, la home", () => {
    const anonymous = patterns(false);
    for (const path of [
      "/app",
      "/app/*",
      "/en/app/*",
      "/accesso",
      "/en/sign-in/*",
      "/admin/*",
      "/en/admin/*",
      "/api/*",
      "/en/api/*",
      "/anteprima/*",
      "/en/preview/*",
      "/auth/error",
      "/en/auth/error",
    ])
      expect(anonymous, path).toContain(path);
    expect(anonymous).toContain("/*\\?*(^|&)visita=*");
    expect(anonymous).not.toContain("/");
    expect(patterns(true)).toEqual(expect.arrayContaining(["/", "/en"]));
    // Le regole viaggiano in ogni pagina pubblica: restano piccole.
    expect(speculationRules(true).length).toBeLessThan(1500);
  });
});
