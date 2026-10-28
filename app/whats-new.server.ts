import { appCopy } from "./app-copy";
import { notificationWindowMilliseconds } from "./domain/notification-reads.server";
import type { Language } from "./i18n";
import type { NotificationView } from "./view-models";

/**
 * Novità dell'app (D203), soltanto nell'area autenticata. Entrano nuove funzioni, cambi visibili
 * di comportamento, schermate o flussi e correzioni di difetti notati dagli utenti; restano fuori
 * lavoro interno e cambi di piani, prezzi o limiti. Le voci si scrivono in italiano e in inglese
 * nella PR della modifica e compaiono con il deploy che le contiene: in Production con
 * `Promuovi`. Finché l'elenco non ha rilasci arrivati al loro giorno, pagina, voce del menu,
 * collegamento di Supporto e campanella non compaiono.
 */
export interface WhatsNewRelease {
  /** Versione che porta le voci, per esempio `2.0.1`. */
  version: string;
  /** Giorno del rilascio (AAAA-MM-GG): la campanella lo annuncia per trenta giorni. */
  date: string;
  items: Array<Record<Language, { title: string; body: string }>>;
}

/** Rilasci con novità, dal più recente. La 2.0.0 non ne genera. */
export const whatsNew: WhatsNewRelease[] = [];

export interface WhatsNewView {
  version: string;
  date: string;
  items: Array<{ title: string; body: string }>;
}

/** Istante da cui un rilascio compare: l'inizio del suo giorno, in UTC. */
const releasedAt = (release: Pick<WhatsNewRelease, "date">) =>
  Date.parse(`${release.date}T00:00:00.000Z`);

/**
 * Voci già distribuite nella lingua dell'utente, dal rilascio più recente. Un rilascio con data
 * futura non compare prima del suo giorno, come nella campanella.
 */
export function whatsNewView(
  language: Language,
  now = new Date(),
  releases: WhatsNewRelease[] = whatsNew,
): WhatsNewView[] {
  return releases
    .filter((release) => releasedAt(release) <= now.getTime())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((release) => ({
      version: release.version,
      date: release.date,
      items: release.items.map((item) => item[language]),
    }));
}

/** Una voce della campanella per rilascio, negli ultimi trenta giorni, verso la pagina. */
export function whatsNewNotifications(
  language: Language,
  now = new Date(),
  releases: WhatsNewRelease[] = whatsNew,
): NotificationView[] {
  const since = now.getTime() - notificationWindowMilliseconds;
  return whatsNewView(language, now, releases).flatMap((release) => {
    const at = `${release.date}T00:00:00.000Z`;
    if (releasedAt(release) < since) return [];
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

/** Pagina Novità, voce del menu e collegamento di Supporto: soltanto con rilasci già usciti. */
export function hasWhatsNew(now = new Date(), releases: WhatsNewRelease[] = whatsNew): boolean {
  return releases.some((release) => releasedAt(release) <= now.getTime());
}

/**
 * Errori di forma dell'elenco: versione unica, giorno valido e testi IT/EN non vuoti per ogni
 * voce. Il test dell'elenco versionato li richiede vuoti.
 */
export function whatsNewProblems(releases: WhatsNewRelease[] = whatsNew): string[] {
  const problems: string[] = [];
  const versions = new Set<string>();
  for (const release of releases) {
    if (versions.has(release.version)) problems.push(`${release.version}: versione ripetuta`);
    versions.add(release.version);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(release.date) ||
      Number.isNaN(Date.parse(`${release.date}T00:00:00Z`))
    )
      problems.push(`${release.version}: giorno non valido`);
    if (release.items.length === 0) problems.push(`${release.version}: nessuna voce`);
    for (const item of release.items)
      for (const language of ["it", "en"] as const)
        if (!item[language]?.title.trim() || !item[language]?.body.trim())
          problems.push(`${release.version}: testo ${language} mancante`);
  }
  return problems;
}
