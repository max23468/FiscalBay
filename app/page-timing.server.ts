import { base64Url, derivedKey } from "./sealed.server";
import type { TimedPage } from "./page-timing";

/**
 * Biglietti dei report del browser: la pagina misurata ne riceve uno dal proprio loader, firmato
 * con una chiave derivata dal segreto server e legato alla pagina. Il report vale soltanto con
 * un biglietto valido, entro quindici minuti e una sola volta, così un invio ripetuto o
 * fabbricato senza aprire la pagina non lascia misure.
 */

const ticketLifetime = 15 * 60_000;
/** Scarto ammesso fra gli orologi delle istanze del Worker. */
const clockSkew = 60_000;

const ticketKey = (secret: string) =>
  derivedKey(secret, "fiscalbay/page-timing", { name: "HMAC", hash: "SHA-256" }, [
    "sign",
    "verify",
  ]);

async function signature(secret: string, payload: string) {
  const signed = await crypto.subtle.sign(
    "HMAC",
    await ticketKey(secret),
    new TextEncoder().encode(payload),
  );
  return base64Url(new Uint8Array(signed));
}

/** Firma ricevuta verificata dall'HMAC stesso, in tempo costante; false se non è base64url. */
async function validSignature(secret: string, payload: string, signed: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(signed)) return false;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(signed.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
      char.charCodeAt(0),
    );
  } catch {
    // Una lunghezza impossibile per il base64.
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    await ticketKey(secret),
    bytes,
    new TextEncoder().encode(payload),
  );
}

export async function issueTimingTicket(secret: string, page: TimedPage, now = new Date()) {
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `${page}.${now.getTime()}.${nonce}`;
  return `${payload}.${await signature(secret, payload)}`;
}

/**
 * Accetta il biglietto una volta sola: firma, pagina e validità, poi la ricevuta del nonce.
 * Restituisce false per un biglietto non valido, scaduto o già usato.
 */
export async function redeemTimingTicket(
  db: D1Database,
  secret: string,
  ticket: string,
  page: TimedPage,
  now = new Date(),
) {
  const [ticketPage, issued, nonce, signed] = ticket.split(".");
  const issuedAt = Number(issued);
  if (ticketPage !== page || !nonce || !signed || !Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > now.getTime() + clockSkew || issuedAt + ticketLifetime <= now.getTime())
    return false;
  if (!(await validSignature(secret, `${ticketPage}.${issued}.${nonce}`, signed))) return false;
  const stored = await db
    .prepare("INSERT OR IGNORE INTO page_timing_reports (nonce, expires_at) VALUES (?, ?)")
    .bind(nonce, new Date(issuedAt + ticketLifetime).toISOString())
    .run();
  return stored.meta.changes === 1;
}
