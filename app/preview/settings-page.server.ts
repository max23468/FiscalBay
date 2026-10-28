import { env } from "cloudflare:workers";

import type { SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { appCopy } from "../app-copy";
import { previewOrdersPath } from "../app-links";
import { checkoutReturn, premiumOffers, purchaseStateFrom } from "../catalog";
import { exportFileMilliseconds } from "../domain/export-files.server";
import { exportFileName } from "../domain/order-export.server";
import { localizedPath } from "../i18n";
import {
  exportContext as exportContextView,
  exportScope,
  type ExportContext,
  type ExportTally,
} from "../orders/export-scope";
import { openSearch } from "../orders/order-search.server";
import {
  defaultDisplay,
  defaultTemplate,
  detectedTimeZone,
  effectiveTimeZone,
} from "../preferences";
import {
  orderPeriods,
  orderPeriodStart,
  settingsSections,
  type OrderPeriod,
  type SettingsSection,
} from "../view-models";
import { previewListing, previewSearchScope, previewTally } from "./order-list.server";
import { previewLifetime } from "./scenarios.server";
import type { pageScenario } from "./state.server";

/**
 * Ordini dell'esportazione nell'anteprima: l'ambito ricevuto dagli Ordini, contato con le regole
 * del loro elenco, cioè ordini presenti e, per i filtri, la stessa istantanea e la stessa
 * ricerca. Senza ambito, ogni periodo.
 */
async function previewExport(
  { scenario, language }: Awaited<ReturnType<typeof pageScenario>>,
  query: URLSearchParams,
  section: SettingsSection | null,
): Promise<Pick<SettingsPageData, "exportContext" | "exportPeriods">> {
  const scope = section === "esportazione" ? exportScope(query) : null;
  const visible = (search: URLSearchParams, text: string | null) =>
    previewListing(
      scenario.orders,
      scenario.incoming,
      search,
      text,
      scenario.now,
      scenario.account.plan,
    ).filtered;
  if (!scope) {
    const all = visible(new URLSearchParams(), null);
    return {
      exportContext: null,
      exportPeriods: Object.fromEntries(
        orderPeriods.map((period) => {
          const start = orderPeriodStart(period, new Date(scenario.now)).toISOString();
          return [period, previewTally(all.filter((order) => order.createdAt >= start))];
        }),
      ) as Record<OrderPeriod, ExportTally>,
    };
  }
  // La selezione conta soltanto gli ordini dell'elenco da cui è partita, alla sua istantanea;
  // l'ordine del dettaglio vale come nel dettaglio, anche fuori dall'elenco.
  const search = await openSearch(env.BETTER_AUTH_SECRET, previewSearchScope, query);
  const listed =
    scope.kind === "orders" && scope.detail
      ? [...scenario.orders, ...scenario.incoming]
      : visible(query, search);
  const ids = new Set(scope.kind === "orders" ? scope.ids : []);
  const chosen = scope.kind === "orders" ? listed.filter((order) => ids.has(order.id)) : listed;
  const exportContext: ExportContext = exportContextView(
    scope,
    query,
    localizedPath(language, previewOrdersPath),
    chosen[0]?.ebayOrderId ?? null,
    previewTally(chosen),
  );
  return { exportContext, exportPeriods: null };
}

/** Impostazioni dell'anteprima dallo scenario corrente: ogni azione resta simulata. */
export async function previewSettingsPage(
  request: Request,
  current: Awaited<ReturnType<typeof pageScenario>>,
  section: SettingsSection | null,
): Promise<SettingsPageData> {
  const { scenario, state, language } = current;
  const query = new URL(request.url).searchParams;
  // Il fuso rilevato è quello del dispositivo, come nell'area reale.
  const detected = detectedTimeZone(request.headers.get("cookie"));
  const timeZone = effectiveTimeZone("auto", detected);
  const { account } = scenario;
  return {
    confirmUnlock: state.confirmUnlock !== false,
    section,
    sections: settingsSections,
    services: {
      billing: true,
      billingPortal: true,
      telegram: true,
      accountExport: true,
      accountDeletion: true,
      support: true,
    },
    account,
    // Durante la prova l'acquisto resta possibile; lo ferma un abbonamento che può ancora
    // incassare, non un lifetime rimborsato.
    purchase: {
      state: purchaseStateFrom({
        covered:
          (account.plan === "premium" && !account.trial) ||
          (!!account.payment &&
            !(account.payment.state === "refunded" && account.payment.lifetime)),
        open: !scenario.purchasesClosed,
        synced: scenario.onboarding.some((step) => step.label === "stepSync" && step.done),
      }),
      offers: premiumOffers,
      lifetime: previewLifetime(scenario),
      checkout: checkoutReturn(query),
    },
    // Il negozio attivo è quello senza la pausa del piano; la sostituzione è simulata.
    freeStore:
      account.plan === "premium"
        ? null
        : {
            stores: scenario.stores.map(({ id, name }) => ({ id, name })),
            activeId: scenario.stores.find((store) => store.pauseReason !== "plan")?.id ?? null,
            changeFrom: null,
          },
    security: {
      methods: scenario.signInMethods,
      sessions: scenario.sessions,
      passkeyBlock: "nuovo-accesso",
      notice: accessNotice(query, language),
    },
    // Ogni scelta parte dal predefinito: l'anteprima non conserva preferenze.
    preferences: {
      theme: defaultDisplay.theme,
      timeZone: "auto",
      detectedTimeZone: detected,
      marketing: false,
      templates: { it: defaultTemplate("it"), en: defaultTemplate("en") },
    },
    diagnostics: scenario.diagnostics,
    // La pagina Novità esiste soltanto nell'area reale (D203).
    whatsNew: false,
    // Chat e preferenze dimostrative: ogni scelta parte dal predefinito, come le altre.
    telegram: {
      chat: scenario.telegramChat
        ? {
            label: scenario.telegramChat,
            linkedAt: scenario.now,
            ...(scenario.telegramFailure ? { failure: scenario.telegramFailure } : {}),
          }
        : null,
      enabled: true,
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone,
      stores: scenario.stores.map((store) => ({
        id: store.id,
        name: store.name,
        enabled: store.notifications === true,
        paused: store.pauseReason === "plan",
      })),
    },
    ...(await previewExport(current, query, section)),
    // Una configurazione dimostrativa: salvarne o eliminarne una è simulato.
    exportConfigurations: [
      {
        id: "esempio",
        name: appCopy[language].settings.export.exportConfigSample,
        format: "xlsx",
        rows: "order",
        columns: ["order", "date", "buyer", "taxCode", "vat", "total"],
      },
    ],
    // Un file dimostrativo creato poco fa: scaricarlo è simulato.
    exportFiles: [
      {
        id: "esempio",
        name: exportFileName(appCopy[language], new Date(scenario.now), timeZone),
        state: "ready",
        at: scenario.now,
        expiresAt: new Date(Date.parse(scenario.now) + exportFileMilliseconds).toISOString(),
      },
    ],
    now: scenario.now,
  };
}
