import type { Language } from "../i18n";

/**
 * Testi delle pagine del sito pubblico. Restano sul server: i loader li consegnano già
 * risolti alla pagina, così il JavaScript dell'app e del sito non li scarica. Barra e footer
 * usano i testi comuni dell'interfaccia.
 */
const it = {
  home: {
    title: "Recupera il Codice Fiscale dagli ordini eBay",
    description:
      "Recupera e gestisci il Codice Fiscale dei tuoi ordini eBay, quando disponibile su eBay, con sincronizzazione automatica, export e notifiche.",
    hero: "Trova e gestisci il Codice Fiscale dei tuoi ordini eBay.",
    body: "Colleghi il tuo negozio eBay e FiscalBay riporta il Codice Fiscale dell’acquirente, quando disponibile su eBay, pronto da copiare ed esportare. Anche la Partita IVA, se c’è.",
    howItWorks: "Come funziona",
    trust: [
      "API ufficiali eBay",
      "Pagamenti sicuri gestiti da Stripe",
      "Nessuna carta per iniziare",
    ],
    steps: [
      {
        title: "Collega eBay",
        body: "Accedi a eBay e autorizzi FiscalBay a leggere i tuoi ordini.",
      },
      {
        title: "FiscalBay legge gli ordini",
        body: "Importa gli ordini recenti, poi legge da solo i nuovi e individua il Codice Fiscale, quando disponibile su eBay.",
      },
      {
        title: "Consulta, copia ed esporta",
        body: "Copi il dato con un clic ed esporti gli ordini. Con Premium ricevi anche le notifiche su Telegram.",
      },
    ],
    showcaseTitle: "Dentro FiscalBay",
    highlights: [
      {
        shot: "scheda",
        title: "Il Codice Fiscale nella scheda dell’ordine",
        body: "Ogni ordine mostra acquirente, indirizzo di fatturazione e Codice Fiscale, quando disponibile su eBay, pronto da copiare con un clic. Se c’è, anche la Partita IVA.",
        premium: false,
      },
      {
        shot: "telegram",
        title: "Ogni nuovo ordine su Telegram",
        body: "Il bot ti scrive appena arriva un ordine, con il Codice Fiscale da copiare direttamente dal messaggio.",
        premium: true,
      },
      {
        shot: "esportazione",
        title: "Un file pronto per la fatturazione",
        body: "Ordini, acquirenti e dati fiscali in CSV o XLSX, da importare nel gestionale o nel software di fatturazione.",
        premium: false,
      },
      {
        shot: "negozi",
        title: "Tutti i tuoi negozi eBay",
        body: "Colleghi più negozi e li tieni aggiornati insieme: per ognuno vedi collegamento, ultima lettura e ordini importati.",
        premium: true,
      },
    ],
    premium: "Premium",
    plansTitle: "Piani",
    freePlan: "Free",
    freePrice: "0 €",
    premiumPlan: "Premium",
    premiumPrice: (monthly: string, annual: string) =>
      `${monthly} + IVA al mese o ${annual} + IVA all’anno`,
    premiumBody:
      "Ordini da sbloccare senza limite per ciclo, più negozi, un anno di storico, XLSX e notifiche Telegram. Prova di 14 giorni senza carta.",
    faqTitle: "Domande frequenti",
    faqLink: "Tutte le domande",
    allFeatures: "Tutte le funzionalità",
    pricingLink: "Vedi i prezzi",
    closing: "Prova FiscalBay con il tuo negozio eBay.",
    freeQuota: (base: number) => `Con il piano Free sblocchi ${base} ordini ogni 7 giorni.`,
    freePromotion: (quota: number, date: string, base: number) =>
      `Promozione Free: ${quota} ordini da sbloccare ogni 7 giorni nei cicli che iniziano entro il ${date}, poi ${base}.`,
  },
  features: {
    title: "Funzionalità",
    description:
      "Codice Fiscale e Partita IVA dagli ordini eBay, sincronizzazione automatica, ricerca, export CSV e XLSX, notifiche Telegram e più negozi.",
    lead: "Il Codice Fiscale dei tuoi ordini eBay a portata di mano, dal collegamento del negozio all’export.",
    premium: "Premium",
    showcase: [
      {
        shot: "scheda",
        title: "Codice Fiscale e Partita IVA",
        body: "FiscalBay mostra il Codice Fiscale indicato dall’acquirente, quando disponibile su eBay, e la Partita IVA se c’è. Lo copi con un clic, senza spazi e in maiuscolo; quando manca, un modello di messaggio ti aiuta a chiederlo.",
        premium: false,
      },
      {
        shot: "ordini",
        title: "Ordini in un solo elenco",
        body: "Gli ordini dei tuoi negozi insieme, con ricerca per ordine, acquirente, articolo, SKU o Codice Fiscale e filtri per negozio, periodo, pagamento, spedizione e dato fiscale.",
        premium: false,
      },
      {
        shot: "esportazione",
        title: "Export CSV e XLSX",
        body: "Esporti gli ordini in CSV, una riga per ordine o per articolo, pronti per il gestionale o il software di fatturazione. Con Premium anche in XLSX, con le colonne che scegli e le configurazioni salvate.",
        premium: false,
      },
      {
        shot: "telegram",
        title: "Notifiche Telegram",
        body: "Ricevi su Telegram i nuovi ordini con il dato fiscale, oppure un riepilogo, e copi il Codice Fiscale dal messaggio.",
        premium: true,
      },
      {
        shot: "negozi",
        title: "Più negozi e un anno di storico",
        body: "Il piano Free ha un negozio attivo, sostituibile ogni 90 giorni, e gli ultimi 30 giorni di ordini. Premium collega più negozi e conserva un anno di storico.",
        premium: true,
      },
    ],
    items: [
      {
        title: "Sincronizzazione automatica",
        body: "Al collegamento importa gli ordini recenti, poi legge da solo i nuovi ordini e gli aggiornamenti, anche quando non sei collegato.",
        premium: false,
      },
      {
        title: "Suggerimenti dagli ordini precedenti",
        body: "Se un acquirente ha già comprato da te, FiscalBay propone il dato fiscale dei suoi ordini precedenti, separato da quello dell’ordine.",
        premium: true,
      },
    ],
    security: "Sola lettura su eBay, token cifrati e dati conservati nell’Unione Europea.",
    securityLink: "Come proteggiamo i dati",
  },

  pricing: {
    title: "Prezzi",
    description:
      "Piano Free gratuito e Premium mensile, annuale o a vita per recuperare il Codice Fiscale dagli ordini eBay. Prova Premium di 14 giorni senza carta.",
    lead: "Inizia gratis. Passa a Premium quando ti servono più ordini, più negozi e più storico.",
    free: "Free",
    freePrice: "0 €",
    freeItems: (quota: number) => [
      `${quota} ordini da sbloccare ogni 7 giorni`,
      "Un negozio eBay attivo",
      "Ultimi 30 giorni di ordini",
      "Export CSV",
    ],
    premium: "Premium",
    premiumItems: [
      "Ordini da sbloccare senza limite per ciclo",
      "Più negozi eBay attivi",
      "Un anno di storico",
      "XLSX e notifiche Telegram",
    ],
    offers: {
      monthly: { name: "Mensile", period: "al mese", note: "Si rinnova ogni mese." },
      annual: {
        name: "Annuale",
        period: "all’anno",
        note: (months: number) => `12 mesi al prezzo di ${months}.`,
      },
      lifetime: { name: "A vita", period: "una tantum", note: "Pagamento unico, senza rinnovi." },
    },
    best: "Più conveniente",
    vat: "+ IVA",
    soldOut: "Esaurito",
    soldOutBody: "I posti a vita sono finiti.",
    signUp: "Crea un account",
    openPlan: "Apri il piano",
    trialTitle: "Prova Premium per 14 giorni",
    trialBody:
      "Senza carta e senza rinnovo automatico. La attivi quando vuoi dopo la prima lettura riuscita di un negozio; alla fine torni al Free e gli ordini sbloccati restano tali.",
    purchaseNote: "Premium si acquista dall’app, dopo la prima lettura riuscita di un negozio.",
    closed: "I nuovi acquisti di Premium e le prove sono sospesi per ora.",
    taxNote:
      "Prezzi IVA esclusa. Stripe gestisce il pagamento e calcola le imposte del tuo paese e il totale, anche nella tua valuta, prima di pagare. Ricevute e fatture arrivano da Stripe.",
    compare: "Confronto dei piani",
    feature: "Funzione",
    included: "Incluso",
    notIncluded: "Non incluso",
    rows: {
      stores: {
        label: "Negozi eBay attivi",
        free: "1, sostituibile ogni 90 giorni",
        premium: "Più negozi",
      },
      history: { label: "Storico degli ordini", free: "Ultimi 30 giorni", premium: "Un anno" },
      unlocks: {
        label: "Ordini da sbloccare",
        free: (quota: number) => `${quota} ogni 7 giorni`,
        premium: "Senza limite per ciclo",
      },
      browse: "Consultazione, ricerca e filtri",
      csv: "Export CSV",
      xlsx: "XLSX, colonne a scelta e configurazioni",
      suggestions: "Suggerimenti dagli ordini precedenti",
      telegram: "Notifiche Telegram",
      support: "Assistenza",
    },
  },
  security: {
    title: "Sicurezza",
    description:
      "Come FiscalBay protegge l’accesso al tuo negozio eBay e i dati dei tuoi ordini: sola lettura, token cifrati e dati nell’Unione Europea.",
    lead: "FiscalBay legge i tuoi ordini e non li modifica. Ecco come proteggiamo l’accesso e i dati.",
    summaryTitle: "In breve",
    summary: [
      {
        title: "Solo lettura",
        body: "FiscalBay chiede a eBay soltanto di leggere gli ordini e l’identità del negozio.",
      },
      {
        title: "Dati nell’Unione Europea",
        body: "Database e file esportati restano su server Cloudflare nell’Unione Europea.",
      },
      {
        title: "Accesso protetto",
        body: "Passkey, Google, eBay o password, con le sessioni attive sotto il tuo controllo.",
      },
      {
        title: "Pagamenti con Stripe",
        body: "I dati della carta restano a Stripe: FiscalBay non li vede.",
      },
    ],
    detailsTitle: "Nel dettaglio",
    details: [
      {
        title: "Collegamento a eBay",
        body: "Colleghi il negozio dalla pagina di autorizzazione di eBay, senza dare la tua password a FiscalBay. I permessi sono di sola lettura: FiscalBay non modifica ordini, annunci o messaggi. I token di accesso sono conservati cifrati e puoi revocarli scollegando il negozio o dal tuo account eBay.",
      },
      {
        title: "Chi vede i tuoi dati",
        body: "Ogni account vede soltanto i propri negozi e i propri ordini: ogni pagina, ricerca ed export ricontrolla sul server permessi e piano. Una ricerca per Codice Fiscale non finisce nell’indirizzo della pagina. I file esportati si scaricano soltanto dal tuo account e scadono entro 24 ore.",
      },
      {
        title: "Quanto conserviamo",
        body: "Gli ordini restano consultabili nella finestra del tuo piano: 30 giorni con Free, un anno con Premium. Quando elimini un negozio o l’account, i suoi dati vengono cancellati.",
      },
      {
        title: "Accesso all’account",
        body: "Accedi con passkey, Google, eBay oppure email e password, con l’indirizzo email confermato. In Impostazioni, Sicurezza, vedi le sessioni attive e chiudi quelle che non riconosci.",
      },
    ],
    notTitle: "Cosa non facciamo",
    not: [
      "Non modifichiamo nulla sul tuo account eBay.",
      "Non ti chiediamo la password di eBay.",
      "Non vendiamo i dati e non li usiamo per pubblicità.",
      "Non usiamo i dati di eBay o degli acquirenti per addestrare intelligenze artificiali.",
    ],
    reportTitle: "Segnala un problema di sicurezza",
    report: "Hai trovato una vulnerabilità? Scrivi a",
  },
  faq: {
    title: "Domande frequenti",
    description:
      "Risposte su FiscalBay: Codice Fiscale e Partita IVA dagli ordini eBay, piani, prova Premium, pagamenti, permessi e dati.",
    items: [
      {
        q: "Cos’è FiscalBay?",
        a: "Un servizio web che legge i tuoi ordini eBay e ti mostra il Codice Fiscale dell’acquirente, quando disponibile su eBay, pronto da copiare ed esportare.",
      },
      {
        q: "eBay riporta sempre il Codice Fiscale?",
        a: "No. FiscalBay mostra il dato soltanto quando l’acquirente lo ha indicato ed eBay lo rende disponibile. Ordini senza dato non consumano sblocchi.",
      },
      {
        q: "FiscalBay mostra anche la Partita IVA?",
        a: "Sì: se l’acquirente indica una Partita IVA, la trovi accanto al Codice Fiscale o al suo posto.",
      },
      {
        q: "FiscalBay emette la fattura elettronica?",
        a: "No. FiscalBay ti dà i dati fiscali dell’acquirente da usare nel tuo gestionale o nel software di fatturazione, anche con l’export.",
      },
      {
        q: "Serve una carta per iniziare?",
        a: "No. Il piano Free è gratuito e la prova Premium di 14 giorni non chiede una carta.",
      },
      {
        q: "Cosa succede alla fine della prova?",
        a: "Torni al Free senza addebiti. Gli ordini con il dato arrivato durante la prova restano sbloccati.",
      },
      {
        q: "Come si paga Premium?",
        a: "Con Stripe, che gestisce pagamento, imposte, ricevute e fatture. Disdici quando vuoi da Stripe: Premium resta attivo fino alla fine del periodo pagato.",
      },
      {
        q: "Cos’è il piano a vita?",
        a: "Premium con un pagamento unico, senza rinnovi. I posti sono venti in tutto.",
      },
      {
        q: "Posso collegare più negozi eBay?",
        a: "Con Free hai un negozio attivo, sostituibile ogni 90 giorni. Con Premium colleghi più negozi.",
      },
      {
        q: "Quali permessi chiede FiscalBay su eBay?",
        a: "Soltanto la lettura degli ordini e dell’identità del negozio. FiscalBay non modifica nulla sul tuo account eBay.",
      },
      {
        q: "Dove sono conservati i dati?",
        a: "Su server Cloudflare nell’Unione Europea. Quando elimini un negozio o l’account, i suoi dati vengono cancellati.",
      },
    ],
    more: "Non trovi la risposta?",
    support: "Vai al Supporto",
  },
  /** Testi alternativi delle schermate del prodotto, una per immagine. */
  shots: {
    ordini: "Elenco Ordini di FiscalBay con filtri, Codice Fiscale e Partita IVA degli acquirenti",
    scheda: "Scheda di un ordine eBay con acquirente, indirizzo e Codice Fiscale da copiare",
    esportazione: "File degli ordini esportato da FiscalBay con Codice Fiscale e Partita IVA",
    telegram: "Messaggio del bot Telegram di FiscalBay per un nuovo ordine con il Codice Fiscale",
    negozi: "Negozi eBay collegati a FiscalBay con stato, ultima lettura e ordini importati",
    sicurezza: "Metodi di accesso e sessioni attive nelle Impostazioni di FiscalBay",
  },
  legal: {
    description: {
      termini: "Termini di servizio di FiscalBay.",
      privacy: "Informativa privacy di FiscalBay.",
    },
    /** L'operatore compare soltanto qui, senza nome della persona, sede o P.IVA (D204). */
    operator: {
      termini: {
        title: "Chi gestisce FiscalBay",
        body: "FiscalBay è un servizio di Temisfera. Per domande su questi termini scrivi a",
      },
      privacy: {
        title: "Titolare del trattamento",
        body: "Il titolare del trattamento è Temisfera, che gestisce FiscalBay. Per domande sulla privacy o per esercitare i tuoi diritti scrivi a",
      },
    },
  },
};

type SitePagesCopy = typeof it;

const en: SitePagesCopy = {
  home: {
    title: "Get the Codice Fiscale from your eBay orders",
    description:
      "Get and manage the Codice Fiscale of your eBay orders, when eBay provides it, with automatic sync, export and notifications.",
    hero: "Find and manage the Codice Fiscale of your eBay orders.",
    body: "Connect your eBay store and FiscalBay shows the buyer’s Codice Fiscale, when eBay provides it, ready to copy and export. The Partita IVA too, when there is one.",
    howItWorks: "How it works",
    trust: ["Official eBay APIs", "Secure payments handled by Stripe", "No card to get started"],
    steps: [
      {
        title: "Connect eBay",
        body: "Sign in to eBay and allow FiscalBay to read your orders.",
      },
      {
        title: "FiscalBay reads your orders",
        body: "It imports your recent orders, then reads new ones on its own and finds the Codice Fiscale, when eBay provides it.",
      },
      {
        title: "Browse, copy and export",
        body: "Copy the identifier in one click and export your orders. With Premium you also get notifications on Telegram.",
      },
    ],
    showcaseTitle: "Inside FiscalBay",
    highlights: [
      {
        shot: "scheda",
        title: "The Codice Fiscale on the order card",
        body: "Every order shows the buyer, billing address and Codice Fiscale, when eBay provides it, ready to copy in one click. The Partita IVA too, when there is one.",
        premium: false,
      },
      {
        shot: "telegram",
        title: "Every new order on Telegram",
        body: "The bot writes to you as soon as an order arrives, with the Codice Fiscale to copy straight from the message.",
        premium: true,
      },
      {
        shot: "esportazione",
        title: "A file ready for invoicing",
        body: "Orders, buyers and tax identifiers as CSV or XLSX, to import into your management or invoicing software.",
        premium: false,
      },
      {
        shot: "negozi",
        title: "All your eBay stores",
        body: "Connect several stores and keep them up to date together: for each one you see the connection, last read and imported orders.",
        premium: true,
      },
    ],
    premium: "Premium",
    plansTitle: "Plans",
    freePlan: "Free",
    freePrice: "€0",
    premiumPlan: "Premium",
    premiumPrice: (monthly, annual) => `${monthly} + VAT per month or ${annual} + VAT per year`,
    premiumBody:
      "Unlimited orders to unlock per cycle, more stores, one year of history, XLSX and Telegram notifications. 14-day trial with no card.",
    faqTitle: "Frequently asked questions",
    faqLink: "All questions",
    allFeatures: "All features",
    pricingLink: "See pricing",
    closing: "Try FiscalBay with your eBay store.",
    freeQuota: (base) => `On the Free plan you unlock ${base} orders every 7 days.`,
    freePromotion: (quota, date, base) =>
      `Free promotion: ${quota} orders to unlock every 7 days in cycles starting by ${date}, then ${base}.`,
  },
  features: {
    title: "Features",
    description:
      "Codice Fiscale and Partita IVA from your eBay orders, automatic sync, search, CSV and XLSX export, Telegram notifications and multiple stores.",
    lead: "The Codice Fiscale of your eBay orders at hand, from connecting your store to exporting.",
    premium: "Premium",
    showcase: [
      {
        shot: "scheda",
        title: "Codice Fiscale and Partita IVA",
        body: "FiscalBay shows the Codice Fiscale the buyer entered, when eBay provides it, and the Partita IVA when there is one. Copy it in one click, without spaces and in capitals; when it is missing, a message template helps you ask for it.",
        premium: false,
      },
      {
        shot: "ordini",
        title: "All orders in one list",
        body: "Orders from all your stores together, with search by order, buyer, item, SKU or Codice Fiscale and filters by store, period, payment, shipping and tax identifier.",
        premium: false,
      },
      {
        shot: "esportazione",
        title: "CSV and XLSX export",
        body: "Export your orders as CSV, one row per order or per item, ready for your management or invoicing software. With Premium as XLSX too, with the columns you choose and saved configurations.",
        premium: false,
      },
      {
        shot: "telegram",
        title: "Telegram notifications",
        body: "Get new orders with their tax identifier on Telegram, or a digest, and copy the Codice Fiscale from the message.",
        premium: true,
      },
      {
        shot: "negozi",
        title: "More stores and a year of history",
        body: "The Free plan has one active store, replaceable every 90 days, and the last 30 days of orders. Premium connects more stores and keeps a year of history.",
        premium: true,
      },
    ],
    items: [
      {
        title: "Automatic sync",
        body: "When you connect, it imports your recent orders, then reads new orders and updates on its own, even when you are not signed in.",
        premium: false,
      },
      {
        title: "Suggestions from earlier orders",
        body: "When a buyer has already bought from you, FiscalBay suggests the tax identifier from their earlier orders, kept apart from the order’s own.",
        premium: true,
      },
    ],
    security: "Read-only access to eBay, encrypted tokens and data stored in the European Union.",
    securityLink: "How we protect your data",
  },

  pricing: {
    title: "Pricing",
    description:
      "Free plan at no cost and Premium monthly, annual or lifetime to get the Codice Fiscale from your eBay orders. 14-day Premium trial with no card.",
    lead: "Start for free. Move to Premium when you need more orders, more stores and more history.",
    free: "Free",
    freePrice: "€0",
    freeItems: (quota) => [
      `${quota} orders to unlock every 7 days`,
      "One active eBay store",
      "Last 30 days of orders",
      "CSV export",
    ],
    premium: "Premium",
    premiumItems: [
      "Unlimited orders to unlock per cycle",
      "More active eBay stores",
      "One year of history",
      "XLSX and Telegram notifications",
    ],
    offers: {
      monthly: { name: "Monthly", period: "per month", note: "Renews every month." },
      annual: {
        name: "Annual",
        period: "per year",
        note: (months) => `12 months for the price of ${months}.`,
      },
      lifetime: { name: "Lifetime", period: "one-off", note: "One payment, no renewals." },
    },
    best: "Best value",
    vat: "+ VAT",
    soldOut: "Sold out",
    soldOutBody: "Lifetime places have run out.",
    signUp: "Create an account",
    openPlan: "Open your plan",
    trialTitle: "Try Premium for 14 days",
    trialBody:
      "No card and no automatic renewal. Start it whenever you like after a store’s first successful read; at the end you go back to Free and unlocked orders stay unlocked.",
    purchaseNote: "Premium is bought in the app, after a store’s first successful read.",
    closed: "New Premium purchases and trials are paused for now.",
    taxNote:
      "Prices exclude VAT. Stripe handles payment and works out your country’s taxes and the total, in your currency too, before you pay. Receipts and invoices come from Stripe.",
    compare: "Compare plans",
    feature: "Feature",
    included: "Included",
    notIncluded: "Not included",
    rows: {
      stores: {
        label: "Active eBay stores",
        free: "1, replaceable every 90 days",
        premium: "More stores",
      },
      history: { label: "Order history", free: "Last 30 days", premium: "One year" },
      unlocks: {
        label: "Orders to unlock",
        free: (quota) => `${quota} every 7 days`,
        premium: "Unlimited per cycle",
      },
      browse: "Browsing, search and filters",
      csv: "CSV export",
      xlsx: "XLSX, chosen columns and configurations",
      suggestions: "Suggestions from earlier orders",
      telegram: "Telegram notifications",
      support: "Support",
    },
  },
  security: {
    title: "Security",
    description:
      "How FiscalBay protects access to your eBay store and your order data: read-only access, encrypted tokens and data in the European Union.",
    lead: "FiscalBay reads your orders and never changes them. Here is how we protect access and data.",
    summaryTitle: "In short",
    summary: [
      {
        title: "Read-only",
        body: "FiscalBay only asks eBay to read your orders and your store’s identity.",
      },
      {
        title: "Data in the European Union",
        body: "The database and exported files stay on Cloudflare servers in the European Union.",
      },
      {
        title: "Protected sign-in",
        body: "Passkey, Google, eBay or password, with active sessions under your control.",
      },
      {
        title: "Payments with Stripe",
        body: "Card details stay with Stripe: FiscalBay never sees them.",
      },
    ],
    detailsTitle: "In detail",
    details: [
      {
        title: "Connecting to eBay",
        body: "You connect your store from eBay’s authorisation page, without giving your password to FiscalBay. Permissions are read-only: FiscalBay does not change orders, listings or messages. Access tokens are stored encrypted, and you can revoke them by disconnecting the store or from your eBay account.",
      },
      {
        title: "Who sees your data",
        body: "Each account only sees its own stores and orders: every page, search and export checks permissions and plan again on the server. A search by Codice Fiscale never ends up in the page address. Exported files can only be downloaded from your account and expire within 24 hours.",
      },
      {
        title: "How long we keep data",
        body: "Orders stay available within your plan’s window: 30 days on Free, one year on Premium. When you delete a store or your account, its data is erased.",
      },
      {
        title: "Signing in",
        body: "Sign in with a passkey, Google, eBay or email and password, with a confirmed email address. In Settings, Security, you see your active sessions and close the ones you do not recognise.",
      },
    ],
    notTitle: "What we don’t do",
    not: [
      "We don’t change anything on your eBay account.",
      "We don’t ask for your eBay password.",
      "We don’t sell data or use it for advertising.",
      "We don’t use eBay or buyer data to train artificial intelligence.",
    ],
    reportTitle: "Report a security issue",
    report: "Found a vulnerability? Write to",
  },
  faq: {
    title: "Frequently asked questions",
    description:
      "Answers about FiscalBay: Codice Fiscale and Partita IVA from eBay orders, plans, the Premium trial, payments, permissions and data.",
    items: [
      {
        q: "What is FiscalBay?",
        a: "A web service that reads your eBay orders and shows you the buyer’s Codice Fiscale, when eBay provides it, ready to copy and export.",
      },
      {
        q: "Does eBay always provide the Codice Fiscale?",
        a: "No. FiscalBay shows it only when the buyer entered it and eBay makes it available. Orders without it do not use up unlocks.",
      },
      {
        q: "Does FiscalBay show the Partita IVA too?",
        a: "Yes: when the buyer enters a Partita IVA, you find it next to the Codice Fiscale or in its place.",
      },
      {
        q: "Does FiscalBay issue e-invoices?",
        a: "No. FiscalBay gives you the buyer’s tax details to use in your management or invoicing software, including through export.",
      },
      {
        q: "Do I need a card to get started?",
        a: "No. The Free plan costs nothing and the 14-day Premium trial does not ask for a card.",
      },
      {
        q: "What happens when the trial ends?",
        a: "You go back to Free with no charge. Orders whose identifier arrived during the trial stay unlocked.",
      },
      {
        q: "How do I pay for Premium?",
        a: "With Stripe, which handles payment, taxes, receipts and invoices. Cancel whenever you like from Stripe: Premium stays active until the end of the paid period.",
      },
      {
        q: "What is the lifetime plan?",
        a: "Premium with a single payment and no renewals. There are twenty places in total.",
      },
      {
        q: "Can I connect more than one eBay store?",
        a: "On Free you have one active store, replaceable every 90 days. With Premium you connect more stores.",
      },
      {
        q: "Which permissions does FiscalBay ask for on eBay?",
        a: "Only reading your orders and your store’s identity. FiscalBay never changes anything on your eBay account.",
      },
      {
        q: "Where is the data stored?",
        a: "On Cloudflare servers in the European Union. When you delete a store or your account, its data is erased.",
      },
    ],
    more: "Can’t find the answer?",
    support: "Go to Support",
  },
  shots: {
    ordini: "FiscalBay order list with filters and the buyers’ Codice Fiscale and Partita IVA",
    scheda: "eBay order card with buyer, address and the Codice Fiscale to copy",
    esportazione: "Order file exported from FiscalBay with Codice Fiscale and Partita IVA",
    telegram: "FiscalBay Telegram bot message for a new order with the Codice Fiscale",
    negozi: "eBay stores connected to FiscalBay with status, last read and imported orders",
    sicurezza: "Sign-in methods and active sessions in FiscalBay Settings",
  },
  legal: {
    description: {
      termini: "FiscalBay terms of service.",
      privacy: "FiscalBay privacy policy.",
    },
    operator: {
      termini: {
        title: "Who runs FiscalBay",
        body: "FiscalBay is a service by Temisfera. For questions about these terms, write to",
      },
      privacy: {
        title: "Data controller",
        body: "The data controller is Temisfera, which runs FiscalBay. For privacy questions or to exercise your rights, write to",
      },
    },
  },
};

export const sitePages: Record<Language, SitePagesCopy> = { it, en };
