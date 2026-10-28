import { KeyRound } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useSubmit } from "react-router";

import { useCopy, useLinks } from "~/components/copy-context";
import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { SignInMethods } from "../../domain/sign-in-methods.server";
import { deviceName } from "../../account/device-name";
import { loadPasskeyClient } from "../../account/passkey";
import { passkeyFailure, type PasskeyFailure } from "../../account/passkey-error";

/** Nome della passkey modificato sul posto; annullando, il focus torna a «Rinomina». */
export function PasskeyRename({
  passkey,
  actionPath,
}: {
  passkey: SignInMethods["passkeys"][number];
  actionPath: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { settings, common } = useCopy().t;
  const trigger = useRef<HTMLButtonElement>(null);
  const ready = useHydrated();
  return open ? (
    <form method="post" action={actionPath} className="grid w-full gap-2">
      <input type="hidden" name="id" value={passkey.id} />
      <FieldLabel htmlFor={id}>{settings.security.passkeyName}</FieldLabel>
      <Input
        id={id}
        name="name"
        defaultValue={passkey.name ?? ""}
        required
        maxLength={80}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" name="intent" value="passkey-rename">
          {common.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            flushSync(() => setOpen(false));
            trigger.current?.focus();
          }}
        >
          {common.cancel}
        </Button>
      </div>
    </form>
  ) : (
    <Button
      ref={trigger}
      type="button"
      variant="outline"
      size="sm"
      disabled={!ready}
      onClick={() => setOpen(true)}
    >
      {settings.security.renamePasskey}
    </Button>
  );
}

export function AddPasskey({
  block,
  guard,
  actionPath,
}: {
  block: string;
  /** Chiede prima la conferma dell'identità, quando serve. */
  guard: (intent: string, run: () => void) => void;
  actionPath: string;
}) {
  const {
    t: { access: t, settings, common },
    language,
  } = useCopy();
  const { preview } = useLinks();
  const submit = useSubmit();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PasskeyFailure | null>(null);
  const [name, setName] = useState("");
  const id = useId();
  const add = async () => {
    // L'anteprima non registra passkey: la sua route risponde all'azione come l'area reale.
    if (preview) {
      void submit({ intent: "passkey-add" }, { method: "post", action: actionPath });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const authClient = await loadPasskeyClient();
      if (!authClient) {
        setError("unsupported");
        return;
      }
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || deviceName(navigator.userAgent, language),
      });
      if (result.error?.status === 403) window.location.assign(`${actionPath}?accesso=${block}`);
      else if (result.error) setError(passkeyFailure(result.error));
      else window.location.reload();
    } catch (failure) {
      setError(passkeyFailure(failure));
    } finally {
      setPending(false);
    }
  };
  const opener = useRef<HTMLButtonElement>(null);
  const [naming, setNaming] = useState(false);
  const ready = useHydrated();
  const failure = error ? <FieldError>{t.passkeyErrors[error]}</FieldError> : null;
  // Il nome si chiede soltanto dopo la scelta di aggiungere una passkey, già compilato.
  if (!naming)
    return (
      <div className="grid w-full gap-2">
        <Button
          ref={opener}
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={!ready}
          onClick={() =>
            guard("passkey-add", () => {
              setName(deviceName(navigator.userAgent, language));
              setError(null);
              setNaming(true);
            })
          }
        >
          <KeyRound aria-hidden="true" data-icon="inline-start" />
          {settings.security.addPasskey}
        </Button>
        {failure}
      </div>
    );
  return (
    <form
      className="grid w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>{settings.security.passkeyName}</FieldLabel>
        <Input
          id={id}
          aria-describedby={`${id}-hint`}
          maxLength={80}
          value={name}
          autoFocus
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldDescription id={`${id}-hint`}>{settings.security.passkeyNameHint}</FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" pending={pending}>
          <KeyRound aria-hidden="true" data-icon="inline-start" />
          {settings.security.addPasskey}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            // Chiudendo il campo il focus torna al pulsante che l'ha aperto.
            flushSync(() => setNaming(false));
            opener.current?.focus();
          }}
        >
          {common.cancel}
        </Button>
      </div>
      {failure}
    </form>
  );
}
