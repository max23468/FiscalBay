import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { UnlockIcon } from "~/components/icons";
import { Button } from "~/components/ui/button";

/**
 * Testi già tradotti. `copy` è il nome accessibile del pulsante e deve
 * distinguere la riga (per esempio «Copia Codice Fiscale: Maria Rossi»),
 * perché in un elenco più pulsanti con lo stesso nome non si distinguono.
 */
type Labels = { copy: string; copied: string; copyFailed: string; locked: string };

const sizes = {
  default: "min-h-10 w-56 text-[0.9375rem]",
  compact: "min-h-8 w-48 text-sm",
};

/**
 * Identificativo fiscale mostrato sempre intero, leggibile e copiabile.
 * Da bloccato non riceve il valore: mostra segnaposto generici, perché il
 * dato non deve arrivare al browser prima dello sblocco. `reveal` anima la
 * comparsa dopo uno sblocco; `compact` serve alle righe dense delle tabelle.
 */
export function TaxCode({
  value,
  labels,
  reveal = false,
  size = "default",
  className,
  warning,
}: {
  value: string | null;
  labels: Labels;
  reveal?: boolean;
  size?: keyof typeof sizes;
  className?: string;
  warning?: string;
}) {
  if (value === null) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-lg border border-premium/30 bg-premium-surface px-3 py-1 text-muted-foreground dark:bg-premium/10",
          sizes[size],
          className,
        )}
      >
        <UnlockIcon aria-hidden="true" className="size-4 text-premium" />
        <span aria-hidden="true" className="font-code">
          ••••••••••••••••
        </span>
        <span className="sr-only">{labels.locked}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center justify-between gap-x-1 rounded-lg border pl-3 pr-1 py-1",
        sizes[size],
        reveal && "fiscal-reveal",
        warning
          ? "border-warning/50 bg-warning-surface dark:bg-warning/15"
          : "border-info/50 bg-info-surface shadow-xs shadow-info/15 dark:bg-info/15",
        className,
      )}
    >
      <span
        className={cn(
          "font-code whitespace-nowrap font-semibold",
          warning ? "text-warning" : "text-info",
          reveal &&
            "inline-block animate-[value-reveal_var(--duration-quick)_ease-out_both] motion-reduce:animate-none",
        )}
      >
        {value}
      </span>
      <CopyButton value={value} labels={labels} warning={!!warning} />
      {warning ? (
        <span className="basis-full text-xs font-medium text-warning">{warning}</span>
      ) : null}
    </span>
  );
}

function CopyButton({
  value,
  labels,
  warning,
}: {
  value: string;
  labels: Labels;
  warning: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("failed");
    }
  }

  const label =
    state === "copied" ? labels.copied : state === "failed" ? labels.copyFailed : labels.copy;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={labels.copy}
        data-state={state}
        onClick={copy}
        className={cn(
          "group/copy",
          warning
            ? "text-warning hover:bg-warning/10 hover:text-warning"
            : "text-info hover:bg-info/10 hover:text-info",
        )}
      >
        <span className="relative size-4">
          <Copy
            aria-hidden="true"
            className="absolute inset-0 transition-[opacity,scale,filter] duration-(--duration-fast) ease-in-out group-data-[state=copied]/copy:scale-25 group-data-[state=copied]/copy:opacity-0 group-data-[state=copied]/copy:blur-[2px]"
          />
          <Check
            aria-hidden="true"
            className="absolute inset-0 scale-25 text-success opacity-0 blur-[2px] transition-[opacity,scale,filter] duration-(--duration-fast) ease-in-out group-data-[state=copied]/copy:scale-100 group-data-[state=copied]/copy:opacity-100 group-data-[state=copied]/copy:blur-none"
          />
        </span>
      </Button>
      <span
        role="status"
        className={state === "failed" ? "basis-full text-sm text-danger" : "sr-only"}
      >
        {state === "idle" ? "" : label}
      </span>
    </>
  );
}
