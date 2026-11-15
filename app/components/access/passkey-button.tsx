import { KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCopy } from "~/components/copy-context";
import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field";
import { useLastUsed } from "~/components/access/last-used";
import {
  loadPasskeyClient,
  passkeyAutofillAvailable,
  signInWithPasskey,
  verifiedByServer,
} from "../../account/passkey";
import { passkeyFailure, type PasskeyFailure } from "../../account/passkey-error";
import { ordersPath } from "../../app-links";
import { localizedPath } from "../../i18n";

/**
 * Accesso con una passkey, dal pulsante o dal suggerimento nel campo email con
 * `autocomplete="username webauthn"`: poi `target`, la Sicurezza da cui si è partiti, oppure
 * gli Ordini. La richiesta del suggerimento parte al montaggio; il pulsante la sostituisce,
 * perché il client WebAuthn annulla la cerimonia in corso prima di aprirne un'altra.
 */
export function usePasskeySignIn(target: string | null) {
  const { language } = useCopy();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PasskeyFailure | null>(null);
  const destination = useRef("");
  useEffect(() => {
    destination.current = target ?? localizedPath(language, ordersPath);
  }, [target, language]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!(await passkeyAutofillAvailable())) return;
      const authClient = await loadPasskeyClient();
      if (!authClient || !active) return;
      const result = await signInWithPasskey(authClient, true).catch(() => null);
      if (!active || !result) return;
      if (!result.error) window.location.assign(destination.current);
      // Annullata dal pulsante o non scelta: nessun errore da mostrare. Lo è invece una
      // passkey scelta dal suggerimento e rifiutata dal server.
      else if (verifiedByServer(result)) setError(passkeyFailure(result.error));
    })();
    return () => {
      active = false;
    };
  }, []);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      const authClient = await loadPasskeyClient();
      if (!authClient) {
        setError("unsupported");
        return;
      }
      const result = await signInWithPasskey(authClient);
      if (result.error) setError(passkeyFailure(result.error));
      else window.location.assign(destination.current);
    } catch (failure) {
      setError(passkeyFailure(failure));
    } finally {
      setPending(false);
    }
  };
  return { pending, error, start };
}

export function PasskeyButton({
  passkey,
  lastUsed,
}: {
  passkey: ReturnType<typeof usePasskeySignIn>;
  lastUsed?: boolean;
}) {
  const t = useCopy().t.access;
  const last = useLastUsed(Boolean(lastUsed));
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        pending={passkey.pending}
        {...last.props}
        onClick={() => void passkey.start()}
      >
        <KeyRound aria-hidden="true" data-icon="inline-start" />
        {t.passkeySignIn}
        {last.badge}
      </Button>
      {passkey.error ? (
        <FieldError role="alert">{t.passkeyErrors[passkey.error]}</FieldError>
      ) : null}
    </div>
  );
}
