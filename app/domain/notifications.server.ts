import { appCopy } from "../app-copy";
import { legalVersions } from "./registration.server";
import type { Language } from "../i18n";
import { type NotificationView } from "../view-models";
import { formatDate } from "../format";
import { whatsNewNotifications } from "../whats-new.server";
import { finishedExportJobs } from "./export-jobs.server";
import { notificationWindowMilliseconds } from "./notification-reads.server";
import { activeServiceNotices } from "./service-notices.server";
import { ebayOutages, readsFailing, type StoreStatus } from "./stores.server";

/**
 * Notifiche della campanella, derivate dallo stato corrente: un problema risolto esce dalla
 * campanella. Oggi le fonti sono i collegamenti dei negozi scaduti o in scadenza, le letture
 * che non riescono, di un negozio oppure di tutti quando eBay non risponde, e la pausa per
 * inattività del Free, le esportazioni preparate dalla coda, pronte finché il file resta
 * scaricabile o non riuscite, e le comunicazioni di servizio della console; ogni notifica ha un
 * identificativo stabile per problema, così la lettura vale finché il problema resta lo stesso.
 * Si aggiunge una voce per ogni rilascio con Novità, identificata dalla sua versione, e
 * l'invito ad accettare la versione corrente dei Termini finché manca.
 */
export async function listNotifications(
  db: D1Database,
  userId: string,
  stores: StoreStatus[],
  language: Language,
  timeZone: string,
  now = new Date(),
  termsUpdate = false,
): Promise<NotificationView[]> {
  const t = appCopy[language].shell.storeNotifications;
  const since = now.getTime() - notificationWindowMilliseconds;
  const reminder = (store: StoreStatus): NotificationView[] => {
    if (!store.reminder) return [];
    const expired = store.reminder.kind === "expired";
    // Un consenso in scadenza si segnala da trenta giorni prima: è l'inizio dell'avviso.
    const at = expired
      ? store.reminder.at
      : new Date(Date.parse(store.reminder.at) - notificationWindowMilliseconds).toISOString();
    if (Date.parse(at) < since || Date.parse(at) > now.getTime()) return [];
    return [
      {
        id: `store-${store.reminder.kind}:${store.id}:${store.reminder.at}`,
        tone: "warning",
        title: expired ? t.expiredTitle : t.expiringTitle,
        body: expired
          ? t.expiredBody(store.name)
          : t.expiringBody(store.name, formatDate(store.reminder.at, language, "date", timeZone)),
        at,
        read: false,
        href: `negozi/${encodeURIComponent(store.id)}`,
      },
    ];
  };
  // Le letture ferme in tutti i negozi attivi di un ambiente sono un solo problema di eBay, non
  // uno per negozio. Ogni problema resta lo stesso fino alla prossima lettura riuscita e parte
  // dalla prima delle due letture fallite che lo segnalano.
  const outages = ebayOutages(stores);
  const failing = stores.filter(readsFailing);
  const reads: NotificationView[] = [
    ...[...outages].map(([environment, outage]): NotificationView => ({
      id: `ebay-down:${environment === "sandbox" ? "sandbox:" : ""}${outage.lastSyncAt ?? "never"}`,
      tone: "warning",
      title: t.ebayDownTitle,
      body: t.ebayDownBody,
      at: failing
        .filter((store) => store.ebayEnvironment === environment)
        .map((store) => store.recent[1]!.at)
        .sort()[0]!,
      read: false,
    })),
    ...failing
      .filter((store) => !outages.has(store.ebayEnvironment))
      .map((store): NotificationView => ({
        id: `store-read-failed:${store.id}:${store.lastSyncAt ?? "never"}`,
        tone: "warning",
        title: t.readFailedTitle,
        body: t.readFailedBody(store.name),
        at: store.recent[1]!.at,
        read: false,
        href: `negozi/${encodeURIComponent(store.id)}`,
      })),
  ];
  // La pausa per inattività del Free ferma tutti i negozi dello spazio: una sola notifica.
  const inactiveSince = stores
    .flatMap((store) => (store.inactiveSince ? [store.inactiveSince] : []))
    .sort()[0];
  const inactivity: NotificationView[] = inactiveSince
    ? [
        {
          id: `inactivity:${inactiveSince}`,
          tone: "warning",
          title: t.inactivityTitle,
          body: t.inactivityBody,
          at: inactiveSince,
          read: false,
          href: "negozi",
        },
      ]
    : [];
  // Come i promemoria, un problema delle letture compare soltanto negli ultimi trenta giorni:
  // oltre, la sua lettura non è più conservata e resta l'avviso di Ordini e Negozi.
  const exports = (await finishedExportJobs(db, userId, now)).map((job): NotificationView => ({
    id: `export:${job.id}`,
    tone: job.ready ? "success" : "warning",
    title: job.ready ? t.exportReadyTitle : t.exportFailedTitle,
    body: (job.ready ? t.exportReadyBody : t.exportFailedBody)(job.name),
    at: job.at,
    read: false,
    href: "impostazioni/esportazione",
  }));
  const items = [
    ...stores.flatMap(reminder),
    ...exports,
    ...[...reads, ...inactivity].filter((item) => Date.parse(item.at) >= since),
    ...(await activeServiceNotices(db, language, now)),
    ...whatsNewNotifications(language, now),
    ...(termsUpdate
      ? [
          {
            id: `terms:${legalVersions.terms}`,
            tone: "info",
            title: t.termsUpdateTitle,
            body: t.termsUpdateBody,
            at: `${legalVersions.terms}T00:00:00.000Z`,
            read: false,
            href: "impostazioni/privacy",
          } satisfies NotificationView,
        ]
      : []),
  ];
  if (items.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT notification_id FROM notification_reads WHERE user_id = ?
       AND notification_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(userId, JSON.stringify(items.map((item) => item.id)))
    .all<{ notification_id: string }>();
  const read = new Set(results.map((row) => row.notification_id));
  return items
    .map((item) => ({ ...item, read: read.has(item.id) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
