import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forwardToAuth, handleAuthRequest } from "../app/auth-route.server";

const services = vi.hoisted(() => ({
  handler: vi.fn(),
  session: vi.fn(),
  registration: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  record: vi.fn(),
  failure: vi.fn(),
  background: vi.fn(),
}));
vi.mock("../app/auth.server", () => ({
  createAuth: () => ({ handler: services.handler, api: { getSession: services.session } }),
  sessionPolicy: { freshAge: 86400 },
}));
vi.mock("../app/domain/registration.server", () => ({ registrationStatus: services.registration }));
vi.mock("../app/integrations/ebay/store-link.server", () => ({
  claimStoreLinkSession: services.claim,
  completeStoreLink: services.complete,
  recordStoreLinkOutcome: services.record,
}));
vi.mock("../app/errors", () => ({ logFailure: services.failure, tracePhase: () => {} }));
vi.mock("cloudflare:workers", () => ({ waitUntil: services.background }));

let sqlite: DatabaseSync;
let environment: Env;
const now = 1_800_000_000_000;
const member = (overrides = {}) => ({
  user: { id: "member", emailVerified: true, ...overrides },
  session: { id: "session", createdAt: new Date(now), passkeyVerified: false },
});
const request = (path: string, options: RequestInit = {}) =>
  new Request(`https://test.fiscalbay.it${path}`, options);
const handle = async (path: string, options: RequestInit = {}) => {
  const input = request(path, options);
  const calls = services.session.mock.calls.length;
  const response = await handleAuthRequest(input, environment);
  if (services.session.mock.calls.length > calls)
    expect(services.session).toHaveBeenLastCalledWith({ headers: input.headers });
  return response;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.spyOn(Math, "random").mockReturnValue(1);
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    'CREATE TABLE "rateLimit" (id TEXT, key TEXT UNIQUE, count INTEGER, lastRequest INTEGER)',
  );
  // La SQL del modulo viene eseguita realmente: soglie, finestre e pulizia non sono simulate.
  environment = {
    APP_ORIGIN: "https://test.fiscalbay.it",
    DB: {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        return {
          bind(...values: Array<string | number>) {
            return {
              first: async () => statement.get(...values),
              run: async () => statement.run(...values),
            };
          },
        };
      },
    },
  } as unknown as Env;
  services.handler.mockImplementation(async () => new Response("auth", { status: 202 }));
  services.session.mockResolvedValue(member());
  services.registration.mockResolvedValue({ profile: true, termsAccepted: true });
  services.claim.mockResolvedValue(null);
});
afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("confine HTTP Auth", () => {
  it.each([
    "get-access-token",
    "refresh-token",
    "passkey/delete-passkey",
    "unlink-account",
    "list-sessions",
    "update-session",
  ])("chiude %s anche con slash finali", async (path) => {
    for (const suffix of ["", "/", "///"]) {
      const response = await handle(`/api/auth/${path}${suffix}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
    expect(services.handler).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "richiede una sessione recente e verificata per link-social (%s)",
    async (verified) => {
      services.session.mockResolvedValue(null);
      expect((await handle("/api/auth/link-social")).status).toBe(401);
      const session = member({ emailVerified: verified });
      if (verified) session.session.createdAt = new Date(now - 86400_000);
      services.session.mockResolvedValue(session);
      expect((await handle("/api/auth/link-social")).status).toBe(403);
      expect(services.handler).not.toHaveBeenCalled();
    },
  );

  it.each(["null", "1", '"string"', "invalid", '{"idToken":null}'])(
    "rifiuta payload link-social %s",
    async (body) => {
      expect((await handle("/api/auth/link-social", { method: "POST", body })).status).toBe(400);
      expect(services.handler).not.toHaveBeenCalled();
    },
  );

  it("inoltra il corpo valido senza consumarlo e passa gli header di sessione", async () => {
    const response = await handle("/api/auth/link-social", {
      method: "POST",
      headers: { cookie: "synthetic-session" },
      body: '{"provider":"google"}',
    });
    expect(response.status).toBe(202);
    expect(services.session).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    const forwarded = services.handler.mock.calls[0]![0] as Request;
    expect(forwarded.headers.get("cookie")).toBe("synthetic-session");
    expect(await forwarded.json()).toEqual({ provider: "google" });
  });

  it("blocca change-email solo per la sessione presente ma non recente", async () => {
    services.session.mockResolvedValue({
      ...member(),
      session: { createdAt: new Date(now - 86400_000) },
    });
    expect((await handle("/api/auth/change-email")).status).toBe(403);
    services.session.mockResolvedValue(null);
    expect((await handle("/api/auth/change-email")).status).toBe(202);
    services.session.mockResolvedValue(member());
    expect((await handle("/api/auth/change-email")).status).toBe(202);
  });

  it.each(["generate-register-options", "verify-registration"])(
    "protegge l'aggiunta passkey %s",
    async (path) => {
      const url = `/api/auth/passkey/${path}`;
      services.session.mockResolvedValue(null);
      expect((await handle(url)).status).toBe(401);
      for (const condition of ["email", "profile", "terms", "fresh", "admin"]) {
        const session = member({
          emailVerified: condition !== "email",
          admin: condition === "admin",
        });
        if (condition === "fresh") session.session.createdAt = new Date(now - 86400_000);
        services.session.mockResolvedValue(session);
        services.registration.mockResolvedValue({
          profile: condition !== "profile",
          termsAccepted: condition !== "terms",
        });
        expect((await handle(url)).status).toBe(403);
      }
      services.session.mockResolvedValue(member());
      services.registration.mockResolvedValue({ profile: true, termsAccepted: true });
      expect((await handle(url)).status).toBe(202);
      expect(services.registration).toHaveBeenLastCalledWith(environment.DB, "member");
    },
  );

  it.each([499, 500, 503])("registra gli errori solo da 500 (%i)", async (status) => {
    services.handler.mockResolvedValue(new Response("failure", { status }));
    const input = request("/api/auth/session");
    expect((await handleAuthRequest(input, environment)).status).toBe(status);
    expect(services.session).not.toHaveBeenCalled();
    expect(services.failure.mock.calls).toEqual(
      status < 500 ? [] : [[{ request: input, code: "INTERNAL_ERROR", operation: "route" }]],
    );
  });

  it("inoltra solo gli header ammessi, metodo POST, origine e corpo", async () => {
    const headers = {
      cookie: "cookie",
      origin: "https://test.fiscalbay.it",
      "user-agent": "unit",
      "accept-language": "en",
      "cf-connecting-ip": "203.0.113.8",
      authorization: "discard",
    };
    await forwardToAuth(environment, request("/app", { headers }), "/sign-in/email", {
      email: "member@example.invalid",
    });
    const forwarded = services.handler.mock.calls[0]![0] as Request;
    expect(forwarded.url).toBe("https://test.fiscalbay.it/api/auth/sign-in/email");
    expect(forwarded.method).toBe("POST");
    expect(Object.fromEntries(forwarded.headers)).toEqual({
      ...Object.fromEntries(Object.entries(headers).filter(([name]) => name !== "authorization")),
      "content-type": "application/json",
    });
    expect(await forwarded.json()).toEqual({ email: "member@example.invalid" });
    await forwardToAuth(environment, request("/app"), "/session");
    expect(Object.fromEntries((services.handler.mock.calls[1]![0] as Request).headers)).toEqual({
      "content-type": "application/json",
    });
    expect(await (services.handler.mock.calls[1]![0] as Request).json()).toEqual({});
  });
});

describe("limiti dei tentativi", () => {
  const attempt = (path: string, ip = "203.0.113.1") =>
    handle(`/api/auth${path}`, {
      method: "POST",
      headers: { "cf-connecting-ip": ip },
    });

  it.each([
    ["/sign-in/email", 10],
    ["/sign-up/email", 10],
    ["/change-password", 10],
    ["/change-email", 10],
    ["/passkey/verify-authentication", 10],
    ["/passkey/verify-registration", 10],
    ["/send-verification-email", 60],
    ["/request-password-reset", 60],
    ["/forget-password", 60],
  ])("limita %s e riapre la finestra a %i secondi", async (path, seconds) => {
    for (let count = 0; count < 3; count++) expect((await attempt(path)).status).toBe(202);
    const response = await attempt(path);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(String(seconds));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Try again later.",
    });
    vi.setSystemTime(now + seconds * 1000 - 1001);
    expect((await attempt(path)).headers.get("retry-after")).toBe("2");
    vi.setSystemTime(now + seconds * 1000);
    expect((await attempt(path)).status).toBe(202);
  });

  it("ignora GET, origine HTTP, IP assente e percorsi estranei", async () => {
    await handle("/api/auth/sign-in/email", { headers: { "cf-connecting-ip": "203.0.113.1" } });
    await handle("/api/auth/sign-in/email", { method: "POST" });
    await attempt("/session");
    await attempt("/sign-intruder");
    await attempt("/other/sign-in");
    await attempt("/other/passkey/verify-authentication");
    await attempt("/other/request-password-reset");
    await handleAuthRequest(
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.1" },
      }),
      { ...environment, APP_ORIGIN: "http://localhost:5173" } as unknown as Env,
    );
    expect(sqlite.prepare('SELECT count(*) AS total FROM "rateLimit"').get()?.total).toBe(0);
  });

  it("isola IP e percorsi e raggruppa IPv6 per /64", async () => {
    for (let count = 0; count < 3; count++)
      await attempt("/sign-in/email", "2001:db8:abcd:1234::1");
    expect((await attempt("/sign-in/email", "2001:db8:abcd:1234:0:0:0:2")).status).toBe(429);
    expect((await attempt("/sign-in/email", "2001:db8:abcd:1235::1")).status).toBe(202);
    expect((await attempt("/sign-up/email", "2001:db8:abcd:1234::1")).status).toBe(202);
    expect((await attempt("/sign-in/email", "203.0.113.2")).status).toBe(202);
    expect((await attempt("/sign-in/email", "::1")).status).toBe(202);
    expect(
      sqlite
        .prepare('SELECT key FROM "rateLimit" ORDER BY key')
        .all()
        .map((row) => row.key),
    ).toEqual([
      "0:0:0:0::/64|/sign-in/email",
      "2001:db8:abcd:1234::/64|/sign-in/email",
      "2001:db8:abcd:1234::/64|/sign-up/email",
      "2001:db8:abcd:1235::/64|/sign-in/email",
      "203.0.113.2|/sign-in/email",
    ]);
  });

  it("raggruppa anche IPv6 completi e con compressione iniziale o interna", async () => {
    await attempt("/sign-in/email", "2001:db8:abcd:1234:0:0:0:1");
    await attempt("/sign-in/email", "2001::db8:abcd:1234:0:0:1");
    await attempt("/sign-in/email", "::db8:abcd:1234:0:0:1");
    expect(
      sqlite
        .prepare('SELECT key FROM "rateLimit" ORDER BY key')
        .all()
        .map((row) => row.key),
    ).toEqual([
      "0:0:db8:abcd::/64|/sign-in/email",
      "2001:0:db8:abcd::/64|/sign-in/email",
      "2001:db8:abcd:1234::/64|/sign-in/email",
    ]);
  });

  it("conserva il percorso quando api/auth non è il prefisso", async () => {
    await handle("/sign-in/api/auth/email", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.1" },
    });
    expect(sqlite.prepare('SELECT key FROM "rateLimit"').get()?.key).toBe(
      "203.0.113.1|/sign-in/api/auth/email",
    );
  });

  it("pulisce soltanto le finestre chiuse da oltre un'ora con probabilità del 2%", async () => {
    sqlite.exec(
      `INSERT INTO "rateLimit" VALUES ('old', 'old', 1, ${now - 3600_001}), ('edge', 'edge', 1, ${now - 3600_000})`,
    );
    vi.spyOn(Math, "random").mockReturnValue(0.02);
    await attempt("/sign-in/email");
    expect(services.background).not.toHaveBeenCalled();
    vi.spyOn(Math, "random").mockReturnValue(0.019);
    await attempt("/sign-in/email");
    expect(services.background).toHaveBeenCalledOnce();
    expect(
      sqlite
        .prepare('SELECT key FROM "rateLimit" ORDER BY key')
        .all()
        .map((row) => row.key),
    ).toEqual(["203.0.113.1|/sign-in/email", "edge"]);
  });
});

describe("callback eBay", () => {
  it.each([
    "",
    "state=s",
    "code=c",
    "state=&code=c",
    "state=s&state=t&code=c",
    "state=s&code=",
    "state=s&error=",
    "state=s&code=c&code=d",
    "state=s&error=e&error=f",
    "state=s&code=c&error=e",
    `state=${"s".repeat(4097)}&code=c`,
    `state=s&code=${"c".repeat(1025)}`,
    `state=s&error=${"e".repeat(257)}`,
  ])("rifiuta callback ambiguo %s", async (query) => {
    const response = await handle(`/api/auth/callback/ebay?${query}`);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.fiscalbay.it/auth/error");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(services.claim).not.toHaveBeenCalled();
    expect(services.handler).not.toHaveBeenCalled();
  });

  it("rifiuta POST ma ammette i limiti esatti di state, code ed error", async () => {
    expect(
      (await handle("/api/auth/callback/ebay?state=s&code=c", { method: "POST" })).status,
    ).toBe(303);
    for (const query of [
      `state=${"s".repeat(4096)}&code=${"c".repeat(1024)}`,
      `state=s&error=${"e".repeat(256)}`,
    ]) {
      const response = await handle(`/api/auth/callback/ebay?${query}`);
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("auth");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it.each([
    ["s", "production", "collegato", "/app/ordini?negozio=collegato"],
    ["en_s", "sandbox", "collegato", "/en/app/ordini?negozio=collegato&environment=sandbox"],
    ["english", "production", null, "/app/ordini"],
    ["en_s", "sandbox", null, "/en/app/ordini?environment=sandbox"],
  ])(
    "ripete l'esito del callback per il suo utente (%s, %s, %s)",
    async (state, ebayEnvironment, outcome, destination) => {
      services.claim.mockResolvedValue({
        kind: "duplicate",
        userId: "member",
        outcome,
        ebayEnvironment,
      });
      const response = await handle(`/api/auth/callback/ebay?state=${state}&code=c`);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`https://test.fiscalbay.it${destination}`);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(services.claim).toHaveBeenCalledWith(environment.DB, state);
      expect(services.complete).not.toHaveBeenCalled();
      expect(services.record).not.toHaveBeenCalled();
    },
  );

  it.each([null, { user: { id: "other" } }])(
    "non rivela l'esito di un altro utente",
    async (session) => {
      services.session.mockResolvedValue(session);
      services.claim.mockResolvedValue({
        kind: "duplicate",
        userId: "member",
        outcome: "collegato",
      });
      expect((await handle("/api/auth/callback/ebay?state=s&code=c")).headers.get("location")).toBe(
        "https://test.fiscalbay.it/app/ordini?negozio=errore",
      );
    },
  );

  it.each([false, true])("completa e registra un nuovo collegamento, errore=%s", async (fails) => {
    const link = { kind: "claimed", userId: "member", ebayEnvironment: "production" };
    services.claim.mockResolvedValue(link);
    const error = new Error("synthetic");
    if (fails) services.complete.mockRejectedValue(error);
    else services.complete.mockResolvedValue("collegato");
    const input = request("/api/auth/callback/ebay?state=s&code=c");
    const fetcher = vi.fn();
    const response = await handleAuthRequest(input, environment, fetcher);
    expect(services.session).toHaveBeenLastCalledWith({ headers: input.headers });
    expect(services.complete).toHaveBeenCalledWith({
      environment,
      link,
      sessionUserId: "member",
      search: new URLSearchParams("state=s&code=c"),
      fetcher,
      request: input,
    });
    expect(services.record).toHaveBeenCalledWith(
      environment.DB,
      "s",
      fails ? "errore" : "collegato",
    );
    expect(response.headers.get("location")).toBe(
      `https://test.fiscalbay.it/app/ordini?negozio=${fails ? "errore" : "collegato"}`,
    );
    expect(services.failure.mock.calls).toEqual(
      fails ? [[{ request: input, error, operation: "store_link" }]] : [],
    );
  });
});
