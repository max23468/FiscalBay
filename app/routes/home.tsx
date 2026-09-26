import { env } from "cloudflare:workers";

import { createAuth } from "../auth.server";
import { listVisibleOrders } from "../domain/orders.server";
import { formatAmount, formatInstant, languageFromPath, localizedPath, translate } from "../i18n";
import type { Route } from "./+types/home";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [
    { title: `FiscalBay — ${translate(language, "orders")}` },
    { name: "description", content: translate(language, "ordersDescription") },
  ];
}

const storeNotices: Record<string, string> = {
  collegato: "storeConnected",
  negato: "storeDenied",
  "altro-spazio": "storeOtherWorkspace",
  accesso: "storeAccess",
  errore: "storeError",
};

const signInNotices: Record<string, string> = {
  errore: "signInError",
  registrato: "registered",
};

export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const search = new URL(request.url).searchParams;
  if (!session) {
    return {
      authenticated: false,
      language,
      signInNotice: signInNotices[search.get("accesso") ?? ""]
        ? translate(language, signInNotices[search.get("accesso") ?? ""]!)
        : null,
      orders: [],
    };
  }
  const notice = search.get("negozio");
  return {
    authenticated: true,
    language,
    canLinkStore: session.user.emailVerified,
    storeNotice: notice && storeNotices[notice] ? translate(language, storeNotices[notice]) : null,
    orders: await listVisibleOrders(env.DB, session.user.id),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = (key: string) => translate(language, key);
  return (
    <main>
      <header>
        <p className="eyebrow">FiscalBay 2.0</p>
        <h1>{t("orders")}</h1>
        <p>{t("ordersIntro")}</p>
        <nav aria-label="Language">
          <a href="/" lang="it" aria-current={language === "it" ? "page" : undefined}>
            Italiano
          </a>
          {" · "}
          <a href="/en" lang="en" aria-current={language === "en" ? "page" : undefined}>
            English
          </a>
        </nav>
      </header>

      {loaderData.storeNotice ? <p role="status">{loaderData.storeNotice}</p> : null}
      {loaderData.authenticated ? (
        <form method="post" action={localizedPath(language, "/accesso")}>
          <button type="submit" name="intent" value="esci">
            {t("signOut")}
          </button>
        </form>
      ) : null}
      {loaderData.canLinkStore ? (
        <form method="post" action={localizedPath(language, "/negozi/collega")}>
          <button type="submit">{t("linkStore")}</button>
        </form>
      ) : null}

      {!loaderData.authenticated ? (
        <section className="empty">
          <h2>{t("authRequired")}</h2>
          <p>{t("authRequiredDescription")}</p>
          {loaderData.signInNotice ? <p role="status">{loaderData.signInNotice}</p> : null}
          <form method="post" action={localizedPath(language, "/accesso")}>
            <label>
              {t("email")} <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              {t("password")}{" "}
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">{t("signIn")}</button>
            <button type="submit" name="intent" value="registrati">
              {t("signUp")}
            </button>
          </form>
        </section>
      ) : loaderData.orders.length === 0 ? (
        <section className="empty">
          <h2>{t("noOrders")}</h2>
          <p>{t("noOrdersDescription")}</p>
        </section>
      ) : (
        <section className="orders" aria-label={t("qualifiedOrders")}>
          {loaderData.orders.map((order) => (
            <article key={order.id}>
              <div>
                <h2>{order.ebayOrderId}</h2>
                <strong>{formatAmount(order.totalMinor, order.currency, language)}</strong>
              </div>
              <p>{formatInstant(order.creationTime, language)}</p>
              <dl>
                {order.taxIdentifiers.map((identifier) => (
                  <div key={`${identifier.type}:${identifier.value}`}>
                    <dt>{identifier.type}</dt>
                    <dd>{identifier.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
