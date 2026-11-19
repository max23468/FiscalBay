import type { Language } from "./i18n";
import shots from "./site-shots.json";

export { shots };

/** Schermata del prodotto, compresa la variante per smartphone (`-mobile`). */
export type AnyShot = keyof typeof shots;

/**
 * Indirizzo di una schermata in `public/site`: la versione del contenuto nell'indirizzo permette la
 * cache permanente dichiarata in `public/_headers`.
 */
export const shotSource = (
  name: AnyShot,
  language: Language,
  scheme: "light" | "dark",
  format: "webp" | "avif" = "webp",
  width?: number,
) =>
  `/site/${name}-${language}-${scheme}${width ? `-${width}` : ""}.${format}?v=${shots[name][language].version}`;
