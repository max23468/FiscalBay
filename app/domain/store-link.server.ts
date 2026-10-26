import { logFailure } from "../errors";
import type { Language } from "../i18n";
import { linkReadAdmitted } from "./admission.server";
import { applyFreePlan } from "./free-store.server";
import { acquireOrders } from "./order-acquisition.server";
import type { EbayEnvironment } from "../view-models";
import { saveStoreCredentials } from "../integrations/ebay/seller-credentials.server";
import {
  exchangeStoreConsent,
  type EbayStoreIdentity,
  type StoreLinkClaim,
  type StoreLinkOutcome,
} from "../integrations/ebay/store-link.server";

/**
 * Collegamento di un negozio eBay dopo il consenso: spazio personale al primo negozio, negozio
 * nello spazio dell'utente, piano Free, credenziali e prima lettura. Lo scambio OAuth resta
 * nell'integrazione eBay.
 */

const workspaceNames: Record<Language, string> = { it: "Spazio personale", en: "Personal space" };

async function workspaceFor(
  db: D1Database,
  userId: string,
  now: string,
  language: Language,
): Promise<string> {
  const workspaceId = crypto.randomUUID();
  const results = await db.batch<{ workspace_id: string }>([
    db
      .prepare(`INSERT INTO workspaces (id, name, created_at, active_at)
        SELECT ?1, ?2, ?3, ?3 WHERE NOT EXISTS (
          SELECT 1 FROM workspace_members WHERE user_id = ?4)`)
      .bind(workspaceId, workspaceNames[language], now, userId),
    db
      .prepare(`INSERT INTO workspace_members (workspace_id, user_id, role)
        SELECT ?1, ?2, 'owner' WHERE NOT EXISTS (
          SELECT 1 FROM workspace_members WHERE user_id = ?2)`)
      .bind(workspaceId, userId),
    db.prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ?").bind(userId),
  ]);
  return results[2]!.results[0]!.workspace_id;
}

export async function completeStoreLink(input: {
  environment: Env;
  link: Extract<StoreLinkClaim, { kind: "new" }>;
  sessionUserId: string | null;
  search: URLSearchParams;
  fetcher: typeof fetch;
  request?: Request;
  now?: Date;
}): Promise<StoreLinkOutcome> {
  const { environment, link, search, fetcher } = input;
  if (link.expired || input.sessionUserId !== link.userId) return "errore";
  if (search.has("error")) return "negato";

  const issued = input.now ?? new Date();
  const now = issued.toISOString();
  const { identity, tokens, access } = await exchangeStoreConsent(
    environment,
    link,
    search.get("code")!,
    fetcher,
    issued,
  );

  // Il consenso deve riguardare proprio il negozio scelto, ancora appartenente all'utente.
  if (link.expectedStoreId) {
    const expected = await environment.DB.prepare(
      `SELECT s.ebay_account_id FROM ebay_stores s
       JOIN workspace_members m ON m.workspace_id = s.workspace_id
       WHERE s.id = ? AND m.user_id = ? AND s.ebay_environment = ?`,
    )
      .bind(link.expectedStoreId, link.userId, link.ebayEnvironment)
      .first<{ ebay_account_id: string }>();
    if (!expected) return "errore";
    if (expected.ebay_account_id !== identity.userId) return "negozio-diverso";
  }

  // Lo state porta la lingua in cui il merchant ha avviato il collegamento.
  const language: Language = search.get("state")!.split(/[-_]/u, 1)[0] === "en" ? "en" : "it";
  const storeId = await linkStore(environment.DB, link.userId, identity, now, {
    ebayEnvironment: link.ebayEnvironment,
    language,
  });
  // Il negozio di un altro spazio non riceve token e l'esito non dice nulla di quello spazio.
  if (!storeId) return "altro-spazio";
  // Nel Free un negozio oltre a quello attivo entra in pausa prima della prima lettura.
  await applyFreePlan(environment.DB, link.userId, issued);
  await saveStoreCredentials(environment, storeId, tokens, now);

  // Il collegamento è già riuscito: un errore nella prima acquisizione non lo annulla. Qui si
  // leggono soltanto i recenti e la prima pagina dello storico; il resto prosegue in background.
  // Un negozio in pausa non legge eBay neppure al ricollegamento: riprende alla ripresa. In
  // lista d'attesa ricollegare un negozio già letto non ripete la prima lettura.
  if (!(await linkReadAdmitted(environment.DB, storeId, issued))) return "collegato";
  await acquireOrders({
    db: environment.DB,
    storeId,
    grantedAt: now,
    access,
    now: issued,
    budget: { calls: 8, pages: 3 },
  }).catch((error: unknown) => {
    logFailure({ request: input.request, error, operation: "store_link" });
  });
  return "collegato";
}

/**
 * Associa l'account eBay al primo spazio dell'utente con una sola istruzione: l'identificativo
 * stabile è unico, quindi lo stesso negozio non entra in due spazi neppure con richieste
 * concorrenti. Un nuovo username aggiorna il negozio esistente e il ricollegamento lo riattiva,
 * anche dopo uno scollegamento o un'eliminazione dei dati. Il limite di cancellazione resta:
 * si importano soltanto acquisti successivi, senza ripristinare gli eliminati. null se appartiene ad altri.
 */
async function linkStore(
  db: D1Database,
  userId: string,
  identity: EbayStoreIdentity,
  now: string,
  { ebayEnvironment, language }: { ebayEnvironment: EbayEnvironment; language: Language },
): Promise<string | null> {
  const workspaceId = await workspaceFor(db, userId, now, language);
  const store = await db
    .prepare(
      `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name, ebay_environment, ebay_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ebay_user_id) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, ebay_stores.display_name),
         disconnected_at = NULL,
         data_deleted_at = NULL
       WHERE ebay_stores.workspace_id = excluded.workspace_id
         AND ebay_stores.ebay_environment = excluded.ebay_environment
       RETURNING id`,
    )
    .bind(
      crypto.randomUUID(),
      workspaceId,
      ebayEnvironment === "production"
        ? identity.userId
        : JSON.stringify([ebayEnvironment, identity.userId]),
      now,
      identity.username ?? null,
      ebayEnvironment,
      identity.userId,
    )
    .first<{ id: string }>();
  return store?.id ?? null;
}
