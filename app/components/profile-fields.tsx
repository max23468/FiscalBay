import { useState } from "react";

import type { FieldErrors } from "~/components/form-validation";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import type { AppCopy } from "../app-copy";

type AccessCopy = AppCopy["access"];

/** Campi del profilo con i limiti che il server applica. */
const profileInputs = {
  nome: { label: "firstName", autoComplete: "given-name", maxLength: 100 },
  cognome: { label: "lastName", autoComplete: "family-name", maxLength: 100 },
  ragione_sociale: { label: "companyName", autoComplete: "organization", maxLength: 200 },
} as const;

/** Campo obbligatorio del profilo, con l'errore accanto; valore libero o controllato. */
export function ProfileInput({
  name,
  id,
  t,
  v,
  className,
  ...props
}: {
  name: keyof typeof profileInputs;
  id: string;
  t: AccessCopy;
  v: FieldErrors;
  className?: string;
} & Pick<React.ComponentProps<"input">, "defaultValue" | "value" | "onChange" | "disabled">) {
  const { label, autoComplete, maxLength } = profileInputs[name];
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id} required>
        {t[label]}
      </FieldLabel>
      <Input
        id={id}
        name={name}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required
        {...props}
        {...v.control(name)}
      />
      {v.error(name)}
    </Field>
  );
}

/** Persona sempre obbligatoria; l'azienda aggiunge la ragione sociale, senza CF né Partita IVA. */
export function ProfileFields({
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
        <ProfileInput
          name="ragione_sociale"
          id="company-name"
          t={t}
          v={v}
          className="animate-[rise-in_var(--duration-fast)_var(--ease-smooth-out)_both]"
          defaultValue={values?.ragione_sociale}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileInput
          name="nome"
          id="first-name"
          t={t}
          v={v}
          defaultValue={values?.nome ?? suggested?.firstName}
        />
        <ProfileInput
          name="cognome"
          id="last-name"
          t={t}
          v={v}
          defaultValue={values?.cognome ?? suggested?.lastName}
        />
      </div>
    </>
  );
}
