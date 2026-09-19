import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { env } from "cloudflare:workers";
import type { Route } from "./+types/home";

const taxIdentifierSchema = z.object({
  identifier_type: z.string(),
  issuing_country: z.string(),
  value: z.string(),
});

const visibleOrderSchema = z.object({
  id: z.string().uuid(),
  ebay_order_id: z.string(),
  creation_time: z.string(),
  last_modified_time: z.string(),
  currency: z.string(),
  total_minor: z.number(),
  tax_identifiers: z.array(taxIdentifierSchema),
});

const freeCycleSchema = z.object({
  id: z.string().uuid(),
  quota: z.number(),
  used: z.number(),
});

type VisibleOrder = z.infer<typeof visibleOrderSchema>;
type FreeCycle = z.infer<typeof freeCycleSchema>;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "FiscalBay — Qualifica M0" },
    { name: "description", content: "Vertical slice locale FiscalBay 2.0" },
  ];
}

export function loader() {
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<VisibleOrder[]>([]);
  const [cycle, setCycle] = useState<FreeCycle | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Inizializzazione Auth…");

  const loadOrders = useCallback(async (client: SupabaseClient) => {
    const [ordersResult, cyclesResult] = await Promise.all([
      client
        .from("orders")
        .select(
          "id, ebay_order_id, creation_time, last_modified_time, currency, total_minor, tax_identifiers(identifier_type, issuing_country, value)",
        )
        .order("last_modified_time", { ascending: false })
        .limit(50),
      client
        .from("free_cycles")
        .select("id, quota, used")
        .lte("starts_at", new Date().toISOString())
        .gt("ends_at", new Date().toISOString())
        .limit(1)
        .maybeSingle(),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (cyclesResult.error) throw cyclesResult.error;

    setOrders(visibleOrderSchema.array().parse(ordersResult.data ?? []));
    setCycle(cyclesResult.data ? freeCycleSchema.parse(cyclesResult.data) : null);
  }, []);

  useEffect(() => {
    const client = createClient(loaderData.supabaseUrl, loaderData.supabasePublishableKey, {
      auth: { experimental: { passkey: true } },
    });
    setSupabase(client);

    const refreshUser = async () => {
      const { data, error } = await client.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") {
        setMessage(error.message);
        return;
      }

      setUser(data.user ?? null);
      if (data.user) {
        try {
          await loadOrders(client);
          setMessage("Sessione verificata da Supabase Auth.");
        } catch (loadError) {
          setMessage(errorMessage(loadError, "Lettura ordini fallita."));
        }
      } else {
        setOrders([]);
        setCycle(null);
        setMessage("Accedi con l’account locale controllato.");
      }
    };

    void refreshUser();
    const { data: authListener } = client.auth.onAuthStateChange(() => void refreshUser());
    return () => authListener.subscription.unsubscribe();
  }, [loaderData.supabasePublishableKey, loaderData.supabaseUrl, loadOrders]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Accesso email completato.");
    setBusy(false);
  }

  async function signInWithPasskey() {
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithPasskey();
    setMessage(error ? error.message : "Accesso passkey completato.");
    setBusy(false);
  }

  async function registerPasskey() {
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.auth.registerPasskey();
    setMessage(error ? error.message : "Passkey registrata.");
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : "Sessione chiusa.");
    setBusy(false);
  }

  async function unlock(orderId: string) {
    if (!supabase || !cycle) return;

    setBusy(true);
    try {
      const { error } = await supabase.rpc("grant_free_order", {
        p_order_id: orderId,
        p_cycle_id: cycle.id,
      });
      if (error) throw error;

      await loadOrders(supabase);
      setMessage("Dato fiscale sbloccato con consumo atomico della quota.");
    } catch (unlockError) {
      setMessage(errorMessage(unlockError, "Sblocco non riuscito."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">FiscalBay 2.0 · M0</p>
        <h1>Ordini</h1>
        <p>
          Slice locale per verificare Supabase Auth, isolamento RLS e sblocco atomico dei dati
          fiscali.
        </p>
      </header>

      <p className="status" role="status">
        {message}
      </p>

      {!user ? (
        <section className="auth" aria-labelledby="auth-title">
          <h2 id="auth-title">Accesso controllato</h2>
          <form onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy || !supabase}>
              Accedi
            </button>
          </form>
          <button
            type="button"
            className="secondary"
            onClick={signInWithPasskey}
            disabled={busy || !supabase}
          >
            Accedi con passkey
          </button>
        </section>
      ) : (
        <section className="session" aria-label="Sessione">
          <p>{user.email}</p>
          <div>
            <button type="button" className="secondary" onClick={registerPasskey} disabled={busy}>
              Registra passkey
            </button>
            <button type="button" className="secondary" onClick={signOut} disabled={busy}>
              Esci
            </button>
          </div>
        </section>
      )}

      {user && orders.length === 0 ? (
        <section className="empty">
          <h2>Nessun ordine nella fixture locale</h2>
          <p>La sessione è valida, ma RLS non espone ordini per questo account.</p>
        </section>
      ) : user ? (
        <section className="orders" aria-label="Ordini qualificati">
          {orders.map((order) => (
            <article key={order.id}>
              <div>
                <h2>{order.ebay_order_id}</h2>
                <strong>
                  {(order.total_minor / 100).toFixed(2)} {order.currency}
                </strong>
              </div>
              <p>{order.creation_time}</p>
              <dl>
                {order.tax_identifiers.map((identifier) => (
                  <div key={`${identifier.identifier_type}:${identifier.value}`}>
                    <dt>{identifier.identifier_type}</dt>
                    <dd>{identifier.value}</dd>
                  </div>
                ))}
              </dl>
              {order.tax_identifiers.length === 0 && (
                <button
                  type="button"
                  onClick={() => unlock(order.id)}
                  disabled={busy || !cycle || cycle.used >= cycle.quota}
                >
                  Sblocca dati fiscali
                </button>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
