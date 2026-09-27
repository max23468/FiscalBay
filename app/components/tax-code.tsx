import { Check, Copy, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { Button } from "~/components/ui/button";

/**
 * Gruppi di lettura: Codice Fiscale persona fisica 3-3-5-4-1
 * (cognome, nome, data e sesso, comune, controllo), Partita IVA 7-3-1.
 * Sono solo visivi: selezione e copia restituiscono il valore intero.
 */
function groups(value: string): Array<{ offset: number; text: string }> {
  const sizes = /^[A-Z0-9]{16}$/u.test(value)
    ? [3, 3, 5, 4, 1]
    : /^\d{11}$/u.test(value)
      ? [7, 3, 1]
      : [value.length];
  let offset = 0;
  return sizes.map((size) => {
    const group = { offset, text: value.slice(offset, offset + size) };
    offset += size;
    return group;
  });
}

type Labels = { copy: string; copied: string; copyFailed: string; locked: string };

/**
 * Identificativo fiscale leggibile e copiabile. Da bloccato non riceve il
 * valore: mostra segnaposto generici, perché il dato non deve arrivare al
 * browser prima dello sblocco. `reveal` anima la comparsa dopo uno sblocco.
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
        <span aria-hidden="true" className="font-code text-[0.9375rem] tracking-tight">
          {["•••", "•••", "•••••", "••••", "•"].map((dots, position) => (
            // Segnaposto fissi: la posizione è l'identità del gruppo.
            <span key={`${position}-${dots.length}`} className="not-last:mr-[0.3em]">
              {dots}
            </span>
          ))}
        </span>
        <span className="sr-only">{labels.locked}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="font-code text-[0.9375rem] font-medium text-foreground">
        {groups(value).map((group, position) => (
          <span
            key={group.offset}
            className={cn(
              "inline-block not-last:mr-[0.3em]",
              reveal &&
                "animate-[value-reveal_var(--duration-slow)_var(--ease-smooth-out)_both] motion-reduce:animate-none",
            )}
            style={reveal ? { animationDelay: `${position * 40}ms` } : undefined}
          >
            {group.text}
          </span>
        ))}
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
