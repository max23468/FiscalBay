import { z } from "zod";

import { recordOrderObservation, writableStore } from "./order-import.server";
import { UpstreamError, upstreamJson, upstreamText } from "../integrations/http.server";
import { fulfillmentObservation } from "../integrations/ebay/fulfillment.server";
import type { ebayConfiguration } from "../integrations/ebay/environment.server";
import {
  mapTradingTaxIdentifiers,
  parseTradingOrderTaxIdentifiers,
} from "../integrations/ebay/tax-identifiers.server";

const ordersPageSchema = z.looseObject({ orders: z.array(z.unknown()).default([]) });
const tradingApiVersion = "1455";
const tradingSiteId = "101";

/** Importa l'ordine più recente con la relativa fonte fiscale Trading. */
export async function importLatestOrder(input: {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  accessToken: string;
  fetcher: typeof fetch;
  now: string;
  configuration: ReturnType<typeof ebayConfiguration>;
}): Promise<void> {
  const { db, fetcher, now } = input;
  const page = await upstreamJson(fetcher, input.configuration.ordersUrl, ordersPageSchema, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  // Lettura riuscita: l'ultima sincronizzazione del negozio, senza toccare il cursore.
  const recordSync = () =>
    db
      .prepare(
        `INSERT INTO sync_state (store_id, last_success_at, updated_at)
         SELECT ?1, ?3, ?3 WHERE ${writableStore}
         ON CONFLICT(store_id) DO UPDATE SET
           last_success_at = excluded.last_success_at,
           updated_at = excluded.updated_at`,
      )
      .bind(input.storeId, input.grantedAt, now)
      .run();
  if (page.orders.length === 0) {
    await recordSync();
    return;
  }

  const observation = fulfillmentObservation(page.orders[0]);
  const trading = await upstreamText(fetcher, input.configuration.tradingUrl, {
    method: "POST",
    headers: {
      "content-type": "text/xml;charset=UTF-8",
      "x-ebay-api-call-name": "GetOrders",
      "x-ebay-api-siteid": tradingSiteId,
      "x-ebay-api-compatibility-level": tradingApiVersion,
      "x-ebay-api-iaf-token": input.accessToken,
    },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      `<Version>${tradingApiVersion}</Version><DetailLevel>ReturnAll</DetailLevel>` +
      "<OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>" +
      `<OrderIDArray><OrderID>${observation.externalOrderId.replace(/[<>&]/gu, "")}</OrderID></OrderIDArray>` +
      "</GetOrdersRequest>",
  })
    .then((xml) => ({
      values: mapTradingTaxIdentifiers(
        parseTradingOrderTaxIdentifiers(xml, observation.externalOrderId),
      ),
    }))
    .catch((error: unknown) => ({
      error: error instanceof UpstreamError ? error : new UpstreamError("invalid_response"),
    }));
  // Senza Trading l'ordine si salva comunque, senza dati fiscali. L'assenza del campo in
  // Trading non è ancora qualificata come rimozione autorevole.
  await recordOrderObservation(
    db,
    { storeId: input.storeId, consentGrantedAt: input.grantedAt, observedAt: now },
    "values" in trading
      ? {
          ...observation,
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: trading.values,
          },
        }
      : observation,
  );
  if ("error" in trading) throw trading.error;
  await recordSync();
}
