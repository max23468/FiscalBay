import { cn } from "cn";
import { Check, ClipboardList, Clock, Plus } from "lucide-react";
import { LazyMotion, MotionConfig } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Link,
  useFetcher,
  useLocation,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "react-router";

import { useAction, useNotice } from "~/components/app-shell";
import { useConfirmed } from "~/components/confirmation";
import { EmptyState } from "~/components/empty-state";
import { PageTitle } from "~/components/icon-tile";
import { StatusAlert, StatusIcon } from "~/components/status";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import {
  exportHref,
  exportSection,
  exportedSelection,
  forgetExportedSelection,
  keepExportedSelection,
} from "../../orders/export-scope";
import { pagesParam, rememberStore, snapshotParam } from "../../orders/order-list";
import { searchParam } from "../../orders/order-search";
import { usePageTiming } from "../../page-timing";
import type { Language } from "../../i18n";
import { formatDate, formatRelative, type OrdersNotice, type OrderView } from "../../view-models";
import { OrderCard, type SecondaryActions } from "./card";
import { OrderSheet } from "./detail";
import { LoadingGrid, LoadingHeader } from "./loading";
import { remainingUnlocks, type OrdersAccount } from "./labels";
import { SelectionBar } from "./selection";
import { OrdersToolbar, SearchChip } from "./toolbar";
import { useTimeZone } from "~/components/time-zone";

/**
 * Dati della pagina Ordini, uguali per l'area reale (ordini persistiti e autorizzati) e per
 * l'anteprima (scenari sintetici). Un valore fiscale da sbloccare non è mai fra questi dati.
 */
export interface OrdersPageData extends SecondaryActions {
  view: "list" | "no-store" | "loading" | "empty";
  orders: OrderView[];
  total: number;
  nextHref: string | null;
  /** Gli ordini consultabili superano quelli leggibili in una richiesta: servono i filtri. */
  limited: boolean;
  /** Istantanea dell'elenco, come cursore opaco: l'indirizzo la conserva. */
  snapshot: string;
  /** Ordini arrivati dopo l'istantanea, che entrano soltanto in cima. */
  incoming: number;
  /** Elenco con una nuova istantanea, che comprende i nuovi ordini. */
  freshHref: string | null;
  /** I nuovi ordini stanno tutti sopra il primo mostrato: possono entrare da soli in cima. */
  incomingAtTop: boolean;
  /** Ricerca attiva, decifrata dal server: nell'indirizzo resta soltanto in forma cifrata. */
  search: string | null;
  /** Ordine aperto nel pannello, anche se fuori dalla pagina caricata. */
  detail: OrderView | null;
  stores: Array<{ id: string; name: string }>;
  account: OrdersAccount;
  notices: OrdersNotice[];
  sync: {
    running: boolean;
    lastAt: string | null;
    storeId: string | null;
    storeName: string | null;
    /** Giorni dello storico letto: il periodo di cui un elenco vuoto dà conto. */
    historyDays: number;
  };
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  /** Modello di messaggio scelto per ogni lingua dell'acquirente. */
  messageTemplates: Record<Language, string>;
  now: string;
  confirmUnlock?: boolean;
  /** Le Impostazioni del piano esistono: l'avviso degli sblocchi esauriti vi rimanda. */
  settings: boolean;
  /**
   * Collegamento di un negozio dal primo accesso: pagina reale, oppure null finché non è
   * possibile (email da confermare). Assente, l'azione resta quella simulata dell'anteprima.
   */
  connectHref?: string | null;
}

export interface UnlockResult {
  unlocked: string[];
  remaining: number | null;
  error?: boolean;
}

// Le animazioni sono un complemento: se il modulo non arriva, per esempio perché si lascia
// la pagina mentre si carica, le schede restano ferme senza un errore non gestito.
const loadMotionFeatures = () =>
  import("./motion-features").then(
    (module) => module.default,
    () => new Promise<never>(() => {}),
  );

function isEbayDown(data: OrdersPageData) {
  return data.notices.some((notice) => notice.kind === "ebay-down");
}

function importingNotice(data: OrdersPageData) {
  return data.notices.find((notice) => notice.kind === "importing");
}

function OrdersHeader({
  data,
  t,
  language,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
}) {
  // Durante il caricamento lo stato dell'aggiornamento non è ancora noto.
  if (data.view === "loading") return <LoadingHeader t={t} />;
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <PageTitle
        icon={ClipboardList}
        tone="blue"
        description={
          data.view === "list" ? (
            <p className="text-sm text-muted-foreground">
              {t.orders.count(data.total)}
              {data.total > 0 ? ` · ${t.orders.sortedBy}` : null}
            </p>
          ) : null
        }
      >
        {t.orders.title}
      </PageTitle>
      <SyncStatus data={data} t={t} language={language} />
    </header>
  );
}

function syncLabel(data: OrdersPageData, t: AppCopy, language: Language) {
  if (isEbayDown(data)) return t.orders.ebayDownTitle;
  const importing = importingNotice(data);
  if (importing) return t.orders.importingStatus(importing.count);
  if (data.sync.running) return t.orders.refreshingTitle;
  return data.sync.lastAt
    ? t.orders.syncedAgo(formatRelative(data.sync.lastAt, data.now, language))
    : null;
}

/** Importazione, aggiornamento o ultimo aggiornamento: un solo indicatore per la pagina. */
function SyncStatus({
  data,
  t,
  language,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
}) {
  const importing = importingNotice(data);
  const { running } = data.sync;
  const down = isEbayDown(data);
  const label = syncLabel(data, t, language);
  if (!label) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        down ? "text-warning" : "text-muted-foreground",
      )}
      role="status"
    >
      {down ? (
        <StatusIcon tone="warning" />
      ) : running || importing ? (
        <Spinner label={label} aria-hidden="true" role={undefined} />
      ) : (
        <Clock aria-hidden="true" className="size-4" />
      )}
      {label}
    </p>
  );
}

/** Negozio da ricollegare: l'avviso porta al suo pannello, dove si ricollega. */
function StoreIssueAlert({
  storeId,
  storeName,
  t,
  links,
}: {
  storeId: string;
  storeName: string;
  t: AppCopy;
  links: AppLinks;
}) {
  return (
    <StatusAlert tone="warning" title={t.orders.storeIssueTitle(storeName)}>
      <span className="grid justify-items-start gap-3">
        {t.orders.storeIssueBody}
        <Link
          to={appHref(links, `negozi/${storeId}`)}
          data-slot="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t.orders.storeIssueAction}
        </Link>
      </span>
    </StatusAlert>
  );
}

function OrdersNotices({
  data,
  t,
  language,
  links,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
  links: AppLinks;
}) {
  const zone = useTimeZone();
  if (data.notices.every((notice) => notice.kind === "importing")) return null;
  return (
    <div className="grid gap-3">
      {data.notices.map((notice) => {
        switch (notice.kind) {
          case "ebay-down":
            return (
              <StatusAlert key={notice.kind} tone="warning" title={t.orders.ebayDownTitle}>
                {notice.at
                  ? t.orders.ebayDownBody(formatDate(notice.at, language, "dateTime", zone))
                  : t.orders.ebayDownNeverBody}
              </StatusAlert>
            );
          case "store-read-failed":
            return (
              <StatusAlert
                key={`${notice.kind}:${notice.storeId}`}
                tone="warning"
                title={t.orders.storeReadFailedTitle(notice.storeName)}
              >
                <span className="grid justify-items-start gap-3">
                  {t.orders.storeReadFailedBody(formatDate(notice.at, language, "dateTime", zone))}
                  <Link
                    to={appHref(links, `negozi/${notice.storeId}`)}
                    data-slot="button"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t.orders.openStore}
                  </Link>
                </span>
              </StatusAlert>
            );
          case "quota":
            return (
              <StatusAlert key={notice.kind} tone="warning" title={t.orders.quotaTitle}>
                <span className="grid justify-items-start gap-3">
                  {t.orders.quotaBody(formatDate(notice.until, language, "dateTime", zone))}
                  {/* Senza la pagina del piano nessun collegamento a una destinazione assente. */}
                  {data.settings ? (
                    <Link
                      to={appHref(links, "impostazioni/piano")}
                      data-slot="button"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.quotaAction}
                    </Link>
                  ) : null}
                </span>
              </StatusAlert>
            );
          case "store-issue":
            return (
              <StoreIssueAlert
                key={`${notice.kind}:${notice.storeId}`}
                storeId={notice.storeId}
                storeName={notice.storeName}
                t={t}
                links={links}
              />
            );
          case "consent-expiring":
            return (
              <StatusAlert
                key={`${notice.kind}:${notice.storeId}`}
                tone="info"
                title={t.orders.consentExpiringTitle(notice.storeName)}
              >
                <span className="grid justify-items-start gap-3">
                  {t.orders.consentExpiringBody(formatDate(notice.at, language, "date", zone))}
                  {/* Il consenso è ancora valido: il ricollegamento parte subito dalla
                      schermata preparatoria, fuori dalle route dell'app. Con eBay che non
                      risponde resta sospeso, come in Negozi. */}
                  {isEbayDown(data) ? (
                    <Button variant="outline" size="sm" disabled focusableWhenDisabled>
                      {t.orders.reconnectStore}
                    </Button>
                  ) : (
                    <a
                      href={`${appHref(links, "negozi/collega")}?ricollega=${encodeURIComponent(notice.storeId)}&environment=${notice.ebayEnvironment}`}
                      data-slot="button"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.reconnectStore}
                    </a>
                  )}
                </span>
              </StatusAlert>
            );
          // L'importazione compare nell'indicatore dell'intestazione e in fondo all'elenco.
          case "importing":
            return null;
        }
        return null;
      })}
    </div>
  );
}

/** Collegamento del primo negozio: pagina reale, azione simulata o, finché non è possibile, nessuna. */
function ConnectAction({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const action = useAction();
  const content = (
    <>
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.orders.connectStore}
    </>
  );
  if (data.connectHref === null) return null;
  if (data.connectHref)
    return (
      <Link to={data.connectHref} data-slot="button" className={buttonVariants()}>
        {content}
      </Link>
    );
  return <Button onClick={() => action.run("store-connect")}>{content}</Button>;
}

/** Primi passi: compaiono finché la prima sincronizzazione non è conclusa, dal punto raggiunto. */
function OnboardingSteps({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const current = data.onboarding.findIndex((step) => !step.done);
  return (
    <section aria-labelledby="onboarding" className="grid gap-2 border-t pt-4">
      <h3 id="onboarding" className="text-xs font-medium text-muted-foreground">
        {t.orders.steps}
      </h3>
      <ol className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {data.onboarding.map((step, index) => (
          <li
            key={step.label}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              !step.done && index !== current && "text-muted-foreground",
              index === current && "font-medium",
            )}
          >
            {step.done ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "font-code grid size-4 place-items-center rounded-full text-[0.625rem]",
                  index === current ? "bg-primary text-primary-foreground" : "border",
                )}
              >
                {index + 1}
              </span>
            )}
            {t.orders[step.label]}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FirstUse({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  return (
    <EmptyState
      title={t.orders.firstUseTitle}
      description={t.orders.firstUseBody}
      action={<ConnectAction data={data} t={t} />}
    >
      <OnboardingSteps data={data} t={t} />
    </EmptyState>
  );
}

type Unlock = ReturnType<typeof useUnlock>;

/** Sblocco tramite l'azione del server: il dato arriva solo dopo la verifica della quota. */
function useUnlock(unlockAction: string, t: AppCopy) {
  const notify = useNotice();
  const fetcher = useFetcher<UnlockResult>();
  const handled = useRef<UnlockResult | undefined>(undefined);
  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result || handled.current === result) return;
    handled.current = result;
    if (result.error) {
      notify(t.orders.unlockFailed);
      return;
    }
    notify(
      result.unlocked.length === 1
        ? t.orders.unlocked(result.remaining)
        : t.orders.unlockedMany(result.unlocked.length),
    );
  }, [fetcher.state, fetcher.data, notify, t]);
  return {
    submit: (ids: string[], skipConfirmation = false) =>
      void fetcher.submit(
        { intent: "unlock", ids: ids.join(","), skipConfirmation: String(skipConfirmation) },
        { method: "post", action: unlockAction },
      ),
    pending: new Set(
      fetcher.state === "idle" ? [] : String(fetcher.formData?.get("ids") ?? "").split(","),
    ),
    // Gli ordini appena sbloccati mostrano il dato con una dissolvenza.
    revealed: new Set(fetcher.data?.unlocked ?? []),
  };
}

function LoadMore({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const [params] = useSearchParams();
  return (
    <div className="flex justify-center">
      {data.nextHref ? (
        <Link
          to={data.nextHref}
          preventScrollReset
          data-slot="button"
          className={buttonVariants({ variant: "outline" })}
        >
          {t.orders.loadMore}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          {data.limited
            ? t.orders.listLimit
            : importingNotice(data)
              ? t.orders.importMore
              : ["7", "30", "90"].includes(params.get("periodo") ?? "")
                ? t.orders.allShown
                : t.orders.allShownAll}
        </p>
      )}
    </div>
  );
}

/** Distanza dall'inizio della pagina entro cui l'utente è considerato in cima alla lista. */
const topThreshold = 120;

/** Un ordine si sblocca solo se è da sbloccare e nessuna verifica o conferma lo sospende. */
function unlockable(order: OrderView) {
  return order.fiscal.state === "locked" && !order.fiscal.hold;
}

/** Criteri senza risultati, con la strada per toglierli. */
function NoResults({
  criteria,
  onlySearch,
  href,
  t,
}: {
  criteria: URLSearchParams;
  onlySearch: boolean;
  href: string;
  t: AppCopy;
}) {
  return (
    <EmptyState
      variant="search"
      className="rounded-xl border bg-card px-5"
      title={t.orders.noResultsTitle}
      description={onlySearch ? t.orders.noSearchResultsBody : t.orders.noResultsBody}
      action={
        criteria.size > 0 ? (
          <Link
            to={href}
            preventScrollReset
            // Anche il negozio ricordato si azzera, altrimenti il nuovo accesso lo riapplica.
            onClick={onlySearch ? undefined : () => rememberStore(null)}
            data-slot="button"
            className={buttonVariants({ variant: "outline" })}
          >
            {onlySearch ? t.orders.clearSearch : t.orders.resetFilters}
          </Link>
        ) : undefined
      }
    />
  );
}

/**
 * L'indirizzo conserva l'istantanea dell'elenco, così ricarica, dettaglio e Indietro ritrovano
 * gli stessi ordini nello stesso ordine. I nuovi ordini entrano subito se stanno tutti sopra il
 * primo mostrato e l'utente è in cima alla lista senza selezionare né leggere un dettaglio
 * (`held`); altrimenti resta l'indicatore, così nulla si sposta mentre legge, il pannello
 * aperto non si chiude e un ordine recuperato dallo storico non entra fra quelli già letti.
 */
function useListSnapshot(data: OrdersPageData, held: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { snapshot, freshHref, incomingAtTop } = data;
  const synced = params.get(snapshotParam) === snapshot;
  // Durante un'altra navigazione, per esempio Indietro, la sostituzione prenderebbe il posto
  // della pagina di destinazione: si attende il router inattivo e l'indirizzo del browser
  // ancora uguale all'elenco mostrato.
  const idle = useNavigation().state === "idle";
  const shown = `${location.pathname}${location.search}`;
  const current = () => `${window.location.pathname}${window.location.search}` === shown;
  useEffect(() => {
    if (synced || !idle || !current()) return;
    const next = new URLSearchParams(params);
    next.set(snapshotParam, snapshot);
    setParams(next, { replace: true, preventScrollReset: true });
  });
  const insertAtTop = useEffectEvent(() => {
    if (freshHref && incomingAtTop && window.scrollY < topThreshold && !held && current())
      void navigate(freshHref, { replace: true, preventScrollReset: true });
  });
  // Si parte dall'indirizzo con l'istantanea: la nuova la cambia o la toglie, mai la aggiunge,
  // e quindi rilegge sempre l'elenco.
  const ready = synced && idle && freshHref !== null;
  useEffect(() => {
    if (!ready) return;
    insertAtTop();
    window.addEventListener("scroll", insertAtTop, { passive: true });
    return () => window.removeEventListener("scroll", insertAtTop);
  }, [ready, freshHref]);
}

/**
 * Ordini entrati con una nuova istantanea, a criteri invariati, sopra quelli già mostrati:
 * compaiono come nuovi. Un nuovo filtro o una nuova ricerca non ne introducono.
 */
function useNewOrders(orders: OrderView[], snapshot: string, criteria: string) {
  const [list, setList] = useState(() => ({
    snapshot,
    criteria,
    seen: new Set(orders.map((order) => order.id)),
    added: new Set<string>(),
  }));
  if (
    list.snapshot === snapshot &&
    list.criteria === criteria &&
    orders.every((order) => list.seen.has(order.id))
  )
    return list.added;
  const added = new Set(list.added);
  if (list.snapshot !== snapshot && list.criteria === criteria) {
    const firstSeen = orders.findIndex((order) => list.seen.has(order.id));
    for (const order of firstSeen < 0 ? [] : orders.slice(0, firstSeen)) added.add(order.id);
  }
  setList({
    snapshot,
    criteria,
    seen: new Set([...list.seen, ...orders.map((order) => order.id)]),
    added,
  });
  return added;
}

function OrdersList({
  data,
  orders: listed,
  t,
  links,
  unlock,
}: {
  data: OrdersPageData;
  orders: OrderView[];
  t: AppCopy;
  links: AppLinks;
  unlock: Unlock;
}) {
  const { language } = links;
  const location = useLocation();
  const navigate = useNavigate();
  const ebayDown = isEbayDown(data);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selectRef = useRef<HTMLButtonElement>(null);
  const { freshHref } = data;
  useListSnapshot(data, selecting || data.detail !== null);
  // L'esportazione riceve l'intero contesto dell'elenco; la selezione, se c'è, prevale.
  // L'istantanea mostrata dà lo stesso conteggio dell'elenco, anche prima che l'indirizzo la
  // riceva, e identifica l'elenco a cui la selezione esportata ritorna.
  const listParams = new URLSearchParams(location.search);
  listParams.set(snapshotParam, data.snapshot);
  const listHref = `${location.pathname}?${listParams}`;
  useEffect(() => {
    const ids = exportedSelection(listHref);
    if (!ids) return;
    // Si ripristina una volta: dettaglio, «Carica altri» e Indietro conservano poi la
    // selezione modificata, senza riportare quella esportata.
    forgetExportedSelection();
    setSelecting(true);
    setSelected(new Set(ids));
  }, [listHref]);
  const stopSelecting = () => {
    forgetExportedSelection();
    setSelecting(false);
    setSelected(new Set());
    selectRef.current?.focus();
  };
  const exportPath = appHref(links, exportSection);
  const exportOrders = (ids?: string[]) =>
    data.exportable ? exportHref(exportPath, listParams, ids) : null;
  // Lo sblocco della selezione chiude la modalità; quello di una scheda la lascia com'è.
  const submitSelection = (ids: string[]) => {
    stopSelecting();
    unlock.submit(ids);
  };
  const ordersHref = appHref(links, "ordini");
  const orders = listed;
  const criteria = new URLSearchParams(location.search);
  criteria.delete(pagesParam);
  criteria.delete(snapshotParam);
  const newIds = useNewOrders(orders, data.snapshot, criteria.toString());
  // Ogni altra scheda riceve la sua posizione d'ingresso la prima volta che compare e la
  // conserva: con «Carica altri» entrano soltanto le nuove, dalla prima in giù.
  const enterIndexes = useRef(new Map<string, number>()).current;
  const entering = orders.filter((order) => !enterIndexes.has(order.id) && !newIds.has(order.id));
  entering.forEach((order, index) => enterIndexes.set(order.id, index));
  // La selezione vale soltanto per gli ordini ancora presenti e consultabili nell'elenco.
  const visibleSelected = orders.filter((order) => selected.has(order.id));
  const lockedSelected = visibleSelected.filter(unlockable).map((order) => order.id);
  const onlySearch =
    criteria.has(searchParam) && [...criteria.keys()].every((key) => key === searchParam);
  const remaining = remainingUnlocks(data.account);
  return (
    <>
      <OrdersToolbar
        // Senza esportazione la selezione serve soltanto allo sblocco.
        empty={data.total === 0 || (!data.exportable && !orders.some(unlockable))}
        exportHref={data.exportable ? (data.total > 0 ? exportOrders() : null) : undefined}
        stores={data.stores}
        plan={data.account.plan}
        confirmUnlock={data.confirmUnlock}
        t={t}
        selecting={selecting}
        selectRef={selectRef}
        onToggleSelect={() => (selecting ? stopSelecting() : setSelecting(true))}
      />
      <SearchChip t={t} query={data.search} clearable={orders.length > 0 || !onlySearch} />
      {remaining !== null && remaining > 0 && orders.some(unlockable) ? (
        <p className="text-sm text-muted-foreground">{t.orders.unlockBalance(remaining)}</p>
      ) : null}
      {freshHref ? (
        <div className="flex justify-center">
          <Link
            to={freshHref}
            replace
            preventScrollReset
            data-slot="button"
            className={buttonVariants({ variant: "secondary" })}
          >
            {t.orders.newOrders(data.incoming)} · {t.orders.showNew}
          </Link>
        </div>
      ) : null}
      {orders.length === 0 ? (
        <NoResults criteria={criteria} onlySearch={onlySearch} href={ordersHref} t={t} />
      ) : (
        <>
          <LazyMotion features={loadMotionFeatures} strict>
            <MotionConfig
              reducedMotion="user"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <section aria-label={t.orders.list} className="grid gap-3 lg:grid-cols-2">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    t={t}
                    language={language}
                    account={data.account}
                    ebayDown={ebayDown}
                    detailHref={`${ordersHref}/${order.id}${location.search}`}
                    selecting={selecting}
                    selected={selected.has(order.id)}
                    onSelect={(value) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (value) next.add(order.id);
                        else next.delete(order.id);
                        return next;
                      })
                    }
                    revealed={unlock.revealed.has(order.id)}
                    unlocking={unlock.pending.has(order.id)}
                    onUnlock={unlock.submit}
                    confirmUnlock={data.confirmUnlock}
                    isNew={newIds.has(order.id)}
                    enterIndex={enterIndexes.get(order.id)}
                    actions={data}
                    exportHref={exportOrders([order.id])}
                  />
                ))}
              </section>
            </MotionConfig>
          </LazyMotion>
          <LoadMore data={data} t={t} />
        </>
      )}
      {selecting ? (
        <SelectionBar
          t={t}
          selected={visibleSelected.map((order) => order.id)}
          lockedSelected={lockedSelected}
          remaining={remainingUnlocks(data.account)}
          onUnlock={submitSelection}
          onCancel={stopSelecting}
          onExport={
            data.exportable
              ? () => {
                  const ids = visibleSelected.map((order) => order.id);
                  keepExportedSelection(listHref, ids);
                  void navigate(exportOrders(ids)!);
                }
              : undefined
          }
        />
      ) : null}
    </>
  );
}

/** Negozio collegato senza ordini: in attesa della prima lettura o senza ordini nel periodo. */
function NoOrders({ data, t, links }: { data: OrdersPageData; t: AppCopy; links: AppLinks }) {
  const zone = useTimeZone();
  const { language } = links;
  return (
    <EmptyState
      variant="all-clear"
      title={
        data.sync.lastAt ? t.orders.noOrdersTitle(data.sync.historyDays) : t.orders.firstSyncTitle
      }
      description={
        data.sync.lastAt
          ? t.orders.noOrdersBody(
              data.sync.storeName ?? "",
              formatDate(data.sync.lastAt, language, "dateTime", zone),
            )
          : t.orders.firstSyncBody(data.sync.storeName ?? "")
      }
      action={
        data.sync.storeId ? (
          <Link
            to={appHref(links, `negozi/${data.sync.storeId}`)}
            data-slot="button"
            className={buttonVariants({ variant: "outline" })}
          >
            {t.orders.openStore}
          </Link>
        ) : undefined
      }
    >
      {data.sync.lastAt ? null : <OnboardingSteps data={data} t={t} />}
    </EmptyState>
  );
}

/**
 * Pagina Ordini: la home dopo l'accesso, la stessa nell'area reale e nell'anteprima. Ricerca e
 * filtri vivono nell'URL, così dettaglio, indietro e ricarica conservano il contesto. Gli ordini
 * in verifica compaiono subito con l'ultimo stato salvato; `confirmation` porta, nella stessa
 * risposta, il loro stato confermato.
 */
export function OrdersPage({
  data,
  t,
  links,
  unlockAction,
  confirmation,
  notice,
}: {
  data: OrdersPageData;
  t: AppCopy;
  links: AppLinks;
  unlockAction: string;
  confirmation?: Promise<OrderView[]>;
  /** Avvisi propri dell'area che ospita la pagina, sotto l'intestazione. */
  notice?: React.ReactNode;
}) {
  const { language } = links;
  const unlock = useUnlock(unlockAction, t);
  const orders = useConfirmed(data.orders, confirmation);
  const [detail] = useConfirmed(data.detail ? [data.detail] : [], confirmation);
  usePageTiming("orders");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <OrdersHeader data={data} t={t} language={language} />
      {notice}
      <OrdersNotices data={data} t={t} language={language} links={links} />
      {data.view === "no-store" ? (
        <FirstUse data={data} t={t} />
      ) : data.view === "loading" ? (
        <LoadingGrid t={t} />
      ) : data.view === "empty" ? (
        <NoOrders data={data} t={t} links={links} />
      ) : (
        <OrdersList data={data} orders={orders} t={t} links={links} unlock={unlock} />
      )}
      <OrderSheet
        detail={detail ?? null}
        account={data.account}
        ebayDown={isEbayDown(data)}
        templates={data.messageTemplates}
        confirmUnlock={data.confirmUnlock}
        t={t}
        links={links}
        unlock={unlock}
        actions={data}
      />
    </div>
  );
}
