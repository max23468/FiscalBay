import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { useCopy } from "~/components/copy-context";
import type { FieldErrors } from "~/components/form-validation";
import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { maxPasswordLength, minPasswordLength } from "../../limits";

type EnterKeyHint = React.ComponentProps<"input">["enterKeyHint"];

/**
 * Email dell'accesso o della registrazione, con l'errore accanto al campo. `username webauthn`
 * propone anche le passkey salvate per FiscalBay.
 */
export function EmailField({
  id,
  label,
  autoComplete,
  enterKeyHint = "next",
  defaultValue,
  v,
}: {
  id: string;
  label: string;
  autoComplete: "username" | "username webauthn";
  enterKeyHint?: EnterKeyHint;
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
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        defaultValue={defaultValue}
        required
        {...v.control("email")}
      />
      {v.error("email")}
    </Field>
  );
}

/**
 * Password attuale oppure nuova: una nuova ha i limiti che il server accetterà, con la regola
 * scritta sotto il campo. Il pulsante accanto mostra o nasconde quanto scritto.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  enterKeyHint = "go",
  v,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  enterKeyHint?: EnterKeyHint;
  v: FieldErrors;
}) {
  const t = useCopy().t.access;
  const created = autoComplete === "new-password";
  const hintId = useId();
  const [visible, setVisible] = useState(false);
  // Senza JavaScript il pulsante non farebbe nulla: compare dopo l'idratazione.
  const ready = useHydrated();
  return (
    <Field>
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          minLength={created ? minPasswordLength : undefined}
          maxLength={created ? maxPasswordLength : undefined}
          required
          className={ready ? "pe-11" : undefined}
          {...v.control("password", created ? hintId : undefined)}
        />
        {ready ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute inset-y-0 end-1 my-auto"
            aria-label={t.showPassword}
            aria-pressed={visible}
            aria-controls={id}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        ) : null}
      </div>
      {created ? (
        <FieldDescription id={hintId}>{t.passwordRule(minPasswordLength)}</FieldDescription>
      ) : null}
      {v.error("password")}
    </Field>
  );
}
