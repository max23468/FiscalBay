import { cn } from "cn";
import { Link } from "react-router";

import { languageNames, languages, type Language } from "../i18n";

/**
 * Scelta della lingua, uguale nell'app e nelle pagine di accesso: ogni lingua
 * con il proprio nome. Fuori dall'app il cambio ricarica la pagina. `compact` mostra il codice
 * della lingua, con il nome come nome accessibile, dove lo spazio è poco: un selettore alto quanto
 * un bottone `sm`, con l'area di tocco estesa come nei bottoni.
 */
export function LanguageSwitch({
  label,
  current,
  hrefFor,
  reloadDocument,
  compact = false,
}: {
  label: string;
  current: Language;
  hrefFor: (language: Language) => string;
  reloadDocument?: boolean;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex text-sm",
        compact ? "h-8 items-stretch gap-0.5 rounded-lg border p-0.5" : "gap-1",
      )}
    >
      {languages.map((code) => (
        <Link
          key={code}
          to={hrefFor(code)}
          reloadDocument={reloadDocument}
          preventScrollReset
          lang={code}
          aria-current={current === code ? "page" : undefined}
          aria-label={compact ? languageNames[code] : undefined}
          className={cn(
            "inline-flex items-center rounded-md text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground",
            compact
              ? "relative px-2.5 pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-1/2"
              : "px-2.5 py-1.5 pointer-coarse:min-h-11",
          )}
        >
          {compact ? code.toUpperCase() : languageNames[code]}
        </Link>
      ))}
    </nav>
  );
}
