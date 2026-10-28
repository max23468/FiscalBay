import { z } from "zod";

/**
 * Contratto di una lettura eBay di un ordine, comune ai client Fulfillment e Trading, alla
 * registrazione e alla lettura degli ordini salvati.
 */

const text = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
/** Istante UTC normalizzato al formato ISO di D1. */
export const utc = z.iso.datetime().transform((value) => new Date(value).toISOString());
const money = z.object({
  minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/u),
});
const address = z
  .object({
    addressLine1: text,
    addressLine2: text,
    city: text,
    postalCode: text,
    stateOrProvince: text,
    countryCode: text,
  })
  .nullish()
  .transform((value) => value ?? null);

/** Campi che eBay smette di restituire con l'età dell'ordine. */
export const maskedBuyerFields = [
  "email",
  "name",
  "phone",
  "billingAddress.addressLine1",
  "shipTo.name",
  "shipTo.phone",
  "shipTo.address.addressLine1",
] as const;
export type MaskedBuyerField = (typeof maskedBuyerFields)[number];

/**
 * Snapshot dell'ordine: l'ordine dei campi è fisso, così la stessa lettura dà lo stesso testo.
 * `masked` elenca i campi mascherati da eBay e mai letti prima; vuoto non compare.
 */
export const buyerSnapshotSchema = z.object({
  username: text,
  name: text,
  email: text,
  phone: text,
  billingAddress: address,
  shipTo: z
    .object({ name: text, phone: text, address })
    .nullish()
    .transform((value) => value ?? null),
  masked: z
    .array(z.enum(maskedBuyerFields))
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});
export type BuyerSnapshot = z.output<typeof buyerSnapshotSchema>;

/**
 * Lettura normalizzata di un ordine da una fonte eBay. `stableKey` è l'identità della riga
 * comprovata dalla fonte, null se la fonte non la fornisce. `taxIdentifiers.complete` dichiara
 * che l'assenza di un valore è una rimozione autorevole; altrimenti i valori assenti restano.
 */
export const orderObservationSchema = z.object({
  source: z.enum(["fulfillment", "trading"]),
  /** Identità stabile dal solo campo EIASToken dell'ordine Trading, mai dallo username. */
  buyerEiasToken: z.string().trim().min(1).max(2048).nullish(),
  externalOrderId: z.string().min(1),
  provisional: z.boolean(),
  creationTime: utc,
  lastModifiedTime: utc,
  marketplaceId: text,
  total: money,
  paymentStatus: text,
  fulfillmentStatus: text,
  cancelStatus: text,
  buyer: buyerSnapshotSchema,
  items: z.array(
    z.object({
      lineItemId: z.string().min(1),
      // ID dell'inserzione per leggere l'immagine; non si salva.
      legacyItemId: text,
      stableKey: z.string().min(1).nullable(),
      title: z.string(),
      sku: text,
      quantity: z.number().int().positive(),
      total: money.nullable(),
      // URL qualificato dell'immagine; se assente resta quello già salvato.
      imageUrl: z.string().url().optional(),
    }),
  ),
  taxIdentifiers: z
    .object({
      source: z.enum(["ebay_trading_get_orders", "ebay_fulfillment"]),
      complete: z.boolean(),
      availability: z.enum(["present", "absent", "not_included", "masked", "removed"]).optional(),
      verification: z.enum(["completed", "error"]).default("completed"),
      lastModifiedTime: utc.optional(),
      values: z.array(
        z.object({
          type: z.string().min(1),
          issuingCountry: text,
          value: z.string().min(1),
        }),
      ),
    })
    .optional(),
});
export type OrderObservation = z.input<typeof orderObservationSchema>;
