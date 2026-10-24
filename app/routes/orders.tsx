import { env } from "cloudflare:workers";
import { data, redirect, useNavigate, type ShouldRevalidateFunctionArgs } from "react-router";

import { AccessNotice, VerifyEmail } from "~/components/account";
import { AccountShell } from "~/components/account-shell";
import { EbayEnvironmentField, type EbayEnvironment } from "~/components/ebay-environment";
import { NotFoundState } from "~/components/not-found";
import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { accessNotice } from "../access-notice";
import {
  areaPage,
  assertSameOrigin,
  requestedEbayEnvironment,
  requireAccountArea,
  shellData,
} from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { appBase, ordersPath, storeLinkPath, type AppLinks } from "../app-links";
import {
  accountCoverage,
  orderAllowance,
  restoreUnlockConfirmation,
  startTrial,
  unlockConfirmation,
  UnlockError,
  unlockOrders,
} from "../domain/grants.server";
import { checkoutConfigured } from "../domain/checkout.server";
import { historyDays } from "../domain/order-acquisition.server";
import { requestOrderRead } from "../domain/order-sync.server";
import { messageTemplates } from "../domain/preferences.server";
import {
  countVisibleOrders,
  listVisibleOrders,
  orderCriteria,
  type OrderCriteria,
  orderView,
  visibleOrderFacets,
} from "../domain/orders.server";
import { ebayOutage, listStores, readsFailing } from "../domain/stores.server";
import { logFailure } from "../errors";
import { languageFromPath, localizedPath, type Language } from "../i18n";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import { describeRequest, measure } from "../observability.server";
import {
  maxListedOrders,
  ordersPageSize,
  pagesParam,
  rememberedStore,
  snapshotCursor,
  snapshotInstant,
  snapshotOnlyAdded,
  snapshotParam,
} from "../orders/order-list";
import { accountSearchScope, openSearch } from "../orders/order-search.server";
import { settle } from "../settle.server";
import type { ActionResult, OrderView, OrdersNotice } from "../view-models";
import type { Route } from "./+types/orders";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.orders.title) }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

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
  const [stores, allowance, confirmUnlock] = await Promise.all([
    verified ? measure("d1", "stores", () => listStores(env.DB, userId)) : [],
    verified ? measure("d1", "allowance", () => orderAllowance(env.DB, userId, now)) : null,
    unlockConfirmation(env.DB, userId),
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
  if (Object.hasOwn(appCopy[language].access.storeNotices, query.get("negozio") ?? ""))
    query.delete("negozio");
  // La ricerca arriva cifrata e legata alla sessione: fuori da essa si dimentica.
  const searchText = await openSearch(env.BETTER_AUTH_SECRET, accountSearchScope(session), query);
  // L'istantanea dell'elenco aperto: un ordine arrivato dopo non entra fra quelli già letti.
  // Senza istantanea l'elenco si apre adesso e non ha ancora nuovi ordini.
  const opened = snapshotInstant(query.get(snapshotParam));
  const snapshot = new Date(Math.min(opened?.getTime() ?? now.getTime(), now.getTime()));
  const parsed = orderCriteria(query, now, premium ? "premium" : "free", searchText);
  // Come gli altri filtri, un negozio che non è fra quelli filtrabili vale come «Tutti».
  const filters = filterStores.some((store) => store.id === parsed.storeId)
    ? parsed
    : { ...parsed, storeId: undefined };
  const criteria = { ...filters, listedBefore: snapshot.toISOString() };
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
        shell: await shellData(area, stores, now),
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
  const cycle = allowance?.cycle ?? null;
  const outage = ebayOutage(environmentStores);
  const notices: OrdersNotice[] = [
    ...(outage ? [{ kind: "ebay-down" as const, at: outage.lastSyncAt }] : []),
    // Prima i collegamenti già scaduti, poi quelli in scadenza.
    ...environmentStores
      .flatMap((store) =>
        store.reminder ? [{ id: store.id, name: store.name, ...store.reminder }] : [],
      )
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expired" ? -1 : 1))
      .map((store): OrdersNotice =>
        store.kind === "expired"
          ? { kind: "store-issue", storeId: store.id, storeName: store.name }
          : {
              kind: "consent-expiring",
              storeId: store.id,
              storeName: store.name,
              at: store.at,
              ebayEnvironment,
            },
      ),
    // Senza un'indisponibilità generale, un negozio con le letture ferme lo dice se i suoi
    // ordini sono nella vista; altrimenti restano Negozi e campanella.
    ...(outage
      ? []
      : environmentStores
          .filter(
            (store) =>
              readsFailing(store) &&
              store.lastSyncAt !== null &&
              (!filters.storeId || filters.storeId === store.id),
          )
          .map((store): OrdersNotice => ({
            kind: "store-read-failed",
            storeId: store.id,
            storeName: store.name,
            at: store.lastSyncAt!,
          }))),
    ...(!premium && cycle && allowance?.remaining === 0 && facets.locked
      ? [{ kind: "quota" as const, until: cycle.ends_at }]
      : []),
    ...(environmentStores.some((store) => store.history?.done === false)
      ? [
          {
            kind: "importing" as const,
            count: environmentStores.reduce((total, store) => total + store.importedOrders, 0),
          },
        ]
      : []),
  ];
  // Ultima lettura riuscita fra i negozi collegati: un negozio scollegato non conta per i
  // primi passi, e lo stato vuoto nomina il negozio letto per ultimo con il suo orario.
  const latest =
    linked
      .filter((store) => store.lastSyncAt !== null)
      .sort((a, b) => a.lastSyncAt!.localeCompare(b.lastSyncAt!))
      .at(-1) ?? linked[0];
  const lastSync = latest?.lastSyncAt ?? undefined;
  const pageData: OrdersPageData = {
    view: facets.total > 0 ? "list" : linked.length > 0 ? "empty" : "no-store",
    ...page,
    search: searchText,
    detail,
    stores: filterStores,
    account: {
      plan: premium ? "premium" : "free",
      // La prova si propone dopo la prima lettura riuscita, anche senza ordini.
      trialAvailable: allowance?.trialAvailable ?? false,
      ...accountCoverage(allowance),
      // Prima del primo collegamento nessun ciclo è avviato e nessuno sblocco è disponibile.
      quota: premium
        ? undefined
        : { used: cycle?.used ?? 0, limit: cycle?.quota ?? 0, cycleEndsAt: cycle?.ends_at ?? null },
    },
    notices,
    sync: {
      running: environmentStores.some((store) => store.syncing),
      lastAt: lastSync ?? null,
      storeId: latest?.id ?? null,
      storeName: latest?.name ?? null,
      // Periodo letto dal primo avvio; prima vale quello che la lettura userà.
      historyDays: latest?.history?.days ?? historyDays,
    },
    onboarding: [
      { label: "stepAccount", done: true },
      { label: "stepEmail", done: verified },
      { label: "stepStore", done: linked.length > 0 },
      { label: "stepSync", done: lastSync !== undefined },
    ],
    messageTemplates: messageTemplates(preferences),
    now: now.toISOString(),
    confirmUnlock,
    // Con l'acquisto disponibile gli sblocchi esauriti rimandano al piano.
    settings: checkoutConfigured(env),
    exportable: false,
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
    ebayEnvironment,
    sandbox: sandboxAvailable(env),
    page: pageData,
    shell: await shellData(area, stores, now),
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
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return true;
  return snapshotOnlyAdded(currentUrl, nextUrl) ? false : defaultShouldRevalidate;
}

/**
 * Sblocco, nuova lettura di un ordine non riuscito, ripristino della conferma di sblocco e
 * attivazione della prova, sempre sugli ordini e sullo spazio dell'utente.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { language, session } = await requireAccountArea(request);
  const t = appCopy[language];
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "unlock-confirmation") {
    await restoreUnlockConfirmation(env.DB, session.user.id);
    return { ok: true } satisfies ActionResult;
  }
  if (intent === "start-trial") {
    const started = await startTrial(env.DB, session.user.id);
    return started
      ? ({ ok: true, notice: t.settings.plan.trialStarted } satisfies ActionResult)
      : data<ActionResult>(
          { ok: false, notice: t.settings.plan.trialUnavailable },
          { status: 409 },
        );
  }
  const environment = requestedEbayEnvironment(request);
  if (intent === "retry") {
    const id = String(form.get("order") ?? "");
    if (!id || id.length > 64)
      return data<ActionResult>({ ok: false, notice: t.stores.failed }, { status: 409 });
    // Con eBay che non risponde la nuova lettura resta sospesa, come il pulsante.
    const stores = await listStores(env.DB, session.user.id);
    if (ebayOutage(stores.filter((store) => store.ebayEnvironment === environment)))
      return data<ActionResult>({ ok: false, notice: t.stores.ebayDown }, { status: 409 });
    let requested;
    try {
      // Il dominio rilegge soltanto un ordine che l'utente consulta, con lettura non riuscita.
      requested = await requestOrderRead(env, session.user.id, id, environment);
    } catch (error) {
      logFailure({ request, error, operation: "route" });
      return data<ActionResult>({ ok: false, notice: t.stores.failed }, { status: 500 });
    }
    if (requested === "not_found" || requested === "invalid")
      return data<ActionResult>({ ok: false, notice: t.stores.failed }, { status: 409 });
    return {
      ok: true,
      notice: requested === "limited" ? t.stores.requested.limited : t.orders.retried,
    } satisfies ActionResult;
  }
  if (intent !== "unlock")
    return data<UnlockResult>({ unlocked: [], remaining: null, error: true }, { status: 400 });
  try {
    return await unlockOrders(
      env.DB,
      session.user.id,
      String(form.get("ids") ?? "").split(","),
      form.get("skipConfirmation") === "true",
      environment,
    );
  } catch (error) {
    // Le violazioni del dominio non espongono ordine, quota altrui o testo SQL.
    if (!(error instanceof UnlockError)) throw error;
    return data<UnlockResult>({ unlocked: [], remaining: null, error: true }, { status: 409 });
  }
}

/** Ambiente eBay degli ordini mostrati, sul solo dominio di test: lo stesso campo dei filtri. */
function EnvironmentSelect({ language, value }: { language: Language; value: EbayEnvironment }) {
  const navigate = useNavigate();
  return (
    <EbayEnvironmentField
      language={language}
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
  const links: AppLinks = { language, base: appBase };
  const t = appCopy[language];
  const alerts = (
    <>
      <AccessNotice language={language} notice={notice} />
      <VerifyEmail language={language} email={account.email} verified={loaderData.verified} />
    </>
  );
  return (
    <AccountShell
      language={language}
      account={account}
      shell={loaderData.shell}
      security={loaderData.verified}
      searchQuery={loaderData.notFound ? "" : (loaderData.page.search ?? "")}
    >
      {loaderData.notFound ? (
        <NotFoundState kind="order" t={t} links={links} />
      ) : (
        <OrdersPage
          data={loaderData.page}
          t={t}
          links={links}
          unlockAction={`${localizedPath(language, ordersPath)}?environment=${loaderData.ebayEnvironment}`}
          confirmation={loaderData.confirmation}
          notice={
            <>
              {alerts}
              {loaderData.sandbox ? (
                <EnvironmentSelect language={language} value={loaderData.ebayEnvironment} />
              ) : null}
            </>
          }
        />
      )}
    </AccountShell>
  );
}
