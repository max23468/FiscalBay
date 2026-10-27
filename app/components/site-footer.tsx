import { cn } from "cn";

import { useCopy } from "~/components/copy-context";
import { appCopy, supportEmail } from "../app-copy";
import { supportPath } from "../app-links";
import { localizedPath } from "../i18n";

/**
 * Footer unico delle pagine pubbliche: home, accesso, Supporto, Termini e Privacy (D202), con
 * l'indirizzo di assistenza. L'area autenticata non ne ha uno. `className` adatta la larghezza
 * alla colonna che lo contiene.
 */
export function SiteFooter({ className }: { className?: string }) {
  const { language } = useCopy();
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
          <p>
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {supportEmail}
            </a>
          </p>
        </div>
        <nav aria-label={t.legal.navigation} className="flex flex-wrap gap-4">
          <a href={localizedPath(language, "/termini")} className="underline underline-offset-4">
            {t.legal.termsLink}
          </a>
          <a href={localizedPath(language, "/privacy")} className="underline underline-offset-4">
            {t.legal.privacyLink}
          </a>
          <a href={localizedPath(language, supportPath)} className="underline underline-offset-4">
            {t.site.support}
          </a>
        </nav>
      </div>
    </footer>
  );
}
