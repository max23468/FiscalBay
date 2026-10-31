import { env } from "cloudflare:workers";

import changelog from "../CHANGELOG.md?raw";
import { appCopy } from "./app-copy";
import { isProduction } from "./app-links";
import { displayTimeZone } from "./format";
import { notificationWindowMilliseconds } from "./domain/notification-reads.server";
import type { Language } from "./i18n";
import { parseChangelog, type WhatsNewKind, type WhatsNewRelease } from "./changelog";
import type { NotificationView } from "./view-models";

export interface WhatsNewView {
  version: string;
  /** `null` per la versione in preparazione, mostrata soltanto fuori da Production. */
  date: string | null;
  items: Array<{ kind: WhatsNewKind; title: string; body: string }>;
}

/** Ambiente servito: Production e istante del deploy della versione del Worker. */
export interface WhatsNewContext {
  production: boolean;
  deployedAt?: string;
}

/** Novità del changelog versionato, lette alla build. */
export const whatsNew: WhatsNewRelease[] = parseChangelog(changelog).releases;

/** Errori di forma del changelog versionato: il test li richiede vuoti. */
export const whatsNewProblems = (text = changelog) => parseChangelog(text).problems;

function served(): WhatsNewContext {
  const metadata = env.VERSION_METADATA as Partial<WorkerVersionMetadata> | undefined;
  return { production: isProduction(env), deployedAt: metadata?.timestamp };
}

const italianDays = new Intl.DateTimeFormat("en-CA", { timeZone: displayTimeZone });

/** Giorno italiano di un istante: il giorno della versione è quello della pubblicazione in Italia. */
const italianDay = (now: Date) => italianDays.format(now);

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
      release.date === null ? !context.production : release.date <= italianDay(now),
    )
    .map((release) => ({
      version: release.version,
      date: release.date,
      items: release.items.map((item) => ({ kind: item.kind, ...item[language] })),
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
