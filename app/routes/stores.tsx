import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse, redirect } from "react-router";

import { AccessNotice, AccountShell } from "~/components/account";
import { NotFoundState } from "~/components/not-found";
import { StoresPage } from "~/components/stores";
import { accessNotice } from "../access-notice";
import { assertSameOrigin, requireAccountArea, shellData } from "../account-area.server";
import { appCopy } from "../app-copy";
import { appBase, storeLinkPath, type AppLinks } from "../app-links";
import {
  deleteStoreData,
  disconnectStore,
  ebayOutage,
  listStores,
  pauseStore,
  resumeStore,
  type StoreActionResult,
  type StoreStatus,
} from "../domain/stores.server";
import { requestStoreSync, type SyncRequestResult } from "../domain/order-sync.server";
import { languageFromPath, localizedPath } from "../i18n";
import type { ActionResult, StoreView } from "../view-models";
import { logFailure } from "../errors";
import { describeRequest, measure } from "../observability.server";
import { settle } from "../settle.server";
import type { Route } from "./+types/stores";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.stores.title}` }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/**
 * Vista del negozio con i soli dati che FiscalBay possiede: lo storico compare dal primo avvio
 * dell'importazione e resta «in corso» finché non è completo e la sincronizzazione risulta in
 * corso mentre un'acquisizione tiene il negozio.
 * Frequenza e ultimi aggiornamenti vengono dalla lettura periodica; senza Telegram le notifiche
 * seguono il piano.
 */
function storeView(store: StoreStatus): StoreView {
  return {
    id: store.id,
    name: store.name,
    username: store.name,
    marketplace: store.marketplace,
    sandbox: store.ebayEnvironment === "sandbox" || undefined,
    connection: store.connection,
    pauseReason:
      store.pauseReasons.length === 0
        ? undefined
        : store.pauseReasons.includes("plan")
          ? "plan"
          : "manual",
    issue: store.connection === "reconnect_required" ? "reconnect" : undefined,
    syncing: store.syncing,
    lastSyncAt: store.lastSyncAt,
    notifications: null,
    importedOrders: store.importedOrders,
    historyDays: store.history?.days ?? null,
    // Uno storico incompleto resta in corso anche in pausa: riprende con la lettura di eBay.
    importing: store.history?.done === false,
    connectedAt: store.consentGrantedAt,
    consentExpiresAt: store.consentExpiresAt,
    consentExpiring: store.consentExpiring || undefined,
    targetMinutes: store.targetMinutes,
    recent: store.recent,
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const area = await requireAccountArea(request);
  const { language, session, account } = area;
  const now = new Date();
  const statuses = await measure("d1", "stores", () => listStores(env.DB, session.user.id, now));
  const read = () =>
    measure("d1", "stores", () => listStores(env.DB, session.user.id)).then((stores) =>
      stores.map(storeView),
    );
  const stores = statuses.map(storeView);
  const detail = params.negozio
    ? (stores.find((store) => store.id === params.negozio) ?? null)
    : null;
  const payload = {
    // Un negozio inesistente o di un altro spazio risponde allo stesso modo, dentro la shell.
    notFound: Boolean(params.negozio) && !detail,
    language,
    account,
    shell: await shellData(area, statuses, now),
    // Il collegamento eBay partito da Negozi torna qui con il suo esito.
    notice: accessNotice(new URL(request.url).searchParams, language),
    page: {
      stores,
      detail,
      // Finché non esistono gli abbonamenti ogni spazio usa il piano Free.
      account: { plan: "free" as const },
      now: now.toISOString(),
      // Con eBay che non risponde restano sospese soltanto le azioni che lo chiamano.
      ebayDown: ebayOutage(statuses) !== null,
      elsewhere: false,
      connectHref: localizedPath(language, storeLinkPath),
      // Notifiche, piano e supporto non hanno ancora una pagina reale.
      settings: false,
    },
  };
  const syncing = stores.filter((store) => store.syncing).length;
  describeRequest({ page: "stores", stores: stores.length, syncing });
  return data(
    {
      ...payload,
      // Lo stato dei negozi in lettura si conferma nella stessa risposta, entro l'attesa.
      confirmation:
        syncing > 0
          ? settle(read, (current) => !current.some((store) => store.syncing)).catch(() => [])
          : undefined,
    },
    { status: payload.notFound ? 404 : 200 },
  );
}

const storeActions: Record<
  string,
  (userId: string, storeId: string, form: FormData) => Promise<StoreActionResult>
> = {
  "store-pause": (userId, storeId) => pauseStore(env.DB, userId, storeId),
  "store-resume": (userId, storeId) => resumeStore(env.DB, userId, storeId),
  "store-disconnect": (userId, storeId) => disconnectStore(env.DB, userId, storeId),
  "store-delete": (userId, storeId, form) =>
    deleteStoreData(env.DB, userId, storeId, String(form.get("conferma") ?? "")),
};

const syncActions: Record<string, { reimport: boolean }> = {
  "store-sync": { reimport: false },
  "store-reimport": { reimport: true },
};

/**
 * Pausa, ripresa, scollegamento, eliminazione e letture a richiesta, solo sui negozi del
 * proprio spazio. Una lettura richiesta dice se è in coda, già richiesta o in attesa di eBay.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { language, session } = await requireAccountArea(request);
  const t = appCopy[language].stores;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const storeId = String(form.get("store") ?? "");
  const run = Object.hasOwn(storeActions, intent) ? storeActions[intent] : undefined;
  const sync = Object.hasOwn(syncActions, intent) ? syncActions[intent] : undefined;
  if ((!run && !sync) || !storeId || storeId.length > 64) {
    return data<ActionResult>({ ok: false, notice: t.failed }, { status: 400 });
  }
  if (sync) {
    let requested: SyncRequestResult;
    try {
      requested = await requestStoreSync(env, session.user.id, storeId, sync);
    } catch (error) {
      logFailure({ request, error, operation: "route" });
      return data<ActionResult>({ ok: false, notice: t.failed }, { status: 500 });
    }
    if (requested === "not_found")
      return data<ActionResult>({ ok: false, notice: t.failed }, { status: 404 });
    if (requested === "invalid")
      return data<ActionResult>({ ok: false, notice: t.failed }, { status: 409 });
    const notice =
      sync.reimport && (requested === "queued" || requested === "merged")
        ? t.reimportRequested
        : t.requested[requested];
    return { ok: true, notice } satisfies ActionResult;
  }
  let result: StoreActionResult;
  try {
    result = await run!(session.user.id, storeId, form);
  } catch (error) {
    logFailure({ request, error, operation: "route" });
    return data<ActionResult>({ ok: false, notice: t.failed }, { status: 500 });
  }
  if (result === "not_found") {
    return data<ActionResult>({ ok: false, notice: t.failed }, { status: 404 });
  }
  if (result === "invalid") {
    const notice = intent === "store-delete" ? t.deleteMismatch : t.failed;
    return data<ActionResult>({ ok: false, notice }, { status: 409 });
  }
  if (intent === "store-delete") {
    return redirect(localizedPath(language, `${appBase}/negozi?negozio=eliminato`), 303);
  }
  return { ok: true, notice: t.done[intent] } satisfies ActionResult;
}

/** Mantiene la conferma aperta quando il browser non riceve un esito affidabile. */
export async function clientAction({ request, serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response || isRouteErrorResponse(error) || request.signal.aborted)
      throw error;
    const language = languageFromPath(new URL(request.url).pathname);
    return { ok: false, notice: appCopy[language].errors.unconfirmed } satisfies ActionResult;
  }
}

export default function Stores({ loaderData }: Route.ComponentProps) {
  const { language, account, page, notice, shell } = loaderData;
  const links: AppLinks = { language, base: appBase };
  const t = appCopy[language];
  return (
    <AccountShell language={language} account={account} shell={shell} security>
      {loaderData.notFound ? (
        <NotFoundState kind="store" t={t} links={links} />
      ) : (
        <StoresPage
          data={page}
          confirmation={loaderData.confirmation}
          t={t}
          links={links}
          notice={<AccessNotice language={language} notice={notice} />}
        />
      )}
    </AccountShell>
  );
}
