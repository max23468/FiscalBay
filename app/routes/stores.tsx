import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { AccessNotice } from "~/components/access-notice";
import { NotFoundState } from "~/components/not-found";
import { StoresPage } from "~/components/stores/page";
import { accessNotice } from "../access-notice";
import { unconfirmedOnFailure } from "../client-action";
import { areaPage, assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { storeLinkPath, storesPath } from "../app-links";
import { actionFailure, limitedAction, suspendedEbayRead } from "../area-actions.server";
import {
  deleteStoreData,
  disconnectStore,
  ebayOutages,
  listStores,
  pauseStore,
  resumeStore,
  type StoreActionResult,
  type StoreStatus,
} from "../domain/stores.server";
import { subscriptionRenews } from "../domain/billing.server";
import { storeNotifications } from "../domain/telegram.server";
import { telegramConfigured } from "../integrations/telegram.server";
import { requestStoreSync, type SyncRequestResult } from "../domain/order-sync.server";
import { releaseOrderEvents } from "../domain/order-events.server";
import { languageFromPath, localizedPath } from "../i18n";
import type { ActionResult, EbayEnvironment, StoreView } from "../view-models";
import { serviceSetting } from "../domain/service-settings.server";
import { logFailure } from "../errors";
import { describeRequest, measure } from "../observability.server";
import { issueTimingTicket } from "../page-timing.server";
import { settle } from "../settle.server";
import type { Route } from "./+types/stores";
import { pageHeaders } from "../request-limits.server";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.stores.title) }, { name: "robots", content: "noindex" }];
}

export const headers = pageHeaders;

/**
 * Vista del negozio con i soli dati che FiscalBay possiede: lo storico compare dal primo avvio
 * dell'importazione e resta «in corso» finché non è completo e la sincronizzazione risulta in
 * corso mentre un'acquisizione tiene il negozio.
 * Frequenza e ultimi aggiornamenti vengono dalla lettura periodica. Le notifiche sono null senza
 * Premium o senza il bot dell'ambiente.
 */
function storeView(store: StoreStatus, notifications: Map<string, boolean> | null): StoreView {
  return {
    id: store.id,
    name: store.name,
    username: store.username,
    logoUrl: store.logoUrl,
    storeUrl: store.storeUrl,
    feedback: store.feedback,
    marketplace: store.marketplace,
    sandbox: store.ebayEnvironment === "sandbox" || undefined,
    connection: store.connection,
    pauseReason:
      store.pauseReasons.length === 0
        ? undefined
        : store.pauseReasons.includes("plan")
          ? "plan"
          : store.pauseReasons.includes("admin") || store.pauseReasons.includes("abuse")
            ? "admin"
            : store.pauseReasons.includes("inactivity")
              ? "inactivity"
              : "manual",
    issue: store.connection === "reconnect_required" ? "reconnect" : undefined,
    syncing: store.syncing,
    lastSyncAt: store.lastSyncAt,
    notifications: notifications ? (notifications.get(store.id) ?? false) : null,
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

export function loader(args: Route.LoaderArgs) {
  return areaPage(args.request, () => readStores(args));
}

async function readStores({ request, params }: Route.LoaderArgs) {
  const area = await requireAccountArea(request);
  const { language, session, account } = area;
  const now = new Date();
  const telegram = telegramConfigured(env);
  const [statuses, renews, notifications, ebayCalls] = await measure("d1", "stores", () =>
    Promise.all([
      listStores(env.DB, session.user.id, now),
      subscriptionRenews(env.DB, env, session.user.id),
      telegram ? storeNotifications(env.DB, session.user.id, now) : null,
      serviceSetting(env.DB, "ebay_calls"),
    ]),
  );
  const read = () =>
    measure("d1", "stores", () => listStores(env.DB, session.user.id)).then((stores) =>
      stores.map((store) => storeView(store, notifications)),
    );
  const stores = statuses.map((store) => storeView(store, notifications));
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
      // Il piano della pagina decide soltanto la colonna delle notifiche Telegram: senza il bot
      // dell'ambiente resta quella del Free. Le pause del piano sono nei negozi.
      account: { plan: notifications ? ("premium" as const) : ("free" as const) },
      now: now.toISOString(),
      // Con eBay che non risponde restano sospese soltanto le azioni che lo chiamano, per
      // ambiente: Production e Sandbox rispondono ciascuno per sé.
      // Con le chiamate eBay spente dalla console valgono sospese in ogni ambiente.
      ebayDown: ebayCalls ? [...ebayOutages(statuses).keys()] : ebayEnvironments,
      ebayMaintenance: !ebayCalls,
      connectHref: localizedPath(language, storeLinkPath),
      // Il modulo di assistenza esiste: la scorciatoia verso Supporto ha una meta.
      settings: true,
      notificationSettings: telegram,
      subscriptionRenews: renews,
    },
  };
  const syncing = stores.filter((store) => store.syncing).length;
  describeRequest({ page: "stores", stores: stores.length, syncing });
  return data(
    {
      ...payload,
      timing: await issueTimingTicket(env.BETTER_AUTH_SECRET, "stores", now),
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
  // La sottoscrizione agli ordini eBay si toglie finché il token del negozio esiste.
  "store-disconnect": async (userId, storeId) => {
    await releaseOrderEvents(env, userId, storeId, fetch);
    return disconnectStore(env.DB, userId, storeId);
  },
  "store-delete": (userId, storeId, form) =>
    deleteStoreData(env.DB, userId, storeId, String(form.get("conferma") ?? ""), new Date(), () =>
      releaseOrderEvents(env, userId, storeId, fetch),
    ),
};

const ebayEnvironments: EbayEnvironment[] = ["production", "sandbox"];

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
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  // Il filtro per IP di una lettura a richiesta precede la sessione.
  const limited = Object.hasOwn(syncActions, intent)
    ? await limitedAction(request, "work", intent)
    : null;
  if (limited) return limited;
  const { language, session } = await requireAccountArea(request);
  const t = appCopy[language].stores;
  const storeId = String(form.get("store") ?? "");
  const run = Object.hasOwn(storeActions, intent) ? storeActions[intent] : undefined;
  const sync = Object.hasOwn(syncActions, intent) ? syncActions[intent] : undefined;
  if ((!run && !sync) || !storeId || storeId.length > 64) return actionFailure(400, t.failed);
  if (sync) {
    let requested: SyncRequestResult;
    try {
      // Come Riprova negli Ordini: con eBay che non risponde o le letture sospese una nuova
      // lettura resta sospesa.
      const suspended = await suspendedEbayRead(session.user.id, { storeId });
      if (suspended) return actionFailure(409, t[suspended]);
      requested = await requestStoreSync(env, session.user.id, storeId, sync);
    } catch (error) {
      logFailure({ request, error, operation: "route" });
      return actionFailure(500, t.failed);
    }
    if (requested === "not_found") return actionFailure(404, t.failed);
    if (requested === "invalid") return actionFailure(409, t.failed);
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
    return actionFailure(500, t.failed);
  }
  if (result === "not_found") return actionFailure(404, t.failed);
  if (result === "invalid")
    return actionFailure(409, intent === "store-delete" ? t.deleteMismatch : t.failed);
  if (intent === "store-delete")
    return redirect(`${localizedPath(language, storesPath)}?negozio=eliminato`, 303);
  return { ok: true, notice: t.done[intent] } satisfies ActionResult;
}

export function clientAction(args: Route.ClientActionArgs) {
  return unconfirmedOnFailure(args);
}

export default function Stores({ loaderData }: Route.ComponentProps) {
  const { page, notice } = loaderData;
  return loaderData.notFound ? (
    <NotFoundState kind="store" />
  ) : (
    <StoresPage
      data={page}
      confirmation={loaderData.confirmation}
      timing={loaderData.timing}
      notice={<AccessNotice notice={notice} />}
    />
  );
}
