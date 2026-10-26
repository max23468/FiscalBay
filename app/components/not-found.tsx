import { Link, useLocation } from "react-router";

import { EmptyState } from "~/components/empty-state";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy, useLinks } from "~/components/copy-context";
import { appHref } from "../app-links";

/**
 * Auth o database non rispondono: nessun dato letto e nessuna promessa, soltanto Riprova.
 * Nell'area reale la pagina d'errore non ha la shell, perché la sessione non è leggibile;
 * l'anteprima mostra lo stesso stato dentro la shell, per poter cambiare scenario.
 */
export function UnavailableState() {
  const { t } = useCopy();
  const { pathname, search } = useLocation();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <EmptyState
        variant="connection"
        headingLevel={1}
        className="rounded-xl border bg-card px-5"
        title={t.errors.unavailableTitle}
        description={t.errors.unavailable}
        action={
          <a href={`${pathname}${search}`} {...buttonLink({ variant: "outline" })}>
            {t.errors.retry}
          </a>
        }
      />
    </div>
  );
}

/**
 * Indirizzo dell'app che non corrisponde a un ordine, a un negozio o a una
 * pagina: resta dentro la shell, con la strada per tornare all'elenco.
 */
export function NotFoundState({ kind }: { kind: "order" | "store" | "page" }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const copy = t.shell.notFound[kind];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <EmptyState
        variant="not-found"
        headingLevel={1}
        title={copy.title}
        description={copy.body}
        action={
          <Link
            to={appHref(links, kind === "store" ? "negozi" : "ordini")}
            {...buttonLink({ variant: "outline" })}
          >
            {copy.back}
          </Link>
        }
      />
    </div>
  );
}
