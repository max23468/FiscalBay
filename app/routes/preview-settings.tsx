import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import type { ExportContext } from "~/components/settings/export";
import { SettingsPage, type SettingsPageData } from "~/components/settings/page";
import { NotFoundState, UnavailableState } from "~/components/not-found";
import { appCopy, pageTitle } from "../app-copy";
import { checkoutReturn, premiumOffers } from "../catalog";
import { languageFromPath, localizedPath } from "../i18n";
import {
  defaultDisplay,
  defaultTemplate,
  detectedTimeZone,
  effectiveTimeZone,
} from "../preferences";
import { exportReturnHref, exportScope } from "../orders/export-scope";
import { snapshotParam } from "../orders/order-list";
import { openSearch } from "../orders/order-search.server";
import { previewListing, previewSearchScope } from "../preview/order-list.server";
import { previewLifetime } from "../preview/scenarios.server";
import { pageScenario, simulateAction } from "../preview/state.server";
import { settingsSections, type SettingsSection } from "../view-models";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-settings";

function isSection(value: string | undefined): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value ?? "");
}

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isSection(params.sezione)
    ? `${t.settings.sections[params.sezione].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { scenario, state, language } = await pageScenario(request);
  if (params.sezione !== undefined && !isSection(params.sezione)) {
    throw data(null, { status: 404 });
  }
  // Ambito ricevuto dagli Ordini, contato con le regole del loro elenco: ordini presenti e,
  // per i filtri, la stessa istantanea e la stessa ricerca.
  const query = new URL(request.url).searchParams;
  const scope = params.sezione === "esportazione" ? exportScope(query) : null;
  let estimate = scenario.orders;
  let exportContext: ExportContext | null = null;
  if (scope) {
    // La selezione conta soltanto gli ordini dell'elenco da cui è partita, alla sua istantanea.
    const search = await openSearch(env.BETTER_AUTH_SECRET, previewSearchScope, query);
    const listed = previewListing(
      scenario.orders,
      scenario.incoming,
      query,
      search,
      scenario.now,
      scenario.account.plan,
    ).filtered;
    if (scope.kind === "orders") {
      const ids = new Set(scope.ids);
      estimate = listed.filter((order) => ids.has(order.id));
    } else {
      estimate = listed;
    }
    exportContext = {
      kind: scope.kind,
      order:
        scope.kind === "orders" && scope.ids.length === 1
          ? (estimate[0]?.ebayOrderId ?? null)
          : null,
      filtered:
        scope.kind === "filtered" &&
        [...scope.criteria.keys()].some((key) => key !== snapshotParam),
      returnHref: exportReturnHref(localizedPath(language, "/anteprima/ordini"), query),
      query: query.toString(),
    };
  }
  const page: SettingsPageData = {
    confirmUnlock: state.confirmUnlock !== false,
    section: params.sezione ?? null,
    sections: settingsSections,
    services: {
      billing: true,
      billingPortal: true,
      telegram: true,
      accountData: true,
      support: true,
    },
    preview: true,
    account: scenario.account,
    // Come nell'area reale: l'acquisto aspetta la prima lettura riuscita di un negozio, durante
    // la prova resta possibile e resta fermo con un abbonamento che può ancora incassare; un
    // lifetime rimborsato non lo ferma.
    purchase: {
      state:
        (scenario.account.plan === "premium" && !scenario.account.trial) ||
        (scenario.account.payment &&
          !(scenario.account.payment.state === "refunded" && scenario.account.payment.lifetime))
          ? "covered"
          : scenario.purchasesClosed
            ? "closed"
            : scenario.onboarding.some((step) => step.label === "stepSync" && step.done)
              ? "available"
              : "needs-sync",
      offers: premiumOffers,
      lifetime: previewLifetime(scenario),
      checkout: checkoutReturn(query),
    },
    // Il negozio attivo è quello senza la pausa del piano; la sostituzione è simulata.
    freeStore:
      scenario.account.plan === "premium"
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
      notice: null,
    },
    // Ogni scelta parte dal predefinito: l'anteprima non conserva preferenze. Il fuso
    // rilevato è quello del dispositivo, come nell'area reale.
    preferences: {
      theme: defaultDisplay.theme,
      timeZone: "auto",
      detectedTimeZone: detectedTimeZone(request.headers.get("cookie")),
      marketing: false,
      templates: { it: defaultTemplate("it"), en: defaultTemplate("en") },
    },
    diagnostics: scenario.diagnostics,
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
      timeZone: effectiveTimeZone("auto", detectedTimeZone(request.headers.get("cookie"))),
      stores: scenario.stores.map((store) => ({
        id: store.id,
        name: store.name,
        enabled: store.notifications === true,
        paused: store.pauseReason === "plan",
      })),
    },
    exportEstimate: {
      orders: estimate.length,
      locked: estimate.filter((order) => order.fiscal.state === "locked").length,
    },
    exportContext,
    now: scenario.now,
  };
  return page;
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  return simulateAction(request, await request.formData());
}

export default function PreviewSettings({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <SettingsPage data={loaderData} t={t} links={links} />;
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  if (isRouteErrorResponse(error) && error.status === 503) return <UnavailableState t={t} />;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="page" t={t} links={links} />;
}
