import type { orderAllowance } from "../domain/grants.server";
import { ebayOutage, readsFailing, type StoreStatus } from "../domain/stores.server";
import type { EbayEnvironment, OrdersNotice } from "../view-models";

/**
 * Avvisi in cima agli Ordini, dai negozi dell'ambiente mostrato e dalla quota: eBay che non
 * risponde o chiamate sospese per manutenzione, collegamenti scaduti o in scadenza, letture ferme di un negozio nella vista, lista
 * d'attesa o sblocchi esauriti e importazione dello storico in corso.
 */
export function ordersNotices({
  stores,
  ebayEnvironment,
  storeId,
  allowance,
  locked,
  ebayCalls,
}: {
  stores: StoreStatus[];
  ebayEnvironment: EbayEnvironment;
  /** Negozio filtrato, se c'è. */
  storeId: string | undefined;
  allowance: Awaited<ReturnType<typeof orderAllowance>> | null;
  /** Nella vista c'è almeno un ordine con il dato da sbloccare. */
  locked: boolean;
  /** Chiamate eBay accese dalla console. */
  ebayCalls: boolean;
}): OrdersNotice[] {
  // Con le chiamate sospese per manutenzione vale come eBay che non risponde, con il suo nome.
  const synced = stores.flatMap((store) => (store.lastSyncAt ? [store.lastSyncAt] : []));
  const outage =
    !ebayCalls && stores.some((store) => store.connection === "active")
      ? { lastSyncAt: synced.sort().at(-1) ?? null, maintenance: true }
      : ebayOutage(stores);
  const cycle = allowance?.cycle ?? null;
  return [
    ...(outage
      ? [
          {
            kind: "ebay-down" as const,
            at: outage.lastSyncAt,
            ...("maintenance" in outage ? { maintenance: true } : {}),
          },
        ]
      : []),
    // Prima i collegamenti già scaduti, poi quelli in scadenza.
    ...stores
      .flatMap((store) =>
        store.reminder ? [{ id: store.id, name: store.name, ...store.reminder }] : [],
      )
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expired" ? -1 : 1))
      .map((store): OrdersNotice =>
        store.kind === "expired"
          ? { kind: "store-issue", storeId: store.id, storeName: store.name }
          : {
              kind: "consent-expiring",
              storeId: store.id,
              storeName: store.name,
              at: store.at,
              ebayEnvironment,
            },
      ),
    // Senza un'indisponibilità generale, un negozio con le letture ferme lo dice se i suoi
    // ordini sono nella vista; altrimenti restano Negozi e campanella.
    ...(outage
      ? []
      : stores
          .filter(
            (store) =>
              readsFailing(store) &&
              store.lastSyncAt !== null &&
              (!storeId || storeId === store.id),
          )
          .map((store): OrdersNotice => ({
            kind: "store-read-failed",
            storeId: store.id,
            storeName: store.name,
            at: store.lastSyncAt!,
          }))),
    ...(allowance?.waiting
      ? [{ kind: "waitlist" as const, purchase: allowance.purchasesOpen }]
      : !allowance?.premium && cycle && allowance?.remaining === 0 && locked
        ? [{ kind: "quota" as const, until: cycle.ends_at }]
        : []),
    ...(stores.some((store) => store.history?.done === false)
      ? [
          {
            kind: "importing" as const,
            count: stores.reduce((total, store) => total + store.importedOrders, 0),
          },
        ]
      : []),
  ];
}
