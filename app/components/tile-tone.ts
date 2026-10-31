/**
 * Tinte di tessere, avatar ed etichette colorate: i colori di stato e il verde
 * del marchio. Il neutro serve alle aree di servizio, come le Impostazioni.
 */
export type TileTone = "blue" | "green" | "amber" | "violet" | "teal" | "rose" | "neutral";

export const tileTones: Record<TileTone, string> = {
  blue: "bg-info-surface text-info dark:bg-info/15",
  green: "bg-success-surface text-success dark:bg-success/15",
  amber: "bg-warning-surface text-warning dark:bg-warning/15",
  violet: "bg-premium-surface text-premium dark:bg-premium/15",
  teal: "bg-brand-green/15 text-brand-green dark:bg-brand-green/20",
  rose: "bg-danger-surface text-danger dark:bg-danger/15",
  neutral: "bg-muted text-muted-foreground",
};

// Senza il verde acqua, poco leggibile sul tema scuro, e senza il rosso, che sembrerebbe un errore.
const keyTones: TileTone[] = ["blue", "violet", "amber", "green"];

/** Tinta stabile per un nome, così negozi e persone restano riconoscibili fra le pagine. */
export function toneFor(key: string): TileTone {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return keyTones[hash % keyTones.length]!;
}

/** Colore pieno della stessa tinta, per punti e segni piccoli accanto al testo. */
export const dotTones: Record<TileTone, string> = {
  blue: "bg-info",
  green: "bg-success",
  amber: "bg-warning",
  violet: "bg-premium",
  teal: "bg-brand-green",
  rose: "bg-danger",
  neutral: "bg-neutral",
};
