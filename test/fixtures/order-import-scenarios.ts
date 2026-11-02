import { env } from "cloudflare:workers";

import { afterEach, beforeEach, vi } from "vitest";

import { type OrderObservation } from "../../app/domain/order-observation.server";

import {
  insertCredentials,
  now,
  resetDatabase,
  resetOrderFixtures,
  seed,
} from "./database-fixtures";

export const grantedAt = "2026-09-01T00:00:00.000Z";

export const target = (storeId = "s-a", observedAt = now) => ({
  storeId,
  consentGrantedAt: grantedAt,
  observedAt,
});

export const line = (stableKey: string | null, lineItemId = `riga-${stableKey}`) => ({
  lineItemId,
  stableKey,
  title: `Articolo ${stableKey}`,
  quantity: 1,
  total: { minor: 1250, currency: "EUR" },
});

export const observation = (overrides: Partial<OrderObservation> = {}): OrderObservation => ({
  source: "fulfillment",
  externalOrderId: "D-1",
  provisional: false,
  creationTime: "2026-09-10T10:00:00Z",
  lastModifiedTime: "2026-09-10T11:00:00Z",
  total: { minor: 2500, currency: "EUR" },
  paymentStatus: "PAID",
  buyer: { username: "acquirente", name: "Mario Rossi" },
  items: [line("k1"), line("k2")],
  ...overrides,
});

export const provisional = (overrides: Partial<OrderObservation> = {}) =>
  observation({
    source: "trading",
    externalOrderId: "P-1",
    provisional: true,
    lastModifiedTime: "2026-09-10T10:30:00Z",
    paymentStatus: "PENDING",
    items: [line("k1", "t-1"), line("k2", "t-2")],
    ...overrides,
  });

export const orders = (storeId = "s-a") =>
  env.DB.prepare(
    `SELECT id, ebay_order_id, is_provisional, payment_status, buyer_json
         FROM orders WHERE store_id = ? ORDER BY ebay_order_id`,
  )
    .bind(storeId)
    .all()
    .then(({ results }) => results);

// Ordini non assorbiti, provvisori compresi: le viste mostrano soltanto i definitivi.
export const current = () =>
  env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE store_id = 's-a' AND merged_into IS NULL")
    .first<{ n: number }>()
    .then((row) => row!.n);

export function setupScenarios() {
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    await seed();
    await resetOrderFixtures();
    await env.DB.batch([
      insertCredentials({ accessExpiresAt: now, grantedAt }),
      insertCredentials({ storeId: "s-b", accessExpiresAt: now, grantedAt }),
    ]);
  });
}
