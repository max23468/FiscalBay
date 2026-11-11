import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { localInstant } from "../app/admin-console.server";

import { listAudit } from "../app/domain/admin-audit.server";

import { listAnomalies } from "../app/domain/admin-operations.server";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { action as adminAction, loader as adminLoader } from "../app/routes/admin";

import { verifiedSession } from "./fixtures/account-fixtures";

import { insertStore, insertWorkspace, now } from "./fixtures/database-fixtures";

import { callRoute, routeData } from "./fixtures/route-fixtures";

import {
  at,
  hour,
  later,
  admin,
  audit,
  page,
  act,
  setupScenarios,
} from "./fixtures/admin-scenarios";

setupScenarios();

describe("accesso alla console", () => {
  it("nasconde la console a chi non è admin e non legge sezioni senza passkey", async () => {
    const merchant = await verifiedSession("venditore.console@example.invalid");
    expect(await page(merchant.cookie)).toBe(404);
    expect(await page(merchant.cookie, "/admin/quote", { sezione: "quote" })).toBe(404);

    await env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(merchant.userId).run();
    expect(await page(merchant.cookie)).toEqual({ access: "verify", section: null });
    // Senza conferma nessuna operazione passa, neppure con un modulo valido.
    await expect(
      callRoute(adminAction, "/admin", {
        cookie: merchant.cookie,
        fields: { intent: "requeue-task", lavoro: "billing" },
      }),
    ).rejects.toMatchObject({ init: { status: 404 } });

    const granted = await admin();
    expect(await page(granted.cookie)).toEqual({ access: "granted", section: "panoramica" });
    expect(await page(granted.cookie, "/admin/registro", { sezione: "registro" })).toEqual({
      access: "granted",
      section: "registro",
    });
    // Sezioni sconosciute e elementi fuori dalla scheda di uno spazio non esistono.
    expect(await page(granted.cookie, "/admin/sql", { sezione: "sql" })).toBe(404);
    expect(await page(granted.cookie, "/admin/quote/x", { sezione: "quote", voce: "x" })).toBe(404);
    expect(await page(granted.cookie, "/admin/spazi", { sezione: "spazi" })).toBe(404);
    expect(
      await page(granted.cookie, "/admin/spazi/inesistente", {
        sezione: "spazi",
        voce: "inesistente",
      }),
    ).toBe(404);

    // La perdita del ruolo vale subito, anche a metà sessione.
    await env.DB.prepare('UPDATE "user" SET "admin" = 0 WHERE id = ?').bind(granted.userId).run();
    expect(await page(granted.cookie)).toBe(404);
  });

  it("con Auth o database non disponibili risponde 503 senza sezioni né operazioni", async () => {
    const { cookie } = await admin();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1_ERROR: unavailable");
    });
    expect(await page(cookie)).toBe(503);
    await expect(
      callRoute(adminAction, "/admin", {
        cookie,
        fields: { intent: "requeue-task", lavoro: "billing" },
      }),
    ).rejects.toMatchObject({ init: { status: 503, headers: { "retry-after": "60" } } });
  });

  it("rifiuta un'operazione da un'altra origine e chiede il motivo dove serve", async () => {
    const { cookie } = await admin();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    for (const origin of ["https://altro.invalid", null])
      await expect(
        callRoute(adminAction, "/admin", {
          cookie,
          fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "x" },
          origin,
        }),
      ).rejects.toMatchObject({ status: 403 });
    expect(
      await act(cookie, { intent: "grant-premium", spazio: "w-a", giorni: "3" }),
    ).toMatchObject({
      status: 400,
    });
    expect(await act(cookie, { intent: "comando-libero" })).toMatchObject({ status: 400 });
    expect(
      await act(cookie, {
        intent: "grant-premium",
        spazio: "w-a",
        giorni: "x".repeat(129),
        motivo: "y",
      }),
    ).toMatchObject({ status: 400 });
    expect(await act(cookie, { intent: "requeue-task", lavoro: "inesistente" })).toMatchObject({
      status: 400,
    });
    expect(
      await act(cookie, { intent: "quota-attention", soglia: "99", motivo: "Prova" }),
    ).toMatchObject({ status: 400 });
    // Anche i rifiuti decisi dal modulo restano nel registro, con l'oggetto quando è indicato.
    // Un rifiuto per l'origine estranea e uno per quella assente.
    const foreign = {
      operation: "grant-premium",
      target: "workspace:w-a",
      reason: "x",
      outcome: "foreign_origin",
    };
    expect(await audit()).toEqual([
      foreign,
      foreign,
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: null,
        outcome: "reason_required",
      },
      { operation: "comando-libero", target: null, reason: null, outcome: "unknown_intent" },
      { operation: "grant-premium", target: "workspace:w-a", reason: "y", outcome: "too_long" },
      { operation: "requeue-task", target: "task:inesistente", reason: null, outcome: "invalid" },
      {
        operation: "quota-attention",
        target: "setting:quota_attention:99",
        reason: "Prova",
        outcome: "out_of_range",
      },
    ]);
    await env.DB.prepare("DELETE FROM admin_audit").run();

    expect(
      await act(cookie, {
        intent: "grant-premium",
        spazio: "w-a",
        giorni: "3",
        motivo: "Disservizio",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await act(cookie, { intent: "grant-lifetime", spazio: "w-inesistente", motivo: "Prova" }),
    ).toMatchObject({ ok: false });
    // Il posto da riprendere arriva al dominio: nessun posto senza spazio, nessuna concessione.
    expect(
      await act(cookie, { intent: "grant-lifetime", spazio: "w-a", posto: "3", motivo: "Ritorno" }),
    ).toMatchObject({ ok: false });
    // Esiti riusciti e rifiutati restano nel registro con oggetto e motivo.
    expect(await audit()).toEqual([
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
      {
        operation: "grant-lifetime",
        target: "workspace:w-inesistente",
        reason: "Prova",
        outcome: "not_found",
      },
      {
        operation: "grant-lifetime",
        target: "workspace:w-a",
        reason: "Ritorno",
        outcome: "seat-unavailable",
      },
    ]);
    // Il registro non si riscrive.
    await expect(env.DB.prepare("UPDATE admin_audit SET outcome = 'x'").run()).rejects.toThrow(
      "immutable_audit",
    );
  });

  it("la conferma con passkey vale dodici ore dall'apertura della sessione, anche per le operazioni", async () => {
    const { cookie, userId } = await admin();
    const row = await env.DB.prepare('SELECT "createdAt" FROM "session" WHERE "userId" = ?')
      .bind(userId)
      .first<{ createdAt: string | number }>();
    const opened = new Date(row!.createdAt).getTime();
    const requeue = { intent: "requeue-task", lavoro: "billing" };
    try {
      vi.setSystemTime(new Date(opened + 12 * hour - 60_000));
      const granted = await routeData(adminLoader, "/admin", { cookie });
      expect(granted).toMatchObject({
        access: "granted",
        passkeyUntil: new Date(opened + 12 * hour).toISOString(),
      });
      expect(await act(cookie, requeue)).toMatchObject({ ok: true });
      // Allo scadere delle dodici ore la sessione resta aperta, ma la console chiede la passkey.
      vi.setSystemTime(new Date(opened + 12 * hour));
      expect(await page(cookie)).toEqual({ access: "verify", section: null });
      await expect(
        callRoute(adminAction, "/admin", { cookie, fields: requeue }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    } finally {
      vi.useRealTimers();
    }
    expect((await audit()).map((entry) => entry.operation)).toEqual(["requeue-task"]);
  });

  it("senza la riga del registro l'operazione non parte; senza l'esito la riga resta in corso", async () => {
    const { cookie, userId } = await admin();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    const original = env.DB.prepare.bind(env.DB);
    let failures = { insert: 1, update: 0 };
    const unavailable = {
      bind: () => ({ run: () => Promise.reject(new Error("database_unavailable")) }),
    } as unknown as D1PreparedStatement;
    vi.spyOn(env.DB, "prepare").mockImplementation((query) =>
      (query.includes("INSERT INTO admin_audit") && failures.insert-- > 0) ||
      (query.includes("UPDATE admin_audit") && failures.update-- > 0)
        ? unavailable
        : original(query),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const grant = { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" };
    const grants = () =>
      env.DB.prepare(
        "SELECT count(*) AS n FROM workspace_entitlements WHERE workspace_id = 'w-a'",
      ).first("n");
    // Il primo errore si riprova: la riga c'è e la risposta è quella dell'operazione.
    expect(await act(cookie, grant)).toMatchObject({ ok: true });
    expect(await audit()).toEqual([
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
    ]);
    expect(logged).not.toHaveBeenCalled();
    // Con il registro che non risponde l'operazione non parte: nessuna concessione in più.
    failures = { insert: 2, update: 0 };
    expect(await act(cookie, grant)).toMatchObject({ status: 503, ok: false });
    expect(await audit()).toHaveLength(1);
    expect(await grants()).toBe(1);
    expect(logged).toHaveBeenCalledOnce();

    // Lo stesso per un interruttore: resta acceso.
    const off = {
      intent: "set-switch",
      interruttore: "ebay_calls",
      stato: "off",
      motivo: "Manutenzione autorizzata",
    };
    const ebayCalls = () =>
      env.DB.prepare("SELECT value FROM service_settings WHERE name = 'ebay_calls'").first("value");
    failures = { insert: 2, update: 0 };
    expect(await act(cookie, off)).toMatchObject({ status: 503, ok: false });
    expect(await ebayCalls()).toBeNull();
    expect(await audit()).toHaveLength(1);

    // L'esito che non si scrive lascia la riga in corso con autore, oggetto, motivo e istante;
    // la risposta è quella reale e la panoramica la segnala dopo l'attesa.
    failures = { insert: 0, update: 2 };
    expect(await act(cookie, off)).toMatchObject({ ok: true });
    expect(await ebayCalls()).toBe("false");
    expect(
      await env.DB.prepare(
        "SELECT actor, operation, target, reason, outcome FROM admin_audit WHERE operation = ?",
      )
        .bind("set-switch")
        .all(),
    ).toMatchObject({
      results: [
        {
          actor: userId,
          operation: "set-switch",
          target: "switch:ebay_calls:off",
          reason: "Manutenzione autorizzata",
          outcome: "in_progress",
        },
      ],
    });
    expect(logged).toHaveBeenCalledTimes(3);
    const recorded = await env.DB.prepare(
      "SELECT at FROM admin_audit WHERE outcome = 'in_progress'",
    ).first<string>("at");
    const anomaly = (when: number) =>
      listAnomalies(env.DB, new Date(Date.parse(recorded!) + when)).then((anomalies) =>
        anomalies.find(({ kind }) => kind === "audit_unrecorded"),
      );
    expect(await anomaly(60_000)).toBeUndefined();
    expect(await anomaly(10 * 60_000)).toMatchObject({
      severity: "p3",
      count: 1,
      subjects: [{ id: "set-switch", href: "registro" }],
    });
    // La riga in corso riceve l'esito una volta sola; le altre restano immutabili.
    vi.mocked(env.DB.prepare).mockRestore();
    await expect(
      env.DB.prepare("UPDATE admin_audit SET reason = 'altro' WHERE outcome = 'in_progress'").run(),
    ).rejects.toThrow("immutable_audit");
    await env.DB.prepare(
      "UPDATE admin_audit SET outcome = 'done' WHERE outcome = 'in_progress'",
    ).run();
    await expect(
      env.DB.prepare(
        "UPDATE admin_audit SET outcome = 'in_progress' WHERE operation = 'set-switch'",
      ).run(),
    ).rejects.toThrow("immutable_audit");
  });

  it("legge ogni sezione senza chiamare eBay o Stripe per conto dei negozi", async () => {
    const { cookie, userId } = await admin();
    await env.DB.batch([...insertWorkspace({ id: "w-a", userId }), insertStore({ id: "s-a" })]);
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      requests.push(url.host + url.pathname);
      return new Response("", { status: 503 });
    });
    const sections = [
      "account",
      "negozi",
      "lavori",
      "quote",
      "prestazioni",
      "commerciale",
      "antiabuso",
    ];
    for (const sezione of [...sections, "comunicazioni", "interruttori", "registro"])
      expect(await page(cookie, `/admin/${sezione}`, { sezione })).toEqual({
        access: "granted",
        section: sezione,
      });
    expect(await page(cookie, "/admin/spazi/w-a", { sezione: "spazi", voce: "w-a" })).toMatchObject(
      { section: "spazi" },
    );
    // La scheda dello spazio elenca i suoi negozi con lo stato visto dal venditore.
    const space = await routeData(adminLoader, "/admin/spazi/w-a", {
      cookie,
      params: { sezione: "spazi", voce: "w-a" },
    });
    expect(space.page).toMatchObject({
      workspace: { stores: [expect.objectContaining({ id: "s-a" })] },
    });
    const overview = await routeData(adminLoader, "/admin", { cookie, params: {} });
    expect(overview.page).toMatchObject({ tasks: { total: 10 } });
    const quotas = await routeData(adminLoader, "/admin/quote", {
      cookie,
      params: { sezione: "quote" },
    });
    // La pagina Commerciale porta i motivi di uscita, anche senza uscite.
    const commerce = await routeData(adminLoader, "/admin/commerciale", {
      cookie,
      params: { sezione: "commerciale" },
    });
    expect(commerce.page).toMatchObject({
      exits: {
        counts: { cancellation: { unused: { days30: 0, months3: 0, months12: 0 } } },
        recent: [],
      },
    });
    // eBay non risponde: la quota resta non letta, non piena né vuota.
    expect(quotas.page).toMatchObject({ quotas: [{ read: "failed", rows: [] }], bulk: [] });
    expect(
      requests.every(
        (request) =>
          request.endsWith("/oauth2/token") || request.startsWith("api.stripe.com/v1/prices"),
      ),
    ).toBe(true);
  });

  it("conserva il registro un anno dall'operazione", async () => {
    const entry = (id: string, time: string) =>
      env.DB.prepare(`INSERT INTO admin_audit (id, actor, operation, outcome, at)
        VALUES (?, 'admin', 'grant-premium', 'done', ?)`).bind(id, time);
    await env.DB.batch([
      entry("vecchia", later(-366 * 24 * hour)),
      entry("recente", later(-364 * 24 * hour)),
    ]);
    await purgeExpiredRecords(env.DB, at(now));
    expect((await env.DB.prepare("SELECT id FROM admin_audit").all()).results).toEqual([
      { id: "recente" },
    ]);
  });

  it("converte l'ora del modulo dal fuso della console", () => {
    expect(localInstant("2026-10-27T10:00")).toBe("2026-10-27T09:00:00.000Z");
    expect(localInstant("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z");
    expect(localInstant("2026-07-01T10:45")).toBe("2026-07-01T08:45:00.000Z");
    expect(localInstant("27/10/2026")).toBeNull();
  });
});

describe("accesso tecnico con token", () => {
  const token = "fbat_token-sintetico-del-collaudo-con-lunghezza-sufficiente";
  async function register(
    revokedAt: string | null = null,
    expiresAt: string | null = "2099-01-01T00:00:00.000Z",
  ) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(`INSERT INTO admin_agent_tokens
      (token_hash, label, created_at, revoked_at, expires_at) VALUES (?, 'agente-test', ?, ?, ?)`)
      .bind(hash, now, revokedAt, expiresAt)
      .run();
    return hash;
  }
  const bearer = (value = token) => ({ authorization: `Bearer ${value}` });

  it("apre la console senza passkey con le stesse operazioni e lascia la traccia", async () => {
    const hash = await register();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    const result = await routeData(adminLoader, "/admin/registro", {
      headers: bearer(),
      params: { sezione: "registro" },
    });
    expect(result).toMatchObject({ access: "agent", technical: true, passkeyUntil: null });
    expect(result.page).toMatchObject({ section: "registro" });
    // Le operazioni passano come per la sessione con passkey, con motivo e controllo d'origine.
    const granted = await callRoute(adminAction, "/admin", {
      headers: bearer(),
      fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" },
    });
    expect(granted).toMatchObject({ ok: true });
    await expect(
      callRoute(adminAction, "/admin", {
        headers: bearer(),
        fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" },
        origin: "https://altro.invalid",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await audit()).toEqual([
      { operation: "agent-read", target: "page:/admin/registro", reason: null, outcome: "done" },
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "foreign_origin",
      },
    ]);
    expect(
      await env.DB.prepare(
        "SELECT granted_by FROM workspace_entitlements WHERE workspace_id = 'w-a'",
      ).first(),
    ).toEqual({ granted_by: "agent:agente-test" });
    expect(
      await env.DB.prepare("SELECT used_at FROM admin_agent_tokens WHERE token_hash = ?")
        .bind(hash)
        .first(),
    ).toEqual({ used_at: now });
    // Le letture tecniche non affollano le ultime operazioni della panoramica.
    expect((await listAudit(env.DB, { changes: true })).map((entry) => entry.operation)).toEqual([
      "grant-premium",
      "grant-premium",
    ]);
  });

  it.each([
    ["scaduto", now],
    ["senza scadenza", null],
  ])("rifiuta un token %s", async (_, expiresAt) => {
    await register(null, expiresAt);
    await expect(routeData(adminLoader, "/admin", { headers: bearer() })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("blocca per IP dopo dieci token rifiutati, senza contare quelli validi", async () => {
    await register();
    const from = (ip: string, value = token) => ({ ...bearer(value), "cf-connecting-ip": ip });
    for (let count = 0; count < 12; count++)
      expect(
        await routeData(adminLoader, "/admin", { headers: from("203.0.113.8") }),
      ).toMatchObject({ access: "agent" });
    for (let count = 0; count < 10; count++)
      await expect(
        routeData(adminLoader, "/admin", { headers: from("203.0.113.8", "fbat_sbagliato") }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    // Oltre il limite anche il token valido attende, e senza leggerlo.
    await expect(
      routeData(adminLoader, "/admin", { headers: from("203.0.113.8") }),
    ).rejects.toMatchObject({ init: { status: 429, headers: { "retry-after": "900" } } });
    expect(await routeData(adminLoader, "/admin", { headers: from("203.0.113.9") })).toMatchObject({
      access: "agent",
    });
  });

  it("rifiuta un token revocato, sconosciuto o senza il prefisso", async () => {
    await register(now);
    for (const headers of [bearer(), bearer("fbat_altro-token"), bearer(token.slice(5))]) {
      await expect(routeData(adminLoader, "/admin", { headers })).rejects.toMatchObject({
        init: { status: 404 },
      });
      await expect(
        callRoute(adminAction, "/admin", {
          headers,
          fields: { intent: "requeue-task", lavoro: "billing" },
        }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    }
    expect(await audit()).toEqual([]);
  });
});
