// @ts-check
/// <reference lib="webworker" />

/**
 * Service worker di FiscalBay. Non conserva pagine né dati: le navigazioni arrivano dalla rete con
 * il precaricamento del browser e, senza connessione, ricevono una pagina che lo dice e permette di
 * riprovare. Nell'app installata aggiorna anche il badge dell'icona, quando il browser lo concede.
 * L'uscita dall'account lo rimuove con il resto della memoria del sito (`Clear-Site-Data`); la
 * pagina successiva lo registra di nuovo.
 */

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

/** Etichetta dell'aggiornamento periodico del badge, la stessa di `app/installed-app.ts`. */
const badgeSync = "notifiche";

/** Numero delle notifiche da leggere dell'account della sessione (`app/routes/notifications.ts`). */
const notificationsPath = "/api/v1/notifications";

const offlineCopy = {
  it: { title: "Sei offline", retry: "Riprova" },
  en: { title: "You’re offline", retry: "Try again" },
};

worker.addEventListener("install", (event) => {
  // Soltanto le navigazioni passano dal worker: il resto va in rete senza avviarlo. Un browser senza
  // regole di instradamento consegna comunque ogni richiesta, che il worker lascia proseguire.
  const install = /** @type {InstallEvent & { addRoutes?: (rules: unknown) => Promise<void> }} */ (
    event
  );
  if (install.addRoutes)
    event.waitUntil(
      install
        .addRoutes({ condition: { not: { requestMode: "navigate" } }, source: "network" })
        .catch(() => undefined),
    );
  void worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([worker.registration.navigationPreload?.enable(), worker.clients.claim()]),
  );
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  // Gli invii dei moduli e ogni altra richiesta proseguono senza il worker.
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(navigate(event));
});

/**
 * La risposta precaricata è una vera navigazione, con le sue intestazioni; senza precaricamento la
 * richiesta parte da qui. Un errore di rete dà la pagina offline, una risposta del server passa
 * com'è, anche quando è un errore.
 *
 * @param {FetchEvent} event
 */
async function navigate(event) {
  try {
    return (await event.preloadResponse) ?? (await fetch(event.request));
  } catch {
    return offlinePage(new URL(event.request.url));
  }
}

/**
 * Pagina offline costruita qui, senza cache: logo, colori e testo dei token di `app.css` e del
 * favicon. «Riprova» riapre lo stesso indirizzo.
 *
 * @param {URL} url
 */
function offlinePage(url) {
  const language = /^\/en(\/|$)/u.test(url.pathname) ? "en" : "it";
  const t = offlineCopy[language];
  const href = url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f5f7fa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121418" media="(prefers-color-scheme: dark)">
<title>${t.title} | FiscalBay</title>
<style>
:root{--bg:#f5f7fa;--fg:#0f1b2d;--primary:#1a4fa6;--on-primary:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#121418;--fg:#eceef2;--primary:#4f87e3;--on-primary:#0b1220}}
body{margin:0;min-height:100vh;display:grid;place-content:center;justify-items:center;gap:1.5rem;padding:1rem;box-sizing:border-box;background:var(--bg);color:var(--fg);text-align:center}
h1{margin:0;font-size:1.5rem;font-weight:600}
a{display:inline-block;padding:.625rem 1.25rem;border-radius:.5rem;background:var(--primary);color:var(--on-primary);font-weight:500;text-decoration:none}
a:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" aria-hidden="true"><style>@media (prefers-color-scheme: dark){.o{fill:#fff}}</style><rect class="o" x="1" y="5" width="30" height="23" rx="4" fill="#1A4FA6"/><rect x="3" y="7" width="26" height="19" rx="2" fill="#fff"/><rect x="6" y="14" width="6" height="5" rx="1.5" fill="#F6C12B"/><rect x="14" y="10" width="12" height="3" rx="1.5" fill="#1A4FA6"/><rect x="14" y="15" width="8" height="3" rx="1.5" fill="#1F9F9A"/><rect x="14" y="20" width="4" height="3" rx="1.5" fill="#DA353E"/></svg>
<h1>${t.title}</h1>
<a href="${href}">${t.retry}</a>
</body>
</html>`;
  // Risposta costruita dal worker, non dal server: con un codice di errore il browser segnalerebbe
  // in console una risorsa non caricata.
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

worker.addEventListener(
  /** @type {keyof ServiceWorkerGlobalScopeEventMap} */ ("periodicsync"),
  (event) => {
    const sync = /** @type {ExtendableEvent & { tag: string }} */ (event);
    if (sync.tag === badgeSync) sync.waitUntil(refreshBadge());
  },
);

/**
 * Il badge riporta le notifiche da leggere anche ad app chiusa. Senza sessione si toglie; un errore
 * temporaneo lascia il valore che c'era.
 */
async function refreshBadge() {
  const badge =
    /**
     * @type {WorkerNavigator & {
     *   setAppBadge?: (count?: number) => Promise<void>;
     *   clearAppBadge?: () => Promise<void>;
     * }}
     */ (worker.navigator);
  const response = await fetch(notificationsPath, {
    headers: { accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (response?.status === 401) return badge.clearAppBadge?.();
  if (!response?.ok) return;
  const { unread } = /** @type {{ unread: number }} */ (await response.json());
  return unread > 0 ? badge.setAppBadge?.(unread) : badge.clearAppBadge?.();
}
