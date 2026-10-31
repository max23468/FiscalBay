import { env } from "cloudflare:workers";

import changelog from "../CHANGELOG.md?raw";
import { appCopy } from "./app-copy";
import { isProduction } from "./app-links";
import { notificationWindowMilliseconds } from "./domain/notification-reads.server";
import type { Language } from "./i18n";
import type { NotificationView } from "./view-models";

/**
 * Novità dell'app (D203), soltanto nell'area autenticata, ricavate alla build dalle parti
 * `### Novità` e `### What's new` di ogni versione di `CHANGELOG.md`: nuove funzioni, cambi
 * visibili e correzioni notate dagli utenti, una voce `- **Titolo.** Testo` per riga, nello
 * stesso ordine nelle due lingue. Le altre voci della versione restano nel changelog e nella
 * GitHub Release. La promozione su `main` scrive il giorno nell'intestazione
 * (`## [2.0.1] - AAAA-MM-GG`): in Production compaiono soltanto le versioni con il giorno, sul
 * test anche quella in preparazione in cima al changelog. Restano fuori la 2.0.0 e le RC.
 * Senza voci pagina, voce del menu, collegamento di Supporto e campanella non compaiono.
 */
export interface WhatsNewRelease {
  /** Versione che porta le voci, per esempio `2.0.1`. */
  version: string;
  /** Giorno della pubblicazione (AAAA-MM-GG); `null` per la versione in preparazione. */
  date: string | null;
  items: Array<Record<Language, { title: string; body: string }>>;
}

export interface WhatsNewView {
  version: string;
  /** `null` per la versione in preparazione, mostrata soltanto fuori da Production. */
  date: string | null;
  items: Array<{ title: string; body: string }>;
}

/** Ambiente servito: Production e istante del deploy della versione del Worker. */
export interface WhatsNewContext {
  production: boolean;
  deployedAt?: string;
}

const headings: Record<Language, string> = { it: "Novità", en: "What's new" };

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

/** Voci di una parte `### <titolo>`: elenco puntato, con le righe che continuano una voce. */
function part(body: string, heading: string): string[] | undefined {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start === -1) return undefined;
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("### ")) break;
    if (line.startsWith("- ")) items.push(line.slice(2).trim());
    else if (line.trim() && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

const entry = (text: string) => {
  const match = /^\*\*(.+?)\*\*\s+(\S.*)$/u.exec(text);
  return match && { title: match[1].replace(/\.$/u, ""), body: match[2] };
};

/**
 * Versioni con Novità, dalla più recente, ed errori di forma: intestazione e giorno validi,
 * versione unica, due parti con lo stesso numero di voci, ciascuna con titolo e testo. Una
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
      const it = part(body, headings.it);
      const en = part(body, headings.en);
      if (!it && !en) return;
      if (!userVersion(version)) return void problems.push(`${version}: Novità fuori dalla 2.x`);
      if (date === undefined && index > 0) problems.push(`${version}: giorno mancante`);
      if (!it || !en || it.length !== en.length || it.length === 0)
        return void problems.push(`${version}: voci IT/EN non corrispondenti`);
      const items = it.map((text, item) => ({ it: entry(text), en: entry(en[item]) }));
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

/** Novità del changelog versionato, lette alla build. */
export const whatsNew: WhatsNewRelease[] = parseChangelog(changelog).releases;

/** Errori di forma del changelog versionato: il test li richiede vuoti. */
export const whatsNewProblems = (text = changelog) => parseChangelog(text).problems;

function served(): WhatsNewContext {
  const metadata = env.VERSION_METADATA as Partial<WorkerVersionMetadata> | undefined;
  return { production: isProduction(env), deployedAt: metadata?.timestamp };
}

/** Istante da cui una versione pubblicata compare: l'inizio del suo giorno, in UTC. */
const releasedAt = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

/**
 * Voci da mostrare nella lingua dell'utente, dalla versione più recente: quelle già arrivate al
 * loro giorno e, fuori da Production, la versione in preparazione.
 */
export function whatsNewView(
  language: Language,
  now = new Date(),
  context = served(),
  releases: WhatsNewRelease[] = whatsNew,
): WhatsNewView[] {
  return releases
    .filter((release) =>
      release.date === null ? !context.production : releasedAt(release.date) <= now.getTime(),
    )
    .map((release) => ({
      version: release.version,
      date: release.date,
      items: release.items.map((item) => item[language]),
    }));
}

/**
 * Una voce della campanella per versione, negli ultimi trenta giorni, verso la pagina. La
 * versione in preparazione la annuncia dal deploy del Worker che la contiene.
 */
export function whatsNewNotifications(
  language: Language,
  now = new Date(),
  context = served(),
  releases: WhatsNewRelease[] = whatsNew,
): NotificationView[] {
  const since = now.getTime() - notificationWindowMilliseconds;
  return whatsNewView(language, now, context, releases).flatMap((release) => {
    const at = release.date === null ? context.deployedAt : `${release.date}T00:00:00.000Z`;
    if (!at || Date.parse(at) < since) return [];
    return [
      {
        id: `whats-new:${release.version}`,
        tone: "info",
        title: appCopy[language].shell.whatsNewTitle,
        body: release.items.map((item) => item.title).join(" · "),
        at,
        read: false,
        href: "novita",
      },
    ];
  });
}

/** Pagina Novità, voce del menu e collegamento di Supporto: soltanto con voci da mostrare. */
export function hasWhatsNew(
  now = new Date(),
  context = served(),
  releases: WhatsNewRelease[] = whatsNew,
): boolean {
  return whatsNewView("it", now, context, releases).length > 0;
}
