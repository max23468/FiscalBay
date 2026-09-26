import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

export const languages = ["it", "en"] as const;
export type Language = (typeof languages)[number];

export function languageFromPath(path: string): Language {
  return path === "/en" || path.startsWith("/en/") ? "en" : "it";
}

export function localizedPath(language: Language, path = "/"): string {
  return language === "en" ? `/en${path === "/" ? "" : path}` : path;
}

const resources = {
  it: {
    translation: {
      orders: "Ordini",
      ordersDescription: "Ordini eBay disponibili in FiscalBay",
      ordersIntro: "Gli ordini e i dati fiscali accessibili sono isolati per spazio.",
      storeConnected: "Negozio eBay collegato.",
      storeDenied: "Collegamento annullato su eBay.",
      storeOtherWorkspace: "Questo negozio eBay è già collegato a un altro spazio.",
      storeAccess: "Verifica l’indirizzo email prima di collegare un negozio.",
      storeError: "Collegamento non riuscito. Riprova.",
      signInError: "Operazione non riuscita. Controlla email e password.",
      registered: "Utente creato. Conferma l’indirizzo email, poi accedi.",
      signOut: "Esci",
      linkStore: "Collega negozio eBay",
      authRequired: "Accesso richiesto",
      authRequiredDescription:
        "Gli ordini sono disponibili soltanto per lo spazio dell’utente autenticato.",
      email: "Email",
      password: "Password",
      signIn: "Accedi",
      signUp: "Crea utente",
      noOrders: "Nessun ordine",
      noOrdersDescription: "Collega un negozio eBay per importare gli ordini disponibili.",
      qualifiedOrders: "Ordini qualificati",
      authIncomplete: "Accesso non completato",
      authRetry: "Riprova ad accedere. Se il problema continua, contatta il supporto.",
      backHome: "Torna a FiscalBay",
      notFound: "La pagina richiesta non è stata trovata.",
      unexpected: "Si è verificato un errore inatteso. Riprova più tardi.",
      errorTitle: "Errore",
      errorReference: "Riferimento: {{id}}",
      error_AUTH_REQUIRED: "Accedi per continuare.",
      error_FORBIDDEN: "Non puoi eseguire questa operazione.",
      error_INVALID_REQUEST: "Controlla i dati e riprova.",
      error_UPSTREAM_UNAVAILABLE: "Servizio temporaneamente non disponibile. Riprova più tardi.",
      error_STORE_RECONNECT_REQUIRED: "Ricollega il negozio eBay e riprova.",
      error_CHECKOUT_PENDING: "Checkout non disponibile ora. Riprova più tardi.",
      error_INTERNAL_ERROR: "Operazione non riuscita. Riprova più tardi.",
    },
  },
  en: {
    translation: {
      orders: "Orders",
      ordersDescription: "eBay orders available in FiscalBay",
      ordersIntro: "Accessible orders and tax data are isolated by workspace.",
      storeConnected: "eBay store connected.",
      storeDenied: "Connection cancelled on eBay.",
      storeOtherWorkspace: "This eBay store is already connected to another workspace.",
      storeAccess: "Verify your email address before connecting a store.",
      storeError: "Could not connect the store. Try again.",
      signInError: "Could not complete the operation. Check your email and password.",
      registered: "Account created. Verify your email address, then sign in.",
      signOut: "Sign out",
      linkStore: "Connect eBay store",
      authRequired: "Sign in required",
      authRequiredDescription: "Orders are available only to the authenticated user's workspace.",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      signUp: "Create account",
      noOrders: "No orders",
      noOrdersDescription: "Connect an eBay store to import available orders.",
      qualifiedOrders: "Qualified orders",
      authIncomplete: "Sign in incomplete",
      authRetry: "Try signing in again. If the problem continues, contact support.",
      backHome: "Back to FiscalBay",
      notFound: "The requested page was not found.",
      unexpected: "An unexpected error occurred. Try again later.",
      errorTitle: "Error",
      errorReference: "Reference: {{id}}",
      error_AUTH_REQUIRED: "Sign in to continue.",
      error_FORBIDDEN: "You cannot perform this operation.",
      error_INVALID_REQUEST: "Check your input and try again.",
      error_UPSTREAM_UNAVAILABLE: "Service temporarily unavailable. Try again later.",
      error_STORE_RECONNECT_REQUIRED: "Reconnect your eBay store and try again.",
      error_CHECKOUT_PENDING: "Checkout is unavailable right now. Try again later.",
      error_INTERNAL_ERROR: "The operation failed. Try again later.",
    },
  },
} as const;

export const i18n: I18nInstance = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: "it",
  fallbackLng: "it",
  supportedLngs: languages,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function translate(
  language: Language,
  key: string,
  options?: Record<string, string>,
): string {
  return i18n.getFixedT(language)(key, options);
}

export function formatInstant(value: string | Date, language: Language): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("invalid_instant");
  return (
    new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export function formatAmount(minor: number, currency: string, language: Language): string {
  if (!Number.isSafeInteger(minor) || !/^[A-Z]{3}$/u.test(currency)) {
    throw new RangeError("invalid_amount");
  }
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
