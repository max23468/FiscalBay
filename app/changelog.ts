/**
 * Novità dell'app (D203), soltanto nell'area autenticata, ricavate alla build dalle parti
 * `### Novità` e `### What's new` di ogni versione di `CHANGELOG.md`: nuove funzioni, cambi
 * visibili e correzioni notate dagli utenti, una voce `- **Titolo.** Testo` per riga sotto i
 * gruppi `####` di `whatsNewKinds`, nello stesso ordine nelle due lingue. Le altre voci della versione restano nel changelog e nella
 * GitHub Release. La promozione su `main` scrive il giorno nell'intestazione
 * (`## [2.0.1] - AAAA-MM-GG`): in Production compaiono soltanto le versioni con il giorno, sul
 * test anche quella in preparazione in cima al changelog. Restano fuori la 2.0.0 e le RC.
 * Senza voci pagina, voce del menu, collegamento di Supporto e campanella non compaiono.
 */
/** Gruppi delle voci, nell'ordine della pagina, con il titolo `####` in ciascuna lingua. */
export const whatsNewKinds = {
  features: { it: "Funzionalità", en: "Features" },
  improvements: { it: "Miglioramenti", en: "Improvements" },
  fixes: { it: "Correzioni", en: "Fixes" },
} as const;

export type WhatsNewKind = keyof typeof whatsNewKinds;

export interface WhatsNewRelease {
  /** Versione che porta le voci, per esempio `2.0.1`. */
  version: string;
  /** Giorno della pubblicazione (AAAA-MM-GG); `null` per la versione in preparazione. */
  date: string | null;
  items: Array<{ kind: WhatsNewKind } & Record<"it" | "en", { title: string; body: string }>>;
}

const headings: Record<"it" | "en", string> = { it: "Novità", en: "What's new" };

/** Versioni con Novità: dopo la 2.0.0 e senza prerelease. */
const userVersion = (version: string) => /^\d+\.\d+\.\d+$/u.test(version) && version !== "2.0.0";

/** Giorno di calendario esistente, senza le correzioni di `Date` (31 aprile → 1° maggio). */
const validDay = (day: string) => {
  const time = Date.parse(`${day}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(day) &&
    !Number.isNaN(time) &&
    new Date(time).toISOString().startsWith(day)
  );
};

/**
 * Voci di una parte `### <titolo>`, ciascuna con il gruppo `####` che la precede: elenco
 * puntato, con le righe che continuano una voce. Un gruppo sconosciuto vale `undefined`.
 */
function part(
  body: string,
  heading: string,
  language: "it" | "en",
): Array<{ kind?: WhatsNewKind | null; text: string }> | undefined {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start === -1) return undefined;
  const items: Array<{ kind?: WhatsNewKind | null; text: string }> = [];
  // `null` prima di ogni gruppo, `undefined` dopo un gruppo sconosciuto.
  let kind: WhatsNewKind | null | undefined = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("### ")) break;
    if (line.startsWith("#### ")) {
      const title = line.slice(5).trim();
      kind = (Object.keys(whatsNewKinds) as WhatsNewKind[]).find(
        (key) => whatsNewKinds[key][language] === title,
      );
    } else if (line.startsWith("- ")) items.push({ kind, text: line.slice(2).trim() });
    else if (line.trim() && items.length) items[items.length - 1].text += ` ${line.trim()}`;
  }
  return items;
}

const entry = (text: string) => {
  const match = /^\*\*(.+?)\*\*\s+(\S.*)$/u.exec(text);
  return match && { title: match[1].replace(/\.$/u, ""), body: match[2] };
};

/**
 * Versioni con Novità, dalla più recente, ed errori di forma: intestazione e giorno validi,
 * versione unica, due parti con le stesse voci negli stessi gruppi, ciascuna con titolo e testo. Una
 * versione senza giorno sotto la prima è già pubblicata e deve averlo.
 */
export function parseChangelog(text: string): { releases: WhatsNewRelease[]; problems: string[] } {
  const releases: WhatsNewRelease[] = [];
  const problems: string[] = [];
  const versions = new Set<string>();
  text
    .split(/^## /mu)
    .slice(1)
    .forEach((section, index) => {
      const [header, ...rest] = section.split("\n");
      const match = /^\[?([^\]\s]+)\]?(?: - (\S+))?$/u.exec(header.trim());
      if (!match) return void problems.push(`intestazione non valida: ${header.trim()}`);
      const [, version, date] = match;
      if (versions.has(version)) problems.push(`${version}: versione ripetuta`);
      versions.add(version);
      if (date !== undefined && !validDay(date)) problems.push(`${version}: giorno non valido`);
      const body = rest.join("\n");
      const it = part(body, headings.it, "it");
      const en = part(body, headings.en, "en");
      if (!it && !en) return;
      if (!userVersion(version)) return void problems.push(`${version}: Novità fuori dalla 2.x`);
      if (date === undefined && index > 0) problems.push(`${version}: giorno mancante`);
      if (!it || !en || it.length !== en.length || it.length === 0)
        return void problems.push(`${version}: voci IT/EN non corrispondenti`);
      if (it.some(({ kind }, item) => !kind || kind !== en[item].kind))
        return void problems.push(`${version}: voce fuori dai gruppi o in gruppi diversi`);
      const items = it.map(({ kind, text }, item) => ({
        kind,
        it: entry(text),
        en: entry(en[item].text),
      }));
      if (items.some((item) => !item.it || !item.en))
        return void problems.push(`${version}: voce senza titolo o testo`);
      releases.push({
        version,
        date: date ?? null,
        items: items as WhatsNewRelease["items"],
      });
    });
  return { releases, problems };
}
