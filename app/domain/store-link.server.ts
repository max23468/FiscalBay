import { logFailure } from "../errors";
import { applyStoreMark, markAnchorStatement, readStoreMark } from "./store-marks.server";
import type { Language } from "../i18n";
import { linkReadAdmitted, storeLinkAdmitted } from "./admission.server";
import { applyFreePlan } from "./free-store.server";
import { acquireOrders } from "./order-acquisition.server";
import { workerShare } from "./order-acquisition-context.server";
import { serviceSetting } from "./service-settings.server";
import type { EbayEnvironment } from "../view-models";
import { ebayConfiguration, type EbayAccess } from "../integrations/ebay/environment.server";
import {
  openToken,
  refreshStoreToken,
  saveStoreCredentials,
  sealToken,
  type SellerTokens,
} from "../integrations/ebay/seller-credentials.server";
import { registrationComplete, registrationStatus } from "./registration.server";
import {
  exchangeStoreConsent,
  type EbayStoreIdentity,
  type StoreConsent,
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
  env: Env;
  link: Extract<StoreLinkClaim, { kind: "new" }>;
  sessionUserId: string | null;
  search: URLSearchParams;
  fetcher: typeof fetch;
  request?: Request;
  now?: Date;
}): Promise<StoreLinkOutcome> {
  const { env: environment, link, search, fetcher } = input;
  if (link.expired || input.sessionUserId !== link.userId) return "errore";
  if (search.has("error")) return "negato";
  // Chiamate eBay spente dalla console dopo l'avvio: il consenso non si scambia.
  if (!(await serviceSetting(environment.DB, "ebay_calls"))) return "errore";

  const issued = input.now ?? new Date();
  const consent = await exchangeStoreConsent(
    environment,
    link,
    search.get("code")!,
    fetcher,
    issued,
  );
  const { identity } = consent;

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
  return linkConsentedStore({
    env: environment,
    userId: link.userId,
    consent,
    ebayEnvironment: link.ebayEnvironment,
    language,
    fetcher,
    request: input.request,
    issued,
  });
}

/** Accesso con il token appena rinnovato; null se eBay non lo rinnova. */
async function renewedAccess(
  env: Env,
  storeId: string,
  ebayEnvironment: EbayEnvironment,
  fetcher: typeof fetch,
  now: Date,
): Promise<EbayAccess | null> {
  if ((await refreshStoreToken({ env, storeId, fetcher, now })) !== "refreshed") return null;
  const row = await env.DB.prepare(
    "SELECT access_token FROM ebay_store_credentials WHERE store_id = ?",
  )
    .bind(storeId)
    .first<{ access_token: string }>();
  return {
    fetcher,
    configuration: ebayConfiguration(env, ebayEnvironment),
    accessToken: await openToken(env, storeId, "access", row!.access_token),
  };
}

/** Negozio autorizzato dal venditore: entra nello spazio dell'utente e riceve la prima lettura. */
export async function linkConsentedStore(input: {
  env: Env;
  userId: string;
  consent: StoreConsent;
  ebayEnvironment: EbayEnvironment;
  language: Language;
  fetcher: typeof fetch;
  request?: Request;
  issued: Date;
}): Promise<StoreLinkOutcome> {
  const { env: environment, userId, consent, ebayEnvironment, issued, fetcher } = input;
  const now = issued.toISOString();
  const storeId = await linkStore(environment, userId, consent.identity, now, {
    ebayEnvironment,
    language: input.language,
  });
  // Il negozio di un altro spazio non riceve token e l'esito non dice nulla di quello spazio.
  if (!storeId) return "altro-spazio";
  // Nel Free un negozio oltre a quello attivo entra in pausa prima della prima lettura.
  await applyFreePlan(environment.DB, userId, issued);
  await saveStoreCredentials(environment, storeId, consent.tokens, now);

  // Il collegamento è già riuscito: un errore nella prima acquisizione non lo annulla. Qui si
  // leggono soltanto i recenti e la prima pagina dello storico; il resto prosegue in background.
  // Un negozio in pausa non legge eBay neppure al ricollegamento: riprende alla ripresa. In
  // lista d'attesa ricollegare un negozio già letto non ripete la prima lettura.
  if (!(await linkReadAdmitted(environment.DB, storeId, issued))) return "collegato";
  try {
    const access =
      consent.access ??
      (await renewedAccess(environment, storeId, ebayEnvironment, fetcher, issued));
    if (access) {
      await acquireOrders({
        db: environment.DB,
        storeId,
        grantedAt: now,
        access,
        now: issued,
        budget: { calls: 8, pages: 3 },
        workerShare: workerShare(environment),
      });
    }
  } catch (error) {
    logFailure({ request: input.request, error, operation: "store_link" });
  }
  return "collegato";
}

/**
 * Autorizzazione eBay data durante la registrazione: un solo consenso crea l'account e abilita
 * il negozio, che si collega quando email e profilo sono completi. Chi non conferma entro un
 * giorno collega il negozio dalla pagina Negozi, con il consenso normale.
 */
const signupGrantMilliseconds = 24 * 60 * 60 * 1000;

/** Contesto di cifratura: la riga non corrisponde ancora a un negozio. */
const signupGrantOwner = (ebayUserId: string) => `signup:${ebayUserId}`;

/** Conserva il consenso, cifrato; un nuovo consenso dello stesso venditore sostituisce il primo. */
export async function saveSignupGrant(
  env: Env,
  grant: { ebayUserId: string; username: string; language: Language; tokens: SellerTokens },
  now = new Date(),
): Promise<void> {
  const owner = signupGrantOwner(grant.ebayUserId);
  await env.DB.prepare(
    `INSERT INTO ebay_signup_grants
       (ebay_user_id, username, language, access_token, access_expires_at, refresh_token,
        refresh_expires_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ebay_user_id) DO UPDATE SET
       username = excluded.username,
       language = excluded.language,
       access_token = excluded.access_token,
       access_expires_at = excluded.access_expires_at,
       refresh_token = excluded.refresh_token,
       refresh_expires_at = excluded.refresh_expires_at,
       expires_at = excluded.expires_at`,
  )
    .bind(
      grant.ebayUserId,
      grant.username,
      grant.language,
      await sealToken(env, owner, "access", grant.tokens.accessToken),
      grant.tokens.accessExpiresAt,
      await sealToken(env, owner, "refresh", grant.tokens.refreshToken),
      grant.tokens.refreshExpiresAt,
      new Date(now.getTime() + signupGrantMilliseconds).toISOString(),
    )
    .run();
}

type SignupGrantRow = {
  ebay_user_id: string;
  username: string | null;
  language: Language;
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
};

export type SignupGrantOutcome = StoreLinkOutcome | "lista-attesa" | "sospeso";

/**
 * Collega il negozio autorizzato in registrazione, se l'account ha ormai email confermata e
 * profilo completo. La riga si consuma una sola volta; con le chiamate eBay spente resta, così
 * un passaggio successivo la riprende. null quando non c'è nulla da collegare.
 */
export async function activateSignupGrant(input: {
  env: Env;
  userId: string;
  fetcher?: typeof fetch;
  request?: Request;
  now?: Date;
}): Promise<SignupGrantOutcome | null> {
  const { env, userId } = input;
  const fetcher = input.fetcher ?? fetch;
  const issued = input.now ?? new Date();
  const pending = await env.DB.prepare(
    `SELECT g.ebay_user_id, u."emailVerified" AS verified,
            EXISTS (
              SELECT 1 FROM ebay_stores s
              JOIN workspace_members m ON m.workspace_id = s.workspace_id
              WHERE m.user_id = ?1 AND s.ebay_account_id = g.ebay_user_id
                AND s.disconnected_at IS NULL
            ) AS linked
       FROM ebay_signup_grants g
       JOIN "account" a ON a."accountId" = g.ebay_user_id AND a."providerId" = 'ebay'
       JOIN "user" u ON u."id" = a."userId"
      WHERE a."userId" = ?1 AND g.expires_at > ?2`,
  )
    .bind(userId, issued.toISOString())
    .first<{ ebay_user_id: string; verified: number; linked: number }>();
  if (!pending?.verified) return null;
  if (!registrationComplete(await registrationStatus(env.DB, userId))) return null;
  if (!pending.linked && !(await serviceSetting(env.DB, "ebay_calls"))) return "sospeso";

  const grant = await env.DB.prepare(
    "DELETE FROM ebay_signup_grants WHERE ebay_user_id = ? RETURNING *",
  )
    .bind(pending.ebay_user_id)
    .first<SignupGrantRow>();
  if (!grant || pending.linked) return null;
  if (!(await storeLinkAdmitted(env.DB, userId))) return "lista-attesa";

  const owner = signupGrantOwner(grant.ebay_user_id);
  const accessToken = await openToken(env, owner, "access", grant.access_token);
  const tokens: SellerTokens = {
    accessToken,
    accessExpiresAt: grant.access_expires_at,
    refreshToken: await openToken(env, owner, "refresh", grant.refresh_token),
    refreshExpiresAt: grant.refresh_expires_at,
  };
  const configuration = ebayConfiguration(env, "production");
  return linkConsentedStore({
    env,
    userId,
    consent: {
      identity: { userId: grant.ebay_user_id, username: grant.username ?? undefined },
      tokens,
      // Il token di accesso dura due ore e l'attesa fino a un giorno: scaduto, si rinnova.
      access:
        grant.access_expires_at > issued.toISOString()
          ? { fetcher, configuration, accessToken }
          : null,
    },
    ebayEnvironment: "production",
    language: grant.language,
    fetcher,
    request: input.request,
    issued,
  });
}

/**
 * Associa l'account eBay al primo spazio dell'utente con una sola istruzione: l'identificativo
 * stabile è unico, quindi lo stesso negozio non entra in due spazi neppure con richieste
 * concorrenti. Un nuovo username aggiorna il negozio esistente e il ricollegamento lo riattiva,
 * anche dopo uno scollegamento o un'eliminazione dei dati. Il limite di cancellazione resta:
 * si importano soltanto acquisti successivi, senza ripristinare gli eliminati. null se appartiene ad altri.
 */
async function linkStore(
  env: Pick<Env, "DB" | "BETTER_AUTH_SECRET">,
  userId: string,
  identity: EbayStoreIdentity,
  now: string,
  { ebayEnvironment, language }: { ebayEnvironment: EbayEnvironment; language: Language },
): Promise<string | null> {
  const db = env.DB;
  const workspaceId = await workspaceFor(db, userId, now, language);
  const ebayUserId =
    ebayEnvironment === "production"
      ? identity.userId
      : JSON.stringify([ebayEnvironment, identity.userId]);
  // Un negozio lasciato da uno spazio cancellato o trasferito porta con sé prova usata e ciclo
  // Free.
  const mark = await readStoreMark(db, env.BETTER_AUTH_SECRET, ebayUserId, new Date(now));
  const linked = await db.batch<{ id: string }>([
    ...markAnchorStatement(db, workspaceId, ebayUserId, mark),
    db
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
        ebayUserId,
        now,
        identity.username ?? null,
        ebayEnvironment,
        identity.userId,
      ),
  ]);
  const store = linked.at(-1)!.results[0];
  if (!store) return null;
  if (mark) await applyStoreMark(db, workspaceId, mark, new Date(now));
  // Un negozio trasferito arriva da un altro spazio: il primo collegamento fissa qui i cicli.
  await db
    .prepare(
      "UPDATE workspaces SET free_cycle_anchor_at = ? WHERE id = ? AND free_cycle_anchor_at IS NULL",
    )
    .bind(now, workspaceId)
    .run();
  return store.id;
}
