import { env } from "cloudflare:workers";
import { cn } from "cn";
import { ClipboardList, Copy, KeyRound, LogOut, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AccessNotice, AccountShell } from "~/components/account";
import { EmptyState } from "~/components/empty-state";
import { PageTitle } from "~/components/icon-tile";
import { Logo } from "~/components/standalone-page";
import { useFieldErrors, type FieldErrors } from "~/components/form-validation";
import { LanguageSwitch } from "~/components/language-switch";
import { StatusAlert } from "~/components/status";
import { ImportedOrders, StoreIssueAlert } from "~/components/orders";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { createAuth } from "../auth.server";
import { registrationStatus } from "../domain/registration.server";
import { listSignInMethods } from "../domain/sign-in-methods.server";
import { listVisibleOrders } from "../domain/orders.server";
import { listStores } from "../domain/stores.server";
import { errorResponse } from "../errors";
import { sandboxAvailable } from "../integrations/ebay/environment.server";
import { accessNotice } from "../access-notice";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath, type Language } from "../i18n";
import { formatDate } from "../view-models";
import type { Route } from "./+types/home";

export function meta({ location, loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const { access } = appCopy[language];
  // Senza sessione la pagina è l'accesso, non ancora l'elenco degli ordini.
  const title =
    loaderData && "resetToken" in loaderData && loaderData.resetToken
      ? access.passwordResetTitle
      : loaderData?.authenticated
        ? access.title
        : access.signIn;
  return [
    { title: `FiscalBay | ${title}` },
    { name: "description", content: appCopy[language].access.description },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const search = new URL(request.url).searchParams;
  const notice = accessNotice(search, language);
  if (!session || search.has("token")) {
    return {
      authenticated: false as const,
      language,
      notice,
      orders: [],
      resetToken: search.get("token") || null,
    };
  }
  // Finché mancano profilo o Termini correnti l'utente vede solo il passaggio per completarli.
  const status = await registrationStatus(env.DB, session.user.id);
  const complete = status.termsAccepted && status.profile !== null;
  const ebayLinked = (await listSignInMethods(env.DB, session.user.id)).accounts.ebay;
  // eBay fornisce uno username, non il nome della persona. Vale anche per gli utenti
  // già registrati: né lo username né un indirizzo email devono precompilare il profilo.
  const providerName =
    status.profile || ebayLinked || session.user.name.includes("@") ? "" : session.user.name;
  const [firstName = "", ...lastName] = providerName.trim().split(/\s+/u).filter(Boolean);
  const stores = complete ? await listStores(env.DB, session.user.id) : [];
  const ebayEnvironment: "production" | "sandbox" =
    search.get("environment") === "sandbox" ? "sandbox" : "production";
  if (ebayEnvironment === "sandbox" && !sandboxAvailable(env)) {
    throw errorResponse(request, "FORBIDDEN");
  }
  return {
    authenticated: true as const,
    language,
    notice,
    email: session.user.email,
    name: status.profile ? `${status.profile.firstName} ${status.profile.lastName}` : "",
    emailVerified: session.user.emailVerified,
    needsProfile: !status.profile,
    needsAgreement: !status.termsAccepted,
    canLinkStore: session.user.emailVerified && complete,
    suggestedName: { firstName, lastName: lastName.join(" ") },
    orders: complete ? await listVisibleOrders(env.DB, session.user.id, 50, ebayEnvironment) : [],
    sandbox: sandboxAvailable(env),
    ebayEnvironment,
    // Senza ordini, un negozio già collegato cambia il messaggio: non va ricollegato.
    storeLinked: stores.some(
      (store) => store.ebayEnvironment === ebayEnvironment && store.connection !== "disconnected",
    ),
    // Prima i collegamenti già scaduti, poi quelli in scadenza.
    reminders: stores
      .filter((store) => store.ebayEnvironment === ebayEnvironment)
      .flatMap(({ id, name, ebayEnvironment, reminder }) =>
        reminder ? [{ id, name, ebayEnvironment, ...reminder }] : [],
      )
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expired" ? -1 : 1)),
  };
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

/** Persona sempre obbligatoria; l'azienda aggiunge la ragione sociale, senza CF né Partita IVA. */
function ProfileFields({
  t,
  v,
  values,
  suggested,
}: {
  t: AccessCopy;
  v: FieldErrors;
  values?: Record<string, string>;
  suggested?: { firstName: string; lastName: string };
}) {
  const [type, setType] = useState(values?.tipo === "azienda" ? "azienda" : "privato");
  return (
    <>
      <FieldSet>
        <FieldLegend variant="label" id="account-type-label">
          {t.accountType}
        </FieldLegend>
        <RadioGroup
          name="tipo"
          value={type}
          onValueChange={(next) => setType(String(next))}
          aria-labelledby="account-type-label"
          aria-describedby="account-type-hint"
          className="grid grid-cols-2 gap-2"
        >
          {(["privato", "azienda"] as const).map((value) => (
            <FieldLabel
              key={value}
              className="w-full rounded-lg border border-input/40 px-3 py-2.5 font-normal transition-colors duration-(--duration-quick) has-data-checked:border-primary has-data-checked:bg-info-surface"
            >
              <RadioGroupItem value={value} aria-labelledby={`account-type-${value}`} />
              <span id={`account-type-${value}`}>
                {value === "privato" ? t.private : t.business}
              </span>
            </FieldLabel>
          ))}
        </RadioGroup>
        <FieldDescription id="account-type-hint">{t.accountTypeHint}</FieldDescription>
      </FieldSet>
      {type === "azienda" ? (
        <Field className={rise}>
          <FieldLabel htmlFor="company-name" required>
            {t.companyName}
          </FieldLabel>
          <Input
            id="company-name"
            name="ragione_sociale"
            autoComplete="organization"
            maxLength={200}
            defaultValue={values?.ragione_sociale}
            required
            {...v.control("ragione_sociale")}
          />
          {v.error("ragione_sociale")}
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="first-name" required>
            {t.firstName}
          </FieldLabel>
          <Input
            id="first-name"
            name="nome"
            autoComplete="given-name"
            maxLength={100}
            defaultValue={values?.nome ?? suggested?.firstName}
            required
            {...v.control("nome")}
          />
          {v.error("nome")}
        </Field>
        <Field>
          <FieldLabel htmlFor="last-name" required>
            {t.lastName}
          </FieldLabel>
          <Input
            id="last-name"
            name="cognome"
            autoComplete="family-name"
            maxLength={100}
            defaultValue={values?.cognome ?? suggested?.lastName}
            required
            {...v.control("cognome")}
          />
          {v.error("cognome")}
        </Field>
      </div>
    </>
  );
}

/** Termini obbligatori e marketing facoltativo, entrambi mai preselezionati. */
function AgreementFields({
  t,
  v,
  language,
  values,
}: {
  t: AccessCopy;
  v: FieldErrors;
  language: Language;
  values?: Record<string, string>;
}) {
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

function SocialForms({ t, language }: { t: AccessCopy; language: Language }) {
  return (
    <form method="post" action={localizedPath(language, "/accesso")} className="grid gap-2">
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

function PasskeyButton({ t, language }: { t: AccessCopy; language: Language }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const { authClient } = await import("../passkey-client");
            const result = await authClient.signIn.passkey();
            if (result.error) setError(true);
            else window.location.assign(localizedPath(language));
          } catch {
            setError(true);
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
          {t.passkeyFailed}
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

function OrSeparator({ t }: { t: AccessCopy }) {
  return (
    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
      {t.or}
    </FieldSeparator>
  );
}

function SignInAlternatives({
  t,
  language,
  recovering,
}: {
  t: AccessCopy;
  language: Language;
  recovering: boolean;
}) {
  if (recovering) return null;
  return (
    <>
      <OrSeparator t={t} />
      <div className="grid gap-2">
        <SocialForms t={t} language={language} />
        <PasskeyButton t={t} language={language} />
      </div>
    </>
  );
}

/** Un solo form visibile evita che il browser compili i campi dell'altra scheda. */
function AccessForms({
  t,
  language,
  remembered,
}: {
  t: AccessCopy;
  language: Language;
  remembered: Remembered | null;
}) {
  const [tab, setTab] = useState("accedi");
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
        <p className="text-muted-foreground">
          {recovering ? t.passwordRecoveryBody : t.signInBody}
        </p>
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
        <SignInAlternatives t={t} language={language} recovering={recovering} />
      </TabsContent>
      <TabsContent value="registrati" keepMounted className={cn("grid gap-5", rise)}>
        <p className="text-muted-foreground">{t.signUpBody}</p>
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
              t={t}
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
              t={t}
              v={signUp}
              language={language}
              values={restored?.tab === "registrati" ? values : undefined}
            />
            <Button type="submit" name="intent" value="registrati" className="w-full">
              {t.signUp}
            </Button>
          </FieldGroup>
        </form>
        <OrSeparator t={t} />
        <SocialForms t={t} language={language} />
      </TabsContent>
    </Tabs>
  );
}

function ResetPassword({
  t,
  language,
  token,
}: {
  t: AccessCopy;
  language: Language;
  token: string;
}) {
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
        href={localizedPath(language)}
        className="w-fit text-sm text-primary underline underline-offset-4"
      >
        {t.backToSignIn}
      </a>
    </form>
  );
}

/** Passaggio per chi ha una sessione ma non ha ancora profilo o Termini correnti. */
function CompleteRegistration({
  t,
  language,
  needsProfile,
  needsAgreement,
  suggestedName,
  remembered,
}: {
  t: AccessCopy;
  language: Language;
  needsProfile: boolean;
  needsAgreement: boolean;
  suggestedName: { firstName: string; lastName: string };
  remembered: Remembered | null;
}) {
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
          {needsProfile ? (
            <ProfileFields t={t} v={v} values={values} suggested={suggestedName} />
          ) : null}
          {needsAgreement ? (
            <AgreementFields t={t} v={v} language={language} values={values} />
          ) : null}
          <Button type="submit" name="intent" value="completa" className="w-full">
            {t.agreementSubmit}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

function SignOutForm({ t, language }: { t: AccessCopy; language: Language }) {
  return (
    <form method="post" action={localizedPath(language, "/accesso")}>
      <Button type="submit" variant="outline" name="intent" value="esci">
        <LogOut aria-hidden="true" data-icon="inline-start" />
        {t.signOut}
      </Button>
    </form>
  );
}

/** Avviso di verifica dell'email, finché l'indirizzo non è confermato. */
function VerifyEmail({
  t,
  language,
  email,
  emailVerified,
}: {
  t: AccessCopy;
  language: Language;
  email: string;
  emailVerified: boolean;
}) {
  return emailVerified ? null : (
    <StatusAlert tone="warning" title={t.verifyTitle}>
      <p>{t.verifyBody(email)}</p>
      <form method="post" action={localizedPath(language, "/accesso")} className="mt-2">
        <Button type="submit" variant="outline" size="sm" name="intent" value="verifica">
          {t.verifyResend}
        </Button>
      </form>
    </StatusAlert>
  );
}

/** Apre la schermata preparatoria: il passaggio a eBay parte solo da lì. */
function LinkStore({
  t,
  language,
  ebayEnvironment = "production",
}: {
  t: AccessCopy;
  language: Language;
  ebayEnvironment?: "production" | "sandbox";
}) {
  return (
    <a
      href={`${localizedPath(language, "/negozi/collega")}?environment=${ebayEnvironment}`}
      data-slot="button"
      className={cn(buttonVariants(), "w-fit")}
    >
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.linkStore}
    </a>
  );
}

const featureIcons = [
  { Icon: ClipboardList, className: "text-brand-sky" },
  { Icon: Copy, className: "text-[#f5c451]" },
  { Icon: Store, className: "text-[#5fd0c9]" },
];

/** Colonna del marchio: cosa fa FiscalBay, con i colori del logo. */
function BrandPanel({ t }: { t: AccessCopy }) {
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
  t,
  language,
  remembered,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
  t: AccessCopy;
  language: Language;
  remembered: Remembered | null;
}) {
  if (loaderData.authenticated) {
    return (
      <CompleteRegistration
        t={t}
        language={language}
        needsProfile={loaderData.needsProfile}
        needsAgreement={loaderData.needsAgreement}
        suggestedName={loaderData.suggestedName}
        remembered={remembered}
      />
    );
  }
  if (loaderData.resetToken) {
    return <ResetPassword t={t} language={language} token={loaderData.resetToken} />;
  }
  return <AccessForms t={t} language={language} remembered={remembered} />;
}

function accessHeading(loaderData: Awaited<ReturnType<typeof loader>>, t: AccessCopy) {
  if (loaderData.authenticated) return t.agreementTitle;
  return loaderData.resetToken ? t.passwordResetTitle : t.choose;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { language, notice } = loaderData;
  const t = appCopy[language].access;
  const remembered = useRemembered(notice !== null && errorTones.has(notice.tone));
  const noticeAlert = <AccessNotice language={language} notice={notice} />;

  // Accesso, registrazione e completamento: marchio a sinistra, form a destra.
  if (!loaderData.authenticated || loaderData.needsProfile || loaderData.needsAgreement) {
    return (
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <BrandPanel t={t} />
        <main className="flex flex-col px-4 py-4 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Logo className="h-7 w-auto lg:invisible" />
            <LanguageSwitch
              label={t.language}
              current={language}
              hrefFor={(code) => localizedPath(code)}
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
            {noticeAlert}
            {loaderData.authenticated ? (
              <VerifyEmail
                t={t}
                language={language}
                email={loaderData.email}
                emailVerified={loaderData.emailVerified}
              />
            ) : null}
            <div className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", rise)}>
              <p className="mb-3 text-sm text-muted-foreground">{t.requiredFields}</p>
              <AccessPanel
                loaderData={loaderData}
                t={t}
                language={language}
                remembered={remembered}
              />
            </div>
            <nav
              aria-label={appCopy[language].legal.navigation}
              className="flex justify-center gap-4 text-sm text-muted-foreground"
            >
              <a
                href={localizedPath(language, "/termini")}
                className="underline underline-offset-4"
              >
                {t.terms.terms}
              </a>
              <a
                href={localizedPath(language, "/privacy")}
                className="underline underline-offset-4"
              >
                {t.terms.privacy}
              </a>
            </nav>
            {loaderData.authenticated ? <SignOutForm t={t} language={language} /> : null}
          </div>
        </main>
      </div>
    );
  }

  return <OrdersPage loaderData={loaderData} noticeAlert={noticeAlert} />;
}

/** Ambiente eBay degli ordini mostrati, sul solo dominio di test: lo stesso campo dei filtri. */
function EnvironmentSelect({
  language,
  value,
}: {
  language: Language;
  value: "production" | "sandbox";
}) {
  const t = appCopy[language].storeLink;
  const navigate = useNavigate();
  const items = (["production", "sandbox"] as const).map((environment) => ({
    value: environment,
    label: t[environment],
  }));
  return (
    <Field className="sm:max-w-sm">
      <FieldLabel htmlFor="ebay-environment">{t.environment}</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) =>
          void navigate(`${localizedPath(language)}?environment=${String(next)}`)
        }
      >
        <SelectTrigger id="ebay-environment" className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type SignedIn = Extract<Awaited<ReturnType<typeof loader>>, { authenticated: true }>;

/** Pagina Ordini dell'area reale, dentro la shell condivisa. */
function OrdersPage({
  loaderData,
  noticeAlert,
}: {
  loaderData: SignedIn;
  noticeAlert: React.ReactNode;
}) {
  const { language } = loaderData;
  const t = appCopy[language].access;
  return (
    <AccountShell
      language={language}
      account={{ name: loaderData.name, email: loaderData.email }}
      security={loaderData.emailVerified}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle
            icon={ClipboardList}
            tone="blue"
            description={<p className="text-sm text-muted-foreground">{t.intro}</p>}
          >
            {t.title}
          </PageTitle>
          {loaderData.canLinkStore && loaderData.orders.length > 0 ? (
            <LinkStore t={t} language={language} ebayEnvironment={loaderData.ebayEnvironment} />
          ) : null}
        </header>
        {noticeAlert}
        <VerifyEmail
          t={t}
          language={language}
          email={loaderData.email}
          emailVerified={loaderData.emailVerified}
        />
        {loaderData.sandbox && (
          <EnvironmentSelect language={language} value={loaderData.ebayEnvironment} />
        )}
        {loaderData.reminders.map((store) =>
          // Come nell'anteprima, il collegamento scaduto porta al pannello del negozio.
          store.kind === "expired" ? (
            <StoreIssueAlert
              key={store.id}
              storeId={store.id}
              storeName={store.name}
              t={appCopy[language]}
              links={{ language, base: "" }}
            />
          ) : (
            <StatusAlert key={store.id} tone="info" title={t.consentExpiringTitle(store.name)}>
              <span className="grid justify-items-start gap-3">
                {t.consentExpiringBody(formatDate(store.at, language, "date"))}
                <a
                  href={`${localizedPath(language, "/negozi/collega")}?ricollega&environment=${store.ebayEnvironment}`}
                  data-slot="button"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t.reconnectStore}
                </a>
              </span>
            </StatusAlert>
          ),
        )}
        {loaderData.orders.length === 0 ? (
          <EmptyState
            title={loaderData.storeLinked ? t.noImportedOrders : t.noOrders}
            description={
              loaderData.storeLinked
                ? t.noImportedOrdersBody
                : loaderData.canLinkStore
                  ? t.noOrdersBody
                  : t.noOrdersVerifyBody
            }
            action={
              loaderData.canLinkStore ? (
                <LinkStore t={t} language={language} ebayEnvironment={loaderData.ebayEnvironment} />
              ) : undefined
            }
          />
        ) : (
          <ImportedOrders orders={loaderData.orders} language={language} t={appCopy[language]} />
        )}
      </div>
    </AccountShell>
  );
}
