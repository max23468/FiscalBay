import type { GuidePath } from "../app-links";
import type { ShotName } from "../components/product-shot";
import type { Language } from "../i18n";

/** Paragrafi di una parte della guida, sotto il proprio titolo. */
export interface GuideSection {
  title: string;
  body: readonly string[];
}

/** Pagina ufficiale che conferma un'affermazione della guida. */
export interface GuideSource {
  label: string;
  href: string;
}

/** Valore di una cella del confronto; con `yes` porta la spunta. */
export type ComparisonCell = string | { yes: string };

export interface Guide {
  /** Titolo della pagina, che comincia dalla frase cercata. */
  title: string;
  /** Titolo della scheda e dei risultati di ricerca, entro i 50 caratteri prima di « | FiscalBay». */
  metaTitle: string;
  /** Nome breve nel menu delle guide. */
  nav: string;
  description: string;
  lead: string;
  /** Prima pubblicazione e ultima modifica sostanziale, per i dati strutturati e la sitemap. */
  published: string;
  updated: string;
  sections: readonly GuideSection[];
  /** Tabella di confronto dopo le sezioni, con sotto le fonti dei dati. */
  comparison?: {
    title: string;
    /** La prima colonna dopo le voci è la soluzione messa in evidenza, poi le altre. */
    headers: readonly string[];
    rows: readonly (readonly [string, ...ComparisonCell[]])[];
    /** Valore per ciò che le fonti non dichiarano: ha il trattino e non vale come assenza. */
    notStated: string;
    /**
     * Confronto con una soluzione dismessa: spunte in evidenza e croci sulle altre colonne. Senza,
     * la spunta va soltanto ai valori `yes` di ogni colonna.
     */
    contrast?: boolean;
    note: string;
  };
  /** Pagine ufficiali che confermano le affermazioni, in fondo all'articolo. */
  sources?: readonly GuideSource[];
  /** Guida collegata dal riquadro finale. */
  related?: { label: string; path: GuidePath };
  /**
   * Come FiscalBay risolve il problema della guida, in evidenza dopo le sezioni sotto il titolo
   * comune, con la schermata della funzione: la didascalia porta alla funzione in Funzionalità.
   */
  solution: { body: readonly string[]; shot: ShotName; caption: string };
}

/**
 * Pagine ufficiali citate nelle Fonti, verificate il 10 novembre 2026 nel browser: le pagine
 * dell'aiuto eBay rispondono con un controllo antibot a chi non esegue JavaScript. Mai siti dei
 * concorrenti.
 */
/**
 * Guida di confronto, richiamata dalla guida sull'export. Percorso scritto per intero perché lo
 * script delle immagini social legge questi testi con Node, senza risolvere gli import dell'app.
 */
const comparisonGuidePath = "/guide/confronto-console-venditori-ebay-ready-pro" satisfies GuidePath;

const sourceLinks = {
  sellerHub: "https://www.ebay.it/help/selling/selling-tools/seller-hub?id=4095",
  reports:
    "https://www.ebay.it/help/selling/selling-tools/scheda-reportistica-della-console-venditori?id=4096",
  soldItems:
    "https://www.ebay.it/help/selling/listings/trovare-gli-oggetti-che-hai-venduto?id=4108",
  teamAccess: "https://www.ebay.it/help/account/team-access/accesso-per-i-team?id=5197",
  eInvoice:
    "https://www.agenziaentrate.gov.it/portale/aree-tematiche/fatturazione-elettronica/guida-fatturazione-elettronica/come-predisporre-inviare-ricevere-fe/come-si-predispone-fe",
  vatCheck:
    "https://telematici.agenziaentrate.gov.it/VerificaPIVA/Scegli.do?parameter=verificaPiva",
} as const;

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
    solutionTitle: string;
    sourcesTitle: string;
    start: string;
    signIn: string;
    back: string;
    updated: (date: string) => string;
    articles: Record<GuidePath, Guide>;
  }
> = {
  it: {
    index: {
      title: "Guide",
      metaTitle: "Guide | Codice Fiscale degli ordini eBay",
      description:
        "Guide pratiche per chi vende su eBay: dove trovare il Codice Fiscale e la Partita IVA degli acquirenti, come chiederli e come usarli in fattura.",
      lead: "Risposte alle domande più comuni di chi vende su eBay sul Codice Fiscale degli acquirenti.",
    },
    solutionTitle: "Come ti aiuta FiscalBay",
    sourcesTitle: "Fonti",
    start: "Inizia gratis",
    signIn: "Accedi",
    back: "Tutte le guide",
    updated: (date) => `Aggiornata il ${date}`,
    articles: {
      "/guide/trovare-codice-fiscale-ordini-ebay": {
        title: "Dove trovare il Codice Fiscale dell’acquirente su eBay",
        metaTitle: "Dove trovare il Codice Fiscale dell’acquirente eBay",
        nav: "Dove trovare il Codice Fiscale",
        description:
          "Il Codice Fiscale dell’acquirente non si vede nell’ordine eBay né nel report di Seller Hub. Dove si trova davvero e come averlo per ogni vendita.",
        lead: "Apri un ordine su eBay e il Codice Fiscale non c’è, anche se l’acquirente l’ha inserito al pagamento. Non è un errore. eBay lo salva, ma non lo mostra nella pagina dell’ordine.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          { label: "eBay: Console venditori e report degli ordini", href: sourceLinks.sellerHub },
        ],
        sections: [
          {
            title: "Dove non lo trovi",
            body: [
              "Non è nei dettagli di spedizione, non è nella pagina degli ordini di Seller Hub e non è nemmeno nel report degli ordini che puoi scaricare. Cercarlo lì è tempo perso.",
            ],
          },
          {
            title: "Dove si trova",
            body: [
              "eBay tiene il Codice Fiscale insieme ai dati dell’ordine e lo passa ai servizi che colleghi al tuo negozio, se dai il consenso. Il collegamento è in sola lettura, quindi il servizio vede gli ordini ma non può modificare niente del tuo account.",
            ],
          },
          {
            title: "Come farlo indicare agli acquirenti",
            body: [
              "Nelle Preferenze di vendita di eBay, nella sezione Acquirenti, puoi attivare la richiesta del Codice Fiscale, che eBay chiama «numero di identificazione fiscale». Da quel momento il modulo di pagamento lo chiede all’acquirente. Qualche ordine però arriva lo stesso senza.",
            ],
          },
          {
            title: "Se l’ordine non lo contiene",
            body: [
              "Se l’acquirente non l’ha inserito al pagamento, l’ordine resta senza. Quando ti serve, l’unica strada è chiederlo con un messaggio da eBay, indicando il numero dell’ordine.",
            ],
          },
          {
            title: "Salvalo finché l’ordine è recente",
            body: [
              "Dopo 90 giorni eBay nasconde i dati personali dell’acquirente. Se il Codice Fiscale ti serve per la contabilità, copialo o esportalo prima.",
            ],
          },
        ],
        related: {
          label: "Codice Fiscale e fattura elettronica per le vendite su eBay",
          path: "/guide/codice-fiscale-fattura-elettronica-ebay",
        },
        solution: {
          body: [
            "Colleghi il negozio eBay una volta sola, in sola lettura. Da lì FiscalBay legge i nuovi ordini da solo.",
            "Nella scheda di ogni ordine trovi il Codice Fiscale inserito dall’acquirente, da copiare con un clic o da esportare insieme agli altri dati.",
            "Gli ordini senza Codice Fiscale li trovi con un filtro, e per ognuno c’è già il messaggio per chiederlo. Con Pro ricevi anche una notifica su Telegram a ogni nuovo ordine, con il dato dentro.",
          ],
          shot: "scheda",
          caption: "Il Codice Fiscale nella scheda dell’ordine",
        },
      },
      "/guide/codice-fiscale-non-visibile-ordine-ebay": {
        title: "Codice Fiscale non visibile nell’ordine eBay: dove finisce il dato",
        metaTitle: "Codice Fiscale non visibile nell’ordine eBay",
        nav: "Codice Fiscale non visibile",
        description:
          "L’acquirente dice di aver inserito il Codice Fiscale, ma nell’ordine eBay non c’è. Il dato esiste: dove finisce e come leggerlo senza chiederlo di nuovo.",
        lead: "Hai attivato la richiesta del Codice Fiscale, l’acquirente giura di averlo inserito e nell’ordine non lo trovi. Ha ragione lui. Il dato c’è, solo che eBay non lo fa vedere.",
        published: "2026-11-04",
        updated: "2026-11-10",
        sources: [
          { label: "eBay: Console venditori e report degli ordini", href: sourceLinks.sellerHub },
        ],
        sections: [
          {
            title: "Perché non lo vedi",
            body: [
              "eBay salva il Codice Fiscale con l’ordine, ma non lo mette nei dettagli di spedizione, nella pagina degli ordini di Seller Hub o nel report scaricabile. Per questo tanti venditori pensano che l’acquirente non l’abbia mai scritto.",
            ],
          },
          {
            title: "Come leggerlo",
            body: [
              "Il dato arriva agli strumenti per venditori che colleghi al negozio, con il tuo consenso e in sola lettura. Una volta collegato il negozio, lo vedi in ogni ordine che lo contiene.",
            ],
          },
          {
            title: "Prima di chiederlo di nuovo",
            body: [
              "Chiedere a un acquirente un dato che ha già dato lo confonde, e spesso non risponde. Meglio controllare prima se l’ordine lo contiene già.",
            ],
          },
        ],
        related: {
          label: "Chiedere il Codice Fiscale all’acquirente eBay",
          path: "/guide/chiedere-codice-fiscale-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay legge gli ordini del tuo negozio e ti mostra il Codice Fiscale che l’acquirente ha inserito. Non devi chiederlo una seconda volta.",
            "Con un filtro vedi solo gli ordini senza il dato e scrivi soltanto a quegli acquirenti.",
            "Con Pro ogni nuovo ordine arriva su Telegram con il Codice Fiscale già nel messaggio.",
          ],
          shot: "telegram",
          caption: "Un nuovo ordine su Telegram, con il Codice Fiscale",
        },
      },
      "/guide/chiedere-codice-fiscale-acquirente-ebay": {
        title: "Chiedere il Codice Fiscale all’acquirente eBay: il messaggio da inviare",
        metaTitle: "Chiedere il Codice Fiscale all’acquirente eBay",
        nav: "Chiedere il Codice Fiscale",
        description:
          "Come chiedere il Codice Fiscale a un acquirente eBay dopo la vendita: quando scrivere, cosa dire e un messaggio da copiare.",
        lead: "L’ordine non ha il Codice Fiscale e a te serve per la fattura. Puoi chiederlo all’acquirente, e con il messaggio giusto le risposte arrivano più spesso.",
        published: "2026-11-04",
        updated: "2026-11-05",
        sections: [
          {
            title: "Prima controlla l’ordine",
            body: [
              "Molti acquirenti il Codice Fiscale lo inseriscono già al pagamento, ma eBay non lo mostra nella pagina dell’ordine. Prima di scrivere, verifica che manchi davvero.",
            ],
          },
          {
            title: "Cosa scrivere",
            body: [
              "Usa i messaggi di eBay, così l’acquirente vede subito a quale acquisto ti riferisci e chi sei. Metti il numero dell’ordine e spiega che il dato ti serve per la fattura.",
              "Chiedi solo il Codice Fiscale, oppure Partita IVA e ragione sociale se compra per un’azienda. Più la richiesta è precisa, meno sembra una truffa.",
            ],
          },
          {
            title: "Modello di messaggio",
            body: [
              "«Buongiorno e grazie per l’acquisto. Per emettere la fattura dell’ordine 27-10293-84756 mi serve il tuo Codice Fiscale, che userò soltanto per questo. Se acquisti con Partita IVA, mandami quella e la ragione sociale. Puoi rispondere direttamente a questo messaggio. Grazie.»",
            ],
          },
          {
            title: "Se non risponde",
            body: [
              "Un promemoria dopo qualche giorno va bene, di più no. Se il dato non arriva, chiedi al tuo commercialista come registrare la vendita.",
              "Per le prossime vendite attiva la richiesta del dato al pagamento, nelle Preferenze di vendita di eBay.",
            ],
          },
        ],
        related: {
          label: "Dove trovare il Codice Fiscale dell’acquirente su eBay",
          path: "/guide/trovare-codice-fiscale-ordini-ebay",
        },
        solution: {
          body: [
            "FiscalBay ti dice subito se l’ordine ha già il Codice Fiscale, così non scrivi a chi l’ha inserito.",
            "Se manca, nella scheda dell’ordine trovi il messaggio già scritto con il numero dell’ordine. Lo copi e lo mandi dai messaggi di eBay.",
          ],
          shot: "scheda",
          caption: "La scheda dell’ordine mostra se il Codice Fiscale c’è già",
        },
      },
      "/guide/codice-fiscale-fattura-elettronica-ebay": {
        title: "Codice Fiscale e fattura elettronica per le vendite su eBay",
        metaTitle: "Codice Fiscale e fattura elettronica su eBay",
        nav: "Fattura elettronica",
        description:
          "Quali dati dell’acquirente servono per fatturare una vendita eBay, a un privato o a un’azienda, e come averli senza ricopiarli a mano.",
        lead: "Per la fattura elettronica di una vendita eBay devi identificare l’acquirente. Se è un privato serve il Codice Fiscale, se è un’azienda o un professionista la Partita IVA.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          {
            label: "Agenzia delle Entrate: come si predispone una fattura elettronica",
            href: sourceLinks.eInvoice,
          },
        ],
        sections: [
          {
            title: "Vendita a un privato",
            body: [
              "Servono nome e cognome, indirizzo e Codice Fiscale. Se il cliente non ti dà un recapito per la fattura, usa il codice destinatario 0000000. Il Sistema di Interscambio la mette a disposizione nella sua area riservata sul sito dell’Agenzia delle Entrate.",
            ],
          },
          {
            title: "Vendita a un’azienda o a un professionista",
            body: [
              "Servono ragione sociale, indirizzo e Partita IVA, più il codice destinatario o la PEC che ti comunica il cliente.",
            ],
          },
          {
            title: "Quando la fattura è dovuta",
            body: [
              "Dipende dal tuo regime, ordinario o forfettario, e dal tipo di vendita. Su questo il riferimento è il tuo commercialista.",
            ],
          },
          {
            title: "Dove prendere i dati",
            body: [
              "Nome e indirizzo li trovi nell’ordine eBay. Codice Fiscale e Partita IVA invece no, perché eBay non li mostra nella pagina dell’ordine e non li mette nel report.",
            ],
          },
        ],
        related: {
          label: "Partita IVA dell’acquirente negli ordini eBay",
          path: "/guide/partita-iva-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay mette in un unico file acquirente, indirizzo di fatturazione, Codice Fiscale e Partita IVA dei tuoi ordini eBay.",
            "Lo esporti in CSV, o in Excel con Pro, e lo importi nel software di fatturazione oppure lo mandi al commercialista. Le fatture le emetti sempre dal tuo software.",
          ],
          shot: "esportazione",
          caption: "Ordini esportati con Codice Fiscale e Partita IVA",
        },
      },
      "/guide/esportare-ordini-ebay-excel-csv": {
        title: "Esportare gli ordini eBay in Excel o CSV con Codice Fiscale e Partita IVA",
        metaTitle: "Ordini eBay in Excel o CSV con il Codice Fiscale",
        nav: "Export in Excel o CSV",
        description:
          "Come raccogliere Codice Fiscale e Partita IVA degli ordini eBay ed esportarli in CSV o Excel, pronti per il gestionale o il software di fatturazione.",
        lead: "Colleghi il negozio eBay a FiscalBay in sola lettura. FiscalBay legge gli ordini e riporta Codice Fiscale e Partita IVA quando l’acquirente li ha inseriti ed eBay li rende disponibili. Poi esporti gli ordini in CSV con il piano Free, o in Excel (XLSX) con Pro, e importi il file nel gestionale o nel software di fatturazione.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sections: [
          {
            title: "Cosa manca nel report di eBay",
            body: [
              "Il report degli ordini che scarichi dalla Console venditori ha acquirente, indirizzi e importi, ma nessuna colonna per il Codice Fiscale o la Partita IVA. Per fatturare dovresti aggiungerli a mano, ordine per ordine.",
            ],
          },
          {
            title: "Cosa c’è nel file",
            body: [
              "Numero e data dell’ordine, negozio, acquirente, indirizzo di fatturazione o, se eBay non lo fornisce, quello di spedizione, articoli con SKU e quantità, importi e valuta, stato del pagamento e della spedizione.",
              "Codice Fiscale e Partita IVA hanno una colonna ciascuno, quando l’acquirente li ha inseriti. Nel piano Free il file li riporta per gli ordini sbloccati nel ciclo; per gli altri la cella resta vuota.",
            ],
          },
          {
            title: "CSV con Free, Excel con Pro",
            body: [
              "Con il piano Free esporti in CSV, con una riga per ordine o per articolo e gli ordini degli ultimi 30 giorni.",
              "Con Pro esporti anche in Excel (XLSX), scegli e riordini le colonne, salvi fino a 20 configurazioni e hai un anno di ordini.",
              "In entrambi i piani esporti tutto, un periodo, un solo negozio o gli ordini che selezioni. Il file si scarica solo dal tuo account, entro 24 ore.",
            ],
          },
          {
            title: "Importarlo nel gestionale",
            body: [
              "Ogni gestionale e software di fatturazione ha il suo modello di importazione: abbini le colonne del file a quelle richieste. Importa Codice Fiscale e Partita IVA come testo, così gli zeri iniziali restano.",
            ],
          },
          {
            title: "Le fatture le emetti dal tuo software",
            body: [
              "FiscalBay fornisce i dati degli ordini e non emette fatture elettroniche: le prepari e le invii dal tuo software di fatturazione.",
            ],
          },
        ],
        sources: [
          { label: "eBay: Console venditori e report degli ordini", href: sourceLinks.sellerHub },
          { label: "eBay: scheda Reportistica della Console venditori", href: sourceLinks.reports },
        ],
        related: {
          label: "FiscalBay, Console venditori eBay e Ready Pro a confronto",
          path: comparisonGuidePath,
        },
        solution: {
          body: [
            "Colleghi il negozio una volta sola e FiscalBay legge i nuovi ordini da solo, con Codice Fiscale e Partita IVA quando ci sono.",
            "Dalla sezione Esportazione scegli ordini, formato e colonne e scarichi il file pronto per il gestionale o per il commercialista.",
          ],
          shot: "esportazione",
          caption: "Gli ordini esportati in Excel",
        },
      },
      "/guide/partita-iva-acquirente-ebay": {
        title: "Partita IVA dell’acquirente negli ordini eBay",
        metaTitle: "Partita IVA dell’acquirente negli ordini eBay",
        nav: "Partita IVA dell’acquirente",
        description:
          "Quando un ordine eBay ha la Partita IVA dell’acquirente, dove trovarla e cosa serve per fatturare a un’azienda o a un professionista.",
        lead: "Chi compra su eBay per la propria attività può inserire la Partita IVA al pagamento. Come per il Codice Fiscale, eBay la salva con l’ordine ma non la mette nel report.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          {
            label: "Agenzia delle Entrate: come si predispone una fattura elettronica",
            href: sourceLinks.eInvoice,
          },
          {
            label: "Agenzia delle Entrate: controllo della partita IVA",
            href: sourceLinks.vatCheck,
          },
        ],
        sections: [
          {
            title: "Quando l’ordine la contiene",
            body: [
              "Solo se l’acquirente l’ha inserita, di solito quando compra per lavoro. Può esserci da sola o insieme al Codice Fiscale.",
              "Tieni presente che un’azienda può avere un Codice Fiscale numerico uguale alla Partita IVA.",
            ],
          },
          {
            title: "Cosa serve per la fattura",
            body: [
              "Per fatturare a un’azienda o a un professionista servono ragione sociale, indirizzo e Partita IVA, più il codice destinatario o la PEC che ti comunica il cliente. Se la fattura sia dovuta dipende dal tuo regime, e su questo conviene sentire il commercialista.",
            ],
          },
          {
            title: "Se manca",
            body: [
              "Se l’acquirente compra per un’azienda ma non ha inserito la Partita IVA, chiedila con un messaggio da eBay, insieme alla ragione sociale.",
            ],
          },
        ],
        related: {
          label: "Chiedere il Codice Fiscale o la Partita IVA all’acquirente eBay",
          path: "/guide/chiedere-codice-fiscale-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay mostra la Partita IVA nella scheda dell’ordine, accanto al Codice Fiscale o al suo posto, e la copi con un clic.",
            "Nell’export degli ordini ha la sua colonna, quindi arriva al software di fatturazione insieme al resto.",
          ],
          shot: "esportazione",
          caption: "La Partita IVA nell’export degli ordini",
        },
      },
      "/guide/alternativa-probay-codice-fiscale-ebay": {
        title: "Alternativa a ProBay per il Codice Fiscale degli acquirenti eBay",
        metaTitle: "Alternativa a ProBay per il Codice Fiscale eBay",
        nav: "Alternativa a ProBay",
        description:
          "ProBay non funziona più? FiscalBay è l’alternativa per leggere il Codice Fiscale degli acquirenti eBay dal browser, senza installare nulla. Inizia gratis.",
        lead: "Cerchi un’alternativa a ProBay per il Codice Fiscale degli acquirenti eBay? Con FiscalBay fai di più: lo leggi dal browser, senza installare nulla, insieme a Partita IVA ed export degli ordini. E inizi gratis.",
        published: "2026-11-08",
        updated: "2026-11-08",
        sections: [
          {
            title: "ProBay non funziona più? Continua con FiscalBay",
            body: [
              "L’app ProBay per Windows e Android non riceve aggiornamenti da anni ed è sparita dai principali store. Se ProBay si blocca o non mostra più i dati, i Codici Fiscali dei tuoi acquirenti sono ancora lì: eBay li salva con l’ordine e FiscalBay te li mostra.",
            ],
          },
          {
            title: "Non riesci a scaricare ProBay? Con FiscalBay non serve",
            body: [
              "FiscalBay è l’alternativa a ProBay che funziona nel browser: niente da scaricare o installare, su computer e telefono.",
            ],
          },
          {
            title: "Il Codice Fiscale degli acquirenti eBay senza ProBay",
            body: [
              "eBay non mostra il Codice Fiscale nella pagina dell’ordine né nel report di Seller Hub. Con FiscalBay lo trovi nella scheda dell’ordine, insieme alla Partita IVA, quando l’acquirente li ha inseriti.",
            ],
          },
          {
            title: "Come passare da ProBay a FiscalBay in due mosse",
            body: [
              "Crei un account gratis, senza carta, e colleghi il tuo negozio eBay. Da lì i nuovi ordini arrivano da soli, senza importare niente.",
              "FiscalBay legge soltanto gli ordini: il tuo negozio resta esattamente com’è.",
            ],
          },
        ],
        comparison: {
          title: "Perché passare da ProBay a FiscalBay",
          headers: ["Caratteristica", "FiscalBay", "ProBay"],
          notStated: "Non indicato",
          contrast: true,
          rows: [
            ["Per iniziare", "Gratis", "0,99 € per scaricarla"],
            ["Installazione", "Nessuna, si apre nel browser", "App da installare"],
            ["Aggiornamenti", "Continui", "Fermi da anni"],
            ["Partita IVA dell’acquirente", "Sì", "Non indicato"],
            ["Esportazione degli ordini", "CSV, Excel con Pro", "Non indicato"],
            ["Notifiche su Telegram", "Con Pro", "Non indicato"],
            ["Più negozi", "Con Pro", "Non indicato"],
            ["Storico degli ordini", "Fino a un anno con Pro", "Nessun dato salvato"],
            ["Assistenza", "Sì", "Nessun contatto sul sito"],
          ],
          note: "FiscalBay è un servizio indipendente e non ha legami con ProBay.",
        },
        related: {
          label: "Dove trovare il Codice Fiscale dell’acquirente su eBay",
          path: "/guide/trovare-codice-fiscale-ordini-ebay",
        },
        solution: {
          body: [
            "Apri l’ordine, copi il Codice Fiscale con un clic e fai la fattura. Basta scrivere agli acquirenti per chiedere un dato che hanno già inserito.",
            "Con Pro ricevi ogni nuovo ordine su Telegram ed esporti tutto in Excel. Inizia gratis e collega il negozio: al resto pensa FiscalBay.",
          ],
          shot: "scheda",
          caption: "Il Codice Fiscale nella scheda dell’ordine",
        },
      },
      [comparisonGuidePath]: {
        title: "Codice Fiscale su eBay: FiscalBay, Console venditori e Ready Pro",
        metaTitle: "FiscalBay, Console venditori eBay e Ready Pro",
        nav: "Console venditori e Ready Pro",
        description:
          "FiscalBay, Console venditori eBay e Ready Pro a confronto: dove vedi Codice Fiscale e Partita IVA degli acquirenti, ricerca, più negozi, export e fatture.",
        lead: "Per avere Codice Fiscale e Partita IVA degli acquirenti eBay hai tre strade: la Console venditori di eBay, un gestionale completo come Ready Pro o FiscalBay. Ecco cosa fa ciascuna, con le fonti.",
        published: "2026-11-10",
        updated: "2026-11-10",
        sections: [
          {
            title: "Console venditori eBay",
            body: [
              "È lo strumento gratuito di eBay per chi vende. Cerchi gli ordini per numero, periodo e stato, scarichi report in CSV o XLSX e lavori su un account alla volta.",
              "Il report degli ordini ha acquirente, indirizzi e importi, ma nessuna colonna per il Codice Fiscale o la Partita IVA.",
            ],
          },
          {
            title: "Ready Pro",
            body: [
              "È un gestionale per Windows da installare, con magazzino, vendite e contabilità. Con il modulo eBay Gateway scarica gli ordini e crea le anagrafiche dei clienti.",
              "Importa il Codice Fiscale quando eBay lo trasmette; quando manca, il suo manuale indica di ricontattare il cliente. Gestisce più account eBay e altri marketplace ed emette fatture elettroniche con un plugin.",
            ],
          },
          {
            title: "FiscalBay",
            body: [
              "È un servizio web che apri dal browser, collegato al negozio in sola lettura. Legge gli ordini da solo e mostra Codice Fiscale e Partita IVA nella scheda di ogni ordine, quando l’acquirente li ha inseriti ed eBay li rende disponibili.",
              "Li cerchi come un numero d’ordine e li esporti in CSV, o in Excel con Pro. Con Pro colleghi anche più negozi. Non emette fatture: i dati vanno nel tuo software di fatturazione.",
            ],
          },
          {
            title: "Quale scegliere",
            body: [
              "Se ti bastano gli ordini e i report di eBay, la Console venditori. Se vuoi un gestionale completo su Windows, con magazzino e fatturazione, Ready Pro.",
              "Se usi già un software di fatturazione e ti servono Codice Fiscale e Partita IVA degli ordini eBay senza cambiare gestionale, FiscalBay.",
            ],
          },
        ],
        comparison: {
          title: "FiscalBay, Console venditori e Ready Pro",
          headers: ["Caratteristica", "FiscalBay", "Console venditori eBay", "Ready Pro"],
          notStated: "Non indicato",
          rows: [
            ["Cos’è", "Servizio web", "Strumento di eBay", "Gestionale per Windows"],
            ["Installazione", { yes: "Nessuna" }, { yes: "Nessuna" }, "Da installare"],
            [
              "Codice Fiscale dell’acquirente",
              { yes: "Nella scheda dell’ordine" },
              "Non nel report degli ordini",
              { yes: "Nell’anagrafica, quando eBay lo trasmette" },
            ],
            [
              "Partita IVA dell’acquirente",
              { yes: "Nella scheda dell’ordine" },
              "Non nel report degli ordini",
              "Non indicato",
            ],
            [
              "Lettura degli ordini",
              { yes: "Automatica" },
              "Ordini già in eBay",
              "Avviata a mano o pianificata",
            ],
            [
              "Ricerca degli ordini",
              { yes: "Anche per Codice Fiscale e Partita IVA" },
              { yes: "Per numero, periodo e stato" },
              { yes: "Viste e filtri del gestionale" },
            ],
            [
              "Più negozi eBay",
              { yes: "Con Pro" },
              "Un account alla volta",
              { yes: "Con account aggiuntivi a pagamento" },
            ],
            [
              "Export degli ordini",
              { yes: "CSV, Excel con Pro" },
              { yes: "CSV e XLSX" },
              { yes: "CSV, TXT e XLS" },
            ],
            ["Fatture elettroniche", "No", "Non indicato", { yes: "Con un plugin a pagamento" }],
            [
              "Prezzo",
              "Free gratuito, Pro da 4,90 € al mese + IVA",
              "Gratuita",
              "1.100 € + IVA la prima attivazione",
            ],
          ],
          note: "Dati verificati il 10 novembre 2026 sulle pagine di aiuto di eBay e sul sito, il listino e il manuale pubblici di Ready Pro. FiscalBay è un servizio indipendente, senza legami con eBay o Ready Pro.",
        },
        sources: [
          { label: "eBay: Console venditori e report degli ordini", href: sourceLinks.sellerHub },
          { label: "eBay: scheda Reportistica della Console venditori", href: sourceLinks.reports },
          { label: "eBay: trovare gli oggetti venduti", href: sourceLinks.soldItems },
          { label: "eBay: accesso per i team", href: sourceLinks.teamAccess },
        ],
        solution: {
          body: [
            "Colleghi il negozio eBay in pochi minuti e ritrovi Codice Fiscale e Partita IVA nella scheda di ogni ordine, pronti da copiare o da esportare per il tuo software di fatturazione.",
            "Inizi gratis, senza installare niente e senza cambiare gestionale.",
          ],
          shot: "scheda",
          caption: "Il Codice Fiscale nella scheda dell’ordine",
        },
      },
    },
  },
  en: {
    index: {
      title: "Guides",
      metaTitle: "Guides | Tax code (Codice Fiscale) for eBay orders",
      description:
        "Practical guides for eBay sellers: where to find buyers’ tax code (Codice Fiscale) and VAT number (Partita IVA), how to ask for them and how to use them on invoices.",
      lead: "Answers to the questions eBay sellers ask most about their buyers’ tax codes.",
    },
    solutionTitle: "How FiscalBay helps",
    sourcesTitle: "Sources",
    start: "Start for free",
    signIn: "Sign in",
    back: "All guides",
    updated: (date) => `Updated ${date}`,
    articles: {
      "/guide/trovare-codice-fiscale-ordini-ebay": {
        title: "Where to find the buyer’s tax code (Codice Fiscale) on eBay",
        metaTitle: "Where to find the buyer’s tax code (Codice Fiscale) on eBay",
        nav: "Where to find the tax code",
        description:
          "The buyer’s tax code does not show on the eBay order or in the Seller Hub report. Where it really is and how to get it for every sale.",
        lead: "Open an order on eBay and the tax code (Codice Fiscale) is not there, even if the buyer entered it at checkout. It is not a mistake. eBay saves it, but does not show it on the order page.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          {
            label: "eBay: Seller Hub and the order report (in Italian)",
            href: sourceLinks.sellerHub,
          },
        ],
        sections: [
          {
            title: "Where you will not find it",
            body: [
              "It is not in the shipping details, not on the Seller Hub orders page and not in the order report you can download either. Looking for it there is a waste of time.",
            ],
          },
          {
            title: "Where it is",
            body: [
              "eBay keeps the tax code with the order details and passes it to the services you connect to your store, if you give consent. The connection is read-only, so the service sees your orders but cannot change anything on your account.",
            ],
          },
          {
            title: "How to get buyers to enter it",
            body: [
              "In eBay’s selling preferences, in the Buyers section, you can turn on the request for the tax code (Codice Fiscale), which eBay calls “tax identification number”. From then on the checkout form asks the buyer for it. Some orders still arrive without it.",
            ],
          },
          {
            title: "If the order does not include it",
            body: [
              "If the buyer did not enter it at checkout, the order stays without it. When you need it, the only way is to ask through an eBay message that quotes the order number.",
            ],
          },
          {
            title: "Save it while the order is recent",
            body: [
              "After 90 days eBay hides the buyer’s personal details. If you need the tax code for your accounts, copy or export it before then.",
            ],
          },
        ],
        related: {
          label: "Tax code (Codice Fiscale) and the Italian e-invoice for eBay sales",
          path: "/guide/codice-fiscale-fattura-elettronica-ebay",
        },
        solution: {
          body: [
            "You connect your eBay store once, read-only. From then on FiscalBay reads new orders on its own.",
            "On each order card you find the tax code the buyer entered, to copy in one click or export with the other details.",
            "Orders without a tax code are one filter away, and each one comes with a message ready to ask for it. With Pro you also get a Telegram notification for every new order, with the data in it.",
          ],
          shot: "scheda",
          caption: "The tax code on the order card",
        },
      },
      "/guide/codice-fiscale-non-visibile-ordine-ebay": {
        title: "Tax code (Codice Fiscale) not visible on the eBay order: where the data goes",
        metaTitle: "Tax code (Codice Fiscale) not visible on the eBay order",
        nav: "Tax code not visible",
        description:
          "The buyer says they entered their tax code, but it is not on the eBay order. The data exists: where it goes and how to read it without asking again.",
        lead: "You turned on the tax code request, the buyer swears they entered it, and you cannot find it on the order. They are right. The data is there, eBay just does not show it.",
        published: "2026-11-04",
        updated: "2026-11-10",
        sources: [
          {
            label: "eBay: Seller Hub and the order report (in Italian)",
            href: sourceLinks.sellerHub,
          },
        ],
        sections: [
          {
            title: "Why you cannot see it",
            body: [
              "eBay saves the tax code with the order but leaves it out of the shipping details, the Seller Hub orders page and the downloadable report. That is why so many sellers think the buyer never wrote it.",
            ],
          },
          {
            title: "How to read it",
            body: [
              "The data reaches the seller tools you connect to your store, with your consent and read-only. Once the store is connected, you see it on every order that has it.",
            ],
          },
          {
            title: "Before asking again",
            body: [
              "Asking a buyer for something they already gave confuses them, and often they do not reply. Better to check first whether the order already has it.",
            ],
          },
        ],
        related: {
          label: "Asking an eBay buyer for their tax code (Codice Fiscale)",
          path: "/guide/chiedere-codice-fiscale-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay reads your store’s orders and shows you the tax code the buyer entered. You do not need to ask a second time.",
            "A filter shows only the orders without it, so you write to those buyers alone.",
            "With Pro every new order reaches you on Telegram with the tax code already in the message.",
          ],
          shot: "telegram",
          caption: "A new order on Telegram, with the tax code",
        },
      },
      "/guide/chiedere-codice-fiscale-acquirente-ebay": {
        title: "Asking an eBay buyer for their tax code (Codice Fiscale): the message to send",
        metaTitle: "Asking an eBay buyer for their tax code (Codice Fiscale)",
        nav: "Asking for the tax code",
        description:
          "How to ask an eBay buyer for their tax code after the sale: when to write, what to say and a message to copy.",
        lead: "The order has no tax code and you need it for the invoice. You can ask the buyer, and with the right message replies come more often.",
        published: "2026-11-04",
        updated: "2026-11-05",
        sections: [
          {
            title: "Check the order first",
            body: [
              "Many buyers already enter their tax code at checkout, but eBay does not show it on the order page. Before you write, make sure it is really missing.",
            ],
          },
          {
            title: "What to write",
            body: [
              "Use eBay messages, so the buyer sees at once which purchase you mean and who you are. Include the order number and explain that you need the data for the invoice.",
              "Ask only for the tax code, or for the VAT number (Partita IVA) and company name if they buy for a business. The more precise the request, the less it looks like a scam.",
            ],
          },
          {
            title: "Message template",
            body: [
              "“Hello and thank you for your purchase. To issue the invoice for order 27-10293-84756 I need your Italian tax code (Codice Fiscale), which I will use only for this. If you are buying with an Italian VAT number (Partita IVA), please send that and your company name. You can reply straight to this message. Thank you.”",
            ],
          },
          {
            title: "If they do not reply",
            body: [
              "One reminder after a few days is fine, more is not. If the data never arrives, ask your accountant how to record the sale.",
              "For your next sales, turn on the request for the data at checkout in eBay’s selling preferences.",
            ],
          },
        ],
        related: {
          label: "Where to find the buyer’s tax code (Codice Fiscale) on eBay",
          path: "/guide/trovare-codice-fiscale-ordini-ebay",
        },
        solution: {
          body: [
            "FiscalBay tells you straight away whether the order already has the tax code, so you do not write to buyers who entered it.",
            "If it is missing, the order card has the message already written with the order number. Copy it and send it through eBay messages.",
          ],
          shot: "scheda",
          caption: "The order card shows whether the tax code is already there",
        },
      },
      "/guide/codice-fiscale-fattura-elettronica-ebay": {
        title: "Tax code (Codice Fiscale) and the Italian e-invoice for eBay sales",
        metaTitle: "Tax code (Codice Fiscale) and the e-invoice on eBay",
        nav: "Italian e-invoice",
        description:
          "Which buyer details you need to invoice an eBay sale, to a private buyer or a business, and how to get them without copying them by hand.",
        lead: "For the Italian e-invoice of an eBay sale you have to identify the buyer. A private buyer needs the tax code (Codice Fiscale), a business or professional the VAT number (Partita IVA).",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          {
            label: "Agenzia delle Entrate: how to prepare an e-invoice (in Italian)",
            href: sourceLinks.eInvoice,
          },
        ],
        sections: [
          {
            title: "Selling to a private buyer",
            body: [
              "You need full name, address and tax code. If the customer gives you no delivery address for the invoice, use the recipient code 0000000. The Exchange System (Sistema di Interscambio) then makes it available in their private area on the Agenzia delle Entrate website.",
            ],
          },
          {
            title: "Selling to a business or professional",
            body: [
              "You need company name, address and VAT number, plus the recipient code or certified email address the customer gives you.",
            ],
          },
          {
            title: "When an invoice is due",
            body: [
              "It depends on your VAT scheme, standard or flat-rate, and the type of sale. Your accountant is the person to ask.",
            ],
          },
          {
            title: "Where to get the data",
            body: [
              "Name and address are on the eBay order. The tax code and VAT number are not, because eBay does not show them on the order page or put them in the report.",
            ],
          },
        ],
        related: {
          label: "The buyer’s VAT number (Partita IVA) on eBay orders",
          path: "/guide/partita-iva-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay puts the buyer, billing address, tax code and VAT number of your eBay orders in a single file.",
            "Export it as CSV, or as Excel with Pro, and import it into your invoicing software or send it to your accountant. You still issue invoices from your own software.",
          ],
          shot: "esportazione",
          caption: "Orders exported with tax code and VAT number",
        },
      },
      "/guide/esportare-ordini-ebay-excel-csv": {
        title:
          "Exporting eBay orders to Excel or CSV with tax code (Codice Fiscale) and VAT number",
        metaTitle: "eBay orders to Excel or CSV with the tax code",
        nav: "Export to Excel or CSV",
        description:
          "How to collect the tax code (Codice Fiscale) and VAT number (Partita IVA) of your eBay orders and export them to CSV or Excel, ready for your management or invoicing software.",
        lead: "Connect your eBay store to FiscalBay, read-only. FiscalBay reads your orders and brings in the tax code (Codice Fiscale) and VAT number (Partita IVA) when the buyer entered them and eBay makes them available. Then export the orders to CSV on the Free plan, or to Excel (XLSX) with Pro, and import the file into your management or invoicing software.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sections: [
          {
            title: "What eBay’s report leaves out",
            body: [
              "The order report you download from Seller Hub has the buyer, addresses and amounts, but no column for the tax code or VAT number. To invoice, you would have to add them by hand, order by order.",
            ],
          },
          {
            title: "What the file contains",
            body: [
              "Order number and date, store, buyer, billing address or, when eBay does not provide it, the shipping address, items with SKU and quantity, amounts and currency, payment and shipping status.",
              "Tax code and VAT number have a column each, when the buyer entered them. On the Free plan the file includes them for the orders unlocked in the cycle; for the others the cell stays empty.",
            ],
          },
          {
            title: "CSV with Free, Excel with Pro",
            body: [
              "On the Free plan you export to CSV, with one row per order or per item and the orders of the last 30 days.",
              "With Pro you also export to Excel (XLSX), choose and reorder the columns, save up to 20 configurations and have one year of orders.",
              "On both plans you export everything, a period, a single store or the orders you select. The file can only be downloaded from your account, within 24 hours.",
            ],
          },
          {
            title: "Importing it into your software",
            body: [
              "Every management and invoicing program has its own import template: match the columns of the file to the ones it asks for. Import the tax code and VAT number as text, so leading zeros are kept.",
            ],
          },
          {
            title: "You issue invoices from your own software",
            body: [
              "FiscalBay provides your order data and does not issue e-invoices: you prepare and send them from your invoicing software.",
            ],
          },
        ],
        sources: [
          {
            label: "eBay: Seller Hub and the order report (in Italian)",
            href: sourceLinks.sellerHub,
          },
          { label: "eBay: Seller Hub Reports tab (in Italian)", href: sourceLinks.reports },
        ],
        related: {
          label: "FiscalBay, eBay Seller Hub and Ready Pro compared",
          path: comparisonGuidePath,
        },
        solution: {
          body: [
            "Connect your store once and FiscalBay reads new orders on its own, with tax code and VAT number when they are there.",
            "In the Export section you choose orders, format and columns and download a file ready for your software or your accountant.",
          ],
          shot: "esportazione",
          caption: "Orders exported to Excel",
        },
      },
      "/guide/partita-iva-acquirente-ebay": {
        title: "The buyer’s VAT number (Partita IVA) on eBay orders",
        metaTitle: "The buyer’s VAT number (Partita IVA) on eBay orders",
        nav: "The buyer’s VAT number",
        description:
          "When an eBay order has the buyer’s VAT number, where to find it and what you need to invoice a business or professional.",
        lead: "Buyers purchasing on eBay for their business can enter a VAT number (Partita IVA) at checkout. As with the tax code (Codice Fiscale), eBay saves it with the order but leaves it out of the report.",
        published: "2026-11-03",
        updated: "2026-11-10",
        sources: [
          {
            label: "Agenzia delle Entrate: how to prepare an e-invoice (in Italian)",
            href: sourceLinks.eInvoice,
          },
          {
            label: "Agenzia delle Entrate: VAT number check (in Italian)",
            href: sourceLinks.vatCheck,
          },
        ],
        sections: [
          {
            title: "When the order includes it",
            body: [
              "Only if the buyer entered it, usually when buying for work. It can be there on its own or together with the tax code.",
              "Bear in mind that a company can have a numeric tax code equal to its VAT number.",
            ],
          },
          {
            title: "What you need for the invoice",
            body: [
              "To invoice a business or professional you need company name, address and VAT number, plus the recipient code or certified email address the customer gives you. Whether an invoice is due depends on your regime, and that is worth checking with your accountant.",
            ],
          },
          {
            title: "If it is missing",
            body: [
              "If the buyer is purchasing for a business but did not enter a VAT number, ask for it through an eBay message, together with the company name.",
            ],
          },
        ],
        related: {
          label: "Asking an eBay buyer for their tax code (Codice Fiscale) or VAT number",
          path: "/guide/chiedere-codice-fiscale-acquirente-ebay",
        },
        solution: {
          body: [
            "FiscalBay shows the VAT number on the order card, next to the tax code or in its place, and you copy it in one click.",
            "In the order export it has its own column, so it reaches your invoicing software with everything else.",
          ],
          shot: "esportazione",
          caption: "The VAT number in the order export",
        },
      },
      "/guide/alternativa-probay-codice-fiscale-ebay": {
        title: "ProBay alternative for eBay buyers’ tax codes (Codice Fiscale)",
        metaTitle: "ProBay alternative for eBay buyers’ tax codes",
        nav: "ProBay alternative",
        description:
          "ProBay not working? FiscalBay is the alternative for reading eBay buyers’ tax codes (Codice Fiscale) in your browser, with nothing to install. Start for free.",
        lead: "Looking for a ProBay alternative for eBay buyers’ tax codes (Codice Fiscale)? FiscalBay does more: you read them in your browser, with nothing to install, together with VAT numbers and order exports. And you start for free.",
        published: "2026-11-08",
        updated: "2026-11-08",
        sections: [
          {
            title: "ProBay not working? Carry on with FiscalBay",
            body: [
              "The ProBay app for Windows and Android has not been updated for years and has gone from the main stores. If ProBay crashes or stops showing data, your buyers’ tax codes are still there: eBay saves them with the order and FiscalBay shows them to you.",
            ],
          },
          {
            title: "Can’t download ProBay? With FiscalBay you don’t need to",
            body: [
              "FiscalBay is the ProBay alternative that works in your browser: nothing to download or install, on computer and phone.",
            ],
          },
          {
            title: "eBay buyers’ tax codes without ProBay",
            body: [
              "eBay does not show the tax code on the order page or in the Seller Hub report. With FiscalBay you find it on the order card, together with the VAT number, when the buyer has entered them.",
            ],
          },
          {
            title: "How to switch from ProBay to FiscalBay in two steps",
            body: [
              "Create a free account, with no card, and connect your eBay store. From then on new orders arrive by themselves, with nothing to import.",
              "FiscalBay only reads your orders: your store stays exactly as it is.",
            ],
          },
        ],
        comparison: {
          title: "Why move from ProBay to FiscalBay",
          headers: ["Feature", "FiscalBay", "ProBay"],
          notStated: "Not stated",
          contrast: true,
          rows: [
            ["To get started", "Free", "€0.99 to download"],
            ["Installation", "None, it opens in the browser", "App to install"],
            ["Updates", "Ongoing", "Stopped years ago"],
            ["Buyer’s VAT number", "Yes", "Not stated"],
            ["Order export", "CSV, Excel with Pro", "Not stated"],
            ["Telegram notifications", "With Pro", "Not stated"],
            ["Multiple stores", "With Pro", "Not stated"],
            ["Order history", "Up to one year with Pro", "No data saved"],
            ["Support", "Yes", "No contact details on its website"],
          ],
          note: "FiscalBay is an independent service with no ties to ProBay.",
        },
        related: {
          label: "Where to find the buyer’s tax code (Codice Fiscale) on eBay",
          path: "/guide/trovare-codice-fiscale-ordini-ebay",
        },
        solution: {
          body: [
            "Open the order, copy the tax code in one click and make the invoice. No more writing to buyers for data they have already entered.",
            "With Pro you get every new order on Telegram and export everything to Excel. Start for free and connect your store: FiscalBay takes care of the rest.",
          ],
          shot: "scheda",
          caption: "The tax code on the order card",
        },
      },
      [comparisonGuidePath]: {
        title: "Tax codes (Codice Fiscale) on eBay: FiscalBay, Seller Hub and Ready Pro",
        metaTitle: "FiscalBay, eBay Seller Hub and Ready Pro",
        nav: "Seller Hub and Ready Pro",
        description:
          "FiscalBay, eBay Seller Hub and Ready Pro compared: where you see buyers’ tax codes (Codice Fiscale) and VAT numbers, search, multiple stores, export and invoices.",
        lead: "To get eBay buyers’ tax codes (Codice Fiscale) and VAT numbers (Partita IVA) you have three options: eBay’s Seller Hub, a full management program such as Ready Pro, or FiscalBay. Here is what each one does, with sources.",
        published: "2026-11-10",
        updated: "2026-11-10",
        sections: [
          {
            title: "eBay Seller Hub",
            body: [
              "It is eBay’s free tool for sellers. You search orders by number, period and status, download reports as CSV or XLSX and work on one account at a time.",
              "The order report has the buyer, addresses and amounts, but no column for the tax code or VAT number.",
            ],
          },
          {
            title: "Ready Pro",
            body: [
              "It is a Windows management program to install, with stock, sales and accounting. With its eBay Gateway module it downloads orders and creates customer records.",
              "It imports the tax code when eBay sends it; when it is missing, its manual says to contact the customer again. It handles multiple eBay accounts and other marketplaces and issues e-invoices with a plugin.",
            ],
          },
          {
            title: "FiscalBay",
            body: [
              "It is a web service you open in the browser, connected to your store read-only. It reads orders on its own and shows the tax code and VAT number on each order card, when the buyer entered them and eBay makes them available.",
              "You search for them like an order number and export them to CSV, or to Excel with Pro. With Pro you also connect more stores. It does not issue invoices: the data goes into your invoicing software.",
            ],
          },
          {
            title: "Which one to choose",
            body: [
              "If eBay’s orders and reports are enough for you, Seller Hub. If you want a full Windows management program, with stock and invoicing, Ready Pro.",
              "If you already use invoicing software and need the tax codes and VAT numbers of your eBay orders without changing it, FiscalBay.",
            ],
          },
        ],
        comparison: {
          title: "FiscalBay, Seller Hub and Ready Pro",
          headers: ["Feature", "FiscalBay", "eBay Seller Hub", "Ready Pro"],
          notStated: "Not stated",
          rows: [
            ["What it is", "Web service", "eBay tool", "Windows management program"],
            ["Installation", { yes: "None" }, { yes: "None" }, "To install"],
            [
              "Buyer’s tax code",
              { yes: "On the order card" },
              "Not in the order report",
              { yes: "In the customer record, when eBay sends it" },
            ],
            [
              "Buyer’s VAT number",
              { yes: "On the order card" },
              "Not in the order report",
              "Not stated",
            ],
            [
              "Reading orders",
              { yes: "Automatic" },
              "Orders already on eBay",
              "Started by hand or scheduled",
            ],
            [
              "Order search",
              { yes: "Also by tax code and VAT number" },
              { yes: "By number, period and status" },
              { yes: "Program views and filters" },
            ],
            [
              "Multiple eBay stores",
              { yes: "With Pro" },
              "One account at a time",
              { yes: "With paid extra accounts" },
            ],
            [
              "Order export",
              { yes: "CSV, Excel with Pro" },
              { yes: "CSV and XLSX" },
              { yes: "CSV, TXT and XLS" },
            ],
            ["E-invoices", "No", "Not stated", { yes: "With a paid plugin" }],
            ["Price", "Free plan, Pro from €4.90 a month + VAT", "Free", "€1,100 + VAT to start"],
          ],
          note: "Data checked on 10 November 2026 on eBay’s help pages and on Ready Pro’s public website, price list and manual. FiscalBay is an independent service with no ties to eBay or Ready Pro.",
        },
        sources: [
          {
            label: "eBay: Seller Hub and the order report (in Italian)",
            href: sourceLinks.sellerHub,
          },
          { label: "eBay: Seller Hub Reports tab (in Italian)", href: sourceLinks.reports },
          { label: "eBay: finding the items you sold (in Italian)", href: sourceLinks.soldItems },
          { label: "eBay: team access (in Italian)", href: sourceLinks.teamAccess },
        ],
        solution: {
          body: [
            "Connect your eBay store in a few minutes and find the tax code and VAT number on every order card, ready to copy or export for your invoicing software.",
            "Start for free, with nothing to install and no need to change your software.",
          ],
          shot: "scheda",
          caption: "The tax code on the order card",
        },
      },
    },
  },
};
