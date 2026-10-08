import { env } from "cloudflare:workers";
import { cn } from "cn";
import { Check, Store } from "lucide-react";
import { redirect } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { EbayEnvironmentField, type EbayEnvironment } from "~/components/ebay-environment";
import { buttonVariants } from "~/components/ui/button-variants";
import { accessPath, appBase, ordersPath, storeLinkPath } from "../app-links";
import { appCopy } from "../app-copy";
import { createAuth } from "../auth.server";
import { registrationComplete, registrationStatus } from "../domain/registration.server";
import { listStores } from "../domain/stores.server";
import { errorResponse, tracePhase } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import { startStoreLink } from "../integrations/ebay/store-link.server";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import type { Route } from "./+types/store-link";

const noStore = { headers: { "cache-control": "no-store" } };

/** Arrivando da un avviso di scadenza la schermata parla di ricollegamento. */
const reconnectParam = "ricollega";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)].storeLink;
  const reconnect = new URLSearchParams(location.search).has(reconnectParam);
  return [
    { title: `FiscalBay | ${reconnect ? t.reconnectTitle : t.title}` },
    { name: "robots", content: "noindex" },
  ];
}

export function headers(): HeadersInit {
  return noStore.headers;
}

type Eligibility = { blocked: "session" | "email" | "registration" } | { userId: string };

/** Il collegamento richiede sessione, email verificata e registrazione completa. */
async function eligibility(request: Request): Promise<Eligibility> {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  tracePhase(request, "session");
  if (!session) return { blocked: "session" };
  if (!session.user.emailVerified) return { blocked: "email" };
  if (!registrationComplete(await registrationStatus(env.DB, session.user.id))) {
    return { blocked: "registration" };
  }
  return { userId: session.user.id };
}

// Schermata preparatoria: spiega che cosa autorizza il merchant prima di passare a eBay.
export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const status = await eligibility(request);
  if ("blocked" in status) {
    if (status.blocked === "session") return redirect(localizedPath(language, accessPath), noStore);
    const base = localizedPath(language, ordersPath);
    return redirect(status.blocked === "email" ? `${base}?negozio=accesso` : base, noStore);
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
  return {
    language,
    reconnect: search.has(reconnectParam),
    // Arrivando da Negozi, «Annulla» torna lì.
    fromStores: search.get("da") === "negozi",
    sandbox: sandboxAvailable(env),
    ebayEnvironment,
    expectedStoreId: expected?.id ?? null,
    expectedStoreName: expected?.name ?? null,
    dataDeleted: expected?.dataDeleted ?? false,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const base = localizedPath(language, ordersPath);
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const status = await eligibility(request);
  if ("blocked" in status) {
    return redirect(status.blocked === "registration" ? base : `${base}?negozio=accesso`, 303);
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
  if (
    expectedStoreId &&
    !(await listStores(env.DB, status.userId)).some(
      (store) => store.id === expectedStoreId && store.ebayEnvironment === ebayEnvironment,
    )
  )
    return errorResponse(request, "INVALID_REQUEST");
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
  const back = loaderData.fromStores ? localizedPath(language, `${appBase}/negozi`) : home;
  return (
    <StandalonePage
      icon={Store}
      tone="teal"
      title={reconnect ? t.reconnectTitle : t.title}
      homeHref={home}
    >
      <p className="leading-relaxed text-pretty text-muted-foreground">
        {reconnect
          ? loaderData.dataDeleted
            ? t.reconnectIntroDeleted
            : t.reconnectIntro
          : t.intro}
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
              language={language}
              className="w-full"
              name="environment"
              defaultValue={ebayEnvironment}
            />
          )
        )}
        {loaderData.fromStores ? <input type="hidden" name="da" value="negozi" /> : null}
        <Button type="submit">{t.continue}</Button>
        <a
          href={back}
          data-slot="button"
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          {t.cancel}
        </a>
      </form>
    </StandalonePage>
  );
}
