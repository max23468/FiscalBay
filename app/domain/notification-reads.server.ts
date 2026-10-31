import { dayMilliseconds } from "../time";
import { maxReadNotifications } from "../view-models";

/**
 * Letture della campanella, separate dai testi delle notifiche: la manutenzione periodica le
 * pulisce senza caricare l'interfaccia.
 */

/** La campanella mostra soltanto gli ultimi 30 giorni. */
export const notificationWindowMilliseconds = 30 * dayMilliseconds;

/** Segna come lette le notifiche indicate; un identificativo già letto resta com'era. */
export async function markNotificationsRead(
  db: D1Database,
  userId: string,
  ids: string[],
  now = new Date(),
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  await db.batch(
    unique.map((id) =>
      db
        .prepare(
          `INSERT INTO notification_reads (user_id, notification_id, read_at) VALUES (?, ?, ?)
           ON CONFLICT (user_id, notification_id) DO NOTHING`,
        )
        .bind(userId, id, now.toISOString()),
    ),
  );
}

/** Identificativi inviati dal browser, nel formato delle notifiche e entro il limite. */
export function parseNotificationIds(value: string): string[] | null {
  const ids = value.split(",").filter(Boolean);
  return ids.length > 0 &&
    ids.length <= maxReadNotifications &&
    ids.every((id) => id.length <= 200 && /^[a-z-]+:/u.test(id))
    ? ids
    : null;
}
