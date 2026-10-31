import { env } from "cloudflare:workers";
import { data, redirect, useNavigate, type ShouldRevalidateFunctionArgs } from "react-router";

import { AccessNotice, VerifyEmail } from "~/components/access-notice";
import { useCopy } from "~/components/copy-context";
import { EbayEnvironmentField } from "~/components/ebay-environment";
import { NotFoundState } from "~/components/not-found";
import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { accessNotice, isStoreNotice } from "../access-notice";
import { deletionAccess } from "../account-page.server";
import { issueTimingTicket } from "../page-timing.server";
import { unconfirmedOnFailure } from "../client-action";
import {
  areaPage,
  assertSameOrigin,
  requestedEbayEnvironment,
  requireAccountArea,
} from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { ordersPath, storeLinkPath } from "../app-links";
import {
  orderAllowance,
  restoreUnlockConfirmation,
  unlockConfirmation,
  UnlockError,
  unlockOrders,
} from "../domain/grants.server";
import { checkoutConfigured } from "../domain/checkout.server";
import { historyWindowDays } from "../domain/history-window.server";
import { requestOrderRead } from "../domain/order-sync.server";
import {
  marketingProposal,
  messageTemplates,
  recordMarketingConsent,
} from "../domain/preferences.server";
import {
  countVisibleOrders,
  listVisibleOrders,
  type OrderCriteria,
  visibleOrderFacets,
} from "../domain/orders.server";
import { listStores } from "../domain/stores.server";
import { languageFromPath, localizedPath } from "../i18n";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import { describeRequest, measure } from "../observability.server";
import {
  listCriteria,
  maxListedOrders,
  ordersPageSize,
  pagesParam,
  rememberedStore,
  revalidateUnlessSnapshot,
  snapshotCursor,
  snapshotParam,
} from "../orders/order-list";
import { ordersNotices } from "../orders/notices.server";
import { serviceSetting } from "../domain/service-settings.server";
import { accountSearchScope, openSearch } from "../orders/order-search.server";
import { settle } from "../settle.server";
import type { ActionResult, EbayEnvironment, OrderView } from "../view-models";
import type { Route } from "./+types/orders";
import { orderView } from "../domain/order-view.server";
import { planView } from "../domain/plan-view.server";
import {
  actionFailure,
  areaAction,
  limitedAction,
  runAreaAction,
  suspendedEbayRead,
  trialAction,
  type AreaAction,
  type AreaActionContext,
} from "../area-actions.server";
import { pageHeaders } from "../request-limits.server";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.orders.title) }, { name: "robots", content: "noindex" }];
}

export const headers = pageHeaders;

/** Una verifica fiscale ancora in corso: lo sblocco resta sospeso finché non è confermata. */
function verifying(order: OrderView) {
  const { fiscal } = order;
  return (
    fiscal.state === "checking" ||
    (fiscal.state === "locked" && fiscal.hold === "checking") ||
    (fiscal.state === "available" && fiscal.notice === "checking")
  );
}

export function loader(args: Route.LoaderArgs) {
  return areaPage(args.request, () => readOrders(args));
}

/**
 * Ordini persistiti e autorizzati dello spazio, senza attendere eBay: sessione, diritti e
 * conservazione sono verificati qui, prima della risposta. Gli ordini ancora in verifica
 * compaiono con l'ultimo stato salvato e lo sblocco sospeso; il loro stato confermato arriva
 * nella stessa risposta, entro l'attesa dello streaming.
 */
async function readOrders({ request, params }: Route.LoaderArgs) {
  const area = await requireAccountArea(request, { unverified: true });
  const { language, session, account, preferences } = area;
  const search = new URL(request.url).searchParams;
  const ebayEnvironment = requestedEbayEnvironment(request);
  const userId = session.user.id;
  const verified = session.user.emailVerified;
  const now = new Date();
  const requested = params.ordine && params.ordine.length <= 64 ? params.ordine : null;
  const [stores, allowance, confirmUnlock, ebayCalls] = await Promise.all([
    verified ? measure("d1", "stores", () => listStores(env.DB, userId)) : [],
    verified ? measure("d1", "allowance", () => orderAllowance(env.DB, userId, now)) : null,
    unlockConfirmation(env.DB, userId),
    serviceSetting(env.DB, "ebay_calls"),
  ]);
  const premium = !!allowance?.premium;
  const environmentStores = stores.filter((store) => store.ebayEnvironment === ebayEnvironment);
  const filterStores = environmentStores
    .filter((store) => !store.pauseReasons.includes("plan"))
    .map((store) => ({ id: store.id, name: store.name }));
  // Un nuovo accesso agli Ordini riapre il negozio scelto l'ultima volta, visibile nei filtri.
  const remembered =
    search.size === 0 && !params.ordine
      ? rememberedStore(
          request.headers.get("cookie"),
          filterStores.map((store) => store.id),
        )
      : null;
  if (remembered)
    throw redirect(
      `${localizedPath(language, ordersPath)}?negozio=${encodeURIComponent(remembered)}`,
    );
  // `negozio` porta anche l'esito del collegamento di un negozio, che non è un filtro.
  const query = new URLSearchParams(search);
  if (isStoreNotice(query.get("negozio"))) query.delete("negozio");
  // La ricerca arriva cifrata e legata alla sessione: fuori da essa si dimentica.
  const searchText = await openSearch(env.BETTER_AUTH_SECRET, accountSearchScope(session), query);
  // L'istantanea dell'elenco aperto: un ordine arrivato dopo non entra fra quelli già letti.
  // Senza istantanea l'elenco si apre adesso e non ha ancora nuovi ordini.
  const { opened, snapshot, filters, criteria } = listCriteria(
    query,
    now,
    premium ? "premium" : "free",
    filterStores.map((store) => store.id),
    searchText,
  );
  // Con «Non pagato» anche dettaglio e conferma leggono gli acquisti non pagati (D180).
  const provisional = criteria.payment === "unpaid";
  // «Carica altri» amplia la pagina letta dal server, entro il massimo di una richiesta.
  const shown = Math.min(
    Math.max(Math.trunc(Number(query.get(pagesParam))) || 1, 1),
    Math.floor(maxListedOrders / ordersPageSize),
  );
  const read = (ids?: string[]) =>
    measure("d1", "orders", () =>
      listVisibleOrders(
        env.DB,
        userId,
        ids ? ids.length : shown * ordersPageSize,
        ebayEnvironment,
        now,
        ids ? { ids, provisional } : { criteria },
      ),
    ).then((orders) => orders.map(orderView));
  const count = (counted: OrderCriteria) =>
    verified
      ? measure("d1", "orders", () =>
          countVisibleOrders(env.DB, userId, ebayEnvironment, now, counted),
        )
      : 0;
  const arrived = { ...filters, listedAfter: snapshot.toISOString() };
  const [orders, total, incoming, facets, detailOrders] = await Promise.all([
    verified ? read() : [],
    count(criteria),
    opened ? count(arrived) : 0,
    verified
      ? measure("d1", "orders", () => visibleOrderFacets(env.DB, userId, ebayEnvironment, now))
      : { total: 0, locked: false },
    verified && requested ? read([requested]) : [],
  ]);
  // Entrano da soli soltanto i nuovi ordini che stanno tutti sopra il primo mostrato: uno
  // recuperato dallo storico si inserirebbe fra quelli già letti e resta all'indicatore.
  const top = orders[0];
  const incomingAtTop =
    incoming > 0 &&
    (!top ||
      (await count({ ...arrived, after: { creationTime: top.createdAt, id: top.id } })) === 0);
  const notice = accessNotice(search, language);
  const detail = detailOrders[0] ?? null;
  // Un ordine inesistente, scaduto o di un altro spazio risponde allo stesso modo.
  if (params.ordine && !detail) {
    return data(
      {
        notFound: true as const,
        language,
        account,
        notice,
        verified,
        ebayEnvironment,
      },
      { status: 404 },
    );
  }
  const linked = environmentStores.filter((store) => store.connection !== "disconnected");
  const path = localizedPath(language, ordersPath);
  const cursor = snapshotCursor(snapshot);
  const next = new URLSearchParams(query);
  next.set(pagesParam, String(shown + 1));
  next.set(snapshotParam, cursor);
  // I nuovi ordini entrano con una nuova istantanea, conservando le pagine già caricate.
  const fresh = new URLSearchParams(query);
  fresh.delete(snapshotParam);
  const more = total > orders.length;
  const page = {
    orders,
    total,
    snapshot: cursor,
    nextHref: more && shown * ordersPageSize < maxListedOrders ? `${path}?${next}` : null,
    limited: more && shown * ordersPageSize >= maxListedOrders,
    incoming,
    freshHref: incoming > 0 ? `${path}${fresh.size ? `?${fresh}` : ""}` : null,
    incomingAtTop,
  };
  const notices = ordersNotices({
    stores: environmentStores,
    ebayEnvironment,
    storeId: filters.storeId,
    allowance,
    locked: facets.locked,
    ebayCalls,
  });
  // Ultima lettura riuscita fra i negozi collegati: un negozio scollegato non conta per i
  // primi passi, e lo stato vuoto nomina il negozio letto per ultimo con il suo orario.
  const latest =
    linked
      .filter((store) => store.lastSyncAt !== null)
      .sort((a, b) => a.lastSyncAt!.localeCompare(b.lastSyncAt!))
      .at(-1) ?? linked[0];
  const lastSync = latest?.lastSyncAt ?? undefined;
  // La proposta del consenso arriva a primi passi conclusi, cioè dopo la prima lettura.
  const marketing = verified && lastSync !== undefined && (await marketingProposal(env.DB, userId));
  const pageData: OrdersPageData = {
    view: facets.total > 0 ? "list" : linked.length > 0 ? "empty" : "no-store",
    ...page,
    search: searchText,
    detail,
    stores: filterStores,
    // La prova si propone dopo la prima lettura riuscita, anche senza ordini.
    account: planView(allowance, "orders"),
    notices,
    sync: {
      running: environmentStores.some((store) => store.syncing),
      lastAt: lastSync ?? null,
      storeId: latest?.id ?? null,
      storeName: latest?.name ?? null,
      // Giorni consultabili del negozio letto per ultimo; prima vale la finestra del piano.
      historyDays: latest?.history?.days ?? historyWindowDays(premium, now),
    },
    onboarding: [
      { label: "stepAccount", done: true },
      { label: "stepEmail", done: verified },
      { label: "stepStore", done: linked.length > 0 },
      { label: "stepSync", done: lastSync !== undefined },
    ],
    messageTemplates: messageTemplates(preferences),
    marketingProposal: marketing,
    now: now.toISOString(),
    confirmUnlock,
    // Con l'acquisto disponibile gli sblocchi esauriti rimandano al piano.
    settings: checkoutConfigured(env),
    exportable: verified,
    openOnEbay: ebayEnvironment === "production",
    connectHref: verified
      ? `${localizedPath(language, storeLinkPath)}?environment=${ebayEnvironment}`
      : null,
  };
  const pending = [...page.orders, ...(detail ? [detail] : [])]
    .filter(verifying)
    .map((order) => order.id);
  describeRequest({ page: "orders", orders: page.orders.length, verifying: pending.length });
  return {
    notFound: false as const,
    language,
    account,
    notice,
    verified,
    // Chi non ha verificato l'email non raggiunge le Impostazioni: la cancellazione è nell'avviso.
    deletion: verified ? null : await deletionAccess(session, now),
    ebayEnvironment,
    sandbox: sandboxAvailable(env),
    page: pageData,
    timing: await issueTimingTicket(env.BETTER_AUTH_SECRET, "orders", now),
    confirmation:
      pending.length > 0
        ? settle(
            () => read([...new Set(pending)]),
            (confirmed) => !confirmed.some(verifying),
          ).catch(() => [])
        : undefined,
  };
}

/**
 * Anche un conflitto di quota rilegge lo stato corrente per aggiornare i controlli; l'istantanea
 * aggiunta all'indirizzo è quella della risposta già mostrata.
 */
export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return args.formMethod ? true : revalidateUnlessSnapshot(args);
}

/** Nuova lettura di un ordine non riuscito, come il pulsante: sospesa se eBay non è raggiungibile. */
async function retryOrderRead({ request, area, form }: AreaActionContext) {
  const t = appCopy[area.language].stores;
  const userId = area.session.user.id;
  const id = String(form.get("order") ?? "");
  if (!id || id.length > 64) return actionFailure(400, t.failed);
  const environment = requestedEbayEnvironment(request);
  const suspended = await suspendedEbayRead(userId, { environment });
  if (suspended) return actionFailure(409, t[suspended]);
  // Il dominio rilegge soltanto un ordine che l'utente consulta, con lettura non riuscita.
  const requested = await requestOrderRead(env, userId, id, environment);
  if (requested === "not_found" || requested === "invalid") return actionFailure(409, t.failed);
  return {
    ok: true,
    notice: requested === "limited" ? t.requested.limited : appCopy[area.language].orders.retried,
  } satisfies ActionResult;
}

/**
 * Ripristino della conferma di sblocco, consenso proposto, prova e nuova lettura, sempre sugli
 * ordini e sullo spazio dell'utente.
 */
const orderActions: Record<string, AreaAction> = {
  "unlock-confirmation": {
    run: async ({ area }) => {
      await restoreUnlockConfirmation(env.DB, area.session.user.id);
      return { ok: true } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  marketing: {
    run: async ({ area, form }) => {
      const t = appCopy[area.language];
      const value = form.get("value");
      if (value !== "true" && value !== "false") return actionFailure(400, t.settings.saveFailed);
      const accepted = value === "true";
      await recordMarketingConsent(
        env.DB,
        area.session.user.id,
        accepted,
        area.language,
        "proposal",
      );
      const { marketingProposal } = t.orders;
      return {
        ok: true,
        notice: accepted ? marketingProposal.accepted : marketingProposal.declined,
      } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  "start-trial": trialAction,
  retry: { run: retryOrderRead, failureNotice: (t) => t.stores.failed, limit: "work" },
};

/** Sblocco e azioni degli Ordini; il filtro per IP di una nuova lettura precede la sessione. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const chosen = areaAction(orderActions, intent);
  const limited = chosen?.limit ? await limitedAction(request, chosen.limit, intent) : null;
  if (limited) return limited;
  const area = await requireAccountArea(request);
  if (chosen) return runAreaAction(chosen, { request, area, form });
  if (intent !== "unlock")
    return data<UnlockResult>({ unlocked: [], remaining: null, error: true }, { status: 400 });
  try {
    return await unlockOrders(
      env.DB,
      area.session.user.id,
      String(form.get("ids") ?? "").split(","),
      form.get("skipConfirmation") === "true",
      requestedEbayEnvironment(request),
    );
  } catch (error) {
    // Le violazioni del dominio non espongono ordine, quota altrui o testo SQL.
    if (!(error instanceof UnlockError)) throw error;
    return data<UnlockResult>({ unlocked: [], remaining: null, error: true }, { status: 409 });
  }
}

/** Lo sblocco non confermato dalla rete non mostra ordini sbloccati; le altre azioni lo dicono. */
export async function clientAction(args: Route.ClientActionArgs) {
  const intent = (await args.request.clone().formData()).get("intent");
  return unconfirmedOnFailure(args, (notice) =>
    intent === "unlock"
      ? ({ unlocked: [], remaining: null, error: true } satisfies UnlockResult)
      : ({ ok: false, notice } satisfies ActionResult),
  );
}

/** Ambiente eBay degli ordini mostrati, sul solo dominio di test: lo stesso campo dei filtri. */
function EnvironmentSelect({ value }: { value: EbayEnvironment }) {
  const navigate = useNavigate();
  const { language } = useCopy();
  return (
    <EbayEnvironmentField
      className="sm:max-w-sm"
      value={value}
      onValueChange={(next) =>
        void navigate(`${localizedPath(language, ordersPath)}?environment=${next}`)
      }
    />
  );
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { language, account, notice } = loaderData;
  const alerts = (
    <>
      <AccessNotice notice={notice} />
      <VerifyEmail
        email={account.email}
        verified={loaderData.verified}
        deletion={"deletion" in loaderData ? loaderData.deletion : null}
      />
    </>
  );
  return loaderData.notFound ? (
    <NotFoundState kind="order" />
  ) : (
    <OrdersPage
      data={loaderData.page}
      unlockAction={`${localizedPath(language, ordersPath)}?environment=${loaderData.ebayEnvironment}`}
      confirmation={loaderData.confirmation}
      timing={loaderData.timing}
      notice={
        <>
          {alerts}
          {loaderData.sandbox ? <EnvironmentSelect value={loaderData.ebayEnvironment} /> : null}
        </>
      }
    />
  );
}
