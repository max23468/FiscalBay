-- Immagine dell'inserzione letta da Trading `GetItem`: solo URL HTTPS delle immagini eBay in
-- formato raster, mostrato dal browser senza che il server lo scarichi.
ALTER TABLE order_items ADD COLUMN image_url TEXT
  CHECK (image_url IS NULL OR image_url LIKE 'https://%');
