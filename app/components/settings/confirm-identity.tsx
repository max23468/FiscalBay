import { KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";

import { useFetcherResult } from "~/components/action";
import { useCopy, useLinks } from "~/components/copy-context";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { SignInMethods } from "../../domain/sign-in-methods.server";
import type { ConfirmResult } from "../../security-actions.server";
import { loadPasskeyClient } from "../../account/passkey";
import { passkeyFailure, type PasskeyFailure } from "../../account/passkey-error";

/**
 * Conferma dell'identità sul posto, quando l'ultimo accesso è più vecchio di 24 ore: password
 * o passkey aprono una sessione nuova senza lasciare la pagina, poi la modifica prosegue. Chi
 * accede soltanto con Google o eBay esce e rientra. Per le passkey di un admin vale solo la
 * passkey.
 */
export function ConfirmIdentity({
  methods,
  passkeyOnly,
  actionPath,
  currentSession,
  onConfirmed,
  onCancel,
}: {
  methods: SignInMethods;
  passkeyOnly: boolean;
  actionPath: string;
  currentSession: string | null;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const { access: t, common } = useCopy().t;
  const { preview } = useLinks();
  const fetcher = useFetcher<ConfirmResult>();
  const [passkeyError, setPasskeyError] = useState<PasskeyFailure | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useFetcherResult(fetcher, (confirmed) => {
    if (confirmed.ok) onConfirmed();
    // Una passkey di un altro account ha aperto la sua sessione: la pagina si rilegge.
    else if (fetcher.formData === undefined && pending) window.location.reload();
  });
  const password = methods.accounts.password && !passkeyOnly;
  const passkey = methods.passkeys.length > 0;
  const confirmWithPasskey = async () => {
    setPasskeyError(null);
    setPending(true);
    try {
      // Nell'anteprima la passkey non si apre: la conferma va subito alla route simulata.
      if (preview) {
        void fetcher.submit(
          { intent: "conferma-accesso", metodo: "passkey" },
          { method: "post", action: actionPath },
        );
        return;
      }
      const authClient = await loadPasskeyClient();
      if (!authClient) return setPasskeyError("unsupported");
      const signed = await authClient.signIn.passkey();
      if (signed.error) return setPasskeyError(passkeyFailure(signed.error));
      void fetcher.submit(
        { intent: "conferma-accesso", metodo: "passkey", precedente: currentSession ?? "" },
        { method: "post", action: actionPath },
      );
    } catch (failure) {
      setPasskeyError(passkeyFailure(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {passkeyOnly ? t.confirmPasskeyBody : t.confirmBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {password ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const value = String(new FormData(event.currentTarget).get("password") ?? "");
              void fetcher.submit(
                { intent: "conferma-accesso", metodo: "password", password: value },
                { method: "post", action: actionPath },
              );
            }}
          >
            <FieldLabel htmlFor={`${id}-password`}>{t.password}</FieldLabel>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={result?.ok === false || undefined}
              aria-describedby={result?.ok === false ? `${id}-error` : undefined}
            />
            {result?.ok === false ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-danger">
                {result.notice}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="w-fit"
              disabled={fetcher.state !== "idle"}
              aria-busy={fetcher.state !== "idle" || undefined}
            >
              {t.confirm}
            </Button>
          </form>
        ) : null}
        {passkey ? (
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={pending || fetcher.state !== "idle"}
              onClick={() => void confirmWithPasskey()}
            >
              <KeyRound aria-hidden="true" data-icon="inline-start" />
              {t.confirmPasskey}
            </Button>
            {passkeyError ? (
              <p role="alert" className="text-sm text-danger">
                {t.passkeyErrors[passkeyError]}
              </p>
            ) : null}
          </div>
        ) : null}
        {passkeyOnly ? null : (
          <div className="grid justify-items-start gap-2 text-sm text-muted-foreground">
            <p>{t.confirmOther}</p>
            <form method="post" action={actionPath}>
              <input type="hidden" name="returnTo" value={`${actionPath}#security-methods`} />
              <Button type="submit" variant="outline" size="sm" name="intent" value="riautentica">
                {t.signOutSignIn}
              </Button>
            </form>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
