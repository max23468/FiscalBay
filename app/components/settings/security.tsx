import { useAction } from "~/components/app-shell";
import { AccessNotice, AccountSecurity } from "~/components/account";
import type { AccessNoticeView } from "../../access-notice";
import type { PendingEmailChange } from "../../domain/email-change.server";
import type { ActiveSession } from "../../domain/sessions.server";
import type { SignInMethods } from "../../domain/sign-in-methods.server";
import type { Language } from "../../i18n";

/** Metodi di accesso, sessioni ed esito dell'ultima azione di Sicurezza. */
export interface SecurityData {
  methods: SignInMethods;
  sessions: ActiveSession[];
  passkeyBlock: string;
  recent?: boolean;
  passkeyRestriction?: "conferma-passkey" | "nuovo-accesso" | null;
  pendingEmail?: PendingEmailChange | null;
  notice: AccessNoticeView | null;
}

export function SecuritySection({
  security,
  email,
  now,
  preview,
  language,
}: {
  security: SecurityData;
  email: string;
  now: string;
  preview: boolean;
  language: Language;
}) {
  const action = useAction();
  return (
    <>
      <AccessNotice language={language} notice={security.notice} />
      <AccountSecurity
        className="grid gap-4"
        language={language}
        email={email}
        methods={security.methods}
        sessions={security.sessions}
        now={now}
        passkeyBlock={security.passkeyBlock}
        recent={security.recent}
        passkeyRestriction={security.passkeyRestriction}
        pendingEmail={security.pendingEmail}
        onAction={preview ? (intent, fields) => action.run(intent, fields) : undefined}
      />
    </>
  );
}
