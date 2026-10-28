import { useId, useRef, useState } from "react";

import { useAction } from "~/components/action";
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
import { useCopy } from "~/components/copy-context";
import { ConfirmIdentity } from "./settings/confirm-identity";
import type { SignInMethods } from "../domain/sign-in-methods.server";

/** Conferma dell'identità per la cancellazione: metodi, sessione in uso e accesso recente. */
export type DeletionAccess = {
  methods: SignInMethods;
  currentSession: string | null;
  /** Accesso abbastanza recente per chiedere subito il link. */
  ready: boolean;
};

/**
 * Cancellazione dell'account (§30): l'indirizzo dell'account scritto per esteso e la conferma
 * dell'identità sul posto quando l'ultimo accesso non è di pochi minuti fa; poi il link via
 * email, che avvia la cancellazione. Le Impostazioni aggiungono l'esportazione proposta; la
 * pagina di accesso e l'avviso della verifica inviano alla pagina di accesso, e la prima, senza
 * la shell degli avvisi, mostra l'esito sotto il pulsante.
 */
export function DeleteAccount({
  email,
  access,
  actionPath,
  exportOptions,
  inline = false,
}: {
  email: string;
  access: DeletionAccess;
  /** Route che riceve richiesta e conferma dell'identità. */
  actionPath: string;
  /** Esportazione proposta prima della conferma, dove è disponibile. */
  exportOptions?: React.ReactNode;
  /** Senza la shell degli avvisi: l'esito compare sotto il pulsante. */
  inline?: boolean;
}) {
  const { t } = useCopy();
  const id = useId();
  const action = useAction(undefined, actionPath);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Identità già confermata in questa pagina: un nuovo invio non la richiede di nuovo.
  const confirmed = useRef(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const send = () => action.run("account-delete", { confirmation: typed.trim() });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{t.settings.privacy.deleteAccount}</span>
        <span className="text-sm text-muted-foreground">
          {t.settings.privacy.deleteAccountBody}
        </span>
      </span>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t.settings.privacy.deleteAccount}
      </Button>
      {inline && action.result?.notice ? (
        <p
          role="status"
          className={action.result.ok ? "w-full text-sm" : "w-full text-sm text-danger"}
        >
          {action.result.notice}
        </p>
      ) : null}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.privacy.deleteAccountTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.privacy.deleteAccountConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {exportOptions}
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!matches) return;
              setOpen(false);
              if (access.ready || confirmed.current) send();
              else setConfirming(true);
            }}
          >
            <FieldLabel htmlFor={`${id}-email`}>{t.settings.privacy.deleteAccountEmail}</FieldLabel>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.currentTarget.value)}
            />
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive-solid"
                disabled={!matches || action.pending}
              >
                {t.settings.privacy.deleteAccountConfirm}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {confirming ? (
        <ConfirmIdentity
          methods={access.methods}
          passkeyOnly={false}
          actionPath={actionPath}
          returnTo={actionPath}
          body={t.settings.privacy.deleteAccountReauth}
          currentSession={access.currentSession}
          onConfirmed={() => {
            setConfirming(false);
            confirmed.current = true;
            send();
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
