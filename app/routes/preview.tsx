import { Outlet, redirect, useLocation, useMatches, useSubmit } from "react-router";

import { AppShell } from "~/components/app-shell";
import type { OrdersPageData } from "~/components/orders/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { appCopy, type AppCopy } from "../app-copy";
import type { AppLinks } from "../app-links";
import { localizedPath, type Language } from "../i18n";
import { isScenarioId, scenarioOptions } from "../preview/scenarios.server";
import {
  currentScenario,
  assertPreviewAvailable,
  writePreviewState,
} from "../preview/state.server";
import type { Route } from "./+types/preview";

/** Radice dell'anteprima: la stessa shell dell'app, alimentata da scenari sintetici. */
const base = "/anteprima";

export interface PreviewContext {
  t: AppCopy;
  links: AppLinks;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { state, language, scenario } = await currentScenario(request);
  const { pathname } = new URL(request.url);
  if (pathname.replace(/\/$/u, "") === localizedPath(language, base)) {
    throw redirect(localizedPath(language, `${base}/ordini`));
  }
  return {
    language,
    scenario: state.scenario,
    options: scenarioOptions(language),
    account: scenario.account,
    notifications: scenario.notifications,
    now: scenario.now,
  };
}

export async function action({ request }: Route.ActionArgs) {
  assertPreviewAvailable();
  const form = await request.formData();
  const scenario = form.get("scenario");
  const target = String(form.get("redirectTo") ?? "");
  const language = target.startsWith("/en/") ? "en" : "it";
  const safeTarget = target.startsWith(localizedPath(language, `${base}/`))
    ? target
    : localizedPath(language, `${base}/ordini`);
  if (!isScenarioId(scenario)) throw redirect(safeTarget);
  throw redirect(safeTarget, {
    headers: {
      "Set-Cookie": await writePreviewState({ scenario, unlocked: [], saveFailed: false }),
    },
  });
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex, nofollow" }];
}

function ScenarioBar({
  t,
  language,
  scenario,
  options,
}: {
  t: AppCopy;
  language: Language;
  scenario: string;
  options: Array<{ id: string; name: string; focus: string }>;
}) {
  const submit = useSubmit();
  const location = useLocation();
  // Il pannello di dettaglio aperto non sopravvive al cambio di scenario.
  const listPath = location.pathname.replace(/\/(ordini|negozi)\/[^/]+$/u, "/$1");
  const current = options.find((option) => option.id === scenario);
  return (
    <div className="border-b bg-muted/60">
      <div className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-x-6 gap-y-2 py-2.5 text-sm md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-medium">{t.preview.label}</span>
          <label htmlFor="preview-scenario" className="sr-only">
            {t.preview.scenario}
          </label>
          <Select
            items={options.map((option) => ({ value: option.id, label: option.name }))}
            value={scenario}
            onValueChange={(value) =>
              void submit(
                { scenario: String(value), redirectTo: `${listPath}${location.search}` },
                { method: "post", action: localizedPath(language, base) },
              )
            }
          >
            <SelectTrigger id="preview-scenario" size="sm" className="min-w-56 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Su mobile resta la nota sulle azioni simulate; la select nomina già lo scenario. */}
        <p className="text-pretty text-muted-foreground">
          <span className="max-md:hidden">{current?.focus} </span>
          {t.preview.note}
        </p>
      </div>
    </div>
  );
}

export default function Preview({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = appCopy[language];
  const links: AppLinks = { language, base };
  // Su Ordini il campo mostra la ricerca attiva, decifrata dal loader della pagina.
  const orders = useMatches().find((match) => match.id.startsWith("preview-orders"));
  return (
    <AppShell
      links={links}
      t={t}
      account={loaderData.account}
      notifications={loaderData.notifications}
      now={loaderData.now}
      search={{
        action: localizedPath(language, `${base}/ricerca`),
        query: orders ? ((orders.loaderData as OrdersPageData | undefined)?.search ?? "") : null,
      }}
      onSignOut={(notify) => notify(t.preview.signOut)}
      before={
        <ScenarioBar
          t={t}
          language={language}
          scenario={loaderData.scenario}
          options={loaderData.options}
        />
      }
    >
      <Outlet context={{ t, links } satisfies PreviewContext} />
    </AppShell>
  );
}
