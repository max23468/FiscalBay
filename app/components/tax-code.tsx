import { Check, Copy, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { Button } from "~/components/ui/button";

type Labels = { copy: string; copied: string; copyFailed: string; locked: string };

/**
 * Identificativo fiscale mostrato sempre intero, leggibile e copiabile.
 * Da bloccato non riceve il valore: mostra segnaposto generici, perché il
 * dato non deve arrivare al browser prima dello sblocco. `reveal` anima la
 * comparsa dopo uno sblocco.
 */
export function TaxCode({
  value,
  labels,
  reveal = false,
  className,
}: {
  value: string | null;
  labels: Labels;
  reveal?: boolean;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
        <Lock aria-hidden="true" className="size-3.5 text-premium" />
        <span aria-hidden="true" className="font-code text-[0.9375rem]">
          ••••••••••••••••
        </span>
        <span className="sr-only">{labels.locked}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "font-code text-[0.9375rem] font-medium text-foreground",
          reveal &&
            "inline-block animate-[value-reveal_var(--duration-slow)_var(--ease-smooth-out)_both] motion-reduce:animate-none",
        )}
      >
        {value}
      </span>
      <CopyButton value={value} labels={labels} />
    </span>
  );
}

function CopyButton({ value, labels }: { value: string; labels: Labels }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 1600);
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
        className="group/copy"
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
      <span role="status" className="sr-only">
        {state === "idle" ? "" : label}
      </span>
    </>
  );
}
