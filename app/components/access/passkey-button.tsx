import { KeyRound } from "lucide-react";
import { useState } from "react";

import { useCopy } from "~/components/copy-context";
import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field";
import { loadPasskeyClient } from "../../account/passkey";
import { passkeyFailure, type PasskeyFailure } from "../../account/passkey-error";
import { ordersPath } from "../../app-links";
import { localizedPath } from "../../i18n";

/** Accesso con una passkey: poi `target`, la Sicurezza da cui si è partiti, oppure gli Ordini. */
export function PasskeyButton({ target }: { target: string | null }) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PasskeyFailure | null>(null);
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        pending={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const authClient = await loadPasskeyClient();
            if (!authClient) {
              setError("unsupported");
              return;
            }
            const result = await authClient.signIn.passkey();
            if (result.error) setError(passkeyFailure(result.error));
            else window.location.assign(target ?? localizedPath(language, ordersPath));
          } catch (failure) {
            setError(passkeyFailure(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <KeyRound aria-hidden="true" data-icon="inline-start" />
        {t.passkeySignIn}
      </Button>
      {error ? <FieldError>{t.passkeyErrors[error]}</FieldError> : null}
    </div>
  );
}
