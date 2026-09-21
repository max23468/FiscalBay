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

export async function loader({ request }: Route.LoaderArgs) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return { authenticated: false, orders: [] };
  return {
    authenticated: true,
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

      {!loaderData.authenticated ? (
        <section className="empty">
          <h2>Accesso richiesto</h2>
          <p>Gli ordini sono disponibili soltanto per lo spazio dell’utente autenticato.</p>
        </section>
      ) : loaderData.orders.length === 0 ? (
        <section className="empty">
          <h2>Nessun ordine nella fixture locale</h2>
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
