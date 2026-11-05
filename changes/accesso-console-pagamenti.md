# Accesso, console e pagamenti

## Changelog

### Novità

#### Miglioramenti

- **Ultimo metodo di accesso.** La pagina di accesso segna Google, eBay o la passkey quando li hai usati per l'ultimo accesso da questo browser.
- **Password violate rifiutate sempre.** Una nuova password che compare in violazioni di dati note viene rifiutata anche quando il controllo nel browser non può partire.
- **Accesso più protetto.** Dopo alcuni tentativi non riusciti, l'accesso con password chiede una breve verifica di sicurezza.

### What's new

#### Improvements

- **Last sign-in method.** The sign-in page marks Google, eBay or your passkey when you used it for your last sign-in on this browser.
- **Breached passwords always refused.** A new password that appears in known data breaches is refused even when the check in your browser cannot run.
- **Better protected sign-in.** After a few failed attempts, signing in with a password asks for a short security check.

### Altre modifiche

- La preparazione dell'accesso con passkey ha il limite per IP e la pulizia delle tabelle di Auth usa indici sulla scadenza.
- La regola di zona contro le raffiche copre anche le pagine di accesso e assistenza.
- Il token tecnico della console scade dopo 90 giorni e dieci token rifiutati dallo stesso IP bloccano i tentativi per 15 minuti.
- I token dei negozi eBay si cifrano con un segreto proprio, separato da quello di Auth; quelli cifrati con la chiave precedente si ricifrano al rinnovo.
- Stripe usa una versione dell'API fissata, un timeout di 8 secondi nelle richieste dell'utente e chiavi di idempotenza su sessioni di pagamento e coupon.
