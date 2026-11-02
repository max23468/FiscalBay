import { env } from "cloudflare:workers";

import { afterEach, beforeEach, vi } from "vitest";

import { unlockOrders } from "../../app/domain/grants.server";

import { handleAuthRequest } from "../../app/auth-route.server";

import { action as storesAction, loader as loadStores } from "../../app/routes/stores";

import { action as settingsAction, loader as loadSettings } from "../../app/routes/settings";

import { resetDatabase } from "./database-fixtures";

import { syntheticEbay } from "./ebay-fixtures";

import { verifiedSession } from "./account-fixtures";

import { beginStoreLink, storeCallback } from "./store-link-fixtures";

import { callRoute, testOrigin } from "./route-fixtures";

export const day = 24 * 60 * 60 * 1000;

export const hour = 60 * 60 * 1000;

export async function linkThroughEbay(cookie: string, ebay = syntheticEbay()) {
  const state = (await beginStoreLink(cookie)).searchParams.get("state");
  return handleAuthRequest(storeCallback(`state=${state}&code=codice`, cookie), env, ebay);
}

export async function linkedSeller(email: string) {
  const session = await verifiedSession(email);
  await linkThroughEbay(session.cookie);
  const store = await env.DB.prepare("SELECT id, workspace_id FROM ebay_stores").first<{
    id: string;
    workspace_id: string;
  }>();
  return { ...session, storeId: store!.id, workspaceId: store!.workspace_id };
}

export async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{
    total: number;
  }>();
  return row!.total;
}

/** Sblocca l'ordine importato consumando un posto del ciclo Free. */
export async function grantImportedOrder(seller: { userId: string; workspaceId: string }) {
  await env.DB.prepare(
    `INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
       VALUES ('ciclo', ?, ?, ?, 5)`,
  )
    .bind(
      seller.workspaceId,
      new Date(Date.now() - day).toISOString(),
      new Date(Date.now() + day).toISOString(),
    )
    .run();
  const order = await env.DB.prepare("SELECT id FROM orders").first<{ id: string }>();
  await unlockOrders(env.DB, seller.userId, [order!.id]);
}

export async function quotaUsed(): Promise<number> {
  const row = await env.DB.prepare("SELECT used FROM free_cycles").first<{ used: number }>();
  return row!.used;
}

export function storesPage(path: string, cookie: string) {
  return callRoute(loadStores, path, { cookie, params: { negozio: path.split("/negozi/")[1] } });
}

export function storeForm(cookie: string, fields: Record<string, string>, origin = testOrigin) {
  return callRoute(storesAction, "/app/negozi", { cookie, origin, fields });
}

export const origin = "http://localhost:5173";

export const settings = (cookie: string, path = "/app/impostazioni", sezione?: string) =>
  callRoute(loadSettings, path, { cookie, params: { sezione } }).catch((thrown: unknown) => {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  });

export const settingsPage = async (cookie: string) => {
  const loaded = await settings(cookie);
  if (loaded instanceof Response || !("page" in loaded)) throw new Error("pagina attesa");
  return loaded;
};

export const saveSetting = (cookie: string, fields: Record<string, string>, from = origin) =>
  callRoute(settingsAction, "/app/impostazioni", { cookie, origin: from, fields }).catch(
    (thrown: unknown) => thrown,
  );

export function setupScenarios() {
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());
  beforeEach(() => vi.useRealTimers());
}
