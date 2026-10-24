import { useEffect } from "react";

import { useFieldErrors } from "~/components/form-validation";
import { ProfileInput } from "~/components/profile-fields";
import { Button } from "~/components/ui/button";
import type { AppCopy } from "../../app-copy";
import type { AccountView } from "../../view-models";
import { useDraft, type ReportDraft } from "./unsaved";

/** Profilo: soltanto le informazioni personali minime raccolte alla registrazione. */
export function ProfileSection({
  account,
  t,
  onDraft,
}: {
  account: Pick<AccountView, "profile">;
  t: AppCopy;
  onDraft: ReportDraft;
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
  useEffect(
    () => onDraft("profilo", { dirty, pending: action.pending }),
    [onDraft, dirty, action.pending],
  );
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
  );
}
