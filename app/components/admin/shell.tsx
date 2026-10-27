import { cn } from "cn";
import { ChevronDown, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";

import { Logo } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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

export type AdminSectionKey = (typeof items)[number][1];

/**
 * Cornice della console, distinta dall'area dei venditori: logo, sezioni della console e
 * ritorno a FiscalBay, senza la navigazione di Ordini, Negozi e Impostazioni. Da 768 px le
 * sezioni stanno in una barra; sotto, in un menu con la sezione aperta come titolo, così su
 * mobile resta in vista dove si è. La scadenza della conferma con passkey sta nell'intestazione.
 */
export function AdminShell({
  current,
  title,
  subtitle,
  passkeyUntil,
  children,
}: {
  current: AdminSectionKey;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ora in cui la conferma con passkey della sessione scade; null per l'accesso tecnico. */
  passkeyUntil: string | null;
  children: ReactNode;
}) {
  const { t, href, language } = useAdmin();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href={href()}
            className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Logo className="h-6 w-auto" />
            <span className="text-sm font-semibold text-muted-foreground">{t.console}</span>
          </a>
          {/* La scadenza può portare la data: su schermi stretti va a capo invece di allargare. */}
          <span className="ml-auto flex min-w-0 items-center gap-1.5 text-right text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
            <span className="min-w-0 text-pretty">
              {passkeyUntil ? t.passkeyUntil(passkeyUntil) : t.technical}
            </span>
          </span>
          <a
            href={localizedPath(language)}
            {...buttonLink({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
          >
            {t.back}
          </a>
        </div>
        <nav aria-label={t.console} className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="w-full justify-between" />}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">{t.menu}</span>
                  {t.nav[current]}
                </span>
                <ChevronDown aria-hidden="true" data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-(--anchor-width)">
                {items.map(([path, key]) => (
                  <DropdownMenuLinkItem
                    key={key}
                    render={<Link to={href(path)} />}
                    aria-current={key === current ? "page" : undefined}
                    className={cn(key === current && "font-semibold")}
                  >
                    {t.nav[key]}
                  </DropdownMenuLinkItem>
                ))}
                <DropdownMenuLinkItem href={localizedPath(language)}>{t.back}</DropdownMenuLinkItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ul className="hidden flex-wrap gap-1 md:flex">
            {items.map(([path, key]) => (
              <li key={key}>
                <NavLink
                  to={href(path)}
                  end
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring",
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
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance break-words">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
