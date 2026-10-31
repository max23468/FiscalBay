import { UserX } from "lucide-react";

import { StandalonePage } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import { appCopy, supportEmail } from "../app-copy";
import { localizedPath, type Language } from "../i18n";

/**
 * Esito della conferma della cancellazione: sessioni chiuse e automazioni ferme, quindi nessuna
 * schermata dell'area e nessun dato dell'account.
 */
export function AccountDeletionPage({ language }: { language: Language }) {
  const t = appCopy[language];
  return (
    <StandalonePage
      icon={UserX}
      tone="neutral"
      title={t.accountDeletion.title}
      homeHref={localizedPath(language)}
    >
      <p className="leading-relaxed text-pretty">{t.accountDeletion.body}</p>
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {t.accountDeletion.note}
      </p>
      <a href={`mailto:${supportEmail}`} className="w-fit link-underline">
        {t.common.contactSupport}: {supportEmail}
      </a>
      <a href={localizedPath(language)} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {t.authError.back}
      </a>
    </StandalonePage>
  );
}
