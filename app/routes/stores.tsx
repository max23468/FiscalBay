import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse } from "react-router";

import { AccessNotice, AccountShell } from "~/components/account";
import { NotFoundState } from "~/components/not-found";
import { StoresPage } from "~/components/stores";
import { accessNotice } from "../access-notice";
import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy } from "../app-copy";
import { appBase, storeLinkPath, type AppLinks } from "../app-links";
import {
  deleteStoreData,
  disconnectStore,
  listStores,
  pauseStore,
  resumeStore,
  type StoreActionResult,
  type StoreStatus,
} from "../domain/stores.server";
import { languageFromPath, localizedPath } from "../i18n";
import type { ActionResult, StoreView } from "../view-models";
import { logFailure } from "../errors";
import type { Route } from "./+types/stores";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.stores.title}` }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/**
 * Vista del negozio con i soli dati che FiscalBay possiede: senza sincronizzazione continua
 * mancano frequenza, storico e ultimi aggiornamenti; senza Telegram le notifiche seguono il piano.
 */
function storeView(store: StoreStatus): StoreView {
  return {
    id: store.id,
    name: store.name,
    username: store.name,
    marketplace: null,
    sandbox: store.ebayEnvironment === "sandbox" || undefined,
    connection: store.connection,
    pauseReason:
      store.pauseReasons.length === 0
        ? undefined
        : store.pauseReasons.includes("plan")
          ? "plan"
          : "manual",
    issue: store.connection === "reconnect_required" ? "reconnect" : undefined,
    syncing: false,
    lastSyncAt: store.lastSyncAt,
    notifications: null,
    importedOrders: store.importedOrders,
    historyDays: null,
    importing: false,
    connectedAt: store.consentGrantedAt,
    consentExpiresAt: store.consentExpiresAt,
    consentExpiring: store.consentExpiring || undefined,
    targetMinutes: null,
    dataDeleted: store.dataDeleted || undefined,
    recent: [],
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { language, session, account } = await requireAccountArea(request);
  const stores = (await listStores(env.DB, session.user.id)).map(storeView);
  const detail = params.negozio
    ? (stores.find((store) => store.id === params.negozio) ?? null)
    : null;
  const payload = {
    // Un negozio inesistente o di un altro spazio risponde allo stesso modo, dentro la shell.
    notFound: Boolean(params.negozio) && !detail,
    language,
    account,
    // Il collegamento eBay partito da Negozi torna qui con il suo esito.
    notice: accessNotice(new URL(request.url).searchParams, language),
    page: {
      stores,
      detail,
      // Finché non esistono gli abbonamenti ogni spazio usa il piano Free.
      account: { plan: "free" as const },
      now: new Date().toISOString(),
      ebayDown: false,
      elsewhere: false,
      connectHref: localizedPath(language, storeLinkPath),
      // Notifiche, piano e supporto non hanno ancora una pagina reale.
      settings: false,
    },
  };
  return data(payload, { status: payload.notFound ? 404 : 200 });
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

/** Pausa, ripresa, scollegamento ed eliminazione, solo sui negozi del proprio spazio. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { language, session } = await requireAccountArea(request);
  const t = appCopy[language].stores;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const storeId = String(form.get("store") ?? "");
  const run = Object.hasOwn(storeActions, intent) ? storeActions[intent] : undefined;
  if (!run || !storeId || storeId.length > 64) {
    return data<ActionResult>({ ok: false, notice: t.failed }, { status: 400 });
  }
  let result: StoreActionResult;
  try {
    result = await run(session.user.id, storeId, form);
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
  const { language, account, page, notice } = loaderData;
  const links: AppLinks = { language, base: appBase };
  const t = appCopy[language];
  return (
    <AccountShell language={language} account={account} security>
      {loaderData.notFound ? (
        <NotFoundState kind="store" t={t} links={links} />
      ) : (
        <StoresPage
          data={page}
          t={t}
          links={links}
          notice={<AccessNotice language={language} notice={notice} />}
        />
      )}
    </AccountShell>
  );
}
