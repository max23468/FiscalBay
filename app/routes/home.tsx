import { env } from "cloudflare:workers";

import { createAuth } from "../auth.server";
import { listVisibleOrders } from "../domain/orders.server";
import type { Route } from "./+types/home";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "FiscalBay — Ordini" },
    { name: "description", content: "Ordini eBay disponibili in FiscalBay" },
  ];
}

const storeNotices: Record<string, string> = {
  collegato: "Negozio eBay collegato.",
  negato: "Collegamento annullato su eBay.",
  "altro-spazio": "Questo negozio eBay è già collegato a un altro spazio.",
  accesso: "Verifica l’indirizzo email prima di collegare un negozio.",
  errore: "Collegamento non riuscito. Riprova.",
};

const signInNotices: Record<string, string> = {
  errore: "Operazione non riuscita. Controlla email e password.",
  registrato: "Utente creato. Conferma l’indirizzo email, poi accedi.",
};

export async function loader({ request }: Route.LoaderArgs) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const search = new URL(request.url).searchParams;
  if (!session) {
    return {
      authenticated: false,
      signInNotice: signInNotices[search.get("accesso") ?? ""] ?? null,
      orders: [],
    };
  }
  const notice = search.get("negozio");
  return {
    authenticated: true,
    canLinkStore: session.user.emailVerified,
    storeNotice: notice ? (storeNotices[notice] ?? null) : null,
    orders: await listVisibleOrders(env.DB, session.user.id),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <header>
        <p className="eyebrow">FiscalBay 2.0</p>
        <h1>Ordini</h1>
        <p>Gli ordini e i dati fiscali accessibili sono isolati per spazio.</p>
      </header>

      {loaderData.storeNotice ? <p role="status">{loaderData.storeNotice}</p> : null}
      {loaderData.authenticated ? (
        <form method="post" action="/accesso">
          <button type="submit" name="intent" value="esci">
            Esci
          </button>
        </form>
      ) : null}
      {loaderData.canLinkStore ? (
        <form method="post" action="/negozi/collega">
          <button type="submit">Collega negozio eBay</button>
        </form>
      ) : null}

      {!loaderData.authenticated ? (
        <section className="empty">
          <h2>Accesso richiesto</h2>
          <p>Gli ordini sono disponibili soltanto per lo spazio dell’utente autenticato.</p>
          {loaderData.signInNotice ? <p role="status">{loaderData.signInNotice}</p> : null}
          <form method="post" action="/accesso">
            <label>
              Email <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Password{" "}
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Accedi</button>
            <button type="submit" name="intent" value="registrati">
              Crea utente
            </button>
          </form>
        </section>
      ) : loaderData.orders.length === 0 ? (
        <section className="empty">
          <h2>Nessun ordine</h2>
          <p>Collega un negozio eBay per importare gli ordini disponibili.</p>
        </section>
      ) : (
        <section className="orders" aria-label="Ordini qualificati">
          {loaderData.orders.map((order) => (
            <article key={order.id}>
              <div>
                <h2>{order.ebayOrderId}</h2>
                <strong>
                  {(order.totalMinor / 100).toFixed(2)} {order.currency}
                </strong>
              </div>
              <p>{order.creationTime}</p>
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
