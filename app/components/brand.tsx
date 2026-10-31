import { cn } from "cn";

/**
 * Le tre righe della tessera del logo (blu, verde, rossa) con le proporzioni
 * 224:156:72. Ferme indicano uno stato, animate una sincronizzazione.
 * Con la riduzione del movimento restano ferme e intere.
 */
const lines = [
  { color: "bg-brand-blue dark:bg-brand-sky", width: "w-full" },
  { color: "bg-brand-green", width: "w-[70%]" },
  { color: "bg-brand-red", width: "w-[32%]" },
];

export function LedgerIndicator({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-active={active || undefined}
      className={cn("inline-grid w-4 shrink-0 content-center gap-[2px]", className)}
    >
      {lines.map((line, index) => (
        <span
          key={line.color}
          className={cn(
            "block h-[3px] origin-left rounded-full",
            line.color,
            line.width,
            active &&
              "animate-[ledger-sync_1.4s_var(--ease-smooth-out)_infinite] motion-reduce:animate-none",
          )}
          style={active ? { animationDelay: `${index * 120}ms` } : undefined}
        />
      ))}
    </span>
  );
}

/**
 * Illustrazione geometrica degli stati vuoti: la tessera inclinata di 8°,
 * con contorno e chip neutri e la sola riga blu come accento.
 */
export function TesseraArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden="true"
      className={cn("h-24 w-32 text-border", className)}
      fill="none"
    >
      <g transform="rotate(-8 80 60)">
        <rect x="26" y="24" width="108" height="76" rx="12" className="fill-card" />
        <rect x="26" y="24" width="108" height="76" rx="12" stroke="currentColor" strokeWidth="3" />
        <rect x="38" y="44" width="16" height="22" rx="3" className="fill-muted-foreground/25" />
        <rect
          x="62"
          y="44"
          width="56"
          height="7"
          rx="3.5"
          className="fill-brand-blue dark:fill-brand-sky"
        />
        <rect x="62" y="56" width="39" height="7" rx="3.5" className="fill-muted-foreground/25" />
        <rect x="62" y="68" width="18" height="7" rx="3.5" className="fill-muted-foreground/25" />
      </g>
    </svg>
  );
}

/** Contorno e fondo della tessera, comuni alle illustrazioni degli stati vuoti. */
function TesseraCard() {
  return (
    <>
      <rect x="26" y="24" width="108" height="76" rx="12" className="fill-card" />
      <rect x="26" y="24" width="108" height="76" rx="12" stroke="currentColor" strokeWidth="3" />
    </>
  );
}

const mutedFill = "fill-muted-foreground/25";

export type EmptyArtKind = "first-use" | "all-clear" | "no-results" | "not-found";

/**
 * Illustrazioni degli stati vuoti, tutte costruite sulla tessera del logo:
 * tessere che trovano ordine al primo utilizzo, tessera frontale con le tre
 * righe del marchio quando tutto è aggiornato, lente per la ricerca senza
 * risultati, punto interrogativo per un indirizzo che non esiste.
 */
export function EmptyArt({ kind, className }: { kind: EmptyArtKind; className?: string }) {
  if (kind === "first-use") {
    return (
      <div aria-hidden="true" className={cn("relative h-32 w-48", className)}>
        <TesseraArt className="absolute top-0 left-0 h-24 w-32 -rotate-6 opacity-45" />
        <TesseraArt className="absolute top-3 left-5 h-24 w-32 opacity-75" />
        <TesseraArt className="absolute top-6 left-12 h-24 w-32 rotate-8" />
      </div>
    );
  }
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden="true"
      className={cn("h-32 w-44 text-border", className)}
      fill="none"
    >
      {kind === "all-clear" ? (
        <>
          <TesseraCard />
          <rect x="40" y="44" width="16" height="22" rx="3" className={mutedFill} />
          <rect
            x="64"
            y="44"
            width="56"
            height="7"
            rx="3.5"
            className="fill-brand-blue dark:fill-brand-sky"
          />
          <rect x="64" y="56" width="39" height="7" rx="3.5" className="fill-brand-green" />
          <rect x="64" y="68" width="18" height="7" rx="3.5" className="fill-brand-red" />
          <circle cx="130" cy="94" r="17" strokeWidth="3" className="fill-card stroke-success" />
          <path
            d="m122 94 5.5 5.5 10-11"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-success"
          />
        </>
      ) : kind === "no-results" ? (
        <>
          <g transform="rotate(-6 80 62)">
            <TesseraCard />
            <rect x="38" y="44" width="16" height="22" rx="3" className={mutedFill} />
            <rect x="62" y="44" width="56" height="7" rx="3.5" className={mutedFill} />
            <rect x="62" y="56" width="39" height="7" rx="3.5" className={mutedFill} />
          </g>
          <circle
            cx="112"
            cy="80"
            r="19"
            strokeWidth="5"
            className="fill-card stroke-muted-foreground"
          />
          <path
            d="m126 94 16 16"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-muted-foreground"
          />
        </>
      ) : (
        <>
          <g transform="rotate(6 80 62)" opacity="0.5">
            <TesseraCard />
          </g>
          <g transform="rotate(-8 80 62)">
            <TesseraCard />
            <path
              d="m70 52a10 10 0 1 1 15 8.7c-3.4 2-5 3.8-5 7.3v2"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-muted-foreground/60"
            />
            <circle cx="80" cy="82" r="3.5" className="fill-muted-foreground/60" />
          </g>
        </>
      )}
    </svg>
  );
}
