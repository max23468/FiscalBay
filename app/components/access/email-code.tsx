import { cn } from "cn";
import { ExternalLink, MailCheck } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useCopy } from "~/components/copy-context";
import { useHydrated } from "~/components/hydrated";
import { IconTile } from "~/components/icon-tile";
import { useTurnstile } from "~/components/turnstile";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { FieldError } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";

import { accessPath, planChoiceParam } from "../../app-links";
import { localizedPath } from "../../i18n";
import { turnstileActions } from "../../turnstile";

const codeSlots = ["first", "second", "third", "fourth", "fifth", "sixth"];
const codeLength = codeSlots.length;
const resendSeconds = 30;

const mailboxes = [
  { domain: /^(gmail|googlemail)\.com$/u, name: "Gmail", url: "https://mail.google.com/" },
  {
    domain: /^(outlook|hotmail|live|msn)\.[a-z.]+$/u,
    name: "Outlook",
    url: "https://outlook.live.com/mail/",
  },
  { domain: /^(yahoo|ymail)\.[a-z.]+$/u, name: "Yahoo Mail", url: "https://mail.yahoo.com/" },
];

/** Casella web del dominio dell'indirizzo; null per i domini senza un indirizzo noto. */
function mailboxFor(email: string) {
  const domain = email.split("@").at(-1)?.trim().toLowerCase() ?? "";
  return mailboxes.find((mailbox) => mailbox.domain.test(domain)) ?? null;
}

const sizes = {
  page: { cell: "h-14 min-w-0 flex-1 rounded-lg text-2xl", group: "gap-1.5 sm:gap-2" },
  compact: { cell: "h-10 w-9 rounded-md text-base", group: "gap-1" },
};

function digits(value: string) {
  return value.replace(/\D/gu, "").slice(0, codeLength);
}

/**
 * Sei caselle sopra un solo campo trasparente, che resta il vero controllo: tastiera, incolla e
 * compilazione automatica del codice funzionano come in un campo normale. Prima dell'idratazione il
 * campo è visibile, con un pulsante, così il modulo funziona senza JavaScript.
 */
function CodeCells({
  size,
  invalid,
  describedBy,
  autoFocus,
  disabled,
}: {
  size: keyof typeof sizes;
  invalid: boolean;
  describedBy?: string;
  autoFocus: boolean;
  disabled: boolean;
}) {
  const t = useCopy().t.access;
  const hydrated = useHydrated();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const attach = useCallback(
    (field: HTMLInputElement | null) => {
      input.current = field;
      if (!hydrated || !field) return;
      // Il controllo è lo stesso del documento iniziale: recupera le cifre già inserite.
      field.value = digits(field.value);
      setCode(field.value);
      setFocused(field === document.activeElement);
    },
    [hydrated],
  );
  useEffect(() => {
    if (hydrated && autoFocus) input.current?.focus();
  }, [hydrated, autoFocus]);

  /** Tiene le sole cifre, anche da un codice incollato con spazi, e invia il modulo a sei cifre. */
  function change(event: React.FormEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    field.value = digits(field.value);
    setCode(field.value);
    if (field.value.length === codeLength) field.form?.requestSubmit();
  }

  const field = {
    name: "codice",
    "aria-label": t.emailCode,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    inputMode: "numeric",
    autoComplete: "one-time-code",
    required: true,
  } as const;
  const cell = (slot: string) => {
    const index = codeSlots.indexOf(slot);
    const digit = code[index];
    const current = focused && index === Math.min(code.length, codeLength - 1);
    return (
      <span
        key={slot}
        className={cn(
          "grid place-items-center border font-code font-semibold shadow-xs shadow-brand-navy/5 transition-[color,background-color,border-color,box-shadow] duration-(--duration-quick)",
          sizes[size].cell,
          digit ? "border-primary bg-info-surface text-primary" : "border-input bg-card",
          invalid && !digit && "border-destructive/60",
          current && "border-ring ring-3 ring-ring/30",
        )}
      >
        {digit}
      </span>
    );
  };
  return (
    <div className={hydrated ? "grid gap-2" : "flex gap-2"}>
      <div className={cn("relative min-w-0", !hydrated && "flex-1", disabled && "opacity-60")}>
        {hydrated ? (
          <div aria-hidden="true" className={cn("flex items-center", sizes[size].group)}>
            {codeSlots.slice(0, 3).map(cell)}
            <span className="h-0.5 w-2 shrink-0 rounded-full bg-border" />
            {codeSlots.slice(3).map(cell)}
          </div>
        ) : null}
        <Input
          {...field}
          ref={attach}
          readOnly={disabled}
          onInput={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Safari propone il codice soltanto se il controllo ha opacità diversa da zero.
          className={
            hydrated
              ? "absolute inset-0 size-full cursor-text rounded-none border-0 bg-transparent p-0 text-base text-transparent caret-transparent shadow-none selection:bg-transparent focus-visible:ring-0 aria-invalid:ring-0 sm:text-base dark:bg-transparent pointer-coarse:h-full"
              : "font-code tracking-[0.3em]"
          }
        />
      </div>
      {!hydrated || (code.length === codeLength && !disabled) ? (
        <Button type="submit">{t.emailCodeSubmit}</Button>
      ) : null}
    </div>
  );
}

/** Modulo del codice di conferma; senza sessione l'indirizzo arriva dal campo nascosto. */
export function EmailCodeForm({
  email,
  plan,
  size = "compact",
  error,
  autoFocus = false,
  onSubmit,
}: {
  email?: string;
  plan?: string;
  size?: keyof typeof sizes;
  error?: string | null;
  autoFocus?: boolean;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
}) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const errorId = useId();
  const [checking, setChecking] = useState(false);
  // Tornando indietro il browser può ripristinare la pagina com'era durante l'invio.
  useEffect(() => {
    const restored = () => setChecking(false);
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  return (
    <form
      method="post"
      action={localizedPath(language, accessPath)}
      className="grid gap-3"
      onSubmit={(event) => {
        onSubmit?.(event);
        if (!event.defaultPrevented) setChecking(true);
      }}
    >
      <input type="hidden" name="intent" value="conferma-codice" />
      {email ? <input type="hidden" name="email" value={email} /> : null}
      {plan ? <input type="hidden" name={planChoiceParam} value={plan} /> : null}
      <CodeCells
        size={size}
        invalid={Boolean(error)}
        describedBy={error ? errorId : undefined}
        autoFocus={autoFocus}
        disabled={checking}
      />
      {checking ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner />
          {t.emailCodeChecking}
        </p>
      ) : error ? (
        <FieldError id={errorId} role="alert" className="text-center">
          {error}
        </FieldError>
      ) : null}
    </form>
  );
}

/** Nuovo invio dentro la frase, disponibile dopo una breve attesa. */
function ResendCode({ email, plan, waiting }: { email: string; plan?: string; waiting: boolean }) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const resend = useTurnstile(turnstileActions.emailLink);
  const [seconds, setSeconds] = useState(waiting ? resendSeconds : 0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return (
    <form
      method="post"
      action={localizedPath(language, accessPath)}
      className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted-foreground"
      onSubmit={resend.submit}
    >
      <input type="hidden" name="email" value={email} />
      {plan ? <input type="hidden" name={planChoiceParam} value={plan} /> : null}
      <span>{t.emailCodeNotArrived}</span>
      {seconds > 0 ? (
        <span className="tabular-nums">{t.emailCodeResendIn(seconds)}</span>
      ) : (
        <Button
          type="submit"
          variant="link"
          name="intent"
          value="reinvia-codice"
          className="h-auto p-0"
        >
          {t.emailCodeResend}
        </Button>
      )}
      <div className="basis-full empty:hidden">{resend.field}</div>
    </form>
  );
}

/** Pagina dopo la registrazione con password: il codice è il centro, il resto lo accompagna. */
export function ConfirmEmail({
  email,
  plan,
  error,
}: {
  email: string;
  plan?: string;
  error?: string | null;
}) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const mailbox = mailboxFor(email);
  const signUp = new URLSearchParams({
    registrati: "",
    ...(plan ? { [planChoiceParam]: plan } : {}),
  });
  return (
    <div className="mx-auto grid w-full max-w-sm gap-6 py-2 text-center sm:py-4">
      <div className="grid justify-items-center gap-3">
        <IconTile icon={MailCheck} tone="blue" size="xl" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.emailCodeTitle}</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {t.emailCodeSent}
          <span className="mt-0.5 block">
            <span className="font-medium wrap-anywhere text-foreground">{email}</span>{" "}
            <a
              href={`${localizedPath(language, accessPath)}?${signUp}`}
              className="whitespace-nowrap link-underline"
            >
              {t.emailCodeChange}
            </a>
          </span>
        </p>
      </div>
      <EmailCodeForm email={email} plan={plan} size="page" error={error} autoFocus />
      <div className="grid gap-4">
        {mailbox ? (
          <a
            href={mailbox.url}
            target="_blank"
            rel="noreferrer"
            {...buttonLink({ variant: "outline", className: "w-full" })}
          >
            {t.openMailbox(mailbox.name)}
            <ExternalLink aria-hidden="true" data-icon="inline-end" />
          </a>
        ) : null}
        <ResendCode email={email} plan={plan} waiting={!error} />
        <p className="text-xs text-muted-foreground">{t.emailCodeOrLink}</p>
      </div>
    </div>
  );
}
