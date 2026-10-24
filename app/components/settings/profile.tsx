import { ShieldCheck, User } from "lucide-react";
import { Link } from "react-router";

import { useFieldErrors } from "~/components/form-validation";
import { IconTile, InitialsTile } from "~/components/icon-tile";
import { ProfileInput } from "~/components/profile-fields";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import type { AccountView } from "../../view-models";
import { UnsavedDialog, useDraft, useUnsavedGuard } from "./unsaved";

/** Riquadro del profilo con icona neutra, titolo e contenuto. */
function ProfileCard({
  icon,
  title,
  id,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-xl border bg-card p-5">
      <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
        <IconTile icon={icon} tone="neutral" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Profilo dall'avatar: soltanto le informazioni personali minime. */
export function ProfilePage({
  account,
  t,
  links,
}: {
  account: Pick<AccountView, "name" | "email" | "profile">;
  t: AppCopy;
  links: AppLinks;
}) {
  const v = useFieldErrors(t.access.validation);
  const profile = account.profile;
  const business = profile.accountType === "business";
  const { draft, setDraft, dirty, submit, action } = useDraft<Record<string, string>>(
    {
      nome: profile.firstName,
      cognome: profile.lastName,
      ...(business ? { ragione_sociale: profile.companyName ?? "" } : {}),
    },
    "profile",
  );
  const blocker = useUnsavedGuard(dirty);
  const field = (name: "nome" | "cognome" | "ragione_sociale", id: string) => (
    <ProfileInput
      name={name}
      id={id}
      t={t.access}
      v={v}
      value={draft[name] ?? ""}
      disabled={!v.ready || action.pending}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setDraft((current) => ({ ...current, [name]: value }));
      }}
    />
  );
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex items-center gap-4">
        <InitialsTile
          name={account.name}
          fallback={account.email}
          size="lg"
          className="size-14 rounded-full text-lg"
        />
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-2xl font-bold sm:text-3xl">{t.profile.title}</h1>
          <p className="truncate text-sm text-muted-foreground">{account.name}</p>
        </div>
      </div>
      <ProfileCard icon={User} title={t.profile.details} id="profile-name-title">
        <form
          className="grid gap-4"
          {...v.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!dirty || action.pending) return;
            if (!v.check(event)) return;
            submit({ tipo: business ? "azienda" : "privato" });
          }}
        >
          <p className="text-sm text-muted-foreground">{t.access.requiredFields}</p>
          <p className="text-sm text-muted-foreground">
            {t.profile.accountType}: {business ? t.access.business : t.access.private}
          </p>
          {field("nome", "profile-name")}
          {field("cognome", "profile-last-name")}
          {business ? field("ragione_sociale", "profile-company") : null}
          <Button
            type="submit"
            className="w-fit"
            disabled={!dirty || action.pending}
            aria-busy={action.pending || undefined}
          >
            {action.pending ? t.common.saving : t.common.save}
          </Button>
          {action.result ? (
            <p
              role={action.result.ok ? "status" : "alert"}
              className={action.result.ok ? "text-sm text-muted-foreground" : "text-sm text-danger"}
            >
              {action.result.notice}
            </p>
          ) : null}
        </form>
      </ProfileCard>
      <UnsavedDialog
        blocker={blocker}
        title={t.settings.unsavedTitle}
        description={t.profile.unsaved}
        leave={t.profile.leave}
        stay={t.profile.stay}
        pending={action.pending}
      />
      <ProfileCard
        icon={ShieldCheck}
        title={t.settings.sections.sicurezza.title}
        id="profile-security"
      >
        <p className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.profile.email}</span>
          <span className="break-all">{account.email}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={appHref(links, "impostazioni/sicurezza")}
            {...buttonLink({ variant: "outline", size: "sm" })}
          >
            {t.profile.securityLink}
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
