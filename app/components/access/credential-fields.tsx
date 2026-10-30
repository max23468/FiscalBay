import type { FieldErrors } from "~/components/form-validation";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { maxPasswordLength, minPasswordLength } from "../../limits";

/** Email dell'accesso o della registrazione, con l'errore accanto al campo. */
export function EmailField({
  id,
  label,
  autoComplete,
  defaultValue,
  v,
}: {
  id: string;
  label: string;
  autoComplete: "username" | "email";
  defaultValue?: string;
  v: FieldErrors;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <Input
        id={id}
        name="email"
        type="email"
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        {...v.control("email")}
      />
      {v.error("email")}
    </Field>
  );
}

/** Password attuale oppure nuova: una nuova ha i limiti che il server accetterà. */
export function PasswordField({
  id,
  label,
  autoComplete,
  v,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  v: FieldErrors;
}) {
  const created = autoComplete === "new-password";
  return (
    <Field>
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <Input
        id={id}
        name="password"
        type="password"
        autoComplete={autoComplete}
        minLength={created ? minPasswordLength : undefined}
        maxLength={created ? maxPasswordLength : undefined}
        required
        {...v.control("password")}
      />
      {v.error("password")}
    </Field>
  );
}
