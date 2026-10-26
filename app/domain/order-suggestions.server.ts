import { activeEntitlementSql, orderAccessSql } from "./grants.server";
import { consultableStore, listedOrder, storeNameSql } from "./store-state.server";
import { buyerTaxKey, taxIdentifierType, taxQuality } from "../tax-quality";
import type { SuggestionView, EbayEnvironment } from "../view-models";

type Suggestions = {
  suggestions: SuggestionView[];
  suggestionStatus?: "identity_missing" | "none" | "ambiguous";
};

/** Nessuna copia persistente: ogni lettura riconvalida piano, fonte, accesso e conservazione. */
export async function orderSuggestions(
  db: D1Database,
  userId: string,
  ids: string[],
  environment: EbayEnvironment,
  now: Date,
): Promise<Map<string, Suggestions>> {
  if (!ids.length) return new Map();
  const { results } = await db
    .prepare(`WITH targets AS (
    SELECT o.id, o.creation_time, o.buyer_eias_token, s.workspace_id
      FROM orders o JOIN ebay_stores s ON s.id = o.store_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
     WHERE wm.user_id = ?1 AND s.ebay_environment = ?2
       AND o.id IN (SELECT value FROM json_each(?3))
       AND o.merged_into IS NULL AND o.retention_until > ?4 AND ${consultableStore("s")}
       AND ${activeEntitlementSql("s.workspace_id", "?4")}
  ) SELECT target.id AS target_id, target.buyer_eias_token,
      o.id AS source_id, o.ebay_order_id, o.creation_time,
      ${storeNameSql("s")} AS store_name,
      t.identifier_type, t.issuing_country, t.value, t.source
    FROM targets target
    LEFT JOIN orders o ON o.buyer_eias_token = target.buyer_eias_token
      AND o.id <> target.id AND o.creation_time < target.creation_time
      AND ${listedOrder("o", "?4")}
      AND EXISTS (SELECT 1 FROM ebay_stores allowed WHERE allowed.id = o.store_id
        AND allowed.workspace_id = target.workspace_id AND allowed.ebay_environment = ?2
        AND ${consultableStore("allowed")})
      AND ${orderAccessSql("o.id", "target.workspace_id", "?4")}
    LEFT JOIN ebay_stores s ON s.id = o.store_id
    LEFT JOIN tax_identifiers t ON t.order_id = o.id AND t.removed_at IS NULL
      AND t.source IN ('ebay_fulfillment', 'ebay_trading_get_orders')
    ORDER BY o.creation_time DESC`)
    .bind(userId, environment, JSON.stringify(ids), now.toISOString())
    .all<{
      target_id: string;
      buyer_eias_token: string | null;
      source_id: string | null;
      ebay_order_id: string;
      creation_time: string;
      store_name: string;
      identifier_type: string | null;
      issuing_country: string | null;
      value: string;
      source: string;
    }>();
  const output = new Map<string, Suggestions>();
  const groups = new Map<string, Map<string, typeof results>>();
  for (const row of results) {
    if (!output.has(row.target_id))
      output.set(row.target_id, {
        suggestions: [],
        suggestionStatus: row.buyer_eias_token ? "none" : "identity_missing",
      });
    if (!row.identifier_type) continue;
    const kind = taxIdentifierType(row.identifier_type, row.issuing_country);
    // Entrambe le fonti adottate forniscono identificativi del buyer, mai del seller/eBay.
    const country = kind === "OTHER" ? row.issuing_country : "IT";
    const key = JSON.stringify([kind === "OTHER" ? row.identifier_type : kind, country]);
    const target = groups.get(row.target_id) ?? new Map<string, typeof results>();
    const group = target.get(key) ?? [];
    group.push(row);
    target.set(key, group);
    groups.set(row.target_id, target);
  }
  for (const [id, kinds] of groups) {
    const result = output.get(id)!;
    delete result.suggestionStatus;
    for (const rows of kinds.values()) {
      const latest = rows.filter((row) => row.creation_time === rows[0]!.creation_time);
      const normalized = (row: (typeof rows)[number]) =>
        buyerTaxKey({
          type: row.identifier_type!,
          issuingCountry: row.issuing_country,
          value: row.value,
        });
      if (
        new Set(latest.map((row) => row.source_id)).size > 1 ||
        new Set(latest.map(normalized)).size > 1
      ) {
        result.suggestionStatus = "ambiguous";
        continue;
      }
      const row = latest.find((item) => item.source === "ebay_fulfillment") ?? latest[0]!;
      const type = taxIdentifierType(row.identifier_type!, row.issuing_country);
      result.suggestions.push({
        value: row.value,
        identifier: {
          type,
          typeLabel: row.identifier_type!,
          value: row.value,
          quality: taxQuality(
            { type: row.identifier_type!, issuingCountry: row.issuing_country, value: row.value },
            [],
          ),
        },
        issuingCountry: row.issuing_country,
        sourceOrder: row.ebay_order_id,
        sourceDate: row.creation_time,
        sourceStore: row.store_name,
        source: row.source,
        conflict: new Set(rows.map(normalized)).size > 1,
      });
    }
  }
  return output;
}
