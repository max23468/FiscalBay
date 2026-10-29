import { CloudOff } from "lucide-react";
import { Link, useLocation } from "react-router";

import { EmptyState } from "~/components/empty-state";
import { StandalonePage } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy, useLinks } from "~/components/copy-context";
import { appCopy, pageTitle } from "../app-copy";
import { appHref } from "../app-links";
import { localizedPath, type Language } from "../i18n";

/**
 * Auth o database non rispondono: nessun dato letto e nessuna promessa, soltanto Riprova. La
 * pagina è a sé, senza la shell, perché nome, campanella e preferenze vengono dal database;
 * l'anteprima mostra la stessa pagina sotto la barra degli scenari.
 */
export function UnavailablePage({
  language,
  reference,
}: {
  language: Language;
  /** Correlation ID della richiesta, quando noto. */
  reference?: string;
}) {
  const { pathname, search } = useLocation();
  const t = appCopy[language].errors;
  return (
    <StandalonePage
      icon={CloudOff}
      tone="amber"
      title={t.unavailableTitle}
      homeHref={localizedPath(language)}
    >
      <title>{pageTitle(t.unavailableTitle)}</title>
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.unavailable}</p>
      {reference ? (
        <p className="font-code text-xs text-muted-foreground">{t.reference(reference)}</p>
      ) : null}
      <a href={`${pathname}${search}`} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {t.retry}
      </a>
    </StandalonePage>
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
