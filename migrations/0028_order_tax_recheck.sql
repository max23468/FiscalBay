-- Ordini letti prima del controllo fiscale: nessun esito registrato e nessuna lettura in attesa.
-- Si rileggono una volta, con il dettaglio Fulfillment o con la passata Trading del negozio,
-- così ogni ordine consultabile ha un esito. Un ordine che resta senza esito risulta una lettura
-- non riuscita, da riprovare.
UPDATE order_source_refs SET detail_for = NULL, detail_attempts = 0, detail_retry_at = NULL
 WHERE source = 'fulfillment' AND detail_error IS NULL
   AND detail_for IS last_modified_time
   AND NOT EXISTS (SELECT 1 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
                    WHERE original.id = order_source_refs.order_id
                       OR original.merged_into = order_source_refs.order_id);

UPDATE sync_state SET trading_cursor = NULL, trading_end = NULL, trading_page = NULL,
       trading_total = NULL
 WHERE history_from IS NOT NULL
   AND store_id IN (SELECT o.store_id FROM orders o
                     WHERE o.merged_into IS NULL
                       AND EXISTS (SELECT 1 FROM order_source_refs r
                                    WHERE r.order_id = o.id AND r.source = 'trading')
                       AND NOT EXISTS (SELECT 1 FROM order_source_refs r
                                        WHERE r.order_id = o.id AND r.source = 'fulfillment')
                       AND NOT EXISTS (SELECT 1 FROM order_tax_checks tc
                                        JOIN orders original ON original.id = tc.order_id
                                        WHERE original.id = o.id OR original.merged_into = o.id));
