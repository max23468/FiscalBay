import { appCopy } from "../app-copy";
import type { Language } from "../i18n";
import { formatDate, type NotificationView } from "../view-models";
import { notificationWindowMilliseconds } from "./notification-reads.server";
import type { StoreStatus } from "./stores.server";

/**
 * Notifiche della campanella, derivate dallo stato corrente: un problema risolto esce dalla
 * campanella. Oggi le fonti sono i collegamenti dei negozi scaduti o in scadenza; ogni notifica
 * ha un identificativo stabile per problema, così la lettura vale finché il problema resta lo
 * stesso.
 */
export async function listNotifications(
  db: D1Database,
  userId: string,
  stores: StoreStatus[],
  language: Language,
  timeZone: string,
  now = new Date(),
): Promise<NotificationView[]> {
  const t = appCopy[language].shell.storeNotifications;
  const since = now.getTime() - notificationWindowMilliseconds;
  const items = stores.flatMap((store): NotificationView[] => {
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
  });
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
