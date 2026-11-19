import { appCopy } from "./app-copy";
import { appBase } from "./app-links";
import { sitePages } from "./copy/site-pages.server";
import { localizedPath, type Language } from "./i18n";
import { shots, shotSource } from "./site-shots";
import { barColors } from "./theme-colors";

/** Icone pubbliche del manifest, con la loro misura reale in pixel. */
export const manifestIcons = [
  { src: "/icon-192.png", size: 192, purpose: "any" },
  { src: "/icon-512.png", size: 512, purpose: "any" },
  { src: "/icon-maskable-192.png", size: 192, purpose: "maskable" },
  { src: "/icon-maskable-512.png", size: 512, purpose: "maskable" },
] as const;

/**
 * Manifest dell'app installabile. L'identità (`id`) è la stessa nelle due lingue, così il browser
 * vede un'unica app che cambia lingua con le pagine. L'avvio apre la home: con la sessione porta
 * agli Ordini, senza mostra a chi arriva dallo Store che cosa fa FiscalBay. Un collegamento aperto
 * con l'app già avviata riusa la sua finestra. Le scorciatoie sono le tre destinazioni principali.
 * Un cambio di questi campi richiede un nuovo pacchetto del Microsoft Store.
 */
export function webManifest(language: Language) {
  const t = appCopy[language].shell;
  const page = sitePages[language];
  const area = (section: string) => localizedPath(language, `${appBase}/${section}`);
  const screenshot = (name: "ordini" | "ordini-mobile", formFactor: "wide" | "narrow") => ({
    src: shotSource(name, language, "light"),
    sizes: `${shots[name][language].width}x${shots[name][language].height}`,
    type: "image/webp",
    form_factor: formFactor,
    label: page.shots.ordini,
  });
  return {
    id: "/",
    name: "FiscalBay",
    short_name: "FiscalBay",
    description: page.home.title,
    lang: language,
    dir: "ltr",
    start_url: localizedPath(language),
    scope: "/",
    display: "standalone",
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    theme_color: barColors.light,
    background_color: barColors.light,
    categories: ["business", "finance", "productivity"],
    icons: manifestIcons.map(({ src, size, purpose }) => ({
      src,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose,
    })),
    shortcuts: [
      { name: t.orders, url: area("ordini") },
      { name: t.stores, url: area("negozi") },
      { name: t.settings, url: area("impostazioni") },
    ].map((shortcut) => ({
      ...shortcut,
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    })),
    screenshots: [screenshot("ordini", "wide"), screenshot("ordini-mobile", "narrow")],
  };
}
