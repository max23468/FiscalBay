import { cn } from "cn";
import { Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { useCopy, useLinks } from "~/components/copy-context";
import type { Language } from "../i18n";
import { maxSearchLength, minSuggestionLength } from "../orders/order-search";

export interface SearchSuggestion {
  id: string;
  ebayOrderId: string;
  buyerName: string;
  detail: string;
  /** Dettaglio dell'ordine con la ricerca attiva. */
  href: string;
}

/** Risposta della ricerca: primi ordini, loro numero e indirizzo dell'elenco filtrato. */
export interface SearchResults {
  items: SearchSuggestion[];
  total: number;
  href: string;
}

/**
 * Ricerca ordini della shell: route che riceve la query nel corpo e ricerca attiva, con il
 * testo della pagina Ordini o null nelle altre pagine.
 */
export interface ShellSearch {
  action: string;
  query: string | null;
}

/** La query viaggia nel corpo della richiesta, mai nell'indirizzo. */
async function requestSearch(
  action: string,
  query: string,
  language: Language,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const body = new FormData();
  body.set("q", query);
  body.set("language", language);
  const response = await fetch(action, {
    method: "POST",
    body,
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("search_failed");
  return (await response.json()) as SearchResults;
}

/** Attesa dopo l'ultima battuta prima di chiedere i suggerimenti. */
const suggestionDelay = 150;

type SearchAnswer = ({ query: string } & SearchResults) | { query: string; failed: true };

/**
 * Suggerimenti per il testo scritto, chiesti dopo una breve pausa di battitura: una richiesta
 * superata da un nuovo testo si annulla.
 */
function useSearchSuggestions(action: string, language: Language) {
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const pending = useRef<{
    timer: ReturnType<typeof setTimeout>;
    controller: AbortController;
  } | null>(null);
  const cancel = useCallback(() => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    pending.current.controller.abort();
    pending.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const suggest = (text: string) => {
    cancel();
    const query = text.trim();
    if (query.length < minSuggestionLength) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      requestSearch(action, query, language, controller.signal).then(
        (found) => setAnswer({ query, ...found }),
        () => {
          if (!controller.signal.aborted) setAnswer({ query, failed: true });
        },
      );
    }, suggestionDelay);
    pending.current = { timer, controller };
  };
  return { answer, suggest };
}

/** Suggerimenti e «Vedi tutti», oppure l'esito vuoto o non riuscito della ricerca. */
function SearchPanel({ found, onSelect }: { found: SearchResults | null; onSelect: () => void }) {
  const { t } = useCopy();
  // Safari sfoca il campo prima del click senza focalizzare il link.
  const keepFocus = (event: React.MouseEvent) => {
    if (event.button === 0) event.preventDefault();
  };
  return (
    <div className="z-50 mt-1 grid grid-cols-[minmax(0,1fr)] gap-1 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 md:absolute md:inset-x-0">
      {!found || found.items.length === 0 ? (
        <p className="px-2 py-2 text-muted-foreground">
          {found ? t.shell.searchEmpty : t.shell.searchFailed}
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)]">
          {found.items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                onMouseDown={keepFocus}
                onClick={onSelect}
                className="grid grid-cols-[minmax(0,1fr)] gap-0.5 rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-2.5"
              >
                <span className="truncate font-medium">{item.buyerName}</span>
                <span className="flex gap-2 text-xs text-muted-foreground">
                  <span className="font-code whitespace-nowrap">{item.ebayOrderId}</span>
                  <span className="min-w-0 truncate">{item.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {found && found.total > 0 ? (
        <Link
          to={found.href}
          onMouseDown={keepFocus}
          onClick={onSelect}
          className="rounded-md border-t px-2 py-2 font-medium text-primary outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.shell.searchSeeAll(found.total)}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Ricerca ordini della top bar: suggerimenti dallo stesso motore della pagina Ordini e
 * «Vedi tutti» per aprire l'elenco filtrato. La query resta nel corpo delle richieste;
 * l'elenco riceve dal server l'indirizzo con la ricerca cifrata.
 */
export function GlobalSearch({
  search,
  className,
  autoFocus,
  onNavigate,
}: {
  search: ShellSearch;
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const navigate = useNavigate();
  const location = useLocation();
  // Su Ordini il campo mostra la ricerca attiva, anche dopo Indietro o ricarica.
  const [query, setQuery] = useState(search.query ?? "");
  const [syncedQuery, setSyncedQuery] = useState(search.query);
  if (search.query !== syncedQuery) {
    setSyncedQuery(search.query);
    if (search.query !== null) setQuery(search.query);
  }
  const [open, setOpen] = useState(false);
  const { answer, suggest } = useSearchSuggestions(search.action, links.language);
  const ready = useHydrated();
  const id = useId();
  const trimmed = query.trim();
  // Soltanto la risposta per il testo attuale: una precedente non descrive ciò che è scritto.
  const current =
    trimmed.length >= minSuggestionLength && answer?.query === trimmed ? answer : null;
  const found = current && !("failed" in current) ? current : null;

  // Una nuova pagina chiude i suggerimenti rimasti aperti.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    setOpen(false);
  }, [location.pathname]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };
  /** Elenco della ricerca; senza risposta del server il modulo si invia in modo ordinario. */
  const openResults = (form: HTMLFormElement) =>
    (found ? Promise.resolve(found) : requestSearch(search.action, trimmed, links.language))
      .then(({ href }) => {
        close();
        void navigate(href);
      })
      .catch(() => form.submit());
  const showPanel = open && current !== null;
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
        // La lente resta nel campo anche quando i suggerimenti allungano il contenitore.
        className="relative"
        method="post"
        action={search.action}
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) void openResults(event.currentTarget);
        }}
      >
        <input type="hidden" name="language" value={links.language} />
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
          maxLength={maxSearchLength}
          // Prima dell'idratazione un input controllato perderebbe il testo già inserito.
          disabled={!ready}
          autoComplete="off"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- apertura esplicita della ricerca su mobile
          autoFocus={autoFocus}
          value={query}
          placeholder={t.shell.searchPlaceholder}
          aria-describedby={`${id}-summary`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            suggest(event.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            // Un testo già presente (ricerca attiva, Indietro) riceve i suoi suggerimenti.
            if (!current) suggest(query);
          }}
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-card pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:text-base pointer-coarse:h-11"
        />
      </form>
      <p id={`${id}-summary`} className="sr-only" aria-live="polite">
        {showPanel
          ? found
            ? t.shell.searchSummary(found.items.length)
            : t.shell.searchFailed
          : ""}
      </p>
      {showPanel ? <SearchPanel found={found} onSelect={close} /> : null}
    </search>
  );
}

export function MobileSearch({ search }: { search: ShellSearch }) {
  const { t } = useCopy();
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
          {/* Un titolo lungo si tronca invece di allargare il foglio. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4 pr-14">
            <SheetTitle>{t.shell.search}</SheetTitle>
            <GlobalSearch search={search} autoFocus onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
