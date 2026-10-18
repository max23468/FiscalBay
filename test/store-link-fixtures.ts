import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { action as startStoreLink } from "../app/routes/store-link";

export async function beginStoreLink(cookie: string): Promise<URL> {
  const response = (await startStoreLink({
    request: new Request("http://localhost:5173/app/negozi/collega", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:5173" },
    }),
  } as Parameters<typeof startStoreLink>[0])) as Response;
  expect(response.status).toBe(303);
  return new URL(response.headers.get("location")!);
}

export function storeCallback(query: string, cookie: string): Request {
  return new Request(`http://localhost:5173/api/auth/callback/ebay?${query}`, {
    headers: { cookie },
  });
}

export async function storeLinkSessions(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_store_link_sessions").first<{
    total: number;
  }>();
  return row!.total;
}
