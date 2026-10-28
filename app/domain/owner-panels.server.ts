import { formatDate } from "../format";
import { isProduction } from "../app-links";
import {
  ownerCallbackPrefix,
  type BotButton,
  type RichBlock,
  type RichMessage,
} from "../integrations/telegram.server";

/**
 * Forma dei messaggi del Control Center dell'owner: un titolo, tabelle di righe etichetta-valore
 * per sezione, una nota facoltativa e il piè di pagina con ambiente e ora. Lo stesso pannello dà
 * il messaggio a tabelle e il testo semplice copiabile.
 */

export type Row = [label: string, value: string];
export type Section = { title: string; rows: Row[] };
export type Panel = {
  title: string;
  /** Riga sotto il titolo, prima delle tabelle. */
  lead?: string;
  sections: Section[];
  note?: string;
  buttons?: BotButton[][];
};

/** Limite di Telegram per un messaggio di testo, in unità UTF-16. */
const textLimit = 4096;
const truncated = "\n… testo troncato";

/** Righe oltre le quali una tabella si riassume, per restare leggibile su smartphone. */
export const tableRows = 15;

/** Ambiente nel piè di pagina: il bot è diverso, ma i messaggi inoltrati restano riconoscibili. */
export function environmentName(env: Env) {
  return isProduction(env) ? "Production" : "Test";
}

/** Data e ora nel fuso dell'owner. */
export function at(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? formatDate(value, "it") : "n.d.";
}

/** Righe entro il limite, con il conteggio di quelle omesse. */
export function capped(rows: Row[], limit = tableRows): Row[] {
  if (rows.length <= limit) return rows;
  return [...rows.slice(0, limit - 1), ["…", `altre ${rows.length - limit + 1}`]];
}

export function richMessage(env: Env, panel: Panel, now: Date): RichMessage {
  const blocks: RichBlock[] = [
    { type: "heading", text: panel.title, size: 2 },
    ...(panel.lead ? [{ type: "paragraph" as const, text: panel.lead }] : []),
    { type: "divider" },
    ...panel.sections
      .filter((section) => section.rows.length > 0)
      .map((section): RichBlock => ({
        type: "table",
        caption: section.title,
        cells: section.rows.map(([label, value]) => [
          { text: { type: "bold", text: label }, is_header: true },
          { text: value },
        ]),
        is_bordered: true,
        is_striped: true,
        is_compact: true,
      })),
    ...(panel.note ? [{ type: "paragraph" as const, text: panel.note }] : []),
    { type: "footer", text: `${environmentName(env)} · ${at(now.toISOString())}` },
  ];
  return { blocks, buttons: panel.buttons };
}

/** Lo stesso pannello in testo semplice, entro il limite di Telegram. */
export function plainText(env: Env, panel: Panel, now: Date) {
  const lines = [panel.title, ...(panel.lead ? [panel.lead] : [])];
  for (const section of panel.sections.filter((item) => item.rows.length > 0))
    lines.push("", section.title, ...section.rows.map(([label, value]) => `${label}: ${value}`));
  if (panel.note) lines.push("", panel.note);
  lines.push("", `${environmentName(env)} · ${at(now.toISOString())}`);
  const text = lines.join("\n");
  if (text.length <= textLimit) return text;
  let end = textLimit - truncated.length;
  // Il taglio non divide una coppia surrogata, come un'emoji.
  if (/[\uD800-\uDBFF]/u.test(text[end - 1]!)) end -= 1;
  return `${text.slice(0, end)}${truncated}`;
}

/**
 * Dati di un pulsante dell'owner: vista, argomento numerico ed eventuale modo, `c` per la copia
 * e `n` per un nuovo messaggio invece di riscrivere quello del pulsante.
 */
export function ownerCallback(view: string, arg = 0, mode?: "c" | "n") {
  return `${ownerCallbackPrefix}${view}:${arg}${mode ? `:${mode}` : ""}`;
}

/** Durata leggibile fra due istanti: minuti, ore e minuti oppure giorni. */
export function duration(from: string, to: string) {
  const minutes = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) {
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
  }
  return `${Math.round(minutes / 1440)} giorni`;
}
