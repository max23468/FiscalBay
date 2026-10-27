import { cn } from "cn";

import shots from "../site-shots.json";
import type { Language } from "../i18n";

type AnyShot = keyof typeof shots;
export type ShotName = Exclude<AnyShot, `${string}-mobile`>;

const source = (name: AnyShot, language: Language, scheme: "light" | "dark") =>
  `/site/${name}-${language}-${scheme}.webp`;

/**
 * Schermata reale dell'app presa dall'anteprima con i dati di esempio (`scripts/site-screenshots.mjs`),
 * nel tema del sistema. Sotto i 640 px usa la variante per smartphone, se esiste, perché una
 * schermata larga rimpicciolita sarebbe illeggibile; le dimensioni riservano lo spazio.
 */
export function ProductShot({
  name,
  language,
  alt,
  priority = false,
  className,
}: {
  name: ShotName;
  language: Language;
  alt: string;
  /** Immagine nel primo schermo: caricata subito. */
  priority?: boolean;
  className?: string;
}) {
  const size = shots[name][language];
  const phone = `${name}-mobile` as AnyShot;
  const small = phone in shots ? shots[phone][language] : null;
  return (
    <picture>
      {small ? (
        <>
          <source
            media="(max-width: 639px) and (prefers-color-scheme: dark)"
            srcSet={source(phone, language, "dark")}
            width={small.width}
            height={small.height}
          />
          <source
            media="(max-width: 639px)"
            srcSet={source(phone, language, "light")}
            width={small.width}
            height={small.height}
          />
        </>
      ) : null}
      <source media="(prefers-color-scheme: dark)" srcSet={source(name, language, "dark")} />
      <img
        src={source(name, language, "light")}
        alt={alt}
        width={size.width}
        height={size.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-auto w-full rounded-xl border bg-card shadow-lg shadow-brand-navy/10",
          className,
        )}
      />
    </picture>
  );
}

/**
 * Funzione con la sua schermata: testo e immagine affiancati da 768 px, con l'immagine più
 * larga perché resti leggibile; `reverse` mette l'immagine a sinistra per alternare le righe.
 */
export function ShotRow({
  id,
  title,
  badge,
  body,
  shot,
  language,
  alt,
  reverse = false,
  heading: Heading = "h3",
}: {
  id: string;
  title: string;
  badge?: React.ReactNode;
  body: string;
  shot: ShotName;
  language: Language;
  alt: string;
  reverse?: boolean;
  heading?: "h2" | "h3";
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid items-center gap-6 md:gap-12",
        reverse
          ? "md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
          : "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
      )}
    >
      <div className={cn("grid content-start gap-3", reverse && "md:order-last")}>
        <Heading
          id={id}
          className="flex flex-wrap items-center gap-2 text-xl font-semibold sm:text-2xl"
        >
          {title}
          {badge}
        </Heading>
        <p className="leading-relaxed text-pretty text-muted-foreground">{body}</p>
      </div>
      <ProductShot
        name={shot}
        language={language}
        alt={alt}
        className={cn(shot === "telegram" && "mx-auto max-w-md")}
      />
    </section>
  );
}
