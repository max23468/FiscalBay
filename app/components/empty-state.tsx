import { cn } from "cn";
import { Unplug } from "lucide-react";

import { EmptyArt, type EmptyArtKind } from "~/components/brand";

type Variant = Exclude<EmptyArtKind, "no-results"> | "search" | "connection";

/**
 * Stato vuoto: illustrazione contestuale, titolo, conseguenza e azioni.
 * Le varianti ampie (primo utilizzo, tutto aggiornato, pagina inesistente)
 * occupano il posto dell'elenco; ricerca e collegamento restano compatti
 * accanto al proprio contesto.
 */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  variant = "first-use",
  headingLevel = 2,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** Contenuto aggiuntivo sotto le azioni, per esempio i primi passi. */
  children?: React.ReactNode;
  className?: string;
  variant?: Variant;
  /** 1 quando lo stato vuoto è l'intera pagina, per esempio un indirizzo inesistente. */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  if (variant === "search" || variant === "connection") {
    return (
      <div
        className={cn(
          "grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 border-y py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center",
          className,
        )}
      >
        {variant === "search" ? (
          <EmptyArt kind="no-results" className="h-10 w-12" />
        ) : (
          <Unplug aria-hidden="true" className="mt-0.5 size-5 justify-self-center text-warning" />
        )}
        <div className="grid min-w-0 gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="col-start-2 sm:col-start-3 sm:row-start-1">{action}</div> : null}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[12rem_1fr] md:items-center md:gap-8 md:p-8",
        className,
      )}
    >
      <EmptyArt kind={variant} className="mx-auto" />
      <div className="grid max-w-lg min-w-0 gap-2">
        <Heading className="text-xl leading-snug font-semibold text-balance">{title}</Heading>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
        {action || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
        {children ? <div className="pt-4">{children}</div> : null}
      </div>
    </div>
  );
}
