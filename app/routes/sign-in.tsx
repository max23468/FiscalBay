import { cn } from "cn";
import { ClipboardList, Copy, KeyRound, LogOut, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import { AccessNotice, VerifyEmail } from "~/components/access-notice";
import { Logo } from "~/components/standalone-page";
import { useFieldErrors, type FieldErrors } from "~/components/form-validation";
import { LanguageSwitch } from "~/components/language-switch";
import { SiteFooter } from "~/components/site-footer";
import { ProfileFields } from "~/components/profile-fields";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useCopy } from "~/components/copy-context";
import { accessPath, ordersPath, securityReturnPath } from "../app-links";
import { accessAction, accessLoader } from "../account-page.server";
import { appCopy, pageTitle } from "../app-copy";
import { loadPasskeyClient } from "../account/passkey";
import { passkeyFailure, type PasskeyFailure } from "../account/passkey-error";
import { languageFromPath, localizedPath, type Language } from "../i18n";
import type { Route } from "./+types/sign-in";

export function meta({ location, loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const { access } = appCopy[language];
  const title = loaderData?.authenticated
    ? access.agreementTitle
    : loaderData?.resetToken
      ? access.passwordResetTitle
      : access.signIn;
  return [{ title: pageTitle(title) }, { name: "description", content: access.description }];
}

export function loader({ request }: Route.LoaderArgs) {
  return accessLoader(request);
}

export function action({ request }: Route.ActionArgs) {
  return accessAction(request);
}

type AccessCopy = (typeof appCopy)[Language]["access"];

/** Campi da ricompilare dopo un errore; la password non viene mai conservata. */
type Remembered = { tab: string; values: Record<string, string> };

const rememberKey = "fiscalbay:accesso";

/** Salva i campi del form inviato, per ricompilarli se il server segnala un errore. */
function remember(tab: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (name !== "password" && typeof value === "string") values[name] = value;
    }
    try {
      sessionStorage.setItem(rememberKey, JSON.stringify({ tab, values }));
    } catch {
      // Senza memoria di sessione il form resta vuoto dopo l'errore.
    }
  };
}

/** Dopo un avviso di errore ripropone i valori inviati; in ogni caso li dimentica. */
function useRemembered(error: boolean) {
  const [remembered, setRemembered] = useState<Remembered | null>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(rememberKey);
      sessionStorage.removeItem(rememberKey);
      if (error && saved) setRemembered(JSON.parse(saved) as Remembered);
    } catch {
      // Valori non leggibili: il form resta vuoto.
    }
  }, [error]);
  return remembered;
}

const rise = "animate-[rise-in_var(--duration-fast)_var(--ease-smooth-out)_both]";

/** Termini obbligatori e marketing facoltativo, entrambi mai preselezionati. */
function AgreementFields({ v, values }: { v: FieldErrors; values?: Record<string, string> }) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  return (
    <div className="grid gap-4 rounded-lg bg-muted/50 p-3">
      <FieldLabel className="font-normal" required>
        <Checkbox
          name="termini"
          required
          defaultChecked={values?.termini === "on"}
          aria-labelledby="terms-label"
          {...v.control("termini")}
        />
        <span id="terms-label">
          {t.terms.before}
          <a href={localizedPath(language, "/termini")} className="underline underline-offset-4">
            {t.terms.terms}
          </a>
          {t.terms.middle}
          <a href={localizedPath(language, "/privacy")} className="underline underline-offset-4">
            {t.terms.privacy}
          </a>
          {t.terms.after}
        </span>
      </FieldLabel>
      {v.error("termini")}
      <Field orientation="horizontal">
        <Checkbox
          id="marketing"
          name="marketing"
          defaultChecked={values?.marketing === "on"}
          aria-labelledby="marketing-label"
          aria-describedby="marketing-hint"
        />
        <FieldContent>
          <FieldLabel id="marketing-label" htmlFor="marketing" className="font-normal">
            {t.marketing}
          </FieldLabel>
          <FieldDescription id="marketing-hint">{t.marketingHint}</FieldDescription>
        </FieldContent>
      </Field>
    </div>
  );
}

/** Marchio dal kit ufficiale dei pulsanti di accesso eBay, con proporzioni conservate. */
function EbayMark() {
  return (
    <img
      src="/ebay-logo.svg"
      alt=""
      aria-hidden="true"
      width="32"
      height="13"
      className="h-auto w-8 shrink-0"
    />
  );
}

function ReturnToField() {
  const { language } = useCopy();
  const { search } = useLocation();
  const target = securityReturnPath(language, new URLSearchParams(search).get("returnTo"));
  return target ? <input type="hidden" name="returnTo" value={target} /> : null;
}

function SocialForms() {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  return (
    <form method="post" action={localizedPath(language, "/accesso")} className="grid gap-2">
      <ReturnToField />
      <Button type="submit" variant="outline" name="intent" value="google" className="w-full">
        <GoogleMark />
        {t.google}
      </Button>
      <Button type="submit" variant="outline" name="intent" value="ebay" className="w-full">
        <EbayMark />
        {t.ebay}
      </Button>
    </form>
  );
}

function PasskeyButton() {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PasskeyFailure | null>(null);
  const { search } = useLocation();
  const target = securityReturnPath(language, new URLSearchParams(search).get("returnTo"));
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const authClient = await loadPasskeyClient();
            if (!authClient) {
              setError("unsupported");
              return;
            }
            const result = await authClient.signIn.passkey();
            if (result.error) setError(passkeyFailure(result.error));
            else window.location.assign(target ?? localizedPath(language, ordersPath));
          } catch (failure) {
            setError(passkeyFailure(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <KeyRound aria-hidden="true" data-icon="inline-start" />
        {t.passkeySignIn}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t.passkeyErrors[error]}
        </p>
      ) : null}
    </div>
  );
}

/** Marchio Google nei colori ufficiali, come richiesto dalle linee guida del pulsante. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" data-icon="inline-start" className="size-4">
      <path
        fill="#4285F4"
        d="m23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="m12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="m5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path
        fill="#EA4335"
        d="m12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function OrSeparator() {
  const t = useCopy().t.access;
  return (
    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
      {t.or}
    </FieldSeparator>
  );
}

function SignInAlternatives({ recovering }: { recovering: boolean }) {
  if (recovering) return null;
  return (
    <>
      <OrSeparator />
      <div className="grid gap-2">
        <SocialForms />
        <PasskeyButton />
      </div>
    </>
  );
}

/** Un solo form visibile evita che il browser compili i campi dell'altra scheda. */
function AccessForms({
  remembered,
  initialTab,
  signUpBody,
}: {
  remembered: Remembered | null;
  initialTab: string;
  signUpBody: string;
}) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const [tab, setTab] = useState(initialTab);
  const [recovering, setRecovering] = useState(false);
  const [restored, setRestored] = useState<Remembered | null>(null);
  if (remembered && remembered !== restored) {
    setRestored(remembered);
    setTab(remembered.tab);
  }
  const values = restored?.values;
  const signIn = useFieldErrors(t.validation);
  const signUp = useFieldErrors(t.validation);
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        setTab(String(next));
        setRecovering(false);
      }}
      className="gap-4"
    >
      <TabsList aria-label={t.choose} className="w-full">
        <TabsTrigger value="accedi">{t.signIn}</TabsTrigger>
        <TabsTrigger value="registrati">{t.signUp}</TabsTrigger>
      </TabsList>
      <TabsContent value="accedi" keepMounted className={cn("grid gap-3", rise)}>
        {recovering ? <p className="text-muted-foreground">{t.passwordRecoveryBody}</p> : null}
        <form
          key={restored ? "restored" : "empty"}
          method="post"
          action={localizedPath(language, "/accesso")}
          {...signIn.form}
          onSubmit={(event) => {
            if (signIn.check(event)) remember("accedi")(event);
          }}
        >
          <FieldGroup className="gap-3">
            <ReturnToField />
            <Field>
              <FieldLabel htmlFor="email" required>
                {t.email}
              </FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                defaultValue={restored?.tab === "accedi" ? values?.email : undefined}
                required
                {...signIn.control("email")}
              />
              {signIn.error("email")}
            </Field>
            {recovering ? null : (
              <Field>
                <FieldLabel htmlFor="password" required>
                  {t.password}
                </FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  {...signIn.control("password")}
                />
                {signIn.error("password")}
              </Field>
            )}
            <Button
              type="submit"
              className="w-full"
              name={recovering ? "intent" : undefined}
              value={recovering ? "recupera-password" : undefined}
            >
              {recovering ? t.passwordRecoverySend : t.signIn}
            </Button>
          </FieldGroup>
        </form>
        <Button
          type="button"
          variant="link"
          className="h-auto w-fit px-0 py-1"
          onClick={() => setRecovering(!recovering)}
        >
          {recovering ? t.backToSignIn : t.passwordRecovery}
        </Button>
        <SignInAlternatives recovering={recovering} />
      </TabsContent>
      <TabsContent value="registrati" keepMounted className={cn("grid gap-5", rise)}>
        <p className="text-muted-foreground">{signUpBody}</p>
        <form
          key={restored ? "restored" : "empty"}
          method="post"
          action={localizedPath(language, "/accesso")}
          {...signUp.form}
          onSubmit={(event) => {
            if (signUp.check(event)) remember("registrati")(event);
          }}
        >
          <FieldGroup>
            <ProfileFields
              v={signUp}
              values={restored?.tab === "registrati" ? values : undefined}
            />
            <Field>
              <FieldLabel htmlFor="signup-email" required>
                {t.email}
              </FieldLabel>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={restored?.tab === "registrati" ? values?.email : undefined}
                required
                {...signUp.control("email")}
              />
              {signUp.error("email")}
            </Field>
            <Field>
              <FieldLabel htmlFor="signup-password" required>
                {t.newPassword}
              </FieldLabel>
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                {...signUp.control("password")}
              />
              {signUp.error("password")}
            </Field>
            <AgreementFields
              v={signUp}
              values={restored?.tab === "registrati" ? values : undefined}
            />
            <Button type="submit" name="intent" value="registrati" className="w-full">
              {t.signUp}
            </Button>
          </FieldGroup>
        </form>
        <OrSeparator />
        <SocialForms />
      </TabsContent>
    </Tabs>
  );
}

function ResetPassword({ token }: { token: string }) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const v = useFieldErrors(t.validation);
  return (
    <form
      method="post"
      action={localizedPath(language, "/accesso")}
      className="grid gap-4"
      {...v.form}
      onSubmit={(event) => void v.check(event)}
    >
      <h2 className="text-xl font-semibold">{t.passwordResetTitle}</h2>
      <input type="hidden" name="token" value={token} />
      <ReturnToField />
      <Field>
        <FieldLabel htmlFor="reset-password" required>
          {t.newPassword}
        </FieldLabel>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          {...v.control("password")}
        />
        {v.error("password")}
      </Field>
      <Button type="submit" name="intent" value="reimposta-password">
        {t.passwordRecoveryConfirm}
      </Button>
      <a
        href={localizedPath(language, accessPath)}
        className="w-fit text-sm text-primary underline underline-offset-4"
      >
        {t.backToSignIn}
      </a>
    </form>
  );
}

/** Passaggio per chi ha una sessione ma non ha ancora profilo o Termini correnti. */
function CompleteRegistration({
  needsProfile,
  needsAgreement,
  suggestedName,
  remembered,
}: {
  needsProfile: boolean;
  needsAgreement: boolean;
  suggestedName: { firstName: string; lastName: string };
  remembered: Remembered | null;
}) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const values = remembered?.tab === "completa" ? remembered.values : undefined;
  const v = useFieldErrors(t.validation);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">{t.agreementTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.agreementBody}</p>
      </div>
      <form
        key={values ? "restored" : "empty"}
        method="post"
        action={localizedPath(language, "/accesso")}
        {...v.form}
        onSubmit={(event) => {
          if (v.check(event)) remember("completa")(event);
        }}
      >
        <FieldGroup>
          {needsProfile ? <ProfileFields v={v} values={values} suggested={suggestedName} /> : null}
          {needsAgreement ? <AgreementFields v={v} values={values} /> : null}
          <Button type="submit" name="intent" value="completa" className="w-full">
            {t.agreementSubmit}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

function SignOutForm() {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  return (
    <form method="post" action={localizedPath(language, "/accesso")}>
      <Button type="submit" variant="outline" name="intent" value="esci">
        <LogOut aria-hidden="true" data-icon="inline-start" />
        {t.signOut}
      </Button>
    </form>
  );
}

const featureIcons = [
  { Icon: ClipboardList, className: "text-brand-sky" },
  { Icon: Copy, className: "text-[#f5c451]" },
  { Icon: Store, className: "text-[#5fd0c9]" },
];

/** Colonna del marchio: cosa fa FiscalBay, con i colori del logo. */
function BrandPanel() {
  const t = useCopy().t.access;
  return (
    <aside className="relative hidden overflow-hidden bg-brand-navy text-white lg:flex lg:flex-col lg:gap-12 lg:p-12 xl:p-16">
      {/* Righe della tessera del logo, grandi e sfumate, come fondo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-16 grid rotate-[-8deg] gap-6 opacity-25"
      >
        <span className="h-8 w-[28rem] rounded-full bg-brand-sky" />
        <span className="h-8 w-80 rounded-full bg-brand-green" />
        <span className="h-8 w-40 rounded-full bg-brand-red" />
      </div>
      <Logo onDark className="relative h-8 w-fit" />
      <div className={cn("relative grid max-w-md gap-8", rise)}>
        <p className="text-3xl leading-tight font-semibold text-balance xl:text-4xl">
          {t.headline}
        </p>
        <ul className="grid gap-5">
          {t.features.map((feature, index) => {
            const { Icon, className } = featureIcons[index]!;
            return (
              <li key={feature.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10"
                >
                  <Icon className={cn("size-5", className)} />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{feature.title}</span>
                  <span className="text-sm leading-relaxed text-white/75">{feature.body}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

const errorTones = new Set(["danger", "warning"]);

function AccessPanel({
  loaderData,
  remembered,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
  remembered: Remembered | null;
}) {
  const { t: copy } = useCopy();
  const t = copy.access;
  if (loaderData.authenticated) {
    return (
      <CompleteRegistration
        needsProfile={loaderData.needsProfile}
        needsAgreement={loaderData.needsAgreement}
        suggestedName={loaderData.suggestedName}
        remembered={remembered}
      />
    );
  }
  if (loaderData.resetToken) {
    return <ResetPassword token={loaderData.resetToken} />;
  }
  return (
    <AccessForms
      remembered={remembered}
      initialTab={loaderData.tab}
      signUpBody={loaderData.registrationRestricted ? t.registrationRestricted : t.signUpBody}
    />
  );
}

function accessHeading(loaderData: Awaited<ReturnType<typeof loader>>, t: AccessCopy) {
  if (loaderData.authenticated) return t.agreementTitle;
  return loaderData.resetToken ? t.passwordResetTitle : t.choose;
}

/** Accesso, registrazione e completamento: marchio a sinistra, form a destra. */
export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { language, notice } = loaderData;
  const t = appCopy[language].access;
  const remembered = useRemembered(notice !== null && errorTones.has(notice.tone));
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <main className="flex flex-col px-4 py-4 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Logo className="h-7 w-auto lg:invisible" />
          <LanguageSwitch
            label={t.language}
            current={language}
            hrefFor={(code) => localizedPath(code, accessPath)}
            reloadDocument
          />
        </header>
        <div
          className={cn(
            "mx-auto grid w-full flex-1 gap-4 py-4 sm:max-w-md",
            !loaderData.authenticated && loaderData.resetToken
              ? "content-start lg:content-center"
              : "content-center",
          )}
        >
          <div className="grid gap-2 lg:hidden">
            <p className="text-2xl font-semibold text-balance">{t.headline}</p>
          </div>
          <h1 className="sr-only">{accessHeading(loaderData, t)}</h1>
          <AccessNotice notice={notice} />
          {loaderData.authenticated ? (
            <VerifyEmail email={loaderData.email} verified={loaderData.emailVerified} />
          ) : null}
          <div className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", rise)}>
            <p className="mb-3 text-sm text-muted-foreground">{t.requiredFields}</p>
            <AccessPanel loaderData={loaderData} remembered={remembered} />
          </div>
          {loaderData.authenticated ? <SignOutForm /> : null}
        </div>
        <SiteFooter className="w-full pb-2 sm:max-w-md" />
      </main>
    </div>
  );
}
