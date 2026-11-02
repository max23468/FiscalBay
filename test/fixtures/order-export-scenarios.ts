import { env } from "cloudflare:workers";

import ExcelJS from "exceljs";

import { strFromU8, unzipSync } from "fflate";

import { afterEach, beforeEach, expect, vi } from "vitest";

import { appCopy } from "../../app/app-copy";

import { type VisibleOrder } from "../../app/domain/orders.server";

import { action as exportAction } from "../../app/routes/order-export";

import { loader as exportFileLoader } from "../../app/routes/export-file";

import { action as settingsAction, loader as loadSettings } from "../../app/routes/settings";

import { exportRevision } from "../../app/domain/export-files.server";

import { queueOrderFile, type OrderFileRequest } from "../../app/domain/export-jobs.server";

import { listNotifications } from "../../app/domain/notifications.server";

import { verifiedSession } from "./account-fixtures";

import { queued } from "./queue-fixture";

import {
  insertEntitlement,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./database-fixtures";

import { callRoute, routePage, routeResponse } from "./route-fixtures";

export const it_ = appCopy.it;

/** Ordine visibile minimo per le righe del file, con i campi che la prova cambia. */
export function visible(overrides: Partial<VisibleOrder> = {}): VisibleOrder {
  return {
    id: "o-1",
    ebayOrderId: "01-00001",
    creationTime: "2026-09-13T20:00:00.000Z",
    lastModifiedTime: "2026-09-14T08:30:00.000Z",
    currency: "EUR",
    totalMinor: 1599,
    storeId: "s-a",
    storeName: "Negozio",
    marketplaceId: "EBAY_IT",
    provisional: false,
    summary: {
      buyer: {
        username: "acquirente",
        name: "Mario Rossi",
        email: "mario@example.invalid",
        phone: "+39 333 000 1000",
        billingAddress: {
          addressLine1: "Via Roma 1",
          addressLine2: "Scala B",
          city: "Roma",
          postalCode: "00184",
          stateOrProvince: "RM",
          countryCode: "IT",
        },
        shipTo: null,
        masked: undefined,
      },
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "NOT_STARTED",
      payment: "paid",
      shipping: "to_ship",
      lineItems: [
        {
          lineItemId: "l-1",
          title: "Lampada",
          quantity: 2,
          sku: "007",
          totalMinor: 1000,
          currency: "EUR",
          imageUrl: null,
          stableKey: null,
        },
        {
          lineItemId: "l-2",
          title: "Cavo",
          quantity: 1,
          sku: null,
          totalMinor: 599,
          currency: "EUR",
          imageUrl: null,
          stableKey: null,
        },
      ],
    },
    fiscalState: "available",
    taxVerification: "completed",
    taxAvailability: "present",
    taxCheckedAt: "2026-09-13T21:00:00.000Z",
    firstTaxAvailableAt: "2026-09-13T21:00:00.000Z",
    lockedShownAs: "CF",
    reconciliationIssue: false,
    taxIdentifiers: [],
    ...overrides,
  };
}

export const tax = (type: string, value: string, issuingCountry: string | null = "IT") => ({
  type,
  issuingCountry,
  value,
  source: "ebay_trading_get_orders",
  observedAt: now,
  quality: "valid" as const,
  updated: false,
});

export let cookie: string;

export let userId: string;

/** Crea il file e, come il browser, segue il rimando al suo download. */
export const request = async (
  query: string,
  fields: Record<string, string> = {},
  options: { json?: boolean; origin?: string | null; cookie?: string | null } = {},
) => {
  const headers: Record<string, string> =
    options.json === false ? {} : { accept: "text/csv, application/json" };
  const response = await routeResponse(
    exportAction,
    `/api/v1/orders/export${query ? `?${query}` : ""}`,
    {
      cookie: options.cookie === undefined ? cookie : options.cookie,
      origin: options.origin,
      headers,
      fields: { language: "it", ...fields },
    },
  );
  const location = response.headers.get("location") ?? "";
  const file = /^\/api\/v1\/exports\/([^/]+)$/u.exec(location)?.[1];
  if (response.status !== 303 || !file) return response;
  return routeResponse(exportFileLoader, location, { cookie, headers, params: { file } });
};

/** Righe del CSV senza BOM, con l'intestazione come chiavi. */
export async function csv(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(bytes.subarray(3));
  expect(text.endsWith("\r\n")).toBe(true);
  const parse = (line: string) =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/gu)].map(([, value]) =>
      value!.replaceAll('""', '"'),
    );
  const [header, ...lines] = text.trimEnd().split("\r\n").map(parse);
  return {
    text,
    rows: lines.map((cells) => Object.fromEntries(header!.map((name, i) => [name, cells[i]]))),
  };
}

export const premium = () =>
  insertEntitlement({
    source: "admin",
    endsAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();

/** Foglio dell'XLSX letto da un altro lettore, con l'XML del foglio per cercare valori. */
export async function xlsx(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0]!;
  const rows = sheet.getSheetValues().slice(1) as unknown[][];
  return {
    xml: strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]!),
    rows: rows.map((row) => row.slice(1)),
  };
}

/** Esito di un'azione delle Impostazioni, con lo stato HTTP. */
export async function settingsIntent(fields: Record<string, string>, as = cookie) {
  const result: unknown = await callRoute(settingsAction, "/app/impostazioni/esportazione", {
    cookie: as,
    fields,
  });
  if (result && typeof result === "object" && "init" in result && "data" in result)
    return {
      status: (result.init as ResponseInit | null)?.status ?? 200,
      body: result.data,
    };
  return { status: 200, body: result };
}

export const configurations = async () =>
  (
    await routePage(loadSettings, "/app/impostazioni/esportazione", {
      cookie,
      params: { sezione: "esportazione" },
    })
  ).page.exportConfigurations;

/** File creato dall'azione: identificativo dal rimando al download. */
export async function created(query = "ordini=o-a", fields: Record<string, string> = {}) {
  const response = await routeResponse(exportAction, `/api/v1/orders/export?${query}`, {
    cookie,
    headers: { accept: "text/csv, application/json" },
    fields: { language: "it", ...fields },
  });
  expect(response.status).toBe(303);
  const id = /^\/(?:en\/)?api\/v1\/exports\/([0-9a-f-]{36})$/u.exec(
    response.headers.get("location") ?? "",
  )?.[1];
  expect(id).toBeDefined();
  return id!;
}

export const download = (id: string, options: { json?: boolean; cookie?: string | null } = {}) =>
  routeResponse(exportFileLoader, `/api/v1/exports/${id}`, {
    cookie: options.cookie === undefined ? cookie : options.cookie,
    headers: options.json === false ? {} : { accept: "text/csv, application/json" },
    params: { file: id },
  });

export const gone = async (response: Response) => {
  expect(response.status).toBe(410);
  expect(await response.json()).toEqual({ ok: false, notice: it_.settings.export.exportGone });
};

/** Scadenza registrata di un file. */
export const expiry = (id: string) =>
  env.DB.prepare("SELECT expires_at FROM export_files WHERE id = ?").bind(id).first("expires_at");

export const hours = (count: number) => new Date(Date.parse(now) + count * 3_600_000).toISOString();

/** Richiesta di un lavoro sugli ordini indicati, accodata con la revisione corrente. */
export async function queuedJob(request: Partial<OrderFileRequest> = {}) {
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
  try {
    const id = await queueOrderFile(env, {
      userId,
      revision: await exportRevision(env.DB, userId),
      request: {
        environment: "production",
        filter: { ids: ["o-a", "o-c"], criteria: {} },
        rows: "order",
        format: "csv",
        columns: null,
        language: "it",
        timeZone: "Europe/Rome",
        ...request,
      },
      fileName: "fiscalbay-ordini-2026-09-13.csv",
      now: new Date(),
    });
    expect(id).not.toBeNull();
    expect(send).toHaveBeenCalledExactlyOnceWith({ exportJob: id });
    return id!;
  } finally {
    send.mockRestore();
  }
}

export const job = (id: string) =>
  env.DB.prepare(
    "SELECT state, file_id, request_sealed, locked_until, finished_at FROM export_jobs WHERE id = ?",
  )
    .bind(id)
    .first<{
      state: string;
      file_id: string | null;
      request_sealed: string | null;
      locked_until: string | null;
      finished_at: string | null;
    }>();

export const sectionFiles = async () =>
  (
    await routePage(loadSettings, "/app/impostazioni/esportazione", {
      cookie,
      params: { sezione: "esportazione" },
    })
  ).page.exportFiles;

export const bell = () => listNotifications(env.DB, userId, [], "it", "Europe/Rome", new Date());

export function setupScenarios() {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
    const session = await verifiedSession(`export-${crypto.randomUUID()}@example.invalid`);
    cookie = session.cookie;
    userId = session.userId;
    const at = (minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'").bind(
        session.userId,
      ),
      // o-a ha già i suoi identificativi; o-c è bloccato con una formula nel titolo, o-d estero,
      // o-p un acquisto non ancora pagato.
      env.DB.prepare(
        `INSERT INTO orders
          (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor,
           payment_status, buyer_json, is_provisional)
         VALUES ('o-c', 's-a', 'ebay-c', ?1, ?1, 'EUR', 500, 'PAID', NULL, 0),
                ('o-d', 's-a', 'ebay-d', ?2, ?2, 'EUR', 700, 'PAID', ?3, 0),
                ('o-p', 's-a', 'ebay-p', ?2, ?2, 'EUR', 900, 'PENDING', NULL, 1)`,
      ).bind(
        at(10),
        at(20),
        JSON.stringify({
          username: "kunde",
          name: "Hans",
          email: null,
          phone: null,
          billingAddress: { countryCode: "DE", city: "Berlin" },
          shipTo: null,
        }),
      ),
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
         VALUES ('i-c', 'o-c', 'line-c', '=HYPERLINK("http://x.invalid")', 1, 500, 'EUR')`,
      ),
      insertTaxIdentifiers({
        id: "t-c",
        orderId: "o-c",
        type: "CODICE_FISCALE",
        value: "VRDGPP80A01H501X",
        source: "ebay_trading_get_orders",
      }),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
         VALUES ('o-d', 'ebay_fulfillment', ?, 'absent')`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
         VALUES ('g-a', 'w-a', 'o-a', NULL, 'admin', ?)`,
      ).bind(now),
    ]);
  });
  afterEach(() => vi.useRealTimers());
}
