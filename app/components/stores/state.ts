import { CirclePause, Unplug } from "lucide-react";

import type { StatusIconType } from "~/components/status";
import type { AppCopy } from "../../app-copy";
import {
  marketplaceLabel,
  type AccountView,
  type EbayEnvironment,
  type StatusTone,
  type StoreView,
} from "../../view-models";

export interface StoresPageData {
  stores: StoreView[];
  detail: StoreView | null;
  account: Pick<AccountView, "plan">;
  now: string;
  /** Ambienti in cui eBay non risponde: le azioni che lo chiamano restano sospese. */
  ebayDown: EbayEnvironment[];
  /** Le chiamate a eBay sono sospese da FiscalBay per manutenzione, in ogni ambiente. */
  ebayMaintenance?: boolean;
  /**
   * Schermata preparatoria del collegamento. Nell'area reale collegare e ricollegare la aprono;
   * senza, l'anteprima simula l'esito.
   */
  connectHref?: string;
  /** Impostazioni esistono: la scorciatoia verso Supporto ha una meta. */
  settings: boolean;
  /** La scorciatoia verso le notifiche ha una meta: il servizio Telegram è disponibile. */
  notificationSettings: boolean;
  /** Abbonamento Premium che si rinnova: scollegare l'ultimo negozio non lo disdice. */
  subscriptionRenews?: boolean;
}

/** Nome proprio dell'ambiente di prova di eBay, uguale nelle due lingue. */
const sandboxLabel = "eBay Sandbox";

export function marketplaceText(store: StoreView) {
  if (store.sandbox) return sandboxLabel;
  return store.marketplace ? marketplaceLabel(store.marketplace) : null;
}

export function hasSubtitle(store: StoreView) {
  return store.username !== store.name || marketplaceText(store) !== null;
}

export function connectionStatus(
  store: StoreView,
  t: AppCopy,
): { tone: StatusTone; label: string; icon?: StatusIconType } {
  if (store.connection === "disconnected") {
    return { tone: "neutral", icon: Unplug, label: t.stores.state.disconnected };
  }
  if (store.connection === "paused") {
    return {
      tone: "neutral",
      icon: CirclePause,
      label:
        store.pauseReason === "plan"
          ? t.stores.pausedByPlan
          : store.pauseReason === "inactivity"
            ? t.stores.pausedByInactivity
            : store.pauseReason === "admin"
              ? t.stores.pausedByAdmin
              : t.stores.state.paused,
    };
  }
  if (store.connection === "reconnect_required") {
    return { tone: "warning", label: t.stores.state.reconnect_required };
  }
  if (store.connection === "error") {
    return {
      tone: "warning",
      label: store.issue ? t.stores.issue[store.issue].title : t.stores.state.error,
    };
  }
  return { tone: "success", label: t.stores.state.active };
}

/** In tabella e nella lista l'etichetta resta breve; il dettaglio spiega la sospensione. */
export function notificationsLabel(store: StoreView, t: AppCopy, detail = false) {
  if (store.notifications === null) return t.stores.notificationsFree;
  if (!store.notifications) return t.stores.notificationsOff;
  // Senza sincronizzazione non arrivano ordini da notificare.
  const syncing = store.connection === "active" && store.issue === undefined;
  if (syncing) return t.stores.notificationsOn;
  return detail ? t.stores.notificationsHeldHint : t.stores.notificationsHeld;
}

/** eBay non risponde, o le letture sono sospese, nell'ambiente del negozio. */
export function ebayDownFor(data: StoresPageData, store: StoreView) {
  return data.ebayDown.includes(store.sandbox ? "sandbox" : "production");
}

/** Avviso delle azioni sospese: eBay che non risponde o la manutenzione di FiscalBay. */
export function ebayDownText(data: Pick<StoresPageData, "ebayMaintenance">, t: AppCopy) {
  return data.ebayMaintenance ? t.stores.ebayPaused : t.stores.ebayDown;
}

/** `ebayDown`: avviso delle azioni sospese nell'ambiente del negozio, se ci sono. */
export function syncDescription(store: StoreView, ebayDown: string | null, t: AppCopy) {
  if (store.connection === "disconnected") {
    return t.stores.disconnectedHint;
  }
  if (ebayDown) return ebayDown;
  if (store.connection === "active") return t.stores.target(store.targetMinutes);
  if (store.pauseReason === "plan") return t.stores.planPauseHint;
  if (store.pauseReason === "inactivity") return t.stores.inactivityPauseHint;
  if (store.pauseReason === "admin") return t.stores.adminPauseHint;
  if (store.connection === "paused") return t.stores.pauseHint;
  return t.stores.syncSuspended;
}

/** Autorizzazione eBay da rinnovare o lettura bloccata da un problema del negozio. */
export function needsReconnect(store: StoreView) {
  return (
    store.issue !== undefined ||
    store.connection === "reconnect_required" ||
    store.connection === "error"
  );
}
