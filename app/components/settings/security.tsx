import { AccessNotice } from "~/components/access-notice";
import { AccountSecurity } from "~/components/settings/account-security";
import type { AccessNoticeView } from "../../access-notice";
import type { PendingEmailChange } from "../../domain/email-change.server";
import type { ActiveSession } from "../../domain/sessions.server";
import type { SignInMethods } from "../../domain/sign-in-methods.server";

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
}: {
  security: SecurityData;
  email: string;
  now: string;
}) {
  return (
    <>
      <AccessNotice notice={security.notice} />
      <AccountSecurity
        email={email}
        methods={security.methods}
        sessions={security.sessions}
        now={now}
        passkeyBlock={security.passkeyBlock}
        recent={security.recent}
        passkeyRestriction={security.passkeyRestriction}
        pendingEmail={security.pendingEmail}
      />
    </>
  );
}
