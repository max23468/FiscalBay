import { useId, useState } from "react";

import { useCopy } from "~/components/copy-context";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { useTurnstile } from "~/components/turnstile";
import { turnstileActions } from "../../turnstile";

/** Riga di un metodo di accesso: nome, stato e azioni, come nelle Impostazioni. */
export function MethodRow({
  label,
  status,
  hint,
  children,
}: {
  label: string;
  status: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // Il gruppo dà ai pulsanti ripetuti in ogni riga («Rimuovi», «Esci») il nome della riga.
  const id = useId();
  return (
    <li className="flex flex-col items-start gap-x-4 gap-y-2 py-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <span className="grid min-w-0 max-w-full md:flex-1 md:basis-48">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span id={`${id}-status`} className="text-sm wrap-anywhere text-muted-foreground">
          {status}
        </span>
        {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
      </span>
      {children ? (
        <div
          role="group"
          aria-labelledby={`${id}-label ${id}-status`}
          className="flex flex-wrap gap-2"
        >
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** Pulsante che invia un'azione di Sicurezza, con il metodo interessato. */
export function MethodAction({
  intent,
  method,
  id,
  label,
  actionPath,
  disabled = false,
  children,
}: {
  intent: string;
  method?: string;
  id?: string;
  label?: string;
  actionPath: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const destructive = intent === "rimuovi-metodo" || intent === "passkey-remove";
  const [open, setOpen] = useState(false);
  const { t } = useCopy();
  // Il link per la password è una richiesta di reset: passa da Turnstile come dall'accesso.
  const turnstile = useTurnstile(intent === "password" ? turnstileActions.passwordReset : null);
  const form = (
    <form
      method="post"
      action={actionPath}
      className={turnstile.enabled ? "grid justify-items-start gap-2" : undefined}
      onSubmit={turnstile.submit}
    >
      {turnstile.field}
      {method ? <input type="hidden" name="metodo" value={method} /> : null}
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <Button
        type="submit"
        variant={destructive ? "destructive-solid" : "outline"}
        size="sm"
        name="intent"
        value={intent}
        disabled={disabled}
      >
        {children}
      </Button>
    </form>
  );
  if (!destructive) return form;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" size="sm" disabled={disabled} />}
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.settings.security.removeMethodTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.settings.security.removeMethodBody(label ?? t.settings.security.methodPasskey)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
