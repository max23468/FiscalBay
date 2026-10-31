import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { action as startStoreLink } from "../../app/routes/store-link";
import { routeRequest, routeResponse } from "./route-fixtures";

export async function beginStoreLink(cookie: string): Promise<URL> {
  const response = await routeResponse(startStoreLink, "/app/negozi/collega", {
    cookie,
    fields: {},
  });
  expect(response.status).toBe(303);
  return new URL(response.headers.get("location")!);
}

export function storeCallback(query: string, cookie: string): Request {
  return routeRequest(`/api/auth/callback/ebay?${query}`, { cookie });
}

export async function storeLinkSessions(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_store_link_sessions").first<{
    total: number;
  }>();
  return row!.total;
}
