import { z } from "zod";

import type { Language } from "../i18n";
import type { NotificationView } from "../view-models";
import { dayMilliseconds } from "../time";

/**
 * Comunicazioni di servizio o manutenzione scritte dalla console (§15): compaiono nella
 * campanella di tutti gli utenti nella loro lingua, dall'inizio alla fine della validità, e
 * escono quando scadono o vengono ritirate. Una modifica del testo le fa tornare da leggere.
 */

/** Validità massima: la campanella conserva le letture per trenta giorni. */
export const maxNoticeDays = 30;

const text = (max: number) => z.string().trim().min(1).max(max);

export const serviceNoticeSchema = z
  .object({
    tone: z.enum(["info", "warning"]),
    titleIt: text(120),
    bodyIt: text(1000),
    titleEn: text(120),
    bodyEn: text(1000),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .refine(({ startsAt, endsAt }) => {
    const length = Date.parse(endsAt) - Date.parse(startsAt);
    return length > 0 && length <= maxNoticeDays * dayMilliseconds;
  });

export type ServiceNoticeInput = z.infer<typeof serviceNoticeSchema>;

export type ServiceNotice = ServiceNoticeInput & {
  id: string;
  createdBy: string;
  updatedAt: string;
  withdrawnAt: string | null;
};

const iso = (value: string) => new Date(value).toISOString();

/** Comunicazioni non ancora concluse da più di un mese, dalla più recente. */
export async function listServiceNotices(db: D1Database, now = new Date()) {
  const { results } = await db
    .prepare(`SELECT id, tone, title_it AS titleIt, body_it AS bodyIt, title_en AS titleEn,
        body_en AS bodyEn, starts_at AS startsAt, ends_at AS endsAt, created_by AS createdBy,
        updated_at AS updatedAt, withdrawn_at AS withdrawnAt
      FROM service_notices WHERE julianday(ends_at) > julianday(?1) - ${maxNoticeDays}
      ORDER BY starts_at DESC`)
    .bind(now.toISOString())
    .all<ServiceNotice>();
  return results;
}

/** Nuova comunicazione, oppure modifica di una non ritirata e non ancora conclusa. */
export async function saveServiceNotice(
  db: D1Database,
  input: { id?: string; notice: ServiceNoticeInput; actor: string },
  now = new Date(),
): Promise<{ result: "done"; id: string } | { result: "not_found" | "invalid" }> {
  const at = now.toISOString();
  const { notice } = input;
  // Una comunicazione non si pubblica già conclusa.
  if (Date.parse(notice.endsAt) <= now.getTime()) return { result: "invalid" };
  const values = [
    notice.tone,
    notice.titleIt,
    notice.bodyIt,
    notice.titleEn,
    notice.bodyEn,
    iso(notice.startsAt),
    iso(notice.endsAt),
    at,
  ];
  if (!input.id) {
    const id = crypto.randomUUID();
    await db
      .prepare(`INSERT INTO service_notices (tone, title_it, body_it, title_en, body_en,
          starts_at, ends_at, updated_at, id, created_by, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?8)`)
      .bind(...values, id, input.actor)
      .run();
    return { result: "done", id };
  }
  const updated = await db
    .prepare(`UPDATE service_notices SET tone = ?1, title_it = ?2, body_it = ?3, title_en = ?4,
        body_en = ?5, starts_at = ?6, ends_at = ?7, updated_at = ?8
      WHERE id = ?9 AND withdrawn_at IS NULL AND julianday(ends_at) > julianday(?8)`)
    .bind(...values, input.id)
    .run();
  return updated.meta.changes ? { result: "done", id: input.id } : { result: "not_found" };
}

/** Ritira una comunicazione: esce subito dalla campanella. */
export async function withdrawServiceNotice(db: D1Database, id: string, now = new Date()) {
  const result = await db
    .prepare("UPDATE service_notices SET withdrawn_at = ?1 WHERE id = ?2 AND withdrawn_at IS NULL")
    .bind(now.toISOString(), id)
    .run();
  return result.meta.changes ? "done" : "not_found";
}

/** Comunicazioni in vigore per la campanella, nella lingua dell'utente. */
export async function activeServiceNotices(
  db: D1Database,
  language: Language,
  now = new Date(),
): Promise<NotificationView[]> {
  const { results } = await db
    .prepare(`SELECT id, tone, title_${language} AS title, body_${language} AS body,
        starts_at, updated_at FROM service_notices
      WHERE withdrawn_at IS NULL AND julianday(starts_at) <= julianday(?1)
        AND julianday(?1) < julianday(ends_at)`)
    .bind(now.toISOString())
    .all<{
      id: string;
      tone: "info" | "warning";
      title: string;
      body: string;
      starts_at: string;
      updated_at: string;
    }>();
  return results.map((row) => ({
    id: `service:${row.id}:${row.updated_at}`,
    tone: row.tone,
    title: row.title,
    body: row.body,
    at: row.starts_at,
    read: false,
  }));
}
