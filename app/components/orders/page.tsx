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

import { useAction, useFetcherResult, useNotice } from "~/components/action";
import { useConfirmed } from "~/components/confirmation";
import { EmptyState } from "~/components/empty-state";
import { PageTitle } from "~/components/icon-tile";
import { StatusAlert, StatusIcon } from "~/components/status";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import type { AppCopy } from "../../app-copy";
import { appHref } from "../../app-links";
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
import {
  orderPeriods,
  trialDaysLeft,
  trialEnding,
  type OrdersNotice,
  type OrderView,
} from "../../view-models";
import { formatDate, formatRelative } from "../../format";
import { OrderCard, type SecondaryActions } from "./card";
import { OrderSheet } from "./detail";
import { LoadingGrid, LoadingHeader } from "./loading";
import { remainingUnlocks, type OrdersAccount } from "./labels";
import { SelectionBar } from "./selection";
import { OrdersToolbar, SearchChip } from "./toolbar";
import { useTimeZone } from "~/components/time-zone";
import { useCopy, useLinks } from "~/components/copy-context";

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

function OrdersHeader({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  // Durante il caricamento lo stato dell'aggiornamento non è ancora noto.
  if (data.view === "loading") return <LoadingHeader />;
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
      <SyncStatus data={data} />
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
function SyncStatus({ data }: { data: OrdersPageData }) {
  const { t, language } = useCopy();
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
        <Spinner />
      ) : (
        <Clock aria-hidden="true" className="size-4" />
      )}
      {label}
    </p>
  );
}

/** Negozio da ricollegare: l'avviso porta al suo pannello, dove si ricollega. */
function StoreIssueAlert({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { links } = useLinks();
  const { t } = useCopy();
  return (
    <StatusAlert tone="warning" title={t.orders.storeIssueTitle(storeName)}>
      <span className="grid justify-items-start gap-3">
        {t.orders.storeIssueBody}
        <Link
          to={appHref(links, `negozi/${storeId}`)}
          {...buttonLink({ variant: "outline", size: "sm" })}
        >
          {t.orders.storeIssueAction}
        </Link>
      </span>
    </StatusAlert>
  );
}

function OrdersNotices({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t, language } = useCopy();
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
                    {...buttonLink({ variant: "outline", size: "sm" })}
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
                      {...buttonLink({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.quotaAction}
                    </Link>
                  ) : null}
                </span>
              </StatusAlert>
            );
          case "waitlist":
            return (
              <StatusAlert key={notice.kind} tone="info" title={t.orders.waitlistTitle}>
                <span className="grid justify-items-start gap-3">
                  {notice.purchase
                    ? `${t.settings.plan.waitlisted} ${t.settings.plan.waitlistedPurchase}`
                    : t.settings.plan.waitlisted}
                  {notice.purchase && data.settings ? (
                    <Link
                      to={appHref(links, "impostazioni/piano")}
                      {...buttonLink({ variant: "outline", size: "sm" })}
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
                      {...buttonLink({ variant: "outline", size: "sm" })}
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
function ConnectAction({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
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
      <Link to={data.connectHref} {...buttonLink()}>
        {content}
      </Link>
    );
  return <Button onClick={() => action.run("store-connect")}>{content}</Button>;
}

/** Primi passi: compaiono finché la prima sincronizzazione non è conclusa, dal punto raggiunto. */
function OnboardingSteps({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
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

function FirstUse({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  return (
    <EmptyState
      title={t.orders.firstUseTitle}
      description={t.orders.firstUseBody}
      action={<ConnectAction data={data} />}
    >
      <OnboardingSteps data={data} />
    </EmptyState>
  );
}

type Unlock = ReturnType<typeof useUnlock>;

/** Sblocco tramite l'azione del server: il dato arriva solo dopo la verifica della quota. */
function useUnlock(unlockAction: string, t: AppCopy) {
  const notify = useNotice();
  const fetcher = useFetcher<UnlockResult>();
  useFetcherResult(fetcher, (result) => {
    if (result.error) {
      notify(t.orders.unlockFailed);
      return;
    }
    notify(
      result.unlocked.length === 1
        ? t.orders.unlocked(result.remaining)
        : t.orders.unlockedMany(result.unlocked.length),
    );
  });
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

function LoadMore({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  const [params] = useSearchParams();
  return (
    <div className="flex justify-center">
      {data.nextHref ? (
        <Link to={data.nextHref} preventScrollReset {...buttonLink({ variant: "outline" })}>
          {t.orders.loadMore}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          {data.limited
            ? t.orders.listLimit
            : importingNotice(data)
              ? t.orders.importMore
              : (orderPeriods as readonly string[]).includes(params.get("periodo") ?? "")
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
}: {
  criteria: URLSearchParams;
  onlySearch: boolean;
  href: string;
}) {
  const { t } = useCopy();
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
            {...buttonLink({ variant: "outline" })}
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

/**
 * Ogni scheda non nuova riceve la sua posizione d'ingresso la prima volta che compare e la
 * conserva: con «Carica altri» entrano soltanto le nuove, dalla prima in giù.
 */
function useEnterIndexes(orders: OrderView[], newIds: ReadonlySet<string>) {
  const entering = (known: ReadonlyMap<string, number>) =>
    orders.filter((order) => !known.has(order.id) && !newIds.has(order.id));
  const [indexes, setIndexes] = useState(
    () => new Map(entering(new Map()).map((order, index) => [order.id, index])),
  );
  const added = entering(indexes);
  if (added.length === 0) return indexes;
  const next = new Map(indexes);
  added.forEach((order, index) => next.set(order.id, index));
  setIndexes(next);
  return next;
}

function OrdersList({
  data,
  orders,
  unlock,
}: {
  data: OrdersPageData;
  orders: OrderView[];
  unlock: Unlock;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
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
  const criteria = new URLSearchParams(location.search);
  criteria.delete(pagesParam);
  criteria.delete(snapshotParam);
  const newIds = useNewOrders(orders, data.snapshot, criteria.toString());
  const enterIndexes = useEnterIndexes(orders, newIds);
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
        selecting={selecting}
        selectRef={selectRef}
        onToggleSelect={() => (selecting ? stopSelecting() : setSelecting(true))}
      />
      <SearchChip query={data.search} clearable={orders.length > 0 || !onlySearch} />
      {remaining !== null && remaining > 0 && orders.some(unlockable) ? (
        <p className="text-sm text-muted-foreground">{t.orders.unlockBalance(remaining)}</p>
      ) : null}
      {freshHref ? (
        <div className="flex justify-center">
          <Link to={freshHref} replace preventScrollReset {...buttonLink({ variant: "secondary" })}>
            {t.orders.newOrders(data.incoming)} · {t.orders.showNew}
          </Link>
        </div>
      ) : null}
      {orders.length === 0 ? (
        <NoResults criteria={criteria} onlySearch={onlySearch} href={ordersHref} />
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
          <LoadMore data={data} />
        </>
      )}
      {selecting ? (
        <SelectionBar
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

/**
 * Prova Premium: un invito discreto dopo la prima lettura riuscita, anche senza ordini, poi il
 * tempo rimasto, in evidenza negli ultimi giorni con il rimando al piano.
 */
function TrialNotice({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const zone = useTimeZone();
  const action = useAction();
  const { trial, trialAvailable } = data.account;
  if (trial) {
    if (!trialEnding(trial.endsAt, data.now))
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusIcon tone="premium" />
          {t.orders.trialStatus(trialDaysLeft(trial.endsAt, data.now))}
        </p>
      );
    return (
      <StatusAlert
        tone="premium"
        title={t.orders.trialEndingTitle(
          formatDate(trial.endsAt, links.language, "dateTime", zone),
        )}
      >
        <span className="grid justify-items-start gap-3">
          {t.orders.trialEndingBody}
          <Link
            to={appHref(links, "impostazioni/piano")}
            {...buttonLink({ variant: "outline", size: "sm" })}
          >
            {t.orders.trialEndingAction}
          </Link>
        </span>
      </StatusAlert>
    );
  }
  if (!trialAvailable || !data.sync.lastAt || (data.view !== "list" && data.view !== "empty"))
    return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <p className="flex items-center gap-2">
        <StatusIcon tone="premium" />
        {t.orders.trialOffer}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={action.pending}
        onClick={() => action.run("start-trial")}
      >
        {action.pending ? <Spinner /> : null}
        {t.settings.plan.trialAction}
      </Button>
    </div>
  );
}

/** Negozio collegato senza ordini: in attesa della prima lettura o senza ordini nel periodo. */
function NoOrders({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
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
            {...buttonLink({ variant: "outline" })}
          >
            {t.orders.openStore}
          </Link>
        ) : undefined
      }
    >
      {data.sync.lastAt ? null : <OnboardingSteps data={data} />}
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
  unlockAction,
  confirmation,
  notice,
}: {
  data: OrdersPageData;
  unlockAction: string;
  confirmation?: Promise<OrderView[]>;
  /** Avvisi propri dell'area che ospita la pagina, sotto l'intestazione. */
  notice?: React.ReactNode;
}) {
  const { t } = useCopy();
  const unlock = useUnlock(unlockAction, t);
  const orders = useConfirmed(data.orders, confirmation);
  const [detail] = useConfirmed(data.detail ? [data.detail] : [], confirmation);
  usePageTiming("orders");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <OrdersHeader data={data} />
      {notice}
      <OrdersNotices data={data} />
      {data.view === "loading" ? null : <TrialNotice data={data} />}
      {data.view === "no-store" ? (
        <FirstUse data={data} />
      ) : data.view === "loading" ? (
        <LoadingGrid />
      ) : data.view === "empty" ? (
        <NoOrders data={data} />
      ) : (
        <OrdersList data={data} orders={orders} unlock={unlock} />
      )}
      <OrderSheet
        detail={detail ?? null}
        account={data.account}
        ebayDown={isEbayDown(data)}
        templates={data.messageTemplates}
        confirmUnlock={data.confirmUnlock}
        unlock={unlock}
        actions={data}
      />
    </div>
  );
}
