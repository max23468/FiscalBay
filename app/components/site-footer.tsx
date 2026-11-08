import { cn } from "cn";

import { useCopy } from "~/components/copy-context";
import { LanguageSwitch } from "~/components/language-switch";
import { siteColumn } from "~/components/site-column";
import { appCopy, supportEmail } from "../app-copy";
import { privacyPath, supportPath, termsPath } from "../app-links";
import { localizedPath } from "../i18n";

/**
 * Footer unico delle pagine pubbliche, accesso, Termini e Privacy compresi (D202), con
 * l'indirizzo di assistenza. L'area autenticata non ne ha uno. `className` adatta la larghezza
 * alla colonna che lo contiene. Con `path`, la pagina senza prefisso di lingua, sotto i 360 px
 * porta anche la scelta della lingua, che la barra lì non ha.
 */
export function SiteFooter({ className, path }: { className?: string; path?: string }) {
  const { language } = useCopy();
  const t = appCopy[language];
  return (
    <footer className="border-t">
      <div
        className={cn(
          siteColumn,
          "flex flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="grid gap-1">
          <p>© {new Date().getFullYear()} FiscalBay</p>
          <p>{t.site.independent}</p>
          <p>
            <a href={`mailto:${supportEmail}`} className="link-underline">
              {supportEmail}
            </a>
          </p>
        </div>
        <nav aria-label={t.legal.navigation} className="flex flex-wrap gap-4">
          <a href={localizedPath(language, termsPath)} className="link-underline">
            {t.legal.termsLink}
          </a>
          <a href={localizedPath(language, privacyPath)} className="link-underline">
            {t.legal.privacyLink}
          </a>
          <a href={localizedPath(language, supportPath)} className="link-underline">
            {t.site.support}
          </a>
        </nav>
        {path === undefined ? null : (
          <div className="min-[360px]:hidden">
            <LanguageSwitch
              label={t.access.language}
              current={language}
              hrefFor={(code) => localizedPath(code, path)}
              reloadDocument
            />
          </div>
        )}
      </div>
    </footer>
  );
}
