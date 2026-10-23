import {
  ClipboardList,
  CreditCard,
  Globe,
  KeyRound,
  Languages,
  Settings,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useFetcher, useLocation, useRevalidator, useSubmit } from "react-router";

import { AppShell } from "~/components/app-shell";
import { useFieldErrors } from "~/components/form-validation";
import { StatusAlert } from "~/components/status";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import type { ActiveSession } from "../domain/sessions.server";
import type { ConfirmResult } from "../security-actions.server";
import type { SignInMethods } from "../domain/sign-in-methods.server";
import type { PendingEmailChange } from "../domain/email-change.server";
import { passkeyFailure, type PasskeyFailure } from "../account/passkey-error";
import type { AccessNoticeView } from "../access-notice";
import { appCopy } from "../app-copy";
import { deviceName } from "../account/device-name";
import {
  accessPath,
  appBase,
  appHref,
  languagePath,
  notificationsPath,
  orderSearchPath,
  securityPath,
  visitParam,
} from "../app-links";
import { languageNames, localizedPath, type Language } from "../i18n";
import { detectedTimeZone, timeZoneCookie, type ShellData } from "../preferences";
import { formatDate, formatRelative } from "../view-models";
import { useTimeZone } from "~/components/time-zone";

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
    <li className="flex flex-col items-start gap-x-4 gap-y-2 py-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <span className="grid min-w-0 max-w-full md:flex-1 md:basis-48">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span id={`${id}-status`} className="text-sm wrap-anywhere text-muted-foreground">
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
  id,
  label,
  simulated = false,
  actionPath,
  disabled = false,
  children,
}: {
  language: Language;
  intent: string;
  method?: string;
  id?: string;
  label?: string;
  simulated?: boolean;
  actionPath?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const destructive = intent === "rimuovi-metodo" || intent === "passkey-remove";
  const [open, setOpen] = useState(false);
  const t = appCopy[language];
  const form = (
    <form
      method="post"
      action={actionPath ?? localizedPath(language, accessPath)}
      onSubmit={simulated ? () => setOpen(false) : undefined}
    >
      {method ? <input type="hidden" name="metodo" value={method} /> : null}
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <Button
        type="submit"
        variant={destructive ? "destructive-solid" : "outline"}
        size="sm"
        name="intent"
        value={intent}
        disabled={disabled}
      >
        {children}
      </Button>
    </form>
  );
  if (!destructive) return form;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" size="sm" disabled={disabled} />}
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.settings.removeMethodTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.settings.removeMethodBody(label ?? t.settings.methodPasskey)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.orders.cancel}</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
function PasskeyRename({
  passkey,
  language,
  actionPath,
}: {
  passkey: SignInMethods["passkeys"][number];
  language: Language;
  actionPath: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { settings, orders } = appCopy[language];
  const trigger = useRef<HTMLButtonElement>(null);
  return open ? (
    <form method="post" action={actionPath} className="grid w-full gap-2">
      <input type="hidden" name="id" value={passkey.id} />
      <FieldLabel htmlFor={id}>{settings.passkeyName}</FieldLabel>
      <Input
        id={id}
        name="name"
        defaultValue={passkey.name ?? ""}
        required
        maxLength={80}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" name="intent" value="passkey-rename">
          {settings.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            flushSync(() => setOpen(false));
            trigger.current?.focus();
          }}
        >
          {orders.cancel}
        </Button>
      </div>
    </form>
  ) : (
    <Button ref={trigger} type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
      {settings.renamePasskey}
    </Button>
  );
}

function EmailChange({
  language,
  email,
  actionPath,
  pendingEmail,
}: {
  language: Language;
  email: string;
  actionPath: string;
  pendingEmail?: PendingEmailChange | null;
}) {
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
      {pendingEmail ? (
        <div role="status" className="grid gap-2 rounded-lg border p-3 text-sm">
          <p>{profile.emailPending(pendingEmail.new_email)}</p>
          <p className="text-muted-foreground">
            {pendingEmail.stage === "new" ? profile.emailPendingNew : profile.emailPendingCurrent}
          </p>
          <form method="post" action={actionPath}>
            <Button type="submit" variant="outline" size="sm" name="intent" value="reinvia-email">
              {profile.emailRestart}
            </Button>
          </form>
        </div>
      ) : null}
      {open ? (
        <form
          method="post"
          action={actionPath}
          className="grid gap-3"
          {...v.form}
          onSubmit={(event) => void v.check(event)}
        >
          <Field>
            <FieldLabel htmlFor="new-email" required>
              {t.newEmail}
            </FieldLabel>
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
          <p className="text-sm text-muted-foreground">{t.requiredFields}</p>
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
  actionPath,
}: {
  language: Language;
  sessions: ActiveSession[];
  now: string;
  actionPath: string;
}) {
  const zone = useTimeZone();
  const { settings } = appCopy[language];
  return (
    <SecurityGroup id="security-sessions" title={settings.sessions}>
      <ul className="grid divide-y border-t">
        {sessions.map((session) => (
          <MethodRow
            key={session.id}
            label={session.device}
            hint={
              session.createdAt
                ? settings.sessionOpened(formatDate(session.createdAt, language, "dateTime", zone))
                : undefined
            }
            status={
              session.current
                ? settings.thisDevice
                : settings.lastActive(formatRelative(session.lastActiveAt, now, language))
            }
          >
            {session.current ? null : (
              <form method="post" action={actionPath}>
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
        <form method="post" action={actionPath}>
          <Button type="submit" variant="destructive" name="intent" value="esci-altri">
            {settings.signOutAll}
          </Button>
        </form>
      ) : null}
    </SecurityGroup>
  );
}

function AddPasskey({
  language,
  block,
  guard,
  onAction,
}: {
  language: Language;
  block: string;
  /** Chiede prima la conferma dell'identità, quando serve. */
  guard: (intent: string, run: () => void) => void;
  onAction?: (intent: string, fields: Record<string, string>) => void;
}) {
  const { access: t, settings } = appCopy[language];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PasskeyFailure | null>(null);
  const [name, setName] = useState("");
  const id = useId();
  const add = async () => {
    if (onAction) {
      onAction("passkey-add", {});
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (!window.PublicKeyCredential) {
        setError("unsupported");
        return;
      }
      const { authClient } = await import("../account/passkey-client");
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || deviceName(navigator.userAgent, language),
      });
      if (result.error?.status === 403)
        window.location.assign(`${localizedPath(language, securityPath)}?accesso=${block}`);
      else if (result.error) setError(passkeyFailure(result.error));
      else window.location.reload();
    } catch (failure) {
      setError(passkeyFailure(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="grid w-full gap-2">
      {!onAction ? (
        <Field>
          <FieldLabel htmlFor={id}>{settings.passkeyName}</FieldLabel>
          <Input
            id={id}
            aria-describedby={`${id}-hint`}
            maxLength={80}
            value={name}
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldDescription id={`${id}-hint`}>{settings.passkeyNameHint}</FieldDescription>
        </Field>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        onClick={() => guard("passkey-add", () => void add())}
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
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t.passkeyErrors[error]}
        </p>
      ) : null}
    </div>
  );
}

/** Azioni che richiedono un accesso recente, oppure la conferma con passkey per un admin. */
const recentIntents = new Set([
  "collega-metodo",
  "rimuovi-metodo",
  "cambia-email",
  "reinvia-email",
]);
const passkeyIntents = new Set(["passkey-remove", "passkey-rename", "passkey-add"]);

/**
 * Conferma dell'identità sul posto, quando l'ultimo accesso è più vecchio di 24 ore: password
 * o passkey aprono una sessione nuova senza lasciare la pagina, poi la modifica prosegue. Chi
 * accede soltanto con Google o eBay esce e rientra. Per le passkey di un admin vale solo la
 * passkey.
 */
function ConfirmIdentity({
  language,
  methods,
  passkeyOnly,
  actionPath,
  currentSession,
  simulated,
  onConfirmed,
  onCancel,
}: {
  language: Language;
  methods: SignInMethods;
  passkeyOnly: boolean;
  actionPath: string;
  currentSession: string | null;
  simulated: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const t = appCopy[language].access;
  const fetcher = useFetcher<ConfirmResult>();
  const [passkeyError, setPasskeyError] = useState<PasskeyFailure | null>(null);
  const [pending, setPending] = useState(false);
  const handled = useRef<ConfirmResult | undefined>(undefined);
  const id = useId();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok) onConfirmed();
    // Una passkey di un altro account ha aperto la sua sessione: la pagina si rilegge.
    else if (fetcher.formData === undefined && pending) window.location.reload();
  }, [result, onConfirmed, fetcher.formData, pending]);
  const password = methods.accounts.password && !passkeyOnly;
  const passkey = methods.passkeys.length > 0;
  const confirmWithPasskey = async () => {
    if (simulated) return onConfirmed();
    setPasskeyError(null);
    setPending(true);
    try {
      if (!window.PublicKeyCredential) return setPasskeyError("unsupported");
      const { authClient } = await import("../account/passkey-client");
      const signed = await authClient.signIn.passkey();
      if (signed.error) return setPasskeyError(passkeyFailure(signed.error));
      void fetcher.submit(
        { intent: "conferma-accesso", metodo: "passkey", precedente: currentSession ?? "" },
        { method: "post", action: actionPath },
      );
    } catch (failure) {
      setPasskeyError(passkeyFailure(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {passkeyOnly ? t.confirmPasskeyBody : t.confirmBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {password ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (simulated) return onConfirmed();
              const value = String(new FormData(event.currentTarget).get("password") ?? "");
              void fetcher.submit(
                { intent: "conferma-accesso", metodo: "password", password: value },
                { method: "post", action: actionPath },
              );
            }}
          >
            <FieldLabel htmlFor={`${id}-password`}>{t.password}</FieldLabel>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={result?.ok === false || undefined}
              aria-describedby={result?.ok === false ? `${id}-error` : undefined}
            />
            {result?.ok === false ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-danger">
                {result.notice}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="w-fit"
              disabled={fetcher.state !== "idle"}
              aria-busy={fetcher.state !== "idle" || undefined}
            >
              {t.confirm}
            </Button>
          </form>
        ) : null}
        {passkey ? (
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={pending || fetcher.state !== "idle"}
              onClick={() => void confirmWithPasskey()}
            >
              <KeyRound aria-hidden="true" data-icon="inline-start" />
              {t.confirmPasskey}
            </Button>
            {passkeyError ? (
              <p role="alert" className="text-sm text-danger">
                {t.passkeyErrors[passkeyError]}
              </p>
            ) : null}
          </div>
        ) : null}
        {passkeyOnly ? null : (
          <div className="grid justify-items-start gap-2 text-sm text-muted-foreground">
            <p>{t.confirmOther}</p>
            <form method="post" action={actionPath}>
              <input
                type="hidden"
                name="returnTo"
                value={`${localizedPath(language, securityPath)}#security-methods`}
              />
              <Button type="submit" variant="outline" size="sm" name="intent" value="riautentica">
                {t.signOutSignIn}
              </Button>
            </form>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{appCopy[language].orders.cancel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AccountSecurity({
  language,
  email,
  methods,
  sessions,
  now,
  passkeyBlock,
  recent = true,
  passkeyRestriction = null,
  pendingEmail = null,
  onAction,
  className = "grid gap-4 rounded-xl border bg-card p-5 md:p-6",
}: {
  language: Language;
  email: string;
  methods: SignInMethods;
  sessions: ActiveSession[];
  now: string;
  passkeyBlock: string;
  recent?: boolean;
  passkeyRestriction?: "conferma-passkey" | "nuovo-accesso" | null;
  pendingEmail?: PendingEmailChange | null;
  /** L'anteprima risponde con la propria azione simulata, senza chiamare Auth. */
  onAction?: (intent: string, fields: Record<string, string>) => void;
  className?: string;
}) {
  const zone = useTimeZone();
  const { access: t, settings } = appCopy[language];
  const { pathname } = useLocation();
  // Anche senza JavaScript i form dell'anteprima restano nella route simulata.
  const actionPath = onAction ? pathname : localizedPath(language, securityPath);
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
    connected ? settings.methodConnected : settings.methodNotConnected;
  const oauth = (method: "google" | "ebay") =>
    methods.accounts[method] ? (
      <MethodAction
        language={language}
        intent="rimuovi-metodo"
        method={method}
        label={method === "google" ? settings.methodGoogle : settings.methodEbay}
        simulated={!!onAction}
        actionPath={actionPath}
        disabled={lastMethod}
      >
        {settings.remove}
      </MethodAction>
    ) : (
      <MethodAction
        language={language}
        intent="collega-metodo"
        method={method}
        actionPath={actionPath}
      >
        {settings.connect}
      </MethodAction>
    );
  const addPasskey = (
    <AddPasskey language={language} block={passkeyBlock} guard={guard} onAction={onAction} />
  );
  const passkeys = methods.passkeys;
  return (
    <div
      className={className}
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
      onSubmit={
        onAction
          ? (event) => {
              if (event.defaultPrevented) return;
              event.preventDefault();
              const form = event.target as HTMLFormElement;
              const fields = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
              const values: Record<string, string> = {};
              for (const [key, value] of fields) if (typeof value === "string") values[key] = value;
              onAction(values.intent ?? "", values);
            }
          : undefined
      }
    >
      {waiting ? (
        <ConfirmIdentity
          language={language}
          methods={methods}
          passkeyOnly={waiting.passkeyOnly}
          actionPath={actionPath}
          currentSession={sessions.find((session) => session.current)?.id ?? null}
          simulated={!!onAction}
          onConfirmed={() => {
            const { run } = waiting;
            flushSync(() => {
              setConfirmed(true);
              setWaiting(null);
            });
            run();
          }}
          onCancel={() => setWaiting(null)}
        />
      ) : null}
      <EmailChange
        language={language}
        email={email}
        actionPath={actionPath}
        pendingEmail={pendingEmail}
      />
      <SecurityGroup id="security-methods" title={settings.methods}>
        {lastMethod ? (
          <p role="status" className="text-sm text-warning">
            {settings.addAlternative}
          </p>
        ) : null}
        <ul className="grid divide-y border-y">
          <MethodRow label={settings.methodPassword} status={status(methods.accounts.password)}>
            <MethodAction language={language} intent="password" actionPath={actionPath}>
              {methods.accounts.password ? settings.changePassword : t.setPassword}
            </MethodAction>
            {methods.accounts.password ? (
              <MethodAction
                language={language}
                intent="rimuovi-metodo"
                method="password"
                label={settings.methodPassword}
                simulated={!!onAction}
                actionPath={actionPath}
                disabled={lastMethod}
              >
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
            passkeys.map((passkey) => (
              <MethodRow
                key={passkey.id}
                label={settings.methodPasskey}
                status={
                  passkey.createdAt
                    ? settings.passkeyItem(
                        passkey.name || settings.methodPasskey,
                        formatDate(passkey.createdAt, language, "dateTime", zone),
                      )
                    : passkey.name || settings.methodConnected
                }
              >
                <MethodAction
                  language={language}
                  intent="passkey-remove"
                  id={passkey.id}
                  label={passkey.name || settings.methodPasskey}
                  simulated={!!onAction}
                  actionPath={actionPath}
                  disabled={lastMethod}
                >
                  {settings.remove}
                </MethodAction>
                <PasskeyRename passkey={passkey} language={language} actionPath={actionPath} />
              </MethodRow>
            ))
          )}
        </ul>
        {passkeys.length > 0 ? <div className="max-w-xl">{addPasskey}</div> : null}
        <p className="text-sm text-muted-foreground">{settings.lastMethod}</p>
      </SecurityGroup>
      <SessionList language={language} sessions={sessions} now={now} actionPath={actionPath} />
    </div>
  );
}

function SignInAgain({ language, inSecurity }: { language: Language; inSecurity: boolean }) {
  return (
    <form method="post" action={localizedPath(language, inSecurity ? securityPath : accessPath)}>
      {inSecurity ? (
        <input
          type="hidden"
          name="returnTo"
          value={`${localizedPath(language, securityPath)}#security-methods`}
        />
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        name="intent"
        value={inSecurity ? "riautentica" : "esci"}
      >
        {appCopy[language].access.signOutSignIn}
      </Button>
    </form>
  );
}

/** Avviso di verifica dell'email, finché l'indirizzo non è confermato. */
export function VerifyEmail({
  language,
  email,
  verified,
}: {
  language: Language;
  email: string;
  verified: boolean;
}) {
  const t = appCopy[language].access;
  return verified ? null : (
    <StatusAlert tone="warning" title={t.verifyTitle}>
      <p>{t.verifyBody(email)}</p>
      <form method="post" action={localizedPath(language, accessPath)} className="mt-2">
        <Button type="submit" variant="outline" size="sm" name="intent" value="verifica">
          {t.verifyResend}
        </Button>
      </form>
    </StatusAlert>
  );
}

export function AccessNotice({
  language,
  notice,
  showSignInAgain = true,
}: {
  language: Language;
  notice: AccessNoticeView | null;
  showSignInAgain?: boolean;
}) {
  const t = appCopy[language].access;
  const { pathname } = useLocation();
  const inSecurity = pathname === localizedPath(language, securityPath);
  const banner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) banner.current?.focus();
  }, [notice]);
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
  const elsewhere = notice?.text === t.storeNotices["altro-spazio"];
  return notice ? (
    <div ref={banner} tabIndex={-1} className="outline-none">
      <StatusAlert
        tone={notice.tone}
        // Il testo dell'esito ripete la spiegazione: qui serve solo il titolo breve.
        title={elsewhere ? appCopy[language].stores.elsewhereTitle : notice.text}
      >
        {showSignInAgain &&
        (notice.text === t.signInNotices["nuovo-accesso"] ||
          notice.text === t.signInNotices["conferma-passkey"]) ? (
          <SignInAgain language={language} inSecurity={inSecurity} />
        ) : null}
        {elsewhere ? (
          <span className="grid gap-2">
            <span>{appCopy[language].stores.elsewhereBody}</span>
            <a href="mailto:supporto@fiscalbay.it" className="underline underline-offset-4">
              {appCopy[language].authError.support}: supporto@fiscalbay.it
            </a>
          </span>
        ) : null}
      </StatusAlert>
    </div>
  ) : null;
}

/**
 * Shell dell'area reale: le stesse barra e menu dell'anteprima, con le sole destinazioni che
 * esistono. Prima della conferma dell'email le Impostazioni non sono raggiungibili e la lingua
 * resta nel menu.
 */
export function AccountShell({
  language,
  account,
  security,
  shell,
  searchQuery = null,
  children,
}: {
  language: Language;
  account: { name: string; email: string };
  /** Dopo la conferma dell'email: navigazione, ricerca ordini, campanella e Impostazioni. */
  security: boolean;
  shell?: ShellData;
  /** Ricerca attiva della pagina Ordini; null nelle altre pagine. */
  searchQuery?: string | null;
  children: React.ReactNode;
}) {
  const t = appCopy[language];
  const submit = useSubmit();
  const revalidator = useRevalidator();
  const { pathname, search } = useLocation();
  // Il fuso del dispositivo arriva al server in un cookie; quando cambia, le date si rileggono.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || detectedTimeZone(document.cookie) === zone) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${timeZoneCookie}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    void revalidator.revalidate();
  }, [revalidator]);
  // La ricerca resta nell'ambiente eBay mostrato, che sul test può essere la Sandbox.
  const sandbox = new URLSearchParams(search).get("environment") === "sandbox";
  const other: Language = language === "it" ? "en" : "it";
  const links = { language, base: appBase };
  return (
    <AppShell
      links={links}
      t={t}
      account={account}
      notifications={security ? (shell?.notifications ?? undefined) : undefined}
      notificationsAction={notificationsPath}
      now={shell?.now}
      navigation={
        security
          ? [
              { href: appHref(links, "ordini"), label: t.shell.orders, Icon: ClipboardList },
              { href: appHref(links, "negozi"), label: t.shell.stores, Icon: Store },
              { href: appHref(links, "impostazioni"), label: t.shell.settings, Icon: Settings },
            ]
          : []
      }
      home={appHref(links, "ordini")}
      search={
        security
          ? {
              action: `${orderSearchPath}${sandbox ? "?environment=sandbox" : ""}`,
              query: searchQuery,
            }
          : undefined
      }
      menu={[
        ...(security
          ? [
              [
                { href: appHref(links, "profilo"), label: t.shell.profile, Icon: User },
                {
                  href: localizedPath(language, securityPath),
                  label: t.shell.security,
                  Icon: ShieldCheck,
                },
                {
                  href: appHref(links, "impostazioni/piano"),
                  label: t.shell.planBilling,
                  Icon: CreditCard,
                },
                { href: appHref(links, "impostazioni"), label: t.shell.settings, Icon: Settings },
              ],
            ]
          : []),
        [
          ...(security
            ? []
            : [
                {
                  href: languagePath,
                  label: languageNames[other],
                  Icon: Languages,
                  lang: other,
                  onSelect: () =>
                    void submit(
                      { language: other, returnTo: `${pathname}${search}` },
                      { method: "post", action: languagePath },
                    ),
                },
              ]),
          {
            href: `${localizedPath(language)}?${visitParam}=1`,
            label: t.shell.visitSite,
            Icon: Globe,
            reloadDocument: true,
          },
        ],
      ]}
      onSignOut={() =>
        void submit(
          { intent: "esci" },
          { method: "post", action: localizedPath(language, accessPath) },
        )
      }
    >
      {children}
    </AppShell>
  );
}
