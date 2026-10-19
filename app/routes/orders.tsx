import { env } from "cloudflare:workers";
import { data, useNavigate, type ShouldRevalidateFunctionArgs } from "react-router";

import { AccessNotice, AccountShell, VerifyEmail } from "~/components/account";
import { EbayEnvironmentField, type EbayEnvironment } from "~/components/ebay-environment";
import { NotFoundState } from "~/components/not-found";
import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { accessNotice } from "../access-notice";
import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy } from "../app-copy";
import { appBase, ordersPath, storeLinkPath, type AppLinks } from "../app-links";
import {
  orderAllowance,
  restoreUnlockConfirmation,
  unlockConfirmation,
  unlockOrders,
} from "../domain/grants.server";
import { requestOrderRead } from "../domain/order-sync.server";
import { listVisibleOrders, orderView } from "../domain/orders.server";
import { listStores } from "../domain/stores.server";
import { errorResponse } from "../error-response";
import { logFailure } from "../errors";
import { languageFromPath, localizedPath, type Language } from "../i18n";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import { describeRequest, measure } from "../observability.server";
import { orderPage } from "../order-list";
import { settle } from "../settle.server";
import type { ActionResult, OrderView, OrdersNotice } from "../view-models";
import type { Route } from "./+types/orders";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.orders.title}` }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/** Ordini caricati al massimo per richiesta, prima di filtri e «Carica altri». */
const loadedOrders = 100;

/** Una verifica fiscale ancora in corso: lo sblocco resta sospeso finché non è confermata. */
function verifying(order: OrderView) {
  const { fiscal } = order;
  return (
    fiscal.state === "checking" ||
    (fiscal.state === "locked" && fiscal.hold === "checking") ||
    (fiscal.state === "available" && fiscal.notice === "checking")
  );
}

function ebayEnvironmentOf(request: Request): EbayEnvironment {
  const environment =
    new URL(request.url).searchParams.get("environment") === "sandbox" ? "sandbox" : "production";
  if (environment === "sandbox" && !sandboxAvailable(env))
    throw errorResponse(request, "FORBIDDEN");
  return environment;
}

/**
 * Ordini persistiti e autorizzati dello spazio, senza attendere eBay: sessione, diritti e
 * conservazione sono verificati qui, prima della risposta. Gli ordini ancora in verifica
 * compaiono con l'ultimo stato salvato e lo sblocco sospeso; il loro stato confermato arriva
 * nella stessa risposta, entro l'attesa dello streaming.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { language, session, account } = await requireAccountArea(request, { unverified: true });
  const search = new URL(request.url).searchParams;
  const ebayEnvironment = ebayEnvironmentOf(request);
  const userId = session.user.id;
  const verified = session.user.emailVerified;
  const now = new Date();
  const requested = params.ordine && params.ordine.length <= 64 ? params.ordine : null;
  const read = (ids?: string[]) =>
    measure("d1", "orders", () =>
      listVisibleOrders(env.DB, userId, ids ? ids.length : loadedOrders, ebayEnvironment, now, {
        ids,
      }),
    ).then((orders) => orders.map(orderView));
  const [orders, detailOrders, stores, allowance, confirmUnlock] = await Promise.all([
    verified ? read() : [],
    verified && requested ? read([requested]) : [],
    verified ? measure("d1", "stores", () => listStores(env.DB, userId)) : [],
    verified ? measure("d1", "allowance", () => orderAllowance(env.DB, userId, now)) : null,
    unlockConfirmation(env.DB, userId),
  ]);
  const notice = accessNotice(search, language);
  const detail = detailOrders[0] ?? null;
  // Un ordine inesistente, scaduto o di un altro spazio risponde allo stesso modo.
  if (params.ordine && !detail) {
    return data(
      { notFound: true as const, language, account, notice, verified, ebayEnvironment },
      { status: 404 },
    );
  }
  const environmentStores = stores.filter((store) => store.ebayEnvironment === ebayEnvironment);
  const linked = environmentStores.filter((store) => store.connection !== "disconnected");
  // `negozio` porta anche l'esito del collegamento di un negozio, che non è un filtro.
  const criteria = new URLSearchParams(search);
  if (Object.hasOwn(appCopy[language].access.storeNotices, criteria.get("negozio") ?? ""))
    criteria.delete("negozio");
  const page = orderPage(
    orders,
    criteria,
    now.toISOString(),
    (query) => `${localizedPath(language, ordersPath)}?${query}`,
  );
  const cycle = allowance?.cycle ?? null;
  const premium = !!allowance?.premium;
  const notices: OrdersNotice[] = [
    // Prima i collegamenti già scaduti, poi quelli in scadenza.
    ...environmentStores
      .flatMap((store) =>
        store.reminder ? [{ id: store.id, name: store.name, ...store.reminder }] : [],
      )
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expired" ? -1 : 1))
      .map((store): OrdersNotice =>
        store.kind === "expired"
          ? { kind: "store-issue", storeId: store.id, storeName: store.name }
          : { kind: "consent-expiring", storeId: store.id, storeName: store.name, at: store.at },
      ),
    ...(!premium &&
    cycle &&
    allowance?.remaining === 0 &&
    orders.some((order) => order.fiscal.state === "locked")
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
  const lastSync = environmentStores
    .map((store) => store.lastSyncAt)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);
  const pageData: OrdersPageData = {
    view: orders.length > 0 ? "list" : linked.length > 0 ? "empty" : "no-store",
    ...page,
    incoming: [],
    detail,
    stores: environmentStores
      .filter((store) => !store.pauseReasons.includes("plan"))
      .map((store) => ({ id: store.id, name: store.name })),
    marketplaces: [
      ...new Set(orders.flatMap((order) => (order.marketplace ? [order.marketplace] : []))),
    ],
    account: {
      plan: premium ? "premium" : "free",
      // Prima del primo collegamento nessun ciclo è avviato e nessuno sblocco è disponibile.
      quota: premium
        ? undefined
        : { used: cycle?.used ?? 0, limit: cycle?.quota ?? 0, cycleEndsAt: cycle?.ends_at ?? null },
    },
    notices,
    sync: {
      running: environmentStores.some((store) => store.syncing),
      lastAt: lastSync ?? null,
      storeId: linked[0]?.id ?? null,
      storeName: linked[0]?.name ?? null,
    },
    onboarding: [
      { label: "stepAccount", done: true },
      { label: "stepEmail", done: verified },
      { label: "stepStore", done: linked.length > 0 },
      { label: "stepSync", done: lastSync !== undefined },
    ],
    // Le preferenze del modello arriveranno con le Impostazioni: vale il testo predefinito.
    messageTemplate:
      appCopy[language].settings[language === "it" ? "templateDefaultIt" : "templateDefaultEn"],
    now: now.toISOString(),
    confirmUnlock,
    settings: false,
    exportable: false,
    openOnEbay: false,
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
    confirmation:
      pending.length > 0
        ? settle(
            () => read([...new Set(pending)]),
            (confirmed) => !confirmed.some(verifying),
          ).catch(() => [])
        : undefined,
  };
}

/** Anche un conflitto di quota rilegge lo stato corrente per aggiornare i controlli. */
export function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return formMethod ? true : defaultShouldRevalidate;
}

const unlockFailures =
  /invalid_order_selection|order_not_available|order_not_in_workspace|free_quota_exhausted|tax_data_unavailable|invalid_grant_cycle|order_already_granted_or_merged|NOT NULL constraint failed|UNIQUE constraint failed/u;

/**
 * Sblocco, nuova lettura di un ordine non riuscito e ripristino della conferma di sblocco,
 * sempre sugli ordini e sullo spazio dell'utente.
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
  const environment = ebayEnvironmentOf(request);
  if (intent === "retry") {
    const id = String(form.get("order") ?? "");
    const [order] =
      id && id.length <= 64
        ? await listVisibleOrders(env.DB, session.user.id, 1, environment, new Date(), {
            ids: [id],
          })
        : [];
    if (!order || order.fiscalState !== "error")
      return data<ActionResult>({ ok: false, notice: t.stores.failed }, { status: 409 });
    let requested;
    try {
      requested = await requestOrderRead(env, session.user.id, order);
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
    if (!(error instanceof Error) || !unlockFailures.test(error.message)) throw error;
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
    <AccountShell language={language} account={account} security={loaderData.verified}>
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
