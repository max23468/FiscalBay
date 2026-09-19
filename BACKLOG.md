# FiscalBay 2.0 — Backlog eseguibile

**Stato corrente:** M0 avviata il 2026-09-13 sulla baseline approvata. Le prove locali indipendenti e le letture eBay autorizzate sono concluse; i gate che richiedono billing corrente, callback controllati e dati reali restano circoscritti e bloccati.

[Master Plan](docs/MASTER_PLAN.md) · [Decisioni](docs/DECISION_REGISTER.md) · [Setup agenti](docs/engineering/AGENT_SETUP.md)

## Regole di esecuzione

Stati: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`, `DEFERRED`. **Prerequisiti** indica ciò che serve per iniziare; **Per chiudere**, quando presente, aggiunge dipendenze d’integrazione che non impediscono di lavorare prima. DONE richiede tutti i prerequisiti, le dipendenze di chiusura e il criterio di completamento, con un breve riferimento a commit/test/prova effettivi. Non precompilare evidenze. BLOCKED registra causa, input/gate atteso e lavoro indipendente proseguibile.

`M0` indica milestone chiusa e approvata dove previsto; `M0-03..M0-13` include tutti i task dell’intervallo; `M2..M6` tutte le milestone comprese. `G-*` rinvia al gate del piano al livello richiesto dalla fase: non anticipa prove live future. I task possono cambiare ordine o granularità preservando i riferimenti; nessun obbligo di ID consecutivi.

Le dipendenze prevalgono sulla numerazione. Ingressi delle milestone descrivono la disponibilità dell’integrazione completa, non impediscono attività indipendenti esplicitamente avviabili prima. Una UI con fixture non chiude un’integrazione reale. Rispettare il [governo](docs/MASTER_PLAN.md#s00) per autonomia e cinque checkpoint; nuovi costi/provider o cambi sostanziali richiedono owner, non ogni comando tecnico.

Il piano contiene i requisiti completi: qui si descrivono il lavoro e la prova, senza copiarli per intero. Codice/schema/test possono attestare il contratto; le [responsabilità documentali](docs/engineering/AGENT_SETUP.md#deliverable) non impongono file vuoti. Questo rimane l’unico task tracker, con informazioni private tenute nella custodia appropriata.

<a id="stato"></a>

## Stato corrente e ripresa

Questa sezione è un registro operativo iniziale, **non una prova di avvio già autorizzato**. Aggiornarla nello stesso intervento dei task pertinenti; non creare `STATUS.md`, `NEXT_STEPS.md` o un secondo backlog con informazioni concorrenti.

| Campo                                                       | Stato osservato il 2026-09-19                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Milestone / task in esecuzione                              | M0; gate account/provider M0-02..06, M0-08/09/12/13                                                       |
| Prossimo task eleggibile                                    | Preparare callback HTTPS su `test.fiscalbay.it` e trasporto email; configurare poi Google OAuth dedicato   |
| Repository / branch / commit osservati nell’implementazione | `max23468/FiscalBay`; worktree `/Users/Matteo/Progetti/FiscalBay-m0`, branch `codex/adopt-2-0-m0`, ultimo commit verificato `deebe17`, base `origin/main` `ffc4f56` |
| Blocchi noti iniziali                                       | Attivazione e prova Stripe non autorizzate; destinazione di `test.fiscalbay.it`, TLS valido, casella/mittente email, preflight dati e payload eBay sanificato mancanti |
| Materiale privato                                           | Inventario fuori checkout: riferimento locale `FiscalBay/m0-inventory` nella custodia Codex privata       |
| Operazioni remote parziali da riconciliare                  | Timer autodeploy 1.x riletto `disabled` / `inactive` il 2026-09-19; bot e callback 1.x attivi. Creato il progetto Google dedicato `fiscalbay-2-0-max23468`, senza billing, API o credenziali. Ripristinato il progetto Supabase Free FiscalBay dalla pausa automatica, senza costo; stato finale riletto `ACTIVE_HEALTHY`. Creata D1 `fiscalbay-m0-test` con giurisdizione UE, applicate tre migration e completato un restore Time Travel con sola riga sintetica. Nessun push, merge, deploy 2.0, nuovo provider o costo aggiuntivo attivato |
| Prossima azione alla ripresa                                | Preparare callback ed email di test; mantenere ferme l'attivazione Stripe e le credenziali OAuth finché gli URL non sono definiti |

### Registro dei via e dei checkpoint

| Passaggio                    | Stato iniziale        | Cosa registrare quando effettivo                                                                                                    |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Adozione baseline e avvio M0 | REGISTRATO 2026-09-13 | Mandato corrente; ZIP esatto `FiscalBay_2.0_Finale.zip`, SHA-256 `4321784a3c58670dcbcf7d5b9a3f13599ad82dbc9ee74a00c7255b75ee3f85ba` |
| Riapertura candidato Supabase | REGISTRATO 2026-09-13 | L'owner accetta che le passkey Supabase siano sperimentali come rischio da provare in M0; la combinazione Supabase va confrontata con il candidato Cloudflare e non è esclusa per questo limite |
| Scelta candidato Cloudflare | REGISTRATO 2026-09-19 | L'owner sceglie Workers + D1 + Queues + Better Auth perché Supabase Pro non rientra nel budget. L'avvio usa Workers Free; Workers Paid resta l'upgrade previsto al raggiungimento delle soglie registrate |
| Upgrade Workers Paid        | AUTORIZZATO A SOGLIA  | Passare a Paid prima del primo superamento previsto: 80.000 richieste dinamiche/giorno, CPU p95 di 8 ms, 8.000 operazioni Queue/giorno, 4 milioni righe D1 lette/giorno, 80.000 scritte/giorno, 4 GB D1, 160.000 eventi log/giorno o necessità di retention Time Travel oltre 7 giorni. Le soglie sono sull'account condiviso e vanno rilette con prezzo e utilizzo correnti prima dell'attivazione |
| Fine M0                      | IN ATTESA             | Assetto, account, piani/costi, Auth/database, prove residue e rischi approvati                                                      |
| M1 brand/design              | IN ATTESA             | Asset/prototipo identificato e approvazione owner                                                                                   |
| M5 commerciale/live          | IN ATTESA             | Configurazione live autorizzata e confini degli effetti reali, senza incassi non previsti                                           |
| M8 merchant reale            | IN ATTESA             | Manifest ambiente/dati/contatto/prove autorizzate                                                                                   |
| M9 Pubblica                  | IN ATTESA             | Candidato/manifest, date promo, checklist e richiesta esplicita di pubblicazione                                                    |

### Evidenze correnti M0

| Area             | Esito osservato                    | Prova, capacità e limite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline         | PASS                               | File iCloud esatto verificato, `unzip -t` verde e tutti i checksum interni `SHA256SUMS.txt` verdi. Importati soltanto documenti canonici e asset 2.0; `docs/archive` escluso. Checkout originale preservato.                                                                                                                                                                                                                                                                                                                            |
| Trigger 1.x      | PASS circoscritto                  | GitHub non espone webhook di repository o workflow di deploy. Sulla sola VPS autorizzata, hostname `fiscalbay-bot`, `fiscalbay-autodeploy.timer` era attivo su `main`; è stato disabilitato e riletto `disabled` / `inactive`, da ultimo il 2026-09-19. Bot e callback 1.x sono rimasti attivi. Rilettura obbligatoria prima di push o merge.                                                                                                                                                                                            |
| Alternative      | CHIUSO                             | Python, Telegram-first e VPS 1.x sono incompatibili con la baseline. Supabase ha superato le prove tecniche locali ma Pro è escluso per budget e Free per la continuità insufficiente. Nessun adapter alternativo è stato implementato; le evidenze Supabase restano nella storia Git e non costituiscono un secondo runtime mantenuto.                                                                                                                                                                                                                                                        |
| Candidato        | SCELTO / AVVIO FREE                | L'owner ha scelto Workers Free + D1 + Queues + Better Auth per l'avvio, con upgrade condizionato a Workers Paid. La slice D1 e Better Auth è il solo runtime mantenuto. Supabase Pro è escluso perché non rientra nel budget; Supabase Free non offre la continuità operativa richiesta e resta soltanto evidenza storica delle prove M0. Restano da chiudere i quattro login reali, callback seller eBay, trasporto email e trattamento dei dati prima di concludere M0. |
| Costi nominali   | 0 USD INIZIALI / PAID A SOGLIA     | Workers Free non ha canone. Workers Paid resta il passaggio condizionato: minimo 5 USD/mese per account, con 10 milioni di richieste e 30 milioni di CPU-ms inclusi. Per 360.000 messaggi/mese, tre operazioni Queue per messaggio valgono circa 1,08 milioni di operazioni prima dei retry: sul Paid circa 0,03 USD oltre il milione incluso. L'ordine di costo previsto al passaggio è quindi circa 5,03 USD/mese prima di retry, email e altri consumi oltre soglia. R2 conserva la propria tariffazione e fascia inclusa separate. Il readback del 2026-09-19 mostrava Workers Paid `In scadenza` il 2026-09-20; non verrà rinnovato ora. |
| Capacità account | PARZIALE                           | Workers Free offre 100.000 richieste dinamiche/giorno, 10 ms CPU per invocazione, 50 subrequest esterne per invocazione, 200.000 eventi log/giorno con 3 giorni di retention e asset statici senza limite di richieste. Queues Free include 10.000 operazioni/giorno e 24 ore di retention. D1 Free include 5 milioni di righe lette/giorno, 100.000 scritte/giorno e 5 GB totali. I limiti sono condivisi dall'account con CF-Ready: il ciclo precedente, ancora Paid, mostrava 207.560 richieste Workers, 1,42 milioni CPU-ms, 20,27 milioni righe D1 lette, 27.890 scritte e 858 operazioni Queue nel mese, ma il Free richiede letture giornaliere. La CLI vede D1 `fiscalbay-m0-test` e le risorse CF-Ready; nessun Worker o Queue FiscalBay è presente. |
| Polling/coda     | PASS parziale / PAID A VOLUME      | Workers Queues è disponibile anche sul piano Free con 10.000 operazioni/giorno e retention di 24 ore. Caso piano: 150 negozi, 12.000 cicli/giorno e 360.000 messaggi/mese; tre operazioni per messaggio producono circa 36.000 operazioni/giorno prima dei retry, quindi il volume obiettivo richiede Paid. Free è adatto a M0, test e primi carichi contenuti; il gate scatta a 8.000 operazioni/giorno sull'account. La prova Cloudflare remota attende una queue FiscalBay dedicata e un consumer reale. Il polling userà Fulfillment `getOrders`; il limite effettivo del keyset resta da attestare. |
| D1               | PASS locale / schema remoto        | Dataset sintetico: 70.000 ordini, 210.000 righe articolo, 84.000 identificativi fiscali, 14.000 grant e 10 negozi. SQLite locale compattato: 62.181.376 byte; inserimento bulk circa 0,94 s DB / 4,23 s comando. Query pagina tenant/grant da 50 ordini: 20–68 ms in due esecuzioni locali. Test Workerd verdi per isolamento tenant, più identificativi e consumo quota atomico. Sulla D1 remota UE sono applicate le tre migration e presenti tutte le tabelle previste.                                                                                                                                                      |
| Auth             | PASS locale / BLOCKED live         | Better Auth genera e usa schema D1 senza deriva; email/password crea un utente non verificato, passkey richiede sessione, Google ed eBay avviano solo i provider previsti. Nello spike temporaneo fuori checkout, Supabase CLI 2.117.0, GoTrue 2.196.0 e `supabase-js` 2.116.0 hanno completato registrazione e nuovo accesso WebAuthn in Chromium con autenticatore virtuale e RP ID `localhost`. La stessa passkey ha autenticato di nuovo dopo un restore pulito di Auth e dati. Il rischio accettato per la qualifica resta la stabilità dell'API sperimentale. Il progetto Google dedicato `fiscalbay-2-0-max23468` è attivo senza billing, API o credenziali; i quattro progetti preesistenti sono rimasti invariati. Lo scope login eBay Identity resta distinto dallo scope seller. Mancano callback HTTPS, RuName/scopi 2.0, mittente email e prove live di linking, recupero, revoca e MFA. |
| eBay             | PASS account parziale / BLOCKED dati | L'account Developers e il keyset Production `botCF` di FiscalBay sono stati identificati. `botCF 2` appartiene a SyncBay ed è escluso. La 1.x usa il solo scope seller `sell.fulfillment.readonly` e il callback legacy; il selettore Dashboard conserva 34 scope e un secondo RuName di Hub Fatture, quindi non va modificato finché i consumatori non sono migrati. Identity può supportare il login, ma campi e scope riservati richiedono approvazione eBay. `buyer.taxIdentifier` viene da `getOrder`, non da `getOrders`; più identificativi sono conservati. Developer Analytics ha confermato 5.000 chiamate/giorno per Trading `GetOrders` e `GetItem`, senza consumo osservato. Mancano limite Fulfillment Order effettivo, payload sanificato autorizzato, test read-only su ordini e configurazione delle notifiche obbligatorie di cancellazione. |
| Export           | PASS locale                        | `exceljs` 4.4.0 e `fflate` 0.8.3, entrambe MIT. Il CSV conserva il valore letterale e neutralizza formule con apostrofo; l’import in un foglio può comunque applicare cast automatici. XLSX assegna testo esplicito; ZIP contiene entrambi. Prova Workerd su 1.000 ordini e due identificativi: 81 ms. Override `uuid` 11.1.1 verificato; audit Production senza vulnerabilità note. Le dipendenze transitive deprecate di ExcelJS restano rischio di manutenzione. Consegna autenticata/revocabile resta nell’attività applicativa M6. |
| Stripe           | PASS account parziale / BLOCKED attivazione | La Dashboard autenticata mostra Managed Payments disponibile con CTA `Inizia`, ma non attivato, e un sovrapprezzo del 3,5% per transazione. Stripe/Link opera come MoR per categorie ammesse, incluse applicazioni SaaS vendute direttamente da un'azienda italiana; la review finale considera tipo e geografia del business. Sono supportati Checkout e Payment Links, pagamenti una tantum e abbonamenti. Elements, Connect, fatture una tantum e abbonamenti creati fuori da Checkout o Payment Links non sono supportati. Sandbox prova checkout, imposte e webhook, ma non invia automaticamente le ricevute e gli acquisti test non compaiono nell'app Link. Nessuna attivazione, prodotto o transazione è stata eseguita. |
| Recovery         | PASS mirato / 7 GIORNI FREE        | D1 Time Travel conserva 7 giorni sul piano Free e 30 giorni sul Paid. Le tre migration applicative e Better Auth sono presenti nella D1 remota UE `fiscalbay-m0-test`. Una riga sintetica inserita dopo un bookmark è stata rimossa dal restore e le tre migration sono rimaste applicate. La necessità operativa di superare 7 giorni costituisce un gate di upgrade. Restano da definire riconciliazione delle cancellazioni o revoche successive allo snapshot e drill conclusivo M9. |
| Toolchain        | PASS                               | Node 26.8.2 e pnpm 12.4.1 sono entrambi attivati da `mise`; è stata rimossa la caduta silenziosa sul pnpm 11 del runtime Codex. TypeScript 7.0.2, React/DOM 19.3.0, React Router 8.3.1, Vite 8.3.0, Wrangler 4.131.1, Vitest 4.1.11 per compatibilità col plugin Cloudflare, Oxlint/Oxfmt. Install frozen, peer check, typecheck, 12 test, build e verifica documentale verdi con le versioni richieste.                                                                                                                                                                              |

Una nota retrospettiva «tutto approvato in chat» non sostituisce la prova del via di un checkpoint futuro. Gli esiti di implementazione e i riferimenti privati possono essere sintetizzati senza nomi cliente o credenziali. I consensi già validi non vengono richiesti di nuovo a ogni comando.

Alla fine di una sessione aggiornare: task realmente conclusi, task in corso, blocchi circoscritti, prossimo lavoro eleggibile, eventuali effetti remoti incompleti e riferimento alle relative ricevute. Alla ripresa verificare Git/provider: lo stato Markdown non autorizza a ripetere un pagamento, una migrazione o un invio già completati.

## Indice milestone

- [M0 — Qualificazione tecnica](#m0)
- [M1 — Fondazioni applicative e design](#m1)
- [M2 — Account, Auth e Negozi eBay](#m2)
- [M3 — Sincronizzazione, ordini e modello fiscale](#m3)
- [M4 — UX completa](#m4)
- [M5 — Free/Premium, Stripe e Telegram](#m5)
- [M6 — Export, amministrazione e supporto](#m6)
- [M7 — Hardening e readiness operativa](#m7)
- [M8 — Release Candidate e test reale](#m8)
- [M9 — Go-live](#m9)

<a id="m0"></a>

## M0 — Qualificazione tecnica

**Ingresso:** Approvazione formale della baseline e incarico di avvio; nessuna attività M0 risulta già eseguita.

**Autorizzazione:** Via owner a infrastruttura, costi, Auth e database prima di M1.

### M0-01 — Inventario della baseline e conflitti legacy

**Stato:** DONE · **Prerequisiti:** Avvio autorizzato · **Contratto:** [§0](docs/MASTER_PLAN.md#s00) · [§2](docs/MASTER_PLAN.md#s02) · [§34](docs/MASTER_PLAN.md#s34)

Seguire [README](README.md#avvio), verificare l’integrità iniziale e le istruzioni/automazioni pertinenti (AGENTS, README, workflow, main, autodeploy e keyset condivisi); individuare cosa deve essere dismesso/allineato senza spostare gli altri progetti.

**Criterio di completamento:** Adozione locale e istruzioni 2.0 verificate; inventario dei trigger e regola di blocco per ogni effetto remoto non ancora qualificato. Questo chiude il prerequisito delle attività locali indipendenti, non autorizza push/merge: prima di quei passaggi occorre attestare che le automazioni legacy non possano attivare il vecchio deploy. Un accesso remoto mancante resta un blocco circoscritto registrato nel backlog, senza dichiarare dismessa la 1.x. Nessun checkpoint owner aggiuntivo.

Registrare anche il vincolo di cutover del bot: il poller 1.x non può restare attivo sullo stesso bot quando la 2.0 prende il webhook o la ricezione degli update. Preservare asset e keyset condivisi; la rimozione dei file non coincide con la revoca indiscriminata delle credenziali.

**Evidenza:** baseline/checksum e checkout registrati sopra; istruzioni 2.0 adottate; timer remoto disinnescato con readback. Nessun push o merge eseguito.

### M0-02 — Bootstrap delle prove, agenti e custodia privata

**Stato:** BLOCKED · **Prerequisiti:** M0-01, M0-11 · **Contratto:** [§33](docs/MASTER_PLAN.md#s33)

Configurare accessi minimi e inventario privato; preparare solo l’endpoint test HTTPS/callback e il trasporto email Auth necessari alla qualifica, su risorse autorizzate. Prima dell’acquisizione reale verificare il relativo perimetro di trattamento; applicare la qualifica tool proporzionata al rischio e riusare prove condivise fra CLI/MCP. M1-08 completa la configurazione, non è il primo momento in cui un login può essere provato.

**Criterio di completamento:** Prerequisiti di prova osservabili: endpoint/TLS, destinatario email controllato, account/ambiente corretti, autorizzazioni e lista tool. Mancanze segnate BLOCKED; nessuna spesa, PII pubblica o scrittura estranea. Le prove eseguibili usano la toolchain qualificata in M0-11.

**Evidenza DNS/TLS:** il 2026-09-19 `fiscalbay.it` risolve a `195.110.124.133`, `www` è un CNAME verso l'apex e `test.fiscalbay.it` non risolve. I nameserver sono `ns1.register.it` e `ns2.register.it`; MX e SPF esistenti restano su Register.it. Apex e `www` rispondono HTTP 200 da Apache con una pagina statica, mentre HTTPS presenta un certificato `*.dadapro.com` privo di SAN FiscalBay e fallisce la verifica. Nessun record, nameserver o contenuto è stato modificato.

**Blocco:** servono controllo DNS/hosting autorizzato, record per `test.fiscalbay.it`, certificato valido e destinazione del callback prima di creare client OAuth o credenziali legate a URL provvisori.

### M0-03 — Inventario risorse Cloudflare/Supabase

**Stato:** BLOCKED · **Prerequisiti:** M0-01; accessi di lettura pertinenti (non callback/email) · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§36](docs/MASTER_PLAN.md#s36)

Leggere piani, quote e consumi degli account pertinenti, inclusi altri progetti; separare capacità nominale da residua e individuare costi nuovi.

**Criterio di completamento:** Misure/fonti per CPU, DB, file, queue, egress, auth, email e log; nessun canone dato per già pagato o gratuito senza evidenza.

Se una verifica richiede un piano a pagamento prima della scelta finale, ottenere un’autorizzazione limitata alla prova e registrare costi/reversibilità. Il via di fine M0 non sana spese già effettuate senza consenso.

**Evidenza parziale:** Supabase è stato riletto in Dashboard; il piano Free e la capacità condivisa osservata sono riportati sopra e restano evidenza dell'alternativa esclusa. Cloudflare CLI ha escluso le risorse CF-Ready dal perimetro FiscalBay. La D1 FiscalBay di test è stata creata in giurisdizione UE; nessun Worker o Queue FiscalBay è presente. La Dashboard ha rilevato piani, scadenze, utilizzo e costo del ciclo concluso: Workers Paid risultava in cessazione il 2026-09-20, R2 Paid attivo e tutto l'uso osservato entro l'incluso.

**Blocco:** il piano iniziale Free e le soglie di upgrade sono scelti. Dopo la cessazione del Paid servono readback del piano effettivo e misure giornaliere condivise per Workers, Queues, D1 e log; resta da qualificare il trasporto email. Nessun rinnovo o upgrade è richiesto ora.

### M0-04 — Qualifica dei quattro accessi

**Stato:** BLOCKED · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§36](docs/MASTER_PLAN.md#s36)

Escludere documentalmente candidati incompatibili; sul candidato preferito provare email/password, Google, eBay e passkey con linking, recupero, revoca e MFA rilevanti. Un secondo spike Auth è necessario solo se resta un’incertezza determinante. Non costruire quattro schermate definitive per ogni provider.

**Criterio di completamento:** Matrice pass/fail con prove e limiti; nessun secondo layer nascosto o metodo eliminato per comodità.

Qualificare SSR/helper eventuali, RP ID e origini separati test/live, riuso del JWT dopo logout e revoca sui percorsi API/RPC/file realmente esposti. La presenza di una passkey non dimostra MFA effettiva; helper beta e fallback non sono ammessi tacitamente.

**Evidenza parziale:** schema e avvii Better Auth locali dei quattro metodi sono provati. Sul percorso Supabase sono riusciti registrazione e nuovo accesso passkey nel browser con sessione Auth, RP ID controllato e autenticatore virtuale; un secondo accesso è riuscito anche dopo il ripristino della credenziale. Lo spike non ha creato progetti remoti o costi. L'avvio iniziale dell'intero stack locale ha esaurito la memoria del container Analytics; gli avvii limitati a database, Kong, Auth e Data API sono riusciti con servizi healthy.

**Evidenza parziale:** Google Cloud è autenticato. I quattro progetti preesistenti sono stati esclusi e il progetto dedicato `fiscalbay-2-0-max23468` è stato creato attivo, senza billing, API o credenziali e senza cambiare il progetto CLI predefinito.

**Blocco:** servono origine HTTPS controllata, client Google OAuth collegato agli URL definitivi di test, scope e RuName eBay destinati alla 2.0 e trasporto email per linking, recupero, revoca, riuso sessione e MFA effettivi. eBay Developers è autenticato e il keyset FiscalBay è identificato, ma il callback e lo scope Identity della 2.0 non sono configurati. L'owner accetta il rischio sperimentale delle passkey per la qualifica.

### M0-05 — Qualifica fonti eBay e keyset

**Stato:** BLOCKED · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§9](docs/MASTER_PLAN.md#s09) · [§11](docs/MASTER_PLAN.md#s11) · [§36](docs/MASTER_PLAN.md#s36)

Verificare OAuth seller/Identity, scope, ID stabili, getOrders/getOrder/Trading necessarie, età campi, mascheramenti, immagini e ordini non pagati.

**Criterio di completamento:** Matrice fonte-campo-età-stato, condizioni autorizzate, quote effettive; fixture sanitizzate e test read-only autorizzati.

Includere il contratto delle notifiche obbligatorie di cancellazione eBay, distinta da eventuali eventi ordini opzionali. La disponibilità di payload reali non esonera dal preflight trattamento di M0-02.

**Evidenza parziale:** l'account Developers, il keyset FiscalBay `botCF`, il RuName attivo e il consumo 1.x sono stati identificati senza modifiche. `botCF 2` è di SyncBay ed è escluso. La 1.x richiede soltanto `sell.fulfillment.readonly`; i 34 scope salvati in Dashboard e il RuName Hub Fatture rendono il keyset condiviso un contratto da migrare con analisi dei consumatori. Developer Analytics ha confermato 5.000 chiamate/giorno residue per Trading `GetOrders` e `GetItem` il 2026-09-19.

**Blocco:** mancano scope Identity e RuName destinati alla 2.0, limite effettivo Fulfillment Order, preflight trattamento, payload sanificato autorizzato e lettura read-only di un ordine. Le notifiche di cancellazione marketplace non hanno endpoint, verification token o email configurati e l'account non risulta esentato.

### M0-06 — Qualifica eventi, polling e lavoro API

**Stato:** BLOCKED · **Prerequisiti:** M0-05 · **Contratto:** [§11](docs/MASTER_PLAN.md#s11) · [§36](docs/MASTER_PLAN.md#s36)

Misurare strategia incrementale, disponibilità eventi utili, manuale, 10/30min, backfill, retry e vincoli keyset condivisi.

**Criterio di completamento:** Budget chiamate/messaggi realistico con margine, eventi non presunti, nessuna invasione quote altrui.

**Evidenza parziale:** Queues Free include 10.000 operazioni/giorno; il volume obiettivo ne richiede circa 36.000 prima dei retry. Il piano Free copre prove e carico iniziale, mentre l'80% della quota giornaliera avvia il passaggio a Paid. La prova concorrente Supabase è conservata come evidenza storica del carico, mentre la coda Cloudflare remota attende il consumer effettivo. Trading `GetOrders` ha 5.000 chiamate/giorno e non sostiene i 12.000 cicli/giorno previsti. Il candidato per il polling è Fulfillment `getOrders`, con limite predefinito ufficiale di 100.000 chiamate/giorno; Trading resta ammissibile soltanto per letture mirate necessarie.

**Blocco:** Developer Analytics non ha restituito la risorsa Fulfillment Order del keyset, quindi limite effettivo, paginazione, backfill, retry, eventi utili e margine restano da misurare nella prova read-only autorizzata di M0-05.

### M0-07 — Schema rappresentativo e concorrenza

**Stato:** IN PROGRESS · **Prerequisiti:** M0-03, M0-05, M0-11 · **Contratto:** [§27](docs/MASTER_PLAN.md#s27) · [§36](docs/MASTER_PLAN.md#s36)

Misurare sul candidato credibile un dataset sintetico rappresentativo di 70.000+ ordini con articoli, dati fiscali, grant/cicli e telemetria effettivamente necessaria. Niente tabella per ogni concetto o copia di ogni polling; misurare spazio, indici, query, isolamento e consumi.

**Criterio di completamento:** Dati misurati più scenari picchi/multistore/retention; test consumo atomico e privacy senza record reali pubblici.

Testare anche viste/RPC privilegiate e Data API diretta se esposta, non soltanto il servizio web. Includere copie derivate/event payload nella misura di spazio; il raw temporaneo non diventa audit permanente.

**Evidenza parziale:** oltre alla misura D1 riportata sopra, lo spike PostgreSQL ha caricato 70.000 ordini, 210.000 articoli, 84.000 identificativi fiscali e 14.000 grant su 10 workspace. Il database occupava 113.519.763 byte; gli inserimenti principali hanno richiesto circa 1,05 s per gli ordini, 3,39 s per gli articoli, 0,99 s per gli identificativi primari, 0,18 s per i secondari e 0,31 s per i grant. La Data API con RLS ha restituito 7.000 ordini per ciascun owner e zero righe cross-tenant. Due RPC concorrenti su una quota residua hanno prodotto un solo grant; il tentativo cross-tenant ha lasciato il contatore a zero. Gli advisor Supabase security e performance non hanno segnalato warning, anche dopo il restore. Chiusura sospesa fino ai prerequisiti account/eBay e alla misura finale di raw temporaneo, retention e picchi.

### M0-08 — Qualifica Stripe Managed Payments

**Stato:** BLOCKED · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06) · [§36](docs/MASTER_PLAN.md#s36)

Leggere eligibility effettiva, copertura fiscale, capabilities checkout/portal/Link, prezzi/metodi e testare i casi commerciali critici.

**Criterio di completamento:** Matrice commerciale con esito e ambito docs/sandbox/live per ogni caso; prove non supportate dal sandbox assegnate esplicitamente al gate finale, senza falso PASS. MoR effettivo verificato, nessun Payments standard o Paddle senza owner.

Coprire vincoli di Hosted Checkout/metodi, uso di Link e oggetti cancellati dal provider; chiarire quali prove di ricevute e gestione cliente richiedono live. Nessuna transazione live è autorizzata dal semplice avvio di questo task.

**Evidenza parziale:** la sessione Dashboard controllata mostra Managed Payments disponibile per l'avvio sull'account, non ancora attivato, con sovrapprezzo del 3,5% per transazione. FiscalBay rientra documentalmente nella vendita diretta di SaaS con sede italiana e automazione digitale; l'idoneità definitiva resta soggetta alla review Stripe. Il percorso ammesso usa Checkout o Payment Links e supporta pagamenti una tantum e abbonamenti. Stripe/Link gestisce imposte indirette coperte, ricevute, assistenza di transazione, frodi e contestazioni; FiscalBay conserva il supporto del prodotto e la riconciliazione dei diritti.

**Blocco:** l'attivazione tramite `Inizia` può introdurre accettazioni e configurazione account e non è stata eseguita. Dopo autorizzazione servono review, prodotto con tax code eleggibile e prove sandbox di acquisto, prepagamento, rinnovo, rimborso, webhook e Portal/Link. Ricevute automatiche e comparsa dell'acquisto nell'app Link richiedono una prova live rinviata al relativo checkpoint. Nessuna transazione o catalogo creato.

### M0-09 — Recovery nativa e limiti

**Stato:** BLOCKED · **Prerequisiti:** M0-03, M0-04, M0-07 · **Contratto:** [§32](docs/MASTER_PLAN.md#s32) · [§36](docs/MASTER_PLAN.md#s36)

Verificare le protezioni native dei candidati ancora ammissibili; approfondire il percorso dati/Auth/grant/file/config/chiavi del candidato migliore e i costi. Nessun restore completo su ogni alternativa: l’unico drill conclusivo rimane pre-go-live.

**Criterio di completamento:** Configurazione ammissibile documentata; Free senza recovery non promosso. Nessuna prova formale di restore già dichiarata.

Specificare come conoscere cancellazioni/revoche avvenute dopo lo snapshot: il marker nello stesso DB ripristinato non basta. Distinguere dati ripristinabili, stati riconciliabili, configurazione ricreabile ed export rigenerabili, senza introdurre backup indipendenti.

**Evidenza parziale:** D1 Time Travel è la protezione nativa scelta e offre 7 giorni di retention sul piano Free, estesi a 30 giorni sul Paid. La ricostruzione locale dalle migration applicative e Better Auth è verde. Sulla D1 remota UE `fiscalbay-m0-test`, tre migration sono state applicate e rilette; una riga sintetica inserita dopo il bookmark è stata rimossa dal restore, conservando schema e registro migration. Il primo tentativo di creazione ha ricevuto l'errore transitorio Cloudflare `10000`; il singolo retry con identici account, scope e giurisdizione è riuscito senza duplicati. Il round trip cifrato Supabase + R2 resta una prova storica sul dataset.

**Blocco:** la retention Free di 7 giorni è accettata per questa fase; un requisito superiore attiva il passaggio a Paid. Restano il percorso Auth/email e una fonte riconciliabile delle cancellazioni o revoche successive allo snapshot. Il drill conclusivo resta pre go-live.

### M0-10 — Qualifica export e runtime

**Stato:** IN PROGRESS · **Prerequisiti:** M0-07 · **Contratto:** [§12](docs/MASTER_PLAN.md#s12) · [§26](docs/MASTER_PLAN.md#s26)

Qualificare un percorso minimo CSV/XLSX/ZIP sul candidato runtime, con memoria, durata, tipi e licenze; confrontare un’altra libreria soltanto se il percorso non basta. Non costruire già il sistema export completo per ogni stack.

**Criterio di completamento:** Almeno un percorso sicuro fattibile per ogni formato promesso; libreria scelta se utile, nessun taglio di XLSX.

Separare integrità del CSV dai cast automatici del foglio di calcolo; provare tipi testo XLSX e più identificativi su ordini multi-articolo. Definire consegna autenticata/revocabile, non un URL bearer valido 24 ore come unico controllo.

**Evidenza parziale:** CSV/XLSX/ZIP e runtime Workerd verdi, licenze e misura registrate sopra. La consegna autenticata segue il gate Auth e impedisce la chiusura prima del prerequisito M0-07.

### M0-11 — Toolchain latest stable riproducibile

**Stato:** DONE · **Prerequisiti:** M0-01 · **Contratto:** [§26](docs/MASTER_PLAN.md#s26) · [§34](docs/MASTER_PLAN.md#s34)

Qualificare localmente Node/TS/pnpm/ReactRouter/Vite/lint/test/CLI e una baseline eseguibile minima. Nessun endpoint/provider già configurato è prerequisito. Le integrazioni specifiche e i generatori OAS vengono verificati nei task pertinenti e riallineati prima del memo M0-14; congelare i pin effettivamente qualificati, senza presumere scelto il runtime finale.

**Criterio di completamento:** Install pulita e smoke di typecheck/build/test passano nell’ambiente locale/runner controllato; M0-04..M0-10 completano la compatibilità dei candidati esterni. Eccezioni latest motivate, non assunte.

Eseguire questo task prima delle prove che usano il codice: l’ordine numerico degli ID non è la sequenza operativa. Verificare compiler API/LSP/generatori e dipendenze SSR beta, oltre a build/typecheck; non installare automaticamente compatibility layer non necessari.

**Evidenza:** pin e lockfile del candidato, configurazione `mise` per Node 26.8.2 e pnpm 12.4.1, configurazione Workers tipizzata, install frozen, peer check, typecheck, 12 test Workerd, build React Router e documentazione verdi. Vitest 4.1.11 è l’ultima 4.x compatibile con `@cloudflare/vitest-plugin` 1.1.8, che richiede `^4.1.0`; Vitest 5 è stato escluso dopo peer check.

### M0-12 — Consolidamento dei vincoli legali preliminari

**Stato:** BLOCKED · **Prerequisiti:** M0-04, M0-05, M0-08 · **Contratto:** [§29](docs/MASTER_PLAN.md#s29) · [§30](docs/MASTER_PLAN.md#s30)

Mappare ruoli dati, uso Codex necessario, copertura MoR, obblighi italiani residui, eBay marchi/retention e licenze legacy.

**Criterio di completamento:** Nessun blocco legale ignorato prima di dati reali; deliverable pubblico/privato distinti e attività di chiusura assegnate.

Il controllo iniziale prima dei dati reali è già un prerequisito M0-02. Qui consolidare anche cancellazioni eBay/Link, erasure nelle protezioni native, accettazioni contrattuali e ruoli degli strumenti, con le attività finali di M7-07 esplicite.

**Blocco:** nessun dato reale è stato acquisito. L'account eBay non è esentato dalle notifiche di cancellazione marketplace e non ha endpoint, verification token o email configurati; questo requisito va chiuso prima della readiness live. In Managed Payments, una richiesta di cancellazione cliente annulla gli abbonamenti interessati, elimina gli oggetti Stripe collegati e genera una notifica email: FiscalBay deve riconciliare diritti e dati derivati senza ricrearli dai backup. Servono inoltre review Stripe, dati dell’operatore e perimetro del trattamento prima delle prove su ordini reali.

### M0-13 — Vertical slice end-to-end

**Stato:** BLOCKED · **Prerequisiti:** M0-04, M0-05, M0-07, M0-11, M0-12 · **Contratto:** [§36](docs/MASTER_PLAN.md#s36)

Sul candidato migliore: login→link seller→ordine→DB→pagina minima, con permessi e timestamp coerenti. Non implementare più prodotti paralleli; un’ulteriore slice richiede un problema concreto o un confronto ancora irrisolto.

**Criterio di completamento:** Flusso osservato con risorsa e commit identificati, errori gestiti e nessun segreto nel client; setup e trattamento dati già qualificati, non aggiunti retroattivamente.

**Evidenza parziale:** la slice locale ordine→D1→pagina, Better Auth e permessi del commit `d62e053` è stata ripristinata come unico runtime mantenuto nel commit `1acd969` dopo la scelta owner del 2026-09-19. Formattazione, lint, tipi, 12 test, build e controlli documentali sono verdi; le migration D1 locali risultano applicate e tutte le tabelle attese sono presenti. HTTP locale della pagina minima: 200; nessun segreto nel client. La slice Supabase del commit `853a22d` resta disponibile nella storia Git come prova M0, senza mantenere due architetture concorrenti.

**Blocco:** login reale→consenso seller→ordine richiede la chiusura dei gate provider e trattamento sopra. Google/eBay, email remota, passkey remota e seller OAuth non sono configurati.

### M0-14 — Memo di scelta e via owner

**Stato:** BLOCKED · **Prerequisiti:** M0-03..M0-13 · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§36](docs/MASTER_PLAN.md#s36) · [§37](docs/MASTER_PLAN.md#s37)

Confrontare costo/complessità/capacità/Auth/recovery/jobs/lock-in, scegliere un assetto e separazione responsabilità, ADR limitati ai nodi stabili.

**Criterio di completamento:** Gate preliminari con esito, ambito e prova; prove ammissibili solo più avanti assegnate a task/checkpoint e non dichiarate completate. Owner approva architettura/costi e rischi derogabili; incompatibilità già dimostrate o obblighi inderogabili restano bloccanti.

**Evidenza parziale:** l'owner ha scelto Workers Free + D1 + Queues + Better Auth per la fase iniziale, con upgrade a Workers Paid autorizzato al raggiungimento delle soglie registrate. Supabase Pro è escluso per budget e Supabase Free per la continuità insufficiente. Cloudflare mantiene una sola superficie operativa per runtime, database e coda. La slice D1 ha già superato isolamento tenant, grant atomici, dataset sintetico, query di pagina e restore Time Travel remoto. La D1 FiscalBay è separata e in giurisdizione UE; le risorse CF-Ready restano escluse.

**Blocco:** dopo il passaggio effettivo a Free vanno misurati i consumi giornalieri condivisi dell'account. Restano da chiudere callback HTTPS, trasporto email, quattro login reali, seller OAuth eBay, payload read-only autorizzato, recovery operativo, Managed Payments e vincoli legali preliminari. Il via owner di fine M0 verrà richiesto dopo queste prove. M1 resta ferma.

<a id="m1"></a>

## M1 — Fondazioni applicative e design

**Ingresso:** M0 qualificata e decisioni/costi autorizzati.

**Autorizzazione:** Via owner al logo rifinito, brand foundation e design system.

### M1-01 — Bootstrap monorepo e comandi comuni

**Stato:** TODO · **Prerequisiti:** M0 · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§26](docs/MASTER_PLAN.md#s26) · [§33](docs/MASTER_PLAN.md#s33)

Strutturare web/dominio/contratti/integrazioni/jobs/UI solo dove utile; script pnpm di controllo e manifest lockati.

**Criterio di completamento:** Checkout pulito installa e verifica; no dipendenze duplicate, output o backend Python richiesto dal nuovo runtime.

Partire da moduli interni: il supporto workspace non richiede package separati per ogni layer né adapter delle alternative scartate.

### M1-02 — Ambienti e CI fondamentale

**Stato:** TODO · **Prerequisiti:** M1-01 · **Contratto:** [§34](docs/MASTER_PLAN.md#s34)

Develop/main, PR test/lint/type/build, test deploy controllato; guardrail branch/credential e segreti ambienti separati.

**Criterio di completamento:** PR senza segreti eseguibile, test genera artefatto proprio; il merge main da solo non pubblica.

Non attivare deploy test se endpoint e segreti minimi non sono pronti; pubblicazioni serializzate per ambiente. Fork/PR non fidate non devono acquisire segreti tramite workflow privilegiati.

### M1-03 — Fondazioni DB, tenant e grant

**Stato:** TODO · **Prerequisiti:** M0, M1-01 · **Contratto:** [§27](docs/MASTER_PLAN.md#s27) · [§29](docs/MASTER_PLAN.md#s29)

Migration iniziale, chiavi/uniqueness, authz tenant/ordine, grant e transazioni; test concorrenza/rollback compatibile.

**Criterio di completamento:** Richieste tra workspace negate; ultimi sblocchi/lifetime non possono duplicarsi; migrazione verificata nel test.

Includere policy su viste/RPC/snapshot/indici se esposti; client impossibilitato a scrivere grant, piano, quota o membership. Le stesse prove negative valgono per D1 via servizio e Supabase via tutti gli accessi consentiti.

### M1-04 — Errori, log e localizzazione

**Stato:** TODO · **Prerequisiti:** M1-01 · **Contratto:** [§26](docs/MASTER_PLAN.md#s26) · [§28](docs/MASTER_PLAN.md#s28) · [§31](docs/MASTER_PLAN.md#s31)

Registro errori tipizzato, correlationID, redazione, i18next IT/EN e formatter UTC/locale.

**Criterio di completamento:** Nessun CF/token nei log di errore; errori comprensibili in entrambe le lingue e retryability coerente.

Condividere schemi runtime e casi d’uso; creare endpoint HTTP solo con consumatori reali, senza specchio /api/v1 di tutte le actions/loaders. Non mantenere un catalogo manuale duplicato dei tipi generati.

### M1-05 — Rifinitura logo originale

**Stato:** TODO · **Prerequisiti:** M0-01; mandato di rifinitura del concept approvato · **Contratto:** [§21](docs/MASTER_PLAN.md#s21)

Rifinire in vettoriale il Concept 4 originale: Bay blu e bordo esterno destro continuo. Preparare varianti per web, favicon, Telegram e sfondo scuro senza riprogettare il simbolo.

**Criterio di completamento:** Confronto con l’originale approvato dall’owner; nessuna rigenerazione respinta viene promossa a riferimento canonico.

La rifinitura del logo non dipende dal bootstrap del monorepo. Usare gli originali e produrre nuovi asset separati, senza sovrascrivere i riferimenti.

### M1-06 — Design system e catalogo candidati

**Stato:** TODO · **Prerequisiti:** M0, M1-05 · **Contratto:** [§22](docs/MASTER_PLAN.md#s22)

Esaminare i nove riferimenti nella fase frontend; scegliere componenti effettivi in base a funzione, licenza e qualità. Definire token, stati, form, icone e tipografia.

**Criterio di completamento:** Registro della provenienza e campione chiaro/scuro, IT/EN, tastiera e touch coerenti con il brief, senza kit sovrapposti.

### M1-07 — Shell e prototipo delle tre sezioni

**Stato:** TODO · **Prerequisiti:** M1-06 · **Contratto:** [§16](docs/MASTER_PLAN.md#s16) · [§17](docs/MASTER_PLAN.md#s17) · [§18](docs/MASTER_PLAN.md#s18) · [§19](docs/MASTER_PLAN.md#s19)

Realizzare top navigation desktop e bottom navigation mobile con tre destinazioni, ricerca, campanella e avatar. Prototipare Ordini a due schede, Negozi a lista e Impostazioni per categorie.

**Criterio di completamento:** Approvazione dell’owner; mostrare anche testi lunghi, errori, quote e campi mancanti. I testi dei mockup non introducono nuove funzioni.

### M1-08 — Completamento DNS, ambienti e posta

**Stato:** TODO · **Prerequisiti:** M0 · **Contratto:** [§24](docs/MASTER_PLAN.md#s24)

Consolidare il bootstrap test predisposto in M0-02: DNS/TLS/redirect, configurazione Production, iCloud info/supporto e trasporto transazionale selezionato. Verificare inventario record, callback, SPF/DKIM/DMARC e isolamento; nessun servizio Register aggiuntivo.

**Criterio di completamento:** HTTP/TLS e callback test/live coerenti, posta umana e Auth provate, record esistenti preservati; nessun cookie/RP ID condiviso accidentalmente e nessun setup iniziale rinviato dopo il gate che lo richiedeva.

<a id="m2"></a>

## M2 — Account, Auth e Negozi eBay

**Ingresso:** Fondazioni M1 e gate Auth/eBay risolti.

**Autorizzazione:** Autonomia tecnica nel perimetro; nessun nuovo login, costo o scope implicito.

### M2-01 — Signup e verifica contatto

**Stato:** TODO · **Prerequisiti:** M1, G-AUTH · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§14](docs/MASTER_PLAN.md#s14)

Implementare login/signup email e Google, verifica richiesta prima eBay, opt-in facoltativo non bloccante.

**Criterio di completamento:** Sessione non verificata esplora ma non collega seller; nessun consenso preselezionato o dato fiscale obbligatorio.

Registrare versione/lingua dei Termini accettati e informativa resa disponibile secondo G-LEGAL, tenendole distinte dalla prova del consenso marketing facoltativo.

### M2-02 — eBay login e passkey

**Stato:** TODO · **Prerequisiti:** M2-01 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07)

Integrare i percorsi eBay login e passkey qualificati in M0, inclusi registrazione della passkey, recupero e verifica delle dichiarazioni di identità del provider.

**Criterio di completamento:** Entrambi funzionano sui browser previsti; il consenso seller rimane separato. Un errore del provider non produce un account attivato solo parzialmente.

Verificare enrollment su dispositivo e RP ID corretti: passkey create nel test non devono autenticare la Production. Nessun attacco via origin/callback non allowlistato.

### M2-03 — Linking e modifica identità

**Stato:** TODO · **Prerequisiti:** M2-01, M2-02 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§29](docs/MASTER_PLAN.md#s29)

Collegare automaticamente solo identità con email verificata e affidabile. Consentire aggiunta e rimozione dei metodi, modifica email protetta e mantenimento di almeno un accesso valido.

**Criterio di completamento:** Test su registrazione preventiva abusiva, provider non attendibile ed email cambiata; nessuna fusione impropria di spazi né blocco dell’utente per rimozione dell’ultimo metodo.

### M2-04 — Sessioni e admin MFA

**Stato:** TODO · **Prerequisiti:** M2-03 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§15](docs/MASTER_PLAN.md#s15)

Implementare durata e rotazione delle sessioni, elenco, revoche e nuova verifica per azioni sensibili. Proteggere l’admin con autorizzazione esplicita, MFA e recupero robusto.

**Criterio di completamento:** Logout singolo/globale e revoche effettivi anche sulle azioni sensibili; nessun metodo alternativo debole aggira la MFA amministrativa.

Provare un token precedente su API, RPC e download dopo revoca. Se un percorso diretto non può applicare il contratto di revoca, non esporlo per quelle operazioni: non dichiarare sufficiente il solo logout del browser.

### M2-05 — OAuth negozi e identità stabile

**Stato:** TODO · **Prerequisiti:** M2-01, G-EBAY · **Contratto:** [§8](docs/MASTER_PLAN.md#s08) · [§29](docs/MASTER_PLAN.md#s29)

Implementare schermata preparatoria, callback e protezioni OAuth, token cifrati e identificatore stabile. Consentire una sola associazione del negozio a uno spazio.

**Criterio di completamento:** Replay e callback duplicate gestiti; nessuna informazione rivelata sullo spazio altrui. Un cambio di nome eBay non crea un nuovo negozio.

### M2-06 — Reconnect, pause e disconnessioni

**Stato:** TODO · **Prerequisiti:** M2-05 · **Contratto:** [§8](docs/MASTER_PLAN.md#s08)

Separare stato della connessione e della sincronizzazione. Implementare pausa, reconnect con riconciliazione recente, reminder per massimo 30 giorni, scollegamento ed eliminazione distinta.

**Criterio di completamento:** Nessun reset di quota o diritti; scollegare non cancella l’abbonamento. Le eccezioni assistite al vincolo di sostituzione Free sono motivate e auditate, non un nuovo trial. Token e lavori pendenti incompatibili vengono invalidati.

Distinguere manual pause da pausa imposta dal piano; nessuna sospensione ferma la retention temporale. Ricollegare non resuscita dati cancellati né azzera il vincolo di sostituzione.

### M2-07 — Schermata negozi e profilo

**Stato:** TODO · **Prerequisiti:** M2-04, M2-06 · **Contratto:** [§18](docs/MASTER_PLAN.md#s18) · [§19](docs/MASTER_PLAN.md#s19)

Realizzare elenco e pannello con URL del negozio, ultima sincronizzazione, frequenza prevista, storico e notifiche. Completare profilo minimo e scorciatoie a Sicurezza.

**Criterio di completamento:** Link diretto, ritorno, refresh e mobile funzionano; il piano è chiaramente dello spazio FiscalBay, non del singolo negozio.

### M2-08 — Routing pubblico autenticato

**Stato:** TODO · **Prerequisiti:** M2-01 · **Contratto:** [§16](docs/MASTER_PLAN.md#s16) · [§23](docs/MASTER_PLAN.md#s23)

Applicare il redirect dalla root all’app per l’utente autenticato, con comando esplicito per visitare il sito pubblico mantenendo la sessione. Gestire IT/EN.

**Criterio di completamento:** Nessun loop o logout forzato per leggere prezzi e FAQ; test e area riservata non sono esposti anonimamente né indicizzati.

Testare cache pubblica e privata con due utenti più anonimo: nessun redirect autenticato o payload di un merchant riutilizzato per altri. Noindex e Vary non sostituiscono una regola cache qualificata.

<a id="m3"></a>

## M3 — Sincronizzazione, ordini e modello fiscale

**Ingresso:** M2, matrice eBay e modello dati qualificati.

**Autorizzazione:** Autonomia tecnica; problemi di copertura fiscale/quote che alterano promessa tornano all’owner.

### M3-01 — Modello ordini, articoli e buyer

**Stato:** TODO · **Prerequisiti:** M2, G-DATA · **Contratto:** [§9](docs/MASTER_PLAN.md#s09) · [§27](docs/MASTER_PLAN.md#s27)

Implementare stato corrente e snapshot degli ordini, mapping delle chiavi esterne, importi esatti, UTC e dati fiscali separati. Mantenere articoli e buyer nel modello qualificato.

**Criterio di completamento:** Importazioni multi-articolo idempotenti; valori monetari precisi; modificare l’anagrafica corrente non riscrive lo storico dell’ordine.

Entità logiche accorpabili quando sicuro; mantenere dati correnti e snapshot dell’ordine senza duplicati a ogni sync. Lo storico di tutte le variazioni fiscali effettive resta richiesto.

### M3-02 — Client eBay e normalizzazione

**Stato:** TODO · **Prerequisiti:** M3-01, G-EBAY · **Contratto:** [§11](docs/MASTER_PLAN.md#s11) · [§28](docs/MASTER_PLAN.md#s28)

Integrare client generati o adapter REST e Trading mirato, errori tipizzati, provenienza dei campi e stati normalizzati.

**Criterio di completamento:** Contract test con fixture; stati sconosciuti non inventati; ordini pagati, non pagati e dati mascherati classificati correttamente.

### M3-03 — Import recenti e backfill

**Stato:** TODO · **Prerequisiti:** M3-02 · **Contratto:** [§11](docs/MASTER_PLAN.md#s11)

Implementare paginazione, cursori, checkpoint, finestra di sovrapposizione e ripresa del backfill. Rendere disponibili prima gli ordini recenti e un avanzamento veritiero.

**Criterio di completamento:** Interruzioni fra pagine recuperabili senza duplicati o salti; il backfill non impedisce l’acquisizione dei nuovi ordini.

### M3-04 — Scheduler, eventi e manuale

**Stato:** TODO · **Prerequisiti:** M3-03 · **Contratto:** [§11](docs/MASTER_PLAN.md#s11)

Implementare target 10/30 minuti, eventi qualificati con riconciliazione, priorità, concorrenza controllata ed equità. Unificare richieste manuali ripetute rispettando la quota del provider.

**Criterio di completamento:** Test con clic ripetuti, backfill e processi concorrenti; eventi Free non ritardati artificiosamente e Retry-After rispettato. Nessun countdown inventato.

Usare consegna/retry/ritardi/DLQ del servizio scelto. Stato applicativo solo per checkpoint, deduplica e recupero di effetti di business; outbox/lease soltanto se necessari, non un secondo orchestratore.

### M3-05 — Controllo fiscale e aggiornamenti

**Stato:** TODO · **Prerequisiti:** M3-02 · **Contratto:** [§9](docs/MASTER_PLAN.md#s09)

Mostrare subito l’ordine e verificare i dati fiscali con un lavoro separato. Gestire più identificativi, controlli formali e distinzione fra assenza, errore, mascheramento e rimozione.

**Criterio di completamento:** Un errore fiscale non blocca l’ordine; rimozione solo su evidenza autorevole, prima disponibilità e variazioni elaborate senza duplicati.

### M3-06 — Sblocco per ordine e diritti acquisiti

**Stato:** TODO · **Prerequisiti:** M3-05, M1-03 · **Contratto:** [§5](docs/MASTER_PLAN.md#s05) · [§6](docs/MASTER_PLAN.md#s06) · [§9](docs/MASTER_PLAN.md#s09)

Implementare diritto per ordine, ciclo e quota con controllo atomico. Preservare dati acquisiti in Premium anche mai aperti; non restituire valori fiscali prima dell’autorizzazione.

**Criterio di completamento:** Test su ultimo credito, concorrenza, sblocco multiplo, downgrade e valori tardivi. Un ordine copre tutti gli identificativi e la ricerca non permette di indovinare valori bloccati.

M3 realizza il contratto dominio/transaction con cicli e grant testabili; M5 integra provider e calendario commerciale. Non dichiarare funzionante l’intero billing solo perché il grant di una fixture passa.

### M3-07 — Suggerimenti e template mancanti

**Stato:** TODO · **Prerequisiti:** M3-01, M3-05 · **Contratto:** [§10](docs/MASTER_PLAN.md#s10)

Collegare soltanto buyer affidabili dentro lo stesso spazio. Suggerire il valore più recente con avviso di conflitto e provenienza, invalidandolo quando cambia la fonte. Aggiungere il template IT/EN copiabile.

**Criterio di completamento:** Il suggerimento non modifica l’ordine e non attraversa spazi; fonti cancellate o fuori conservazione non restano utilizzabili. Nessun invio automatico all’acquirente.

La recenza segue la data dell’ordine sorgente, non import/sync; la sua versione corrente è quella autorevole. Conflitto soltanto tra dati omogenei: un CF diverso da una P.IVA non è di per sé incoerenza.

### M3-08 — Retention operativa e anti-resurrezione

**Stato:** TODO · **Prerequisiti:** M3-01, M3-04 · **Contratto:** [§30](docs/MASTER_PLAN.md#s30)

Implementare cancellazioni periodiche deterministiche, raw a 24 ore e conservazione di ordini, versioni, identificativi e buyer. Usare marcatori di eliminazione dove necessari e invalidare lavori pendenti.

**Criterio di completamento:** Vecchi job o eventi rielaborati non ricreano dati cancellati; la richiesta di eliminazione prevale sulla finestra ordinaria di ripensamento del piano.

Inventariare body degli eventi, outbox, code, snapshot e suggerimenti: riferimenti minimi persistenti, dati grezzi soggetti a TTL anche dopo retry. Accesso negato alla scadenza; pulizia fisica nel margine dichiarato.

<a id="m4"></a>

## M4 — UX completa

**Ingresso:** Contratti M2–M3 stabili e DS approvato; copy/prototipi indipendenti possono anticipare.

**Autorizzazione:** Cambiare strutturalmente UX o scope richiede owner, non ogni rifinitura tecnica.

### M4-01 — Pagina Ordini definitiva

**Stato:** TODO · **Prerequisiti:** M1-07, M3 · **Contratto:** [§17](docs/MASTER_PLAN.md#s17)

Realizzare la griglia a due schede o una secondo viewport, dettagli intermedi, area fiscale e azioni primarie/secondarie. Usare segnaposto che non rivelino dati bloccati.

**Criterio di completamento:** Nessuna personalizzazione delle schede nella 2.0; titoli lunghi, importi e Partite IVA non rompono il layout. Sono visibili soltanto dati autorizzati.

### M4-02 — Ricerca e filtri

**Stato:** TODO · **Prerequisiti:** M4-01 · **Contratto:** [§17](docs/MASTER_PLAN.md#s17) · [§28](docs/MASTER_PLAN.md#s28)

Unificare ricerca rapida e pagina risultati; implementare filtri per negozi, date, stati e situazione fiscale. Interrogare soltanto valori fiscali accessibili.

**Criterio di completamento:** Query e conteggi non rivelano dati bloccati; indicizzazione e filtri server non richiedono di caricare tutto lo storico nel browser.

Per query CF/P.IVA preservare stato della vista senza mettere il valore in URL, referrer o log edge. Nessuna inferenza di identificativi bloccati attraverso conteggi o risultati parziali.

### M4-03 — Carica altri e contesto

**Stato:** TODO · **Prerequisiti:** M4-02 · **Contratto:** [§17](docs/MASTER_PLAN.md#s17)

Implementare ordinamento recente, cursori stabili e conservazione del contesto durante la navigazione. Tra sessioni mantenere solo negozio e ordinamento; nuovi elementi automatici soltanto in cima.

**Criterio di completamento:** Nessun salto durante la lettura né filtro temporaneo invisibile al nuovo accesso; selezioni rivalidate rispetto ai permessi correnti.

### M4-04 — Drawer e articoli

**Stato:** TODO · **Prerequisiti:** M4-01 · **Contratto:** [§17](docs/MASTER_PLAN.md#s17)

Realizzare il pannello con URL su desktop e la vista completa mobile, Dettagli/Articoli e ultimo aggiornamento, senza cronologia.

**Criterio di completamento:** Link diretto, ritorno e ricarica funzionano; ricerca e selezione rimangono, con focus e tastiera corretti.

### M4-05 — Multiselezione ed export entrypoint

**Stato:** TODO · **Prerequisiti:** M4-03 · **Contratto:** [§12](docs/MASTER_PLAN.md#s12) · [§17](docs/MASTER_PLAN.md#s17)

Aggiungere modalità Seleziona, barra contestuale sticky, sblocco multiplo ed Esporta, con conteggi coerenti e conferma.

**Criterio di completamento:** Nessun addebito, sblocco o file generato implicitamente. Ordini assenti o già sbloccati non consumano nuovi recuperi; autorizzazioni rilette.

### M4-06 — Impostazioni e campanella

**Stato:** TODO · **Prerequisiti:** M2, M1-07 · **Contratto:** [§19](docs/MASTER_PLAN.md#s19)

Completare tutte le categorie e opzioni delle impostazioni. Autosalvataggio per scelte semplici, Salva per testi; profilo separato e popover notifiche selettivo, senza pagina dedicata 2.0.

**Criterio di completamento:** Inventario delle preferenze coperto; modifiche non salvate protette, errori non presentati come successi, lingua e tema coerenti.

Le schermate dei servizi M5/M6 possono essere verificate su contratti/fixture in questa milestone, ma la loro integrazione rimane un requisito tracciato: niente impostazione «salvata» che in realtà non governa alcun servizio.

### M4-07 — Onboarding e degradazione

**Stato:** TODO · **Prerequisiti:** M4-01, M2 · **Contratto:** [§20](docs/MASTER_PLAN.md#s20)

Implementare stati vuoti reali, passaggi riprendibili, prerequisiti funzionali senza wizard bloccante, avanzamento dell’import e avvisi contestuali.

**Criterio di completamento:** Prima sincronizzazione e disponibilità fiscale sono distinte; nessun dato demo spacciato per reale, nessun blocco globale quando parti sicure funzionano.

### M4-08 — Review visiva e a11y baseline

**Stato:** TODO · **Prerequisiti:** M4-01..M4-07 · **Contratto:** [§22](docs/MASTER_PLAN.md#s22) · [§35](docs/MASTER_PLAN.md#s35)

Verificare desktop, tablet e smartphone, IT/EN, chiaro/scuro, tastiera, focus, contrasto e movimento ridotto con gli asset approvati.

**Criterio di completamento:** E2E e controlli visivi mirati superati; nessuna dichiarazione di certificazione WCAG o supporto browser non provati.

Distinguere approvazione visuale e collaudo end-to-end delle impostazioni: i percorsi billing/Telegram/export vengono ricontrollati su implementazioni reali in M6/M7.

<a id="m5"></a>

## M5 — Free/Premium, Stripe e Telegram

**Ingresso:** G-STRIPE e pipeline dati/diritti qualificati.

**Autorizzazione:** Via owner alla configurazione commerciale/live. Nessun passaggio Paddle automatico.

### M5-01 — Cicli, promo e quota Free

**Stato:** TODO · **Prerequisiti:** M3-06 · **Contratto:** [§5](docs/MASTER_PLAN.md#s05)

Implementare cicli di 7×24 ore dal collegamento, quota congelata nel ciclo e promozione globale configurabile, senza azzeramenti abusabili. Assenza del dato non consuma quota.

**Criterio di completamento:** Test su confini UTC, ora legale, fine promo e accessi concorrenti; sito pubblico e quota personale spiegano correttamente eventuali differenze temporanee.

### M5-02 — Trial e grant accesso

**Stato:** TODO · **Prerequisiti:** M5-01 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06)

Implementare trial interno di 14 giorni scelto dopo la prima sync, senza ripartenze o pause. Distinguere origine dei diritti e acquisizione automatica dei dati durante Premium.

**Criterio di completamento:** Il trial da solo non crea abbonamento o addebito. Dati mai aperti e tardivi seguono Q568; la prova non scorre mentre il servizio è in attesa.

### M5-03 — Catalogo e Hosted Checkout

**Stato:** TODO · **Prerequisiti:** G-STRIPE, M5-02 · **Contratto:** [§4](docs/MASTER_PLAN.md#s04) · [§6](docs/MASTER_PLAN.md#s06)

Configurare generazioni di prezzo, listino netto e totale comprensibile, conversione ammessa, metodi valutati economicamente e copertura fiscale. Richiedere collegamento e prima sync prima dell’acquisto.

**Criterio di completamento:** Operazioni non coperte bloccate prima della vendita; checkout senza segreti client, nessun passaggio involontario a Paddle o conto PayPal personale.

Dimostrare che le sessioni usano davvero Managed Payments, non Checkout standard. Qualificare opzioni metodi e costo per ticket, Link/descriptor e raccolta dati; nessun custom checkout domain acquistato come requisito.

### M5-04 — Prepagamento durante prova

**Stato:** TODO · **Prerequisiti:** M5-03 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06)

Implementare il percorso qualificato Q567 per mensile e annuale: incasso volontario immediato, giorni gratuiti residui preservati e rinnovo differito correttamente.

**Criterio di completamento:** Test temporali e ricevute sandbox dimostrano un solo pagamento iniziale, residuo completo e rinnovo alla data corretta, senza doppio addebito a fine prova.

Separare istante incasso, termine trial, inizio/fine copertura e prossimo rinnovo; test fine mese/anno bisestile e assenza di un secondo addebito alla scadenza del trial.

### M5-05 — Webhook e riconciliazione

**Stato:** TODO · **Prerequisiti:** M5-03 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06) · [§28](docs/MASTER_PLAN.md#s28)

Verificare firme sul corpo originale, persistenza, idempotenza ed eventi fuori ordine. Riconciliare dal server, applicando subito Free al rinnovo fallito e sette giorni di tutela del prezzo.

**Criterio di completamento:** Un redirect falso non attiva Premium e un evento duplicato non raddoppia i diritti. Un outage Stripe non blocca l’uso già autorizzato né concede proroghe indefinite.

Eventi out-of-order o dati Stripe non più disponibili non significano automaticamente acquisto inesistente o refund. I corpi grezzi dei webhook non diventano archivio fiscale permanente.

### M5-06 — Cambi piano e Portal/Link

**Stato:** TODO · **Prerequisiti:** M5-05 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06)

Implementare cambi periodicità alla scadenza, protezione di entrambi i prezzi originari, disdetta e cambio carta da Link/Portal, accesso ai documenti mediante link.

**Criterio di completamento:** Gli eventi nativi del provider rispettano i diritti; scollegare un negozio non disdice l’abbonamento e le email di pagamento non vengono duplicate.

Prove client Link/Portal e comunicazioni distinguono sandbox e live; i casi non riproducibili nel primo sono assegnati a M9-01. Cambio carta tramite provider non richiede una copia completa nel DB FiscalBay.

### M5-07 — Lifetime e concessioni

**Stato:** TODO · **Prerequisiti:** M5-05 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06) · [§15](docs/MASTER_PLAN.md#s15)

Gestire 20 disponibilità fra vendite e omaggi, prenotazioni atomiche con scadenza, detrazione del residuo effettivamente pagato, grant amministrativi ed estensioni con stop/rinvio dei rinnovi.

**Criterio di completamento:** Test ultimo posto concorrente, webhook tardivo e rimborso; nessuna sovravendita o incasso fittizio. Lifetime valido anche dopo cambio provider.

La scadenza locale della prenotazione deve essere coerente con la possibilità residua di incasso del checkout. Provare ultimo posto, sessione scaduta, pagamento asincrono, conferma tardiva e ripresa dopo crash: nessuna liberazione prematura.

### M5-08 — Rimborsi, dispute e recovery commerciale

**Stato:** TODO · **Prerequisiti:** M5-06, M5-07 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06) · [§30](docs/MASTER_PLAN.md#s30)

Revocare dopo rimborso totale soltanto il diritto collegato. Gestire dispute, rimborsi del supporto provider, escalation e cancellazione account coordinata con i rinnovi.

**Criterio di completamento:** Nessun altro diritto legittimo cancellato; rimborso parziale non convertito automaticamente in giorni; casi temporali e schermate coerenti.

Includere cancellazione finanziaria tramite Link: verificare segnale/ambito, annullamento subscription e perdita oggetti, senza eliminare tacitamente lo spazio o ricreare i dati cancellati. Conservare soltanto la prova dei diritti lecita e necessaria.

### M5-09 — Telegram link e preferenze

**Stato:** TODO · **Prerequisiti:** M3, M2, M5-02 · **Contratto:** [§13](docs/MASTER_PLAN.md#s13)

Integrare bot privato e bot test separato, token monouso, cambio chat, preferenze off/soli fiscali/tutti, scelta negozi e messaggi singoli o digest nel fuso configurato.

**Criterio di completamento:** Nessuna notifica alla vecchia chat o ad altri spazi; default rispettati e login web indipendente da Telegram.

I job rileggono il diritto Premium e le preferenze al momento dell’invio. Collegamento, cambio chat e disattivazione invalidano le consegne incompatibili già accodate.

### M5-10 — Telegram invii e arretrati

**Stato:** TODO · **Prerequisiti:** M5-09, M3-05 · **Contratto:** [§13](docs/MASTER_PLAN.md#s13)

Gestire nuovo ordine in verifica, dato successivamente disponibile, cambi/rimozioni, digest, escaping, suddivisione e retry. Recuperare arretrati soltanto per interruzioni tecniche.

**Criterio di completamento:** CF autorizzato leggibile; riepilogo singolo di completamento import senza messaggi per ogni ordine storico; niente indirizzo/email buyer standard, duplicati da ripresa o arretrato volontariamente disabilitato. Correzioni/rimozioni pertinenti non soppresse dal filtro «solo fiscali»; nessuna garanzia exactly-once esterna.

### M5-11 — Ammissione, inattività e costo

**Stato:** TODO · **Prerequisiti:** M5-01, M5-03 · **Contratto:** [§5](docs/MASTER_PLAN.md#s05)

Implementare inattività Free 30+7 giorni, riattivazione autonoma, waitlist manuale e percorso Q569 con verifica della capacità disponibile.

**Criterio di completamento:** Nessun trial che scorre o nuovo incasso per servizio non erogabile; utenti esistenti non messi in attesa e benefici non azzerati abusivamente.

### M5-12 — Configurazione live sotto checkpoint

**Stato:** TODO · **Prerequisiti:** M5-03..M5-11 · **Contratto:** [§33](docs/MASTER_PLAN.md#s33) · [§37](docs/MASTER_PLAN.md#s37)

Dopo il checkpoint owner, configurare branding, webhook, catalogo, coperture e metodi live, separandoli dal test. Non eseguire incassi indiscriminati.

**Criterio di completamento:** Target live riletti e coerenti con Managed Payments; nessun oggetto test riutilizzato come live. Evidenza minima con dati sensibili protetti.

Configurare contatto supporto realmente ricevibile e alert di richieste a scadenza. Nessuna migrazione automatica di ID test. Prima di agganciare il bot live, fermare il poller 1.x concorrente; prove con incasso reale restano sotto gate finale autorizzato.

<a id="m6"></a>

## M6 — Export, amministrazione e supporto

**Ingresso per l’integrazione completa:** modelli/diritti M3–M5 e UI pertinenti. Generatori puri, contenuti e metriche possono iniziare prima secondo i prerequisiti del singolo task.

**Autorizzazione:** Nuovi costi o fornitori di trasporto o marketing richiedono approvazione.

### M6-01 — CSV e opzioni standard

**Stato:** TODO · **Prerequisiti:** M3-06, G-EXPORT · **Contratto:** [§12](docs/MASTER_PLAN.md#s12)

**Per chiudere:** M4-05, M5-05; integrazione UI e diritti reali verificata, non solo generatore con fixture.

Implementare CSV standard per ordine/articolo, tipi e campi fiscali, ambito da filtri o selezione, opzione soli dati accessibili e motivo dei campi vuoti.

**Criterio di completamento:** CSV con valori sorgente integri, escaping e istruzioni di import colonne testuali; nessuna promessa di conservare zeri al doppio clic. Più identificativi non moltiplicano righe/importi, dati bloccati assenti, formule in input neutralizzate.

### M6-02 — XLSX e configurazioni Premium

**Stato:** TODO · **Prerequisiti:** M6-01 · **Contratto:** [§12](docs/MASTER_PLAN.md#s12)

Implementare XLSX qualificato, colonne e ordinamenti personalizzati, configurazioni Premium salvate e dataset estesi con più identificativi.

**Criterio di completamento:** Memoria, bundle e durata misurati; cambiare libreria non elimina funzioni promesse. Totali ordine non sommati più volte nelle righe articolo.

Campi CF/P.IVA/SKU tipizzati testo nel file XLSX; verificare i totali anche in ordini con più articoli e più identificativi contemporaneamente.

### M6-03 — Job export e portabilità

**Stato:** TODO · **Prerequisiti:** M6-01, M6-02 · **Contratto:** [§12](docs/MASTER_PLAN.md#s12) · [§30](docs/MASTER_PLAN.md#s30)

Implementare storage privato con scadenza a 24 ore, download autenticato, ZIP del profilo JSON/CSV e notifica dei job pronti, senza duplicare documenti di pagamento.

**Criterio di completamento:** Test su revisione workspace prima della generazione/pubblicazione/download: una revoca o cancellazione invalida anche gli export pendenti. Coprire concorrenza e scadenza naturale dei diritti/dati prima del job di pulizia; rigenerare invece di mantenere un grafo file/versioni. Nessun bypass via link bearer o sblocco implicito.

### M6-04 — Console admin

**Stato:** TODO · **Prerequisiti:** M2-04, M5 · **Contratto:** [§15](docs/MASTER_PLAN.md#s15)

Completare liste utenti/spazi/negozi, diritti e incassi, grant, promo, prezzi, configurazioni, retry, pause e revisione antiabuso.

**Criterio di completamento:** MFA e autorizzazione per operazione, nessuna impersonazione o vista fiscale ordinaria; azioni auditate senza reset surrettizi dei benefici.

### M6-05 — Flag e ammissione manuale

**Stato:** TODO · **Prerequisiti:** M6-04 · **Contratto:** [§15](docs/MASTER_PLAN.md#s15) · [§32](docs/MASTER_PLAN.md#s32)

Configurare flag tipizzati, soglie di attenzione, efficacia temporale delle modifiche, waitlist e interruttori distinti.

**Criterio di completamento:** Nessun prezzo protetto riscritto, ciclo corrente invariato, comportamento sicuro quando manca una configurazione.

### M6-06 — Email, supporto e consenso

**Stato:** TODO · **Prerequisiti:** M1-08, M4-06 · **Contratto:** [§14](docs/MASTER_PLAN.md#s14) · [§24](docs/MASTER_PLAN.md#s24)

Qualificare info/supporto iCloud e noreply transazionale, template Auth/servizio IT/EN, form/FAQ, consenso/revoca e gestione mancata consegna.

**Criterio di completamento:** Ricezione e risposte funzionano, marketing separato dal servizio; nessun CF copiato automaticamente nei ticket e nessun digest ordini via email nella 2.0.

### M6-07 — Sito pubblico e SEO

**Stato:** TODO · **Prerequisiti:** M1-06 · **Contratto:** [§23](docs/MASTER_PLAN.md#s23)

**Per chiudere:** M5-03, M2-08.

Verificare contenuti/prezzi e percorsi autenticati; la qualifica legale conclusiva resta nel successivo M7-07.

Completare Home, Funzionalità, Prezzi, Sicurezza, FAQ, Supporto e legali. Focus Codice Fiscale, P.IVA secondaria, canonical, hreflang, Open Graph e sitemap.

**Criterio di completamento:** Verificati percorsi pubblici/autenticati e prezzi totali; niente social proof inventata, blog o roadmap pubblica. Noindex non è la sola protezione delle aree private.

Verificare il comportamento della cache su home/redirect autenticati e pagina prezzi, mantenendo i totali fiscali e la preferenza di visita del sito corretti per il singolo utente.

### M6-08 — KPI e misure minime

**Stato:** TODO · **Prerequisiti:** M3 · **Contratto:** [§31](docs/MASTER_PLAN.md#s31)

**Per chiudere:** M6-04; metriche esposte nella console e collegate ai flussi effettivi.

Implementare eventi business e operativi tipizzati, funnel aggregato, separazione fra MRR, trial e lifetime, errori/ritardi sync e capacità.

**Criterio di completamento:** Metriche riproducibili senza doppioni da retry, nessun dato fiscale nel tracking o session replay. L’attività automatica non azzera l’inattività umana.

Successi ordinari aggregati, senza record dettagliato di ogni polling nei log a novanta giorni. Testare formule KPI e consumo del volume realmente conservato.

<a id="m7"></a>

## M7 — Hardening e readiness operativa

**Ingresso:** Funzioni previste complete; sicurezza e test già costruiti dalle prime fasi.

**Autorizzazione:** Rischi P3 accettati esplicitamente; P1/P2 non accettabili per lancio.

### M7-01 — Audit sicurezza e licenze

**Stato:** TODO · **Prerequisiti:** M2..M6 · **Contratto:** [§29](docs/MASTER_PLAN.md#s29) · [§30](docs/MASTER_PLAN.md#s30) · [§35](docs/MASTER_PLAN.md#s35)

Verificare threat model, XSS, CSRF, isolamento e autorizzazioni, rotazione token, dipendenze e codice copiato, separazione pubblico/privato e dati usati da Codex.

**Criterio di completamento:** Nessun P1/P2; ogni finding ha riproduzione e regression test. Avvisi delle licenze terze preservati e nessun segreto esposto.

### M7-02 — Erasure e retention end-to-end

**Stato:** TODO · **Prerequisiti:** M7-01 · **Contratto:** [§30](docs/MASTER_PLAN.md#s30) · [§32](docs/MASTER_PLAN.md#s32)

Verificare eliminazioni di account, negozio e buyer, comprese richieste eBay, su job, export, raw, versioni, suggerimenti, Auth e billing. Separare i minimi diritti commerciali.

**Criterio di completamento:** Vecchi job o recovery non ricreano dati eliminati; firme e ambito delle richieste corretti. Recuperare lifetime non ripristina dati operativi o prova già consumata.

Coprire anche outbox/event payload/file/indici e segnalazioni Stripe/Link. Il test di logica erasure usa fixture e non sostituisce il drill nativo finale; qualifica delle condizioni di irreversibilità eBay esplicita.

### M7-03 — Stress capacità e costi residui

**Stato:** TODO · **Prerequisiti:** M0, M3, M5, M6 · **Contratto:** [§36](docs/MASTER_PLAN.md#s36)

Misurare il runtime reale con almeno 70.000 ordini, più negozi, picchi, code, export, log e traffico. Considerare capacità residua degli account condivisi.

**Criterio di completamento:** Soglie misurate e configurazione approvata sufficiente; nessuna stima di clienti basata sui soli MAU Auth o sulla media degli ordini.

### M7-04 — Monitoraggio e incidenti

**Stato:** TODO · **Prerequisiti:** M6-04, M6-08 · **Contratto:** [§31](docs/MASTER_PLAN.md#s31) · [§32](docs/MASTER_PLAN.md#s32)

Configurare log ordinari a 90 giorni e audit a un anno, alert azionabili e business, severità P1–P3, canali Telegram/email ed escalation del MoR.

**Criterio di completamento:** Allarme, deduplicazione e rientro provati senza PII; soglie reali nella documentazione privata. Nessun indicatore di salute puramente decorativo.

Runbook dati personali separa risposta operativa, obblighi di notifica ai soggetti pertinenti e finestre del supporto MoR; l’assenza di SLA pubblico non li annulla.

### M7-05 — Kill switch e modalità degrade

**Stato:** TODO · **Prerequisiti:** M7-04 · **Contratto:** [§20](docs/MASTER_PLAN.md#s20) · [§32](docs/MASTER_PLAN.md#s32)

Provare interruttori distinti per eBay, Telegram e nuovi checkout, continuità dei grant validi e dei webhook, accesso alle parti che rimangono sicure.

**Criterio di completamento:** Simulazioni di guasto limitano soltanto le operazioni pertinenti; nessuna promessa di consultazione quando manca il database o l’autenticazione.

### M7-06 — Release, migration e recovery readiness

**Stato:** TODO · **Prerequisiti:** M7-01, M7-02 · **Contratto:** [§32](docs/MASTER_PLAN.md#s32) · [§34](docs/MASTER_PLAN.md#s34)

Qualificare pubblicazione e readback, migrazioni, scelta rollback/forward-fix, recovery nativa dei componenti e custodia delle chiavi necessarie.

**Criterio di completamento:** Percorso eseguibile documentato e RC preparabile; nessun drill periodico aggiunto né ripristino dichiarato prima della prova effettiva.

Provare la ripresa idempotente di Pubblica dopo deploy riuscito/tag fallito e blocco di deploy concorrenti. Preparare riconciliazione post-snapshot di cancellazioni e diritti senza inventare un backup esterno.

### M7-07 — Qualifica legale e commerciale finale

**Stato:** TODO · **Prerequisiti:** M6-06, M6-07, M5-12 · **Contratto:** [§30](docs/MASTER_PLAN.md#s30) · [§36](docs/MASTER_PLAN.md#s36)

Chiudere verifica marchi/API eBay, ruoli dati, copertura MoR, adempimenti italiani residui, diritti consumatori e testi IT/EN di Termini, Privacy e consenso.

**Criterio di completamento:** Blocchi legali risolti; nessuna certificazione non dimostrata e distinzione chiara fra operatore Temisfera e venditore MoR.

Verificare testi accettati/versioni, ruoli effettivi, erasure provider e obblighi residui della vendita al MoR. Nessuna rinuncia generale a diritti consumatore nascosta in una traduzione o nel prezzo IVA esclusa.

### M7-08 — Verifica interna della matrice funzionale

**Stato:** TODO · **Prerequisiti:** M7-01..M7-07 · **Contratto:** [§35](docs/MASTER_PLAN.md#s35) · [§41](docs/MASTER_PLAN.md#s41)

Riesaminare tutte le funzioni, i diritti, le schermate, i dispositivi, gli errori e i rinvii rispetto al piano; eliminare aggiunte accidentali dei mockup.

**Criterio di completamento:** Matrice di accettazione coperta, P3 espliciti, zero P1/P2. Backlog ed evidenze distinguono lavoro concluso e futuro.

Distinguere criteri già provati e casi live finali assegnati a M9-01. La readiness per RC non è una certificazione di compliance o un PASS delle transazioni non ancora osservate.

<a id="m8"></a>

## M8 — Release Candidate e test reale

**Ingresso:** M7 chiusa, feature freeze e via owner al singolo merchant di fiducia.

**Autorizzazione:** Test reale autorizzato, nessun minimo di giorni artificiale; modifiche solo necessarie al rilascio.

### M8-01 — Congelamento RC

**Stato:** TODO · **Prerequisiti:** M7 · **Contratto:** [§34](docs/MASTER_PLAN.md#s34) · [§37](docs/MASTER_PLAN.md#s37)

Selezionare il candidato esatto da promuovere a RC, congelare nuove funzioni e identificare artefatto, schema e configurazione dell’ambiente di test.

**Criterio di completamento:** Commit e artefatto corrispondono, gate CI superati; soltanto correzioni necessarie. Nessuna release stabile 2.0 anticipata.

### M8-02 — Preparazione test merchant

**Stato:** TODO · **Prerequisiti:** M8-01 e via owner · **Contratto:** [§30](docs/MASTER_PLAN.md#s30) · [§35](docs/MASTER_PLAN.md#s35)

Preparare il test con un merchant di fiducia, dati e risorse autorizzati, scenari reali e modalità che non falsino i diritti della Production.

**Criterio di completamento:** Manifest del test approvato: account, ambiente, dati, credenziali, bot, eventuali effetti live e condizioni di uscita. Nessuna migrazione implicita di passkey, oggetti sandbox, ordini o diritti nel live; nessuna beta aperta o durata minima senza criterio.

### M8-03 — Esecuzione percorsi reali

**Stato:** TODO · **Prerequisiti:** M8-02 · **Contratto:** [§35](docs/MASTER_PLAN.md#s35)

Eseguire registrazione, quattro accessi, collegamento, sync, dati fiscali, copia, export, Telegram, impostazioni e percorsi billing pertinenti.

**Criterio di completamento:** Evidenze proporzionate di risultati e limiti, nessun P1/P2 né difficoltà strutturale di comprensione del prodotto principale.

### M8-04 — Verifica browser e presentazione

**Stato:** TODO · **Prerequisiti:** M8-01 · **Contratto:** [§22](docs/MASTER_PLAN.md#s22) · [§35](docs/MASTER_PLAN.md#s35)

Verificare Chromium/WebKit e regressione Firefox, viewport, touch/tastiera, IT/EN, scuro e testi lunghi. Usare screenshot reali solo nei contesti approvati.

**Criterio di completamento:** Layout e funzioni coerenti; mockup non sostituisce prova del software. Nessuna funzione assente viene annunciata come già attiva.

### M8-05 — Correzioni e decisione RC

**Stato:** TODO · **Prerequisiti:** M8-03, M8-04 · **Contratto:** [§34](docs/MASTER_PLAN.md#s34) · [§41](docs/MASTER_PLAN.md#s41)

Correggere difetti, aggiungere regressioni mirate e identificare una nuova RC quando cambia il candidato; accettare soltanto P3 non critici.

**Criterio di completamento:** Candidato tracciato e approvabile; test pertinenti superati e nessuna regressione di checkout, grant e decorrenze.

### M8-06 — Preflight restore unico

**Stato:** TODO · **Prerequisiti:** M8-05 · **Contratto:** [§32](docs/MASTER_PLAN.md#s32) · [§41](docs/MASTER_PLAN.md#s41)

Preparare target isolato, fonte di backup nativa, procedura e controlli su dati, diritti e revoche per l’unico ripristino pre-go-live.

**Criterio di completamento:** Unico drill conclusivo assegnato a M9-02 con candidato/schema/procedura identificati; eseguibile a fine M8 richiamando la stessa evidenza, senza duplicazione né periodicità obbligatoria. Non dichiararlo riuscito prima della prova.

<a id="m9"></a>

## M9 — Go-live

**Ingresso:** M0–M8 chiuse, RC approvata e checklist finale.

**Autorizzazione:** Date promo owner e comando Pubblica; tag/release solo dopo verifica della Production.

### M9-01 — Preflight commerciale e promo

**Stato:** TODO · **Prerequisiti:** M8 · **Contratto:** [§4](docs/MASTER_PLAN.md#s04) · [§5](docs/MASTER_PLAN.md#s05) · [§6](docs/MASTER_PLAN.md#s06)

Confermare date promo e configurazione commerciale; chiudere le prove Stripe residualmente solo-live nel perimetro autorizzato dei checkpoint M8/M9 già approvati, con effetti economici espliciti e senza apertura pubblica prima di Pubblica. Verificare percorso cliente Link/Portal, ricevute/contatti, riferimento del pagamento e riconciliazione dei diritti, con impatti economici espliciti.

**Criterio di completamento:** Nessun caso commerciale necessario rimane solo documentato/simulato senza prova consentita o decisione esplicita sul limite. Configurazione database/Stripe/UI allineata, nessun acquisto di capacità assente, Paddle inattivo salvo owner.

### M9-02 — Restore drill pre-go-live

**Stato:** TODO · **Prerequisiti:** M8-06 · **Contratto:** [§32](docs/MASTER_PLAN.md#s32) · [§41](docs/MASTER_PLAN.md#s41)

Eseguire il solo restore reale isolato sul candidato finale, oppure riusare la prova appena svolta a fine M8. Verificare dati, Auth, diritti, configurazioni e revoche.

**Criterio di completamento:** Un’unica prova conclusiva riuscita: dati/grant/config recuperati, post-snapshot riconciliato e accessi/erasure rispettati, outbound isolato. Può richiamare il drill sullo stesso candidato a fine M8; un fallimento blocca Pubblica finché corretto e riprovato.

### M9-03 — Checklist pubblica e operativa

**Stato:** TODO · **Prerequisiti:** M9-01, M9-02 · **Contratto:** [§41](docs/MASTER_PLAN.md#s41)

Rileggere in una checklist DNS/TLS/www/test, email, Auth, eBay, Telegram, Stripe, SEO, legali, supporto, alert, KPI, quote e rollback.

**Criterio di completamento:** Gate effettivamente superati, zero P1/P2 e go-live pronto per l’owner. Nessun evento o target non verificato indicato come riuscito.

### M9-04 — Pubblica 2.0.0

**Stato:** TODO · **Prerequisiti:** M9-03 e comando owner · **Contratto:** [§34](docs/MASTER_PLAN.md#s34)

Dopo Pubblica dell’owner, eseguire workflow sul commit atteso: gate, migrazioni, deploy, readback e poi tag, release e changelog.

**Criterio di completamento:** Artefatto e servizi attivi corrispondono; checkout allineato. Dichiarazione di pubblicazione soltanto dopo conclusione del ciclo applicabile.

Via riferito a commit/manifest, ambiente serializzato e artefatto verificato; ricevute per migration/deploy/tag. Se fallisce solo la Release GitHub dopo deploy riuscito, riprendere il passo mancante senza riscrivere dati o ripubblicare ciecamente.

### M9-05 — Dismissione residui 1.x e handover

**Stato:** TODO · **Prerequisiti:** M0-01; dismissione anticipata consentita nel mandato · **Contratto:** [§2](docs/MASTER_PLAN.md#s02) · [§33](docs/MASTER_PLAN.md#s33)

**Per chiudere:** M9-04; verifica conclusiva del passaggio di runtime e bot dopo il go-live.

Verificare che runtime e auto-update 1.x siano inattivi; rimuovere file obsoleti dopo aver trasferito contenuti utili. Preservare identità bot, keyset condivisi e storia Git.

**Criterio di completamento:** Nessun processo concorrente o credenziale condivisa eliminata; indici e procedure 2.0 autorevoli, altri progetti invariati. La dismissione può già essere avvenuta prima del go-live.

### M9-06 — Sorveglianza iniziale

**Stato:** TODO · **Prerequisiti:** M9-04 · **Contratto:** [§31](docs/MASTER_PLAN.md#s31) · [§41](docs/MASTER_PLAN.md#s41)

Nei primi giorni sorvegliare registrazioni, sync, Stripe, code, quote, errori e supporto, usando interventi mirati secondo le procedure.

**Criterio di completamento:** Esiti e anomalie registrati senza inventare una nuova beta pubblica o un SLA. Normale esercizio predisposto e nessuna chiusura fittizia delle verifiche.

## Attività rinviate — non prerequisiti della 2.0

Pagina Notifiche completa; filtri salvati e personalizzazione card Premium; Analisi Premium; team/collaboratori; coupon; accessibilità avanzata; pagina pubblica di stato; integrazioni/API pubbliche soltanto se richieste; iOS/Android React Native/Expo e offline eventuale nella 3.x. Il dettaglio segue il capitolo Roadmap, non compare come funzione incompleta da nascondere nel lancio 2.0.

**Controllo anti-divergenza:** prima di chiudere una milestone, confrontare feature/piano/versione, tutti i task applicabili e la DoD. Un conflitto tecnico con provider va portato al gate, non risolto eliminando silenziosamente una funzione. Il test con un solo merchant non certifica capacità statistica; un benchmark sintetico non dimostra l’eligibility fiscale del conto.
