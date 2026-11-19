import { useEffect, useSyncExternalStore } from "react";

/**
 * Funzioni dell'app installata: registrazione del service worker (`public/sw.js`), installazione
 * proposta dal browser e badge dell'icona con il numero delle notifiche da leggere. Dove il browser
 * non le offre non fanno nulla.
 */

/** Etichetta dell'aggiornamento periodico del badge, la stessa di `public/sw.js`. */
const badgeSync = "notifiche";

/** Intervallo minimo chiesto al browser fra due aggiornamenti del badge ad app chiusa. */
const badgeSyncInterval = 60 * 60 * 1000;

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type PeriodicSync = {
  register: (tag: string, options: { minInterval: number }) => Promise<void>;
  unregister: (tag: string) => Promise<void>;
};

/** Evento con cui Chrome ed Edge offrono l'installazione, rimandata alla voce del menu. */
type InstallPromptEvent = Event & { prompt: () => Promise<unknown> };

let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => {
  for (const listener of installListeners) listener();
};

/**
 * Registra il service worker a pagina caricata e conserva l'offerta di installazione del browser,
 * che arriva presto: il menu la mostra soltanto quando c'è, senza banner del browser.
 */
export function setUpInstalledApp(target: Window) {
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    notifyInstall();
  });
  target.addEventListener("appinstalled", () => {
    installPrompt = null;
    notifyInstall();
  });
  const container = target.navigator.serviceWorker as ServiceWorkerContainer | undefined;
  if (!container) return;
  const register = () => void container.register("/sw.js", { scope: "/" }).catch(() => undefined);
  if (target.document.readyState === "complete") register();
  else target.addEventListener("load", register, { once: true });
}

const subscribeInstall = (listener: () => void) => {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
};

/** Apre l'installazione del browser, se disponibile; l'offerta vale una sola volta. */
export function useInstallPrompt(): (() => void) | null {
  const prompt = useSyncExternalStore(
    subscribeInstall,
    () => installPrompt,
    () => null,
  );
  if (!prompt) return null;
  return () => {
    installPrompt = null;
    notifyInstall();
    void prompt.prompt().catch(() => undefined);
  };
}

/**
 * Segno del badge nella memoria del sito: ogni uscita la svuota (`Clear-Site-Data`), quindi la
 * pagina successiva, senza il segno, toglie il badge rimasto.
 */
const badgeMark = "fiscalbay-badge";

/** Con la memoria del sito bloccata il badge si toglie soltanto alla pagina dell'accesso. */
function mark(shown: boolean) {
  try {
    if (shown) localStorage.setItem(badgeMark, "1");
    else localStorage.removeItem(badgeMark);
  } catch {
    // Memoria bloccata o piena: nessun segno.
  }
}

function marked() {
  try {
    return localStorage.getItem(badgeMark) !== null;
  } catch {
    return true;
  }
}

/** L'icona dell'app installata riporta le notifiche da leggere della campanella; null, niente. */
export function useAppBadge(unread: number | null) {
  useEffect(() => {
    if (unread !== null) showAppBadge(unread);
  }, [unread]);
}

/**
 * Badge dell'icona dell'app installata con le notifiche da leggere, e il suo aggiornamento
 * periodico ad app chiusa quando il browser lo consente.
 */
function showAppBadge(unread: number) {
  const badge = navigator as BadgeNavigator;
  const done = unread > 0 ? badge.setAppBadge?.(unread) : badge.clearAppBadge?.();
  void done?.catch(() => undefined);
  mark(true);
  void periodicSync(async (sync) => {
    // Il browser concede l'aggiornamento periodico soltanto all'app installata.
    const permission = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (permission.state === "granted")
      await sync.register(badgeSync, { minInterval: badgeSyncInterval });
  });
}

/** Senza sessione il badge sparisce e il worker smette di aggiornarlo. */
export function clearAppBadge() {
  mark(false);
  void (navigator as BadgeNavigator).clearAppBadge?.().catch(() => undefined);
  void periodicSync((sync) => sync.unregister(badgeSync));
}

/** Dopo un'uscita, che ha svuotato la memoria del sito, il badge rimasto si toglie. */
export function clearBadgeAfterSignOut() {
  if (!marked()) clearAppBadge();
}

async function periodicSync(change: (sync: PeriodicSync) => Promise<void>) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const sync = (registration as { periodicSync?: PeriodicSync } | undefined)?.periodicSync;
    if (sync) await change(sync);
  } catch {
    // Browser senza aggiornamento periodico: il badge segue la sola pagina aperta.
  }
}
