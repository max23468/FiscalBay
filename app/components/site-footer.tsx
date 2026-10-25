import { cn } from "cn";

import { appCopy, supportEmail } from "../app-copy";
import { type Language, localizedPath } from "../i18n";

/**
 * Footer unico delle pagine pubbliche: home, accesso, Termini e Privacy (D201). L'area
 * autenticata non ne ha uno. `className` adatta la larghezza alla colonna che lo contiene.
 */
export function SiteFooter({ language, className }: { language: Language; className?: string }) {
  const t = appCopy[language];
  return (
    <footer className="border-t">
      <div
        className={cn(
          "mx-auto flex w-[min(72rem,calc(100%-2rem))] flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="grid gap-1">
          <p>© {new Date().getFullYear()} FiscalBay</p>
          <p>{t.site.independent}</p>
        </div>
        <nav aria-label={t.legal.navigation} className="flex flex-wrap gap-4">
          <a href={localizedPath(language, "/termini")} className="underline underline-offset-4">
            {t.legal.termini}
          </a>
          <a href={localizedPath(language, "/privacy")} className="underline underline-offset-4">
            {t.legal.privacy}
          </a>
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
            {t.site.support}
          </a>
        </nav>
      </div>
    </footer>
  );
}
