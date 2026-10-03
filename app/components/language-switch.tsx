import { Link } from "react-router";

import { languageNames, languages, type Language } from "../i18n";

/**
 * Scelta della lingua, uguale nell'app e nelle pagine di accesso: ogni lingua
 * con il proprio nome. Fuori dall'app il cambio ricarica la pagina.
 */
export function LanguageSwitch({
  label,
  current,
  hrefFor,
  reloadDocument,
}: {
  label: string;
  current: Language;
  hrefFor: (language: Language) => string;
  reloadDocument?: boolean;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 text-sm">
      {languages.map((code) => (
        <Link
          key={code}
          to={hrefFor(code)}
          reloadDocument={reloadDocument}
          preventScrollReset
          lang={code}
          aria-current={current === code ? "page" : undefined}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground pointer-coarse:min-h-11"
        >
          {languageNames[code]}
        </Link>
      ))}
    </nav>
  );
}
