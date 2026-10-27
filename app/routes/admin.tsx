import { KeyRound } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";

import { AccountsView, StoresView } from "~/components/admin/directory";
import { CommerceView } from "~/components/admin/commerce";
import { AbuseView, AuditTable, NoticesView } from "~/components/admin/governance";
import { JobsView, QuotasView } from "~/components/admin/operations";
import { AnomalyList } from "~/components/admin/overview";
import { AdminShell } from "~/components/admin/shell";
import { WorkspaceView } from "~/components/admin/workspace";
import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import { useCopy } from "~/components/copy-context";
import { loadPasskeyClient } from "../account/passkey";
import {
  adminSession,
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
  const { session, access } = await adminSession(request);
  tracePhase(request, "session");
  // Chi non è admin riceve la stessa risposta di un indirizzo inesistente.
  if (access === "none") throw data(null, { status: 404 });
  const section = sectionFrom(params.sezione);
  // Soltanto la scheda di uno spazio ha un elemento nell'indirizzo.
  if (!section || (section === "spazi") !== Boolean(params.voce)) throw data(null, { status: 404 });
  return {
    language,
    access,
    // La passkey ha aperto una sessione, ma il dispositivo non ha verificato l'utente.
    unverified: access === "verify" && url.searchParams.has(confirmedParam),
    confirmedAt: access === "granted" ? new Date(session!.session.createdAt).toISOString() : null,
    // Senza la conferma con passkey nessuna sezione si legge.
    page: access === "granted" ? await loadSection(section, params.voce, url) : null,
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
      return <AnomalyList anomalies={page.anomalies} />;
    case "account":
      return <AccountsView {...page} />;
    case "spazi":
      return <WorkspaceView workspace={page.workspace} audit={page.audit} />;
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

export default function Admin({ loaderData }: Route.ComponentProps) {
  const { language, unverified, confirmedAt, page, now } = loaderData;
  const t = appCopy[language].admin;
  if (page && confirmedAt)
    return (
      <AdminShell
        title={sectionTitle(page, language).split(" | ")[0]!}
        note={t.granted(formatDate(confirmedAt, language))}
      >
        <Section page={page} now={now} />
      </AdminShell>
    );
  return (
    <StandalonePage icon={KeyRound} tone="amber" title={t.title} homeHref={localizedPath(language)}>
      <PasskeyConfirm unverified={unverified} />
      <a href={localizedPath(language)} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {t.back}
      </a>
    </StandalonePage>
  );
}
