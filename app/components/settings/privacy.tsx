import { Link } from "react-router";

import { useAction } from "~/components/app-shell";
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
import type { AppCopy } from "../../app-copy";
import type { AppLinks } from "../../app-links";
import { localizedPath } from "../../i18n";

export function PrivacySection({
  accountData,
  t,
  links,
}: {
  /** Esportazione e cancellazione dell'account disponibili. */
  accountData: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  const action = useAction();
  const rows = accountData
    ? [
        {
          intent: "account-export",
          title: t.settings.accountExport,
          body: t.settings.accountExportBody,
          action: t.settings.accountExportAction,
        },
      ]
    : [];
  return (
    <div className="grid gap-4">
      <ul className="grid divide-y border-y">
        <li className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-medium">{t.settings.privacyPolicy}</span>
            <span className="text-sm text-muted-foreground">{t.settings.privacyPolicyBody}</span>
          </span>
          <Link
            to={localizedPath(links.language, "/privacy")}
            reloadDocument
            {...buttonLink({ variant: "outline", size: "sm" })}
          >
            {t.settings.readPolicy}
          </Link>
        </li>
        {rows.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{row.title}</span>
              <span className="text-sm text-muted-foreground">{row.body}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => action.run(row.intent)}>
              {row.action}
            </Button>
          </li>
        ))}
        {accountData ? <DeleteAccount t={t} /> : null}
      </ul>
    </div>
  );
}

function DeleteAccount({ t }: { t: AppCopy }) {
  const action = useAction();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{t.settings.deleteAccount}</span>
        <span className="text-sm text-muted-foreground">{t.settings.deleteAccountBody}</span>
      </span>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          {t.settings.deleteAccount}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.deleteAccountTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.settings.deleteAccountConfirmation}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogClose
              render={<Button variant="destructive-solid" />}
              onClick={() => action.run("account-delete")}
            >
              {t.settings.deleteAccountConfirm}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
