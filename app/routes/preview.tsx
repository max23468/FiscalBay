import {
  Outlet,
  redirect,
  useLocation,
  useMatches,
  useSubmit,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { AppShell } from "~/components/app-shell";
import { useDeviceTimeZone } from "~/components/device-time-zone";
import type { OrdersPageData } from "~/components/orders/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { appCopy } from "../app-copy";
import { localizedPath } from "../i18n";
import { revalidateUnlessSnapshot } from "../orders/order-list";
import { isScenarioId, scenarioOptions } from "../preview/scenarios.server";
import {
  currentScenario,
  assertPreviewAvailable,
  writePreviewState,
} from "../preview/state.server";
import type { Route } from "./+types/preview";
import { useCopy } from "~/components/copy-context";

/** Radice dell'anteprima: la stessa shell dell'app, alimentata da scenari sintetici. */
const base = "/anteprima";

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

/** L'istantanea aggiunta all'elenco Ordini non cambia scenario né notifiche. */
export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return revalidateUnlessSnapshot(args);
}

/**
 * Cambio di scenario e, come nell'area reale, scelta della lingua: qui cambia soltanto
 * l'indirizzo, perché l'anteprima non conserva preferenze.
 */
export async function action({ request }: Route.ActionArgs) {
  assertPreviewAvailable();
  const form = await request.formData();
  const chosen = form.get("language");
  if (chosen === "it" || chosen === "en") {
    const bare = String(form.get("returnTo") ?? "").replace(/^\/en(?=\/|$)/u, "");
    throw redirect(
      localizedPath(chosen, bare.startsWith(`${base}/`) ? bare : `${base}/impostazioni`),
      303,
    );
  }
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
  scenario,
  options,
}: {
  scenario: string;
  options: Array<{ id: string; name: string; focus: string }>;
}) {
  const { t, language } = useCopy();
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
  useDeviceTimeZone();
  // Su Ordini il campo mostra la ricerca attiva, decifrata dal loader della pagina.
  const orders = useMatches().find((match) => match.id.startsWith("preview-orders"));
  return (
    <AppShell
      account={loaderData.account}
      notifications={loaderData.notifications}
      now={loaderData.now}
      search={{
        action: localizedPath(language, `${base}/ricerca`),
        query: orders ? ((orders.loaderData as OrdersPageData | undefined)?.search ?? "") : null,
      }}
      onSignOut={(notify) => notify(t.preview.signOut)}
      before={<ScenarioBar scenario={loaderData.scenario} options={loaderData.options} />}
    >
      <Outlet />
    </AppShell>
  );
}
