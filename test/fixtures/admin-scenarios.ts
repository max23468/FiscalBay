import { env } from "cloudflare:workers";

import { afterEach, beforeEach, vi } from "vitest";

import { action as adminAction, loader as adminLoader } from "../../app/routes/admin";

import { verifiedSession } from "./account-fixtures";

import { now, resetDatabase } from "./database-fixtures";

import { callRoute, routeData } from "./route-fixtures";

export const at = (iso: string) => new Date(iso);

export const hour = 3_600_000;

export const later = (ms: number, from = now) => new Date(Date.parse(from) + ms).toISOString();

/** Admin con la sessione confermata da una passkey verificata. */
export async function admin(email = "admin.console@example.invalid") {
  const session = await verifiedSession(email);
  await env.DB.batch([
    env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(session.userId),
    env.DB.prepare('UPDATE "session" SET "passkeyVerified" = 1 WHERE "userId" = ?').bind(
      session.userId,
    ),
  ]);
  return session;
}

export async function audit() {
  return (
    await env.DB.prepare(
      "SELECT operation, target, reason, outcome FROM admin_audit ORDER BY at, rowid",
    ).all()
  ).results;
}

/** Stato della route admin: 404 per chi non ha accesso, altrimenti livello e sezione. */
export async function page(cookie: string, path = "/admin", params: Record<string, string> = {}) {
  try {
    const result = await routeData(adminLoader, path, { cookie, params });
    return { access: result.access, section: result.page?.section ?? null };
  } catch (error) {
    return (error as { init?: { status?: number } }).init?.status;
  }
}

export async function act(cookie: string, fields: Record<string, string>, origin?: string | null) {
  const result = await callRoute(adminAction, "/admin", { cookie, fields, origin });
  const wrapped = result as unknown as { data?: unknown; init?: { status?: number } };
  return "init" in wrapped && wrapped.init
    ? { status: wrapped.init.status, ...(wrapped.data as object) }
    : (result as object);
}

export function setupScenarios() {
  beforeEach(resetDatabase);
  afterEach(() => vi.restoreAllMocks());
}
