import { env } from "cloudflare:workers";
import { vi } from "vitest";
import { UpstreamError } from "../../app/integrations/http.server";
import { ebayConfiguration } from "../../app/integrations/ebay/environment.server";

export const configuration = ebayConfiguration(env, "production");
export const access = (fetcher: typeof fetch) => ({
  fetcher,
  configuration,
  accessToken: "token-sintetico",
});
export const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) =>
      error instanceof UpstreamError ? { failure: error.failure, ...error.details } : error,
  );
export const trading = (body: string) => vi.fn<typeof fetch>(async () => new Response(body));
export const withUser = (url: string) => Object.assign(new URL(url), { username: "utente" }).href;
export const ack = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</GetItemResponse>`;
export const tradingError = (code: string, classification = "RequestError", severity = "Error") =>
  ack(
    `<Ack>Failure</Ack><Errors><ShortMessage>NON-ESPORRE</ShortMessage><ErrorCode>${code}</ErrorCode>` +
      `<SeverityCode>${severity}</SeverityCode><ErrorClassification>${classification}</ErrorClassification></Errors>`,
  );

// Ordine sintetico: acquirente registrato, destinatario diverso con `c/o`, telefono
// strutturato, campi inattesi e marketplace dell'inserzione.
export const order = (overrides: Record<string, unknown> = {}) => ({
  orderId: "12-34567-89012",
  creationDate: "2026-09-01T08:00:00.000Z",
  lastModifiedDate: "2026-09-01T09:00:00.000Z",
  orderPaymentStatus: "PAID",
  orderFulfillmentStatus: "NOT_STARTED",
  cancelStatus: { cancelState: "NONE_REQUESTED", cancelRequests: [] },
  pricingSummary: { total: { value: "49.90", currency: "EUR" } },
  salesRecordReference: "NON-ESPORRE",
  buyer: {
    username: "acquirente-sintetico",
    buyerRegistrationAddress: {
      fullName: "Maria Verdi",
      email: "acquirente@example.invalid",
      primaryPhone: { phoneNumber: "+39 0461 000000", countryCode: "IT" },
      contactAddress: {
        addressLine1: "Via Fiscale 1",
        city: "Trento",
        postalCode: "38122",
        countryCode: "IT",
      },
    },
  },
  fulfillmentStartInstructions: [
    {
      shippingStep: {
        shipTo: {
          fullName: "Luca Neri c/o Hotel Sintetico",
          companyName: "NON-ESPORRE",
          primaryPhone: { phoneNumber: "+39 0461 111111" },
          contactAddress: {
            addressLine1: "Piazza Spedizione 2",
            addressLine2: "c/o Reception",
            city: "Bolzano",
            postalCode: "39100",
            countryCode: "IT",
          },
        },
      },
    },
  ],
  lineItems: [
    {
      lineItemId: "10000000001",
      legacyItemId: "110000000001",
      title: "Articolo sintetico",
      quantity: 1,
      lineItemCost: { value: "49.90", currency: "EUR" },
      listingMarketplaceId: "EBAY_IT",
      purchaseMarketplaceId: "EBAY_DE",
      nuovoCampoEbay: { valore: "NON-ESPORRE" },
    },
  ],
  ...overrides,
});
