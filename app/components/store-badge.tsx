import { cn } from "cn";

import { useCopy } from "~/components/copy-context";

import { appCopy } from "../app-copy";
import { microsoftStoreUrl, useMicrosoftStore } from "../installed-app";

/**
 * Badge ufficiale del Microsoft Store, salvato in `public/store/` senza lo script di Microsoft:
 * compare soltanto su Windows, fuori dall'app installata e dopo l'idratazione. `onBrand` usa la
 * variante chiara sul fondo blu della home; altrimenti la variante segue il tema, e l'immagine
 * nascosta non si scarica.
 */
export function StoreBadge({
  onBrand = false,
  className,
}: {
  onBrand?: boolean;
  className?: string;
}) {
  const { language } = useCopy();
  const shown = useMicrosoftStore();
  if (!shown) return null;
  const badge = (variant: "dark" | "light", visibility?: string) => (
    <img
      src={`/store/microsoft-store-${language}-${variant}.svg`}
      alt={appCopy[language].site.microsoftStore}
      width={161}
      height={44}
      loading="lazy"
      className={visibility}
    />
  );
  return (
    <a href={microsoftStoreUrl(language)} className={cn("w-fit rounded-[5px]", className)}>
      {onBrand ? (
        badge("light")
      ) : (
        <>
          {badge("dark", "dark:hidden")}
          {badge("light", "hidden dark:block")}
        </>
      )}
    </a>
  );
}
