import type { GuidePath } from "../app-links";
import type { Language } from "../i18n";

/** Paragrafi di una parte della guida, sotto il proprio titolo. */
export interface GuideSection {
  title: string;
  body: readonly string[];
}

export interface Guide {
  title: string;
  description: string;
  lead: string;
  /** Prima pubblicazione e ultima modifica sostanziale, per i dati strutturati e la sitemap. */
  published: string;
  updated: string;
  sections: readonly GuideSection[];
  /** Funzione di FiscalBay di cui parla la guida, nella pagina Funzionalità. */
  feature: { shot: "scheda" | "esportazione" | "telegram"; label: string };
}

/**
 * Guide del sito pubblico (§23): articoli stabili sulle domande ricorrenti dei venditori, non
 * notizie. Ogni affermazione resta nei limiti di ciò che FiscalBay fa e di ciò che eBay rende
 * disponibile; le regole fiscali rimandano al commercialista. Restano sul server come gli altri
 * testi del sito.
 */
export const guides: Record<
  Language,
  {
    index: { title: string; metaTitle: string; description: string; lead: string };
    start: string;
    back: string;
    updated: (date: string) => string;
    articles: Record<GuidePath, Guide>;
  }
> = {
  it: {
    index: {
      title: "Guide",
      metaTitle: "Guide al Codice Fiscale negli ordini eBay",
      description:
        "Guide pratiche per i venditori eBay: dove trovare il Codice Fiscale dell’acquirente e come usarlo per la fattura elettronica.",
      lead: "Risposte pratiche alle domande dei venditori eBay sul Codice Fiscale degli acquirenti.",
    },
    start: "Inizia gratis",
    back: "Tutte le guide",
    updated: (date) => `Aggiornata il ${date}`,
    articles: {
      "/guide/trovare-codice-fiscale-ordini-ebay": {
        title: "Dove trovo il Codice Fiscale dell’acquirente su eBay",
        description:
          "Dove si trova il Codice Fiscale dell’acquirente negli ordini eBay, perché non compare nei dettagli di spedizione e cosa fare quando manca.",
        lead: "Il Codice Fiscale dell’acquirente non si vede tra i dati di spedizione di eBay e non c’è in ogni ordine. Ecco dove si trova, come chiederlo al pagamento e cosa fare quando manca.",
        published: "2026-11-03",
        updated: "2026-11-04",
        feature: { shot: "scheda", label: "Il Codice Fiscale nella scheda dell’ordine" },
        sections: [
          {
            title: "Perché non lo vedi nell’ordine",
            body: [
              "Il Codice Fiscale non compare nei dettagli di spedizione dell’ordine né tra le 50 colonne che eBay.it documenta per il report degli ordini scaricabile da Seller Hub.",
              "Quando l’acquirente lo indica, eBay lo conserva nei dati dell’ordine e lo rende disponibile attraverso le API ufficiali degli ordini, che uno strumento collegato al tuo negozio può leggere.",
            ],
          },
          {
            title: "Come chiederlo al pagamento",
            body: [
              "Nelle Preferenze di vendita di eBay, nella sezione Acquirenti, puoi attivare la voce che chiede agli acquirenti di indicare il numero di identificazione fiscale nel modulo di pagamento. Anche con la voce attiva, nella Community di eBay i venditori raccontano ordini arrivati senza il dato, o con il dato che non riescono a trovare.",
            ],
          },
          {
            title: "Perché a volte manca",
            body: [
              "Non tutti gli ordini lo contengono: in un negozio reale il dato c’era in 65 ordini su 104. Un ordine nato senza Codice Fiscale resta senza.",
              "Oltre i 90 giorni eBay maschera i dati personali dell’acquirente negli ordini. Conviene quindi salvare il dato quando l’ordine è recente.",
            ],
          },
          {
            title: "Quando chiederlo all’acquirente",
            body: [
              "Se il dato manca e ti serve, chiedilo all’acquirente con un messaggio che indichi il numero dell’ordine. FiscalBay prepara un modello da copiare e inviare.",
            ],
          },
          {
            title: "Un controllo prima di usarlo",
            body: [
              "Il Codice Fiscale di una persona ha 16 caratteri e l’ultimo è un carattere di controllo. Un controllo formale ne verifica la struttura, non che appartenga davvero all’acquirente.",
            ],
          },
          {
            title: "Con FiscalBay",
            body: [
              "FiscalBay legge gli ordini dei negozi che colleghi e riporta il Codice Fiscale quando eBay lo rende disponibile, pronto da copiare ed esportare. Con Premium lo ricevi anche su Telegram appena arriva un ordine.",
            ],
          },
        ],
      },
      "/guide/codice-fiscale-non-visibile-ordine-ebay": {
        title: "Ho chiesto il Codice Fiscale al pagamento: perché non lo vedo nell’ordine",
        description:
          "L’acquirente dice di aver già inserito il Codice Fiscale nell’ordine eBay ma tu non lo vedi: dove finisce il dato e come leggerlo.",
        lead: "«L’avevo già inserito nell’ordine» è una risposta frequente degli acquirenti. Ha ragione: il dato c’è, ma eBay non lo mostra dove lo cerchi.",
        published: "2026-11-04",
        updated: "2026-11-04",
        feature: { shot: "telegram", label: "Ogni nuovo ordine su Telegram" },
        sections: [
          {
            title: "Il dato inserito c’è",
            body: [
              "Quando l’acquirente indica il Codice Fiscale nel modulo di pagamento, eBay lo salva con l’ordine. Non compare però nei dettagli di spedizione né nel report degli ordini che scarichi da eBay.it.",
            ],
          },
          {
            title: "Dove si legge",
            body: [
              "eBay lo rende disponibile attraverso le API ufficiali degli ordini, le stesse che usano gli strumenti per i venditori. Per leggerlo serve un servizio collegato al tuo negozio con il tuo consenso, in sola lettura.",
            ],
          },
          {
            title: "Prima di chiederlo di nuovo",
            body: [
              "Chiedere di nuovo un dato già fornito disorienta l’acquirente e rischia di restare senza risposta. Controlla prima se l’ordine lo contiene: ti eviti un messaggio e l’attesa.",
            ],
          },
          {
            title: "Con FiscalBay",
            body: [
              "FiscalBay legge gli ordini con le API ufficiali di eBay e mostra il Codice Fiscale quando eBay lo rende disponibile, pronto da copiare. Con Premium ti avvisa su Telegram appena arriva un ordine, con il dato già nel messaggio.",
            ],
          },
        ],
      },
      "/guide/chiedere-codice-fiscale-acquirente-ebay": {
        title: "Come chiedere il Codice Fiscale all’acquirente su eBay senza insospettirlo",
        description:
          "Un messaggio breve per chiedere il Codice Fiscale all’acquirente eBay dopo il pagamento, che spiega a cosa serve e non sembra una truffa.",
        lead: "Molti acquirenti non rispondono alla richiesta del Codice Fiscale o temono una truffa. Un messaggio chiaro, inviato nel modo giusto, aiuta.",
        published: "2026-11-04",
        updated: "2026-11-04",
        feature: { shot: "scheda", label: "Il modello di messaggio nella scheda dell’ordine" },
        sections: [
          {
            title: "Perché l’acquirente esita",
            body: [
              "Nella Community di eBay gli acquirenti si chiedono spesso se sia normale che un venditore chieda il Codice Fiscale e temono truffe. Molti, semplicemente, non rispondono.",
            ],
          },
          {
            title: "Come scrivere la richiesta",
            body: [
              "Scrivi dai messaggi di eBay, così l’acquirente riconosce l’ordine e il venditore. Indica il numero dell’ordine, spiega che il dato serve per il documento fiscale dell’acquisto e che non lo usi per altro. Chiedi soltanto il Codice Fiscale, o la Partita IVA per chi compra come azienda, mai altri dati.",
            ],
          },
          {
            title: "Un modello da adattare",
            body: [
              "«Buongiorno e grazie per l’acquisto. Per emettere il documento fiscale dell’ordine 12-34567-89012 mi serve il tuo Codice Fiscale: lo uso soltanto per questo documento. Se acquisti con Partita IVA, indicami quella e la ragione sociale. Puoi rispondere a questo messaggio. Grazie.»",
            ],
          },
          {
            title: "Se non risponde",
            body: [
              "Un solo promemoria qualche giorno dopo basta; insistere aumenta i sospetti. Come documentare la vendita senza il dato dipende dal tuo regime: chiarisci i casi con il tuo commercialista.",
              "Per le vendite future puoi chiedere il dato già al pagamento, dalle Preferenze di vendita di eBay.",
            ],
          },
          {
            title: "Con FiscalBay",
            body: [
              "Prima di scrivere, FiscalBay ti dice se l’ordine contiene già il Codice Fiscale. Quando manca, la scheda dell’ordine ha un modello di messaggio con il numero dell’ordine, da copiare e inviare.",
            ],
          },
        ],
      },
      "/guide/codice-fiscale-fattura-elettronica-ebay": {
        title: "Codice Fiscale e fattura elettronica per le vendite su eBay",
        description:
          "Perché il Codice Fiscale dell’acquirente serve nella fattura elettronica di una vendita eBay a un privato e come preparare i dati.",
        lead: "Per fatturare una vendita eBay a un privato serve il suo Codice Fiscale. Ecco quali dati raccogliere e come averli pronti.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "esportazione", label: "L’export degli ordini" },
        sections: [
          {
            title: "A cosa serve il Codice Fiscale",
            body: [
              "Nella fattura elettronica il cliente si identifica con la Partita IVA oppure, se è un privato, con il Codice Fiscale. Senza uno dei due manca il dato che identifica chi compra.",
            ],
          },
          {
            title: "Privati e aziende",
            body: [
              "Per un privato servono nome, indirizzo e Codice Fiscale. Senza un recapito della fattura il codice destinatario è 0000000 e il Sistema di Interscambio mette la fattura a disposizione del cliente nella sua area riservata dell’Agenzia delle Entrate.",
              "Per un’azienda o un professionista serve la Partita IVA, con il codice destinatario o la PEC che indica il cliente.",
            ],
          },
          {
            title: "Quando emetterla",
            body: [
              "Se e quando la fattura è dovuta dipende dal tuo regime e dal tipo di vendita. Chiarisci i casi con il tuo commercialista: FiscalBay non dà consulenza fiscale.",
            ],
          },
          {
            title: "Preparare i dati con FiscalBay",
            body: [
              "FiscalBay non emette fatture: ti dà i dati fiscali dell’acquirente. Esporti gli ordini in CSV, o in XLSX con Premium, con acquirente, indirizzo di fatturazione e Codice Fiscale, e li importi nel gestionale o nel software di fatturazione.",
            ],
          },
        ],
      },
      "/guide/esportare-ordini-ebay-excel-csv": {
        title: "Esportare gli ordini eBay in Excel o CSV",
        description:
          "Come esportare gli ordini eBay con acquirente, indirizzo e Codice Fiscale in un file CSV o Excel, pronto per il gestionale o il commercialista.",
        lead: "Un file degli ordini con i dati fiscali degli acquirenti ti evita di copiarli uno per uno. Ecco come prepararlo.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "esportazione", label: "L’export degli ordini" },
        sections: [
          {
            title: "Cosa contiene il file",
            body: [
              "Ogni riga riporta ordine, data, acquirente, indirizzo di fatturazione, importi e, quando eBay li rende disponibili, Codice Fiscale e Partita IVA dell’acquirente.",
              "Puoi avere una riga per ordine oppure una per articolo, se nello stesso ordine ci sono più articoli.",
            ],
          },
          {
            title: "CSV o Excel",
            body: [
              "Il CSV si apre con Excel, Numbers o Fogli Google e si importa nella maggior parte dei gestionali; con FiscalBay è incluso nel piano Free.",
              "Con Premium esporti anche in XLSX, il formato di Excel, scegliendo le colonne e salvando le configurazioni che usi più spesso.",
            ],
          },
          {
            title: "Quali ordini entrano",
            body: [
              "Esporti tutti gli ordini, quelli di un periodo o di un negozio, oppure soltanto quelli selezionati. Lo storico disponibile è di 30 giorni con Free e di un anno con Premium.",
              "Negli ordini ancora da sbloccare il Codice Fiscale resta vuoto: il file non mostra dati che non puoi già vedere.",
            ],
          },
          {
            title: "Dove finisce il file",
            body: [
              "Il file si scarica soltanto dal tuo account e scade entro 24 ore. Conservalo dove tieni gli altri documenti contabili, oppure consegnalo direttamente al commercialista.",
            ],
          },
        ],
      },
      "/guide/partita-iva-acquirente-ebay": {
        title: "Partita IVA dell’acquirente negli ordini eBay",
        description:
          "Quando un ordine eBay riporta la Partita IVA dell’acquirente, come distinguerla dal Codice Fiscale e come usarla per la fattura.",
        lead: "Chi compra su eBay come azienda o professionista può indicare la Partita IVA. Ecco quando la trovi e come usarla.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "scheda", label: "La Partita IVA nella scheda dell’ordine" },
        sections: [
          {
            title: "Quando l’ordine la contiene",
            body: [
              "La Partita IVA compare in un ordine eBay soltanto se l’acquirente l’ha indicata, di solito quando compra per un’azienda o un’attività professionale. eBay la rende disponibile al venditore insieme agli altri dati dell’ordine.",
              "Può esserci da sola oppure insieme al Codice Fiscale.",
            ],
          },
          {
            title: "Come riconoscerla",
            body: [
              "La Partita IVA italiana ha 11 cifre, il Codice Fiscale di una persona 16 caratteri fra lettere e cifre. Un’azienda può avere un Codice Fiscale numerico uguale alla Partita IVA.",
            ],
          },
          {
            title: "A cosa serve",
            body: [
              "Nella fattura elettronica a un’azienda o a un professionista la Partita IVA identifica il cliente, insieme al codice destinatario o alla PEC che ti indica. Per i casi in cui la fattura è dovuta fai riferimento al tuo commercialista.",
            ],
          },
          {
            title: "Con FiscalBay",
            body: [
              "FiscalBay mostra la Partita IVA accanto al Codice Fiscale, o al suo posto, quando eBay la rende disponibile, pronta da copiare ed esportare. Un ordine con entrambi i dati conta come un solo sblocco.",
            ],
          },
        ],
      },
    },
  },
  en: {
    index: {
      title: "Guides",
      metaTitle: "Guides to the Codice Fiscale on eBay orders",
      description:
        "Practical guides for eBay sellers: where to find the buyer’s Codice Fiscale, the Italian tax code, and how to use it on the e-invoice.",
      lead: "Practical answers to eBay sellers’ questions about the buyer’s tax code.",
    },
    start: "Start free",
    back: "All guides",
    updated: (date) => `Updated ${date}`,
    articles: {
      "/guide/trovare-codice-fiscale-ordini-ebay": {
        title: "Where to find the buyer’s Codice Fiscale on eBay",
        description:
          "Where the buyer’s tax code is on eBay orders, why it does not appear in the shipping details and what to do when it is missing.",
        lead: "The buyer’s Codice Fiscale, the Italian tax code, is not shown among eBay’s shipping details and is not on every order. Here is where it is, how to ask for it at checkout and what to do when it is missing.",
        published: "2026-11-03",
        updated: "2026-11-04",
        feature: { shot: "scheda", label: "The Codice Fiscale on the order card" },
        sections: [
          {
            title: "Why you do not see it on the order",
            body: [
              "The tax code does not appear in the order’s shipping details or among the 50 columns eBay.it documents for the order report you can download from Seller Hub.",
              "When the buyer enters it, eBay keeps it with the order details and makes it available through the official order APIs, which a tool connected to your store can read.",
            ],
          },
          {
            title: "How to ask for it at checkout",
            body: [
              "In eBay’s selling preferences, in the Buyers section, you can turn on the option asking buyers to enter their tax identification number on the checkout form. Even with it on, sellers in the eBay Community report orders arriving without the data, or with data they cannot find.",
            ],
          },
          {
            title: "Why it is sometimes missing",
            body: [
              "Not every order includes it: in a real store it was there on 65 orders out of 104. An order placed without a tax code stays without one.",
              "After 90 days eBay masks the buyer’s personal details on orders, so it is worth saving the data while the order is recent.",
            ],
          },
          {
            title: "When to ask the buyer",
            body: [
              "If the data is missing and you need it, ask the buyer with a message that quotes the order number. FiscalBay prepares a template to copy and send.",
            ],
          },
          {
            title: "A check before you use it",
            body: [
              "A person’s tax code has 16 characters and the last one is a check character. A formal check confirms its structure, not that it really belongs to the buyer.",
            ],
          },
          {
            title: "With FiscalBay",
            body: [
              "FiscalBay reads the orders of the stores you connect and shows the tax code when eBay makes it available, ready to copy and export. With Premium you also get it on Telegram as soon as an order arrives.",
            ],
          },
        ],
      },
      "/guide/codice-fiscale-non-visibile-ordine-ebay": {
        title: "I asked for the Codice Fiscale at checkout: why can’t I see it on the order",
        description:
          "The buyer says they already entered their tax code on the eBay order but you cannot see it: where the data goes and how to read it.",
        lead: "“I already entered it on my order” is a common reply from buyers. They are right: the data is there, but eBay does not show it where you look.",
        published: "2026-11-04",
        updated: "2026-11-04",
        feature: { shot: "telegram", label: "Every new order on Telegram" },
        sections: [
          {
            title: "The data entered is there",
            body: [
              "When the buyer enters their tax code on the payment form, eBay saves it with the order. It does not appear, though, in the shipping details or in the order report you download from eBay.it.",
            ],
          },
          {
            title: "Where it can be read",
            body: [
              "eBay makes it available through the official order APIs, the same ones used by seller tools. Reading it takes a service connected to your store with your consent, read-only.",
            ],
          },
          {
            title: "Before asking again",
            body: [
              "Asking again for data already given confuses the buyer and may go unanswered. Check first whether the order includes it: you save a message and the wait.",
            ],
          },
          {
            title: "With FiscalBay",
            body: [
              "FiscalBay reads orders through eBay’s official APIs and shows the tax code when eBay makes it available, ready to copy. With Premium it alerts you on Telegram as soon as an order arrives, with the data already in the message.",
            ],
          },
        ],
      },
      "/guide/chiedere-codice-fiscale-acquirente-ebay": {
        title: "How to ask an eBay buyer for their Codice Fiscale without raising suspicion",
        description:
          "A short message to ask an eBay buyer for their tax code after payment, explaining what it is for so it does not look like a scam.",
        lead: "Many buyers do not answer a request for their tax code or fear a scam. A clear message, sent the right way, helps.",
        published: "2026-11-04",
        updated: "2026-11-04",
        feature: { shot: "scheda", label: "The message template on the order card" },
        sections: [
          {
            title: "Why buyers hesitate",
            body: [
              "In the eBay Community buyers often ask whether it is normal for a seller to ask for their tax code and worry about scams. Many simply do not reply.",
            ],
          },
          {
            title: "How to write the request",
            body: [
              "Write through eBay messages, so the buyer recognises the order and the seller. Quote the order number, explain that the data is needed for the tax document of the purchase and that you do not use it for anything else. Ask only for the tax code, or the VAT number for business buyers, never other data.",
            ],
          },
          {
            title: "A template to adapt",
            body: [
              "“Hello and thank you for your purchase. To issue the tax document for order 12-34567-89012 I need your Italian tax code (Codice Fiscale): I use it only for this document. If you are buying with a VAT number, please send that and your company name instead. You can reply to this message. Thank you.”",
            ],
          },
          {
            title: "If they do not reply",
            body: [
              "One reminder a few days later is enough; insisting raises suspicion. How to document the sale without the data depends on your tax regime: check with your accountant.",
              "For future sales you can ask for the data at checkout, from eBay’s selling preferences.",
            ],
          },
          {
            title: "With FiscalBay",
            body: [
              "Before you write, FiscalBay tells you whether the order already includes the tax code. When it is missing, the order card has a message template with the order number, ready to copy and send.",
            ],
          },
        ],
      },
      "/guide/codice-fiscale-fattura-elettronica-ebay": {
        title: "Codice Fiscale and the Italian e-invoice for eBay sales",
        description:
          "Why the buyer’s tax code is needed on the Italian e-invoice for an eBay sale to a private buyer, and how to prepare the data.",
        lead: "To invoice an eBay sale to a private buyer in Italy you need their tax code, the Codice Fiscale. Here is which data to collect and how to have it ready.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "esportazione", label: "Order export" },
        sections: [
          {
            title: "What the Codice Fiscale is for",
            body: [
              "On the Italian e-invoice the customer is identified by their VAT number or, for a private buyer, by their tax code. Without one of them the invoice lacks the data that identifies the buyer.",
            ],
          },
          {
            title: "Private buyers and businesses",
            body: [
              "For a private buyer you need name, address and tax code. Without an invoice delivery address the recipient code is 0000000 and the Exchange System (Sistema di Interscambio) makes the invoice available in the buyer’s private area of the Agenzia delle Entrate.",
              "For a business or professional you need the VAT number, with the recipient code or certified email address the customer gives you.",
            ],
          },
          {
            title: "When to issue it",
            body: [
              "Whether and when an invoice is due depends on your tax regime and the type of sale. Check the cases with your accountant: FiscalBay does not give tax advice.",
            ],
          },
          {
            title: "Preparing the data with FiscalBay",
            body: [
              "FiscalBay does not issue invoices: it gives you the buyer’s tax data. You export orders as CSV, or XLSX with Premium, with buyer, billing address and tax code, and import them into your management or invoicing software.",
            ],
          },
        ],
      },
      "/guide/esportare-ordini-ebay-excel-csv": {
        title: "Exporting eBay orders to Excel or CSV",
        description:
          "How to export eBay orders with buyer, address and tax code to a CSV or Excel file, ready for your management software or accountant.",
        lead: "A file of your orders with the buyers’ tax data saves you copying them one by one. Here is how to prepare it.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "esportazione", label: "Order export" },
        sections: [
          {
            title: "What the file contains",
            body: [
              "Each row shows order, date, buyer, billing address, amounts and, when eBay makes them available, the buyer’s tax code and VAT number.",
              "You can have one row per order or one per item, when an order has more than one item.",
            ],
          },
          {
            title: "CSV or Excel",
            body: [
              "CSV opens in Excel, Numbers or Google Sheets and imports into most management software; with FiscalBay it is included in the Free plan.",
              "With Premium you also export to XLSX, the Excel format, choosing the columns and saving the configurations you use most.",
            ],
          },
          {
            title: "Which orders are included",
            body: [
              "You export all orders, those of a period or a store, or only the ones you selected. The available history is 30 days on Free and one year on Premium.",
              "On orders still to unlock the tax code stays empty: the file never shows data you cannot already see.",
            ],
          },
          {
            title: "Where the file goes",
            body: [
              "The file can only be downloaded from your account and expires within 24 hours. Keep it with your other accounting records, or hand it straight to your accountant.",
            ],
          },
        ],
      },
      "/guide/partita-iva-acquirente-ebay": {
        title: "The buyer’s Partita IVA on eBay orders",
        description:
          "When an eBay order shows the buyer’s VAT number, how to tell it from the tax code and how to use it on the invoice.",
        lead: "Buyers purchasing on eBay as a business or professional can enter a Partita IVA, the Italian VAT number. Here is when you find it and how to use it.",
        published: "2026-11-03",
        updated: "2026-11-03",
        feature: { shot: "scheda", label: "The Partita IVA on the order card" },
        sections: [
          {
            title: "When the order includes it",
            body: [
              "The VAT number appears on an eBay order only if the buyer entered it, usually when buying for a business or professional activity. eBay makes it available to the seller with the rest of the order details.",
              "It can be there on its own or together with the tax code.",
            ],
          },
          {
            title: "How to recognise it",
            body: [
              "An Italian VAT number has 11 digits, a person’s tax code 16 letters and digits. A company can have a numeric tax code equal to its VAT number.",
            ],
          },
          {
            title: "What it is for",
            body: [
              "On the e-invoice to a business or professional the VAT number identifies the customer, together with the recipient code or certified email address they give you. Check with your accountant when an invoice is due.",
            ],
          },
          {
            title: "With FiscalBay",
            body: [
              "FiscalBay shows the VAT number next to the tax code, or in its place, when eBay makes it available, ready to copy and export. An order with both counts as a single unlock.",
            ],
          },
        ],
      },
    },
  },
};
