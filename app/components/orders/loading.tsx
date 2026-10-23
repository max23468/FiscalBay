import { ClipboardList } from "lucide-react";

import { PageTitle } from "~/components/icon-tile";
import { Skeleton } from "~/components/ui/skeleton";
import type { AppCopy } from "../../app-copy";

/** Schede segnaposto con il layout dell'elenco: filtri e due colonne di ordini. */
export function LoadingGrid({ t }: { t: AppCopy }) {
  return (
    <div
      aria-busy="true"
      className="grid gap-6 [&_[data-slot=skeleton]]:bg-border dark:[&_[data-slot=skeleton]]:bg-muted"
    >
      <span className="sr-only" role="status">
        {t.orders.loading}
      </span>
      {/* Stessa riga dei filtri dell'elenco, così i dati non spostano la pagina. */}
      <div
        aria-hidden="true"
        className="hidden gap-3 md:grid md:grid-cols-[repeat(4,minmax(0,12rem))_1fr]"
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 self-end justify-self-end" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} aria-hidden="true" className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="grid gap-1.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="size-10 shrink-0" />
              <div className="grid flex-1 content-start gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-56 max-w-full" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-3 w-16 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Intestazione degli Ordini prima dei dati: titolo, conteggio segnaposto e nessuno stato. */
export function LoadingHeader({ t }: { t: AppCopy }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <PageTitle
        icon={ClipboardList}
        tone="blue"
        description={<Skeleton aria-hidden="true" className="h-4 w-36" />}
      >
        {t.orders.title}
      </PageTitle>
    </header>
  );
}

/**
 * Pagina Ordini durante il caricamento da un'altra sezione: intestazione e schede segnaposto,
 * senza dati né stati inventati. Modulo separato, così la shell non carica l'intera pagina.
 */
export function OrdersLoading({ t }: { t: AppCopy }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <LoadingHeader t={t} />
      <LoadingGrid t={t} />
    </div>
  );
}
