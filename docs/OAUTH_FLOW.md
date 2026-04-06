# Flusso OAuth

Documento preparatorio per il futuro onboarding self-service.

Questo flusso non e' ancora implementato nel progetto corrente.

## Obiettivo

Permettere a un utente Telegram di collegare il proprio account eBay senza intervento manuale lato server.

## Flusso target

1. l'utente apre il bot e usa `/connect`
2. il bot risponde con un link di collegamento
3. il link apre una pagina web controllata dal progetto
4. la pagina avvia OAuth verso eBay
5. eBay autentica l'utente e chiede consenso
6. eBay richiama il callback del progetto con `code` e `state`
7. il backend valida `state`
8. il backend scambia `code` con token eBay
9. il backend salva l'account collegato e i token associati all'utente Telegram
10. il bot conferma in chat il collegamento riuscito

## Requisiti minimi

- `state` anti-CSRF
- mapping sicuro tra sessione OAuth e utente Telegram
- callback HTTPS
- storage sicuro dei token
- gestione errori leggibile per l'utente

## Stato applicativo da tracciare

- richiesta di collegamento aperta
- richiesta completata
- richiesta fallita
- account collegato
- account revocato o scollegato

## Dati da salvare

- identificativo utente Telegram
- identificativo chat Telegram che ha iniziato il flusso
- identificativo account eBay
- scope autorizzati
- refresh token cifrato
- scadenza access token
- timestamp di collegamento

## Decisioni di progettazione gia' fissate

- il tenant logico resta l'utente Telegram, non la singola chat
- la chat che avvia `/connect` viene comunque tracciata per tornare con la conferma nel posto giusto
- il flusso usera' una tabella dedicata `oauth_link_sessions` con `state`, expiry e stato della richiesta
- il callback OAuth salva o aggiorna `ebay_accounts` e `ebay_tokens`, poi marca chiusa la sessione OAuth
- per la prima beta il flusso target e' un account eBay attivo per utente e per environment
- il refresh token non resta in env e non viene mai considerato configurazione globale del bot
- il refresh token viene salvato solo in forma cifrata
- un token revocato o non piu' refreshabile porta l'account in stato da riconnettere

## Milestone tecnica prima dell'implementazione

1. introdurre schema dati tenant-aware senza cambiare ancora il comportamento single-tenant
2. spostare credenziali eBay da env globale a repository/account storage
3. creare endpoint o mini web app per avvio OAuth e callback
4. aggiungere comandi `/connect`, `/disconnect` e `/account`
5. spostare scheduler e notifiche da stato globale a stato per tenant

## Questioni aperte

- dove ospitare il callback server
- come autenticare il ritorno al bot in modo semplice e sicuro
- come gestire utenti con piu' chat o piu' account eBay
