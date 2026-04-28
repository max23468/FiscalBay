# Flusso OAuth

Documento di riferimento per l'onboarding self-service.

Stato attuale:

- il bot espone gia' `/account collega` come entrypoint Telegram
- `/account collega` crea una sessione preliminare in `oauth_link_sessions`
- se sulla VPS e' valorizzata `EBAY_OAUTH_CONNECT_BASE_URL`, il bot restituisce anche il link pubblico di avvio
- l'entrypoint web `/oauth/start` mostra ora una pagina intermedia semplice e leggibile prima del consenso eBay
- esiste anche un callback server minimale che valida `state`, scambia `code` con token e salva account/token nel `state.db`
- il salvataggio finale dei token usa ora cifratura Fernet con chiave `EBAY_TENANT_TOKEN_KEY`
- verso eBay il progetto usa ora il `RuName` registrato nel developer portal, non una callback URL libera, come `redirect_uri`
- il consenso OAuth include anche lo scope pubblico `commerce.identity.readonly`, cosi' il callback puo' salvare un identificativo account eBay reale
- il fallback plaintext resta solo come opt-in esplicito per dev o recovery controllato

## Obiettivo

Permettere a un utente Telegram di collegare il proprio account eBay senza intervento manuale lato server.

## Flusso target

1. l'utente apre il bot e usa `/account collega`
2. il bot risponde con un link di collegamento
3. il link apre una pagina web controllata dal progetto
4. la pagina spiega il passaggio e avvia OAuth verso eBay
5. eBay autentica l'utente e chiede consenso
6. eBay richiama il callback del progetto con `code` e `state`
7. il backend valida `state`
8. il backend scambia `code` con token eBay
9. il backend salva l'account collegato e i token associati all'utente Telegram
10. il bot conferma in chat il collegamento riuscito
11. la pagina callback conferma l'esito e rimanda l'utente verso Telegram

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

## Matrice stati minima per Fase 1

Questa matrice fissa il comportamento minimo che useremo per completare la Fase 1 senza
reintrodurre ambiguita' nei messaggi Telegram.

### Stato utente Telegram

- `new`
  - utente visto dal bot ma non ancora approvato
  - puo' usare solo `/start`, `/help` e `/request_access`
  - messaggio atteso: il bot spiega che l'accesso e' approvato manualmente e indica la prossima azione
- `pending`
  - richiesta accesso registrata e in attesa di admin
  - non puo' ancora collegare eBay o leggere ordini
  - messaggio atteso: richiesta in attesa, nessuna azione extra oltre ad aspettare
- `approved`
  - utente approvato e operativo
  - puo' usare comandi account, ordini e notifiche
  - messaggio atteso: prossimo passo principale `/account collega` se l'account non e' ancora collegato
- `blocked`
  - accesso rifiutato o sospeso dall'admin
  - non puo' usare i comandi operativi
  - messaggio atteso: accesso non disponibile, contattare l'admin se necessario
- `admin`
  - admin globale del bot
  - puo' usare tutto, inclusi comandi di review utenti

### Stato account eBay mostrato all'utente

- `unlinked`
  - nessun collegamento attivo o storico utile
  - prossima azione: `/account collega`
- `linked`
  - account collegato e token usabile
  - prossima azione: nessuna, il bot puo' lavorare normalmente
- `reconnect_required`
  - account presente ma token non piu' usabile, revocato o scaduto
  - prossima azione: `/account collega`
- `disconnected`
  - utente ha scollegato il bot localmente
  - prossima azione: `/account collega`
- `revoked`
  - collegamento non piu' valido o revocato
  - prossima azione: `/account collega`
- `error`
  - stato incoerente o fallimento non classificato
  - prossima azione: messaggio chiaro di errore servizio e retry guidato

Regola UX:

- `/start` deve spiegare sempre lo stato reale dell'utente
- `/account` deve spiegare sempre lo stato reale del collegamento e la prossima azione richiesta
- `/account reconnect` deve riassumere rapidamente se serve reconnect e qual e' la prossima azione
- `/account scollega` oggi scollega localmente e rimuove il token locale; la revoca remota eBay resta uno step separato da completare

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
- la chat che avvia `/account collega` viene comunque tracciata per tornare con la conferma nel posto giusto
- il flusso usera' una tabella dedicata `oauth_link_sessions` con `state`, expiry e stato della richiesta
- il callback OAuth salva o aggiorna `ebay_accounts` e `ebay_tokens`, poi marca chiusa la sessione OAuth
- il callback server attuale gira come servizio separato `fiscalbay-oauth` sulla VPS
- verso eBay il server usa `EBAY_OAUTH_RUNAME` oppure `EBAY_OAUTH_RUNAME_SANDBOX` come identificatore `redirect_uri`
- il redirect di consenso invia `prompt=login`, cosi' eBay mostra un login fresco
  invece di riusare automaticamente la sessione web gia' autenticata su un altro
  account
- il callback pubblico del progetto usa `EBAY_OAUTH_CALLBACK_URL` o, in fallback, deriva la URL da `EBAY_OAUTH_CONNECT_BASE_URL`
- l'Accept URL associato al `RuName` nel portale eBay deve puntare proprio al callback pubblico esposto dal progetto
- il server espone anche `/` come mini sito vetrina e `/privacy` e `/about` sullo stesso host pubblico, cosi' il portale eBay puo' usare URL coerenti per Privacy Policy e About del branding OAuth
- il flusso target resta un account eBay attivo per utente e per environment
- lo stesso account eBay puo' essere collegato da piu' utenti Telegram distinti
- il refresh token non resta in env e non viene mai considerato configurazione globale del bot
- il refresh token viene salvato solo in forma cifrata
- la cache degli access token eBay deve restare separata per refresh token, cosi'
  uno scollegamento seguito dal collegamento di un account eBay diverso non puo'
  riusare in memoria il token del collegamento precedente
- un token revocato o non piu' refreshabile porta l'account in stato da riconnettere

## Milestone tecnica prima dell'implementazione

1. introdurre schema dati tenant-aware senza cambiare ancora il comportamento single-tenant
2. spostare credenziali eBay da env globale a repository/account storage
   Stato attuale: il progetto usa gia' token tenant cifrati come percorso operativo normale del bot su VPS; il fallback `.env` resta solo per CLI o istanze legacy adminless.
3. creare endpoint o mini web app per avvio OAuth e callback
   Stato attuale: il comando `/account collega`, la tabella `oauth_link_sessions` e il servizio web minimale esistono gia'; restano da rifinire deploy pubblico, RuName/Accept URL nel portale eBay, revoca remota e hardening finale del flusso.
4. aggiungere comandi `/account collega`, `/account scollega` e `/account`
   Stato attuale: `/account`, `/account collega` e `/account scollega` sono gia' presenti nel bot; resta da completare l'hardening finale del percorso end-to-end e la gestione completa del token storage sicuro.
   In piu', il bot espone gia' `/settings notifiche on|off` e `/settings` per rendere piu' self-service anche la gestione della chat dopo il collegamento.
5. spostare scheduler e notifiche da stato globale a stato per tenant

## Questioni aperte

- dove ospitare il callback server
- come autenticare il ritorno al bot in modo semplice e sicuro
- come gestire utenti con piu' chat o piu' account eBay
