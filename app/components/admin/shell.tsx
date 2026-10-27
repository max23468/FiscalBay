import { cn } from "cn";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { Logo } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import { localizedPath } from "../../i18n";
import { useAdmin } from "./use-admin";

const items = [
  ["", "overview"],
  ["account", "accounts"],
  ["negozi", "stores"],
  ["lavori", "jobs"],
  ["quote", "quotas"],
  ["commerciale", "commerce"],
  ["antiabuso", "abuse"],
  ["comunicazioni", "notices"],
  ["registro", "audit"],
] as const;

/**
 * Cornice della console, distinta dall'area dei venditori: logo, sezioni della console e
 * ritorno a FiscalBay, senza la navigazione di Ordini, Negozi e Impostazioni.
 */
export function AdminShell({
  title,
  note,
  children,
}: {
  title: string;
  /** Conferma con passkey della sessione e sua durata. */
  note: string;
  children: ReactNode;
}) {
  const { t, href, language } = useAdmin();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href={href()}
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Logo className="h-6 w-auto" />
            <span className="text-sm font-semibold text-muted-foreground">{t.console}</span>
          </a>
          <a
            href={localizedPath(language)}
            {...buttonLink({ variant: "ghost", size: "sm", className: "ml-auto" })}
          >
            {t.back}
          </a>
        </div>
        <nav aria-label={t.console} className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex gap-1 pb-2">
            {items.map(([path, key]) => (
              <li key={key}>
                <NavLink
                  to={href(path)}
                  end
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                      isActive && "bg-muted font-medium text-foreground",
                    )
                  }
                >
                  {t.nav[key]}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{note}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
