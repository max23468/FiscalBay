# Flusso OAuth

Documento di riferimento per l'onboarding self-service.

Stato attuale:

- il bot espone gia' `/connect` come entrypoint Telegram
- `/connect` crea una sessione preliminare in `oauth_link_sessions`
- se sulla VPS e' valorizzata `EBAY_OAUTH_CONNECT_BASE_URL`, il bot restituisce anche il link pubblico di avvio
- esiste anche un callback server minimale che valida `state`, scambia `code` con token e salva account/token nel `state.db`
- il salvataggio finale dei token usa ora cifratura Fernet con chiave `EBAY_TENANT_TOKEN_KEY`
- verso eBay il progetto usa ora il `RuName` registrato nel developer portal, non una callback URL libera, come `redirect_uri`
- il consenso OAuth include anche lo scope pubblico `commerce.identity.readonly`, cosi' il callback puo' salvare un identificativo account eBay reale
- il fallback plaintext resta solo come opt-in esplicito per dev o recovery controllato

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
- il callback server attuale gira come servizio separato `ebaycf-oauth` sulla VPS
- verso eBay il server usa `EBAY_OAUTH_RUNAME` oppure `EBAY_OAUTH_RUNAME_SANDBOX` come identificatore `redirect_uri`
- il callback pubblico del progetto usa `EBAY_OAUTH_CALLBACK_URL` o, in fallback, deriva la URL da `EBAY_OAUTH_CONNECT_BASE_URL`
- l'Accept URL associato al `RuName` nel portale eBay deve puntare proprio al callback pubblico esposto dal progetto
- il flusso target resta un account eBay attivo per utente e per environment
- il refresh token non resta in env e non viene mai considerato configurazione globale del bot
- il refresh token viene salvato solo in forma cifrata
- un token revocato o non piu' refreshabile porta l'account in stato da riconnettere

## Milestone tecnica prima dell'implementazione

1. introdurre schema dati tenant-aware senza cambiare ancora il comportamento single-tenant
2. spostare credenziali eBay da env globale a repository/account storage
   Stato attuale: il progetto usa gia' token tenant cifrati come percorso operativo normale del bot su VPS; il fallback `.env` resta solo per CLI o istanze legacy adminless.
3. creare endpoint o mini web app per avvio OAuth e callback
   Stato attuale: il comando `/connect`, la tabella `oauth_link_sessions` e il servizio web minimale esistono gia'; restano da rifinire deploy pubblico, RuName/Accept URL nel portale eBay, revoca remota e hardening finale del flusso.
4. aggiungere comandi `/connect`, `/disconnect` e `/account`
   Stato attuale: `/account`, `/connect` e `/disconnect` sono gia' presenti nel bot; resta da completare l'hardening finale del percorso end-to-end e la gestione completa del token storage sicuro.
   In piu', il bot espone gia' `/notifications on|off` e `/settings` per rendere piu' self-service anche la gestione della chat dopo il collegamento.
5. spostare scheduler e notifiche da stato globale a stato per tenant

## Questioni aperte

- dove ospitare il callback server
- come autenticare il ritorno al bot in modo semplice e sicuro
- come gestire utenti con piu' chat o piu' account eBay
