-- Sessione aperta da una passkey con verifica dell'utente sul dispositivo
-- (impronta, volto o PIN): è il secondo fattore richiesto all'area admin.
ALTER TABLE "session" ADD COLUMN "passkeyVerified" INTEGER NOT NULL DEFAULT 0;

-- Accesso all'area amministrativa. Si concede e si revoca soltanto con
-- l'accesso tecnico al database, mai da un percorso dell'app.
ALTER TABLE "user" ADD COLUMN "admin" INTEGER NOT NULL DEFAULT 0;
