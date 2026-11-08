# Registrazione più rapida

## Changelog

### Novità

#### Miglioramenti

- **Conferma con un codice.** Dopo la registrazione puoi inserire il codice di 6 cifre ricevuto via email, senza cambiare scheda, oppure aprire il link come prima.
- **Un solo passaggio con eBay.** Chi si registra con eBay autorizza insieme account e negozio: il negozio si collega da solo appena l'email è confermata.
- **Registrazione più veloce.** Il pulsante «Registrati» risponde prima, perché i controlli di sicurezza partono mentre compili il modulo.

### What's new

#### Improvements

- **Confirm with a code.** After signing up you can enter the 6-digit code from the email without changing tab, or open the link as before.
- **One step with eBay.** When you sign up with eBay you authorize account and store together: the store connects by itself as soon as your email is confirmed.
- **Faster sign-up.** The «Sign up» button responds sooner, because the security checks start while you fill in the form.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D327 | **Registrazione più rapida** | L'email di conferma porta un codice di 6 cifre e il link, validi 60 minuti: il primo usato annulla l'altro, il codice ammette 5 tentativi e si conserva come impronta. Il codice errato, esaurito o per un indirizzo senza codice ha la stessa risposta. La pagina dopo l'invio offre il campo, il nuovo invio e l'apertura di Gmail, Outlook e Yahoo. «Registrati con eBay» chiede in un solo consenso anche lettura degli ordini e notifiche: il consenso resta cifrato fino a email e profilo completi, per al massimo 24 ore, e la riga dell'accesso eBay non ne conserva i token; «Accedi con eBay» non chiede permessi in più. Nella registrazione Turnstile parte al primo campo toccato e un token scaduto si sostituisce all'invio, a precisazione di D231; il controllo delle password trapelate parte all'uscita dal campo. | Scelta owner del 2026-11-08 | Implementato · [Requisito](../docs/product/ACCOUNTS_AND_STORES.md#s07) |
