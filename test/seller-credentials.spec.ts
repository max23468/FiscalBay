import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthRequest } from "../app/auth-route.server";
import {
  openToken,
  refreshStoreToken,
  sealToken,
} from "../app/integrations/ebay/seller-credentials.server";
import { refreshExpiringTokens } from "../app/domain/token-refresh.server";
import { sendReconnectNotices } from "../app/domain/reconnect-notices.server";
import { UpstreamError } from "../app/integrations/http.server";
import { insertCredentials, resetDatabase } from "./fixtures/database-fixtures";
import { syntheticEbay } from "./fixtures/ebay-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { beginStoreLink, storeCallback } from "./fixtures/store-link-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("rinnovo dei token del negozio", () => {
  const issued = new Date("2026-10-01T10:00:00.000Z");

  async function linkedStore(email: string): Promise<string> {
    const { cookie } = await verifiedSession(email);
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    await handleAuthRequest(
      storeCallback(`state=${state}&code=codice`, cookie),
      env,
      syntheticEbay(),
    );
    const store = await env.DB.prepare("SELECT id FROM ebay_stores").first<{ id: string }>();
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET granted_at = ?, access_expires_at = ?, refresh_expires_at = ?",
    )
      .bind(issued.toISOString(), "2026-10-01T12:00:00.000Z", "2028-04-01T10:00:00.000Z")
      .run();
    return store!.id;
  }

  function tokenEndpoint(response: () => Response) {
    return vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("refresh-sintetico");
      return response();
    });
  }

  async function credentials() {
    return env.DB.prepare(
      "SELECT store_id, access_token, access_expires_at, refreshed_at, rejected_at FROM ebay_store_credentials",
    ).first<Record<string, string | null>>();
  }

  it("rinnova in anticipo solo i token vicini alla scadenza", async () => {
    const storeId = await linkedStore("rinnovo@example.invalid");
    const fetcher = tokenEndpoint(() =>
      Response.json({ access_token: "token-rinnovato", expires_in: 7200 }),
    );

    expect(await refreshExpiringTokens(env, fetcher, new Date("2026-10-01T11:00:00.000Z"))).toEqual(
      [],
    );
    const at = new Date("2026-10-01T11:30:00.000Z");
    expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(["refreshed"]);
    const row = await credentials();
    expect(await openToken(env.BETTER_AUTH_SECRET, storeId, "access", row!.access_token!)).toBe(
      "token-rinnovato",
    );
    expect(row).toMatchObject({
      access_expires_at: "2026-10-01T13:30:00.000Z",
      refreshed_at: at.toISOString(),
      rejected_at: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rinnova oltre il primo blocco, prosegue dopo un errore e si ferma al limite", async () => {
    const first = await linkedStore("molti-negozi@example.invalid");
    const { workspace_id: workspaceId } = (await env.DB.prepare(
      "SELECT workspace_id FROM ebay_stores WHERE id = ?",
    )
      .bind(first)
      .first<{ workspace_id: string }>())!;
    // Il negozio collegato ha un UUID e precede questi nell'ordine dei rinnovi.
    for (let index = 1; index < 320; index++) {
      const id = `negozio-${String(index).padStart(3, "0")}`;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, ebay_account_id)
           VALUES (?1, ?2, ?1, ?3, ?1)`,
        ).bind(id, workspaceId, issued.toISOString()),
        insertCredentials({
          storeId: id,
          accessToken: "scaduto",
          accessExpiresAt: "2026-10-01T12:00:00.000Z",
          refreshToken: await sealToken(env.BETTER_AUTH_SECRET, id, "refresh", id),
          refreshExpiresAt: "2028-04-01T10:00:00.000Z",
          grantedAt: issued.toISOString(),
        }),
      ]);
    }
    // Due negozi in mezzo al primo blocco restano non disponibili: non vanno riletti.
    const unavailable = new Set(["negozio-002", "negozio-003"]);
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const token = new URLSearchParams(String(init?.body)).get("refresh_token")!;
      return unavailable.has(token)
        ? Response.json({ error: "temporarily_unavailable" }, { status: 503 })
        : Response.json({ access_token: "token-rinnovato", expires_in: 7200 });
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const at = new Date("2026-10-01T11:30:00.000Z");
    try {
      expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(Array(298).fill("refreshed"));
      expect(fetcher).toHaveBeenCalledTimes(300);
      expect(
        errors.mock.calls.filter(([line]) => String(line).includes('"operation":"token_refresh"')),
      ).toHaveLength(2);
      // L'esecuzione successiva riprova i due negozi e completa quelli oltre il limite.
      fetcher.mockClear();
      expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(Array(20).fill("refreshed"));
      expect(fetcher).toHaveBeenCalledTimes(22);
    } finally {
      errors.mockRestore();
    }
  });

  it("registra il rifiuto del consenso solo per invalid_grant", async () => {
    const storeId = await linkedStore("consenso-revocato@example.invalid");
    const misconfigured = tokenEndpoint(() =>
      Response.json({ error: "invalid_client" }, { status: 401 }),
    );
    await expect(
      refreshStoreToken({ env, storeId, fetcher: misconfigured, now: issued }),
    ).rejects.toMatchObject({ failure: "credentials" });
    expect((await credentials())!.rejected_at).toBeNull();

    const revoked = tokenEndpoint(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await refreshStoreToken({ env, storeId, fetcher: revoked, now: issued })).toBe(
      "rejected",
    );
    expect((await credentials())!.rejected_at).toBe(issued.toISOString());
    // Un consenso rifiutato non viene più ritentato dal lavoro in background.
    expect(await refreshExpiringTokens(env, revoked, issued)).toEqual([]);
  });

  it("chiude il consenso quando il token di rinnovo non si apre più", async () => {
    const storeId = await linkedStore("segreto-ruotato@example.invalid");
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET refresh_token = 'v1.illeggibile'",
    ).run();
    const fetcher = tokenEndpoint(() => Response.json({ access_token: "x", expires_in: 7200 }));
    expect(await refreshStoreToken({ env, storeId, fetcher, now: issued })).toBe("rejected");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await credentials())!.rejected_at).toBe(issued.toISOString());
    expect(await refreshExpiringTokens(env, fetcher, issued)).toEqual([]);
  });

  it("non sovrascrive un consenso più recente con un rinnovo partito prima", async () => {
    const storeId = await linkedStore("rinnovo-superato@example.invalid");
    const before = await credentials();
    const fetcher = tokenEndpoint(() =>
      Response.json({ access_token: "vecchio", expires_in: 7200 }),
    );
    fetcher.mockImplementationOnce(async () => {
      // Durante la risposta il merchant ricollega il negozio con un nuovo consenso.
      await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
        .bind("2026-10-01T10:05:00.000Z")
        .run();
      return Response.json({ access_token: "vecchio", expires_in: 7200 });
    });
    expect(await refreshStoreToken({ env, storeId, fetcher, now: issued })).toBe("superseded");
    expect((await credentials())!.access_token).toBe(before!.access_token);
  });

  it("considera rifiutato un consenso già scaduto senza chiamare eBay", async () => {
    const storeId = await linkedStore("consenso-scaduto@example.invalid");
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await refreshStoreToken({
        env,
        storeId,
        fetcher,
        now: new Date("2028-04-01T10:00:00.000Z"),
      }),
    ).toBe("rejected");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("apre un token cifrato con la chiave derivata prevista, legato a negozio e tipo", async () => {
    // Cifratura indipendente con HKDF-SHA-256 e info fissa: cambiare la derivazione rende
    // illeggibili i token già salvati.
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.BETTER_AUTH_SECRET),
      "HKDF",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: new TextEncoder().encode("fiscalbay/ebay-seller-token/v1"),
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const iv = new Uint8Array(12).fill(7);
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("negozio:access") },
        key,
        new TextEncoder().encode("token-noto"),
      ),
    );
    const value = `v1.${btoa(String.fromCharCode(...iv, ...sealed))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "")}`;
    expect(await openToken(env.BETTER_AUTH_SECRET, "negozio", "access", value)).toBe("token-noto");
    await expect(openToken(env.BETTER_AUTH_SECRET, "negozio", "refresh", value)).rejects.toThrow();
    await expect(
      openToken(env.BETTER_AUTH_SECRET, "negozio", "access", value.slice(3)),
    ).rejects.toThrow("unsupported_token_format");
    // Formato, cifratura o segreto non validi sono lo stesso caso: il consenso non si usa più.
    for (const unreadable of [`${value}x`, "v1.!"])
      await expect(
        openToken(env.BETTER_AUTH_SECRET, "negozio", "access", unreadable),
      ).rejects.toThrow();
  });

  it("non rinnova senza credenziali né con una risposta senza token", async () => {
    expect(
      await refreshStoreToken({
        env,
        storeId: "inesistente",
        fetcher: vi.fn<typeof fetch>(),
        now: issued,
      }),
    ).toBe("missing");
    await linkedStore("risposta-incompleta@example.invalid");
    const storeId = (await env.DB.prepare("SELECT id FROM ebay_stores").first<{ id: string }>())!
      .id;
    const before = await credentials();
    await expect(
      refreshStoreToken({
        env,
        storeId,
        fetcher: tokenEndpoint(() => Response.json({ expires_in: 7200 })),
        now: issued,
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(await credentials()).toEqual(before);
  });

  it("manda al titolare una sola email per interruzione del consenso, verso Negozi", async () => {
    const storeId = await linkedStore("ricollega@example.invalid");
    const send = vi.fn<Env["AUTH_EMAIL"]["send"]>().mockResolvedValue({ messageId: "synthetic" });
    const mail = { ...env, AUTH_EMAIL: { send } } as unknown as Env;
    const update = (fields: string, ...values: string[]) =>
      env.DB.prepare(`UPDATE ebay_store_credentials SET ${fields}`)
        .bind(...values)
        .run();
    const run = (at: string) => sendReconnectNotices(mail, new Date(at));
    type Sent = { to: string; subject: string; text: string; html: string };
    const sent = (index: number) => send.mock.calls[index]![0] as Sent;
    // Con il consenso valido non parte nulla.
    await run("2026-10-20T10:00:00.000Z");
    expect(send).not.toHaveBeenCalled();
    // Il rifiuto di eBay: una sola email, anche nelle esecuzioni seguenti.
    await update("rejected_at = ?", "2026-10-20T09:50:00.000Z");
    await run("2026-10-20T10:00:00.000Z");
    await run("2026-10-20T10:10:00.000Z");
    expect(send).toHaveBeenCalledOnce();
    expect(sent(0)).toMatchObject({
      to: "ricollega@example.invalid",
      subject: "Ricollega il tuo negozio eBay a FiscalBay",
      text: expect.stringContaining("Apri Negozi: http://localhost:5173/app/negozi\n"),
    });
    expect(sent(0).text).not.toMatch(/acquirent|Codice Fiscale/u);
    // Ricollegato, il nuovo consenso arriva alla scadenza nota: un'altra email, nella lingua
    // scelta dal titolare, soltanto dopo la scadenza.
    await update("rejected_at = NULL, refresh_expires_at = ?", "2026-10-25T00:00:00.000Z");
    await env.DB.prepare(
      `INSERT INTO user_preferences (user_id, language, updated_at)
       SELECT "id", 'en', ?1 FROM "user"`,
    )
      .bind("2026-10-20T00:00:00.000Z")
      .run();
    await run("2026-10-24T23:50:00.000Z");
    expect(send).toHaveBeenCalledOnce();
    await run("2026-10-25T00:10:00.000Z");
    expect(send).toHaveBeenCalledTimes(2);
    expect(sent(1)).toMatchObject({
      subject: "Reconnect your eBay store to FiscalBay",
      text: expect.stringContaining("Open Stores: http://localhost:5173/en/app/negozi\n"),
    });
    // Un negozio in pausa non legge comunque, e oltre trenta giorni l'email non parte più.
    await update("refresh_expires_at = ?", "2026-10-26T00:00:00.000Z");
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES (?, 'manual', ?)",
    )
      .bind(storeId, "2026-10-25T00:00:00.000Z")
      .run();
    await run("2026-10-26T00:10:00.000Z");
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
    await run("2026-11-25T00:10:00.000Z");
    expect(send).toHaveBeenCalledTimes(2);
    // Un invio rifiutato si riprova all'esecuzione seguente; un indirizzo soppresso vale come
    // avvisato. Il log riporta il codice del provider, mai l'indirizzo.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const refusal = (code: string) => Object.assign(new Error("synthetic"), { code });
    send.mockRejectedValueOnce(refusal("E_RATE_LIMIT_EXCEEDED"));
    await run("2026-10-26T00:20:00.000Z");
    send.mockRejectedValueOnce(refusal("E_RECIPIENT_SUPPRESSED"));
    await run("2026-10-26T00:30:00.000Z");
    await run("2026-10-26T00:40:00.000Z");
    expect(send).toHaveBeenCalledTimes(4);
    const logged = errors.mock.calls.map(([line]) => String(line)).join("\n");
    expect(logged).toContain('"failure":"E_RATE_LIMIT_EXCEEDED"');
    expect(logged).toContain('"failure":"E_RECIPIENT_SUPPRESSED"');
    expect(logged).not.toContain("ricollega@example.invalid");
    errors.mockRestore();
  });

  it("produce cifrati diversi per lo stesso token", async () => {
    const a = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    const b = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    expect(a).not.toBe(b);
  });
});
