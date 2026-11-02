import type { Language } from "../i18n";

export const scenarioIds = [
  "ordinario",
  "sblocco-non-riuscito",
  "quota-esaurita",
  "fine-promozione",
  "free-inattivo",
  "proposta-consenso",
  "lista-d-attesa",
  "acquisti-sospesi",
  "aggiornamento",
  "ebay-non-disponibile",
  "letture-sospese",
  "negozio-scaduto",
  "negozio-sospeso",
  "dati-discordanti",
  "primo-accesso",
  "email-da-confermare",
  "prima-sincronizzazione",
  "importazione",
  "nessun-ordine",
  "caricamento",
  "servizio-non-disponibile",
  "cancellazione-in-corso",
  "prova-premium",
  "prova-in-scadenza",
  "prova-terminata",
  "prova-con-abbonamento",
  "prova-con-abbonamento-disdetto",
  "pagamento-in-attivazione",
  "rinnovo-non-riuscito",
  "pagamento-rimborsato",
  "lifetime-rimborsato",
  "stripe-non-disponibile",
  "lifetime-esaurito",
  "premium",
  "telegram-bloccato",
  "telegram-non-consegnato",
  "cambio-rinnovo",
  "rinnovo-disdetto",
  "passaggio-a-vita",
  "premium-concesso",
  "premium-a-vita",
  "premium-a-vita-concesso",
] as const;

export type ScenarioId = (typeof scenarioIds)[number];

export const scenarioText: Record<ScenarioId, Record<Language, { name: string; focus: string }>> = {
  "sblocco-non-riuscito": {
    it: {
      name: "Sblocco non riuscito",
      focus:
        "Il primo tentativo fallisce senza consumare quota o salvare la preferenza. Puoi riprovare.",
    },
    en: {
      name: "Unlock failed",
      focus: "The first attempt fails without using quota or saving the preference. You can retry.",
    },
  },
  ordinario: {
    it: {
      name: "Free, uso ordinario",
      focus: "Codici disponibili, da sbloccare, assenti, da verificare, errori e testi lunghi.",
    },
    en: {
      name: "Free, everyday use",
      focus: "Available, locked, missing and to-review codes, errors and long text.",
    },
  },
  "quota-esaurita": {
    it: {
      name: "Sblocchi esauriti",
      focus:
        "Gli ordini restano consultabili. Codice Fiscale e Partita IVA dei nuovi ordini attendono il prossimo ciclo.",
    },
    en: {
      name: "No unlocks left",
      focus:
        "Orders remain available. Codice Fiscale and Partita IVA of new orders wait for the next cycle.",
    },
  },
  "proposta-consenso": {
    it: {
      name: "Proposta del consenso",
      focus:
        "Primi passi conclusi senza adesione in registrazione: gli Ordini propongono una volta novità e offerte via email.",
    },
    en: {
      name: "Consent prompt",
      focus:
        "Getting started is complete without opting in at sign-up: Orders offers news and offers by email once.",
    },
  },
  "fine-promozione": {
    it: {
      name: "Fine della promozione",
      focus:
        "La promozione è finita: il ciclo in corso conserva i suoi 10 sblocchi, il prossimo ne avrà 5.",
    },
    en: {
      name: "Promotion ending",
      focus:
        "The promotion has ended: the current cycle keeps its 10 unlocks, the next one will have 5.",
    },
  },
  "free-inattivo": {
    it: {
      name: "Free inattivo",
      focus:
        "Dopo 30 giorni senza accessi e 7 di preavviso le letture del Free sono in pausa. Gli ordini restano consultabili; «Riprendi le letture» le riattiva.",
    },
    en: {
      name: "Inactive Free",
      focus:
        "After 30 days without sign-ins and 7 days' notice, Free reading is paused. Orders remain available; Resume reading restarts it.",
    },
  },
  "lista-d-attesa": {
    it: {
      name: "Lista d’attesa",
      focus:
        "Account registrato con il Free al completo: la prima lettura del negozio è fatta, nessuna lettura successiva né sblocco del Free. Prova e Premium restano disponibili.",
    },
    en: {
      name: "Waiting list",
      focus:
        "Account registered while the Free plan is full: the store's first read is done, with no further reads or Free unlocks. Trial and Premium remain available.",
    },
  },
  "acquisti-sospesi": {
    it: {
      name: "Acquisti sospesi",
      focus:
        "Senza capacità per nuovi Premium prova e acquisti sono sospesi; il Free continua come prima.",
    },
    en: {
      name: "Purchases paused",
      focus:
        "Without capacity for new Premium accounts, trial and purchases are paused; the Free plan continues as before.",
    },
  },
  aggiornamento: {
    it: {
      name: "Aggiornamento in corso",
      focus:
        "Indicatore locale, ordini consultabili, nuovi ordini inseriti subito in cima alla lista e sblocco sospeso fino al pagamento.",
    },
    en: {
      name: "Update in progress",
      focus:
        "Local indicator, orders still available, new orders added at the top of the list and unlocking on hold until payment.",
    },
  },
  "ebay-non-disponibile": {
    it: {
      name: "eBay non risponde",
      focus: "Ultimo aggiornamento, azioni che dipendono da eBay sospese, il resto utilizzabile.",
    },
    en: {
      name: "eBay not responding",
      focus: "Last update time, eBay-dependent actions paused, everything else usable.",
    },
  },
  "letture-sospese": {
    it: {
      name: "Letture eBay sospese",
      focus:
        "Manutenzione di FiscalBay: ordini consultabili, sincronizzazione e collegamento sospesi fino alla ripresa.",
    },
    en: {
      name: "eBay reads paused",
      focus:
        "FiscalBay maintenance: orders available, syncing and connecting paused until reads resume.",
    },
  },
  "negozio-scaduto": {
    it: {
      name: "Problema su un negozio",
      focus:
        "Premium con quattro negozi: uno con l’aggiornamento non riuscito, uno da ricollegare, uno con autorizzazione incompleta, uno non verificabile.",
    },
    en: {
      name: "Problem with one store",
      focus:
        "Premium with four stores: one whose update failed, one to reconnect, one with incomplete authorisation, one that cannot be verified.",
    },
  },
  "negozio-sospeso": {
    it: {
      name: "Negozio in pausa dall’assistenza",
      focus:
        "L’assistenza ha messo in pausa le letture di un negozio: gli ordini restano consultabili e soltanto l’assistenza toglie la pausa.",
    },
    en: {
      name: "Store paused by support",
      focus:
        "Support has paused a store's reads: orders remain available and only support can lift the pause.",
    },
  },
  "dati-discordanti": {
    it: {
      name: "Dati discordanti",
      focus:
        "Codice aggiornato o nascosto da eBay, lettura non riuscita, nome non coerente o non verificabile, suggerimenti in conflitto, un ordine da verificare e contatti in forme diverse.",
    },
    en: {
      name: "Conflicting data",
      focus:
        "Code updated or hidden by eBay, failed read, name mismatch, ambiguous codes, conflicting suggestions, an order that needs review and contacts in different forms.",
    },
  },
  "primo-accesso": {
    it: {
      name: "Primo accesso",
      focus:
        "Nessun negozio e primi passi. In Negozi il collegamento simulato risulta già usato da un altro account.",
    },
    en: {
      name: "First sign-in",
      focus:
        "No store and getting started. In Stores the simulated connection is already used by another account.",
    },
  },
  "email-da-confermare": {
    it: {
      name: "Email da confermare",
      focus:
        "Account appena registrato: solo gli Ordini con l’avviso di conferma, la lingua nel menu e la cancellazione.",
    },
    en: {
      name: "Email to confirm",
      focus:
        "Newly registered account: only Orders with the confirmation notice, language in the menu and deletion.",
    },
  },
  "prima-sincronizzazione": {
    it: {
      name: "Prima sincronizzazione",
      focus:
        "Negozio appena collegato, nessun ordine ancora letto e primi passi dal punto raggiunto.",
    },
    en: {
      name: "First sync",
      focus: "Store just connected, no orders read yet and getting started from the current step.",
    },
  },
  importazione: {
    it: {
      name: "Importazione iniziale",
      focus: "Prime righe già consultabili durante l'importazione dello storico.",
    },
    en: {
      name: "Initial import",
      focus: "First rows available while the history is being imported.",
    },
  },
  "nessun-ordine": {
    it: {
      name: "Nessun ordine",
      focus: "Negozio collegato e aggiornato, periodo senza ordini.",
    },
    en: {
      name: "No orders",
      focus: "Store connected and up to date, no orders in the period.",
    },
  },
  caricamento: {
    it: { name: "Caricamento", focus: "Scheletro aderente al layout delle schede." },
    en: { name: "Loading", focus: "Skeleton matching the card layout." },
  },
  "cancellazione-in-corso": {
    it: {
      name: "Cancellazione in corso",
      focus:
        "Link di conferma aperto: sessioni chiuse, letture, notifiche e rinnovi fermi, nessuna schermata dell’area.",
    },
    en: {
      name: "Deletion in progress",
      focus:
        "Confirmation link opened: sessions closed, reads, notifications and renewals stopped, no area screen.",
    },
  },
  "servizio-non-disponibile": {
    it: {
      name: "Servizio non disponibile",
      focus: "Accesso o database non rispondono: nessun dato mostrato, soltanto Riprova.",
    },
    en: {
      name: "Service unavailable",
      focus: "Sign-in or database not responding: no data shown, only Try again.",
    },
  },
  "prova-premium": {
    it: {
      name: "Prova Premium",
      focus:
        "Prova attivata cinque giorni fa: giorni rimasti in Ordini e in Piano, nessun ordine da sbloccare, due negozi attivi.",
    },
    en: {
      name: "Premium trial",
      focus:
        "Trial started five days ago: days left in Orders and Plan, no orders to unlock, two active stores.",
    },
  },
  "prova-in-scadenza": {
    it: {
      name: "Prova in scadenza",
      focus:
        "Manca meno di due giorni alla fine della prova: avviso in evidenza in Ordini con il rimando al piano.",
    },
    en: {
      name: "Trial ending",
      focus:
        "Less than two days before the trial ends: prominent notice in Orders linking to the plan.",
    },
  },
  "prova-terminata": {
    it: {
      name: "Prova terminata",
      focus:
        "Di nuovo Free dopo la prova, senza invito a ripeterla: gli ordini con il dato arrivato durante la prova restano sbloccati.",
    },
    en: {
      name: "Trial ended",
      focus:
        "Back on Free after the trial, with no offer to repeat it: orders whose data arrived during the trial stay unlocked.",
    },
  },
  "prova-con-abbonamento": {
    it: {
      name: "Prova con abbonamento scelto",
      focus:
        "Mensile scelto durante la prova: la prova continua, nessun addebito fino alla sua fine e nessun secondo acquisto.",
    },
    en: {
      name: "Trial with plan chosen",
      focus:
        "Monthly chosen during the trial: the trial continues, no charge until it ends and no second purchase.",
    },
  },
  "prova-con-abbonamento-disdetto": {
    it: {
      name: "Prova con abbonamento disdetto",
      focus:
        "Mensile scelto durante la prova e poi disdetto: nessun addebito, alla fine si torna al Free e su Stripe si può riattivare.",
    },
    en: {
      name: "Trial with plan cancelled",
      focus:
        "Monthly chosen during the trial and then cancelled: no charge, back to Free when it ends, and it can be reactivated on Stripe.",
    },
  },
  "pagamento-in-attivazione": {
    it: {
      name: "Pagamento in attivazione",
      focus:
        "Stripe non ha ancora confermato il pagamento: il piano resta Free e l'attivazione è in corso, senza un secondo acquisto.",
    },
    en: {
      name: "Payment being activated",
      focus:
        "Stripe has not confirmed the payment yet: the plan stays Free and activation is in progress, with no second purchase.",
    },
  },
  "rinnovo-non-riuscito": {
    it: {
      name: "Rinnovo non riuscito",
      focus:
        "Il rinnovo non è stato pagato: di nuovo Free subito, con la data entro cui regolarizzare per mantenere il prezzo.",
    },
    en: {
      name: "Renewal failed",
      focus:
        "The renewal was not paid: back on Free right away, with the date by which to pay to keep the price.",
    },
  },
  "pagamento-rimborsato": {
    it: {
      name: "Pagamento rimborsato",
      focus:
        "Il periodo in corso è stato rimborsato: di nuovo Free subito e Premium riprende con il rinnovo, senza prova né secondo acquisto.",
    },
    en: {
      name: "Payment refunded",
      focus:
        "The current period was refunded: back on Free right away and Premium resumes with the renewal, with no trial or second purchase.",
    },
  },
  "lifetime-rimborsato": {
    it: {
      name: "Lifetime rimborsato",
      focus:
        "Il pagamento di Premium a vita è stato rimborsato: di nuovo Free, il posto resta occupato e mensile e annuale restano in vendita.",
    },
    en: {
      name: "Lifetime refunded",
      focus:
        "The lifetime Premium payment was refunded: back on Free, the place stays taken and monthly and annual remain on sale.",
    },
  },
  "stripe-non-disponibile": {
    it: {
      name: "Stripe non disponibile",
      focus:
        "Stripe non risponde: l'acquisto non parte e lo dice, il resto del piano resta utilizzabile.",
    },
    en: {
      name: "Stripe unavailable",
      focus:
        "Stripe is not responding: the purchase does not start and says so, the rest of the plan still works.",
    },
  },
  "lifetime-esaurito": {
    it: {
      name: "Lifetime esaurito",
      focus:
        "I venti posti a vita sono finiti: il lifetime resta visibile come esaurito, mensile e annuale restano in vendita.",
    },
    en: {
      name: "Lifetime sold out",
      focus:
        "All twenty lifetime places are taken: lifetime stays visible as sold out, monthly and annual remain on sale.",
    },
  },
  "premium-a-vita-concesso": {
    it: {
      name: "Premium a vita concesso",
      focus:
        "Lifetime in omaggio da FiscalBay: nessun rinnovo, nessun acquisto né documenti su Stripe.",
    },
    en: {
      name: "Lifetime Premium granted",
      focus: "Lifetime granted by FiscalBay: no renewals, no purchase and no documents on Stripe.",
    },
  },
  premium: {
    it: {
      name: "Premium, più negozi",
      focus: "Tre negozi, notifiche Telegram, XLSX. Il primo salvataggio automatico fallisce.",
    },
    en: {
      name: "Premium, several stores",
      focus: "Three stores, Telegram notifications, XLSX. The first autosave fails.",
    },
  },
  "telegram-bloccato": {
    it: {
      name: "Bot Telegram bloccato",
      focus:
        "Il bot è bloccato nella chat collegata: le notifiche sono ferme finché la chat non scrive di nuovo al bot.",
    },
    en: {
      name: "Telegram bot blocked",
      focus:
        "The bot is blocked in the linked chat: notifications are stopped until the chat writes to the bot again.",
    },
  },
  "telegram-non-consegnato": {
    it: {
      name: "Notifiche Telegram non consegnate",
      focus:
        "Telegram non ha accettato alcuni messaggi dopo diversi tentativi: l'avviso resta fino al prossimo invio riuscito.",
    },
    en: {
      name: "Telegram notifications not delivered",
      focus:
        "Telegram did not accept some messages after several attempts: the notice stays until the next successful delivery.",
    },
  },
  "cambio-rinnovo": {
    it: {
      name: "Cambio di rinnovo",
      focus:
        "Premium mensile che passa all'annuale al rinnovo, senza conguaglio; un solo negozio, che scollegato non disdice l'abbonamento.",
    },
    en: {
      name: "Renewal change",
      focus:
        "Monthly Premium switching to annual at renewal, with no proration; a single store, which does not cancel the subscription when disconnected.",
    },
  },
  "rinnovo-disdetto": {
    it: {
      name: "Rinnovo disdetto",
      focus:
        "Premium mensile disdetto: resta attivo fino alla fine del periodo pagato, senza rinnovo.",
    },
    en: {
      name: "Renewal cancelled",
      focus:
        "Monthly Premium cancelled: it stays active until the end of the paid period, with no renewal.",
    },
  },
  "passaggio-a-vita": {
    it: {
      name: "Passaggio a vita in conferma",
      focus:
        "Premium mensile con il lifetime pagato e in attesa della conferma di Stripe: l'abbonamento resta finché il pagamento non è confermato, senza un secondo acquisto.",
    },
    en: {
      name: "Lifetime switch being confirmed",
      focus:
        "Monthly Premium with lifetime paid and awaiting Stripe's confirmation: the subscription stays until the payment is confirmed, with no second purchase.",
    },
  },
  "premium-concesso": {
    it: {
      name: "Premium concesso",
      focus:
        "Premium concesso da FiscalBay senza abbonamento: la data di fine e il passaggio a vita, senza gestione su Stripe.",
    },
    en: {
      name: "Premium granted",
      focus:
        "Premium granted by FiscalBay with no subscription: the end date and the switch to lifetime, with no Stripe management.",
    },
  },
  "premium-a-vita": {
    it: {
      name: "Premium a vita",
      focus:
        "Acquisto una tantum senza rinnovi, negozio messo in pausa dall'utente, Codice Fiscale con carattere di controllo errato.",
    },
    en: {
      name: "Premium, lifetime",
      focus:
        "One-off purchase with no renewals, a store paused by the user, a tax code with a wrong check character.",
    },
  },
};
