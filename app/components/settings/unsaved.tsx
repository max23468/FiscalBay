import { useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router";

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
import type { SaveState } from "./controls";

/**
 * Bozza di un modulo che si salva con «Salva», confrontata con l'ultimo valore salvato senza gli
 * spazi agli estremi. Un salvataggio riuscito rende salvato il valore inviato, anche se nel
 * frattempo la bozza è cambiata; una rilettura del server aggiorna il modulo soltanto senza
 * modifiche in corso né salvataggi in attesa.
 */
export function useDraft<T extends Record<string, string>>(stored: T, intent: string) {
  const storedKey = JSON.stringify(stored);
  const [observed, setObserved] = useState(storedKey);
  const [base, setBase] = useState({ saved: stored, submitted: stored });
  const [draft, setDraft] = useState(stored);
  const [failed, setFailed] = useState(false);
  const action = useAction((result) => {
    setFailed(!result.ok);
    if (result.ok) setBase((current) => ({ ...current, saved: current.submitted }));
  });
  const dirty = Object.keys(draft).some((key) => draft[key]!.trim() !== base.saved[key]!.trim());
  if (storedKey !== observed) {
    setObserved(storedKey);
    if (!dirty && !action.pending) {
      setBase({ saved: stored, submitted: stored });
      setDraft(stored);
    }
  }
  /** Invia la bozza senza spazi agli estremi, insieme ai campi fissi dell'azione. */
  const submit = (fields: Record<string, string> = {}) => {
    const next = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    ) as T;
    setDraft(next);
    setBase((current) => ({ ...current, submitted: next }));
    setFailed(false);
    action.run(intent, { ...fields, ...next });
  };
  const state: SaveState = action.pending
    ? "saving"
    : failed
      ? "error"
      : action.result?.ok && !dirty
        ? "saved"
        : "idle";
  return { draft, setDraft, dirty, state, submit, action };
}

export type Draft<T extends Record<string, string>> = ReturnType<typeof useDraft<T>>;

/**
 * Modifiche non salvate: lasciare l'area, ricaricare o chiudere la pagina chiede conferma.
 * `area` riduce l'indirizzo alla parte che conta: dentro la stessa area la bozza resta.
 */
export function useUnsavedGuard(dirty: boolean, area = (pathname: string) => pathname) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && area(currentLocation.pathname) !== area(nextLocation.pathname),
  );
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  return blocker;
}

export function UnsavedDialog({
  blocker,
  title,
  description,
  leave,
  stay,
  pending = false,
}: {
  blocker: ReturnType<typeof useBlocker>;
  title: string;
  description: string;
  leave: string;
  stay: string;
  /** Con un salvataggio in corso si resta finché non finisce. */
  pending?: boolean;
}) {
  return (
    <AlertDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{stay}</AlertDialogCancel>
          <Button
            disabled={pending}
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            {leave}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
