import { useId, useRef, useState } from "react";
import { Link } from "react-router";

import { useAction, useNotice } from "~/components/action";
import { downloadExport } from "./download";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useCopy, useLinks } from "~/components/copy-context";
import { appHref } from "../../app-links";
import { localizedPath } from "../../i18n";
import { ConfirmIdentity } from "./confirm-identity";
import type { SecurityData } from "./security";

/** Categoria che riceve le azioni, anche nell'anteprima. */
const privacySection = "impostazioni/privacy";

/** Esportazione dei dati dell'account: il file si scarica dal suo percorso, che ricontrolla sessione e validità. */
function useAccountExport() {
  const { t } = useCopy();
  const notify = useNotice();
  return useAction((result) => {
    if (!result.download) return;
    downloadExport(result.download)
      .then((notice) => {
        if (notice !== null) notify(notice || t.settings.privacy.accountExportFailed);
      })
      .catch(() => notify(t.settings.privacy.accountExportFailed));
  });
}

export function PrivacySection({
  accountExport,
  accountDeletion,
  email,
  security,
}: {
  /** Esportazione dei dati dell'account disponibile. */
  accountExport: boolean;
  /** Cancellazione dell'account disponibile. */
  accountDeletion: boolean;
  email: string;
  security: SecurityData;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const action = useAccountExport();
  // Senza footer nell'area autenticata, i documenti legali si raggiungono da qui (D202).
  const legal = [
    {
      path: "/termini",
      title: t.settings.privacy.terms,
      body: t.settings.privacy.termsBody,
      action: t.settings.privacy.readTerms,
    },
    {
      path: "/privacy",
      title: t.settings.privacy.privacyPolicy,
      body: t.settings.privacy.privacyPolicyBody,
      action: t.settings.privacy.readPolicy,
    },
  ];
  const rows = accountExport
    ? [
        {
          intent: "account-export",
          title: t.settings.privacy.accountExport,
          body: t.settings.privacy.accountExportBody,
          action: t.settings.privacy.accountExportAction,
        },
      ]
    : [];
  return (
    <div className="grid gap-4">
      <ul className="grid divide-y border-y">
        {legal.map((entry) => (
          <li key={entry.path} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{entry.title}</span>
              <span className="text-sm text-muted-foreground">{entry.body}</span>
            </span>
            <Link
              to={localizedPath(links.language, entry.path)}
              reloadDocument
              {...buttonLink({ variant: "outline", size: "sm" })}
            >
              {entry.action}
            </Link>
          </li>
        ))}
        {rows.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{row.title}</span>
              <span className="text-sm text-muted-foreground">{row.body}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={action.pending}
              onClick={() => action.run(row.intent)}
            >
              {row.action}
            </Button>
          </li>
        ))}
        {accountDeletion ? (
          <DeleteAccount email={email} security={security} accountExport={accountExport} />
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Cancellazione dell'account (§30): l'esportazione proposta senza obbligo, l'indirizzo
 * dell'account scritto per esteso e la conferma dell'identità quando l'ultimo accesso non è di
 * pochi minuti fa; poi il link via email, che avvia la cancellazione.
 */
function DeleteAccount({
  email,
  security,
  accountExport,
}: {
  email: string;
  security: SecurityData;
  accountExport: boolean;
}) {
  const { t } = useCopy();
  const { links } = useLinks();
  const id = useId();
  const actionPath = appHref(links, privacySection);
  const exporter = useAccountExport();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Identità già confermata in questa pagina: un nuovo invio non la richiede di nuovo.
  const confirmed = useRef(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const send = () => action.run("account-delete", { confirmation: typed.trim() });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{t.settings.privacy.deleteAccount}</span>
        <span className="text-sm text-muted-foreground">
          {t.settings.privacy.deleteAccountBody}
        </span>
      </span>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t.settings.privacy.deleteAccount}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.privacy.deleteAccountTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.privacy.deleteAccountConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">{t.settings.privacy.deleteAccountExport}</p>
            <div className="flex flex-wrap gap-2">
              {accountExport ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporter.pending}
                  onClick={() => exporter.run("account-export")}
                >
                  {t.settings.privacy.accountExport}
                </Button>
              ) : null}
              <Link
                to={appHref(links, "impostazioni/esportazione")}
                {...buttonLink({ variant: "outline", size: "sm" })}
              >
                {t.settings.privacy.deleteAccountOpenExport}
              </Link>
            </div>
          </div>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!matches) return;
              setOpen(false);
              if (security.deletionReady || confirmed.current) send();
              else setConfirming(true);
            }}
          >
            <FieldLabel htmlFor={`${id}-email`}>{t.settings.privacy.deleteAccountEmail}</FieldLabel>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.currentTarget.value)}
            />
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive-solid"
                disabled={!matches || action.pending}
              >
                {t.settings.privacy.deleteAccountConfirm}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {confirming ? (
        <ConfirmIdentity
          methods={security.methods}
          passkeyOnly={false}
          actionPath={actionPath}
          returnTo={actionPath}
          body={t.settings.privacy.deleteAccountReauth}
          currentSession={security.sessions.find((session) => session.current)?.id ?? null}
          onConfirmed={() => {
            setConfirming(false);
            confirmed.current = true;
            send();
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
}
