import { useEffect, useRef, useState } from "react";

import { UnlockIcon } from "~/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { useCopy } from "~/components/copy-context";
import { forgetExportedSelection } from "../../orders/export-scope";
import { FreeSuspendedNote } from "./fiscal";

/**
 * Modalità di selezione dell'elenco: la chiusura dimentica la selezione esportata e riporta il
 * focus su «Seleziona».
 */
export function useOrderSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selectRef = useRef<HTMLButtonElement>(null);
  const stopSelecting = () => {
    forgetExportedSelection();
    setSelecting(false);
    setSelected(new Set());
    selectRef.current?.focus();
  };
  const toggleSelected = (id: string, value: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  return {
    selecting,
    selected,
    selectRef,
    /** Riapre la selezione, per esempio quella esportata da ripristinare. */
    startSelecting: (ids: Iterable<string> = []) => {
      setSelecting(true);
      setSelected(new Set(ids));
    },
    stopSelecting,
    toggleSelected,
  };
}

/** Barra della modalità Seleziona: conteggi, sblocco multiplo confermato ed esportazione. */
export function SelectionBar({
  selected,
  lockedSelected,
  remaining,
  suspended = false,
  onUnlock,
  onCancel,
  onExport,
}: {
  selected: string[];
  lockedSelected: string[];
  remaining: number | null;
  /** Free sospeso dall'assistenza: lo sblocco non si conferma e l'avviso lo spiega. */
  suspended?: boolean;
  onUnlock: (ids: string[]) => void;
  onCancel: () => void;
  /** Apre l'esportazione degli ordini selezionati; assente se la sezione non esiste. */
  onExport?: () => void;
}) {
  const { t } = useCopy();
  const count = lockedSelected.length;
  const exceeds = suspended || (remaining !== null && count > remaining);
  const bar = useRef<HTMLDivElement>(null);
  // L'altezza della barra solleva gli avvisi brevi della shell, che altrimenti la coprirebbero.
  useEffect(() => {
    const root = document.documentElement.style;
    const observer = new ResizeObserver(([entry]) =>
      root.setProperty("--selection-bar", `${entry!.borderBoxSize[0]!.blockSize}px`),
    );
    observer.observe(bar.current!);
    return () => {
      observer.disconnect();
      root.removeProperty("--selection-bar");
    };
  }, []);
  return (
    <div
      ref={bar}
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-6 md:bottom-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-popover px-4 py-3 shadow-md">
        <p className="grid text-sm" aria-live="polite">
          <span className="font-medium">{t.orders.selected(selected.length)}</span>
          <span className="text-xs text-muted-foreground">{t.orders.selectedLocked(count)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant={count === 0 ? "secondary" : "default"} disabled={count === 0} />
              }
            >
              <UnlockIcon aria-hidden="true" data-icon="inline-start" />
              {t.orders.unlockSelected(count)}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.orders.unlockTitle(count)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {suspended ? (
                    <FreeSuspendedNote />
                  ) : exceeds ? (
                    t.orders.unlockExceeds(count, remaining ?? 0)
                  ) : remaining === null ? null : (
                    t.orders.unlockConfirmText(count, remaining)
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogClose
                  disabled={exceeds}
                  render={<Button />}
                  onClick={() => onUnlock(lockedSelected)}
                >
                  {t.orders.unlockConfirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {onExport ? (
            <Button variant="outline" disabled={selected.length === 0} onClick={onExport}>
              {t.orders.exportSelected}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
