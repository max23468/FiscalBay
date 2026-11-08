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

/**
 * Elimina dalla campanella le notifiche indicate, che contano anche come lette. La riga riparte
 * da adesso: la notifica resta nascosta per i 30 giorni della campanella, mentre lo stesso
 * problema ripresentato più avanti ha un identificativo nuovo e torna visibile.
 */
export async function dismissNotifications(
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
          `INSERT INTO notification_reads (user_id, notification_id, read_at, dismissed_at)
           VALUES (?1, ?2, ?3, ?3)
           ON CONFLICT (user_id, notification_id) DO UPDATE SET read_at = ?3, dismissed_at = ?3`,
        )
        .bind(userId, id, now.toISOString()),
    ),
  );
}

/** Annulla l'eliminazione: le notifiche tornano nella campanella, già lette. */
export async function restoreNotifications(
  db: D1Database,
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .prepare(
      `UPDATE notification_reads SET dismissed_at = NULL
       WHERE user_id = ? AND notification_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(userId, JSON.stringify([...new Set(ids)]))
    .run();
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
