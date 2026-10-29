-- Registro delle scadenze delle credenziali dell'ambiente (§29): nomi logici e date, copiati
-- dall'inventario privato con `scripts/credential-expiries.mjs`, mai valori o riferimenti di
-- custodia. Una data assente è una voce da completare. La console ne ricava le anomalie: una
-- scadenza entro 45 giorni avvisa l'owner, una scaduta è grave.
CREATE TABLE credential_expiries (
  name TEXT PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 80),
  expires_on TEXT CHECK (expires_on IS NULL OR date(expires_on) = expires_on),
  recorded_at TEXT NOT NULL CHECK (julianday(recorded_at) IS NOT NULL)
) WITHOUT ROWID;
