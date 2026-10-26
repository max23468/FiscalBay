import { useState } from "react";

import { useCopy, useLinks } from "~/components/copy-context";
import { useTimeZone } from "~/components/time-zone";
import type { PendingEmailChange } from "../../domain/email-change.server";
import type { ActiveSession } from "../../domain/sessions.server";
import type { SignInMethods } from "../../domain/sign-in-methods.server";
import { appHref } from "../../app-links";
import { formatDate } from "../../format";
import { ConfirmIdentity } from "./confirm-identity";
import { EmailChange } from "./security-email";
import { AddPasskey, PasskeyRename } from "./security-passkeys";
import { MethodAction, MethodRow, SecurityGroup } from "./security-rows";
import { SessionList } from "./security-sessions";

/** Categoria Sicurezza delle Impostazioni, che riceve anche le sue azioni. */
const securitySection = "impostazioni/sicurezza";

/** Azioni che richiedono un accesso recente, oppure la conferma con passkey per un admin. */
const recentIntents = new Set([
  "collega-metodo",
  "rimuovi-metodo",
  "cambia-email",
  "reinvia-email",
]);
const passkeyIntents = new Set(["passkey-remove", "passkey-rename", "passkey-add"]);

export function AccountSecurity({
  email,
  methods,
  sessions,
  now,
  passkeyBlock,
  recent = true,
  passkeyRestriction = null,
  pendingEmail = null,
}: {
  email: string;
  methods: SignInMethods;
  sessions: ActiveSession[];
  now: string;
  passkeyBlock: string;
  recent?: boolean;
  passkeyRestriction?: "conferma-passkey" | "nuovo-accesso" | null;
  pendingEmail?: PendingEmailChange | null;
}) {
  const zone = useTimeZone();
  const {
    t: { access: t, settings },
    language,
  } = useCopy();
  // Nell'anteprima le stesse azioni vanno alla sua route, che le simula.
  const actionPath = appHref(useLinks().links, securitySection);
  // Conferma già data in questa pagina e modifica in attesa della conferma.
  const [confirmed, setConfirmed] = useState(false);
  const [waiting, setWaiting] = useState<{ run: () => void; passkeyOnly: boolean } | null>(null);
  const blocked = (intent: string) =>
    !confirmed &&
    ((recentIntents.has(intent) && !recent) ||
      (passkeyIntents.has(intent) && passkeyRestriction !== null));
  const guard = (intent: string, run: () => void) => {
    if (!blocked(intent)) return run();
    setWaiting({
      run,
      passkeyOnly: passkeyIntents.has(intent) && passkeyRestriction === "conferma-passkey",
    });
  };
  const lastMethod =
    Object.values(methods.accounts).filter(Boolean).length + methods.passkeys.length === 1;
  const status = (connected: boolean) =>
    connected ? settings.security.methodConnected : settings.security.methodNotConnected;
  const oauth = (method: "google" | "ebay") =>
    methods.accounts[method] ? (
      <MethodAction
        intent="rimuovi-metodo"
        method={method}
        label={method === "google" ? settings.security.methodGoogle : settings.security.methodEbay}
        actionPath={actionPath}
        disabled={lastMethod}
      >
        {settings.security.remove}
      </MethodAction>
    ) : (
      <MethodAction intent="collega-metodo" method={method} actionPath={actionPath}>
        {settings.security.connect}
      </MethodAction>
    );
  const addPasskey = <AddPasskey block={passkeyBlock} guard={guard} actionPath={actionPath} />;
  const passkeys = methods.passkeys;
  return (
    <div
      className="grid gap-4"
      // Le modifiche protette passano prima dalla conferma dell'identità, poi ripartono.
      onSubmitCapture={(event) => {
        const form = event.target as HTMLFormElement;
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const intent = String(new FormData(form, submitter).get("intent") ?? "");
        if (!blocked(intent)) return;
        event.preventDefault();
        event.stopPropagation();
        guard(intent, () => form.requestSubmit(submitter));
      }}
    >
      {waiting ? (
        <ConfirmIdentity
          methods={methods}
          passkeyOnly={waiting.passkeyOnly}
          actionPath={actionPath}
          currentSession={sessions.find((session) => session.current)?.id ?? null}
          onConfirmed={() => {
            const { run } = waiting;
            // La conferma arriva da un effetto, dove React non anticipa gli aggiornamenti: la
            // modifica riparte con la sessione appena confermata, riletta dai loader.
            setConfirmed(true);
            setWaiting(null);
            run();
          }}
          onCancel={() => setWaiting(null)}
        />
      ) : null}
      <EmailChange email={email} actionPath={actionPath} pendingEmail={pendingEmail} />
      <SecurityGroup id="security-methods" title={settings.security.methods}>
        {lastMethod ? (
          <p role="status" className="text-sm text-warning">
            {settings.security.addAlternative}
          </p>
        ) : null}
        <ul className="grid divide-y border-y">
          <MethodRow
            label={settings.security.methodPassword}
            status={status(methods.accounts.password)}
          >
            <MethodAction intent="password" actionPath={actionPath}>
              {methods.accounts.password ? settings.security.changePassword : t.setPassword}
            </MethodAction>
            {methods.accounts.password ? (
              <MethodAction
                intent="rimuovi-metodo"
                method="password"
                label={settings.security.methodPassword}
                actionPath={actionPath}
                disabled={lastMethod}
              >
                {settings.security.remove}
              </MethodAction>
            ) : null}
          </MethodRow>
          <MethodRow
            label={settings.security.methodGoogle}
            status={status(methods.accounts.google)}
          >
            {oauth("google")}
          </MethodRow>
          {/* Accedere con eBay non collega un negozio, e viceversa. */}
          <MethodRow
            label={settings.security.methodEbay}
            status={status(methods.accounts.ebay)}
            hint={methods.accounts.ebay ? undefined : t.ebayAccessBody}
          >
            {oauth("ebay")}
          </MethodRow>
          {passkeys.length === 0 ? (
            <MethodRow
              label={settings.security.methodPasskey}
              status={t.passkeyEmpty}
              hint={t.passkeyRecovery}
            >
              {addPasskey}
            </MethodRow>
          ) : (
            passkeys.map((passkey) => (
              <MethodRow
                key={passkey.id}
                label={settings.security.methodPasskey}
                status={
                  passkey.createdAt
                    ? settings.security.passkeyItem(
                        passkey.name || settings.security.methodPasskey,
                        formatDate(passkey.createdAt, language, "dateTime", zone),
                      )
                    : passkey.name || settings.security.methodConnected
                }
              >
                <MethodAction
                  intent="passkey-remove"
                  id={passkey.id}
                  label={passkey.name || settings.security.methodPasskey}
                  actionPath={actionPath}
                  disabled={lastMethod}
                >
                  {settings.security.remove}
                </MethodAction>
                <PasskeyRename passkey={passkey} actionPath={actionPath} />
              </MethodRow>
            ))
          )}
        </ul>
        {passkeys.length > 0 ? <div className="max-w-xl">{addPasskey}</div> : null}
      </SecurityGroup>
      <SessionList sessions={sessions} now={now} actionPath={actionPath} />
    </div>
  );
}
