import * as React from "react";
import { cn } from "cn";

/**
 * Area di testo che cresce con il contenuto: parte dalle righe di `rows` (due senza) e si
 * ferma a dodici righe, poi scorre. Le altezze sono in righe (`lh`), quindi seguono la
 * dimensione del testo; padding e bordo si aggiungono a parte.
 */
function Textarea({ className, rows, style, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      style={{ "--textarea-rows": rows ?? 2, ...style } as React.CSSProperties}
      className={cn(
        "flex field-sizing-content min-h-[calc(var(--textarea-rows)*1lh+1rem+2px)] max-h-[calc(12lh+1rem+2px)] w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs shadow-brand-navy/5 transition-[color,background-color,border-color,box-shadow] duration-(--duration-quick) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:text-sm dark:bg-muted/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
