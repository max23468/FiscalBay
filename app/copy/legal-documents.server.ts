import type { Language } from "../i18n";

/** Un paragrafo, un elenco puntato o una tabella con intestazione. */
export type LegalBlock = string | { items: string[] } | { head: string[]; rows: string[][] };

export type LegalSection = { title: string; blocks: LegalBlock[] };

/**
 * Testo completo di Termini e Privacy nelle due lingue, approvato dall’owner (D230). Resta sul
 * server come gli altri testi del sito. I fornitori compaiono per categoria, con il nome
 * soltanto per eBay, Stripe, Google e Telegram; l’operatore Temisfera compare soltanto qui.
 * Un cambio sostanziale richiede una nuova versione in `legalVersions`.
 */
export const legalDocuments: Record<Language, Record<"termini" | "privacy", LegalSection[]>> = {
  it: {
    termini: [
      {
        title: "Chi gestisce FiscalBay",
        blocks: [
          "FiscalBay è un servizio di Temisfera. Per domande su questi termini scrivi a info@fiscalbay.it.",
          "FiscalBay è indipendente da eBay: non è affiliato, sponsorizzato o approvato da eBay. eBay è un marchio di eBay Inc. FiscalBay usa le API ufficiali di eBay alle condizioni della sua licenza.",
        ],
      },
      {
        title: "Cosa fa FiscalBay",
        blocks: [
          "FiscalBay legge gli ordini dei negozi eBay che colleghi e ti mostra il Codice Fiscale e la Partita IVA dell’acquirente quando eBay li rende disponibili, con ricerca, export e, con Premium, notifiche su Telegram.",
          {
            items: [
              "FiscalBay chiede a eBay soltanto di leggere gli ordini e l’identità del negozio e di avvisarlo dei nuovi ordini. Non modifica ordini, annunci o messaggi e non contatta gli acquirenti.",
              "Il dato fiscale c’è soltanto quando l’acquirente lo ha indicato ed eBay lo fornisce. FiscalBay non lo inventa, non lo corregge e non ne verifica la correttezza.",
              "FiscalBay non emette fatture e non sostituisce il tuo gestionale, il software di fatturazione o il tuo consulente. Resti responsabile dei tuoi adempimenti fiscali.",
            ],
          },
        ],
      },
      {
        title: "Il tuo account",
        blocks: [
          {
            items: [
              "Devi avere almeno 18 anni e la capacità di concludere questo contratto.",
              "I dati del profilo devono essere veri e aggiornati. Un account corrisponde a una sola attività; il piano Free e la prova Premium valgono una volta per attività.",
              "Custodisci i tuoi metodi di accesso. Dalle Impostazioni vedi e chiudi le sessioni attive.",
              "Per collegare un negozio serve l’indirizzo email confermato.",
            ],
          },
        ],
      },
      {
        title: "Collegamento a eBay",
        blocks: [
          "Colleghi un negozio dalla pagina di autorizzazione di eBay, senza dare la tua password a FiscalBay. Puoi revocare l’autorizzazione scollegando il negozio o dal tuo account eBay. Usando FiscalBay rispetti anche le condizioni di eBay.",
        ],
      },
      {
        title: "Piani",
        blocks: [
          {
            items: [
              "Free: gratuito, un negozio attivo sostituibile ogni 90 giorni, gli ultimi 30 giorni di ordini e un numero di ordini da sbloccare ogni 7 giorni indicato nella pagina Prezzi. Gli ordini senza dato fiscale non consumano sblocchi. Dopo 30 giorni senza attività ti avvisiamo; se non confermi entro 7 giorni le letture automatiche si fermano finché non rientri.",
              "Premium: più negozi, un anno di storico, ordini da sbloccare senza limite per ciclo, XLSX, suggerimenti e notifiche Telegram. Restano limiti tecnici e antiabuso.",
              "Prova Premium: 14 giorni, senza carta e senza rinnovo automatico, attivabile dopo la prima lettura riuscita di un negozio. Alla fine torni al Free senza addebiti e gli ordini già sbloccati restano tali.",
            ],
          },
          "Contenuto dei piani e promozioni in corso sono descritti nella pagina Prezzi.",
        ],
      },
      {
        title: "Acquisti",
        blocks: [
          {
            items: [
              "Premium si acquista dall’app, dopo la prima lettura riuscita di un negozio, con il checkout di Stripe. Per questi acquisti Stripe è il venditore (merchant of record): conclude la vendita con te, calcola le imposte del tuo paese e il totale prima del pagamento, anche nella tua valuta, ed emette ricevute e fatture. FiscalBay non vede i dati della carta.",
              "I prezzi sono indicati IVA esclusa.",
              "Mensile e annuale si rinnovano automaticamente. Puoi disdire quando vuoi da Stripe: Premium resta attivo fino alla fine del periodo pagato. Il cambio fra mensile e annuale vale dalla fine del periodo in corso.",
              "A vita: pagamento unico, senza rinnovi, con venti posti in tutto. Comprende il livello Premium anche nelle versioni future e nelle eventuali app, non ogni funzione futura o risorse illimitate.",
              "Recesso e rimborsi seguono le condizioni di Stripe mostrate nel checkout. Restano fermi i diritti che la legge ti riconosce come consumatore. Per altri casi scrivi all’assistenza, che li valuta uno per uno. Un rimborso totale o una contestazione persa revocano il diritto acquistato.",
            ],
          },
        ],
      },
      {
        title: "Dati degli acquirenti",
        blocks: [
          "Per i dati degli acquirenti dei tuoi ordini (nome, indirizzo, identificativi fiscali, articoli) sei tu il titolare del trattamento e Temisfera agisce come responsabile, ai sensi dell’articolo 28 del GDPR. Con questi termini dai a Temisfera l’istruzione di trattarli soltanto per fornirti FiscalBay. Temisfera:",
          {
            items: [
              "li tratta soltanto per leggerli da eBay, mostrarteli, esportarli e notificarteli, secondo le tue impostazioni, e non li usa per fini propri, pubblicità o addestramento di intelligenze artificiali;",
              "li protegge con misure adeguate e ne limita l’accesso a chi gestisce il servizio, vincolato alla riservatezza;",
              "si avvale di fornitori per hosting e database, rete, invio email e posta di assistenza, vincolati agli stessi obblighi; ti informa di un cambio di fornitore aggiornando l’Informativa privacy e puoi opporti chiudendo l’account;",
              "ti assiste nelle richieste degli acquirenti e nella notifica di violazioni, che ti comunica senza ingiustificato ritardo;",
              "li cancella alla scadenza della finestra del tuo piano, quando elimini un negozio o l’account, o quando eBay comunica la cancellazione dell’acquirente, salvo le copie di ripristino del database, che scadono entro 30 giorni;",
              "ti assiste negli obblighi di sicurezza e nelle eventuali valutazioni d’impatto;",
              "ti avvisa se ritiene che un’istruzione violi la normativa sulla protezione dei dati;",
              "alla fine del servizio ti consente di esportarli prima della cancellazione;",
              "ti mette a disposizione le informazioni necessarie a dimostrare il rispetto di questi obblighi e consente verifiche ragionevoli, con preavviso.",
            ],
          },
          "Usi i dati degli acquirenti soltanto per i tuoi adempimenti e nel rispetto della legge e delle condizioni di eBay. FiscalBay non invia messaggi agli acquirenti.",
        ],
      },
      {
        title: "Uso consentito",
        blocks: [
          "Non puoi aggirare limiti, quote o controlli, accedere al servizio con strumenti automatici non previsti, condividere l’account con altre attività o usare FiscalBay per scopi illeciti.",
        ],
      },
      {
        title: "Disponibilità e modifiche del servizio",
        blocks: [
          "Lavoriamo perché FiscalBay sia disponibile e affidabile, ma non garantiamo un servizio continuo o senza errori e non offriamo un livello di servizio garantito. eBay, Stripe o altri fornitori possono interrompere o modificare funzioni da cui FiscalBay dipende. Possiamo modificare il servizio.",
        ],
      },
      {
        title: "Sospensione e chiusura",
        blocks: [
          "Puoi cancellare l’account in qualsiasi momento dalle Impostazioni, dopo aver esportato i dati se ti servono. La cancellazione ferma subito accesso, letture, notifiche e rinnovi. Possiamo sospendere o chiudere un account che viola questi termini, abusa dei piani o è oggetto di una richiesta di eBay, comunicandotelo quando possibile.",
        ],
      },
      {
        title: "Responsabilità",
        blocks: [
          "Nei limiti consentiti dalla legge, Temisfera non risponde di danni indiretti, perdita di guadagni o dati non forniti da eBay, né delle conseguenze dell’uso dei dati fiscali senza le verifiche richieste dai tuoi adempimenti. Restano salve la responsabilità per dolo o colpa grave e i diritti che la legge riconosce al consumatore.",
        ],
      },
      {
        title: "Proprietà intellettuale",
        blocks: [
          "Software, marchio e contenuti di FiscalBay appartengono a Temisfera o ai rispettivi titolari. Questi termini ti danno soltanto il diritto di usare il servizio.",
        ],
      },
      {
        title: "Modifiche ai termini",
        blocks: [
          "Quando questi termini cambiano pubblichiamo una nuova versione e ti invitiamo ad accettarla nell’app. Il servizio resta disponibile anche prima che tu la accetti; se non sei d’accordo puoi cancellare l’account in qualunque momento.",
        ],
      },
      {
        title: "Legge e foro",
        blocks: [
          "Questi termini sono regolati dalla legge italiana. Se sei un consumatore è competente il giudice del luogo in cui risiedi e restano le tutele inderogabili del tuo paese di residenza. Negli altri casi è competente in via esclusiva il foro di Milano.",
        ],
      },
      {
        title: "Lingua",
        blocks: [
          "I termini sono disponibili in italiano e in inglese. In caso di differenze prevale il testo italiano.",
        ],
      },
    ],
    privacy: [
      {
        title: "Titolare del trattamento",
        blocks: [
          "Il titolare del trattamento è Temisfera, che gestisce FiscalBay. Per domande sulla privacy o per esercitare i tuoi diritti scrivi a info@fiscalbay.it.",
          "Questa informativa riguarda chi visita il sito e chi usa FiscalBay. I dati degli acquirenti presenti nei tuoi ordini eBay li trattiamo per tuo conto, come descritto nei Termini, §7.",
        ],
      },
      {
        title: "Quali dati, perché e per quanto",
        blocks: [
          {
            head: ["Dati", "Finalità e base giuridica", "Conservazione"],
            rows: [
              [
                "Account: email, nome, cognome, tipo di account, ragione sociale, lingua, metodi di accesso (password conservata soltanto come impronta, passkey; per l’accesso con Google o eBay, identificativo e token cifrati e l’eventuale immagine del profilo)",
                "Fornirti il servizio (contratto)",
                "Finché l’account esiste",
              ],
              [
                "Sessioni: indirizzo IP, browser, istanti di accesso",
                "Accesso e sicurezza dell’account (contratto, legittimo interesse)",
                "Fino alla chiusura della sessione, al più 7 giorni dall’ultimo uso",
              ],
              [
                "Accettazione dei Termini: versione, lingua, istante e versione dell’informativa",
                "Prova dell’accettazione (legittimo interesse)",
                "Finché l’account esiste",
              ],
              [
                "Consenso a novità e offerte: scelta, versione del testo, istante",
                "Invio di email promozionali soltanto se acconsenti (consenso, revocabile in ogni momento dalle Impostazioni o dal link nelle email)",
                "Finché l’account esiste",
              ],
              [
                "Negozi eBay: identità e nome del negozio, autorizzazione cifrata, stato delle letture",
                "Leggere gli ordini (contratto)",
                "Fino allo scollegamento o all’eliminazione del negozio",
              ],
              [
                "Acquisti: riferimenti del cliente e degli abbonamenti presso Stripe, piano, periodi e importi pagati",
                "Attribuire i diritti Premium e riconciliare i pagamenti (contratto, obblighi di legge)",
                "Finché l’account esiste; per il piano a vita, la prova dell’acquisto resta finché il diritto è recuperabile",
              ],
              [
                "Telegram: identificativo e nome della chat, preferenze delle notifiche",
                "Inviarti le notifiche che hai scelto (contratto)",
                "Fino allo scollegamento; le singole consegne al più 30 giorni",
              ],
              [
                "Assistenza: messaggi, argomento e un riepilogo tecnico che vedi prima dell’invio (versione, negozio, esito dell’ultima lettura, codice di errore, piano, riferimento della richiesta)",
                "Rispondere alle richieste (contratto, legittimo interesse)",
                "24 mesi dall’ultima risposta",
              ],
              [
                "Email di servizio: indirizzo e tipo di messaggio",
                "Accesso, sicurezza e avvisi importanti (contratto)",
                "Non conserviamo copie dei messaggi inviati",
              ],
              [
                "Log delle richieste: indirizzo IP, browser, posizione approssimativa (paese e città), indirizzo della pagina richiesta, esito",
                "Funzionamento e sicurezza (legittimo interesse)",
                "7 giorni",
              ],
              [
                "Statistiche delle pagine pubbliche del sito: pagina, sito di provenienza, paese, tipo di dispositivo, browser, sistema operativo e tempi di caricamento, senza cookie e senza identificare il visitatore",
                "Contare le visite e misurare la velocità del sito (legittimo interesse)",
                "6 mesi presso il fornitore di rete, in forma aggregata dopo 7 giorni",
              ],
              [
                "Archivio dei log: istante, tipo ed esito delle operazioni, codici di errore, riferimenti interni, senza IP, indirizzi delle pagine, email, dati degli acquirenti o valori fiscali",
                "Diagnosi e sicurezza (legittimo interesse)",
                "90 giorni",
              ],
              [
                "Limite dei tentativi di accesso: indirizzo IP (per le reti IPv6 il prefisso) e operazione",
                "Impedire tentativi ripetuti (legittimo interesse)",
                "Poche ore, al più un giorno",
              ],
              [
                "Verifica anti-automazione, alla registrazione con password, alla richiesta di una nuova password o di un nuovo link e all’invio di una richiesta di assistenza: indirizzo IP e caratteristiche tecniche del browser e del dispositivo, esaminati dal fornitore di rete",
                "Impedire registrazioni e invii automatici (legittimo interesse)",
                "Non conserviamo l’esito; presso il fornitore di rete per il tempo da lui stabilito",
              ],
              [
                "Eventi di rete e protezione: indirizzo IP, percorso richiesto, browser, paese, regola applicata",
                "Bloccare attacchi e abusi (legittimo interesse)",
                "31 giorni presso il fornitore di rete",
              ],
              [
                "Report sull’autenticazione della posta (DMARC): server e domini che inviano email a nome di fiscalbay.it ed esiti dei controlli, senza contenuto delle email",
                "Proteggere il dominio da invii falsi (legittimo interesse)",
                "Per il tempo stabilito dal fornitore di rete",
              ],
              [
                "Controlli antiabuso: confronto di ragione sociale, nome del negozio e cliente di pagamento fra account diversi, esaminato da una persona; dopo la cancellazione, l’impronta dell’identità eBay del negozio con la prova già usata e il ciclo Free in corso",
                "Impedire che prova e piano Free si ottengano più volte (legittimo interesse)",
                "Il confronto finché l’account esiste; l’impronta 2 anni, il ciclo Free fino alla sua fine",
              ],
              [
                "Registro della console di gestione: autore, operazione, oggetto e motivo, senza dati degli acquirenti",
                "Sicurezza e tracciabilità degli interventi (legittimo interesse)",
                "Un anno",
              ],
              ["File esportati", "Scaricare i tuoi dati", "Al più 24 ore"],
              ["Notifiche nell’app", "Avvisarti nell’app", "30 giorni"],
              [
                "Metriche di utilizzo: istante del primo collegamento, della prima lettura e degli altri passaggi principali, senza ordini o dati fiscali",
                "Migliorare il servizio (legittimo interesse)",
                "Finché l’account esiste",
              ],
            ],
          },
          "Quando cancelli l’account eliminiamo i dati sopra, salvo quelli per cui la tabella indica una durata propria: l’impronta antiabuso, il registro della console, la prova dell’acquisto a vita e le email di assistenza. Resta inoltre per 30 giorni un’indicazione della cancellazione, che ne impedisce l’annullamento con un ripristino. Le copie di ripristino del database scadono entro 30 giorni.",
          "I dati dell’account sono necessari per usare FiscalBay. Il consenso a novità e offerte è facoltativo e non cambia il servizio.",
        ],
      },
      {
        title: "Cookie e tecnologie simili",
        blocks: [
          "FiscalBay usa soltanto cookie tecnici: quelli necessari all’accesso e alla sicurezza della sessione e quelli che ricordano una tua scelta, cioè il fuso orario del dispositivo, il negozio scelto nei filtri degli ordini e la visita al sito pubblico senza uscire dall’account. La memoria del browser conserva temporaneamente una selezione di ordini da esportare. Nei moduli di registrazione, recupero della password, nuovo link e assistenza, la verifica anti-automazione del fornitore di rete legge caratteristiche tecniche del browser per distinguere le persone dai programmi automatici. Le pagine pubbliche del sito contano le visite con lo strumento statistico del fornitore di rete, che non usa cookie né altri identificativi salvati nel browser e non segue il visitatore su altri siti. Nessun cookie di analisi, profilazione o pubblicità: per questo non c’è un banner dei cookie.",
        ],
      },
      {
        title: "A chi comunichiamo i dati",
        blocks: [
          "Non vendiamo i dati, non li usiamo per pubblicità e non usiamo i dati di eBay o degli acquirenti per addestrare intelligenze artificiali. I dati arrivano soltanto a:",
          {
            items: [
              "fornitori che lavorano per nostro conto, vincolati da contratto: hosting e database, rete e protezione, invio delle email di servizio, posta e assistenza;",
              "eBay, che riceve le richieste di lettura con l’autorizzazione che hai dato e, se accedi con eBay, la richiesta di accesso;",
              "Stripe, che per gli acquisti è il venditore e tratta i dati di pagamento come titolare autonomo, secondo la sua informativa;",
              "Google, se scegli di accedere con Google;",
              "Telegram, se colleghi il bot, che consegna le notifiche nella chat che hai scelto;",
              "autorità, quando la legge lo impone.",
            ],
          },
        ],
      },
      {
        title: "Dove sono i dati",
        blocks: [
          "Ordini, dati fiscali, file esportati e log sono conservati su server nell’Unione Europea. Le richieste transitano dalla rete globale del fornitore di hosting. Pagamenti, assistenza, statistiche del sito, accesso con Google, eBay e Telegram seguono i rispettivi fornitori, che possono trattare dati fuori dall’Unione Europea. In questi casi il trasferimento si basa sulle garanzie previste dal GDPR, come una decisione di adeguatezza o le clausole contrattuali tipo della Commissione europea. Puoi chiederne copia a info@fiscalbay.it.",
        ],
      },
      {
        title: "I tuoi diritti",
        blocks: [
          "Puoi chiedere accesso, rettifica, cancellazione, limitazione e portabilità dei tuoi dati, opporti ai trattamenti basati sul legittimo interesse e revocare il consenso in ogni momento, senza effetto sui trattamenti precedenti. Dalle Impostazioni puoi correggere il profilo, scaricare i dati dell’account e cancellarlo. Per il resto scrivi a info@fiscalbay.it: rispondiamo entro un mese. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it) o all’autorità del tuo paese.",
          "Non prendiamo decisioni basate soltanto su trattamenti automatizzati che producano effetti giuridici su di te: i controlli antiabuso sono esaminati da una persona.",
        ],
      },
      {
        title: "Minori",
        blocks: ["FiscalBay è riservato a chi ha almeno 18 anni."],
      },
      {
        title: "Modifiche",
        blocks: [
          "Quando questa informativa cambia pubblichiamo una nuova versione con la data e, per i cambiamenti sostanziali, te lo segnaliamo al primo accesso.",
        ],
      },
    ],
  },
  en: {
    termini: [
      {
        title: "Who runs FiscalBay",
        blocks: [
          "FiscalBay is a service by Temisfera. For questions about these terms, write to info@fiscalbay.it.",
          "FiscalBay is independent of eBay: it is not affiliated with, sponsored or endorsed by eBay. eBay is a trademark of eBay Inc. FiscalBay uses eBay’s official APIs under the terms of its licence.",
        ],
      },
      {
        title: "What FiscalBay does",
        blocks: [
          "FiscalBay reads the orders of the eBay stores you connect and shows you the buyer’s Italian tax code (Codice Fiscale) and VAT number when eBay makes them available, with search, export and, with Premium, Telegram notifications.",
          {
            items: [
              "FiscalBay only asks eBay to read orders and the store identity and to notify it of new orders. It does not change orders, listings or messages and does not contact buyers.",
              "The tax data is there only when the buyer provided it and eBay supplies it. FiscalBay does not invent, correct or verify it.",
              "FiscalBay does not issue invoices and does not replace your accounting software, invoicing software or adviser. You remain responsible for your tax obligations.",
            ],
          },
        ],
      },
      {
        title: "Your account",
        blocks: [
          {
            items: [
              "You must be at least 18 and able to enter into this contract.",
              "Your profile details must be true and up to date. One account corresponds to one business; the Free plan and the Premium trial apply once per business.",
              "Keep your sign-in methods safe. In Settings you can see and close active sessions.",
              "Connecting a store requires a confirmed email address.",
            ],
          },
        ],
      },
      {
        title: "Connecting eBay",
        blocks: [
          "You connect a store from eBay’s authorisation page, without giving FiscalBay your password. You can revoke the authorisation by disconnecting the store or from your eBay account. When using FiscalBay you also comply with eBay’s terms.",
        ],
      },
      {
        title: "Plans",
        blocks: [
          {
            items: [
              "Free: free of charge, one active store replaceable every 90 days, the last 30 days of orders and a number of orders to unlock every 7 days shown on the Pricing page. Orders without tax data do not use unlocks. After 30 days without activity we notify you; if you do not confirm within 7 days, automatic reads stop until you come back.",
              "Premium: more stores, one year of history, unlimited unlocks per cycle, XLSX, suggestions and Telegram notifications. Technical and anti-abuse limits still apply.",
              "Premium trial: 14 days, no card and no automatic renewal, available after the first successful read of a store. At the end you go back to Free with no charge and orders already unlocked stay unlocked.",
            ],
          },
          "Plan contents and current promotions are described on the Pricing page.",
        ],
      },
      {
        title: "Purchases",
        blocks: [
          {
            items: [
              "Premium is bought in the app, after the first successful read of a store, through Stripe checkout. For these purchases Stripe is the seller (merchant of record): it concludes the sale with you, calculates your country’s taxes and the total before payment, also in your currency, and issues receipts and invoices. FiscalBay does not see card details.",
              "Prices are shown excluding VAT.",
              "Monthly and annual plans renew automatically. You can cancel at any time from Stripe: Premium stays active until the end of the paid period. Switching between monthly and annual applies from the end of the current period.",
              "Lifetime: one payment, no renewals, twenty seats in total. It includes the Premium level in future versions and in any apps, not every future feature or unlimited resources.",
              "Withdrawal and refunds follow Stripe’s terms shown at checkout. The rights the law grants you as a consumer are unaffected. For other cases write to support, which assesses them one by one. A full refund or a lost dispute revokes the purchased right.",
            ],
          },
        ],
      },
      {
        title: "Buyer data",
        blocks: [
          "For the data of the buyers in your orders (name, address, tax identifiers, items) you are the data controller and Temisfera acts as processor under Article 28 GDPR. With these terms you instruct Temisfera to process it only to provide FiscalBay. Temisfera:",
          {
            items: [
              "processes it only to read it from eBay, show, export and notify it to you according to your settings, and does not use it for its own purposes, advertising or training artificial intelligence;",
              "protects it with appropriate measures and limits access to those who run the service, bound by confidentiality;",
              "uses providers for hosting and database, network, email sending and support mail, bound by the same obligations; it informs you of a change of provider by updating the Privacy policy and you can object by closing your account;",
              "assists you with buyer requests and with personal data breaches, which it reports to you without undue delay;",
              "deletes it when your plan’s window expires, when you delete a store or your account, or when eBay reports the buyer’s deletion, except for database restore copies, which expire within 30 days;",
              "assists you with security obligations and any impact assessments;",
              "informs you if it believes an instruction infringes data protection law;",
              "at the end of the service lets you export it before deletion;",
              "makes available to you the information needed to demonstrate compliance with these obligations and allows reasonable audits, with notice.",
            ],
          },
          "You use buyer data only for your own obligations and in compliance with the law and eBay’s terms. FiscalBay does not send messages to buyers.",
        ],
      },
      {
        title: "Acceptable use",
        blocks: [
          "You may not bypass limits, quotas or controls, access the service with unsupported automated tools, share the account with other businesses or use FiscalBay for unlawful purposes.",
        ],
      },
      {
        title: "Availability and changes to the service",
        blocks: [
          "We work to keep FiscalBay available and reliable, but we do not guarantee an uninterrupted or error-free service and offer no guaranteed service level. eBay, Stripe or other providers may interrupt or change features FiscalBay depends on. We may change the service.",
        ],
      },
      {
        title: "Suspension and closure",
        blocks: [
          "You can delete your account at any time from Settings, after exporting your data if you need it. Deletion immediately stops access, reads, notifications and renewals. We may suspend or close an account that breaches these terms, abuses the plans or is the subject of a request from eBay, informing you where possible.",
        ],
      },
      {
        title: "Liability",
        blocks: [
          "To the extent permitted by law, Temisfera is not liable for indirect damage, loss of profit or data not supplied by eBay, or for the consequences of using tax data without the checks your obligations require. Liability for wilful misconduct or gross negligence and the rights the law grants to consumers are unaffected.",
        ],
      },
      {
        title: "Intellectual property",
        blocks: [
          "FiscalBay’s software, brand and content belong to Temisfera or their respective owners. These terms only give you the right to use the service.",
        ],
      },
      {
        title: "Changes to these terms",
        blocks: [
          "When these terms change we publish a new version and invite you to accept it in the app. The service stays available before you accept it; if you disagree you can delete your account at any time.",
        ],
      },
      {
        title: "Governing law and jurisdiction",
        blocks: [
          "These terms are governed by Italian law. If you are a consumer, the courts of the place where you live have jurisdiction and the mandatory protections of your country of residence still apply. In all other cases the courts of Milan have exclusive jurisdiction.",
        ],
      },
      {
        title: "Language",
        blocks: [
          "These terms are available in Italian and English. If they differ, the Italian text prevails.",
        ],
      },
    ],
    privacy: [
      {
        title: "Data controller",
        blocks: [
          "The data controller is Temisfera, which runs FiscalBay. For privacy questions or to exercise your rights, write to info@fiscalbay.it.",
          "This policy covers people who visit the site and people who use FiscalBay. We process the data of the buyers in your eBay orders on your behalf, as described in the Terms, §7.",
        ],
      },
      {
        title: "What data, why and for how long",
        blocks: [
          {
            head: ["Data", "Purpose and legal basis", "Retention"],
            rows: [
              [
                "Account: email, first and last name, account type, company name, language, sign-in methods (password stored only as a hash, passkeys; for sign-in with Google or eBay, identifier, encrypted tokens and any profile picture)",
                "Providing the service (contract)",
                "As long as the account exists",
              ],
              [
                "Sessions: IP address, browser, sign-in times",
                "Account access and security (contract, legitimate interest)",
                "Until the session is closed, at most 7 days after last use",
              ],
              [
                "Acceptance of the Terms: version, language, time and privacy policy version",
                "Proof of acceptance (legitimate interest)",
                "As long as the account exists",
              ],
              [
                "Consent to news and offers: choice, text version, time",
                "Promotional emails only if you agree (consent, revocable at any time in Settings or from the link in the emails)",
                "As long as the account exists",
              ],
              [
                "eBay stores: store identity and name, encrypted authorisation, read status",
                "Reading orders (contract)",
                "Until the store is disconnected or deleted",
              ],
              [
                "Purchases: customer and subscription references at Stripe, plan, periods and amounts paid",
                "Granting Premium rights and reconciling payments (contract, legal obligations)",
                "As long as the account exists; for lifetime, proof of purchase stays as long as the right can be recovered",
              ],
              [
                "Telegram: chat ID and name, notification preferences",
                "Sending the notifications you chose (contract)",
                "Until disconnected; individual deliveries at most 30 days",
              ],
              [
                "Support: messages, topic and a technical summary you see before sending (version, store, last read result, error code, plan, request reference)",
                "Answering requests (contract, legitimate interest)",
                "24 months after the last reply",
              ],
              [
                "Service emails: address and message type",
                "Sign-in, security and important notices (contract)",
                "We keep no copies of sent messages",
              ],
              [
                "Request logs: IP address, browser, approximate location (country and city), requested page address, result",
                "Operation and security (legitimate interest)",
                "7 days",
              ],
              [
                "Statistics of the public website pages: page, referring site, country, device type, browser, operating system and load times, without cookies and without identifying the visitor",
                "Counting visits and measuring site speed (legitimate interest)",
                "6 months at the network provider, aggregated after 7 days",
              ],
              [
                "Log archive: time, type and result of operations, error codes, internal references, without IP, page addresses, emails, buyer data or tax values",
                "Diagnosis and security (legitimate interest)",
                "90 days",
              ],
              [
                "Sign-in attempt limit: IP address (the prefix for IPv6 networks) and operation",
                "Preventing repeated attempts (legitimate interest)",
                "A few hours, at most one day",
              ],
              [
                "Automation check, when signing up with a password, requesting a new password or a new link and sending a support request: IP address and technical characteristics of the browser and device, examined by the network provider",
                "Preventing automated sign-ups and submissions (legitimate interest)",
                "We do not keep the result; at the network provider for the time it sets",
              ],
              [
                "Network and protection events: IP address, requested path, browser, country, rule applied",
                "Blocking attacks and abuse (legitimate interest)",
                "31 days at the network provider",
              ],
              [
                "Email authentication reports (DMARC): servers and domains sending email on behalf of fiscalbay.it and check results, without email content",
                "Protecting the domain from spoofing (legitimate interest)",
                "For the time set by the network provider",
              ],
              [
                "Anti-abuse checks: comparison of company name, store name and payment customer across accounts, reviewed by a person; after deletion, a fingerprint of the store’s eBay identity with the trial already used and the current Free cycle",
                "Preventing the trial and the Free plan from being obtained more than once (legitimate interest)",
                "The comparison as long as the account exists; the fingerprint 2 years, the Free cycle until it ends",
              ],
              [
                "Management console log: author, operation, object and reason, without buyer data",
                "Security and traceability of interventions (legitimate interest)",
                "One year",
              ],
              ["Exported files", "Downloading your data", "At most 24 hours"],
              ["In-app notifications", "Notifying you in the app", "30 days"],
              [
                "Usage metrics: time of first connection, first read and other main steps, without orders or tax data",
                "Improving the service (legitimate interest)",
                "As long as the account exists",
              ],
            ],
          },
          "When you delete your account we delete the data above, except where the table gives its own retention: the anti-abuse fingerprint, the console log, lifetime proof of purchase and support emails. A record of the deletion also stays for 30 days so that a restore cannot undo it. Database restore copies expire within 30 days.",
          "Account data is needed to use FiscalBay. Consent to news and offers is optional and does not change the service.",
        ],
      },
      {
        title: "Cookies and similar technologies",
        blocks: [
          "FiscalBay only uses technical cookies: those needed for sign-in and session security, and those that remember a choice of yours, namely the device time zone, the store chosen in the order filters and visiting the public website without leaving your account. Browser storage temporarily keeps a selection of orders to export. In the sign-up, password recovery, new link and support forms, the network provider’s automation check reads technical characteristics of the browser to tell people from automated programs. The public website pages count visits with the network provider’s statistics tool, which uses no cookies or other identifiers stored in the browser and does not follow the visitor across other sites. No analytics, profiling or advertising cookies: that is why there is no cookie banner.",
        ],
      },
      {
        title: "Who receives the data",
        blocks: [
          "We do not sell data, do not use it for advertising and do not use eBay or buyer data to train artificial intelligence. Data only reaches:",
          {
            items: [
              "providers working on our behalf under contract: hosting and database, network and protection, service email sending, mail and support;",
              "eBay, which receives read requests with the authorisation you gave and, if you sign in with eBay, the sign-in request;",
              "Stripe, which is the seller for purchases and processes payment data as an independent controller under its own policy;",
              "Google, if you choose to sign in with Google;",
              "Telegram, if you connect the bot, which delivers notifications to the chat you chose;",
              "authorities, where the law requires it.",
            ],
          },
        ],
      },
      {
        title: "Where the data is",
        blocks: [
          "Orders, tax data, exported files and logs are stored on servers in the European Union. Requests pass through the hosting provider’s global network. Payments, support, site statistics, sign-in with Google, eBay and Telegram follow their respective providers, which may process data outside the European Union. In those cases the transfer relies on the safeguards provided by the GDPR, such as an adequacy decision or the European Commission’s standard contractual clauses. You can request a copy at info@fiscalbay.it.",
        ],
      },
      {
        title: "Your rights",
        blocks: [
          "You can request access, rectification, erasure, restriction and portability of your data, object to processing based on legitimate interest and withdraw consent at any time, without affecting earlier processing. In Settings you can correct your profile, download your account data and delete it. For anything else write to info@fiscalbay.it: we reply within one month. You can also lodge a complaint with the Italian data protection authority (garanteprivacy.it) or the authority in your country.",
          "We do not take decisions based solely on automated processing that produce legal effects on you: anti-abuse checks are reviewed by a person.",
        ],
      },
      {
        title: "Minors",
        blocks: ["FiscalBay is for people aged 18 or over."],
      },
      {
        title: "Changes",
        blocks: [
          "When this policy changes we publish a new dated version and, for substantial changes, let you know at your next sign-in.",
        ],
      },
    ],
  },
};
