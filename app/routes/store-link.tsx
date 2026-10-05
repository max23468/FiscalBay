import { env } from "cloudflare:workers";
import { cn } from "cn";
import { Check, Store } from "lucide-react";
import { redirect } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { buttonVariants } from "~/components/ui/button-variants";
import { appCopy } from "../app-copy";
import { createAuth } from "../auth.server";
import { registrationComplete, registrationStatus } from "../domain/registration.server";
import { errorResponse } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import { startStoreLink } from "../integrations/ebay/store-link.server";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import type { Route } from "./+types/store-link";

const environments = ["production", "sandbox"] as const;

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
    const base = localizedPath(language);
    return redirect(status.blocked === "email" ? `${base}?negozio=accesso` : base, noStore);
  }
  const search = new URL(request.url).searchParams;
  if (search.get("environment") === "sandbox" && !sandboxAvailable(env)) {
    return errorResponse(request, "FORBIDDEN");
  }
  return {
    language,
    reconnect: search.has(reconnectParam),
    // Arrivando da Negozi, «Annulla» torna lì.
    fromStores: search.get("da") === "negozi",
    sandbox: sandboxAvailable(env),
    ebayEnvironment: search.get("environment") === "sandbox" ? "sandbox" : "production",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const base = localizedPath(language);
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
  return redirect(await startStoreLink(env, status.userId, new Date(), language, ebayEnvironment), {
    status: 303,
    ...noStore,
  });
}

export default function StoreLink({ loaderData }: Route.ComponentProps) {
  const { language, reconnect, sandbox, ebayEnvironment } = loaderData;
  const t = appCopy[language].storeLink;
  const home = localizedPath(language);
  const back = loaderData.fromStores ? localizedPath(language, "/negozi") : home;
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
        action={localizedPath(language, "/negozi/collega")}
        className="flex flex-wrap gap-3"
      >
        {sandbox && (
          <Field className="w-full">
            <FieldLabel htmlFor="ebay-environment">{t.environment}</FieldLabel>
            <Select
              name="environment"
              defaultValue={ebayEnvironment}
              items={environments.map((value) => ({ value, label: t[value] }))}
            >
              <SelectTrigger id="ebay-environment" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
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
