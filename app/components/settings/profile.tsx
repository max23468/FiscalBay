import { useFieldErrors } from "~/components/form-validation";
import { ProfileInput } from "~/components/profile-fields";
import { Button } from "~/components/ui/button";
import type { AppCopy } from "../../app-copy";
import type { AccountView } from "../../view-models";
import type { Draft } from "./unsaved";

/**
 * Profilo: soltanto le informazioni personali minime raccolte alla registrazione. La bozza
 * appartiene alla pagina, che ne tiene l'avviso d'uscita.
 */
export function ProfileSection({
  account,
  form,
  t,
}: {
  account: Pick<AccountView, "profile">;
  form: Draft<Record<string, string>>;
  t: AppCopy;
}) {
  const v = useFieldErrors(t.access.validation);
  const business = account.profile.accountType === "business";
  const { draft, setDraft, dirty, submit, action } = form;
  // Ogni campo è obbligatorio: niente asterischi né legenda, l'errore lo spiega accanto.
  const field = (name: "nome" | "cognome" | "ragione_sociale", id: string, className?: string) => (
    <ProfileInput
      name={name}
      id={id}
      t={t.access}
      v={v}
      marked={false}
      className={className}
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
      {/* Dato registrato e non modificabile, presentato come l'email in Sicurezza. */}
      <dl className="grid gap-1 text-sm">
        <dt className="text-muted-foreground">{t.profile.accountType}</dt>
        <dd>{business ? t.access.business : t.access.private}</dd>
      </dl>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        {field("nome", "profile-name")}
        {field("cognome", "profile-last-name")}
        {business ? field("ragione_sociale", "profile-company", "sm:col-span-2") : null}
      </div>
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
