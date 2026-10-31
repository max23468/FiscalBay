import { Link } from "react-router";

import { useAction, useNotice } from "~/components/action";
import { downloadExport } from "./download";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy, useLinks } from "~/components/copy-context";
import { appHref, privacyPath, termsPath } from "../../app-links";
import { localizedPath } from "../../i18n";
import { DeleteAccount } from "../delete-account";
import type { SecurityData } from "./security";
import { settingsRow, settingsRowText } from "./security-rows";

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
  termsUpdate,
  email,
  security,
}: {
  /** Esportazione dei dati dell'account disponibile. */
  accountExport: boolean;
  /** Cancellazione dell'account disponibile. */
  accountDeletion: boolean;
  /** Versione corrente dei Termini ancora da accettare. */
  termsUpdate: boolean;
  email: string;
  security: SecurityData;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const action = useAccountExport();
  const accept = useAction();
  // Senza footer nell'area autenticata, i documenti legali si raggiungono da qui (D202).
  const legal = [
    {
      path: termsPath,
      title: t.settings.privacy.terms,
      body: termsUpdate ? t.settings.privacy.termsUpdateBody : t.settings.privacy.termsBody,
      action: t.settings.privacy.readTerms,
      accept: termsUpdate,
    },
    {
      path: privacyPath,
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
          <li key={entry.path} className={settingsRow}>
            <span className={settingsRowText}>
              <span className="font-medium">{entry.title}</span>
              <span className="text-sm text-muted-foreground">{entry.body}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <Link
                to={localizedPath(links.language, entry.path)}
                reloadDocument
                {...buttonLink({ variant: "outline", size: "sm" })}
              >
                {entry.action}
              </Link>
              {"accept" in entry && entry.accept ? (
                <Button
                  size="sm"
                  disabled={accept.pending}
                  onClick={() => accept.run("accept-terms")}
                >
                  {t.settings.privacy.acceptTerms}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
        {rows.map((row) => (
          <li key={row.title} className={settingsRow}>
            <span className={settingsRowText}>
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
          <DeleteAccountRow email={email} security={security} accountExport={accountExport} />
        ) : null}
      </ul>
    </div>
  );
}

/** Cancellazione dell'account dalle Impostazioni, con l'esportazione proposta senza obbligo. */
function DeleteAccountRow({
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
  const exporter = useAccountExport();
  return (
    <li className="py-3">
      <DeleteAccount
        email={email}
        actionPath={appHref(links, privacySection)}
        access={{
          methods: security.methods,
          currentSession: security.sessions.find((session) => session.current)?.id ?? null,
          ready: !!security.deletionReady,
        }}
        exportOptions={
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
        }
      />
    </li>
  );
}
