import { createAuth, sessionPolicy } from "../auth.server";
import { deviceName } from "../account/device-name";
import type { Language } from "../i18n";
import { queueResponseCookies } from "../response-cookies.server";

/** Campi della sessione Better Auth usati qui, compresi quelli aggiunti da FiscalBay. */
export interface AuthSession {
  session: { id: string; createdAt: Date | string; passkeyVerified?: boolean };
  user: { id: string; admin?: boolean };
}

/**
 * Sessione della richiesta, o null. Quando l'uso la rinnova, il nuovo cookie raggiunge il
 * browser con la risposta: senza, il browser lo scarterebbe alla scadenza del primo accesso.
 */
export async function readSession(env: Env, request: Request) {
  const { headers, response } = await createAuth(env).api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  queueResponseCookies(headers);
  return response;
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
  createdAt?: string;
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
      `SELECT "id", "userAgent", "updatedAt", "createdAt" FROM "session"
       WHERE "userId" = ?1 AND "expiresAt" > ?2 ORDER BY "id" = ?3 DESC, "updatedAt" DESC`,
    )
    .bind(userId, now.toISOString(), currentId)
    .all<{ id: string; userAgent: string | null; updatedAt: string; createdAt: string }>();
  return results.map((row) => ({
    id: row.id,
    device: deviceName(row.userAgent, language),
    lastActiveAt: new Date(row.updatedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    current: row.id === currentId,
  }));
}

/**
 * Chiude una sessione dell'utente; quella di un altro utente resta invariata. False se la
 * sessione non è sua o non esiste più.
 */
export async function revokeSession(db: D1Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM "session" WHERE "id" = ? AND "userId" = ?')
    .bind(id, userId)
    .run();
  return result.meta.changes > 0;
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
