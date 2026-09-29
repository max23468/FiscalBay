import { env } from "cloudflare:workers";
import { cn } from "cn";
import { ClipboardList, Copy, KeyRound, LogOut, Plus, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { IconTile } from "~/components/icon-tile";
import { Logo } from "~/components/standalone-page";
import { StatusAlert } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { createAuth } from "../auth.server";
import { registrationStatus } from "../domain/registration.server";
import { listVisibleOrders } from "../domain/orders.server";
import { appCopy } from "../app-copy";
import { formatAmount, languageFromPath, localizedPath, type Language } from "../i18n";
import { formatDate } from "../view-models";
import type { Route } from "./+types/home";

export function meta({ location, loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const { access } = appCopy[language];
  // Senza sessione la pagina è l'accesso, non ancora l'elenco degli ordini.
  const title = loaderData?.authenticated ? access.title : access.signIn;
  return [
    { title: `FiscalBay | ${title}` },
    { name: "description", content: appCopy[language].access.description },
  ];
}

// Tipi restituiti da eBay; un tipo sconosciuto resta com'è, mai chiamato Codice Fiscale.
const identifierLabels: Record<string, "CF" | "PIVA"> = {
  CODICE_FISCALE: "CF",
  VAT_ID: "PIVA",
};

/** Tono degli avvisi: gli errori chiedono un'azione, le conferme no. */
const noticeTones: Record<string, "success" | "info" | "warning" | "danger"> = {
  errore: "danger",
  registrazione: "danger",
  termini: "warning",
  dati: "warning",
  "troppi-tentativi": "warning",
  accesso: "warning",
  "altro-spazio": "warning",
  registrato: "success",
  "verifica-inviata": "success",
  "passkey-rimossa": "success",
  "ultimo-accesso": "warning",
  "recupero-inviato": "info",
  "password-reimpostata": "success",
  "recupero-scaduto": "warning",
  collegato: "success",
  "ebay-collegato": "success",
  "ebay-rimosso": "success",
  "ultimo-metodo": "warning",
  "nuovo-accesso": "warning",
  "accesso-non-verificato": "warning",
};

export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const search = new URL(request.url).searchParams;
  const { access } = appCopy[language];
  const key = search.get("accesso") ?? search.get("negozio") ?? "";
  const text =
    access.signInNotices[search.get("accesso") ?? ""] ??
    access.storeNotices[search.get("negozio") ?? ""] ??
    (search.has("error") ? access.signInNotices["recupero-scaduto"] : null) ??
    null;
  const notice = text
    ? { text, tone: noticeTones[search.has("error") ? "recupero-scaduto" : key] ?? "info" }
    : null;
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
  // Il nome del provider, per esempio Google, precompila il profilo mancante; un nome che è
  // l'indirizzo email, lasciato dalle registrazioni precedenti, non è un nome.
  const providerName = status.profile || session.user.name.includes("@") ? "" : session.user.name;
  const [firstName = "", ...lastName] = providerName.trim().split(/\s+/u).filter(Boolean);
  return {
    authenticated: true as const,
    language,
    notice,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    needsProfile: !status.profile,
    needsAgreement: !status.termsAccepted,
    canLinkStore: session.user.emailVerified && complete,
    ebayLinked: (await createAuth(env).api.listUserAccounts({ headers: request.headers })).some(
      (account) => account.providerId === "ebay",
    ),
    passkeys:
      session.user.emailVerified && complete
        ? (
            await env.DB.prepare(
              'SELECT "id", "name", "createdAt" FROM "passkey" WHERE "userId" = ? ORDER BY "createdAt" DESC',
            )
              .bind(session.user.id)
              .all<{ id: string; name: string | null; createdAt: string | null }>()
          ).results
        : [],
    suggestedName: { firstName, lastName: lastName.join(" ") },
    orders: complete ? await listVisibleOrders(env.DB, session.user.id) : [],
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
  values,
  suggested,
}: {
  t: AccessCopy;
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
          <FieldLabel htmlFor="company-name">{t.companyName}</FieldLabel>
          <Input
            id="company-name"
            name="ragione_sociale"
            autoComplete="organization"
            maxLength={200}
            defaultValue={values?.ragione_sociale}
            required
          />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="first-name">{t.firstName}</FieldLabel>
          <Input
            id="first-name"
            name="nome"
            autoComplete="given-name"
            maxLength={100}
            defaultValue={values?.nome ?? suggested?.firstName}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="last-name">{t.lastName}</FieldLabel>
          <Input
            id="last-name"
            name="cognome"
            autoComplete="family-name"
            maxLength={100}
            defaultValue={values?.cognome ?? suggested?.lastName}
            required
          />
        </Field>
      </div>
    </>
  );
}

/** Termini obbligatori e marketing facoltativo, entrambi mai preselezionati. */
function AgreementFields({
  t,
  language,
  values,
}: {
  t: AccessCopy;
  language: Language;
  values?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 rounded-lg bg-muted/50 p-3">
      <FieldLabel className="font-normal">
        <Checkbox
          name="termini"
          required
          defaultChecked={values?.termini === "on"}
          aria-labelledby="terms-label"
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

function SocialForms({ t, language }: { t: AccessCopy; language: Language }) {
  return (
    <form method="post" action={localizedPath(language, "/accesso")} className="grid gap-2">
      <Button type="submit" variant="outline" name="intent" value="google" className="w-full">
        <GoogleMark />
        {t.google}
      </Button>
      <Button type="submit" variant="outline" name="intent" value="ebay" className="w-full">
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

/**
 * Accesso e registrazione in una sola scheda con due schede interne: un solo
 * form visibile evita che il browser compili i campi dell'altro.
 */
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
  return (
    <Tabs value={tab} onValueChange={(next) => setTab(String(next))} className="gap-6">
      <TabsList aria-label={t.choose} className="w-full">
        <TabsTrigger value="accedi">{t.signIn}</TabsTrigger>
        <TabsTrigger value="registrati">{t.signUp}</TabsTrigger>
      </TabsList>
      <TabsContent value="accedi" keepMounted className={cn("grid gap-5", rise)}>
        <p className="text-muted-foreground">
          {recovering ? t.passwordRecoveryBody : t.signInBody}
        </p>
        <form
          key={restored ? "restored" : "empty"}
          method="post"
          action={localizedPath(language, "/accesso")}
          onSubmit={remember("accedi")}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t.email}</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                defaultValue={restored?.tab === "accedi" ? values?.email : undefined}
                required
              />
            </Field>
            {recovering ? null : (
              <Field>
                <FieldLabel htmlFor="password">{t.password}</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
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
          className="w-fit px-0"
          onClick={() => setRecovering(!recovering)}
        >
          {recovering ? t.signIn : t.passwordRecovery}
        </Button>
        <OrSeparator t={t} />
        <SocialForms t={t} language={language} />
        <PasskeyButton t={t} language={language} />
      </TabsContent>
      <TabsContent value="registrati" keepMounted className={cn("grid gap-5", rise)}>
        <p className="text-muted-foreground">{t.signUpBody}</p>
        <form
          key={restored ? "restored" : "empty"}
          method="post"
          action={localizedPath(language, "/accesso")}
          onSubmit={remember("registrati")}
        >
          <FieldGroup>
            <ProfileFields t={t} values={restored?.tab === "registrati" ? values : undefined} />
            <Field>
              <FieldLabel htmlFor="signup-email">{t.email}</FieldLabel>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={restored?.tab === "registrati" ? values?.email : undefined}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="signup-password">{t.newPassword}</FieldLabel>
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </Field>
            <AgreementFields
              t={t}
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
  return (
    <form method="post" action={localizedPath(language, "/accesso")} className="grid gap-4">
      <h2 className="text-xl font-semibold">{t.passwordRecovery}</h2>
      <input type="hidden" name="token" value={token} />
      <Field>
        <FieldLabel htmlFor="reset-password">{t.newPassword}</FieldLabel>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </Field>
      <Button type="submit" name="intent" value="reimposta-password">
        {t.passwordRecoveryConfirm}
      </Button>
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
        onSubmit={remember("completa")}
      >
        <FieldGroup>
          {needsProfile ? <ProfileFields t={t} values={values} suggested={suggestedName} /> : null}
          {needsAgreement ? <AgreementFields t={t} language={language} values={values} /> : null}
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

function AccountSecurity({
  t,
  language,
  passkeys,
  ebayLinked,
}: {
  t: AccessCopy;
  language: Language;
  passkeys: Array<{ id: string; name: string | null; createdAt: string | null }>;
  ebayLinked: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Card id="sicurezza" className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t.passkeySecurity}</h2>
        </CardTitle>
        <CardDescription>{t.passkeyRecovery}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <EbayAccess t={t} language={language} linked={ebayLinked} />
        {passkeys.length ? (
          <ul className="grid divide-y border-y">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">
                  {passkey.name || t.passkeyLabel}
                  {passkey.createdAt ? ` · ${formatDate(passkey.createdAt, language)}` : ""}
                </span>
                <form method="post" action={localizedPath(language, "/accesso")}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    name="intent"
                    value="passkey-remove"
                  >
                    {t.passkeyRemove}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.passkeyEmpty}</p>
        )}
        <Button
          type="button"
          className="w-fit"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(false);
            try {
              const { authClient } = await import("../passkey-client");
              const result = await authClient.passkey.addPasskey();
              if (result.error) setError(true);
              else window.location.reload();
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          }}
        >
          <KeyRound aria-hidden="true" data-icon="inline-start" />
          {t.passkeyAdd}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {t.passkeyFailed}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Avviso di verifica dell'email e collegamento del negozio. */
function AccountBar({
  t,
  language,
  email,
  emailVerified,
  canLinkStore,
}: {
  t: AccessCopy;
  language: Language;
  email: string;
  emailVerified: boolean;
  canLinkStore: boolean;
}) {
  return (
    <>
      {emailVerified ? null : (
        <StatusAlert tone="warning" title={t.verifyTitle}>
          <p>{t.verifyBody(email)}</p>
          <form method="post" action={localizedPath(language, "/accesso")} className="mt-2">
            <Button type="submit" variant="outline" size="sm" name="intent" value="verifica">
              {t.verifyResend}
            </Button>
          </form>
        </StatusAlert>
      )}
      {canLinkStore ? (
        <form method="post" action={localizedPath(language, "/negozi/collega")}>
          <Button type="submit">
            <Plus aria-hidden="true" data-icon="inline-start" />
            {t.linkStore}
          </Button>
        </form>
      ) : null}
    </>
  );
}

function LanguageNav({ t, language }: { t: AccessCopy; language: Language }) {
  return (
    <nav aria-label={t.language} className="flex gap-1 text-sm">
      {(
        [
          ["it", "/", "Italiano"],
          ["en", "/en", "English"],
        ] as const
      ).map(([code, href, label]) => (
        <a
          key={code}
          href={href}
          lang={code}
          aria-current={language === code ? "page" : undefined}
          className="rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

const featureIcons = [
  { Icon: ShieldCheck, className: "text-brand-sky" },
  { Icon: Copy, className: "text-[#f5c451]" },
  { Icon: Store, className: "text-[#5fd0c9]" },
];

/** Colonna del marchio: cosa fa FiscalBay, con i colori del logo. */
function BrandPanel({ t }: { t: AccessCopy }) {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-navy text-white lg:flex lg:flex-col lg:justify-between lg:gap-12 lg:p-12 xl:p-16">
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
      <span aria-hidden="true" />
    </aside>
  );
}

const errorTones = new Set(["danger", "warning"]);

function EbayAccess({
  t,
  language,
  linked,
}: {
  t: AccessCopy;
  language: Language;
  linked: boolean;
}) {
  return (
    <section aria-labelledby="ebay-access-title" className="grid gap-2 rounded-lg border p-4">
      <h3 id="ebay-access-title" className="font-semibold">
        {t.ebayAccessTitle}
      </h3>
      <p className="text-sm text-muted-foreground">
        {linked ? t.ebayAccessConnected : t.ebayAccessBody}
      </p>
      <form method="post" action={localizedPath(language, "/accesso")}>
        <Button
          type="submit"
          variant="outline"
          name="intent"
          value={linked ? "rimuovi-accesso-ebay" : "collega-accesso-ebay"}
        >
          {linked ? t.ebayAccessRemove : t.ebayAccessLink}
        </Button>
      </form>
    </section>
  );
}

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

export default function Home({ loaderData }: Route.ComponentProps) {
  const { language, notice } = loaderData;
  const t = appCopy[language].access;
  const { orders } = appCopy[language];
  const remembered = useRemembered(notice !== null && errorTones.has(notice.tone));
  const noticeAlert = notice ? <StatusAlert tone={notice.tone} title={notice.text} /> : null;

  // Accesso, registrazione e completamento: marchio a sinistra, form a destra.
  if (!loaderData.authenticated || loaderData.needsProfile || loaderData.needsAgreement) {
    return (
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <BrandPanel t={t} />
        <main className="flex flex-col px-4 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Logo className="h-7 w-auto lg:invisible" />
            <LanguageNav t={t} language={language} />
          </header>
          <div className="mx-auto grid w-full max-w-md flex-1 content-center gap-6 py-10">
            <div className="grid gap-2 lg:hidden">
              <p className="text-2xl font-semibold text-balance">{t.headline}</p>
            </div>
            <h1 className="sr-only">{loaderData.authenticated ? t.agreementTitle : t.choose}</h1>
            {noticeAlert}
            {loaderData.authenticated ? (
              <AccountBar
                t={t}
                language={language}
                email={loaderData.email}
                emailVerified={loaderData.emailVerified}
                canLinkStore={loaderData.canLinkStore}
              />
            ) : null}
            <div className={cn("rounded-2xl border bg-card p-5 shadow-sm sm:p-7", rise)}>
              <AccessPanel
                loaderData={loaderData}
                t={t}
                language={language}
                remembered={remembered}
              />
            </div>
            {loaderData.authenticated ? <SignOutForm t={t} language={language} /> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-[min(72rem,calc(100%-2rem))] items-center justify-between gap-4">
          <Logo className="h-6 w-auto" />
          <div className="flex items-center gap-2">
            <LanguageNav t={t} language={language} />
            {loaderData.emailVerified ? (
              <a href="#sicurezza" className="text-sm underline underline-offset-4">
                {t.passkeySecurity}
              </a>
            ) : null}
            <SignOutForm t={t} language={language} />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-6 py-8">
        <div className="flex items-center gap-3">
          <IconTile icon={ClipboardList} tone="blue" size="lg" />
          <div className="grid gap-0.5">
            <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.intro}</p>
          </div>
        </div>
        {noticeAlert}
        <AccountBar
          t={t}
          language={language}
          email={loaderData.email}
          emailVerified={loaderData.emailVerified}
          canLinkStore={loaderData.canLinkStore}
        />
        {loaderData.orders.length === 0 ? (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>
                <h2>{t.noOrders}</h2>
              </CardTitle>
              <CardDescription>
                {loaderData.canLinkStore ? t.noOrdersBody : t.noOrdersVerifyBody}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2" aria-label={t.list}>
            {loaderData.orders.map((order) => (
              <Card key={order.id} className={rise}>
                <CardHeader>
                  <CardTitle className="flex justify-between gap-4">
                    <h2 className="font-code">{order.ebayOrderId}</h2>
                    <strong className="font-code">
                      {formatAmount(order.totalMinor, order.currency, language)}
                    </strong>
                  </CardTitle>
                  <CardDescription>{formatDate(order.creationTime, language)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-2 text-sm">
                    {order.taxIdentifiers.map((identifier) => {
                      const known = identifierLabels[identifier.type];
                      const label = known ? orders.identifier[known] : identifier.type;
                      return (
                        <div
                          key={`${identifier.type}:${identifier.value}`}
                          className="grid grid-cols-[1fr_2fr] items-center gap-3"
                        >
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>
                            <TaxCode
                              value={identifier.value}
                              labels={{
                                copy: orders.copy(label, order.ebayOrderId),
                                copied: orders.copied,
                                copyFailed: orders.copyFailed,
                                locked: orders.lockedLabel(label),
                              }}
                            />
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        {loaderData.emailVerified ? (
          <AccountSecurity
            t={t}
            language={language}
            passkeys={loaderData.passkeys}
            ebayLinked={loaderData.ebayLinked}
          />
        ) : null}
      </main>
    </div>
  );
}
