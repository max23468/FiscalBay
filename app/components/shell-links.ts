import {
  ClipboardList,
  CreditCard,
  Megaphone,
  Settings,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";
import type { Language } from "../i18n";

/**
 * Voce del menu dell'avatar; `reloadDocument` per le pagine fuori dalle route dell'app,
 * `onSelect` per una voce che invia una scelta invece di aprire una pagina.
 */
export interface AccountMenuItem {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  lang?: Language;
  reloadDocument?: boolean;
  onSelect?: () => void;
}

/** Destinazione della navigazione principale; `end` per la radice dell'area. */
export interface NavDestination {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
}

/** Destinazioni principali dell'app, nell'anteprima e nell'area reale. */
export function shellDestinations(links: AppLinks, t: AppCopy): NavDestination[] {
  return [
    { href: appHref(links, "ordini"), label: t.shell.orders, Icon: ClipboardList },
    { href: appHref(links, "negozi"), label: t.shell.stores, Icon: Store },
    { href: appHref(links, "impostazioni"), label: t.shell.settings, Icon: Settings },
  ];
}

/**
 * Voci dell'account nel menu dell'avatar: profilo, categorie più cercate delle Impostazioni e
 * Novità, soltanto quando la pagina ha voci (D203).
 */
export function accountMenu(links: AppLinks, t: AppCopy, whatsNew = false): AccountMenuItem[] {
  return [
    { href: appHref(links, "impostazioni/profilo"), label: t.shell.profile, Icon: User },
    { href: appHref(links, "impostazioni/sicurezza"), label: t.shell.security, Icon: ShieldCheck },
    { href: appHref(links, "impostazioni/piano"), label: t.shell.planBilling, Icon: CreditCard },
    { href: appHref(links, "impostazioni"), label: t.shell.settings, Icon: Settings },
    ...(whatsNew
      ? [{ href: appHref(links, "novita"), label: t.shell.whatsNew, Icon: Megaphone }]
      : []),
  ];
}

/** Sezione dell'area: la parte dell'indirizzo dopo `app` o `anteprima`. */
export function areaSection(pathname: string) {
  const parts = pathname.split("/");
  const at = parts.findIndex((part) => part === "app" || part === "anteprima");
  return at < 0 ? "" : (parts[at + 1] ?? "");
}
