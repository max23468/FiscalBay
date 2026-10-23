import { useAction } from "~/components/app-shell";
import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import type { AppCopy } from "../app-copy";

/** Preferenza per utente: lo sblocco multiplo mantiene sempre il proprio dialogo. */
export function UnlockConfirmation({ confirmed, t }: { confirmed: boolean; t: AppCopy }) {
  const action = useAction();
  const ready = useHydrated();
  return (
    <div className="grid justify-items-start gap-3 rounded-xl border p-4">
      <p className="text-sm">{t.orders.unlockConfirmationHint}</p>
      <Button
        variant="outline"
        disabled={!ready || confirmed || action.pending}
        onClick={() => action.run("unlock-confirmation")}
      >
        {t.orders.restoreUnlockConfirmation}
      </Button>
      {action.result && !action.result.ok ? (
        <p role="alert" className="text-sm text-danger">
          {t.settings.saveFailed}
        </p>
      ) : null}
    </div>
  );
}
