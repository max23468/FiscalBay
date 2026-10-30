import { cn } from "cn";
import { LogOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useNavigation } from "react-router";

import { NoticeContext } from "~/components/action";
import { InitialsTile } from "~/components/icon-tile";
import { Button } from "~/components/ui/button";
import { NavigationProgress } from "~/components/navigation-progress";
import { NotificationsMenu } from "~/components/notifications-menu";
import { areaSection, type AccountMenuItem, type NavDestination } from "~/components/shell-links";
import { GlobalSearch, MobileSearch, type ShellSearch } from "~/components/shell-search";
import { siteColumn } from "~/components/site-column";
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
import { appHref } from "../app-links";
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
  /** Destinazioni principali; vuota, nessuna navigazione. */
  navigation: NavDestination[];
  /** Gruppi di voci separati; «Esci» chiude l'ultimo. */
  menu: AccountMenuItem[][];
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

  const destinations = navigation;
  const navigable = destinations.length > 0;
  const section = useSectionEntry();

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
        <NavigationProgress />
        <div className={cn(siteColumn, "flex h-14 items-center gap-2 md:gap-6")}>
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
          {navigable ? <TopNav destinations={destinations} label={t.shell.mainNav} /> : null}
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
            <AccountMenu account={account} menu={menu} onSignOut={() => onSignOut(notify)} />
          </div>
        </div>
      </header>
      {/* Una nuova sezione entra con una breve dissolvenza; il primo caricamento no. */}
      <main
        key={section.key}
        id="contenuto"
        tabIndex={-1}
        className={cn(
          siteColumn,
          "pt-6 pb-12 outline-none",
          navigable && "max-md:pb-28",
          section.fade &&
            "animate-[value-reveal_var(--duration-quick)_var(--ease-smooth-out)] motion-reduce:animate-none",
        )}
      >
        {children}
      </main>
      {navigable ? <BottomNav destinations={destinations} label={t.shell.mainNav} /> : null}
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

/** Navigazione in alto da 768 px, con la barra che segue la destinazione. */
function TopNav({ destinations, label }: { destinations: NavDestination[]; label: string }) {
  const topNav = useNavIndicator<HTMLUListElement>("line");
  return (
    <nav aria-label={label} className="hidden h-full md:flex">
      <ul
        ref={topNav.list}
        data-indicator={topNav.box ? "" : undefined}
        className="group/nav relative flex h-full items-stretch gap-1"
      >
        {destinations.map(({ href, label, Icon, end }) => (
          <li key={href} className="flex">
            <NavLink
              to={href}
              end={end}
              className="relative flex items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary group-has-[a.pending]/nav:aria-[current=page]:text-muted-foreground group-data-indicator/nav:after:hidden [&.pending]:text-foreground!"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          </li>
        ))}
        {topNav.box ? (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-[translate,width] duration-(--duration-fast) ease-(--ease-smooth-out)"
            style={{
              translate: `calc(${topNav.box.x}px + 0.75rem) 0`,
              width: `calc(${topNav.box.width}px - 1.5rem)`,
            }}
          />
        ) : null}
      </ul>
    </nav>
  );
}

/** Navigazione in basso su mobile, con la pillola dietro l'icona della destinazione. */
function BottomNav({ destinations, label }: { destinations: NavDestination[]; label: string }) {
  const bottomNav = useNavIndicator<HTMLUListElement>("pill");
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul
        ref={bottomNav.list}
        className="group/nav relative isolate grid auto-cols-fr grid-flow-col"
      >
        {destinations.map(({ href, label, Icon, end }) => (
          <li key={href}>
            <NavLink
              to={href}
              end={end}
              className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground outline-none transition-colors duration-(--duration-quick) focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:text-primary group-has-[a.pending]/nav:aria-[current=page]:text-muted-foreground [&.pending]:text-primary!"
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="text-center leading-tight">{label}</span>
            </NavLink>
          </li>
        ))}
        {/* Pillola dietro l'icona della destinazione: compare dopo la prima misura. */}
        {bottomNav.box ? (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 -z-10 h-8 w-14 rounded-full bg-primary/10 transition-[translate] duration-(--duration-fast) ease-(--ease-smooth-out)"
            style={{
              translate: `calc(${bottomNav.box.x + bottomNav.box.width / 2}px - 1.75rem) calc(${bottomNav.box.y + bottomNav.box.height / 2}px - 1rem)`,
            }}
          />
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * Chiave del contenuto per sezione: cambiare sezione lo rimonta con una dissolvenza, mentre
 * filtri, dettagli e sotto-pagine della stessa sezione aggiornano il contenuto sul posto.
 */
function useSectionEntry() {
  const key = areaSection(useLocation().pathname);
  const [entry, setEntry] = useState({ key, fade: false });
  if (entry.key !== key) setEntry({ key, fade: true });
  return entry;
}

/**
 * Posizione dell'indicatore della navigazione: segue la destinazione appena scelta mentre si
 * carica, poi quella corrente. Con `line` misura il collegamento, con `pill` la sua icona.
 * Fino alla prima misura, e quando la navigazione è nascosta, l'indicatore non c'è.
 */
function useNavIndicator<T extends HTMLElement>(variant: "line" | "pill") {
  const list = useRef<T>(null);
  const { pathname } = useLocation();
  const pending = useNavigation().location?.pathname;
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const container = list.current;
    if (!container) return;
    const measure = () => {
      const link =
        container.querySelector<HTMLElement>("a.pending") ??
        container.querySelector<HTMLElement>('a[aria-current="page"]');
      const target = variant === "pill" ? link?.querySelector("svg") : link;
      const inner = target?.getBoundingClientRect();
      if (!inner || inner.width === 0) return setBox(null);
      const outer = container.getBoundingClientRect();
      setBox((current) => {
        const next = {
          x: inner.left - outer.left,
          y: inner.top - outer.top,
          width: inner.width,
          height: inner.height,
        };
        return current &&
          current.x === next.x &&
          current.y === next.y &&
          current.width === next.width &&
          current.height === next.height
          ? current
          : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [pathname, pending, variant]);
  return { list, box };
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
