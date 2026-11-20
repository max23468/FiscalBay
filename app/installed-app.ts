import { useEffect, useSyncExternalStore } from "react";

import type { Language } from "./i18n";

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

/** Prodotto FiscalBay nel Microsoft Store: la stessa web app impacchettata (D342). */
const microsoftStoreId = "9NJTL8FD7DMH";

/** Scheda dello Store nella lingua della pagina. */
export const microsoftStoreUrl = (language: Language) =>
  `https://apps.microsoft.com/detail/${microsoftStoreId}?hl=${language === "it" ? "it-IT" : "en-GB"}`;

/** Sistema delle istruzioni di installazione, dove il browser non la propone da sé. */
export type InstallGuide = "ios" | "mac";

type InstallTarget = Pick<Window, "matchMedia"> & {
  navigator: Pick<Navigator, "userAgent" | "maxTouchPoints"> & { standalone?: boolean };
};

/**
 * Da dove si installa l'app. Su Windows dal Microsoft Store, anche dove il browser la offrirebbe;
 * Xbox, che si presenta come Windows, non riceve il pacchetto per PC. Safari non offre
 * l'installazione alla pagina: su iPhone e iPad, con qualunque browser, si aggiunge dalla
 * condivisione alla schermata Home; su Mac Safari 17 o successivo la aggiunge al Dock. Un iPad si
 * presenta come un Mac, ma con il tocco. Già installata, niente.
 */
export function installSystem({
  navigator,
  matchMedia,
}: InstallTarget): InstallGuide | "windows" | null {
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) return null;
  const agent = navigator.userAgent;
  if (/Windows NT/u.test(agent) && !/Xbox/u.test(agent)) return "windows";
  if (/iPhone|iPad|iPod/u.test(agent) || (/Macintosh/u.test(agent) && navigator.maxTouchPoints > 1))
    return "ios";
  const safari = /Macintosh.*Version\/(\d+)[\d.]* Safari\//u.exec(agent);
  if (safari && Number(safari[1]) >= 17 && !/Chrome|Chromium|Edg|OPR|Firefox/u.test(agent))
    return "mac";
  return null;
}

/** Il sistema non cambia durante la visita: si calcola una volta. */
let system: InstallGuide | "windows" | null | undefined;
const currentSystem = () => (system ??= installSystem(window));

/**
 * Installazione dalla voce del menu: lo Store su Windows, altrimenti l'offerta del browser, valida
 * una sola volta, oppure le istruzioni di Safari. Sul server e prima dell'idratazione nessuna.
 */
export function useInstall():
  | { kind: "store" }
  | { kind: "prompt"; open: () => void }
  | { kind: "guide"; guide: InstallGuide }
  | null {
  const prompt = useSyncExternalStore(
    subscribeInstall,
    () => installPrompt,
    () => null,
  );
  const target = useSyncExternalStore(subscribeInstall, currentSystem, () => null);
  if (target === "windows") return { kind: "store" };
  if (prompt)
    return {
      kind: "prompt",
      open: () => {
        installPrompt = null;
        notifyInstall();
        void prompt.prompt().catch(() => undefined);
      },
    };
  return target ? { kind: "guide", guide: target } : null;
}

/** Il badge dello Store compare soltanto su Windows, fuori dall'app installata, a pagina idratata. */
export const useMicrosoftStore = () =>
  useSyncExternalStore(
    subscribeInstall,
    () => currentSystem() === "windows",
    () => false,
  );

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
  void periodicSync(async (sync) => {
    // Il browser concede l'aggiornamento periodico soltanto all'app installata.
    const permission = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (permission.state === "granted")
      await sync.register(badgeSync, { minInterval: badgeSyncInterval });
  });
}

/**
 * Senza sessione il badge sparisce e il worker smette di aggiornarlo: all'uscita dal menu, alla
 * cancellazione dell'account e sulla pagina dell'accesso, dove porta una sessione scaduta o chiusa
 * altrove. Il worker lo toglie anche da solo quando la lettura risponde 401.
 */
export function clearAppBadge() {
  void (navigator as BadgeNavigator).clearAppBadge?.().catch(() => undefined);
  void periodicSync((sync) => sync.unregister(badgeSync));
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
