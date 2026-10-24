import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { SettingsPage, type ExportContext, type SettingsPageData } from "~/components/settings";
import { NotFoundState, UnavailableState } from "~/components/not-found";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import { defaultDisplay, defaultTemplate, detectedTimeZone } from "../preferences";
import { exportReturnHref, exportScope } from "../orders/export-scope";
import { snapshotParam } from "../orders/order-list";
import { openSearch } from "../orders/order-search.server";
import { previewListing, previewSearchScope } from "../preview/order-list.server";
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
  return [{ title: `FiscalBay | ${title}` }, { name: "robots", content: "noindex, nofollow" }];
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
    const listed = [...scenario.orders, ...scenario.incoming];
    if (scope.kind === "orders") {
      const ids = new Set(scope.ids);
      estimate = listed.filter((order) => ids.has(order.id));
    } else {
      const search = await openSearch(env.BETTER_AUTH_SECRET, previewSearchScope, query);
      estimate = previewListing(
        scenario.orders,
        scenario.incoming,
        query,
        search,
        scenario.now,
        scenario.account.plan,
      ).filtered;
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
    services: { billing: true, telegram: true, accountData: true, support: true },
    preview: true,
    account: scenario.account,
    stores: scenario.stores,
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
    telegramChat: scenario.telegramChat,
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
