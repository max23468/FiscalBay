import { env } from "cloudflare:workers";

import { listVisibleOrders } from "../domain/orders.server";
import type { Route } from "./+types/home";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "FiscalBay — Qualifica M0" },
    { name: "description", content: "Vertical slice locale FiscalBay 2.0" },
  ];
}

export async function loader() {
  return { orders: await listVisibleOrders(env.DB, "m0-demo-user") };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <header>
        <p className="eyebrow">FiscalBay 2.0 · M0</p>
        <h1>Ordini</h1>
        <p>
          Slice locale per verificare persistenza D1, isolamento per spazio e sblocco atomico dei
          dati fiscali.
        </p>
      </header>

      {loaderData.orders.length === 0 ? (
        <section className="empty">
          <h2>Nessun ordine nella fixture locale</h2>
          <p>Le integrazioni eBay e Auth reali restano soggette ai gate M0.</p>
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
