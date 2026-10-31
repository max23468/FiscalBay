import { env } from "cloudflare:workers";
import { Check, Store } from "lucide-react";
import { redirect } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { EbayEnvironmentField } from "~/components/ebay-environment";
import { buttonLink } from "~/components/ui/button-variants";
import { accessPath, ordersPath, storeLinkPath, storesPath } from "../app-links";
import { appCopy, pageTitle } from "../app-copy";
import { areaPage } from "../account-area.server";
import { readSession } from "../domain/sessions.server";
import { registrationComplete, registrationStatus } from "../domain/registration.server";
import { ebayOutages, listStores } from "../domain/stores.server";
import { errorResponse } from "../error-response";
import { tracePhase } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import { storeLinkAdmitted } from "../domain/admission.server";
import { serviceSetting } from "../domain/service-settings.server";
import { startStoreLink } from "../integrations/ebay/store-link.server";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import type { EbayEnvironment } from "../view-models";
import type { Route } from "./+types/store-link";
import { readPreferences } from "../domain/preferences.server";
import { detectedTimeZone, effectiveTimeZone, type ShellData } from "../preferences";

const noStore = { headers: { "cache-control": "no-store" } };

/** Arrivando da un avviso di scadenza la schermata parla di ricollegamento. */
const reconnectParam = "ricollega";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)].storeLink;
  const reconnect = new URLSearchParams(location.search).has(reconnectParam);
  return [
    { title: pageTitle(reconnect ? t.reconnectTitle : t.title) },
    { name: "robots", content: "noindex" },
  ];
}

export function headers(): HeadersInit {
  return noStore.headers;
}

type Eligibility = { blocked: "session" | "email" | "registration" } | { userId: string };

/** Il collegamento richiede sessione, email verificata e registrazione completa. */
async function eligibility(request: Request): Promise<Eligibility> {
  const session = await readSession(env, request);
  tracePhase(request, "session");
  if (!session) return { blocked: "session" };
  if (!session.user.emailVerified) return { blocked: "email" };
  if (!registrationComplete(await registrationStatus(env.DB, session.user.id))) {
    return { blocked: "registration" };
  }
  return { userId: session.user.id };
}

// Schermata preparatoria: spiega che cosa autorizza il merchant prima di passare a eBay. Con
// Auth o database non disponibili risponde 503 senza dati, come le pagine dell'area.
export function loader({ request }: Route.LoaderArgs) {
  return areaPage(request, () => prepare(request));
}

async function prepare(request: Request) {
  const language = languageFromPath(new URL(request.url).pathname);
  const status = await eligibility(request);
  if ("blocked" in status) {
    // Senza sessione o con la registrazione da completare decide l'accesso.
    if (status.blocked !== "email") return redirect(localizedPath(language, accessPath), noStore);
    return redirect(`${localizedPath(language, ordersPath)}?negozio=accesso`, noStore);
  }
  const search = new URL(request.url).searchParams;
  if (search.get("environment") === "sandbox" && !sandboxAvailable(env)) {
    throw errorResponse(request, "FORBIDDEN");
  }
  const ebayEnvironment: EbayEnvironment =
    search.get("environment") === "sandbox" ? "sandbox" : "production";
  const expectedStoreId = search.get(reconnectParam);
  const expected = expectedStoreId
    ? (await listStores(env.DB, status.userId)).find(
        (store) => store.id === expectedStoreId && store.ebayEnvironment === ebayEnvironment,
      )
    : null;
  if (search.has(reconnectParam) && !expected) throw errorResponse(request, "INVALID_REQUEST");
  const { theme, timeZone } = await readPreferences(env.DB, status.userId);
  return {
    language,
    // Pagina dell'area senza barra: valgono soltanto tema e fuso scelti.
    shell: {
      display: {
        theme,
        timeZone: effectiveTimeZone(timeZone, detectedTimeZone(request.headers.get("cookie"))),
      },
      notifications: null,
      now: new Date().toISOString(),
    } satisfies ShellData,
    reconnect: search.has(reconnectParam),
    // Arrivando da Negozi, «Annulla» torna lì.
    fromStores: search.get("da") === "negozi",
    sandbox: sandboxAvailable(env),
    ebayEnvironment,
    expectedStoreId: expected?.id ?? null,
    expectedStoreName: expected?.name ?? null,
  };
}

export function action({ request }: Route.ActionArgs) {
  return areaPage(request, () => start(request));
}

async function start(request: Request) {
  const language = languageFromPath(new URL(request.url).pathname);
  const base = localizedPath(language, ordersPath);
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const status = await eligibility(request);
  if ("blocked" in status) {
    return redirect(
      status.blocked === "registration"
        ? localizedPath(language, accessPath)
        : `${base}?negozio=accesso`,
      303,
    );
  }
  const form = request.body ? await request.formData() : new FormData();
  const ebayEnvironment = form.get("environment") ?? "production";
  if (ebayEnvironment !== "production" && ebayEnvironment !== "sandbox") {
    return errorResponse(request, "FORBIDDEN");
  }
  if (ebayEnvironment === "sandbox" && !sandboxAvailable(env)) {
    return errorResponse(request, "FORBIDDEN");
  }
  const expectedStoreId = String(form.get("negozio") ?? "");
  const fromStores = form.get("da") === "negozi";
  const back = fromStores ? localizedPath(language, storesPath) : base;
  if (!(await storeLinkAdmitted(env.DB, status.userId))) {
    return redirect(`${back}?negozio=lista-attesa`, { status: 303, ...noStore });
  }
  // Chiamate eBay spente dalla console: il collegamento non parte.
  if (!(await serviceSetting(env.DB, "ebay_calls"))) {
    return redirect(`${back}?negozio=sospeso`, { status: 303, ...noStore });
  }
  if (expectedStoreId) {
    const stores = await listStores(env.DB, status.userId);
    if (
      !stores.some(
        (store) => store.id === expectedStoreId && store.ebayEnvironment === ebayEnvironment,
      )
    )
      return errorResponse(request, "INVALID_REQUEST");
    // Come in Ordini e Negozi, con eBay che non risponde il ricollegamento resta sospeso.
    if (ebayOutages(stores).has(ebayEnvironment)) {
      return redirect(`${back}?negozio=ebay-non-risponde`, { status: 303, ...noStore });
    }
  }
  return redirect(
    await startStoreLink(
      env,
      status.userId,
      new Date(),
      language,
      ebayEnvironment,
      expectedStoreId || null,
      fromStores,
    ),
    {
      status: 303,
      ...noStore,
    },
  );
}

export default function StoreLink({ loaderData }: Route.ComponentProps) {
  const { language, reconnect, sandbox, ebayEnvironment } = loaderData;
  const t = appCopy[language].storeLink;
  const home = localizedPath(language, ordersPath);
  const back = loaderData.fromStores ? localizedPath(language, storesPath) : home;
  return (
    <StandalonePage
      icon={Store}
      tone="teal"
      title={reconnect ? t.reconnectTitle : t.title}
      homeHref={home}
    >
      <p className="leading-relaxed text-pretty text-muted-foreground">
        {reconnect ? t.reconnectIntro : t.intro}
      </p>
      {loaderData.expectedStoreName ? (
        <p className="font-medium">{loaderData.expectedStoreName}</p>
      ) : null}
      <ul className="grid gap-3">
        {t.points.map((point) => (
          <li key={point} className="flex gap-3 leading-relaxed text-pretty">
            <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
            {point}
          </li>
        ))}
      </ul>
      <form
        method="post"
        action={localizedPath(language, storeLinkPath)}
        className="flex flex-wrap gap-3"
      >
        {loaderData.expectedStoreId ? (
          <>
            <input type="hidden" name="negozio" value={loaderData.expectedStoreId} />
            <input type="hidden" name="environment" value={ebayEnvironment} />
          </>
        ) : (
          sandbox && (
            <EbayEnvironmentField
              className="w-full"
              name="environment"
              defaultValue={ebayEnvironment}
            />
          )
        )}
        {loaderData.fromStores ? <input type="hidden" name="da" value="negozi" /> : null}
        <Button type="submit">{t.continue}</Button>
        <a href={back} {...buttonLink({ variant: "outline", className: "w-fit" })}>
          {appCopy[language].common.cancel}
        </a>
      </form>
    </StandalonePage>
  );
}
