import { useEffect, useRef } from "react";

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
import type { AppCopy } from "../../app-copy";

/** Barra della modalità Seleziona: conteggi, sblocco multiplo confermato ed esportazione. */
export function SelectionBar({
  t,
  selected,
  lockedSelected,
  remaining,
  onUnlock,
  onCancel,
  onExport,
}: {
  t: AppCopy;
  selected: string[];
  lockedSelected: string[];
  remaining: number | null;
  onUnlock: (ids: string[]) => void;
  onCancel: () => void;
  /** Apre l'esportazione degli ordini selezionati; assente se la sezione non esiste. */
  onExport?: () => void;
}) {
  const count = lockedSelected.length;
  const exceeds = remaining !== null && count > remaining;
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
                  {exceeds
                    ? t.orders.unlockExceeds(count, remaining ?? 0)
                    : remaining === null
                      ? null
                      : t.orders.unlockConfirmText(count, remaining)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.orders.cancel}</AlertDialogCancel>
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
            {t.orders.cancelSelection}
          </Button>
        </div>
      </div>
    </div>
  );
}
