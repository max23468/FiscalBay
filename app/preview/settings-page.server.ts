import { env } from "cloudflare:workers";

import type { SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { appCopy, type AppCopy } from "../app-copy";
import { previewOrdersPath } from "../app-links";
import { checkoutReturn, premiumOffers, purchaseStateFrom } from "../catalog";
import { exportFileMilliseconds } from "../domain/export-files.server";
import { exportDateTime, exportFileName } from "../domain/order-export.server";
import { minorToDecimal } from "../money";
import {
  exportSampleSize,
  type ExportColumn,
  type ExportRows,
  type ExportSample,
  type ExportSampleOrder,
} from "../orders/export-columns";
import { localizedPath } from "../i18n";
import { botUrl } from "../integrations/telegram.server";
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
  type OrderView,
  type SettingsSection,
} from "../view-models";
import { previewListing, previewSearchScope, previewTally } from "./order-list.server";
import { previewLifetime } from "./scenarios.server";
import type { pageScenario } from "./state.server";

/**
 * Righe del file di un ordine sintetico, con le colonne dell'area reale: identificativi soltanto
 * se disponibili, situazione fiscale con il testo della pagina Ordini.
 */
function previewRecords(
  order: OrderView,
  rows: ExportRows,
  t: AppCopy,
  timeZone: string,
): Array<Record<ExportColumn, string>> {
  const fiscal = order.fiscal;
  const identifiers = fiscal.state === "available" ? fiscal.identifiers : [];
  const values = (type: string) =>
    identifiers
      .filter((identifier) => identifier.type === type)
      .map((identifier) => identifier.value)
      .join(" | ");
  const address = order.billingAddress;
  const total = minorToDecimal(order.totalMinor, order.currency);
  const common = {
    order: order.ebayOrderId,
    date: exportDateTime(order.createdAt, timeZone),
    timeZone,
    store: order.storeName,
    marketplace: order.marketplace ?? "",
    buyer: order.buyerName ?? "",
    username: order.buyerUsername ?? "",
    email: order.email ?? "",
    phone: order.phone ?? "",
    address: address?.line ?? "",
    postalCode: address?.postalCode ?? "",
    city: address?.city ?? "",
    province: address?.province ?? "",
    country: address?.countryCode ?? "",
    currency: order.currency,
    payment: order.payment.status ? t.orders.payment[order.payment.status] : "",
    shipping: order.shipping.status ? t.orders.shipping[order.shipping.status] : "",
    taxCode: values("CF"),
    vat: values("PIVA"),
    otherTax: identifiers
      .filter((identifier) => identifier.type === "OTHER")
      .map((identifier) => `${identifier.typeLabel}: ${identifier.value}`)
      .join(" | "),
    fiscal:
      fiscal.state === "available" && fiscal.notice
        ? t.settings.export.file.fiscalNotice[fiscal.notice]
        : t.orders.fiscal[
            fiscal.state === "missing" && fiscal.reason === "foreign" ? "foreign" : fiscal.state
          ],
    checkedAt: exportDateTime(order.lastSyncedAt, timeZone),
    updatedAt: exportDateTime(order.updatedAt, timeZone),
  };
  if (rows === "order")
    return [
      {
        ...common,
        items: order.items.map((item) => `${item.quantity} × ${item.title}`).join(" | "),
        sku: order.items
          .map((item) => item.sku)
          .filter(Boolean)
          .join(" | "),
        quantity: String(order.items.reduce((sum, item) => sum + item.quantity, 0)),
        itemTotal: "",
        total,
      },
    ];
  return order.items.map((item, index) => ({
    ...common,
    items: item.title,
    sku: item.sku ?? "",
    quantity: String(item.quantity),
    itemTotal: item.totalMinor === null ? "" : minorToDecimal(item.totalMinor, order.currency),
    total: index === 0 ? total : "",
  }));
}

/** Prime righe del file dagli ordini sintetici più recenti, come nell'area reale. */
function previewSample(orders: OrderView[], t: AppCopy, timeZone: string): ExportSample {
  const sample = (chosen: OrderView[]): ExportSampleOrder[] =>
    [...chosen]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, exportSampleSize)
      .map((order) => ({
        createdAt: order.createdAt,
        rows: {
          order: previewRecords(order, "order", t, timeZone),
          item: previewRecords(order, "item", t, timeZone),
        },
      }));
  return {
    all: sample(orders),
    available: sample(orders.filter((order) => order.fiscal.state === "available")),
  };
}

/**
 * Ordini dell'esportazione nell'anteprima: l'ambito ricevuto dagli Ordini, contato con le regole
 * del loro elenco, cioè ordini presenti e, per i filtri, la stessa istantanea e la stessa
 * ricerca. Senza ambito, ogni periodo.
 */
async function previewExport(
  { scenario, language }: Awaited<ReturnType<typeof pageScenario>>,
  query: URLSearchParams,
  section: SettingsSection | null,
  timeZone: string,
): Promise<Pick<SettingsPageData, "exportContext" | "exportPeriods" | "exportSample">> {
  const t = appCopy[language];
  const sample = (orders: OrderView[]) =>
    section === "esportazione" ? previewSample(orders, t, timeZone) : null;
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
      exportSample: sample(all),
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
  return { exportContext, exportPeriods: null, exportSample: sample(chosen) };
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
      botUrl: botUrl(env),
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
    ...(await previewExport(current, query, section, timeZone)),
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
