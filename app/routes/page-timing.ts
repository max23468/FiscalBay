import { env } from "cloudflare:workers";
import { z } from "zod";

import { maxTimingMs, serverPhases, timedPages } from "../page-timing";
import type { Route } from "./+types/page-timing";

const duration = z.number().int().min(0).max(maxTimingMs);

/** Report del browser: soli campi in elenco, durate intere e limitate, nessun testo libero. */
const pageTimingSchema = z.strictObject({
  page: z.enum(timedPages),
  ttfb: duration,
  fcp: duration.optional(),
  lcp: duration.optional(),
  ready: duration,
  server: z.partialRecord(z.enum(serverPhases), duration),
});

/** Un report valido occupa poche centinaia di byte. */
const maxBytes = 1024;

/** Il percorso riceve soltanto report: una lettura non ha contenuto. */
export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

/**
 * Misure del caricamento delle pagine dell'app inviate dal browser: registrate come evento
 * strutturato con i soli campi ammessi. Richieste di altre origini, vuote, troppo grandi o non
 * valide non lasciano traccia.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin)
    return new Response(null, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length > maxBytes) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > maxBytes) return new Response(null, { status: 413 });
  // Un invio senza contenuto (per esempio partito mentre la pagina si chiude) non ha misure.
  if (!text) return new Response(null, { status: 204 });
  let parsed;
  try {
    parsed = pageTimingSchema.safeParse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });
  console.log(JSON.stringify({ event: "page_timing", ...parsed.data }));
  return new Response(null, { status: 204 });
}
