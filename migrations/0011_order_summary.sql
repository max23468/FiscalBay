-- Riepilogo strutturato eBay, senza identificativi fiscali o payload originali.
-- Gli ordini già acquisiti restano distinguibili dai riepiloghi ancora da importare.
ALTER TABLE orders ADD COLUMN summary_json TEXT CHECK (summary_json IS NULL OR json_valid(summary_json));
ALTER TABLE ebay_stores ADD COLUMN display_name TEXT;
