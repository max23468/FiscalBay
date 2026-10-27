import { Link } from "react-router";

import { useAction, useNotice } from "~/components/action";
import { downloadExport } from "./download";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy, useLinks } from "~/components/copy-context";
import { localizedPath } from "../../i18n";

export function PrivacySection({
  accountExport,
  accountDeletion,
}: {
  /** Esportazione dei dati dell'account disponibile. */
  accountExport: boolean;
  /** Cancellazione dell'account disponibile. */
  accountDeletion: boolean;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const notify = useNotice();
  // Il file dell'account si scarica dal suo percorso, che ricontrolla sessione e validità.
  const action = useAction((result) => {
    if (!result.download) return;
    downloadExport(result.download)
      .then((notice) => {
        if (notice !== null) notify(notice || t.settings.privacy.accountExportFailed);
      })
      .catch(() => notify(t.settings.privacy.accountExportFailed));
  });
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
        {accountDeletion ? <DeleteAccount /> : null}
      </ul>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useCopy();
  const action = useAction();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{t.settings.privacy.deleteAccount}</span>
        <span className="text-sm text-muted-foreground">
          {t.settings.privacy.deleteAccountBody}
        </span>
      </span>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          {t.settings.privacy.deleteAccount}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.privacy.deleteAccountTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.privacy.deleteAccountConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogClose
              render={<Button variant="destructive-solid" />}
              onClick={() => action.run("account-delete")}
            >
              {t.settings.privacy.deleteAccountConfirm}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
