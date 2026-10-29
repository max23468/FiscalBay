import { cn } from "cn";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";

import { BrandPanel } from "~/components/access/brand-panel";
import { EbayMark, GoogleMark } from "~/components/access/marks";
import { PasskeyButton } from "~/components/access/passkey-button";
import { rise } from "~/components/access/rise";
import { AccessNotice, VerifyEmail } from "~/components/access-notice";
import { DeleteAccount } from "~/components/delete-account";
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
import { useTurnstile } from "~/components/turnstile";
import { accessPath, privacyPath, securityReturnPath, termsPath } from "../app-links";
import { areaPage } from "../account-area.server";
import { accessAction, accessLoader } from "../account-page.server";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath, localizedPath, type Language } from "../i18n";
import { maxPasswordLength, minPasswordLength } from "../limits";
import { turnstileActions } from "../turnstile";
import type { Route } from "./+types/sign-in";
import { pageHeaders } from "../request-limits.server";

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

// Con Auth o database non disponibili l'accesso risponde 503 senza dati, come l'area.
export function loader({ request }: Route.LoaderArgs) {
  return areaPage(request, () => accessLoader(request));
}

export const headers = pageHeaders;

export function action({ request }: Route.ActionArgs) {
  return areaPage(request, () => accessAction(request));
}

type AccessCopy = (typeof appCopy)[Language]["access"];

/** Campi inviati da ricompilare dopo un errore, senza la password. */
type Remembered = { tab: string; values: Record<string, string> };

/** Ritorno alla Sicurezza chiesto dall'indirizzo, soltanto fra quelli ammessi. */
function useReturnTo() {
  const { language } = useCopy();
  const { search } = useLocation();
  return securityReturnPath(language, new URLSearchParams(search).get("returnTo"));
}

/** Indirizzo dei moduli: conserva il ritorno alla Sicurezza anche quando l'errore resta qui. */
function useAccessAction() {
  const { language } = useCopy();
  const returnTo = useReturnTo();
  const path = localizedPath(language, accessPath);
  return returnTo ? `${path}?${new URLSearchParams({ returnTo })}` : path;
}

/**
 * Termini obbligatori e marketing facoltativo, entrambi mai preselezionati. Il marketing manca
 * per chi ha già una scelta, che si cambia dalle Impostazioni.
 */
function AgreementFields({
  v,
  values,
  marketing = true,
}: {
  v: FieldErrors;
  values?: Record<string, string>;
  marketing?: boolean;
}) {
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
          <a href={localizedPath(language, termsPath)} className="underline underline-offset-4">
            {t.terms.terms}
          </a>
          {t.terms.middle}
          <a href={localizedPath(language, privacyPath)} className="underline underline-offset-4">
            {t.terms.privacy}
          </a>
          {t.terms.after}
        </span>
      </FieldLabel>
      {v.error("termini")}
      {marketing ? (
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
      ) : null}
    </div>
  );
}

function ReturnToField() {
  const target = useReturnTo();
  return target ? <input type="hidden" name="returnTo" value={target} /> : null;
}

function SocialForms() {
  const { t: copy } = useCopy();
  const formAction = useAccessAction();
  const t = copy.access;
  return (
    <form method="post" action={formAction} className="grid gap-2">
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

function OrSeparator() {
  const t = useCopy().t.access;
  return (
    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
      {t.or}
    </FieldSeparator>
  );
}

function SignInAlternatives({ recovering }: { recovering: boolean }) {
  const target = useReturnTo();
  if (recovering) return null;
  return (
    <>
      <OrSeparator />
      <div className="grid gap-2">
        <SocialForms />
        <PasskeyButton target={target} />
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
  const { t: copy } = useCopy();
  const formAction = useAccessAction();
  const t = copy.access;
  const [tab, setTab] = useState(initialTab);
  const [recovering, setRecovering] = useState(false);
  const values = remembered?.values;
  const signIn = useFieldErrors(t.validation);
  const signUp = useFieldErrors(t.validation);
  // L'accesso con password non passa da Turnstile; il recupero e la registrazione sì.
  const recovery = useTurnstile(recovering ? turnstileActions.passwordReset : null);
  const registration = useTurnstile(turnstileActions.signUp);
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
          method="post"
          action={formAction}
          {...signIn.form}
          onSubmit={(event) => {
            if (signIn.check(event)) recovery.submit(event);
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
                defaultValue={remembered?.tab === "accedi" ? values?.email : undefined}
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
            {recovery.field}
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
          method="post"
          action={formAction}
          {...signUp.form}
          onSubmit={(event) => {
            if (signUp.check(event)) registration.submit(event);
          }}
        >
          <FieldGroup>
            <ProfileFields
              v={signUp}
              values={remembered?.tab === "registrati" ? values : undefined}
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
                defaultValue={remembered?.tab === "registrati" ? values?.email : undefined}
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
                minLength={minPasswordLength}
                maxLength={maxPasswordLength}
                required
                {...signUp.control("password")}
              />
              {signUp.error("password")}
            </Field>
            <AgreementFields
              v={signUp}
              values={remembered?.tab === "registrati" ? values : undefined}
            />
            {registration.field}
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
  const formAction = useAccessAction();
  const t = copy.access;
  const v = useFieldErrors(t.validation);
  return (
    <form
      method="post"
      action={formAction}
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
          minLength={minPasswordLength}
          maxLength={maxPasswordLength}
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
  needsMarketing,
  suggestedName,
  remembered,
}: {
  needsProfile: boolean;
  needsAgreement: boolean;
  needsMarketing: boolean;
  suggestedName: { firstName: string; lastName: string };
  remembered: Remembered | null;
}) {
  const { t: copy } = useCopy();
  const formAction = useAccessAction();
  const t = copy.access;
  const values = remembered?.tab === "completa" ? remembered.values : undefined;
  const v = useFieldErrors(t.validation);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">{t.agreementTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.agreementBody}</p>
      </div>
      <form method="post" action={formAction} {...v.form} onSubmit={(event) => void v.check(event)}>
        <FieldGroup>
          {needsProfile ? <ProfileFields v={v} values={values} suggested={suggestedName} /> : null}
          {needsAgreement ? (
            <AgreementFields v={v} values={values} marketing={needsMarketing} />
          ) : null}
          <Button type="submit" name="intent" value="completa" className="w-full">
            {t.agreementSubmit}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

function SignOutForm() {
  const { t: copy } = useCopy();
  const formAction = useAccessAction();
  const t = copy.access;
  return (
    <form method="post" action={formAction}>
      <Button type="submit" variant="outline" name="intent" value="esci">
        <LogOut aria-hidden="true" data-icon="inline-start" />
        {t.signOut}
      </Button>
    </form>
  );
}

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
      <div className="grid gap-6">
        <CompleteRegistration
          needsProfile={loaderData.needsProfile}
          needsAgreement={loaderData.needsAgreement}
          needsMarketing={loaderData.needsMarketing}
          suggestedName={loaderData.suggestedName}
          remembered={remembered}
        />
        {/* Senza registrazione completa le Impostazioni non si aprono: la cancellazione è qui. */}
        <div className="border-t pt-4">
          <DeleteAccount
            email={loaderData.email}
            access={loaderData.deletion}
            actionPath={localizedPath(loaderData.language, accessPath)}
            inline
          />
        </div>
      </div>
    );
  }
  if (loaderData.resetToken) {
    return <ResetPassword token={loaderData.resetToken} />;
  }
  return (
    <AccessForms
      remembered={remembered}
      initialTab={remembered && remembered.tab !== "completa" ? remembered.tab : loaderData.tab}
      signUpBody={loaderData.registrationRestricted ? t.registrationRestricted : t.signUpBody}
    />
  );
}

function accessHeading(loaderData: Awaited<ReturnType<typeof loader>>, t: AccessCopy) {
  if (loaderData.authenticated) return t.agreementTitle;
  return loaderData.resetToken ? t.passwordResetTitle : t.choose;
}

/** Accesso, registrazione e completamento: marchio a sinistra, form a destra. */
export default function SignIn({ loaderData, actionData }: Route.ComponentProps) {
  const { language } = loaderData;
  // Gli esiti della cancellazione arrivano al suo riquadro: qui soltanto quelli dei moduli.
  const form = actionData && "remembered" in actionData ? actionData : null;
  const notice = form?.notice ?? loaderData.notice;
  const remembered = form?.remembered ?? null;
  const t = appCopy[language].access;
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
