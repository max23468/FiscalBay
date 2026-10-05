import { cn } from "cn";
import {
  Bell,
  ClipboardList,
  CreditCard,
  Globe,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useFetcher, useLocation, useNavigate } from "react-router";

import { InitialsTile } from "~/components/icon-tile";
import { StatusIcon } from "~/components/status";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import logoDarkUrl from "../../docs/brand/logo/fiscalbay-logo-dark.svg?url";
import logoUrl from "../../docs/brand/logo/fiscalbay-logo.svg?url";
import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";
import { localizedPath, type Language } from "../i18n";
import {
  formatRelative,
  type AccountView,
  type ActionResult,
  type NotificationView,
} from "../view-models";

export interface SearchSuggestion {
  id: string;
  ebayOrderId: string;
  buyerName: string;
  detail: string;
}

const NoticeContext = createContext<(message: string) => void>(() => {});

/** Conferma breve di un'azione, annunciata anche ai lettori di schermo. */
export function useNotice() {
  return useContext(NoticeContext);
}

/**
 * Azione sulla route corrente, distinta da `intent`: esito e avviso li decide il
 * server. L'anteprima risponde con una simulazione, le route reali eseguono.
 */
export function useAction() {
  const notify = useNotice();
  const fetcher = useFetcher<ActionResult>();
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result || handled.current === result) return;
    handled.current = result;
    if (result.notice) notify(result.notice);
  }, [fetcher.state, fetcher.data, notify]);
  return {
    run: (intent: string, fields: Record<string, string> = {}) =>
      void fetcher.submit({ ...fields, intent }, { method: "post" }),
    pending: fetcher.state !== "idle",
    /** Ultimo esito, disponibile a richiesta conclusa. */
    result: fetcher.state === "idle" ? fetcher.data : undefined,
  };
}

/** Voce del menu dell'avatar; `reloadDocument` per le pagine fuori dalle route dell'app. */
export interface AccountMenuItem {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  lang?: Language;
  reloadDocument?: boolean;
}

/** Destinazione della navigazione principale; `end` per la radice dell'area. */
export interface NavDestination {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
}

/**
 * Shell dell'app. Navigazione, ricerca e campanella compaiono quando le loro
 * destinazioni esistono: l'area reale le riceve insieme alle funzioni relative.
 */
export function AppShell({
  links,
  t,
  account,
  notifications,
  now,
  suggest,
  navigation,
  menu,
  home = appHref(links, "ordini"),
  onSignOut,
  before,
  children,
}: {
  links: AppLinks;
  t: AppCopy;
  account: Pick<AccountView, "name" | "email">;
  notifications?: NotificationView[];
  now?: string;
  suggest?: (query: string) => { items: SearchSuggestion[]; total: number };
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

  const destinations: NavDestination[] = navigation ?? [
    { href: appHref(links, "ordini"), label: t.shell.orders, Icon: ClipboardList },
    { href: appHref(links, "negozi"), label: t.shell.stores, Icon: Store },
    { href: appHref(links, "impostazioni"), label: t.shell.settings, Icon: Settings },
  ];
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
            to={home}
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
                {destinations.map(({ href, label, end }) => (
                  <li key={href} className="flex">
                    <NavLink
                      to={href}
                      end={end}
                      className="relative flex items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary"
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {suggest ? (
              <>
                <GlobalSearch
                  t={t}
                  links={links}
                  suggest={suggest}
                  className="mr-2 hidden w-72 lg:block xl:w-80"
                />
                <MobileSearch t={t} links={links} suggest={suggest} />
              </>
            ) : null}
            {notifications && now ? (
              <NotificationsMenu t={t} links={links} notifications={notifications} now={now} />
            ) : null}
            <AccountMenu
              t={t}
              account={account}
              menu={
                menu ?? [
                  [
                    { href: appHref(links, "profilo"), label: t.shell.profile, Icon: User },
                    {
                      href: appHref(links, "impostazioni/sicurezza"),
                      label: t.shell.security,
                      Icon: ShieldCheck,
                    },
                    {
                      href: appHref(links, "impostazioni/piano"),
                      label: t.shell.planBilling,
                      Icon: CreditCard,
                    },
                    {
                      href: appHref(links, "impostazioni"),
                      label: t.shell.settings,
                      Icon: Settings,
                    },
                  ],
                  [
                    {
                      href: localizedPath(links.language, "/"),
                      label: t.shell.visitSite,
                      Icon: Globe,
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

/**
 * Ricerca ordini della top bar: suggerimenti dallo stesso motore della
 * pagina Ordini e «Vedi tutti» per aprire l'elenco filtrato.
 */
function GlobalSearch({
  t,
  links,
  suggest,
  className,
  autoFocus,
  onNavigate,
}: {
  t: AppCopy;
  links: AppLinks;
  suggest: (query: string) => { items: SearchSuggestion[]; total: number };
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const ordersHref = appHref(links, "ordini");
  // Su Ordini il campo mostra la ricerca attiva nell'URL, anche dopo Indietro o ricarica.
  const urlQuery = location.pathname.startsWith(ordersHref)
    ? (new URLSearchParams(location.search).get("q") ?? "")
    : null;
  const [query, setQuery] = useState(urlQuery ?? "");
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== null) setQuery(urlQuery);
  }
  const [open, setOpen] = useState(false);
  const id = useId();
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed.length >= 2 ? suggest(trimmed) : { items: [], total: 0 }),
    [suggest, trimmed],
  );
  const allHref = `${ordersHref}?q=${encodeURIComponent(trimmed)}`;

  // Una nuova pagina chiude i suggerimenti rimasti aperti.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    setOpen(false);
  }, [location.pathname]);

  const showPanel = open && trimmed.length >= 2;
  return (
    <search
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        action={ordersHref}
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) return;
          setOpen(false);
          onNavigate?.();
          void navigate(allHref);
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {t.shell.search}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={`${id}-input`}
          type="search"
          name="q"
          autoComplete="off"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- apertura esplicita della ricerca su mobile
          autoFocus={autoFocus}
          value={query}
          placeholder={t.shell.searchPlaceholder}
          aria-describedby={`${id}-summary`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-card pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:text-base pointer-coarse:h-11"
        />
      </form>
      <p id={`${id}-summary`} className="sr-only" aria-live="polite">
        {showPanel ? t.shell.searchSummary(results.items.length) : ""}
      </p>
      {showPanel ? (
        <div className="z-50 mt-1 grid gap-1 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 md:absolute md:inset-x-0">
          {results.items.length === 0 ? (
            <p className="px-2 py-2 text-muted-foreground">{t.shell.searchEmpty}</p>
          ) : (
            <ul className="grid">
              {results.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`${ordersHref}/${item.id}?q=${encodeURIComponent(trimmed)}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="grid gap-0.5 rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-2.5"
                  >
                    <span className="truncate font-medium">{item.buyerName}</span>
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      <span className="font-code whitespace-nowrap">{item.ebayOrderId}</span>
                      <span className="truncate">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {results.total > 0 ? (
            <Link
              to={allHref}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="rounded-md border-t px-2 py-2 font-medium text-primary outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.shell.searchSeeAll(results.total)}
            </Link>
          ) : null}
        </div>
      ) : null}
    </search>
  );
}

function MobileSearch({
  t,
  links,
  suggest,
}: {
  t: AppCopy;
  links: AppLinks;
  suggest: (query: string) => { items: SearchSuggestion[]; total: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={t.shell.search}
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" closeLabel={t.shell.close} className="max-h-dvh">
          <div className="grid gap-3 p-4 pr-14">
            <SheetTitle>{t.shell.search}</SheetTitle>
            <GlobalSearch
              t={t}
              links={links}
              suggest={suggest}
              autoFocus
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotificationsMenu({
  t,
  links,
  notifications,
  now,
}: {
  t: AppCopy;
  links: AppLinks;
  notifications: NotificationView[];
  now: string;
}) {
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(
    () => new Set(notifications.filter((item) => item.read).map((item) => item.id)),
  );
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((item) => !readIds.has(item.id)).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t.shell.notificationsUnread(unread)}
          />
        }
      >
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="grid">
            <PopoverTitle>{t.shell.notifications}</PopoverTitle>
            <span className="text-xs text-muted-foreground">{t.shell.notificationsWindow}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0}
            onClick={() => setReadIds(new Set(notifications.map((item) => item.id)))}
          >
            {t.shell.markAllRead}
          </Button>
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">
            {t.shell.notificationsEmpty}
          </p>
        ) : (
          <ul className="grid divide-y">
            {notifications.map((item) => {
              const unreadItem = !readIds.has(item.id);
              const body = (
                <>
                  <StatusIcon tone={item.tone} className="mt-0.5" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={cn("text-pretty", unreadItem && "font-medium")}>
                      {item.title}
                    </span>
                    <span className="text-pretty text-muted-foreground">{item.body}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(item.at, now, links.language)}
                    </span>
                  </span>
                  {unreadItem ? (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </>
              );
              const itemClass =
                "grid grid-cols-[1rem_minmax(0,1fr)_0.5rem] gap-3 px-3 py-3 leading-relaxed";
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      to={appHref(links, item.href)}
                      onClick={() => {
                        setReadIds((ids) => new Set(ids).add(item.id));
                        setOpen(false);
                      }}
                      className={cn(
                        itemClass,
                        "outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={itemClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AccountMenu({
  t,
  account,
  menu,
  onSignOut,
}: {
  t: AppCopy;
  account: Pick<AccountView, "name" | "email">;
  menu: AccountMenuItem[][];
  onSignOut: () => void;
}) {
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
            {group.map(({ href, label, Icon, lang, reloadDocument }) => (
              <DropdownMenuItem
                key={href}
                lang={lang}
                onClick={() =>
                  reloadDocument ? window.location.assign(href) : void navigate(href)
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
