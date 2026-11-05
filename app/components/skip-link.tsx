import { useCopy } from "~/components/copy-context";

/** Destinazione del collegamento: il contenuto principale della pagina, dopo la barra. */
export const mainContentId = "contenuto";

/**
 * «Vai al contenuto principale»: primo elemento raggiunto con Tab, nascosto finché non riceve il
 * focus. Chi usa tastiera o lettore di schermo salta logo, menu e lingua e arriva al testo.
 */
export function SkipLink() {
  const { t } = useCopy();
  return (
    <a
      href={`#${mainContentId}`}
      className="sr-only z-50 rounded-lg bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring"
    >
      {t.shell.skipToContent}
    </a>
  );
}
