import { KeyRound } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";

import { AccountsView, StoresView } from "~/components/admin/directory";
import { CommerceView } from "~/components/admin/commerce";
import { AbuseView, AuditTable, NoticesView } from "~/components/admin/governance";
import { JobsView, QuotasView } from "~/components/admin/operations";
import { Overview } from "~/components/admin/overview";
import { AdminShell, type AdminSectionKey } from "~/components/admin/shell";
import { ReadOnly } from "~/components/admin/use-admin";
import { WorkspaceView } from "~/components/admin/workspace";
import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import { useCopy } from "~/components/copy-context";
import { loadPasskeyClient } from "../account/passkey";
import {
  adminSessionMaxAge,
  adminSession,
  recordAgentRead,
  loadSection,
  runAdminAction,
  sectionFrom,
  type SectionData,
} from "../admin-console.server";
import { appCopy, pageTitle } from "../app-copy";
import { adminCopy } from "../copy/admin-copy";
import { tracePhase } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import { formatDate } from "../format";
import type { Route } from "./+types/admin";

export function meta({ location, loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const section = loaderData?.page ? sectionTitle(loaderData.page, language) : null;
  return [
    { title: pageTitle(section ?? appCopy[language].admin.title) },
    { name: "robots", content: "noindex" },
  ];
}

function sectionTitle(page: SectionData, language: "it" | "en") {
  const nav = adminCopy[language].nav;
  const titles = {
    panoramica: nav.overview,
    account: nav.accounts,
    spazi: adminCopy[language].workspace.title,
    negozi: nav.stores,
    lavori: nav.jobs,
    quote: nav.quotas,
    commerciale: nav.commerce,
    antiabuso: nav.abuse,
    comunicazioni: nav.notices,
    registro: nav.audit,
  } satisfies Record<SectionData["section"], string>;
  return `${titles[page.section]} | ${adminCopy[language].console}`;
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/** Parametro aggiunto dopo un accesso con passkey riuscito, per spiegare un esito senza verifica. */
const confirmedParam = "conferma";

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const { session, access, agent } = await adminSession(request);
  tracePhase(request, "session");
  // Chi non è admin riceve la stessa risposta di un indirizzo inesistente.
  if (access === "none") throw data(null, { status: 404 });
  const section = sectionFrom(params.sezione);
  // Soltanto la scheda di uno spazio ha un elemento nell'indirizzo.
  if (!section || (section === "spazi") !== Boolean(params.voce)) throw data(null, { status: 404 });
  if (agent) await recordAgentRead(agent, url);
  return {
    language,
    access,
    // La passkey ha aperto una sessione, ma il dispositivo non ha verificato l'utente.
    unverified: access === "verify" && url.searchParams.has(confirmedParam),
    // La conferma con passkey vale 12 ore dall'apertura della sessione.
    passkeyUntil:
      access === "granted"
        ? new Date(
            new Date(session!.session.createdAt).getTime() + adminSessionMaxAge,
          ).toISOString()
        : null,
    // Senza la conferma con passkey nessuna sezione si legge, salvo l'accesso tecnico.
    page:
      access === "granted" || access === "agent"
        ? await loadSection(section, params.voce, url)
        : null,
    readOnly: access === "agent",
    now: new Date().toISOString(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const { session, access } = await adminSession(request);
  if (access !== "granted") throw data(null, { status: 404 });
  return runAdminAction(request, session!.user.id, language);
}

/** Accesso con passkey: Better Auth propone solo le passkey dell'utente della sessione. */
function PasskeyConfirm({ unverified }: { unverified: boolean }) {
  const { language } = useCopy();
  const t = appCopy[language].admin;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // L'esito senza verifica resta visibile fino al tentativo successivo.
  const [retried, setRetried] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.verifyBody}</p>
      <Button
        type="button"
        className="w-fit"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        onClick={async () => {
          setPending(true);
          setError(false);
          setRetried(true);
          try {
            const result = await (await loadPasskeyClient())?.signIn.passkey();
            if (!result || result.error) setError(true);
            else window.location.replace(`${window.location.pathname}?${confirmedParam}`);
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <KeyRound aria-hidden="true" data-icon="inline-start" />
        )}
        {t.verifyTitle}
      </Button>
      {error || (unverified && !retried) ? (
        <p role="alert" className="text-sm text-danger">
          {t.verifyFailed}
        </p>
      ) : null}
    </div>
  );
}

function Section({ page, now }: { page: SectionData; now: string }) {
  switch (page.section) {
    case "panoramica":
      return <Overview data={page} />;
    case "account":
      return <AccountsView {...page} />;
    case "spazi":
      return <WorkspaceView workspace={page.workspace} audit={page.audit} now={now} />;
    case "negozi":
      return <StoresView {...page} />;
    case "lavori":
      return <JobsView tasks={page.tasks} receipts={page.receipts} />;
    case "quote":
      return <QuotasView quotas={page.quotas} anomalies={page.anomalies} />;
    case "commerciale":
      return <CommerceView data={page} now={now} />;
    case "antiabuso":
      return <AbuseView signals={page.signals} />;
    case "comunicazioni":
      return <NoticesView notices={page.notices} now={now} />;
    case "registro":
      return <AuditTable entries={page.entries} />;
  }
}

/** Voce della navigazione accesa per la sezione: la scheda di uno spazio sta sotto Account. */
const navKey = {
  panoramica: "overview",
  account: "accounts",
  spazi: "accounts",
  negozi: "stores",
  lavori: "jobs",
  quote: "quotas",
  commerciale: "commerce",
  antiabuso: "abuse",
  comunicazioni: "notices",
  registro: "audit",
} as const satisfies Record<SectionData["section"], AdminSectionKey>;

/** Titolo della pagina: per uno spazio l'email del titolare, altrimenti il nome della sezione. */
function pageHeading(page: SectionData, language: "it" | "en") {
  if (page.section !== "spazi") return sectionTitle(page, language).split(" | ")[0]!;
  const owner = page.workspace.members.find((member) => member.role === "owner");
  return owner?.email ?? page.workspace.name;
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  const { language, unverified, passkeyUntil, readOnly, page, now } = loaderData;
  const t = appCopy[language].admin;
  if (page) {
    const until = passkeyUntil;
    const sameDay =
      until && formatDate(until, language, "date") === formatDate(now, language, "date");
    return (
      <AdminShell
        current={navKey[page.section]}
        title={pageHeading(page, language)}
        subtitle={page.section === "spazi" ? adminCopy[language].workspace.title : undefined}
        passkeyUntil={until ? formatDate(until, language, sameDay ? "time" : "dateTime") : null}
      >
        <ReadOnly value={readOnly}>
          <Section page={page} now={now} />
        </ReadOnly>
      </AdminShell>
    );
  }
  return (
    <StandalonePage icon={KeyRound} tone="amber" title={t.title} homeHref={localizedPath(language)}>
      <PasskeyConfirm unverified={unverified} />
      <a href={localizedPath(language)} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {t.back}
      </a>
    </StandalonePage>
  );
}
