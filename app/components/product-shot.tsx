import { cn } from "cn";
import { Fragment } from "react";

import shots from "../site-shots.json";
import type { Language } from "../i18n";

type AnyShot = keyof typeof shots;
export type ShotName = Exclude<AnyShot, `${string}-mobile`>;

const source = (
  name: AnyShot,
  language: Language,
  scheme: "light" | "dark",
  format: "webp" | "avif" = "webp",
) => `/site/${name}-${language}-${scheme}.${format}`;

/** Larghezze ridotte della schermata del primo schermo, oltre all'originale. */
const priorityWidths = [640, 960] as const;

/**
 * Larghezza mostrata della schermata del primo schermo: tutta la colonna fino a 1024 px, poi
 * sette dodicesimi della colonna di 72 rem.
 */
const prioritySizes = "(max-width: 1023px) calc(100vw - 2rem), 42rem";

/** Varianti per larghezza della schermata grande, con l'originale alla sua larghezza. */
const sourceSet = (
  name: AnyShot,
  language: Language,
  scheme: "light" | "dark",
  format: "webp" | "avif",
  width: number,
) =>
  [
    ...priorityWidths.map(
      (size) =>
        `${source(name, language, scheme, format).replace(/\.\w+$/u, `-${size}.${format}`)} ${size}w`,
    ),
    `${source(name, language, scheme, format)} ${width}w`,
  ].join(", ");

/**
 * Schermata reale dell'app presa dall'anteprima con i dati di esempio (`scripts/site-screenshots.mjs`),
 * nel tema del sistema. Sotto i 640 px usa la variante per smartphone, se esiste, perché una
 * schermata larga rimpicciolita sarebbe illeggibile; le dimensioni riservano lo spazio.
 * L'immagine del primo schermo arriva per prima, in AVIF con il WebP per i browser che non lo
 * leggono, e alla larghezza adatta allo schermo fra 640, 960 px e l'originale.
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
  /** Immagine nel primo schermo: caricata subito e con priorità alta. */
  priority?: boolean;
  className?: string;
}) {
  const size = shots[name][language];
  const phone = `${name}-mobile` as AnyShot;
  const small = phone in shots ? shots[phone][language] : null;
  const formats = priority ? (["avif", "webp"] as const) : (["webp"] as const);
  return (
    <picture>
      {formats.map((format) => (
        <Fragment key={format}>
          {small ? (
            <>
              <source
                media="(max-width: 639px) and (prefers-color-scheme: dark)"
                srcSet={source(phone, language, "dark", format)}
                type={`image/${format}`}
                width={small.width}
                height={small.height}
              />
              <source
                media="(max-width: 639px)"
                srcSet={source(phone, language, "light", format)}
                type={`image/${format}`}
                width={small.width}
                height={small.height}
              />
            </>
          ) : null}
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={
              priority
                ? sourceSet(name, language, "dark", format, size.width)
                : source(name, language, "dark", format)
            }
            sizes={priority ? prioritySizes : undefined}
            type={`image/${format}`}
          />
          {priority ? (
            <source
              srcSet={sourceSet(name, language, "light", format, size.width)}
              sizes={prioritySizes}
              type={`image/${format}`}
            />
          ) : null}
        </Fragment>
      ))}
      <img
        src={source(name, language, "light")}
        alt={alt}
        width={size.width}
        height={size.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? undefined : "async"}
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
