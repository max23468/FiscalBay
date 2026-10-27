import { LazyMotion, MotionConfig } from "motion/react";
import { useEffect, useEffectEvent } from "react";
import { Link, useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";

import { useFetcherResult, useNotice } from "~/components/action";
import { useConfirmed } from "~/components/confirmation";
import { EmptyState } from "~/components/empty-state";
import { buttonLink } from "~/components/ui/button-variants";
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
import { orderPeriods, type OrdersNotice, type OrderView } from "../../view-models";
import { OrderCard, type SecondaryActions } from "./card";
import { OrderSheet } from "./detail";
import { useEnterIndexes, useListSnapshot, useNewOrders } from "./list-snapshot";
import { LoadingGrid } from "./loading";
import { OrdersHeader, OrdersNotices, TrialNotice } from "./notices";
import { MarketingProposal } from "./marketing-proposal";
import { FirstUse, NoOrders } from "./onboarding";
import { importingNotice, isEbayDown, remainingUnlocks, type OrdersAccount } from "./labels";
import { SelectionBar, useOrderSelection } from "./selection";
import { OrdersToolbar, SearchChip } from "./toolbar";
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
   * Proposta del consenso marketing, una volta e a primi passi conclusi, a chi in registrazione
   * non ha aderito e non ha più scelto (§14).
   */
  marketingProposal?: boolean;
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
  const { freshHref } = data;
  // L'esportazione riceve l'intero contesto dell'elenco; la selezione, se c'è, prevale.
  // L'istantanea mostrata dà lo stesso conteggio dell'elenco, anche prima che l'indirizzo la
  // riceva, e identifica l'elenco a cui la selezione esportata ritorna.
  const listParams = new URLSearchParams(location.search);
  listParams.set(snapshotParam, data.snapshot);
  const listHref = `${location.pathname}?${listParams}`;
  const { selecting, selected, selectRef, startSelecting, stopSelecting, toggleSelected } =
    useOrderSelection();
  useListSnapshot(data, selecting || data.detail !== null);
  // Si ripristina una volta: dettaglio, «Carica altri» e Indietro conservano poi la selezione
  // modificata, senza riportare quella esportata.
  const restoreExported = useEffectEvent((href: string) => {
    const ids = exportedSelection(href);
    if (!ids) return;
    forgetExportedSelection();
    startSelecting(ids);
  });
  useEffect(() => restoreExported(listHref), [listHref]);
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
        onToggleSelect={() => (selecting ? stopSelecting() : startSelecting())}
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
                    onSelect={(value) => toggleSelected(order.id, value)}
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
      {data.marketingProposal ? <MarketingProposal /> : null}
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
