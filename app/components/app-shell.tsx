import { cn } from "cn";
import { Globe, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { NoticeContext } from "~/components/action";
import { InitialsTile } from "~/components/icon-tile";
import { Button } from "~/components/ui/button";
import { NotificationsMenu } from "~/components/notifications-menu";
import {
  accountMenu,
  shellDestinations,
  type AccountMenuItem,
  type NavDestination,
} from "~/components/shell-links";
import { GlobalSearch, MobileSearch, type ShellSearch } from "~/components/shell-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useCopy, useLinks } from "~/components/copy-context";
import logoDarkUrl from "../../docs/brand/logo/fiscalbay-logo-dark.svg?url";
import logoUrl from "../../docs/brand/logo/fiscalbay-logo.svg?url";
import { appHref, visitParam } from "../app-links";
import { localizedPath } from "../i18n";
import type { AccountView, NotificationView } from "../view-models";

/**
 * Shell dell'app. Navigazione, ricerca e campanella compaiono quando le loro
 * destinazioni esistono: l'area reale le riceve insieme alle funzioni relative.
 */
export function AppShell({
  account,
  notifications,
  notificationsAction,
  now,
  search,
  navigation,
  menu,
  home,
  onSignOut,
  before,
  children,
}: {
  account: Pick<AccountView, "name" | "email">;
  notifications?: NotificationView[];
  /** Registra sul server le notifiche lette; senza, la lettura resta nella pagina. */
  notificationsAction?: string;
  now?: string;
  search?: ShellSearch;
  /** Destinazioni principali; senza, quelle complete dell'app. Vuota, nessuna navigazione. */
  navigation?: NavDestination[];
  /** Gruppi di voci separati; «Esci» chiude l'ultimo. */
  menu?: AccountMenuItem[][];
  home?: string;
  /** Riceve la funzione degli avvisi, per confermare l'esito. */
  onSignOut: (notify: (message: string) => void) => void;
  before?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { links } = useLinks();
  const homeHref = home ?? appHref(links, "ordini");
  const { t } = useCopy();
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const notify = useCallback(
    (message: string) => setNotice((current) => ({ id: (current?.id ?? 0) + 1, message })),
    [],
  );

  const destinations = navigation ?? shellDestinations(links, t);
  const navigable = destinations.length > 0;

  return (
    <NoticeContext value={notify}>
      <a
        href="#contenuto"
        className="sr-only z-50 rounded-lg bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring"
      >
        {t.shell.skipToContent}
      </a>
      {before}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-[min(72rem,calc(100%-2rem))] items-center gap-2 md:gap-6">
          <Link
            to={homeHref}
            className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <img
              src={logoUrl}
              alt="FiscalBay"
              width="224"
              height="45"
              className="h-6 w-auto dark:hidden"
            />
            <img
              src={logoDarkUrl}
              alt="FiscalBay"
              width="224"
              height="45"
              className="hidden h-6 w-auto dark:block"
            />
          </Link>
          {navigable ? (
            <nav aria-label={t.shell.mainNav} className="hidden h-full md:flex">
              <ul className="flex h-full items-stretch gap-1">
                {destinations.map(({ href, label, Icon, end }) => (
                  <li key={href} className="flex">
                    <NavLink
                      to={href}
                      end={end}
                      className="relative flex items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary"
                    >
                      <Icon aria-hidden="true" className="size-4" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {search ? (
              <>
                <GlobalSearch search={search} className="mr-2 hidden w-72 lg:block xl:w-80" />
                <MobileSearch search={search} />
              </>
            ) : null}
            {notifications && now ? (
              <NotificationsMenu
                notifications={notifications}
                readAction={notificationsAction}
                now={now}
              />
            ) : null}
            <AccountMenu
              account={account}
              menu={
                menu ?? [
                  accountMenu(links, t),
                  [
                    // Come nell'area reale: con una sessione la radice porterebbe agli Ordini.
                    {
                      href: `${localizedPath(links.language)}?${visitParam}=1`,
                      label: t.shell.visitSite,
                      Icon: Globe,
                      reloadDocument: true,
                    },
                  ],
                ]
              }
              onSignOut={() => onSignOut(notify)}
            />
          </div>
        </div>
      </header>
      <main
        id="contenuto"
        tabIndex={-1}
        className={cn(
          "mx-auto w-[min(72rem,calc(100%-2rem))] pt-6 pb-12 outline-none",
          navigable && "max-md:pb-28",
        )}
      >
        {children}
      </main>
      {navigable ? (
        <nav
          aria-label={t.shell.mainNav}
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid auto-cols-fr grid-flow-col">
            {destinations.map(({ href, label, Icon, end }) => (
              <li key={href}>
                <NavLink
                  to={href}
                  end={end}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:text-primary"
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="text-center leading-tight">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {/*
        Sopra velature e pannelli; `aria-live` esplicito lo tiene annunciato anche quando
        un pannello modale nasconde il resto della pagina. Sale sopra la barra di selezione.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom)+var(--selection-bar,0px))] z-[60] flex justify-center px-4",
          // Sopra la bottom navigation, quando c'è.
          navigable &&
            "max-md:bottom-[calc(5rem+env(safe-area-inset-bottom)+var(--selection-bar,0px))]",
        )}
      >
        {notice ? (
          <p
            key={notice.id}
            className="max-w-md animate-[notice-in_var(--duration-fast)_var(--ease-smooth-out)] rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-md motion-reduce:animate-none"
          >
            {notice.message}
          </p>
        ) : null}
      </div>
    </NoticeContext>
  );
}

function AccountMenu({
  account,
  menu,
  onSignOut,
}: {
  account: Pick<AccountView, "name" | "email">;
  menu: AccountMenuItem[][];
  onSignOut: () => void;
}) {
  const { t } = useCopy();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t.shell.account} />}
      >
        <InitialsTile
          name={account.name}
          fallback={account.email}
          size="sm"
          className="rounded-full"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-1.5 py-1.5">
            <InitialsTile name={account.name} fallback={account.email} className="rounded-full" />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm text-foreground">{account.name}</span>
              <span className="truncate font-normal">{account.email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {menu.map((group) => (
          <DropdownMenuGroup key={group.map((item) => item.href).join(" ")}>
            <DropdownMenuSeparator />
            {group.map(({ href, label, Icon, lang, reloadDocument, onSelect }) => (
              <DropdownMenuItem
                key={href}
                lang={lang}
                onClick={() =>
                  onSelect
                    ? onSelect()
                    : reloadDocument
                      ? window.location.assign(href)
                      : void navigate(href)
                }
              >
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut aria-hidden="true" />
          {t.shell.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
