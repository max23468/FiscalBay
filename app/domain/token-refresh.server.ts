import { servedSql } from "./admission.server";
import { unpausedStore } from "./store-state.server";
import { logFailure } from "../errors";
import { inSequence } from "../sequence";
import {
  refreshStoreToken,
  type RefreshOutcome,
} from "../integrations/ebay/seller-credentials.server";

// Il token di accesso vale due ore: il rinnovo parte quando ne restano meno di quaranta minuti,
// così più esecuzioni del cron, una ogni dieci minuti, cadono prima della scadenza.
const refreshMarginMilliseconds = 40 * 60 * 1000;
const refreshBatch = 50;
const refreshLimit = 300;

type ExpiringRow = { store_id: string; access_expires_at: string };

/**
 * Lavoro in background: rinnova in anticipo i token di accesso vicini alla scadenza. I negozi
 * in pausa e quelli di uno spazio in lista d'attesa non leggono eBay e restano esclusi; quelli
 * scollegati non hanno più token. Il rinnovo comprende i token già scaduti: alla ripresa o
 * all'ammissione l'esecuzione seguente li rinnova prima della lettura.
 *
 * Scorre i negozi a blocchi con un cursore, così un errore non fa rileggere lo stesso negozio,
 * fino a `refreshLimit` rinnovi: con un'esecuzione ogni dieci minuti e token di due ore regge
 * oltre mille negozi attivi restando entro le sottorichieste di una esecuzione.
 */
export async function refreshExpiringTokens(
  environment: Env,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<RefreshOutcome[]> {
  const threshold = new Date(now.getTime() + refreshMarginMilliseconds).toISOString();
  const outcomes: RefreshOutcome[] = [];
  // Ultimo negozio letto: scadenza e identificativo, null prima del primo blocco.
  let cursor: [string, string] | [null, null] = [null, null];
  for (let read = 0; read < refreshLimit; read += refreshBatch) {
    const { results }: D1Result<ExpiringRow> = await environment.DB.prepare(
      `SELECT c.store_id, c.access_expires_at FROM ebay_store_credentials c
        JOIN ebay_stores s ON s.id = c.store_id
        WHERE c.rejected_at IS NULL AND c.access_expires_at <= ?1
          AND (?2 IS NULL OR (c.access_expires_at, c.store_id) > (?2, ?3))
          AND ${unpausedStore("c.store_id")} AND ${servedSql("s.workspace_id", "?5")}
        ORDER BY c.access_expires_at, c.store_id LIMIT ?4`,
    )
      .bind(threshold, ...cursor, refreshBatch, now.toISOString())
      .all<ExpiringRow>();
    // In sequenza: un errore di un negozio non ferma gli altri e non sovrappone retry.
    const refreshed = await inSequence(results, ({ store_id: storeId }) =>
      refreshStoreToken({ environment, storeId, fetcher, now }).catch((error: unknown) => {
        logFailure({ error, operation: "token_refresh" });
        return null;
      }),
    );
    outcomes.push(...refreshed.filter((outcome) => outcome !== null));
    if (results.length < refreshBatch) break;
    const last: ExpiringRow = results.at(-1)!;
    cursor = [last.access_expires_at, last.store_id];
  }
  return outcomes;
}
