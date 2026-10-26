import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useCopy } from "~/components/copy-context";
import { useFieldErrors } from "~/components/form-validation";
import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { PendingEmailChange } from "../../domain/email-change.server";
import { SecurityGroup } from "./security-rows";

/** Email attuale; il nuovo indirizzo si inserisce solo quando serve. */
export function EmailChange({
  email,
  actionPath,
  pendingEmail,
}: {
  email: string;
  actionPath: string;
  pendingEmail?: PendingEmailChange | null;
}) {
  const { access: t, profile, common } = useCopy().t;
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const v = useFieldErrors(t.validation);
  const ready = useHydrated();
  return (
    <SecurityGroup id="security-email" title={profile.email}>
      <div className="flex flex-col items-start gap-x-4 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="min-w-0 break-all sm:flex-1 sm:basis-48">{email}</span>
        {open ? null : (
          <Button
            ref={opener}
            type="button"
            variant="outline"
            size="sm"
            aria-describedby="new-email-hint"
            disabled={!ready}
            onClick={() => setOpen(true)}
          >
            {profile.changeEmail}
          </Button>
        )}
      </div>
      {pendingEmail ? (
        <div role="status" className="grid gap-2 rounded-lg border p-3 text-sm">
          <p>{profile.emailPending(pendingEmail.new_email)}</p>
          <p className="text-muted-foreground">
            {pendingEmail.stage === "new" ? profile.emailPendingNew : profile.emailPendingCurrent}
          </p>
          <form method="post" action={actionPath}>
            <Button type="submit" variant="outline" size="sm" name="intent" value="reinvia-email">
              {profile.emailRestart}
            </Button>
          </form>
        </div>
      ) : null}
      {open ? (
        <form
          method="post"
          action={actionPath}
          className="grid gap-3"
          {...v.form}
          onSubmit={(event) => void v.check(event)}
        >
          <Field>
            <FieldLabel htmlFor="new-email">{t.newEmail}</FieldLabel>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              {...v.control("email", "new-email-hint")}
            />
            {v.error("email")}
            <FieldDescription id="new-email-hint">{profile.emailHint}</FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" name="intent" value="cambia-email">
              {t.sendEmailLink}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                // Chiudendo il campo il focus torna al pulsante che l'ha aperto.
                flushSync(() => setOpen(false));
                opener.current?.focus();
              }}
            >
              {common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <p id="new-email-hint" className="text-sm text-muted-foreground">
          {profile.emailHint}
        </p>
      )}
    </SecurityGroup>
  );
}
