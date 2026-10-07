import { sessionPolicy } from "../auth.server";
import { deviceName } from "../device-name";
import type { Language } from "../i18n";

/** Campi della sessione Better Auth usati qui, compresi quelli aggiunti da FiscalBay. */
export interface AuthSession {
  session: { id: string; createdAt: Date | string; passkeyVerified?: boolean };
  user: { id: string; admin?: boolean };
}

/** Durata massima della sessione admin dopo la conferma con passkey. */
export const adminSessionMaxAge = 12 * 3_600_000;

function ageMs(session: AuthSession, now: Date): number {
  return now.getTime() - new Date(session.session.createdAt).getTime();
}

/** Accesso delle ultime 24 ore, come la soglia `freshAge` delle route sensibili di Better Auth. */
export function recentSignIn(session: AuthSession, now = new Date()): boolean {
  return ageMs(session, now) < sessionPolicy.freshAge * 1000;
}

/**
 * Livello di accesso all'area admin. Il secondo fattore è la sessione aperta da una passkey
 * con verifica dell'utente: password, Google, eBay o un link email non bastano, anche se
 * l'utente ha una passkey registrata.
 */
export function adminAccess(
  session: AuthSession | null,
  now = new Date(),
): "none" | "verify" | "granted" {
  if (!session?.user.admin) return "none";
  if (!session.session.passkeyVerified || ageMs(session, now) >= adminSessionMaxAge) {
    return "verify";
  }
  return "granted";
}

/**
 * Motivo per cui la sessione non può aggiungere o rimuovere passkey, oppure null. Un admin
 * deve prima accedere con passkey; gli altri utenti, con un accesso recente qualsiasi.
 */
export function passkeyChangeBlock(
  session: AuthSession,
  now = new Date(),
): "conferma-passkey" | "nuovo-accesso" | null {
  if (session.user.admin && adminAccess(session, now) !== "granted") return "conferma-passkey";
  return recentSignIn(session, now) ? null : "nuovo-accesso";
}

export interface ActiveSession {
  id: string;
  device: string;
  lastActiveAt: string;
  current: boolean;
}

/** Sessioni non scadute: quella in uso, poi le altre per ultima attività. Il token resta al server. */
export async function listActiveSessions(
  db: D1Database,
  userId: string,
  currentId: string,
  language: Language,
  now = new Date(),
): Promise<ActiveSession[]> {
  const { results } = await db
    .prepare(
      `SELECT "id", "userAgent", "updatedAt" FROM "session"
       WHERE "userId" = ?1 AND "expiresAt" > ?2 ORDER BY "id" = ?3 DESC, "updatedAt" DESC`,
    )
    .bind(userId, now.toISOString(), currentId)
    .all<{ id: string; userAgent: string | null; updatedAt: string }>();
  return results.map((row) => ({
    id: row.id,
    device: deviceName(row.userAgent, language),
    lastActiveAt: new Date(row.updatedAt).toISOString(),
    current: row.id === currentId,
  }));
}

/** Chiude una sessione dell'utente; quella di un altro utente resta invariata. */
export async function revokeSession(db: D1Database, userId: string, id: string): Promise<void> {
  await db.prepare('DELETE FROM "session" WHERE "id" = ? AND "userId" = ?').bind(id, userId).run();
}

/** Chiude tutte le sessioni dell'utente tranne quella indicata. */
export async function revokeOtherSessions(
  db: D1Database,
  userId: string,
  currentId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM "session" WHERE "userId" = ? AND "id" <> ?')
    .bind(userId, currentId)
    .run();
}
