import { env } from "cloudflare:workers";

import logoDarkUrl from "../../docs/brand/logo/fiscalbay-logo-dark.svg?url";
import logoUrl from "../../docs/brand/logo/fiscalbay-logo.svg?url";
import { StatusAlert } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { createAuth } from "../auth.server";
import { listVisibleOrders } from "../domain/orders.server";
import { appCopy } from "../app-copy";
import { formatAmount, languageFromPath, localizedPath } from "../i18n";
import { formatDate } from "../view-models";
import type { Route } from "./+types/home";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [
    { title: `FiscalBay | ${appCopy[language].access.title}` },
    { name: "description", content: appCopy[language].access.description },
  ];
}

// Tipi restituiti da eBay; un tipo sconosciuto resta com'è, mai chiamato Codice Fiscale.
const identifierLabels: Record<string, "CF" | "PIVA"> = {
  CODICE_FISCALE: "CF",
  VAT_ID: "PIVA",
};

export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const search = new URL(request.url).searchParams;
  const { access } = appCopy[language];
  if (!session) {
    return {
      authenticated: false,
      language,
      signInNotice: access.signInNotices[search.get("accesso") ?? ""] ?? null,
      orders: [],
    };
  }
  return {
    authenticated: true,
    language,
    canLinkStore: session.user.emailVerified,
    storeNotice: access.storeNotices[search.get("negozio") ?? ""] ?? null,
    orders: await listVisibleOrders(env.DB, session.user.id),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = appCopy[language].access;
  const { orders } = appCopy[language];
  return (
    <main className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-8 py-12">
      <header className="grid max-w-2xl gap-3">
        <img
          src={logoUrl}
          alt="FiscalBay"
          width="224"
          height="45"
          className="h-8 w-auto dark:hidden"
        />
        <img
          src={logoDarkUrl}
          alt="FiscalBay"
          width="224"
          height="45"
          className="hidden h-8 w-auto dark:block"
        />
        <h1 className="text-4xl font-bold sm:text-5xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
        <nav aria-label={t.language} className="flex gap-3 text-sm">
          <a
            href="/"
            lang="it"
            aria-current={language === "it" ? "page" : undefined}
            className="underline-offset-4 hover:underline aria-[current=page]:font-semibold"
          >
            Italiano
          </a>
          <a
            href="/en"
            lang="en"
            aria-current={language === "en" ? "page" : undefined}
            className="underline-offset-4 hover:underline aria-[current=page]:font-semibold"
          >
            English
          </a>
        </nav>
      </header>

      {loaderData.storeNotice ? <StatusAlert tone="info" title={loaderData.storeNotice} /> : null}
      {loaderData.authenticated ? (
        <div className="flex flex-wrap gap-3">
          {loaderData.canLinkStore ? (
            <form method="post" action={localizedPath(language, "/negozi/collega")}>
              <Button type="submit">{t.linkStore}</Button>
            </form>
          ) : null}
          <form method="post" action={localizedPath(language, "/accesso")}>
            <Button type="submit" variant="outline" name="intent" value="esci">
              {t.signOut}
            </Button>
          </form>
        </div>
      ) : null}

      {!loaderData.authenticated ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>
              <h2>{t.authRequired}</h2>
            </CardTitle>
            <CardDescription>{t.authRequiredBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loaderData.signInNotice ? (
              <StatusAlert tone="info" title={loaderData.signInNotice} />
            ) : null}
            <form method="post" action={localizedPath(language, "/accesso")}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">{t.email}</FieldLabel>
                  <Input id="email" name="email" type="email" autoComplete="username" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">{t.password}</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit">{t.signIn}</Button>
                  <Button type="submit" variant="outline" name="intent" value="registrati">
                    {t.signUp}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : loaderData.orders.length === 0 ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>
              <h2>{t.noOrders}</h2>
            </CardTitle>
            <CardDescription>{t.noOrdersBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2" aria-label={t.list}>
          {loaderData.orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle className="flex justify-between gap-4">
                  <h2 className="font-code">{order.ebayOrderId}</h2>
                  <strong className="font-code">
                    {formatAmount(order.totalMinor, order.currency, language)}
                  </strong>
                </CardTitle>
                <CardDescription>{formatDate(order.creationTime, language)}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 text-sm">
                  {order.taxIdentifiers.map((identifier) => {
                    const known = identifierLabels[identifier.type];
                    const label = known ? orders.identifier[known] : identifier.type;
                    return (
                      <div
                        key={`${identifier.type}:${identifier.value}`}
                        className="grid grid-cols-[1fr_2fr] items-center gap-3"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd>
                          <TaxCode
                            value={identifier.value}
                            labels={{
                              copy: orders.copy(label, order.ebayOrderId),
                              copied: orders.copied,
                              copyFailed: orders.copyFailed,
                              locked: orders.lockedLabel,
                            }}
                          />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
