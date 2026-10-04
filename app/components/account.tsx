import { KeyRound, Languages, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useSubmit } from "react-router";

import { AppShell } from "~/components/app-shell";
import { useFieldErrors } from "~/components/form-validation";
import { StatusAlert } from "~/components/status";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import type { ActiveSession } from "../domain/sessions.server";
import type { SignInMethods } from "../domain/sign-in-methods.server";
import type { AccessNoticeView } from "../access-notice";
import { appCopy } from "../app-copy";
import { securityPath } from "../app-links";
import { languageNames, localizedPath, type Language } from "../i18n";
import { formatDate, formatRelative } from "../view-models";

/** Riga di un metodo di accesso: nome, stato e azioni, come nelle Impostazioni. */
function MethodRow({
  label,
  status,
  hint,
  children,
}: {
  label: string;
  status: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // Il gruppo dà ai pulsanti ripetuti in ogni riga («Rimuovi», «Esci») il nome della riga.
  const id = useId();
  return (
    <li className="flex flex-col items-start gap-x-4 gap-y-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <span className="grid min-w-0 sm:flex-1 sm:basis-48">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span id={`${id}-status`} className="text-sm text-muted-foreground">
          {status}
        </span>
        {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
      </span>
      {children ? (
        <div
          role="group"
          aria-labelledby={`${id}-label ${id}-status`}
          className="flex flex-wrap gap-2"
        >
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** Pulsante che invia un'azione di Sicurezza, con il metodo interessato. */
function MethodAction({
  language,
  intent,
  method,
  children,
}: {
  language: Language;
  intent: string;
  method?: string;
  children: React.ReactNode;
}) {
  return (
    <form method="post" action={localizedPath(language, "/accesso")}>
      {method ? <input type="hidden" name="metodo" value={method} /> : null}
      <Button type="submit" variant="outline" size="sm" name="intent" value={intent}>
        {children}
      </Button>
    </form>
  );
}

/** Gruppo della card Sicurezza, separato dal precedente come nelle Impostazioni. */
function SecurityGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Email attuale; il nuovo indirizzo si inserisce solo quando serve. */
function EmailChange({ language, email }: { language: Language; email: string }) {
  const { access: t, profile, orders } = appCopy[language];
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const v = useFieldErrors(t.validation);
  return (
    <SecurityGroup id="security-email" title={profile.email}>
      <div className="flex flex-col items-start gap-x-4 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="min-w-0 break-all sm:flex-1 sm:basis-48">{email}</span>
        {open ? null : (
          <Button
            ref={opener}
            type="button"
            variant="outline"
            size="sm"
            aria-describedby="new-email-hint"
            onClick={() => setOpen(true)}
          >
            {profile.changeEmail}
          </Button>
        )}
      </div>
      {open ? (
        <form
          method="post"
          action={localizedPath(language, "/accesso")}
          className="grid gap-3"
          {...v.form}
          onSubmit={(event) => void v.check(event)}
        >
          <Field>
            <FieldLabel htmlFor="new-email">{t.newEmail}</FieldLabel>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              {...v.control("email", "new-email-hint")}
            />
            {v.error("email")}
            <FieldDescription id="new-email-hint">{profile.emailHint}</FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" name="intent" value="cambia-email">
              {t.sendEmailLink}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                // Chiudendo il campo il focus torna al pulsante che l'ha aperto.
                flushSync(() => setOpen(false));
                opener.current?.focus();
              }}
            >
              {orders.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <p id="new-email-hint" className="text-sm text-muted-foreground">
          {profile.emailHint}
        </p>
      )}
    </SecurityGroup>
  );
}

/** Sessioni aperte: si chiudono una alla volta o tutte tranne quella in uso, che esce dal menu. */
function SessionList({
  language,
  sessions,
  now,
}: {
  language: Language;
  sessions: ActiveSession[];
  now: string;
}) {
  const { settings } = appCopy[language];
  return (
    <SecurityGroup id="security-sessions" title={settings.sessions}>
      <ul className="grid divide-y border-y">
        {sessions.map((session) => (
          <MethodRow
            key={session.id}
            label={session.device}
            status={
              session.current
                ? settings.thisDevice
                : settings.lastActive(formatRelative(session.lastActiveAt, now, language))
            }
          >
            {session.current ? null : (
              <form method="post" action={localizedPath(language, "/accesso")}>
                <input type="hidden" name="id" value={session.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  name="intent"
                  value="esci-sessione"
                >
                  {settings.signOutSession}
                </Button>
              </form>
            )}
          </MethodRow>
        ))}
      </ul>
      {sessions.some((session) => !session.current) ? (
        <form method="post" action={localizedPath(language, "/accesso")}>
          <Button type="submit" variant="destructive" name="intent" value="esci-altri">
            {settings.signOutAll}
          </Button>
        </form>
      ) : null}
    </SecurityGroup>
  );
}

export function AccountSecurity({
  language,
  email,
  methods,
  sessions,
  now,
  passkeyBlock,
}: {
  language: Language;
  email: string;
  methods: SignInMethods;
  sessions: ActiveSession[];
  now: string;
  passkeyBlock: string;
}) {
  const { access: t, settings } = appCopy[language];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const status = (connected: boolean) =>
    connected ? settings.methodConnected : settings.methodNotConnected;
  const oauth = (method: "google" | "ebay") =>
    methods.accounts[method] ? (
      <MethodAction language={language} intent="rimuovi-metodo" method={method}>
        {settings.remove}
      </MethodAction>
    ) : (
      <MethodAction language={language} intent="collega-metodo" method={method}>
        {settings.connect}
      </MethodAction>
    );
  const addPasskey = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      focusableWhenDisabled
      aria-busy={pending || undefined}
      onClick={async () => {
        setPending(true);
        setError(false);
        try {
          const { authClient } = await import("../passkey-client");
          const result = await authClient.passkey.addPasskey();
          if (result.error?.status === 403) {
            window.location.assign(
              `${localizedPath(language, securityPath)}?accesso=${passkeyBlock}`,
            );
          } else if (result.error) setError(true);
          else window.location.reload();
        } catch {
          setError(true);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? (
        <Spinner
          label={settings.addPasskey}
          aria-hidden="true"
          role={undefined}
          data-icon="inline-start"
        />
      ) : (
        <KeyRound aria-hidden="true" data-icon="inline-start" />
      )}
      {settings.addPasskey}
    </Button>
  );
  const passkeys = methods.passkeys;
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-5 md:p-6">
      <EmailChange language={language} email={email} />
      <SecurityGroup id="security-methods" title={settings.methods}>
        <ul className="grid divide-y border-y">
          <MethodRow label={settings.methodPassword} status={status(methods.accounts.password)}>
            <MethodAction language={language} intent="password">
              {methods.accounts.password ? settings.changePassword : t.setPassword}
            </MethodAction>
            {methods.accounts.password ? (
              <MethodAction language={language} intent="rimuovi-metodo" method="password">
                {settings.remove}
              </MethodAction>
            ) : null}
          </MethodRow>
          <MethodRow label={settings.methodGoogle} status={status(methods.accounts.google)}>
            {oauth("google")}
          </MethodRow>
          {/* Accedere con eBay non collega un negozio, e viceversa. */}
          <MethodRow
            label={settings.methodEbay}
            status={status(methods.accounts.ebay)}
            hint={methods.accounts.ebay ? undefined : t.ebayAccessBody}
          >
            {oauth("ebay")}
          </MethodRow>
          {passkeys.length === 0 ? (
            <MethodRow
              label={settings.methodPasskey}
              status={t.passkeyEmpty}
              hint={t.passkeyRecovery}
            >
              {addPasskey}
            </MethodRow>
          ) : (
            passkeys.map((passkey, index) => (
              <MethodRow
                key={passkey.id}
                label={settings.methodPasskey}
                status={
                  passkey.createdAt
                    ? settings.passkeyItem(
                        passkey.name || settings.methodPasskey,
                        formatDate(passkey.createdAt, language),
                      )
                    : passkey.name || settings.methodConnected
                }
              >
                <form method="post" action={localizedPath(language, "/accesso")}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    name="intent"
                    value="passkey-remove"
                  >
                    {settings.remove}
                  </Button>
                </form>
                {index === passkeys.length - 1 ? addPasskey : null}
              </MethodRow>
            ))
          )}
        </ul>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {t.passkeyFailed}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{settings.lastMethod}</p>
      </SecurityGroup>
      <SessionList language={language} sessions={sessions} now={now} />
    </div>
  );
}

export function AccessNotice({
  language,
  notice,
}: {
  language: Language;
  notice: AccessNoticeView | null;
}) {
  const t = appCopy[language].access;
  // L'esito resta visibile ma esce dall'indirizzo, così una ricarica non lo ripropone.
  // Un link di recupero conserva il token e il proprio errore.
  useEffect(() => {
    const url = new URL(window.location.href);
    const before = url.search;
    url.searchParams.delete("accesso");
    url.searchParams.delete("negozio");
    if (!url.searchParams.has("token")) url.searchParams.delete("error");
    if (url.search !== before) window.history.replaceState(window.history.state, "", url);
  }, []);
  return notice ? (
    <StatusAlert tone={notice.tone} title={notice.text}>
      {notice.text === t.storeNotices["altro-spazio"] ? (
        <a href="mailto:supporto@fiscalbay.it" className="underline underline-offset-4">
          {appCopy[language].authError.support}: supporto@fiscalbay.it
        </a>
      ) : null}
    </StatusAlert>
  ) : null;
}

/**
 * Shell dell'area reale: le stesse barra e menu dell'anteprima, con le sole
 * destinazioni che esistono. La lingua sta nel menu finché non c'è Aspetto e lingua.
 */
export function AccountShell({
  language,
  account,
  security,
  children,
}: {
  language: Language;
  account: { name: string; email: string };
  /** Sicurezza è disponibile dopo la conferma dell'email. */
  security: boolean;
  children: React.ReactNode;
}) {
  const t = appCopy[language];
  const submit = useSubmit();
  const { pathname } = useLocation();
  const other: Language = language === "it" ? "en" : "it";
  const bare = pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
  return (
    <AppShell
      links={{ language, base: "" }}
      t={t}
      account={account}
      navigation={false}
      home={localizedPath(language)}
      menu={[
        ...(security
          ? [
              [
                {
                  href: localizedPath(language, securityPath),
                  label: t.shell.security,
                  Icon: ShieldCheck,
                },
              ],
            ]
          : []),
        [
          {
            href: localizedPath(other, bare),
            label: languageNames[other],
            Icon: Languages,
            lang: other,
            reloadDocument: true,
          },
        ],
      ]}
      onSignOut={() =>
        void submit(
          { intent: "esci" },
          { method: "post", action: localizedPath(language, "/accesso") },
        )
      }
    >
      {children}
    </AppShell>
  );
}
