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
export function TesseraArt({
  className,
  variant = "first-use",
}: {
  className?: string;
  variant?: "first-use" | "search" | "connection";
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden="true"
      className={cn("h-24 w-32 text-border", className)}
      fill="none"
    >
      {variant === "first-use" ? (
        <g transform="rotate(-8 80 60)">
          <rect x="26" y="24" width="108" height="76" rx="12" className="fill-card" />
          <rect
            x="26"
            y="24"
            width="108"
            height="76"
            rx="12"
            stroke="currentColor"
            strokeWidth="3"
          />
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
      ) : (
        <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect
            x="26"
            y="24"
            width="108"
            height="76"
            rx="12"
            className="fill-card"
            stroke="currentColor"
          />
          <path d="M40 44h24M40 56h17M40 68h8" className="stroke-muted-foreground/25" />
          <g className="stroke-brand-blue dark:stroke-brand-sky">
            {variant === "search" ? (
              <>
                <circle cx="94" cy="56" r="15" />
                <path d="m105 67 13 13" />
              </>
            ) : (
              <>
                <path d="m86 60-4 4a10 10 0 0 0 14 14l6-6M104 60l4-4a10 10 0 0 0-14-14l-6 6M89 65l12-12" />
                <path d="M78 42v-6M114 78v6" />
              </>
            )}
          </g>
        </g>
      )}
    </svg>
  );
}
