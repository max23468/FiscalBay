import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";

/** Tinte delle tessere: i colori di stato e il verde del marchio, mai per il testo. */
export type TileTone = "blue" | "green" | "amber" | "violet" | "teal" | "rose";

const tones: Record<TileTone, string> = {
  blue: "bg-info-surface text-info dark:bg-info/15",
  green: "bg-success-surface text-success dark:bg-success/15",
  amber: "bg-warning-surface text-warning dark:bg-warning/15",
  violet: "bg-premium-surface text-premium dark:bg-premium/15",
  teal: "bg-brand-green/15 text-brand-green dark:bg-brand-green/20",
  rose: "bg-danger-surface text-danger dark:bg-danger/15",
};

const sizes = {
  sm: "size-7 rounded-md [&_svg]:size-4",
  md: "size-9 rounded-lg [&_svg]:size-[1.125rem]",
  lg: "size-11 rounded-xl [&_svg]:size-5",
};

/**
 * Icona su una tessera tinta: dà un colore riconoscibile a sezioni e
 * categorie. È decorativa, il testo accanto porta il significato.
 */
export function IconTile({
  icon: Icon,
  tone,
  size = "md",
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: TileTone;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center", tones[tone], sizes[size], className)}
    >
      <Icon />
    </span>
  );
}

// Senza il verde acqua: sul tema scuro le iniziali in quel colore restano poco leggibili.
const avatarTones: TileTone[] = ["blue", "violet", "amber", "green", "rose"];

/** Tinta stabile per un nome, così negozi e persone restano riconoscibili fra le pagine. */
function toneFor(key: string): TileTone {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return avatarTones[hash % avatarTones.length]!;
}

function initials(name: string, fallback: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (words.length === 0) return fallback.slice(0, 1).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}

/** Iniziali su fondo tinto: avatar dell'account e dei negozi. */
export function InitialsTile({
  name,
  fallback = "",
  size = "md",
  className,
}: {
  name: string;
  fallback?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center font-semibold",
        tones[toneFor(name || fallback)],
        sizes[size],
        size === "sm" ? "text-[0.6875rem]" : size === "md" ? "text-xs" : "text-sm",
        className,
      )}
    >
      {initials(name, fallback)}
    </span>
  );
}

/** Titolo di pagina con la tessera della sezione; il sottotitolo si allinea al testo. */
export function PageTitle({
  icon,
  tone,
  children,
  description,
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: TileTone;
  children: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <IconTile icon={icon} tone={tone} size="lg" />
      <div className="grid min-w-0 gap-0.5">
        <h1 className="text-2xl font-bold sm:text-3xl">{children}</h1>
        {description}
      </div>
    </div>
  );
}
