import type { Route } from "./+types/auth-error";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Accesso non completato — FiscalBay" }];
}

export default function AuthError() {
  return (
    <main>
      <section className="empty">
        <p className="eyebrow">FiscalBay</p>
        <h1>Accesso non completato</h1>
        <p>Riprova ad accedere. Se il problema continua, contatta il supporto.</p>
        <a href="/">Torna a FiscalBay</a>
      </section>
    </main>
  );
}
