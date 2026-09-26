# FiscalBay 2.0 — Backlog eseguibile

**Stato corrente:** M0 avviata il 2026-09-13 sulla baseline approvata. Le prove locali indipendenti, le letture eBay autorizzate e la qualifica Stripe Managed Payments in sandbox sono concluse; la slice login→negozio eBay→ordine→D1→pagina è provata sul dominio di test. Sign in with eBay è rinviato a M2-09 per decisione owner. M0 è chiusa con via owner del 2026-09-23; M1 è aperta.

[Master Plan](docs/MASTER_PLAN.md) · [Decisioni](docs/DECISION_REGISTER.md) · [Setup agenti](docs/engineering/AGENT_SETUP.md)

## Regole di esecuzione

Stati: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`, `DEFERRED`. **Prerequisiti** indica ciò che serve per iniziare; **Per chiudere**, quando presente, aggiunge dipendenze d’integrazione che non impediscono di lavorare prima. DONE richiede tutti i prerequisiti, le dipendenze di chiusura e il criterio di completamento, con un breve riferimento a commit/test/prova effettivi. Non precompilare evidenze. BLOCKED registra causa, input/gate atteso e lavoro indipendente proseguibile.

`M0` indica milestone chiusa e approvata dove previsto; `M0-03..M0-13` include tutti i task dell’intervallo; `M2..M6` tutte le milestone comprese. `G-*` rinvia al gate del piano al livello richiesto dalla fase: non anticipa prove live future. I task possono cambiare ordine o granularità preservando i riferimenti; nessun obbligo di ID consecutivi.

Le dipendenze prevalgono sulla numerazione. Ingressi delle milestone descrivono la disponibilità dell’integrazione completa, non impediscono attività indipendenti esplicitamente avviabili prima. Una UI con fixture non chiude un’integrazione reale. Rispettare il [governo](docs/MASTER_PLAN.md#s00) per autonomia e cinque checkpoint; nuovi costi/provider o cambi sostanziali richiedono owner, non ogni comando tecnico.

Il piano contiene i requisiti completi: qui si descrivono il lavoro e la prova, senza copiarli per intero. Codice/schema/test possono attestare il contratto; le [responsabilità documentali](docs/engineering/AGENT_SETUP.md#deliverable) non impongono file vuoti. Questo rimane l’unico task tracker, con informazioni private tenute nella custodia appropriata.

<a id="stato"></a>

## Stato corrente e ripresa

Questa sezione è un registro operativo iniziale, **non una prova di avvio già autorizzato**. Aggiornarla nello stesso intervento dei task pertinenti; non creare `STATUS.md`, `NEXT_STEPS.md` o un secondo backlog con informazioni concorrenti.

| Campo                                                       | Stato corrente e prove storiche                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Milestone / task in esecuzione                              | M1 aperta dopo il via di fine M0 del 2026-09-23 |
| Prossimo task eleggibile                                    | M1-02, M1-03 e M1-04 dopo M1-01; M1-05 in parallelo con mandato di rifinitura del logo; M1-08 indipendente. M2-09 attende il riscontro eBay `260920-000007` |
| Repository / branch / commit osservati nell’implementazione | `max23468/FiscalBay`; il 2026-09-26 `main` è `4df1961`, `develop` è `3466513`, con alberi identici e checkout pulito prima di M1-02; 1.x congelata in `legacy/1.x` (`508ded8`) |
| Blocchi noti iniziali                                       | La lettura Production sull'account amministratore ha restituito zero ordini; sul secondo account controllato Fulfillment non esponeva l'identificativo fiscale, trovato invece nel primo ordine letto tramite Trading; diritto email Identity mancante, con Sign in with eBay rinviato a M2-09; notifiche account-deletion ancora servite dal callback 1.x condiviso. Il deploy dell'handler Stripe, il segreto ristretto remoto, la registrazione dell'endpoint e la riconciliazione dei diritti appartengono a M5, non bloccano la qualifica M0 |
| Materiale privato                                           | Inventario fuori checkout: riferimento locale `FiscalBay/m0-inventory` nella custodia Codex privata       |
| Operazioni remote parziali da riconciliare                  | Timer autodeploy 1.x riletto `disabled` / `inactive` il 2026-09-19; bot e callback 1.x attivi. Creato il progetto Google dedicato `fiscalbay-2-0-max23468`, senza billing; branding test e client web `FiscalBay Test` configurati con callback dedicato. Ripristinato il progetto Supabase Free FiscalBay dalla pausa automatica, senza costo, ed eliminato su richiesta owner il 2026-09-23 senza consumatori residui. Creata la D1 temporanea di test `fiscalbay-m0-test` con giurisdizione UE, applicate tre migration e completato un restore Time Travel con sola riga sintetica. La misura M0-07 ha creato e poi eliminato sette tabelle `m0_bench_*`; il readback finale conferma 15 tabelle, 221.184 byte e dati applicativi invariati. La delega autorevole di `fiscalbay.it` è attiva su Cloudflare dal 2026-09-20. Il Worker `fiscalbay-test` è distribuito sul solo Custom Domain `test.fiscalbay.it`, con `workers.dev` disattivato e sette segreti runtime custoditi da Cloudflare. Email Sending è attivo su `auth.fiscalbay.it`, con record SPF, DKIM e DMARC pubblicati; `supporto@fiscalbay.it` è stato aggiunto e riletto come destinatario Cloudflare verificato. L'owner dichiara completata la configurazione iCloud Custom Email Domain con `info@fiscalbay.it` e `supporto@fiscalbay.it`; non è stata ripetuta una verifica esterna. eBay ha salvato il RuName Production dedicato con display title definitivo `FiscalBay` sul keyset `botCF`, privacy e callback su `test.fiscalbay.it` e about su `fiscalbay.it`. Il readback finale mostra OAuth disattivato sul RuName legacy `FiscalBay 1.0`, attivo sul RuName dedicato e il messaggio `Settings successfully saved`. Better Auth Infrastructure ha creato e collegato il progetto `FiscalBay Test` sul piano Starter gratuito. Dopo il cleanup autorizzato della sola identità Google duplicata, il browser interno ha completato linking, nuovo login Google e revoca globale. Il Worker versione `72100c36-6073-4f58-82f4-ca0033d0b2cc` non include TOTP; la D1 è tornata alle tre migration canoniche senza tabella o colonna TOTP e conserva un utente, due account `credential`/`google`, una passkey e zero sessioni. Il 2026-09-23, su richiesta owner, la D1 di test è stata svuotata dell'utente di prova precedente (un utente, due account e una passkey) e sono state applicate le migration `0004` e `0005`; l'owner ha creato e verificato `info@fiscalbay.it`. Il Worker test esegue il commit `a93f839`, versione `b0495522-59b8-4dc8-8c3b-ed58837c1977`; i segreti Stripe non sono più richiesti al deploy M0. Sulla VPS è stato letto soltanto lo stato 1.x; nessun token è stato stampato, persistito fuori dalla 1.x o scritto nel repository. Nessun push o merge 2.0 eseguito |
| Prossima azione alla ripresa                                | Attivare il deploy test dopo la custodia di un token Cloudflare ristretto nell'environment GitHub `test`, poi verificare il primo run e il readback; in parallelo M1-03/M1-04. Al riscontro eBay eseguire la checklist di M2-09 |

### Registro dei via e dei checkpoint

| Passaggio                    | Stato iniziale        | Cosa registrare quando effettivo                                                                                                    |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Adozione baseline e avvio M0 | REGISTRATO 2026-09-13 | Mandato corrente; ZIP esatto `FiscalBay_2.0_Finale.zip`, SHA-256 `4321784a3c58670dcbcf7d5b9a3f13599ad82dbc9ee74a00c7255b75ee3f85ba` |
| Riapertura candidato Supabase | REGISTRATO 2026-09-13 | L'owner accetta che le passkey Supabase siano sperimentali come rischio da provare in M0; la combinazione Supabase va confrontata con il candidato Cloudflare e non è esclusa per questo limite |
| Scelta candidato Cloudflare | REGISTRATO 2026-09-19 | L'owner sceglie Workers + D1 + Queues + Better Auth perché Supabase Pro non rientra nel budget. Workers Free resta il default fino all'apertura pubblica; capacità e piano vengono rivalutati progressivamente |
| Dominio e posta            | REGISTRATO 2026-09-19 | Spostare la zona DNS autorevole su Cloudflare mantenendo Register.it come registrar. Il vecchio hosting e i record email Register non hanno consumatori da preservare; la posta umana userà iCloud Custom Email Domain. Il trasporto transazionale Auth resta una scelta distinta da qualificare |
| Rinvio Accedi con eBay      | REGISTRATO 2026-09-23 | L'owner rinvia a [M2-09](#m2-09) la sola qualifica di Sign in with eBay, bloccata dal diritto `commerce.identity.email.readonly` in attesa sul ticket eBay `260920-000007`. Il collegamento del negozio seller non chiede l'email e resta in M0. Il quarto login resta obbligatorio: un diniego richiede una decisione owner sul requisito prima della chiusura di M2 |
| Upgrade Workers Paid        | DIFFERITO / CHECKPOINT | Il piano Workers Paid già attivo viene utilizzato fino alla scadenza del 20 ottobre 2026, senza downgrade anticipato; questo non autorizza il rinnovo. Dopo la scadenza, le soglie di attenzione sono 80.000 richieste dinamiche/giorno, CPU p95 di 8 ms, 8.000 operazioni Queue/giorno, 4 milioni righe D1 lette/giorno, 80.000 scritte/giorno, 4 GB D1, 160.000 eventi log/giorno o necessità di retention Time Travel oltre 7 giorni. Il readback del 2026-09-20 mostra però `cf-ready-prod` a 6,82 ms CPU p50 e 22,63 ms p90 nelle ultime 24 ore: prima del passaggio al Free la coda alta deve rientrare nel limite di 10 ms per invocazione e nella soglia prudenziale p95 di 8 ms. Il raggiungimento delle altre soglie apre una rivalutazione con dati correnti; non autorizza da solo costi o attivazioni. L'apertura pubblica M9 è il checkpoint naturale per decidere un nuovo Paid |
| Fine M0                      | REGISTRATO 2026-09-23 | Via owner al memo M0-14: Workers + una D1 UE + Queues + Better Auth, costi differiti e soglie, limiti di capacità, fallback Infrastructure, rinvii a M2-05/M2-09/M3-02/M5/M7 e rischi registrati. L'owner conferma inoltre di non usare TypeScript 5 né un secondo compilatore. Il via apre M1 e non autorizza push, merge, deploy di produzione o nuovi costi |
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
| Candidato        | SCELTO / PAID ESISTENTE POI FREE   | L'owner ha scelto Workers Free + D1 + Queues + Better Auth come assetto dopo la scadenza, ma usa il Workers Paid già attivo fino al 20 ottobre 2026. Nessun downgrade anticipato e nessun rinnovo automaticamente autorizzato. La slice D1 e Better Auth è il solo runtime mantenuto. Supabase Pro è escluso perché non rientra nel budget; Supabase Free non offre la continuità operativa richiesta e resta soltanto evidenza storica delle prove M0. Preflight, trasporto email controllato, email/password, passkey e Google sono provati; restano linking eBay, diritto email Identity e prove seller eBay prima di concludere M0. |
| Costi nominali   | PAID ATTIVO FINO ALLA SCADENZA     | Workers Paid già attivo viene utilizzato fino al 20 ottobre 2026; non viene disattivato in anticipo e il rinnovo resta da decidere. Workers Free non ha canone. Un futuro Paid da rivalutare parte da 5 USD/mese per account, con 10 milioni di richieste e 30 milioni di CPU-ms inclusi. Per 360.000 messaggi/mese, tre operazioni Queue per messaggio valgono circa 1,08 milioni di operazioni prima dei retry: sul Paid circa 0,03 USD oltre il milione incluso. L'ordine di costo indicativo sarebbe quindi circa 5,03 USD/mese prima di retry, email e altri consumi oltre soglia. R2 conserva la propria tariffazione e fascia inclusa separate. |
| Capacità account | MISURATA / FREE NON ANCORA PRONTO  | Workers Free offre 100.000 richieste dinamiche/giorno, 10 ms CPU per invocazione, 50 subrequest esterne per invocazione, 200.000 eventi log/giorno con 3 giorni di retention e asset statici senza limite di richieste. Queues Free include 10.000 operazioni/giorno e 24 ore di retention. D1 Free include 5 milioni di righe lette/giorno, 100.000 scritte/giorno, 500 MB per database e 5 GB totali. Nelle ultime 24 ore CF-Ready ha usato circa 16.288 richieste Workers; le due Queue principali hanno registrato zero operazioni. I tre database esistenti occupano circa 3,91 MB, di cui 3,69 MB CF-Ready, quindi storage account e numero database non sono il vincolo attuale. La D1 CF-Ready pre-anomalia, dal 10 al 12 settembre, ha letto 991.310 righe e scritto 3.070 righe in 72 ore: 330.437 letture e 1.023 scritture/giorno. La finestra ampia di sei ore del 20 settembre, depurata della sola query difettosa, proietta 148.652 letture e 5.168 scritture/giorno; la finestra post-fix di tre ore proietta 95.352 e 3.744. Per il budget si riserva il massimo pulito per dimensione, 330.437 letture e 5.168 scritture/giorno. Restano così 63.712 richieste Workers, 3.669.563 righe D1 lette e 74.832 scritte entro le soglie prudenziali, oppure 83.712, 4.669.563 e 94.832 ai limiti nominali. Questi margini non rendono oggi l'account compatibile con Free: `cf-ready-prod` ha CPU p90 22,63 ms e deve essere ottimizzato e rimisurato sotto il limite Free di 10 ms per invocazione. |
| Polling/coda     | PASS M0 / CODA È IL PRIMO LIMITE   | `ORDER_CONFIRMATION` accelera la scoperta dei nuovi ordini ma non copre gli aggiornamenti successivi. Il polling Fulfillment per `lastmodifieddate`, con overlap, paginazione e dettaglio mirato degli ordini cambiati, resta autorevole; il checkpoint avanza solo dopo l'applicazione completa. Con una Queue per ogni ciclo, tre operazioni per messaggio e frequenze di 48 cicli/giorno per Free e 144 per Premium, la soglia prudenziale account di 8.000 operazioni copre al massimo 55 negozi tutti Free, 18 tutti Premium oppure 33 negozi nel mix esatto un Premium ogni due Free; ai 10.000 nominali diventano 69, 23 e 39. Il target di 150 negozi produrrebbe circa 36.000 operazioni/giorno prima dei retry e non rientra nel Free. Se i polling senza lavoro non generassero messaggi, il limite successivo sarebbe lo storage D1: il picco misurato da 130.551.808 byte per 150 negozi porta a circa 459 negozi entro 400 MB prudenziali o 574 entro 500 MB nominali per database, prima di eBay, CPU, retry e traffico interattivo. È un limite conservativo di qualifica, non una capienza pubblica già approvata; Queue e consumer reali vengono rimisurati prima dell'apertura. |
| D1               | PASS REMOTO / PICCO FREE OLTRE SOGLIA | Sulla D1 UE di test, 150 workspace/negozi, 70.000 ordini, 210.000 articoli, 84.000 identificativi e 14.000 grant sintetici occupavano 44.789.760 byte; il caricamento ha richiesto 830 ms SQL. Una pagina tenant/grant da 50 ordini ha letto 996 righe in 11,4 ms a freddo e 0,6–1,8 ms nelle ripetizioni. Il burst di 30.000 raw da 1.093–1.094 byte, pari a 150 pagine piene da 200 ordini, ha richiesto 395 ms e 90.000 righe scritte con gli indici; porta il solo raw oltre la soglia di attenzione Free da 80.000 scritture/giorno. Dataset più raw attivo occupavano 87.740.416 byte; con altre 30.000 copie scadute il picco era 130.551.808 byte. Il pruning TTL di 30.000 raw ha richiesto 128 ms e lasciato soltanto i record con scadenza successiva alle 24 ore. Test Workerd verdi per isolamento tenant, più identificativi e consumo quota atomico. Tutte le tabelle benchmark sono state eliminate e il readback finale è tornato a 15 tabelle e 221.184 byte. |
| Auth             | PASS email/passkey/Google / eBay login RINVIATO M2-09 | Sul Worker test, l'account controllato ha completato registrazione email/password, verifica indirizzo, accesso, logout e rifiuto del riuso della vecchia sessione. Il recupero password ha consegnato la mail, invalidato la password precedente e accettato la nuova credenziale custodita nel Portachiavi. La prima mail applicativa è finita in spam e la seconda in inbox: il trasporto è provato, la deliverability iniziale resta un rischio. Una passkey con RP ID `test.fiscalbay.it` è stata registrata con autenticatore virtuale user-verified e ha completato due nuovi accessi separati da logout. Dopo la rimozione autorizzata della sola identità duplicata creata dal primo tentativo, il browser interno ha collegato Google all'utente email verificato, completato un nuovo login Google autonomo e revocato tutte le sessioni. D1 attesta un utente, account `credential` e `google` sullo stesso user ID, una passkey e zero sessioni. L'owner ha escluso TOTP dal candidato M0: la passkey resta un metodo di accesso separato e non viene dichiarata prova di MFA; la scelta della MFA amministrativa resta in M2-04. I token OAuth sono cifrati in D1 e le route HTTP che restituiscono access token o refresh token sono chiuse; il rinnovo resta disponibile al codice server. Better Auth Infrastructure è collegato sul piano Starter gratuito; Sentinel e gli altri servizi restano disattivati. Il rischio accettato resta la stabilità dell'API passkey sperimentale. Login e linking eBay dipendono dal diritto email Identity e sono rinviati a M2-09 per decisione owner. Il 2026-09-23 l'utente di prova è stato sostituito da `info@fiscalbay.it`, registrato e verificato dall'owner tramite la pagina minima. |
| eBay             | PASS seller/dati / Identity email RINVIATO M2-09 | L'account Developers e il keyset Production `botCF` di FiscalBay sono stati identificati. `botCF 2` appartiene a SyncBay ed è escluso. La 1.x usa `sell.fulfillment.readonly`, mentre il callback di cancellazione inoltra il payload firmato a Hub Fatture; il keyset e i callback legacy non vanno riconfigurati finché i consumatori non sono migrati. La 2.0 prepara un consenso minimo con Identity, email Identity e Fulfillment read-only. La prova Production mostra che Fulfillment può non esporre `buyer.taxIdentifier`: nella 2.0 Trading `GetOrders` mirato è la fonte primaria degli identificativi fiscali e legge `BuyerTaxIdentifier`; Fulfillment resta la fonte primaria per acquisizione, stato e dettaglio generale degli ordini. Developer Analytics ha confermato 100.000 chiamate/giorno per Fulfillment Order e 5.000 per Trading `GetOrders` e `GetItem`. Il collegamento del negozio 2.0 è separato dal login (D048) e chiede soltanto base, Identity e Fulfillment read-only. La slice ha collegato il secondo seller controllato e importato un ordine reale con osservazione fiscale Trading nella D1 di test. Restano il diritto email Identity (M2-09), la prova live del callback seller 2.0 (M2-05) e la configurazione coordinata delle notifiche obbligatorie di cancellazione. |
| Export           | PASS locale                        | `exceljs` 4.4.0 e `fflate` 0.8.3, entrambe MIT. Il CSV conserva il valore letterale e neutralizza formule con apostrofo; l’import in un foglio può comunque applicare cast automatici. XLSX assegna testo esplicito; ZIP contiene entrambi. Prova Workerd su 1.000 ordini e due identificativi: 81 ms. Override `uuid` 11.1.1 verificato; audit Production senza vulnerabilità note. Il contratto di consegna impone endpoint autenticato, rilettura dei diritti a generazione e download, revisione workspace e validità massima 24 ore riducibile; l'implementazione resta M6. |
| Stripe           | PASS M0 docs/config/sandbox                   | Managed Payments è `Pronto all'uso` e resta attivabile per singola Checkout Session. Il catalogo live contiene il solo prodotto SaaS idoneo `FiscalBay Premium`, con prezzi IVA esclusa mensile, annuale e una tantum; il mensile è predefinito. Descrizioni, immagine prodotto, logo/icona 1.0 e colori ufficiali sono configurati. In sandbox il catalogo equivalente ha completato un abbonamento mensile, un pagamento lifetime, annullamenti e rimborsi, una sessione annuale e un rinnovo mensile reale tramite Test Clock. Checkout mostrava logo 1.0, descrizione, imposte italiane e `Venduto tramite Link`. Un evento firmato reale del relay Stripe ha raggiunto l'handler locale con HTTP 204 ed è stato registrato una sola volta in D1; il prodotto sintetico creato dal trigger è stato archiviato. L'integrazione locale usa l'SDK ufficiale, corpo webhook grezzo e tabella idempotente senza payload. Endpoint remoto, segreti, entitlement e prove Link/Portal live restano assegnati a M5/M9; nessuna transazione live è stata eseguita e i dati fiscali dell'account non sono stati modificati. |
| Legale preliminare | PASS M0 / GATE PUBBLICI ASSEGNATI          | Temisfera resta titolare del prodotto e dei trattamenti applicativi; Stripe/Link è merchant of record nel perimetro Managed Payments, senza assorbire supporto prodotto, contabilità propria, informativa e obblighi non coperti. eBay impone DPA, minimizzazione, cancellazione irreversibile e vincoli su contenuti/marchi: callback 2.0 e cutover restano M7. L'owner sceglie di mantenere Better Auth Infrastructure cloud per dashboard e audit controllati. Il plugin esporta eventi di autenticazione con identificativi e dati tecnici anche con l'activity tracking opzionale disattivato; prima di utenti pubblici servono DPA applicabile, inventario dei trasferimenti, informativa e piano idoneo alla Production, altrimenti il collegamento cloud viene disabilitato mantenendo Better Auth core. Codex resta strumento interno occasionale, non runtime: un uso sistematico con dati reali richiede verifica del piano/account e del trattamento applicabile. Licenze runtime censite senza incompatibilità emerse; notice, licenza proprietaria del nuovo codice e provenienza degli asset finali restano deliverable M1/M7. Informativa, termini, recesso/rimborsi, registro fornitori e dati reali dell'operatore richiedono revisione finale prima della pubblicazione. |
| Recovery         | PASS mirato / 7 GIORNI FREE        | D1 Time Travel conserva 7 giorni sul piano Free e 30 giorni sul Paid. Le tre migration applicative e Better Auth sono presenti nella D1 remota UE `fiscalbay-m0-test`. Una riga sintetica inserita dopo un bookmark è stata rimossa dal restore e le tre migration sono rimaste applicate. Per decisione owner FiscalBay usa una sola D1: prima del restore congela i flussi ed estrae i marker successivi allo snapshot, poi li riapplica e riconcilia i provider prima di riaprire. Se l'intervallo non è ricostruibile, il servizio resta chiuso. La necessità operativa di superare 7 giorni apre la rivalutazione del piano; il drill conclusivo resta M9. |
| Toolchain        | PASS                               | Node 26.8.2 e pnpm 12.4.1 sono entrambi attivati da `mise`; è stata rimossa la caduta silenziosa sul pnpm 11 del runtime Codex. TypeScript 7.0.2, React/DOM 19.3.0, React Router 8.3.1, Vite 8.3.0, Wrangler 4.131.1, Vitest 4.1.11 per compatibilità col plugin Cloudflare, Oxlint/Oxfmt. Install frozen, peer check, typecheck, 21 test, build e verifica documentale verdi con le versioni richieste.                                                                                                                                                                              |

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

**Stato:** DONE · **Prerequisiti:** M0-01, M0-11 · **Contratto:** [§33](docs/MASTER_PLAN.md#s33)

Configurare accessi minimi e inventario privato; preparare solo l’endpoint test HTTPS/callback e il trasporto email Auth necessari alla qualifica, su risorse autorizzate. Prima dell’acquisizione reale verificare il relativo perimetro di trattamento; applicare la qualifica tool proporzionata al rischio e riusare prove condivise fra CLI/MCP. M1-08 completa la configurazione, non è il primo momento in cui un login può essere provato.

**Criterio di completamento:** Prerequisiti di prova osservabili: endpoint/TLS, destinatario email controllato, account/ambiente corretti, autorizzazioni e lista tool. Mancanze segnate BLOCKED; nessuna spesa, PII pubblica o scrittura estranea. Le prove eseguibili usano la toolchain qualificata in M0-11.

**Evidenza DNS/TLS:** il 2026-09-20 il registro `.it`, i resolver pubblici e la Dashboard Cloudflare attestano la delega attiva di `fiscalbay.it` ai nameserver `carl.ns.cloudflare.com` e `pat.ns.cloudflare.com`. DNSSEC resta disattivato. Il Worker `fiscalbay-test` è distribuito sul solo Custom Domain `test.fiscalbay.it`; `workers.dev` restituisce 404. Dopo un primo avviso DCV fallito, Cloudflare ha notificato come attivo il certificato `39c9b9a4-5dab-421c-a78e-a853fdd6702f`. La rilettura indipendente dell'edge restituisce HTTP 200, verifica TLS 0 e certificato Google Trust Services valido dal 20 settembre al 19 dicembre 2026 per `fiscalbay.it`, `test.fiscalbay.it` e `*.test.fiscalbay.it`. Le challenge TXT transitorie dell'avviso non sono state aggiunte. La posta umana usa iCloud Custom Email Domain; non risultano caselle Register da migrare.

**Evidenza trasporto Auth:** Cloudflare Email Service è attivo su `auth.fiscalbay.it`; la CLI rilegge il sottodominio abilitato e i record per bounce, SPF, DKIM e DMARC risultano pubblicati. Sul piano Free consente senza costo invii verso destinatari verificati, sufficienti per la prova controllata M0; l'invio a destinatari arbitrari richiede Workers Paid. Il commit `3f21327` collega Better Auth al binding nativo con mittente limitato a `accesso@auth.fiscalbay.it`, separando il trasporto transazionale dalla posta iCloud sull'apice; copre verifica indirizzo e recupero password, senza API key o nuova dipendenza. Le callback di invio demandano il lavoro a Cloudflare con `waitUntil`, così la risposta Auth non attende il provider. La configurazione usa il nome stabile di ambiente `fiscalbay-test`; la D1 `fiscalbay-m0-test` conserva il nome di milestone perché è una risorsa temporanea di qualifica già popolata soltanto con dati sintetici. La rilettura remota del 2026-09-21 conferma che il registro D1 conserva `0001_m0_slice.sql`, `0002_better_auth.sql` e `0003_order_items_and_sync_state.sql`. Il repository mantiene quindi il nome già applicato `0001_m0_slice.sql` come vincolo di compatibilità; `wrangler d1 migrations list --remote` propone correttamente soltanto `0004_tax_identifier_source.sql`, senza ricreare il database o alterare il registro. Lo schema degli eventi Stripe usato nella qualifica resta una migration test-only: la migration applicativa verrà introdotta con l'integrazione M5, evitando di anticiparne il deploy. Il deploy effettivo collega D1, Email Service e origine `https://test.fiscalbay.it`. La rilettura remota mostra sette secret text, per Better Auth, Google ed eBay, senza esporne i valori; la versione attiva è `b387d7ef-eaee-410b-94e3-2c8ce7ed26be`. `/`, `/auth/error` e `/api/auth/get-session` restituiscono HTTP 200 con verifica TLS 0. `supporto@fiscalbay.it` è stato aggiunto e riletto come destinatario verificato dell'account Cloudflare. La verifica indirizzo e il recupero password sono stati consegnati: il primo messaggio applicativo è finito in spam, il secondo in inbox. Entrambi i flussi hanno completato l'effetto Auth previsto; la reputazione iniziale del mittente resta da osservare senza moltiplicare invii di prova.

**Evidenza Google Auth e posta umana:** il progetto Google dedicato usa pubblico esterno in stato Test e il client web `FiscalBay Test`, con callback `https://test.fiscalbay.it/api/auth/callback/google`. Il branding riletto mostra nome FiscalBay, logo 1.0 provvisorio, home, privacy e termini sul dominio test, dominio autorizzato `fiscalbay.it`, email personale dell'owner come assistenza utenti temporanea e `supporto@fiscalbay.it` come contatto sviluppatore. Il JSON del client è custodito fuori dal checkout in `FiscalBay/google-oauth-test.json`, con permessi locali limitati; nessun valore segreto è riportato qui. L'owner dichiara completata la configurazione iCloud Custom Email Domain con `info@fiscalbay.it` e `supporto@fiscalbay.it` e ha chiesto di non ripetere il controllo.

**Preflight trattamento:** le prove M0 usano soltanto `test.fiscalbay.it` e le caselle controllate `supporto@fiscalbay.it` e, dal 2026-09-23, `info@fiscalbay.it`. Possono acquisire indirizzo email, nome tecnico di prova, identificativi account, credenziali Auth custodite e sessioni/token cifrati necessari a email/password, Google, eBay e passkey. Non acquisiscono ordini, dati buyer, identificativi fiscali o payload eBay. La finalità è limitata alla qualifica di linking, verifica, recovery e revoca; l'account resta soltanto per la durata delle prove M0 dipendenti e viene poi eliminato o promosso a fixture controllata con decisione esplicita. Log e telemetria restano minimizzati secondo il piano; nessun valore personale entra in Git, fixture, screenshot o evidenze pubbliche. Il diritto email Identity mancante impedisce il callback eBay completo e non viene aggirato. **Eccezione ratificata dall'owner il 2026-09-23:** la slice M0-13 ha salvato nella sola D1 `fiscalbay-m0-test` un ordine reale del secondo seller controllato e l'identificativo fiscale del relativo acquirente, fuori da questo preflight. L'owner ha deciso di conservarli dopo averlo saputo; restano soltanto nella D1 di test, non entrano in Git, log, fixture o evidenze, e vanno eliminati al più tardi prima del go-live insieme alla copia ancora recuperabile tramite Time Travel.

**Evidenza:** endpoint/TLS, ambiente, account provider, toolchain, trasporto e destinatario controllato sono osservati; il preflight circoscrive dati e finalità prima della prima registrazione reale. Il trasporto transazionale Better Auth resta separato dalla casella iCloud e l'invio pubblico resta vincolato al checkpoint Workers Paid.

### M0-03 — Inventario risorse Cloudflare/Supabase

**Stato:** DONE · **Prerequisiti:** M0-01; accessi di lettura pertinenti (non callback/email) · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§36](docs/MASTER_PLAN.md#s36)

Leggere piani, quote e consumi degli account pertinenti, inclusi altri progetti; separare capacità nominale da residua e individuare costi nuovi.

**Criterio di completamento:** Misure/fonti per CPU, DB, file, queue, egress, auth, email e log; nessun canone dato per già pagato o gratuito senza evidenza.

Se una verifica richiede un piano a pagamento prima della scelta finale, ottenere un’autorizzazione limitata alla prova e registrare costi/reversibilità. Il via di fine M0 non sana spese già effettuate senza consenso.

**Evidenza:** Supabase è stato riletto in Dashboard; il piano Free e la capacità condivisa osservata sono riportati sopra e restano evidenza dell'alternativa esclusa. Cloudflare CLI ha escluso le risorse CF-Ready dal perimetro FiscalBay. La D1 FiscalBay di test è stata creata in giurisdizione UE e il Worker `fiscalbay-test` è distribuito; nessuna Queue FiscalBay è presente. Il readback remoto conferma 15 tabelle, tre migration, zero workspace, 217 kB e regione EEUR. La Dashboard del 2026-09-20 mostra Workers Paid `In scadenza` il 20 ottobre 2026, R2 Paid attivo e la zona FiscalBay sul piano Free. L'owner ha creato un account Better Auth Infrastructure e ha chiesto di collegarlo: il piano Starter osservato è gratuito, con un posto dashboard, 10.000 audit log al mese e un giorno di retention. Email, SMS, Sentinel e piano Pro non rientrano nella configurazione M0.

**Chiusura M0:** risorse, separazione fra progetti, costi correnti, limiti nominali e capacità condivisa osservabile sono inventariati; il candidato è scelto e le alternative sono chiuse. Per decisione owner, il readback successivo alla cessazione effettiva di Workers Paid e le nuove misure giornaliere del piano Free non sono un gate M0: verranno raccolti alla prima occasione utile. Email Service Free copre soltanto i destinatari verificati della prova M0; l'invio Auth a utenti arbitrari resta un checkpoint pre pubblico. Nessun rinnovo o nuovo upgrade è autorizzato ora.

### M0-04 — Qualifica dei quattro accessi

**Stato:** DONE · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§36](docs/MASTER_PLAN.md#s36)

Escludere documentalmente candidati incompatibili; sul candidato preferito provare email/password, Google, eBay e passkey con linking, recupero e revoca. La MFA amministrativa resta assegnata a M2-04 e non è un gate M0. Un secondo spike Auth è necessario solo se resta un’incertezza determinante. Non costruire quattro schermate definitive per ogni provider.

**Criterio di completamento:** Matrice pass/fail con prove e limiti; nessun secondo layer nascosto o metodo eliminato per comodità.

Qualificare SSR/helper eventuali, RP ID e origini separati test/live, riuso del JWT dopo logout e revoca sui percorsi API/RPC/file realmente esposti. La passkey resta un metodo di accesso separato e non viene dichiarata MFA; helper beta e fallback non sono ammessi tacitamente.

**Evidenza parziale:** schema e avvii Better Auth locali dei quattro metodi sono provati. Verifica indirizzo e recupero password sono collegati al binding nativo Cloudflare Email Service con mittente limitato al sottodominio Auth; nessuna API key o dipendenza email è stata aggiunta. Sul percorso Supabase sono riusciti registrazione e nuovo accesso passkey nel browser con sessione Auth, RP ID controllato e autenticatore virtuale; un secondo accesso è riuscito anche dopo il ripristino della credenziale. Lo spike non ha creato progetti remoti o costi. L'avvio iniziale dell'intero stack locale ha esaurito la memoria del container Analytics; gli avvii limitati a database, Kong, Auth e Data API sono riusciti con servizi healthy.

**Evidenza reale controllata:** su `test.fiscalbay.it` è stato creato un solo utente controllato, verificato tramite la mail ricevuta su iCloud. Email/password ha restituito una sessione valida; il logout ha invalidato il token e il suo riuso ha restituito sessione nulla. Il recupero ha consegnato il link, consumato il token una sola volta, rifiutato la password precedente e accettato quella nuova, custodita nel Portachiavi macOS. Con Playwright e un autenticatore CTAP2 virtuale user-verified, RP ID `test.fiscalbay.it`, la stessa identità ha registrato una passkey e completato due accessi successivi, ciascuno dopo logout. La revoca globale ha eliminato tutte le sessioni residue delle prove; il cookie revocato ha restituito sessione nulla e il readback D1 finale mostra zero sessioni. La credenziale dell'autenticatore virtuale è solo prova M0 e non viene trattata come credenziale Production o dispositivo reale.

**Evidenza parziale:** Google Cloud è autenticato. I quattro progetti preesistenti sono stati esclusi e il progetto dedicato `fiscalbay-2-0-max23468` è attivo senza billing e senza cambiare il progetto CLI predefinito. Il client web `FiscalBay Test` usa la callback dedicata; le credenziali sono custodite fuori dal checkout e caricate nel Worker come secret.

**Evidenza parziale:** `@better-auth/infra` 0.4.9 è compatibile con Better Auth 1.7.5 ed è configurato con il solo plugin `dash()`, condizionato alla chiave dedicata. La chiave non è nel repository ed è caricata come secret nel Worker test; Activity tracking, Sentinel, email, SMS e servizi enterprise restano disattivati. Better Auth Infrastructure ha creato il progetto `FiscalBay Test` sul piano Starter gratuito e completato il pairing con `https://test.fiscalbay.it/api/auth`: `dash/validate`, `dash/config` e `dash/user-stats` hanno restituito HTTP 200, mentre il dashboard mostra zero utenti. Gli insight configurativi sono stati chiusi aggiornando Better Auth e Passkey a 1.7.5, dichiarando l'header Cloudflare autorevole per l'IP, aggiungendo la pagina errore OAuth e abilitando i database join; il readback finale del dashboard mostra `Configuration Looks Great` e nessuna configurazione errata. Il suggerimento rotante sull'email Infra non è un rilievo: il trasporto M0 resta intenzionalmente Cloudflare Email Service. Il primo tentativo ha diagnosticato un valore copiato con l'etichetta della variabile; la normalizzazione senza stampa o persistenza del segreto ha chiuso l'errore. La CLI `auth` 1.7.5 espone `login`, ma il comando pubblicato richiama ricorsivamente `npx auth@latest login`; l'esecuzione è stata interrotta e non ha prodotto sessioni o file. Sul dominio test, la sessione nulla e l'avvio dei provider Google ed eBay rispondono correttamente senza completare login o consenso. Il gate completo è verde: formattazione, lint, tipi, 14 test, build e controlli documentali.

**Evidenza Google controllata:** il primo consenso reale ha completato callback, sessione verificata e logout, ma avviato senza sessione locale ha creato un secondo utente con il solo provider Google. Il successivo linking dall'utente email è arrivato al callback ed è stato rifiutato con `email_does_not_match`. Better Auth consente indirizzi diversi soltanto nel linking esplicito autenticato con `account.accountLinking.allowDifferentEmails`; la configurazione è coperta nel test esistente, `pnpm verify` è verde e la versione Worker `70905206-05ab-48c5-ac45-facb28718ee9` è distribuita. Dopo conferma owner, la sola identità Google-only è stata cancellata con predicato vincolato al provider e il readback ha confermato utente email e passkey intatti. Nel browser interno, la sessione email verificata ha quindi collegato Google; un logout seguito da accesso Google autonomo ha restituito lo stesso utente locale con entrambi i provider. La revoca globale finale ha eliminato tutte le sessioni. D1 attesta un utente, due account sullo stesso user ID, una passkey e zero sessioni.

**Decisione MFA:** l'owner ha escluso TOTP dal candidato M0. Nessun fattore TOTP è stato attivato e nessun segreto o backup code è stato creato. La passkey resta un metodo distinto e non viene usata per dichiarare MFA effettiva; selezione e prova della MFA amministrativa restano nel task M2-04.

**Rinvio a M2-09:** preflight, email/password, verifica, recupero, revoca della sessione, passkey e Google sono provati. Login e linking eBay dipendono dal diritto `commerce.identity.email.readonly`, ancora in attesa: per decisione owner del 2026-09-23 la loro qualifica passa a [M2-09](#m2-09) secondo [§36.2](docs/MASTER_PLAN.md#s36). Non sono dichiarati provati e il quarto login resta obbligatorio. L'owner accetta il rischio sperimentale delle passkey per la qualifica.

### M0-05 — Qualifica fonti eBay e keyset

**Stato:** DONE · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§9](docs/MASTER_PLAN.md#s09) · [§11](docs/MASTER_PLAN.md#s11) · [§36](docs/MASTER_PLAN.md#s36)

Verificare OAuth seller/Identity, scope, ID stabili, getOrders/getOrder/Trading necessarie, età campi, mascheramenti, immagini e ordini non pagati.

**Criterio di completamento:** Matrice fonte-campo-età-stato, condizioni autorizzate, quote effettive; fixture sanitizzate e test read-only autorizzati.

Includere il contratto delle notifiche obbligatorie di cancellazione eBay, distinta da eventuali eventi ordini opzionali. La disponibilità di payload reali non esonera dal preflight trattamento di M0-02.

**Evidenza parziale:** l'account Developers, il keyset FiscalBay `botCF`, il RuName attivo e il consumo 1.x sono stati identificati senza modifiche. `botCF 2` è di SyncBay ed è escluso. La 1.x usa `sell.fulfillment.readonly`; il callback di cancellazione verifica la firma e inoltra il payload firmato a Hub Fatture prima di segnarlo elaborato. I 34 scope salvati, il RuName Hub Fatture e questo consumatore rendono keyset e callback legacy contratti da migrare, senza riuso diretto per la 2.0. Il readback Production del 2026-09-19 attesta `commerce.identity.readonly` e `sell.fulfillment.readonly`, ma non `commerce.identity.email.readonly`. L'email degli account business è compresa nella risposta Identity di base; quella degli account individuali richiede invece un diritto previsto dal contratto con eBay. Il consenso Better Auth della 2.0 prepara gli scope base, Identity, email Identity e Fulfillment read-only e il test locale verifica l'insieme esatto, ma non può essere eseguito finché il diritto mancante non viene concesso o il requisito del login eBay non viene ristretto con una decisione esplicita. Il portale ha salvato e riletto il RuName Production dedicato con display title definitivo `FiscalBay`, privacy `https://test.fiscalbay.it/privacy`, about `https://fiscalbay.it/` e callback accettato/rifiutato `https://test.fiscalbay.it/api/auth/callback/ebay`. Su indicazione dell'owner, OAuth è stato spostato dal RuName legacy `FiscalBay 1.0` a quello dedicato: il readback finale mostra il primo disattivato, il secondo attivo e `Settings successfully saved`. Il selettore eBay genera una URL con base, `sell.fulfillment.readonly` e `commerce.identity.readonly` quando vengono scelti, ma torna a mostrare i 34 scope disponibili dopo il reload; l'insieme effettivamente richiesto resta pertanto governato e verificato dalla configurazione Better Auth. Il readback Analytics API del 2026-09-20 sul keyset Production conferma per Fulfillment 100.000 chiamate/giorno; due letture successive hanno osservato 270 e 280 chiamate usate, con 99.730 e 99.720 residue, mentre la 1.x rimane attiva. Trading `GetOrders` e `GetItem` hanno 5.000 chiamate/giorno ciascuna e zero uso nella finestra iniziale osservata. Il 2026-09-20 l'owner ha inviato da Safari il Growth Check per l'accesso Identity ristretto, distinguendo la 1.0 già in produzione dalla 2.0 in sviluppo; eBay ha assegnato il riferimento `260920-000007` e indicato una risposta entro 1-2 giorni lavorativi.

**Prova Production controllata:** dopo autorizzazione owner, la 1.x ha richiesto al massimo un ordine Fulfillment nella finestra di 729 giorni sull'account Production amministratore. La risposta è riuscita ma non conteneva ordini, quindi nessun payload buyer è stato restituito. L'owner ha poi confermato che anche il secondo account Production collegato è controllato. Su questo account `getOrders` con limite 1 e il relativo `getOrder` hanno restituito lo stesso ordine recente, con strutture identiche fra lista e dettaglio: pagamento `PAID`, fulfillment `NOT_STARTED`, un line item, `cancelStatus` presente e nessun rimborso. `fulfillmentStartInstructions.shippingStep.shipTo` contiene nome, telefono, email e indirizzo; l'email è presente perché l'ordine ha meno di 14 giorni. `buyer` contiene username, indirizzo di registrazione e tax address, ma non `taxIdentifier`. Una prima scansione dei soli dettagli Fulfillment è stata interrotta perché non riproduceva il percorso fiscale effettivo della 1.x. La prova corretta tramite Trading `GetOrders`, sulla finestra autorizzata di 89 giorni, ha trovato `BuyerTaxIdentifier` nel primo ordine esaminato: identificativo e tipo sono presenti, mentre il paese emittente è assente. Nessun valore buyer, fiscale, indirizzo, email, telefono, token o ID ordine è stato stampato o persistito. Il payload Fulfillment live restituisce ancora `legacyOrderId`, in contrasto con la release note 1.20.6 che lo dichiara rimosso: il contratto runtime deve quindi tollerarlo senza usarlo come chiave canonica.

**Decisione fonte fiscale 2.0:** Trading `GetOrders` è la fonte primaria di `BuyerTaxIdentifier`, non un fallback successivo a `buyer.taxIdentifier`. Fulfillment resta la fonte primaria per scoprire e aggiornare ordini, stati e dettagli generali; il job fiscale usa gli identificativi ordine riconciliati per una lettura Trading mirata, entro finestra e quota qualificate. Un eventuale identificativo fiscale presente anche in Fulfillment è trattato come seconda osservazione da confrontare e non cambia la precedenza della fonte Trading.

**Fixture e contratto locale:** la migration `0004_tax_identifier_source.sql` rende facoltativo il Paese emittente e registra la provenienza dell'osservazione. Il mapper Trading assegna sempre la fonte primaria `ebay_trading_get_orders`, conserva `IssuingCountry` quando restituito e lascia `null` quando assente, senza dedurlo dal tipo o dal valore. La fixture usa soltanto valori sintetici; il test della vertical slice prova anche che un identificativo senza Paese resta visibile al tenant autorizzato.

**Contratto fonte corrente:** Fulfillment `getOrders` supporta filtri per creazione, ultima modifica e stato di fulfillment, con pagine fino a 200 ordini. Dal 2023 può recuperare ordini fino a due anni; oltre 90 giorni i campi PII sono mascherati. L'email buyer cessa di essere restituita dopo 14 giorni. Fulfillment include soltanto transazioni con checkout completato: non include acquisti pending-payment che richiedono pagamento anticipato, mentre può includere ordini non ancora pagati che non richiedono pagamento anticipato. Ordini annullati o rimborsati restano nella fonte e vanno classificati dai relativi stati; Trading conserva una finestra massima di 90 giorni.

**Contratto account-deletion corrente:** eBay richiede iscrizione oppure esenzione solo per applicazioni che non persistono dati eBay. Il challenge GET usa SHA-256 su `challengeCode + verificationToken + endpoint`; i POST portano `X-EBAY-SIGNATURE`, richiedono verifica tramite chiave pubblica eBay e possono riutilizzare la chiave in cache per circa un'ora. Gli invii non riconosciuti vengono ritentati; dopo 24 ore l'endpoint è segnalato non raggiungibile e il developer ha fino a 30 giorni per correggerlo. Poiché `botCF` è condiviso con la 1.x e il callback vigente inoltra già le cancellazioni a Hub Fatture, nessun endpoint 2.0 viene registrato finché verifica, cancellazione irreversibile, retry e cutover del consumatore legacy non sono pronti insieme.

**Chiusura M0:** il collegamento del negozio seller non richiede lo scope email ed è provato dalla slice M0-13 con dati reali. Il diritto `commerce.identity.email.readonly` serve soltanto a Sign in with eBay, rinviato a [M2-09](#m2-09) per decisione owner del 2026-09-23. Il limite effettivo Fulfillment, la struttura non fiscale di lista/dettaglio, la presenza reale di `BuyerTaxIdentifier` tramite Trading e la fixture sanitizzata della fonte fiscale primaria sono provati. Le notifiche di cancellazione marketplace restano sul callback 1.x condiviso: un endpoint 2.0 separato non può essere attivato sullo stesso App ID senza un cutover coordinato, assegnato alle milestone successive.

**Matrice fonte-campo-età-stato:**

| Dato | Fonte primaria | Finestra ed età | Mascheramenti e assenze | Esito M0 |
|---|---|---|---|---|
| Scoperta e stato ordini: `orderId`, creazione, ultima modifica, stato pagamento, fulfillment e cancellazione | Fulfillment `getOrders`, pagine fino a 200, filtri per creazione, modifica e stato | Fino a due anni | Assenti gli acquisti pending-payment con pagamento anticipato; presenti ordini non pagati senza pagamento anticipato; `legacyOrderId` ancora restituito ma non usato come chiave | PASS: campione Production con paginazione e overlap (M0-06) |
| Dettaglio, righe, totali | Fulfillment `getOrder` o riga di `getOrders` | Fino a due anni | Lista e dettaglio con struttura identica sul campione | PASS: campione controllato e import della slice (M0-13) |
| Immagine articolo | Trading `GetItem` tramite `legacyItemId` della riga | Legata all'annuncio | Assente in Fulfillment: la riga reale espone `legacyItemId` e `title`, nessun campo immagine | Fonte individuata; lettura, dominio immagini e SSRF in M3-02 |
| Destinatario di spedizione | Fulfillment `shipTo` | PII mascherata oltre 90 giorni | Solo osservato, mai persistito | PASS osservato |
| Email buyer | Fulfillment `shipTo` | Fino a 14 giorni dalla creazione | Assente dopo 14 giorni | PASS osservato |
| Identificativo fiscale: tipo, valore, Paese emittente | Trading `GetOrders` `BuyerTaxIdentifier`; Fulfillment `buyer.taxIdentifier` solo come seconda osservazione | Trading: 90 giorni | Paese emittente può mancare; Fulfillment può non esporre l'identificativo | PASS reale (M0-05, M0-13) |
| Identità seller stabile | Commerce Identity `getUser`, scope `commerce.identity.readonly` | Non applicabile | Nessuna | PASS nella slice M0-13 |
| Email dell'account per il login | Commerce Identity con `commerce.identity.email.readonly` | Non applicabile | Diritto non concesso al keyset | RINVIATO a M2-09 |
| Evento nuovo ordine | Notification `ORDER_CONFIRMATION` | Tre tentativi di consegna | Non copre aggiornamenti; il polling resta autorevole | PASS documentale e `getTopic` (M0-06) |
| Cancellazione account marketplace | Notifica obbligatoria di account deletion | Retry per 24 ore, correzione entro 30 giorni | Oggi servita dal callback 1.x condiviso | Contratto qualificato; cutover in M7 |

Quote effettive sul keyset `botCF`: Fulfillment 100.000 chiamate/giorno, Trading `GetOrders` e `GetItem` 5.000 ciascuna (M0-06).

La checklist operativa al riscontro eBay è in [M2-09](#m2-09).

### M0-06 — Qualifica eventi, polling e lavoro API

**Stato:** DONE · **Prerequisiti:** M0-05 · **Contratto:** [§11](docs/MASTER_PLAN.md#s11) · [§36](docs/MASTER_PLAN.md#s36)

Misurare strategia incrementale, disponibilità eventi utili, manuale, 10/30min, backfill, retry e vincoli keyset condivisi.

**Criterio di completamento:** Budget chiamate/messaggi realistico con margine, eventi non presunti, nessuna invasione quote altrui.

**Evidenza parziale:** Queues Free include 10.000 operazioni/giorno; il volume obiettivo ne richiede circa 36.000 prima dei retry. Il piano Free copre le fasi prima dell'apertura pubblica; l'80% della quota giornaliera apre una rivalutazione con misure reali. La prova concorrente Supabase è conservata come evidenza storica del carico, mentre la coda Cloudflare remota attende il consumer effettivo. Trading `GetOrders` ha 5.000 chiamate/giorno e non sostiene i 12.000 cicli/giorno previsti: è la fonte primaria fiscale, ma viene invocata soltanto per i lavori fiscali mirati generati dall'acquisizione Fulfillment. Il polling ordini usa Fulfillment `getOrders`: il readback del keyset conferma 100.000 chiamate/giorno; durante le prove la 1.x attiva ha portato il contatore osservato da 270 a 280 e le residue da 99.730 a 99.720, senza attribuire tutte le chiamate alla qualifica. La fonte copre fino a due anni, con PII mascherata oltre 90 giorni, pagine fino a 200 ordini e filtri incrementali per data di creazione o modifica; non restituisce acquisti pending-payment che richiedono pagamento anticipato. L'email buyer cessa di essere restituita due settimane dopo la creazione dell'ordine. Trading conserva la finestra massima di 90 giorni.

**Campione bounded Production:** il 2026-09-20, dopo verifica della VPS autorizzata `fiscalbay-bot`, sono state eseguite tre richieste Fulfillment aggregate per ciascuno dei due account controllati, senza stampare o persistere ID ordine o payload buyer. Il primo account ha restituito zero ordini. Il secondo ha restituito 2.120 ordini nella finestra di 729 giorni: 11 pagine teoriche da 200 e `next` presente sulla prima. Due finestre `lastmodifieddate` di 14 giorni, traslate di un giorno, hanno restituito 46 e 42 ordini, con 42 ID comuni calcolati soltanto in memoria. Il campione prova paginazione reale, overlap con deduplica e un incremento recente contenuto in una pagina; non rende rappresentativo un solo seller. Sul volume osservato, l'ordine di grandezza è circa 2,91 ordini creati/giorno e 3,29 modificati/giorno. Proiettare quest'ultimo dato su 150 negozi darebbe circa 493 lavori fiscali Trading/giorno, meno del 10% delle 5.000 chiamate, ma resta una stima esplorativa da sostituire con misure multi-merchant prima dell'apertura pubblica.

**Eventi e retry:** la Notification API corrente documenta `ORDER_CONFIRMATION` dal dicembre 2025, con webhook HTTPS firmato e tre tentativi di consegna. Il readback `getTopic` sul keyset autorizzato lo restituisce `ENABLED`, scope utente, compatibile con `sell.fulfillment.readonly`, payload JSON 1.0/1.1 e consegna HTTPS. Può anticipare la scoperta dei nuovi ordini; non copre da solo aggiornamenti successivi, cancellazioni o riconciliazione. Anche con l'evento, eBay richiede conferma tramite API: il polling Fulfillment con overlap resta autorevole. Non sono state create destination o subscription e non sono stati provocati errori o `429` in Production; il contratto sintetico dei retry è provato separatamente sotto.

**Contratto client locale:** il parser Zod accetta soltanto pagine Fulfillment con `orderId` non vuoto e totale non negativo, mantenendo gli altri campi senza legarsi a `legacyOrderId`. La fusione di pagine o finestre sovrapposte deduplica per `orderId` e conserva l'ultima osservazione. Il filtro `lastmodifieddate` sottrae un overlap esplicito dal checkpoint senza avanzare il watermark. La classificazione ritenta solo `429` e `5xx`, onora `Retry-After` numerico o data e altrimenti usa backoff esponenziale limitato a 300 secondi; non dorme nel client e lascia la consegna ritardata alla futura Queue. Il test iniziale ha intercettato `Number(null) === 0`, che riduceva erroneamente il backoff in assenza dell'header; la correzione condivisa e il gate completo con 17 test sono verdi.

**Contratto aggiornamenti:** `ORDER_CONFIRMATION` genera soltanto una verifica mirata anticipata dell'ordine indicato; duplicati e tre tentativi non producono effetti ripetuti. Gli aggiornamenti successivi sono scoperti dal filtro Fulfillment `lastmodifieddate`, anche quando la data di creazione dell'ordine è precedente alla finestra corrente. Ogni ordine restituito viene riletto nel dettaglio e applicato in modo idempotente; cancellazioni, fulfillment, rimborsi e variazioni fiscali vengono quindi riconciliati dalla fonte pertinente. Pagine e dettagli devono essere applicati e l'eventuale lavoro fiscale deve essere registrato in modo recuperabile prima di avanzare il checkpoint; il job fiscale può poi ritentare senza rendere indisponibile l'ordine generale. Un fallimento precedente a quel commit lascia invariato il watermark e la successiva finestra con overlap ripete in sicurezza il lavoro. L'evento non sostituisce questo percorso e la sua assenza non blocca il polling.

**Budget multi-merchant M0:** sono stati osservati due account seller controllati, uno senza ordini nella finestra ampia e uno con 2.120 ordini, oltre al dataset sintetico D1 da 150 negozi. Il campione reale non viene usato come media statistica: il dimensionamento prudenziale assume un ciclo per ogni negozio alla frequenza massima e tre operazioni Queue per messaggio, quindi non trae capacità dal seller vuoto né dal volume medio dell'altro. Entro l'80% delle 10.000 operazioni Queue Free giornaliere, il tetto è 55 negozi Free, 18 Premium o 33 nel mix un Premium ogni due Free, prima dei retry; il target di 150 non è ammissibile sul Free con un messaggio per ciclo. La misura con Queue e consumer reali, il traffico effettivo multi-merchant e l'eventuale eliminazione dei messaggi per polling vuoti restano gate pre-pubblico: possono ridurre o aumentare la capacità, ma non rendono meno conservativa la scelta M0.

**Chiusura M0:** strategia incrementale, aggiornamenti successivi, evento opzionale, retry e budget conservativo sono qualificati senza creare destination, subscription o Queue premature. Il test locale copre anche un ordine creato mesi prima e modificato in due finestre sovrapposte, conservando l'ultima osservazione. La capacità pubblica resta non approvata finché non vengono rimisurati piano Cloudflare, Queue reale e carico condiviso al checkpoint previsto.

### M0-07 — Schema rappresentativo e concorrenza

**Stato:** DONE · **Prerequisiti:** M0-03, M0-05, M0-11 · **Contratto:** [§27](docs/MASTER_PLAN.md#s27) · [§36](docs/MASTER_PLAN.md#s36)

Misurare sul candidato credibile un dataset sintetico rappresentativo di 70.000+ ordini con articoli, dati fiscali, grant/cicli e telemetria effettivamente necessaria. Niente tabella per ogni concetto o copia di ogni polling; misurare spazio, indici, query, isolamento e consumi.

**Criterio di completamento:** Dati misurati più scenari picchi/multistore/retention; test consumo atomico e privacy senza record reali pubblici.

Testare anche viste/RPC privilegiate e Data API diretta se esposta, non soltanto il servizio web. Includere copie derivate/event payload nella misura di spazio; il raw temporaneo non diventa audit permanente.

**Evidenza:** sulla D1 remota UE il dataset sintetico rappresentativo usa 150 workspace con un negozio ciascuno, 70.000 ordini, 210.000 articoli, 84.000 identificativi fiscali e 14.000 grant. Occupa 44.789.760 byte e il caricamento ha richiesto 830 ms SQL. La query pagina tenant/grant da 50 ordini legge 996 righe: 11,4 ms a freddo, poi 0,6–1,8 ms. La presenza del raw non ha degradato il percorso, rimasto a 996 righe e 0,6–1,8 ms nelle due ripetizioni finali.

**Raw, retention e picco:** il picco sintetico equivale a una pagina piena da 200 ordini per tutti i 150 negozi, quindi 30.000 payload raw da 1.093–1.094 byte. L'inserimento ha richiesto 395 ms, 30.001 righe lette e 90.000 scritte contando tabella, chiave e indice TTL. Dataset e raw attivo occupavano 87.740.416 byte. Con altre 30.000 copie già scadute il massimo osservato era 130.551.808 byte; il pruning deterministico `expires_at <= cutoff` ha eliminato tutte e sole le copie scadute in 128 ms, 30.001 letture e 30.000 scritture, lasciando 30.000 record con scadenza successiva alle 24 ore. Il raw non viene usato come audit. Il burst da solo supera la soglia di attenzione Free da 80.000 scritture/giorno: va assorbito, segmentato o coperto da un piano rivalutato prima dell'apertura pubblica, senza attribuirgli automaticamente il rinnovo Paid.

**Capienza condivisa Workers Free:** la query CF-Ready difettosa che moltiplicava le letture D1 è esclusa dal dimensionamento. Prima dell'anomalia, dal 10 al 12 settembre, il database Production ha letto 991.310 righe e ne ha scritte 3.070 in 72 ore, pari a 330.437 letture e 1.023 scritture/giorno. Dopo la correzione, tre ore proiettano 95.352 letture e 3.744 scritture/giorno; una finestra più ampia di sei ore, sottratta la sola firma SQL anomala, proietta 148.652 e 5.168. Il budget prudenziale usa il massimo pulito per dimensione e riserva quindi a CF-Ready 330.437 letture e 5.168 scritture/giorno. Il primo limite quantitativo di FiscalBay è la Queue: una coda per ogni polling consente 33 negozi nel mix un Premium ogni due Free entro 8.000 operazioni account/giorno, oppure 39 al limite nominale di 10.000; i casi omogenei sono 55/69 Free o 18/23 Premium. Eliminando i messaggi per i polling vuoti, il tetto teorico successivo è circa 459 negozi entro 400 MB prudenziali o 574 entro 500 MB nominali sulla singola D1, calcolato sul picco storage osservato. Questi numeri restano condizionati: oggi `cf-ready-prod` ha CPU p90 22,63 ms nelle ultime 24 ore, oltre i 10 ms per invocazione del Free, quindi la capienza operativa sicura dell'account Free è zero finché la coda CPU non viene ottimizzata e rimisurata.

**Isolamento e pulizia:** i test Workerd esistenti provano visibilità tenant, identificativi multipli, rifiuto cross-workspace e consumo atomico dell'ultimo grant. Nessuna Data API D1 diretta è esposta al client. Le sette tabelle `m0_bench_*` sono state eliminate; il readback remoto finale mostra zero residui benchmark, 15 tabelle, 221.184 byte, tre migration, un utente controllato, due account, una passkey, zero sessioni e zero workspace applicativi. Lo spike PostgreSQL/RLS resta evidenza storica dell'alternativa esclusa, non un secondo runtime.

### M0-08 — Qualifica Stripe Managed Payments

**Stato:** DONE · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§6](docs/MASTER_PLAN.md#s06) · [§36](docs/MASTER_PLAN.md#s36)

Leggere eligibility effettiva, copertura fiscale, capabilities checkout/portal/Link, prezzi/metodi e testare i casi commerciali critici.

**Criterio di completamento:** Matrice commerciale con esito e ambito docs/sandbox/live per ogni caso; prove non supportate dal sandbox assegnate esplicitamente al gate finale, senza falso PASS. MoR effettivo verificato, nessun Payments standard o Paddle senza owner.

Coprire vincoli di Hosted Checkout/metodi, uso di Link e oggetti cancellati dal provider; chiarire quali prove di ricevute e gestione cliente richiedono live. Nessuna transazione live è autorizzata dal semplice avvio di questo task.

**Evidenza:** il readback Dashboard del 2026-09-20 mostra Managed Payments `Pronto all'uso`, con attivazione selettiva per singola Checkout Session e sovrapprezzo del 3,5% per transazione. Il catalogo live contiene un solo prodotto SaaS idoneo, `FiscalBay Premium`, con prezzi IVA esclusa di 4,90 EUR/mese, 49 EUR/anno e 149 EUR una tantum; il mensile è il prezzo predefinito. Sono stati salvati descrizione attività e prodotto aggiornate, mark prodotto, icona e logo orizzontale 1.0, palette `#16324F`/`#1F6FA8`, URL `supporto`, `privacy`, `termini` e `rimborsi`. Checkout mostra politica rimborsi senza dichiarare resi, cambi o una finestra automatica, link legali con accettazione, email e sito di supporto; il telefono resta nascosto. Le pagine collegate non sono ancora dichiarate pronte o verificate. Le richieste di rimborso usano approvazione email entro 48 ore. Il percorso ammesso usa Checkout o Payment Links e supporta pagamenti una tantum e abbonamenti. Stripe/Link gestisce imposte indirette coperte, ricevute, assistenza di transazione, frodi e contestazioni; FiscalBay conserva il supporto del prodotto e la riconciliazione dei diritti.

In sandbox è stato creato il catalogo equivalente con lo stesso testo e i tre prezzi. Checkout Hosted ha mostrato il logo 1.0, la descrizione aggiornata, `Venduto tramite Link` e l'IVA italiana. Sono stati completati e poi rimborsati un abbonamento mensile e un acquisto lifetime; l'abbonamento è stato annullato. Una sessione annuale Managed Payments è stata creata e verificata. Un secondo abbonamento mensile associato a Test Clock ha generato e incassato la fattura di rinnovo, poi è stato annullato e i due pagamenti sono stati rimborsati. Un evento `checkout.session.completed` firmato, generato dal relay ufficiale Stripe, ha raggiunto l'handler locale con HTTP 204 ed è stato persistito una sola volta in D1. Il candidato locale usa l'SDK ufficiale, abilita `managed_payments`, separa pagamento lifetime e abbonamenti, verifica la firma sul corpo grezzo e conserva soltanto gli identificativi minimi dell'evento. Il prodotto fittizio creato dal comando di trigger è stato archiviato. Nessuna transazione live è stata eseguita e nessun dato fiscale dell'account è stato verificato o modificato.

Il gate completo della repository è verde con formattazione, lint, typecheck, 21 test, build e controlli documentali.

**Prepagamento durante prova e posti lifetime (sandbox, 2026-09-23):** la documentazione Managed Payments non elenca `subscription_data.trial_end`, `billing_cycle_anchor` o `expires_at` fra i parametri rimossi e consente carrelli misti di prezzi una tantum e ricorrenti. In sandbox due Checkout Session Managed Payments in modalità abbonamento, con sei giorni di prova residui, sono state accettate con due righe: il prezzo ricorrente con `trial_end` pari alla scadenza originale più un periodo e un prezzo una tantum pari al primo periodo. La sessione mensile espone oggi 4,90 EUR sulla sola riga una tantum e zero sulla riga ricorrente; quella annuale 49 EUR. Il modello Q567 è quindi realizzabile senza cambiare la regola: incasso immediato del primo periodo, rinnovo dopo i giorni residui più il periodo acquistato, nessun secondo addebito a fine prova. Per i posti lifetime, `expires_at` accetta valori da 30 minuti a meno di 24 ore e rifiuta 25 ore; la scadenza forzata via API porta la sessione a `expired`/`unpaid` ed emette `checkout.session.expired`. La sessione di pagamento lifetime propone carta e Bancontact: i metodi sono dinamici e non soltanto carte, quindi gli esiti asincroni vanno gestiti. Le sessioni sono state fatte scadere e i due prezzi una tantum temporanei archiviati; nessun pagamento è stato completato.

**Residuo assegnato:** il candidato non è distribuito e le route Checkout/webhook restano intenzionalmente escluse dal router applicativo. Segreto ristretto Cloudflare, migration remota, registrazione delle route e dell'endpoint webhook Stripe, riconciliazione dei diritti e collegamento della UI appartengono a M5 e richiedono il relativo ciclo di integrazione e pubblicazione. Il completamento con Test Clock del modello Q567 e la sua rappresentazione in Link e Portal sono assegnati a M5-04; cambi piano, Portal/Link e ricevute a M5-05..06; comparsa dell'acquisto nell'app Link e comunicazioni effettive restano prove live M8/M9. I dati fiscali dell'account restano fuori da questo intervento per decisione owner.

### M0-09 — Recovery nativa e limiti

**Stato:** DONE · **Prerequisiti:** M0-03, M0-04, M0-07 · **Contratto:** [§32](docs/MASTER_PLAN.md#s32) · [§36](docs/MASTER_PLAN.md#s36)

Verificare le protezioni native dei candidati ancora ammissibili; approfondire il percorso dati/Auth/grant/file/config/chiavi del candidato migliore e i costi. Nessun restore completo su ogni alternativa: l’unico drill conclusivo rimane pre-go-live.

**Criterio di completamento:** Meccanismo nativo, finestra, costo, limiti e percorso fail-closed qualificati quanto basta per scegliere l'architettura. Free senza recovery non viene promosso. Una prova tecnica circoscritta può dimostrare la fattibilità, ma non sostituisce né anticipa il drill conclusivo sul candidato finale.

Specificare come conoscere cancellazioni/revoche avvenute dopo lo snapshot: il marker nello stesso DB ripristinato non basta. Distinguere dati ripristinabili, stati riconciliabili, configurazione ricreabile ed export rigenerabili, senza introdurre backup indipendenti.

**Evidenza:** D1 Time Travel è la protezione nativa scelta e offre 7 giorni di retention sul piano Free, estesi a 30 giorni sul Paid. Il restore sovrascrive il database in uso; il clone da un punto Time Travel non è ancora disponibile. La ricostruzione locale dalle migration applicative e Better Auth è verde. Sulla D1 remota UE `fiscalbay-m0-test`, tre migration sono state applicate e rilette; una riga sintetica inserita dopo il bookmark è stata rimossa dal restore, conservando schema e registro migration. Il primo tentativo di creazione ha ricevuto l'errore transitorio Cloudflare `10000`; il singolo retry con identici account, scope e giurisdizione è riuscito senza duplicati. Il round trip cifrato Supabase + R2 resta una prova storica sul dataset.

**Scelta qualificata:** usare una sola D1. Prima di ogni restore si congelano scritture, job, checkout e accessi, quindi si estraggono dal database corrente i marker di erasure e revoca successivi allo snapshot. Dopo il restore si riapplicano quei marker e si riconciliano diritti, token e pagamenti con le fonti autorevoli prima di riaprire. L'artefatto cifrato dell'incidente è temporaneo, contiene soltanto i marker minimi e viene eliminato dopo la verifica. Se il database corrente non è leggibile o l'intervallo non è ricostruibile con certezza, il servizio resta chiuso. Questo accetta una minore recuperabilità nello scenario di corruzione grave in cambio di una sola risorsa persistente.

**Confine con M0-14:** M0-09 è chiusa sul piano tecnico e non richiede un'altra prova in M0. L'owner ha scelto la D1 singola e il comportamento fail-closed; non si ripete automaticamente il restore già osservato.

**Residuo successivo a M0:** il runbook deve rendere eseguibili congelamento, estrazione temporanea, riapplicazione e riconciliazione. Il solo drill conclusivo sul candidato finale resta pre go-live. Un requisito di retention superiore a 7 giorni o di recupero garantito quando la D1 corrente è illeggibile riapre la scelta architetturale.

### M0-10 — Qualifica export e runtime

**Stato:** DONE · **Prerequisiti:** M0-07 · **Contratto:** [§12](docs/MASTER_PLAN.md#s12) · [§26](docs/MASTER_PLAN.md#s26)

Qualificare un percorso minimo CSV/XLSX/ZIP sul candidato runtime, con memoria, durata, tipi e licenze; confrontare un’altra libreria soltanto se il percorso non basta. Non costruire già il sistema export completo per ogni stack.

**Criterio di completamento:** Almeno un percorso sicuro fattibile per ogni formato promesso; libreria scelta se utile, nessun taglio di XLSX.

Separare integrità del CSV dai cast automatici del foglio di calcolo; provare tipi testo XLSX e più identificativi su ordini multi-articolo. Definire consegna autenticata/revocabile, non un URL bearer valido 24 ore come unico controllo.

**Evidenza:** CSV/XLSX/ZIP e runtime Workerd verdi, licenze e misura registrate sopra. Il contratto canonico usa storage privato, scadenza massima di 24 ore, revisione di accesso per workspace e un endpoint autenticato che rilegge sessione, tenant, diritto e retention sia prima della pubblicazione del file sia a ogni download. Revoca, erasure o riduzione di accesso invalidano prudentemente gli export dello spazio; un URL bearer trasferibile non è sufficiente. Il gate completo con 18 test conferma generatori, tipi testuali, neutralizzazione formule e archivio, senza anticipare endpoint, job o storage di M6.

### M0-11 — Toolchain latest stable riproducibile

**Stato:** DONE · **Prerequisiti:** M0-01 · **Contratto:** [§26](docs/MASTER_PLAN.md#s26) · [§34](docs/MASTER_PLAN.md#s34)

Qualificare localmente Node/TS/pnpm/ReactRouter/Vite/lint/test/CLI e una baseline eseguibile minima. Nessun endpoint/provider già configurato è prerequisito. Le integrazioni specifiche e i generatori OAS vengono verificati nei task pertinenti e riallineati prima del memo M0-14; congelare i pin effettivamente qualificati, senza presumere scelto il runtime finale.

**Criterio di completamento:** Install pulita e smoke di typecheck/build/test passano nell’ambiente locale/runner controllato; M0-04..M0-10 completano la compatibilità dei candidati esterni. Eccezioni latest motivate, non assunte.

Eseguire questo task prima delle prove che usano il codice: l’ordine numerico degli ID non è la sequenza operativa. Verificare compiler API/LSP/generatori e dipendenze SSR beta, oltre a build/typecheck; non installare automaticamente compatibility layer non necessari.

**Evidenza:** pin e lockfile del candidato, configurazione `mise` per Node 26.8.2 e pnpm 12.4.1, configurazione Workers tipizzata, install frozen, peer check, typecheck, 14 test Workerd, build React Router e documentazione verdi. `@better-auth/infra` 0.4.9 dichiara compatibilità con Better Auth 1.4 o successivo e viene caricato soltanto in presenza del secret dedicato. Vitest 4.1.11 è l’ultima 4.x compatibile con `@cloudflare/vitest-plugin` 1.1.8, che richiede `^4.1.0`; Vitest 5 è stato escluso dopo peer check.

**Generatore dei client (2026-09-23):** nessun generatore OAS nella 2.0 per ora. TypeScript 7.0.2 non espone l'API JavaScript del compilatore (`factory`, `createPrinter` e `createSourceFile` sono assenti) e i generatori candidati la usano: `openapi-typescript` 7.13.0 richiede TypeScript `^5.x`, `@hey-api/openapi-ts` 0.99.0 genera tramite quella API. Adottarli introdurrebbe un secondo compilatore, escluso da [§25](docs/MASTER_PLAN.md#s25). La superficie usata è piccola (Identity, Fulfillment, Trading XML senza OAS) e resta coperta da schemi Zod mirati, validati a runtime e con fixture; Stripe usa l'SDK ufficiale tipizzato. L'owner conferma di non usare TypeScript 5. Rivalutare in [M3-02](#m3-02) solo se la superficie cresce e un generatore supporta TypeScript 7 senza secondo compilatore.

### M0-12 — Consolidamento dei vincoli legali preliminari

**Stato:** DONE · **Prerequisiti:** M0-04, M0-05, M0-08 · **Contratto:** [§29](docs/MASTER_PLAN.md#s29) · [§30](docs/MASTER_PLAN.md#s30)

Mappare ruoli dati, uso Codex necessario, copertura MoR, obblighi italiani residui, eBay marchi/retention e licenze legacy.

**Criterio di completamento:** Nessun blocco legale ignorato prima di dati reali; deliverable pubblico/privato distinti e attività di chiusura assegnate.

Il controllo iniziale prima dei dati reali è già un prerequisito M0-02. Qui consolidare anche cancellazioni eBay/Link, erasure nelle protezioni native, accettazioni contrattuali e ruoli degli strumenti, con le attività finali di M7-07 esplicite.

**Esito e ruoli:** Temisfera resta fornitore del prodotto e titolare del trattamento applicativo; Stripe/Link opera come merchant of record nel solo perimetro Managed Payments. La copertura documentata comprende imposte indirette nei Paesi supportati, ricevute/fatture del pagamento, assistenza di transazione, frodi e contestazioni. Non trasferisce a Stripe supporto del prodotto, contabilità e imposte proprie di Temisfera, gestione dei diritti applicativi, informativa, condizioni d'uso o casi territoriali non coperti. Le condizioni pubbliche non possono sostituire i diritti inderogabili del consumatore con la sola policy rimborsi: testo italiano/inglese, avvio del servizio, recesso e casi digitali vengono verificati nel deliverable M7-07 prima di ogni vendita.

**Dati e fornitori:** Cloudflare tratta runtime, D1, Queue, log e posta transazionale secondo configurazione e accordi applicabili; Google ed eBay trattano identità/consenso nei rispettivi perimetri; Stripe/Link tratta catalogo, checkout, pagamento e assistenza transazionale. Better Auth core resta libreria self-hosted, mentre il plugin Infrastructure collegato è un servizio distinto. L'owner sceglie la corsia cloud per dashboard e audit controllati. La versione installata invia eventi con ID utente/account/sessione, email, nome, provider o metodo di accesso, IP/localizzazione derivata e user agent; nel percorso osservato non invia password, secret Better Auth o token OAuth. `activityTracking` è disattivato, ma controlla soltanto `lastActiveAt` e non elimina l'invio degli eventi. Starter offre 10.000 audit log al mese con un giorno di retention ed è presentato per valutazione e side project; non viene dichiarato adeguato alla Production pubblica. I termini prevedono un DPA quando richiesto dal GDPR e la privacy policy descrive subprocessori e trasferimenti con garanzie come le SCC, ma non è stato trovato un DPA Starter pubblico già sottoscritto né un elenco nominativo completo dei subprocessori. Prima di utenti pubblici M7-07 deve ottenere il DPA applicabile, completare inventario e informativa, verificare cancellazione e trasferimenti e scegliere un piano ammesso alla Production. Se il gate non si chiude, si rimuove il secret/plugin Infrastructure mantenendo Better Auth core e i dati Auth in D1. Sentinel, email, SMS e servizi enterprise restano spenti.

**eBay, cancellazione e retention:** l'API License Agreement incorpora un DPA, limita copie intermedie e uso dei dati eBay e vieta di usare i contenuti per addestrare sistemi AI. L'account non è esentato dalle notifiche marketplace: il callback 1.x resta condiviso e non va interrotto. M7-02/M7-07 devono predisporre insieme callback 2.0, verifica, retry, cancellazione irreversibile anche dalle copie derivate e cutover esplicito prima della readiness live. Raw eBay massimo 24 ore, export server massimo 24 ore e marker di cancellazione nella D1 applicano il contratto già fissato; durante un restore i marker successivi allo snapshot vengono estratti e riapplicati prima della riapertura. La cessazione eBay richiede distruzione delle copie entro il termine contrattuale corrente. Nome, logo e contenuti eBay possono essere usati soltanto nei limiti della licenza e delle regole marchi correnti, da rileggere nel gate M1/M7 sugli asset finali.

**Codex e prove reali:** Codex è uno strumento interno occasionale e non un subprocessore runtime di FiscalBay. Le prove Production autorizzate hanno consultato in memoria un ordine controllato e il relativo `BuyerTaxIdentifier`, senza inserirne il valore in sorgenti, log o documenti. Nessun dato eBay può essere inviato a un modello per training, dataset sintetici o finalità estranee. Prima di un uso sistematico di Codex su dati reali, M7-07 deve verificare piano/account OpenAI effettivo, impostazioni e trattamento applicabile; le garanzie Business/API senza training di default non vengono attribuite automaticamente a questa sessione.

**Licenze e asset:** l'inventario production corrente conta 109 pacchetti MIT, 12 ISC, 4 Apache-2.0, 3 BSD-3-Clause, 2 Unlicense, 2 MIT/X11, uno 0BSD, `jszip` dual MIT/GPL e `pako` MIT+Zlib. `buffers@0.1.1`, segnalato senza metadata dal comando, è documentato MIT dalla provenienza distribuita; non emerge una dipendenza che imponga di rendere pubblico il nuovo codice scegliendo le opzioni permissive disponibili. Il nuovo codice resta proprietario/all rights reserved; M7-07 produce licenza/notice distributivi e attribuzioni effettive. I quattro PNG importati sono concept privati identificati da nome, hash e ruolo nel manifest, non asset finali né materiale terzo autorizzato: M1 registra origine, licenza e modifiche di ogni asset/componente realmente pubblicato.

**Attività assegnate:** M1 chiude provenienza/licenza di logo, font e componenti finali. M5 implementa cancellazioni Link, webhook e riconciliazione dei diritti senza resurrezione da recovery. M7-02/M7-07 chiudono callback eBay 2.0, matrice trattamenti/fornitori/trasferimenti, basi e retention, clausole e accettazioni, informative e condizioni IT/EN, diritti consumatore, notice/licenza repository, gate contrattuale e operativo Better Auth Infrastructure e verifica dell'eventuale uso Codex. M8 raccoglie evidenze su ambiente e dati reali autorizzati; M9 verifica pubblicazione, cancellazione e copie native. Le informazioni fiscali e anagrafiche reali dell'operatore restano private e vengono inserite solo nei documenti e pannelli finali, non nel repository.

### M0-13 — Vertical slice end-to-end

**Stato:** DONE · **Prerequisiti:** M0-04, M0-05, M0-07, M0-11, M0-12 · **Contratto:** [§36](docs/MASTER_PLAN.md#s36)

Sul candidato migliore: login→link seller→ordine→DB→pagina minima, con permessi e timestamp coerenti. Non implementare più prodotti paralleli; un’ulteriore slice richiede un problema concreto o un confronto ancora irrisolto.

**Criterio di completamento:** Flusso osservato con risorsa e commit identificati, errori gestiti e nessun segreto nel client; setup e trattamento dati già qualificati, non aggiunti retroattivamente.

**Evidenza parziale:** la slice locale ordine→D1→pagina, Better Auth e permessi del commit `d62e053` è stata ripristinata come unico runtime mantenuto nel commit `1acd969` dopo la scelta owner del 2026-09-19. Formattazione, lint, tipi, 12 test, build e controlli documentali sono verdi; le migration D1 locali risultano applicate e tutte le tabelle attese sono presenti. HTTP locale della pagina minima: 200; nessun segreto nel client. La slice Supabase del commit `853a22d` resta disponibile nella storia Git come prova M0, senza mantenere due architetture concorrenti.

**Evidenza parziale aggiuntiva:** Better Auth conserva e rinnova i token del provider nel record account. La configurazione della slice ora cifra access token, refresh token e ID token in D1. Le route HTTP `/api/auth/get-access-token` e `/api/auth/refresh-token` restituiscono 404, così i token seller restano disponibili soltanto al codice server; il test copre entrambi i percorsi.

**Hardening locale senza consenso:** il provider eBay rende espliciti PKCE e rifiuto dei callback iniziati dal provider. Il confine `/api/auth/callback/ebay` accetta soltanto GET con un unico `state` e un solo esito tra `code` ed `error`, limita il codice ai 1.024 caratteri documentati da eBay e marca ogni risposta `no-store`. Callback senza stato, con parametri duplicati o ambigui vengono deviati alla pagina errore senza creare account eBay. La pagina ordini non usa più un utente fixture fisso: deriva l'utente dalla sessione Better Auth e interroga D1 con il relativo isolamento workspace. Il test eseguibile crea soltanto un account email locale verificato e dati eBay sintetici, prova zero ordini per l'anonimo e il solo ordine del tenant per la sessione autenticata. Non sono stati aperti il login o la schermata di consenso eBay, scambiati codici, creati token o chiamati endpoint eBay.

**Collegamento negozio separato dal login:** il commit `34eae8a` aggiunge un flusso seller distinto da Better Auth, con scope base, Identity e Fulfillment read-only, senza email. `state` monouso con scadenza di dieci minuti e PKCE stanno nella tabella `ebay_store_link_sessions` (migration `0005`); il callback del RuName resta unico e lo `state` distingue il collegamento negozio dal login eBay. Il callback rifiuta lo `state` di un altro utente, gestisce il rifiuto su eBay, non riusa lo `state` e marca le risposte `no-store`. L'import collega il negozio al primo spazio dell'utente tramite l'identificativo eBay stabile, legge l'ordine Fulfillment più recente e la relativa osservazione Trading, e non persiste il token: storage cifrato e rinnovo restano a M2-05. La pagina minima offre accesso, registrazione e uscita server-side. `pnpm verify` è verde con 26 test.

**Prova reale controllata del 2026-09-23:** Worker test al commit `a93f839`, versione `b0495522-59b8-4dc8-8c3b-ed58837c1977`, D1 `fiscalbay-m0-test` con migration `0001`–`0005`. L'owner ha registrato `info@fiscalbay.it`, confermato l'indirizzo dalla mail ricevuta e aperto una sessione. Su autorizzazione owner, al posto di un nuovo consenso è stato usato il token già autorizzato del secondo seller controllato conservato cifrato dalla 1.x: sulla VPS verificata la 1.x lo ha rinnovato con scope Identity e Fulfillment e lo ha passato in pipe allo stesso `importStoreOrders` della 2.0, eseguito localmente con binding remoto alla D1 di test; il token non è stato stampato, scritto su disco o passato come argomento. Il readback D1 aggregato mostra uno spazio con l'utente owner, un negozio, un ordine in EUR, un'osservazione fiscale con fonte `ebay_trading_get_orders` e Paese emittente nullo, zero grant e zero sessioni di collegamento residue. La query della pagina restituisce un ordine senza valori fiscali all'owner, perché manca il grant, e zero ordini a un utente estraneo; la pagina anonima mostra zero ordini. Nessun valore buyer, fiscale, token o ID ordine è stato stampato o registrato.

**Trattamento:** il salvataggio dell'ordine reale e dell'identificativo fiscale non era coperto dal preflight di M0-02; l'owner lo ha ratificato dopo la prova, come registrato nel preflight. Non è una qualifica preventiva.

**Limite:** il consenso OAuth seller 2.0 e il suo callback sono provati da test locali, non dal vivo: la prova live passa a [M2-05](#m2-05), insieme a storage cifrato e rinnovo del token. Sign in with eBay è in [M2-09](#m2-09).

### M0-14 — Memo di scelta e via owner

**Stato:** DONE · **Prerequisiti:** M0-03..M0-13 · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§36](docs/MASTER_PLAN.md#s36) · [§37](docs/MASTER_PLAN.md#s37)

Confrontare costo/complessità/capacità/Auth/recovery/jobs/lock-in, scegliere un assetto e separazione responsabilità, ADR limitati ai nodi stabili.

**Criterio di completamento:** Gate preliminari con esito, ambito e prova; prove ammissibili solo più avanti assegnate a task/checkpoint e non dichiarate completate. Owner approva architettura/costi e rischi derogabili; incompatibilità già dimostrate o obblighi inderogabili restano bloccanti.

**Evidenza parziale:** l'owner ha scelto Workers Free + una sola D1 + Queues + Better Auth e intende mantenere Workers Free fino all'apertura pubblica, con rivalutazioni progressive. Le soglie registrate sono segnali di checkpoint e non autorizzano automaticamente Paid. Supabase Pro è escluso per budget e Supabase Free per la continuità insufficiente. Cloudflare mantiene una sola superficie operativa per runtime, database e coda. La D1 ha già superato isolamento tenant, grant atomici, dataset sintetico, query di pagina e restore Time Travel remoto. La D1 FiscalBay è separata e in giurisdizione UE; le risorse CF-Ready restano escluse. Per recovery, M0-09 ha qualificato Time Travel, retention Free di 7 giorni e comportamento fail-closed: prima del restore si estraggono i marker correnti e, se l'intervallo non è ricostruibile, il servizio resta chiuso. Non resta una prova tecnica da ripetere prima del memo. L'owner sceglie inoltre la corsia Better Auth Infrastructure cloud: M0 qualifica il collegamento controllato e il flusso dati, mentre DPA, informativa, subprocessori/trasferimenti e piano Production restano gate pre pubblico con fallback esplicito al solo core self-hosted.

**Bozza memo finale, pronta per il checkpoint:**

| Voce | Scelta proposta e prova disponibile | Condizione o rischio residuo |
|---|---|---|
| Runtime e dati | Cloudflare Workers, una D1 UE e Queues; Supabase escluso. D1 ha superato isolamento tenant, grant atomici, dataset da 70.000 ordini, picco raw e restore Time Travel. | Nessuna Queue FiscalBay è ancora creata. Una sola D1 semplifica l'assetto ma impone fail-closed se i marker successivi a uno snapshot non sono ricostruibili. |
| Costi e piani | Workers Free resta il default pre pubblico; il Paid corrente scade il 20 ottobre 2026 senza rinnovo autorizzato. Better Auth Infrastructure Starter è gratuito nella prova. Managed Payments aggiunge il 3,5% per transazione. | Email Auth verso destinatari arbitrari richiede Paid. Nuovi costi, rinnovo Workers e piano Better Auth Production richiedono i checkpoint previsti. |
| Capacità | Fulfillment offre 100.000 chiamate/giorno; Trading 5.000. Il budget prudenziale Queue Free copre 33 negozi nel mix un Premium ogni due Free entro l'80% della quota. D1 e query hanno margine sul dataset M0. | Il target di 150 negozi non è compatibile con un messaggio Queue per ogni polling sul Free. La CPU condivisa CF-Ready e la Queue reale vanno rimisurate prima dell'apertura pubblica; la capacità pubblica non è approvata in M0. |
| Auth | Un solo Better Auth su D1. Email/password, verifica, recupero, logout/revoca, passkey e Google sono provati sul dominio test; token OAuth cifrati e non esposti via HTTP. Infrastructure cloud resta rimovibile senza sostituire il core self-hosted. | Sign in with eBay è rinviato a M2-09 in attesa del diritto email Identity; un diniego richiede una decisione owner sul requisito prima della chiusura di M2. DPA, subprocessori, trasferimenti, cancellazione e piano Infrastructure Production sono gate M7-07; TOTP è escluso e la MFA admin resta M2-04. |
| eBay e dati fiscali | Fulfillment acquisisce e aggiorna gli ordini; Trading `GetOrders` è la fonte fiscale primaria mirata. Quote, paginazione, overlap, retry, campione controllato, `BuyerTaxIdentifier` reale e fixture sintetica sono provati. La slice collega un seller reale senza scope email e porta un ordine reale fino alla pagina. | Consenso e callback seller 2.0 dal vivo, storage cifrato e rinnovo del token sono M2-05. Il callback account-deletion 1.x resta attivo fino al cutover coordinato successivo. |
| Pagamenti | Stripe Managed Payments è idoneo e pronto sul conto; catalogo, Checkout sandbox, mensile/annuale/lifetime, rinnovo, rimborso e firma webhook sono qualificati; il prepagamento durante la prova (Q567) è realizzabile con prezzo una tantum più `trial_end` esteso, e la scadenza delle sessioni lifetime è limitata a meno di 24 ore con evento di scadenza. Paddle resta inattivo. | Route, secret ristretto, migration applicativa, endpoint remoto e diritti appartengono a M5; nessuna transazione live è stata eseguita. |
| Recovery e lock-in | Time Travel D1 Free conserva 7 giorni; restore sintetico riuscito. Prima del restore si congelano effetti e si estraggono marker, poi si riconciliano provider prima della riapertura. Configurazione e migration restano ricostruibili dal repository. | Corruzione che renda il DB illeggibile mantiene il servizio chiuso. Runbook eseguibile e drill conclusivo restano pre go-live; non viene introdotto un backup parallelo. |
| Decisione owner | Confermare Workers + D1 + Queues + Better Auth, costi differiti, limiti di capacità, fallback Infrastructure, rinvio di Sign in with eBay a M2-09 e rischi sopra. | `RINVIO LOGIN EBAY: REGISTRATO 2026-09-23`; `VIA FINE M0: REGISTRATO 2026-09-23`. |

**Stato residuo:** tutte le prove tecniche M0 sono chiuse o assegnate in modo esplicito a task successivi: Sign in with eBay a M2-09, consenso seller live e token a M2-05, requisiti Better Auth Infrastructure a M7-07, MFA amministrativa a M2-04, runbook e drill di recovery al pre go-live. Il readback Free e le misure giornaliere dopo la cessazione di Workers Paid sono un controllo operativo differito. L'invio email a utenti arbitrari richiede Workers Paid e appartiene al checkpoint pre pubblico. Su richiesta owner il progetto Supabase Free `FiscalBay` del candidato escluso è stato eliminato il 2026-09-23; la rilettura mostra intatti i progetti SyncBay e Pratix. Il via owner di fine M0 è registrato il 2026-09-23 nel registro dei via.

<a id="m1"></a>

## M1 — Fondazioni applicative e design

**Ingresso:** M0 qualificata e decisioni/costi autorizzati.

**Autorizzazione:** Via owner al logo rifinito, brand foundation e design system.

<a id="m1-00"></a>

### M1-00 — Cutover repository 1.x → 2.0

**Stato:** DONE · **Prerequisiti:** M0-14 completata e via owner di fine M0 · **Contratto:** [§33](docs/MASTER_PLAN.md#s33) · [§34](docs/MASTER_PLAN.md#s34)

Rendere la 2.0 canonica nell'albero attivo con un diff controllato di istruzioni di progetto, documentazione, codice, test, dipendenze, toolchain e CI. Congelare la 1.x in un riferimento Git identificabile per la sola manutenzione residua, senza mantenere due implementazioni o due fonti canoniche in `main`.

Prima dell'integrazione riconciliare i commit sopraggiunti sulla 1.x e rileggere hook, workflow, release script, timer e autodeploy. Disinnescare ogni percorso per cui il merge della 2.0 potrebbe distribuire il runtime 1.x. Conservare temporaneamente l'inventario operativo necessario a bot e callback ancora attivi, con proprietario e condizione di spegnimento espliciti: il cutover del repository non prova né implica la loro dismissione remota.

**Criterio di completamento:** Un checkout pulito presenta una sola implementazione e una sola documentazione canonica 2.0; la 1.x resta recuperabile dal riferimento Git dichiarato; nessun merge avvia il deploy legacy; componenti 1.x ancora live e successivo cutover operativo sono registrati senza duplicarne codice e istruzioni nell'albero attivo.

**Evidenza del 2026-09-23:** via owner di fine M0 registrato; l'owner ha chiesto push di backup, commit della pianificazione M1-00 e cutover. La 1.x è congelata nella branch `legacy/1.x` al commit `508ded8`, ultima release `v1.14.0`. I tre commit arrivati su `main` dopo la base M0 sono riconciliati: i due aggiornamenti di ruff toccano soltanto `pyproject.toml`, assente nella 2.0; la centralizzazione delle istruzioni comuni è applicata all'AGENTS 2.0. L'albero unito contiene una sola implementazione (React Router su Workers, D1, Better Auth) e una sola documentazione canonica 2.0, senza `src/`, `deploy/`, script di release o workflow 1.x. I workflow CI e titolo PR girano anche sulle PR verso `main`; nessun workflow fa deploy. Sulla VPS verificata `fiscalbay-bot` soltanto `autodeploy.sh` e `vps-deploy-ref.sh` leggono GitHub: `fiscalbay-autodeploy.timer` è riletto `disabled`/`inactive` e il servizio `static`/`inactive`, quindi il merge non avvia il deploy legacy. Il mascheramento systemd non è applicabile perché il timer è definito in `/etc/systemd/system`; il tentativo è fallito senza effetti.

**Componenti 1.x ancora attivi fino al cutover operativo:** sulla VPS `fiscalbay-bot` restano attivi il bot Telegram (`fiscalbay-bot`), il callback OAuth con le notifiche eBay di cancellazione account inoltrate a Hub Fatture (`fiscalbay-oauth`) e i timer `reconcile`, `alertcheck`, `external-healthcheck`, `backup`, `log-maintenance`, `restore-drill` e `duckdns`. Eseguono il checkout locale in `/opt/fiscalbay` e non dipendono da `main`. Proprietario: owner. Condizione di spegnimento: callback di cancellazione 2.0 attivo e cutover coordinato del consumatore Hub Fatture (M7), poi dismissione 1.x in M9. Il loro codice resta recuperabile da `legacy/1.x`; un eventuale deploy manuale 1.x usa quel riferimento.

**Readback dopo il merge:** la PR [#163](https://github.com/max23468/FiscalBay/pull/163) è unita con squash nel commit `b2d9144`, con CI `Node 26`, titolo e CodeQL verdi; l'albero di `main` coincide con quello della branch 2.0. Su autorizzazione owner la protezione di `main` richiede ora il check `Node 26` al posto di `Python 3.13`. `develop` è creata da `main`. Sul commit di merge sono partite soltanto le analisi CodeQL; sulla VPS l'autodeploy 1.x resta `disabled`/`inactive` senza avvii, mentre bot e callback 1.x restano attivi. Nel checkout locale i residui 1.x (ambiente Python, cache, coverage, build e database locali vuoti) sono stati spostati nel Cestino; il worktree M0, identico a `main`, è stato rimosso. Restano fuori da M1-00 la branch remota 1.x `codex/dependency-refresh-2026-08-26`, mai unita, e la configurazione CodeQL che analizza ancora Python, assegnata a M1-02.

### M1-01 — Bootstrap monorepo e comandi comuni

**Stato:** DONE · **Prerequisiti:** M1-00 · **Contratto:** [§25](docs/MASTER_PLAN.md#s25) · [§26](docs/MASTER_PLAN.md#s26) · [§33](docs/MASTER_PLAN.md#s33)

Strutturare web/dominio/contratti/integrazioni/jobs/UI solo dove utile; script pnpm di controllo e manifest lockati.

**Criterio di completamento:** Checkout pulito installa e verifica; no dipendenze duplicate, output o backend Python richiesto dal nuovo runtime.

Partire da moduli interni: il supporto workspace non richiede package separati per ogni layer né adapter delle alternative scartate.

**Evidenza del 2026-09-26:** l'app resta un solo package pnpm. I client eBay (OAuth, Fulfillment, Trading) e Stripe passano da `app/domain/` a `app/integrations/`; in `app/domain/` restano ordini visibili e export. Cartelle per job, contratti e UI condivisa non sono create finché non hanno contenuto. `pnpm dedupe --check` segnalava `@better-fetch/fetch` in due versioni: il lockfile è deduplicato e `@better-auth/infra` passa da 0.4.9 a 0.4.11, che non fissa più la versione precedente. Le versioni multiple residue sono transitive tra major diverse, più `zod` 4.4.3 fissato da `@cloudflare/vitest-plugin` (solo sviluppo) e `@better-auth/utils` 0.4/0.5 richiesti da Better Auth. Rimossi l'esclusione `zod` dalla soglia di pubblicazione, non più necessaria, e i commenti dello starter; l'override `uuid` 11.1.1 resta motivato nel manifest. Un clone pulito della branch esegue `pnpm install --frozen-lockfile` e `pnpm verify` (format, lint, typecheck, 26 test in 4 file, build, documentazione) senza file generati non ignorati. Nessun backend Python nel runtime; i passi Python nei workflow `pr-title` e `dependabot-auto-merge` e l'analisi CodeQL Python restano a M1-02. Il nome della D1 test `fiscalbay-m0-test` è un vincolo remoto da riconsiderare con gli ambienti di M1-02/M1-08.

Nello stesso intervento la toolchain passa a Node 26.10.0 e pnpm 12.6.0 (`mise.toml`, `package.json`, CI) e le dipendenze dirette all'ultima versione ammessa: Better Auth e passkey 1.7.6, React Router e `@react-router/dev` 8.4.0, Zod 4.6.5, Vite 8.3.1, Oxlint 1.85.0, Oxfmt 0.70.0. Wrangler 4.139.0, `@cloudflare/vite-plugin` 1.60.0, `@cloudflare/vitest-plugin` 1.2.6 e `@types/node` 26.6.2 si fermano prima delle release del 2026-09-25, escluse dalla soglia di età di pnpm; le raccoglierà Dependabot. Vitest resta 4.1.11, ultima 4.x: `@cloudflare/vitest-plugin` 1.2.x richiede ancora `^4.1.0`. GitHub Actions già all'ultima major. Peer check, dedupe e `pnpm verify` verdi.

### M1-02 — Ambienti e CI fondamentale

**Stato:** IN PROGRESS · **Prerequisiti:** M1-01 · **Contratto:** [§34](docs/MASTER_PLAN.md#s34)

Develop/main, PR test/lint/type/build, test deploy controllato; guardrail branch/credential e segreti ambienti separati.

**Criterio di completamento:** PR senza segreti eseguibile, test genera artefatto proprio; il merge main da solo non pubblica.

Non attivare deploy test se endpoint e segreti minimi non sono pronti; pubblicazioni serializzate per ambiente. Fork/PR non fidate non devono acquisire segreti tramite workflow privilegiati.

**Evidenza parziale del 2026-09-26 (React Doctor, D140):** `react-doctor` 0.9.14 fissato e `doctor.config.json` bloccante dai warning; lo script `pnpm doctor:react` (non `pnpm doctor`, comando integrato di pnpm) entra in `pnpm verify` e quindi nel job `Node 26`, già obbligatorio su `main`. Il workflow `react-doctor` usa l'Action ufficiale v2.2.9 fissata a commit, con versione e Node letti da `package.json`, scope `changed` sulle PR con commenti inline e `full` su `main`; salta i diff solo documentali. La prima scansione ha trovato tre warning, corretti: upsert dell'ordine e lettura Trading eseguiti in parallelo nel collegamento negozio, `minimumReleaseAge` e `trustPolicy: no-downgrade` espliciti in `pnpm-workspace.yaml` con la sola esclusione motivata di `semver@6.3.1`. La prima scansione è uscita con codice non zero, a conferma che i warning bloccano; dopo le correzioni punteggio 100/100, 26 test e actionlint verdi. Restano da fare in M1-02 il riordino della CI, i passi Python nei workflow, l'analisi CodeQL Python e il deploy test controllato.

**Evidenza parziale del 2026-09-26 (CI e deploy test):** la configurazione CodeQL riletta su GitHub analizza già Actions, JavaScript e TypeScript, senza Python. La CI verifica le PR verso `develop`/`main` e ora verifica anche i push su `develop`; per le PR solo documentali esegue il controllo dei documenti. Il job di deploy test dipende dalla verifica, gira sui push `develop` o su avvio manuale della CI dalla stessa branch, crea il proprio build, controlla la punta remota prima del deploy e usa il solo artefatto generato dal build con la configurazione flatten di Vite. La pubblicazione resta disattivata finché la variabile repository `TEST_DEPLOY_ENABLED` non vale `true`. Su GitHub l'environment `test` ammette solo `develop` e contiene l'account ID Cloudflare come variabile; non contiene ancora il token API ristretto necessario al job. Sul Worker `fiscalbay-test` i sette segreti runtime richiesti sono presenti. Localmente `actionlint`, `pnpm verify` (26 test) e `wrangler deploy --dry-run` del build sono passati; il deploy CI e il suo readback restano non provati. La PR [#168](https://github.com/max23468/FiscalBay/pull/168) è stata aperta verso `develop`; le prime verifiche GitHub sul commit `5390a78` sono verdi, con il job di deploy correttamente saltato.

**Readback del 2026-09-26:** la PR #168 è unita su `develop` nel commit `717fc38`. Il run CI `36241200040` sul push è verde (`Node 26`); il deploy test è stato saltato con `TEST_DEPLOY_ENABLED=false`. Un deploy manuale controllato del build di `717fc38` tramite Wrangler locale ha pubblicato soltanto `fiscalbay-test` su `test.fiscalbay.it`, versione `e40ce18d-2960-4077-8967-b4fbb5cea5b1`, tag `717fc38`. Il readback Cloudflare conferma la versione al 100%, i sette segreti richiesti restano presenti, la pagina pubblica restituisce HTTP 200 con TLS valido. Non è stata applicata alcuna migration né toccata Production. Resta da provare il deploy da GitHub CI dopo la custodia del token ristretto nell'environment `test` e l'attivazione della variabile.

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

**Criterio di completamento:** Confronto con l’originale approvato dall’owner; nessuna rigenerazione respinta viene promossa a riferimento canonico. Fino all'approvazione, usare sempre gli asset 1.0 su tutte le superfici, incluso Stripe. Dopo l’approvazione, sostituire il logo 1.0 provvisorio nel branding Google Auth e Stripe e aggiornare il logo dei keyset eBay pertinenti.

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

Consolidare il bootstrap test predisposto in M0-02: DNS/TLS/redirect, configurazione Production, iCloud info/supporto e trasporto transazionale selezionato. Verificare inventario record, callback, SPF/DKIM/DMARC e isolamento; allineare i contatti dei provider alla regola email di [§14](docs/MASTER_PLAN.md#s14), a partire dal branding Google OAuth che usa ancora `supporto@` come contatto sviluppatore e l’email personale dell’owner come assistenza utenti; dismettere i record Register senza consumatori dopo il readback Cloudflare e non attivare servizi Register aggiuntivi.

**Criterio di completamento:** HTTP/TLS e callback test/live coerenti, posta umana e Auth provate, record attivi preservati o sostituiti con prova; nessun cookie/RP ID condiviso accidentalmente e nessun setup iniziale rinviato dopo il gate che lo richiedeva.

<a id="m2"></a>

## M2 — Account, Auth e Negozi eBay

**Ingresso:** Fondazioni M1 e gate Auth/eBay risolti.

**Autorizzazione:** Autonomia tecnica nel perimetro; nessun nuovo login, costo o scope implicito.

### M2-01 — Signup e verifica contatto

**Stato:** TODO · **Prerequisiti:** M1, G-AUTH · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§14](docs/MASTER_PLAN.md#s14)

Implementare login/signup email e Google, verifica richiesta prima eBay, opt-in facoltativo non bloccante.

**Criterio di completamento:** Sessione non verificata esplora ma non collega seller; nessun consenso preselezionato o dato fiscale obbligatorio.

Registrare versione/lingua dei Termini accettati e informativa resa disponibile secondo G-LEGAL, tenendole distinte dalla prova del consenso marketing facoltativo.

### M2-02 — Passkey

**Stato:** TODO · **Prerequisiti:** M2-01 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07)

Integrare il percorso passkey qualificato in M0, inclusi registrazione, recupero e revoca. Sign in with eBay è in [M2-09](#m2-09), così l'attesa del diritto eBay non ferma la catena Auth.

**Criterio di completamento:** La passkey funziona sui browser previsti. Un errore dell'autenticatore non produce un account attivato solo parzialmente.

Verificare enrollment su dispositivo e RP ID corretti: passkey create nel test non devono autenticare la Production. Nessun attacco via origin/callback non allowlistato.

### M2-03 — Linking e modifica identità

**Stato:** TODO · **Prerequisiti:** M2-01, M2-02 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§29](docs/MASTER_PLAN.md#s29)

Collegare automaticamente solo identità con email verificata e affidabile. Consentire aggiunta e rimozione dei metodi, modifica email protetta e mantenimento di almeno un accesso valido.

**Criterio di completamento:** Test su registrazione preventiva abusiva, provider non attendibile ed email cambiata; nessuna fusione impropria di spazi né blocco dell’utente per rimozione dell’ultimo metodo.

I casi di linking con Sign in with eBay si aggiungono con [M2-09](#m2-09) e non bloccano la chiusura degli altri metodi.

### M2-04 — Sessioni e admin MFA

**Stato:** TODO · **Prerequisiti:** M2-03 · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§15](docs/MASTER_PLAN.md#s15)

Implementare durata e rotazione delle sessioni, elenco, revoche e nuova verifica per azioni sensibili. Proteggere l’admin con autorizzazione esplicita, MFA e recupero robusto.

**Criterio di completamento:** Logout singolo/globale e revoche effettivi anche sulle azioni sensibili; nessun metodo alternativo debole aggira la MFA amministrativa.

Provare un token precedente su API, RPC e download dopo revoca. Se un percorso diretto non può applicare il contratto di revoca, non esporlo per quelle operazioni: non dichiarare sufficiente il solo logout del browser.

<a id="m2-05"></a>

### M2-05 — OAuth negozi e identità stabile

**Stato:** TODO · **Prerequisiti:** M2-01, G-EBAY · **Contratto:** [§8](docs/MASTER_PLAN.md#s08) · [§29](docs/MASTER_PLAN.md#s29)

Implementare schermata preparatoria, callback e protezioni OAuth, token cifrati e identificatore stabile. Consentire una sola associazione del negozio a uno spazio.

**Criterio di completamento:** Replay e callback duplicate gestiti; nessuna informazione rivelata sullo spazio altrui. Un cambio di nome eBay non crea un nuovo negozio.

Parte dal flusso seller della slice M0-13, che non persiste il token. Qui si provano dal vivo consenso e callback seller 2.0 sul dominio di test, rinviati da M0, insieme a storage cifrato e rinnovo del token.

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

<a id="m2-09"></a>

### M2-09 — Qualifica e integrazione Sign in with eBay

**Stato:** BLOCKED · **Prerequisiti:** M2-01; diritto eBay `commerce.identity.email.readonly` · **Contratto:** [§7](docs/MASTER_PLAN.md#s07) · [§36](docs/MASTER_PLAN.md#s36)

Qualifica rinviata da M0-04 per decisione owner del 2026-09-23: provare sul dominio di test login e linking eBay con lo scope email Identity, poi integrarli con i percorsi di M2-03. Il consenso seller resta un flusso distinto (D048) ed è già provato in M0.

**Criterio di completamento:** Login eBay e linking funzionano sui browser previsti con prove reali; nessun account attivato solo parzialmente, nessuna email simulata e nessun duplicato d'identità.

**Blocco:** diritto `commerce.identity.email.readonly` richiesto a eBay con il Growth Check del 2026-09-20, riferimento `260920-000007`.

**Checklist operativa al riscontro eBay:**

1. Registrare esito, data e riferimento `260920-000007`; rileggere sul keyset `botCF` il diritto effettivo senza modificare scope, RuName o callback legacy.
2. Se il diritto è concesso, verificare che `commerce.identity.email.readonly` sia realmente autorizzabile e che il RuName dedicato FiscalBay resti attivo; distribuire sul Worker test l'esatto commit candidato dopo gate verde.
3. Da una sessione email verificata controllata, avviare il linking del provider `ebay` con `state` e PKCE, completare consenso e callback su `test.fiscalbay.it`, quindi rileggere D1: un solo utente, account eBay collegato allo stesso user ID, nessun duplicato e token cifrati non esposti dalle route HTTP.
4. Dopo logout, accedere con eBay e verificare che torni lo stesso utente locale; il login non collega alcun negozio.
5. Provare revoca globale della sessione FiscalBay, rinnovo del token provider quando necessario e revoca/scollegamento controllati secondo il contratto eBay corrente; nessun token, email, identificativo o payload personale in log o backlog.
6. Rileggere sessioni, account, Worker/versione e revocare le sessioni residue senza disattivare il RuName o il callback 1.x condiviso. Eseguire `pnpm verify`, identificare il commit e portare questo task a DONE solo con tutte le prove effettive.
7. Se il diritto è negato, limitato o non applicabile al keyset, non eliminare il quarto login e non simulare l'email. Registrare motivazione e alternative ufficiali offerte da eBay; se non esiste un percorso equivalente, richiedere all'owner una decisione esplicita sul requisito prima della chiusura di M2. Il blocco resta su questo task e non ferma gli altri task M2.

<a id="m3"></a>

## M3 — Sincronizzazione, ordini e modello fiscale

**Ingresso:** M2, matrice eBay e modello dati qualificati.

**Autorizzazione:** Autonomia tecnica; problemi di copertura fiscale/quote che alterano promessa tornano all’owner.

### M3-01 — Modello ordini, articoli e buyer

**Stato:** TODO · **Prerequisiti:** M2, G-DATA · **Contratto:** [§9](docs/MASTER_PLAN.md#s09) · [§27](docs/MASTER_PLAN.md#s27)

Implementare stato corrente e snapshot degli ordini, mapping delle chiavi esterne, importi esatti, UTC e dati fiscali separati. Mantenere articoli e buyer nel modello qualificato.

**Criterio di completamento:** Importazioni multi-articolo idempotenti; valori monetari precisi; modificare l’anagrafica corrente non riscrive lo storico dell’ordine.

Entità logiche accorpabili quando sicuro; mantenere dati correnti e snapshot dell’ordine senza duplicati a ogni sync. Lo storico di tutte le variazioni fiscali effettive resta richiesto.

<a id="m3-02"></a>

### M3-02 — Client eBay e normalizzazione

**Stato:** TODO · **Prerequisiti:** M3-01, G-EBAY · **Contratto:** [§11](docs/MASTER_PLAN.md#s11) · [§28](docs/MASTER_PLAN.md#s28)

Integrare client generati o adapter REST e Trading mirato, errori tipizzati, provenienza dei campi e stati normalizzati.

**Criterio di completamento:** Contract test con fixture; stati sconosciuti non inventati; ordini pagati, non pagati e dati mascherati classificati correttamente.

Da M0: immagini articolo da Trading `GetItem` tramite `legacyItemId`, con domini e formati qualificati contro SSRF; nessun generatore OAS finché TypeScript 7 non espone un'API compatibile (M0-11).

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

Costruzione qualificata in M0-08: Checkout Managed Payments in modalità abbonamento con prezzo una tantum pari al primo periodo e prezzo ricorrente con `trial_end` pari alla scadenza originale più il periodo. Verificare con Test Clock rinnovo e assenza di addebito a fine prova, e come Link e Portal mostrano un periodo pagato che Stripe registra come `trialing`, incluse cancellazione e rimborso in quella fase.

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

Dati qualificati in M0-08: `expires_at` fra 30 minuti e meno di 24 ore; `checkout.session.expired` libera il posto solo se la sessione non è stata completata; i metodi dinamici includono anche Bancontact, quindi una sessione completata con pagamento non ancora confermato tiene il posto fino a `checkout.session.async_payment_succeeded` o `failed`.

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

**Per chiudere:** M9-05; passaggio definitivo e rimozione della branch 1.x secondo [§37](docs/MASTER_PLAN.md#s37).

Nei primi giorni sorvegliare registrazioni, sync, Stripe, code, quote, errori e supporto, usando interventi mirati secondo le procedure.

**Criterio di completamento:** Esiti e anomalie registrati senza inventare una nuova beta pubblica o un SLA. Normale esercizio predisposto e nessuna chiusura fittizia delle verifiche. Dopo la prova che nessun percorso operativo dipende dalla 1.x, commit finale conservato tramite tag remoto e cancellazione di `legacy/1.x` verificata in locale e sul remoto; riferimenti registrati qui.

## Attività rinviate — non prerequisiti della 2.0

Pagina Notifiche completa; filtri salvati e personalizzazione card Premium; Analisi Premium; team/collaboratori; coupon; accessibilità avanzata; pagina pubblica di stato; integrazioni/API pubbliche soltanto se richieste; iOS/Android React Native/Expo e offline eventuale nella 3.x. Il dettaglio segue il capitolo Roadmap, non compare come funzione incompleta da nascondere nel lancio 2.0.

**Controllo anti-divergenza:** prima di chiudere una milestone, confrontare feature/piano/versione, tutti i task applicabili e la DoD. Un conflitto tecnico con provider va portato al gate, non risolto eliminando silenziosamente una funzione. Il test con un solo merchant non certifica capacità statistica; un benchmark sintetico non dimostra l’eligibility fiscale del conto.
