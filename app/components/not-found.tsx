import { Link } from "react-router";

import { EmptyState } from "~/components/empty-state";
import { buttonVariants } from "~/components/ui/button-variants";
import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";

/**
 * Indirizzo dell'app che non corrisponde a un ordine, a un negozio o a una
 * pagina: resta dentro la shell, con la strada per tornare all'elenco.
 */
export function NotFoundState({
  kind,
  t,
  links,
}: {
  kind: "order" | "store" | "page";
  t: AppCopy;
  links: AppLinks;
}) {
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
            data-slot="button"
            className={buttonVariants({ variant: "outline" })}
          >
            {copy.back}
          </Link>
        }
      />
    </div>
  );
}
