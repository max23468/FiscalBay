import { env } from "cloudflare:workers";

import { appCopy, type AppCopy } from "../app-copy";
import { lifetimeSlots, priceGeneration, type LifetimeOffer } from "../catalog";
import { planDiagnostics } from "../support";
import { trialDays } from "../domain/grants.server";
import { lifetimeOfferState, unusedCredit } from "../domain/lifetime.server";
import type { ActiveSession } from "../domain/sessions.server";
import type { SignInMethods } from "../domain/sign-in-methods.server";
import { appVersion } from "../domain/support.server";
import type { Language } from "../i18n";
import { formatDate } from "../format";
import { dayMilliseconds } from "../time";
import type {
  OrdersNotice,
  AccountView,
  DiagnosticsView,
  NotificationView,
  OrderView,
  StoreView,
  TaxIdentifierView,
} from "../view-models";

/**
 * Scenari sintetici dell'anteprima. Nessun dato reale: nomi, codici e ordini
 * sono inventati, le email sono alias casuali di eBay o usano domini non registrati.
 * I valori da sbloccare restano in questo modulo server e arrivano al browser
 * solo dopo lo sblocco simulato.
 */

import {
  cf,
  incomingSeeds,
  minutesAgo,
  previewNow,
  readNotices,
  seeds,
  stores,
  storeView,
  toOrder,
  type OrderSeed,
} from "./scenario-orders.server";
import { scenarioIds, scenarioText, type ScenarioId } from "./scenario-text";

export { previewNow, scenarioIds, type ScenarioId };
/** Email dell'account confermata: prima, come nell'area reale, si raggiungono soltanto gli Ordini. */
export function scenarioVerified(scenario: Pick<Scenario, "onboarding">) {
  return scenario.onboarding.find((step) => step.label === "stepEmail")?.done !== false;
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (scenarioIds as readonly string[]).includes(value);
}

export function scenarioOptions(language: Language) {
  const reference = formatDate(previewNow, language);
  const clock =
    language === "it"
      ? `Simulazione fissata al ${reference} (Europe/Rome).`
      : `Simulation fixed at ${reference} (Europe/Rome).`;
  return scenarioIds.map((id) => ({
    id,
    ...scenarioText[id][language],
    focus: `${scenarioText[id][language].focus} ${clock}`,
  }));
}

export interface Scenario {
  id: ScenarioId;
  now: string;
  account: AccountView;
  stores: StoreView[];
  orders: OrderView[];
  incoming: OrderView[];
  view: "list" | "no-store" | "loading" | "empty";
  notices: OrdersNotice[];
  syncRunning: boolean;
  ebayDown: boolean;
  /** Letture sospese da FiscalBay per manutenzione: le azioni di eBay come con `ebayDown`. */
  ebayMaintenance: boolean;
  /** Auth o database non rispondono: le pagine non mostrano dati. */
  unavailable: boolean;
  /** Cancellazione dell'account confermata: al posto dell'area, l'esito della conferma. */
  deleting: boolean;
  elsewhere: boolean;
  notifications: NotificationView[];
  sessions: ActiveSession[];
  /** Metodi di accesso dimostrativi della Sicurezza. */
  signInMethods: SignInMethods;
  diagnostics: DiagnosticsView;
  telegramChat: string | null;
  /** Consegna ferma della chat collegata, come in Impostazioni › Notifiche dell'area reale. */
  telegramFailure: "blocked" | "unreachable" | null;
  saveFailsOnce: boolean;
  /** Proposta del consenso marketing dopo i primi passi, come negli Ordini reali. */
  marketingProposal?: boolean;
  /** Stripe non risponde: l'acquisto simulato fallisce. */
  stripeDown: boolean;
  /** I venti posti lifetime sono tutti occupati. */
  lifetimeSoldOut: boolean;
  /** Senza capacità per nuovi Premium: acquisti e prova sospesi. */
  purchasesClosed: boolean;
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  /** Valori degli ordini bloccati: restano sul server fino allo sblocco. */
  lockedValues: Record<string, TaxIdentifierView[]>;
}

/** Fine del ciclo di sblocchi in corso negli scenari Free. */
const cycleEndsAt = "2026-10-02T12:20:00Z";

const account = (overrides: Partial<AccountView> = {}): AccountView => ({
  name: "Laura Martini",
  profile: {
    firstName: "Laura",
    lastName: "Martini",
    accountType: "business",
    companyName: "Martini ricambi",
  },
  email: "laura@vintagegarageitalia.it",
  plan: "free",
  trialAvailable: true,
  quota: { used: 3, limit: 5, cycleEndsAt },
  ...overrides,
});

/** Premium senza quota: abbonamento annuale salvo `overrides`. */
const premiumAccount = (overrides: Partial<AccountView> = {}): AccountView =>
  account({
    plan: "premium",
    trialAvailable: false,
    quota: undefined,
    premium: { period: "annual", renewsAt: "2027-03-12T10:00:00Z" },
    ...overrides,
  });

/** Prova Premium in corso fino a `endsAt`, senza abbonamento. */
const trialAccount = (endsAt: string): AccountView =>
  account({ plan: "premium", trialAvailable: false, quota: undefined, trial: { endsAt } });

/** Notifica di un negozio con i testi della campanella reale, nelle due lingue. */
const storeNote = (
  make: (t: AppCopy["shell"]["storeNotifications"]) => { title: string; body: string },
) => ({
  it: make(appCopy.it.shell.storeNotifications),
  en: make(appCopy.en.shell.storeNotifications),
});

const text = {
  maintenance: {
    it: {
      title: "Manutenzione programmata",
      body: "Il 2 ottobre dalle 6:00 alle 6:30 la sincronizzazione sarà sospesa. Gli ordini restano consultabili.",
    },
    en: {
      title: "Scheduled maintenance",
      body: "On 2 October from 6:00 to 6:30 syncing will be paused. Orders remain available.",
    },
  },
  // Gli stessi testi della campanella reale.
  ebayDown: storeNote((t) => ({ title: t.ebayDownTitle, body: t.ebayDownBody })),
  readFailed: storeNote((t) => ({
    title: t.readFailedTitle,
    body: t.readFailedBody(stores.vintage.name),
  })),
  inactivity: storeNote((t) => ({ title: t.inactivityTitle, body: t.inactivityBody })),
  expired: storeNote((t) => ({ title: t.expiredTitle, body: t.expiredBody(stores.outlet.name) })),
};

// Come nell'area reale, ogni sessione riporta il giorno in cui è stata aperta.
const sessions = (language: Language): ActiveSession[] => [
  {
    id: "ses-1",
    device: language === "it" ? "Safari su macOS" : "Safari on macOS",
    lastActiveAt: previewNow,
    createdAt: minutesAgo(4_352),
    current: true,
  },
  {
    id: "ses-2",
    device: language === "it" ? "Safari su iPhone" : "Safari on iPhone",
    lastActiveAt: minutesAgo(180),
    createdAt: minutesAgo(20_213),
    current: false,
  },
  {
    id: "ses-3",
    device: language === "it" ? "Chrome su Windows" : "Chrome on Windows",
    lastActiveAt: minutesAgo(2_900),
    createdAt: minutesAgo(43_571),
    current: false,
  },
];

/** Fine della prova attivata per finta all'istante dell'anteprima, con la durata reale. */
const startedTrialEnd = new Date(
  Date.parse(previewNow) + trialDays * dayMilliseconds,
).toISOString();

export function loadScenario(
  id: ScenarioId,
  language: Language,
  unlocked: ReadonlySet<string>,
  /**
   * `trialStarted`: la prova disponibile è stata attivata nell'anteprima; `resumed`: le letture
   * in pausa per inattività sono state riprese.
   */
  { trialStarted = false, resumed = false }: { trialStarted?: boolean; resumed?: boolean } = {},
): Scenario {
  const note = (
    key: keyof typeof text,
    extra: Omit<NotificationView, "title" | "body">,
  ): NotificationView => ({
    ...text[key][language],
    ...extra,
  });
  // Fasi con le stesse parole e date assolute dell'area reale.
  const phases = appCopy[language].settings.support.diag.phases;
  const readAt = (minutes: number) => formatDate(minutesAgo(minutes), language);
  // La versione distribuita, come nell'area reale, con il segno dell'anteprima.
  const version = appVersion(env);
  const previewLabel = language === "it" ? "anteprima" : "preview";
  const diagnostics = (overrides: Partial<DiagnosticsView> = {}): DiagnosticsView => ({
    version: version ? `${version} (${previewLabel})` : previewLabel,
    storeRef: "neg_7f3a91c2",
    syncPhase: phases.ok(readAt(5)),
    errorCode: null,
    rights: "",
    correlationId: "c0a8f3e1-5b2d-4e7a-9c11-7d2f0b6e4a90",
    ...overrides,
  });

  const common = {
    id,
    now: previewNow,
    incoming: [] as OrderView[],
    view: "list" as Scenario["view"],
    notices: [] as OrdersNotice[],
    syncRunning: false,
    ebayDown: false,
    ebayMaintenance: false,
    unavailable: false,
    deleting: false,
    elsewhere: false,
    sessions: sessions(language),
    signInMethods: {
      accounts: { password: true, google: true, ebay: false },
      passkeys: [{ id: "preview-passkey", name: "MacBook Air", createdAt: "2026-09-21T10:12:00Z" }],
    },
    telegramChat: null,
    telegramFailure: null,
    saveFailsOnce: false,
    stripeDown: false,
    lifetimeSoldOut: false,
    purchasesClosed: false,
    onboarding: [
      { label: "stepAccount" as const, done: true },
      { label: "stepEmail" as const, done: true },
      { label: "stepStore" as const, done: true },
      { label: "stepSync" as const, done: true },
    ],
    notifications: [
      note("maintenance", {
        id: "n-maint",
        kind: "service",
        tone: "info",
        at: minutesAgo(300),
        read: false,
      }),
    ],
    diagnostics: diagnostics(),
  };

  const freeStores = [
    storeView("vintage"),
    storeView("outlet", {
      connection: "paused",
      pauseReason: "plan",
      lastSyncAt: minutesAgo(8_640),
      recent: [{ at: minutesAgo(8_640), ok: true, newOrders: 0 }],
    }),
  ];
  const vintageSeeds = seeds.filter((seed) => seed.store === "vintage");
  const withoutRetro = seeds.filter((seed) => seed.store !== "retro");
  const premiumStores = [
    storeView("vintage", { notifications: true, historyDays: 365, targetMinutes: 10 }),
    storeView("outlet", { notifications: false, historyDays: 365, targetMinutes: 10 }),
    storeView("retro", { notifications: true, historyDays: 365, targetMinutes: 10 }),
  ];

  type Draft = Omit<Scenario, "orders" | "lockedValues"> & { seeds: OrderSeed[] };
  /** Free ordinario: un negozio attivo e uno in pausa per il piano. */
  const free = (overrides: Partial<Draft> = {}): Draft => ({
    ...common,
    account: account(),
    stores: freeStores,
    seeds: vintageSeeds,
    ...overrides,
  });
  /** Premium annuale con tre negozi e tutti gli ordini. */
  const premium = (overrides: Partial<Draft> = {}): Draft => ({
    ...common,
    account: premiumAccount(),
    stores: premiumStores,
    seeds,
    ...overrides,
  });

  let scenario: Draft;
  switch (id) {
    case "ordinario":
    case "sblocco-non-riuscito":
      scenario = free();
      break;
    case "proposta-consenso":
      scenario = free({
        marketingProposal: true,
      });
      break;
    case "fine-promozione":
      scenario = free({
        account: account({
          quota: { used: 7, limit: 10, cycleEndsAt, nextLimit: 5 },
        }),
      });
      break;
    case "free-inattivo": {
      // Pausa dopo 37 giorni senza accessi; la ripresa simulata riporta il Free ordinario.
      const pausedAt = minutesAgo(1_440);
      scenario = free({
        stores: resumed
          ? freeStores
          : [
              storeView("vintage", {
                connection: "paused",
                pauseReason: "inactivity",
                lastSyncAt: pausedAt,
                recent: [{ at: pausedAt, ok: true, newOrders: 0 }],
              }),
              freeStores[1]!,
            ],
        notifications: resumed
          ? common.notifications
          : [
              note("inactivity", {
                id: `inactivity:${pausedAt}`,
                kind: "inactivity",
                tone: "warning",
                at: pausedAt,
                read: false,
                href: "negozi",
              }),
              ...common.notifications,
            ],
      });
      break;
    }
    case "lista-d-attesa":
      scenario = free({
        account: account({ waitlisted: true, quota: { used: 0, limit: 0, cycleEndsAt: null } }),
        stores: [storeView("vintage", { importedOrders: 12 })],
        // Senza Free nessun ordine è mai stato sbloccato: ogni dato fiscale presente resta bloccato.
        seeds: vintageSeeds.map((seed) =>
          seed.fiscal.state === "available"
            ? {
                ...seed,
                fiscal: {
                  state: "locked",
                  shownAs: seed.fiscal.identifiers.some((id) => id.type === "CF") ? "CF" : "PIVA",
                },
                lockable: seed.fiscal.identifiers,
              }
            : seed,
        ),
        notices: [{ kind: "waitlist", purchase: true }],
      });
      break;
    case "acquisti-sospesi":
      scenario = free({
        account: account({ trialAvailable: false }),
        purchasesClosed: true,
      });
      break;
    case "quota-esaurita":
      scenario = free({
        account: account({ quota: { used: 5, limit: 5, cycleEndsAt } }),
        seeds: vintageSeeds.map((seed) =>
          seed.id === "ord-02"
            ? {
                ...seed,
                fiscal: { state: "locked", shownAs: "CF" },
                lockable: [cf("RSSMRA80A41H501Y")],
              }
            : seed,
        ),
        notices: [{ kind: "quota", until: cycleEndsAt }],
      });
      break;
    case "aggiornamento":
      scenario = free({
        stores: [storeView("vintage", { syncing: true }), freeStores[1]!],
        // Un acquisto non ancora pagato con il dato presente: lo sblocco attende il pagamento.
        seeds: vintageSeeds.map((seed) =>
          seed.id === "ord-08"
            ? { ...seed, fiscal: { state: "locked", shownAs: "CF", hold: "unpaid" } }
            : seed,
        ),
        syncRunning: true,
        incoming: incomingSeeds.map((seed) => toOrder(seed, freeStores)),
        diagnostics: diagnostics({
          syncPhase: phases.running,
        }),
      });
      break;
    case "ebay-non-disponibile":
      scenario = free({
        stores: [
          storeView("vintage", {
            lastSyncAt: minutesAgo(125),
            consentExpiresAt: minutesAgo(-12 * 24 * 60),
            recent: [
              { at: minutesAgo(5), ok: false, newOrders: 0 },
              { at: minutesAgo(35), ok: false, newOrders: 0 },
              { at: minutesAgo(125), ok: true, newOrders: 1 },
            ],
          }),
          freeStores[1]!,
        ],
        ebayDown: true,
        // Il consenso in scadenza resta segnalato, con Ricollega sospeso finché eBay non risponde.
        notices: [
          { kind: "ebay-down", at: minutesAgo(125) },
          {
            kind: "consent-expiring",
            storeId: stores.vintage.id,
            storeName: stores.vintage.name,
            at: minutesAgo(-12 * 24 * 60),
            ebayEnvironment: "production",
          },
        ],
        notifications: [
          note("ebayDown", {
            id: "n-ebay",
            kind: "ebay-down",
            tone: "warning",
            at: minutesAgo(35),
            read: false,
          }),
          ...common.notifications,
        ],
        diagnostics: diagnostics({
          syncPhase: phases.failed(readAt(5)),
          errorCode: "UPSTREAM_UNAVAILABLE",
        }),
      });
      break;
    case "letture-sospese":
      scenario = free({
        // Le letture si sono fermate alla sospensione: l'ultima riuscita resta quella di allora.
        stores: [
          storeView("vintage", {
            lastSyncAt: minutesAgo(95),
            recent: [
              { at: minutesAgo(95), ok: true, newOrders: 1 },
              { at: minutesAgo(125), ok: true, newOrders: 0 },
              { at: minutesAgo(155), ok: true, newOrders: 2 },
            ],
          }),
          freeStores[1]!,
        ],
        ebayDown: true,
        ebayMaintenance: true,
        notices: [{ kind: "ebay-down", at: minutesAgo(95), maintenance: true }],
      });
      break;
    case "negozio-sospeso": {
      // Pausa dell'assistenza, come dopo una revisione antiabuso: niente letture né ripresa.
      const pausedAt = minutesAgo(2_880);
      scenario = free({
        stores: [
          storeView("vintage", {
            connection: "paused",
            pauseReason: "admin",
            lastSyncAt: pausedAt,
            recent: [{ at: pausedAt, ok: true, newOrders: 0 }],
          }),
        ],
      });
      break;
    }
    case "negozio-scaduto": {
      const troubled = [
        // Consenso ancora valido che scade fra dodici giorni: il pannello invita a ricollegare.
        // Le ultime due letture non sono riuscite: gli ordini restano quelli di 70 minuti fa.
        {
          ...premiumStores[0]!,
          consentExpiresAt: minutesAgo(-12 * 24 * 60),
          consentExpiring: true,
          lastSyncAt: minutesAgo(70),
          recent: [
            { at: minutesAgo(10), ok: false, newOrders: 0 },
            { at: minutesAgo(40), ok: false, newOrders: 0 },
            { at: minutesAgo(70), ok: true, newOrders: 1 },
          ],
        },
        storeView("outlet", {
          connection: "reconnect_required",
          issue: "reconnect",
          consentExpiresAt: minutesAgo(1_500),
          notifications: false,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: minutesAgo(1_500),
          recent: [
            { at: minutesAgo(1_440), ok: false, newOrders: 0 },
            { at: minutesAgo(1_500), ok: true, newOrders: 1 },
          ],
        }),
        storeView("retro", {
          connection: "error",
          issue: "permissions",
          notifications: true,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: null,
          importedOrders: 0,
          recent: [{ at: minutesAgo(20), ok: false, newOrders: 0 }],
        }),
        storeView("bottega", {
          connection: "error",
          issue: "unverifiable",
          notifications: false,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: minutesAgo(4_300),
          recent: [
            { at: minutesAgo(40), ok: false, newOrders: 0 },
            { at: minutesAgo(4_300), ok: true, newOrders: 0 },
          ],
        }),
      ];
      scenario = premium({
        stores: troubled,
        seeds: withoutRetro,
        telegramChat: "Magazzino Vintage",
        notices: [
          { kind: "store-issue", storeId: stores.outlet.id, storeName: stores.outlet.name },
          {
            kind: "consent-expiring",
            storeId: stores.vintage.id,
            storeName: stores.vintage.name,
            at: troubled[0]!.consentExpiresAt!,
            ebayEnvironment: "production",
          },
          {
            kind: "store-read-failed",
            storeId: stores.vintage.id,
            storeName: stores.vintage.name,
            at: minutesAgo(70),
          },
        ],
        notifications: [
          // Come nell'area reale, il consenso in scadenza si segnala da trenta giorni prima.
          {
            id: "n-expiring",
            kind: "store-expiring",
            tone: "warning",
            title: appCopy[language].shell.storeNotifications.expiringTitle,
            body: appCopy[language].shell.storeNotifications.expiringBody(
              stores.vintage.name,
              formatDate(troubled[0]!.consentExpiresAt!, language, "date"),
            ),
            at: minutesAgo(18 * 24 * 60),
            read: false,
            href: `negozi/${stores.vintage.id}`,
          },
          note("readFailed", {
            id: "n-read-failed",
            kind: "store-read-failed",
            tone: "warning",
            at: minutesAgo(40),
            read: false,
            href: `negozi/${stores.vintage.id}`,
          }),
          note("expired", {
            id: "n-expired",
            kind: "store-expired",
            tone: "warning",
            at: minutesAgo(1_440),
            read: false,
            href: `negozi/${stores.outlet.id}`,
          }),
          ...common.notifications,
        ],
        diagnostics: diagnostics({
          storeRef: "neg_2b81d0fa",
          syncPhase: phases.reconnect,
          errorCode: "STORE_RECONNECT_REQUIRED",
        }),
      });
      break;
    }
    case "dati-discordanti":
      scenario = premium({
        seeds: seeds.map((seed) => {
          if (seed.id === "ord-02")
            return {
              ...seed,
              buyerName: "  MARIA   ROSSI  ",
              billingAddress: {
                line: `via ${"esempio".repeat(40)} 12B`,
                city: "roma",
                postalCode: "00100",
                province: "rm",
                countryCode: "IT",
              },
              fiscal: {
                state: "available",
                identifiers: [{ ...cf("RSSMRA80A41H501Y"), updated: true }],
              },
            };
          // Indirizzo tutto in maiuscolo e cellulare senza prefisso, come possono arrivare da eBay.
          if (seed.id === "ord-09")
            return {
              ...seed,
              billingAddress: {
                line: "VIA DELL'ORTO 12B",
                postalCode: "26866",
                city: "SANT'ANGELO LODIGIANO",
                province: "LO",
                countryCode: "IT",
              },
              phone: "333 000 1009",
              fiscal: { state: "available", identifiers: [cf("MRNSRA90L41H50LE", "unverifiable")] },
            };
          if (seed.id === "ord-03")
            return {
              ...seed,
              reconciliationIssue: true,
              buyerName: null,
              buyerUsername: null,
              phone: null,
              email: null,
              billingAddress: null,
              shipTo: null,
              maskedContacts: ["name", "phone", "email", "billingAddress", "recipient"],
              fiscal: { state: "missing", reason: "masked" },
            };
          // Valori letti in precedenza e condizione dell'ultima lettura.
          const notice = readNotices[seed.id];
          if (notice && seed.fiscal.state === "available")
            return { ...seed, fiscal: { ...seed.fiscal, notice } };
          if (seed.id === "ord-11")
            return { ...seed, fiscal: { state: "missing", reason: "masked" } };
          // Alias eBay e numero non riconoscibile: niente email precompilata né collegamento.
          if (seed.id === "ord-14")
            return {
              ...seed,
              phone: "interno 14",
              email: "c3f0a1b2@members.ebay.com",
              fiscal: { state: "missing", reason: "removed" },
            };
          if (seed.id === "ord-05") {
            return {
              ...seed,
              suggestion: {
                value: "DSNGNN70E20A662P",
                sourceOrder: "03-88120-44391",
                sourceDate: "2026-08-02T10:00:00Z",
                sourceStore: premiumStores[0]!.name,
                source: "ebay_trading_get_orders",
                issuingCountry: "IT",
                identifier: cf("DSNGNN70E20A662P"),
                conflict: true,
              },
            };
          }
          // Acquirente estero: eBay non riporta il Codice Fiscale.
          if (seed.id === "ord-06")
            return {
              ...seed,
              shipTo: { name: "Lucía Martín", locality: "Madrid", country: "ES" },
              buyerName: "Lucía Martín",
              buyerUsername: "lmartin_es",
              billingAddress: {
                line: "Calle Mayor 10",
                postalCode: "28013",
                city: "Madrid",
                province: null,
                countryCode: "ES",
              },
              fiscal: { state: "missing", reason: "foreign", country: "ES" },
            };
          return seed;
        }),
        telegramChat: "Magazzino Vintage",
      });
      break;
    case "primo-accesso":
      scenario = free({
        account: account({ quota: undefined, trialAvailable: false }),
        stores: [],
        seeds: [],
        view: "no-store",
        elsewhere: true,
        onboarding: [
          { label: "stepAccount", done: true },
          { label: "stepEmail", done: true },
          { label: "stepStore", done: false },
          { label: "stepSync", done: false },
        ],
        notifications: [],
        diagnostics: diagnostics({
          storeRef: null,
          syncPhase: phases.none,
        }),
      });
      break;
    case "email-da-confermare":
      scenario = free({
        account: account({ quota: undefined, trialAvailable: false }),
        stores: [],
        seeds: [],
        view: "no-store",
        onboarding: [
          { label: "stepAccount", done: true },
          { label: "stepEmail", done: false },
          { label: "stepStore", done: false },
          { label: "stepSync", done: false },
        ],
        notifications: [],
        diagnostics: diagnostics({ storeRef: null, syncPhase: phases.none }),
      });
      break;
    case "prima-sincronizzazione":
      // Come nell'area reale appena dopo il collegamento: lettura avviata, nessun ordine letto,
      // e la prova non ancora disponibile.
      scenario = free({
        account: account({
          quota: { used: 0, limit: 5, cycleEndsAt: "2026-10-04T12:55:00Z" },
          trialAvailable: false,
        }),
        stores: [
          storeView("vintage", {
            syncing: true,
            importing: true,
            importedOrders: 0,
            lastSyncAt: null,
            connectedAt: minutesAgo(1),
            recent: [],
          }),
        ],
        seeds: [],
        syncRunning: true,
        view: "empty",
        notices: [{ kind: "importing", count: 0 }],
        onboarding: [
          { label: "stepAccount", done: true },
          { label: "stepEmail", done: true },
          { label: "stepStore", done: true },
          { label: "stepSync", done: false },
        ],
        notifications: [],
        diagnostics: diagnostics({
          syncPhase: phases.importing,
        }),
      });
      break;
    case "importazione":
      scenario = free({
        account: account({ quota: { used: 0, limit: 5, cycleEndsAt: "2026-10-04T12:55:00Z" } }),
        stores: [
          storeView("vintage", {
            syncing: true,
            importing: true,
            importedOrders: 4,
            lastSyncAt: minutesAgo(2),
            connectedAt: minutesAgo(6),
          }),
        ],
        seeds: vintageSeeds.slice(0, 4),
        syncRunning: false,
        notices: [{ kind: "importing", count: 4 }],
        diagnostics: diagnostics({
          syncPhase: phases.importing,
        }),
      });
      break;
    case "nessun-ordine":
      scenario = free({
        account: account({ quota: { used: 0, limit: 5, cycleEndsAt } }),
        stores: [storeView("vintage", { importedOrders: 0 })],
        seeds: [],
        view: "empty",
      });
      break;
    case "caricamento":
      scenario = free({
        seeds: [],
        view: "loading",
      });
      break;
    case "cancellazione-in-corso":
      scenario = free({
        stores: [],
        seeds: [],
        deleting: true,
        notifications: [],
      });
      break;
    case "servizio-non-disponibile":
      scenario = free({
        stores: [],
        seeds: [],
        unavailable: true,
        notifications: [],
      });
      break;
    case "prova-premium":
    case "prova-in-scadenza":
    case "prova-con-abbonamento":
    case "prova-con-abbonamento-disdetto":
      scenario = premium({
        account:
          id === "prova-con-abbonamento" || id === "prova-con-abbonamento-disdetto"
            ? {
                ...trialAccount("2026-10-06T10:00:00Z"),
                payment: {
                  state: "scheduled",
                  period: "monthly",
                  chargeAt: "2026-10-06T10:00:00Z",
                  ...(id === "prova-con-abbonamento-disdetto" ? { cancelled: true as const } : {}),
                },
              }
            : trialAccount(
                id === "prova-premium" ? "2026-10-06T10:00:00Z" : "2026-09-29T09:00:00Z",
              ),
        // La prova comprende le notifiche Telegram, spente senza una chat collegata, legge con
        // la cadenza Premium e ha importato l'anno di storico.
        stores: [
          storeView("vintage", { notifications: false, historyDays: 365, targetMinutes: 10 }),
          storeView("outlet", { notifications: false, historyDays: 365, targetMinutes: 10 }),
        ],
        seeds: withoutRetro,
      });
      break;
    case "prova-terminata":
      // Dopo la prova restano sbloccati gli ordini con il dato arrivato durante la prova:
      // nello scenario sono quelli già disponibili, gli altri seguono la quota del ciclo.
      scenario = free({
        account: account({ trialAvailable: false }),
      });
      break;
    case "pagamento-in-attivazione":
    case "rinnovo-non-riuscito":
    case "pagamento-rimborsato":
    case "lifetime-rimborsato":
    case "stripe-non-disponibile":
      scenario = free({
        account: account({
          // Senza copertura né abbonamento aperto la prova mai usata resta disponibile, come
          // nell'area reale.
          trialAvailable: id === "lifetime-rimborsato",
          ...{
            "pagamento-in-attivazione": { payment: { state: "pending" as const } },
            "rinnovo-non-riuscito": {
              payment: {
                state: "renewal-failed" as const,
                protectedUntil: "2026-10-02T10:00:00Z",
              },
            },
            "pagamento-rimborsato": {
              payment: { state: "refunded" as const, renewsAt: "2026-10-13T10:00:00Z" },
            },
            "lifetime-rimborsato": {
              payment: { state: "refunded" as const, lifetime: true as const },
            },
            "stripe-non-disponibile": {},
          }[id],
        }),
        stripeDown: id === "stripe-non-disponibile",
      });
      break;
    case "lifetime-esaurito":
      scenario = free({
        account: account({ trialAvailable: false }),
        lifetimeSoldOut: true,
      });
      break;
    case "premium":
      scenario = premium({
        telegramChat: "Magazzino Vintage",
        saveFailsOnce: true,
      });
      break;
    case "telegram-bloccato":
    case "telegram-non-consegnato":
      scenario = premium({
        telegramChat: "Magazzino Vintage",
        telegramFailure: id === "telegram-bloccato" ? "blocked" : "unreachable",
      });
      break;
    case "cambio-rinnovo":
      scenario = premium({
        account: premiumAccount({
          premium: { period: "monthly", renewsAt: "2026-10-13T10:00:00Z", nextPeriod: "annual" },
        }),
        stores: [premiumStores[0]!],
        seeds: vintageSeeds,
      });
      break;
    case "rinnovo-disdetto":
      scenario = premium({
        account: premiumAccount({
          premium: { period: "monthly", renewsAt: null, endsAt: "2026-10-13T10:00:00Z" },
        }),
      });
      break;
    case "passaggio-a-vita":
      scenario = premium({
        account: premiumAccount({
          premium: { period: "monthly", renewsAt: "2026-10-13T10:00:00Z" },
          payment: { state: "pending", lifetime: true },
        }),
        stores: [premiumStores[0]!],
        seeds: vintageSeeds,
      });
      break;
    case "premium-a-vita-concesso":
      scenario = premium({
        account: premiumAccount({
          premium: { period: "lifetime", renewsAt: null, granted: true },
        }),
        stores: [premiumStores[0]!],
        seeds: vintageSeeds,
      });
      break;
    case "premium-concesso":
      scenario = premium({
        account: premiumAccount({
          premium: undefined,
          grant: { endsAt: "2026-10-27T13:00:00Z" },
        }),
        stores: [premiumStores[0]!],
        seeds: vintageSeeds,
      });
      break;
    case "premium-a-vita":
      scenario = premium({
        account: premiumAccount({
          premium: { period: "lifetime", renewsAt: null },
        }),
        stores: [
          premiumStores[0]!,
          storeView("outlet", {
            connection: "paused",
            pauseReason: "manual",
            notifications: false,
            historyDays: 365,
            targetMinutes: 10,
            lastSyncAt: minutesAgo(2_880),
            recent: [{ at: minutesAgo(2_880), ok: true, newOrders: 0 }],
          }),
        ],
        seeds: withoutRetro.map((seed) =>
          seed.id === "ord-02"
            ? {
                ...seed,
                fiscal: {
                  state: "available",
                  identifiers: [cf("RSSMRA80A41H501X", "checksum")],
                },
              }
            : seed,
        ),
      });
      break;
  }

  // La prova attivata per finta porta lo scenario in Premium, senza avvisi degli sblocchi. Come
  // nell'area reale la copertura toglie le pause del piano e dell'inattività, comprende le
  // notifiche Telegram, legge con la cadenza Premium e la lettura successiva importa il resto
  // dell'anno di storico.
  if (trialStarted && scenario.account.trialAvailable) {
    const trialStores = scenario.stores.map((store): StoreView => {
      const resumedStore =
        store.pauseReason === "plan" || store.pauseReason === "inactivity"
          ? { ...store, connection: "active" as const, pauseReason: undefined }
          : store;
      return {
        ...resumedStore,
        notifications: resumedStore.notifications ?? false,
        targetMinutes: 10,
        ...(resumedStore.connection === "active" && resumedStore.historyDays !== null
          ? { historyDays: 365, importing: true }
          : {}),
      };
    });
    const notices = scenario.notices.filter((notice) => notice.kind !== "quota");
    scenario = {
      ...scenario,
      account: trialAccount(startedTrialEnd),
      stores: trialStores,
      notices:
        trialStores.some((store) => store.importing) &&
        !notices.some((notice) => notice.kind === "importing")
          ? [
              ...notices,
              {
                kind: "importing",
                count: trialStores.reduce((total, store) => total + store.importedOrders, 0),
              },
            ]
          : notices,
    };
  }
  const { seeds: scenarioSeeds, ...rest } = scenario;
  const premiumPlan = rest.account.plan === "premium";
  const lockedValues: Record<string, TaxIdentifierView[]> = {};
  let unlockedCount = 0;
  const orders = scenarioSeeds.map((seed) => {
    // Con Premium non ci sono ordini da sbloccare: il valore è subito accessibile.
    if (premiumPlan && seed.fiscal.state === "locked") {
      return toOrder(
        { ...seed, fiscal: { state: "available", identifiers: seed.lockable ?? [] } },
        rest.stores,
      );
    }
    if (seed.fiscal.state === "locked" && seed.lockable) {
      if (unlocked.has(seed.id)) {
        unlockedCount++;
        return toOrder(
          { ...seed, fiscal: { state: "available", identifiers: seed.lockable } },
          rest.stores,
        );
      }
      lockedValues[seed.id] = seed.lockable;
    }
    return toOrder(seed, rest.stores);
  });
  const quota = rest.account.quota;
  const currentAccount = quota
    ? {
        ...rest.account,
        quota: { ...quota, used: Math.min(quota.used + unlockedCount, quota.limit) },
      }
    : rest.account;
  const rights = planDiagnostics(currentAccount, appCopy[language]);
  return {
    ...rest,
    account: currentAccount,
    diagnostics: { ...rest.diagnostics, rights },
    orders,
    lockedValues,
  };
}

/** Posti lifetime già occupati negli scenari con posti liberi. */
const previewLifetimeTaken = 6;

/**
 * Offerta lifetime dello scenario, con le regole di `lifetimeContext` dell'area reale: non si
 * propone con il lifetime o un pagamento da confermare, aspetta la prima lettura e detrae il
 * periodo pagato non usato, che nell'anteprima termina al rinnovo o alla fine dopo la disdetta.
 * L'abbonamento aperto, che il lifetime sostituisce, vale anche ad acquisti sospesi.
 */
export function previewLifetime(scenario: Scenario): LifetimeOffer | null {
  const { premium, payment } = scenario.account;
  // Il posto di un lifetime rimborsato resta occupato: non torna in vendita allo spazio.
  if (
    premium?.period === "lifetime" ||
    payment?.state === "pending" ||
    (payment?.state === "refunded" && payment.lifetime)
  )
    return null;
  const synced = scenario.onboarding.some((step) => step.label === "stepSync" && step.done);
  const subscribed = !!premium || !!payment;
  const end = premium?.renewsAt ?? premium?.endsAt ?? null;
  let credit = 0;
  if (premium && end) {
    const start = new Date(end);
    if (premium.period === "annual") start.setUTCFullYear(start.getUTCFullYear() - 1);
    else start.setUTCMonth(start.getUTCMonth() - 1);
    credit = unusedCredit(
      priceGeneration.net[premium.period],
      { startsAt: start.toISOString(), endsAt: end },
      new Date(scenario.now),
    );
  }
  // Lo scenario esaurito ha occupato tutti i posti.
  const taken = scenario.lifetimeSoldOut ? lifetimeSlots : previewLifetimeTaken;
  const { state, seats } = lifetimeOfferState({
    purchasesOpen: !scenario.purchasesClosed,
    subscribed,
    synced,
    reserved: false,
    taken,
  });
  return { state, credit, replaces: subscribed, seats };
}
