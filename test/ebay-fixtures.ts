import { vi } from "vitest";

export const syntheticOrderId = "12-00000-00001";
export const emptyTradingOrders =
  "<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>0</TotalNumberOfEntries></PaginationResult><HasMoreOrders>false</HasMoreOrders><OrderArray></OrderArray></GetOrdersResponse>";
export const syntheticTradingXml = `<?xml version="1.0" encoding="UTF-8"?>
<GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <OrderArray>
    <Order>
      <OrderID>${syntheticOrderId}</OrderID>
      <BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SYNTHETIC&amp;ID</ID></BuyerTaxIdentifier>
    </Order>
    <Order>
      <OrderID>12-00000-00002</OrderID>
      <BuyerTaxIdentifier><Type>VAT_ID</Type><ID>ALTRO-ORDINE</ID></BuyerTaxIdentifier>
    </Order>
  </OrderArray>
</GetOrdersResponse>`;

export function syntheticEbay(
  options: {
    username?: string;
    trading?: () => Response;
    token?: () => Response;
    orderId?: string;
    lastModifiedDate?: string;
    orders?: unknown[];
    ordersPayload?: unknown;
    userId?: string;
  } = {},
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/identity/v1/oauth2/token")) {
      if (options.token) return options.token();
      return Response.json({
        access_token: "token-sintetico",
        expires_in: 7200,
        refresh_token: "refresh-sintetico",
        refresh_token_expires_in: 47_304_000,
      });
    }
    if (url.includes("/commerce/identity/v1/user/")) {
      return Response.json({
        userId: options.userId ?? "ebay-user-sintetico",
        username: options.username ?? "venditore",
      });
    }
    if (url.includes("/sell/fulfillment/v1/order")) {
      const payload = (options.ordersPayload ??
        (options.orders ? { orders: options.orders, total: 0 } : syntheticOrders())) as {
        orders?: Array<{ orderId: string }>;
      };
      // `getOrder` legge il singolo ordine dell'elenco.
      const single = new URL(url).pathname.split("/sell/fulfillment/v1/order/")[1];
      if (single === undefined) return Response.json(payload);
      const found = payload.orders?.find(({ orderId }) => orderId === decodeURIComponent(single));
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    if (url.endsWith("/ws/api.dll")) {
      if (String(init?.body).includes("<ModTimeFrom>")) return new Response(emptyTradingOrders);
      return options.trading?.() ?? new Response(syntheticTradingXml);
    }
    return new Response(null, { status: 404 });
  });

  function syntheticOrders() {
    return {
      orders: [
        {
          orderId: options.orderId ?? syntheticOrderId,
          creationDate: "2026-09-20T10:00:00.000Z",
          lastModifiedDate: options.lastModifiedDate ?? "2026-09-20T11:00:00.000Z",
          pricingSummary: { total: { value: "12.5", currency: "EUR" } },
          buyer: { username: "acquirente-sintetico", taxIdentifier: { value: "NON-ESPORRE" } },
          orderPaymentStatus: "PAID",
          orderFulfillmentStatus: "NOT_STARTED",
          lineItems: [
            {
              lineItemId: "riga-sintetica",
              title: "Articolo sintetico",
              quantity: 2,
              sku: "SKU-SINTETICO",
            },
          ],
        },
      ],
      total: 1,
    };
  }
}
