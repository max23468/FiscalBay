import { cn } from "cn";
import { useCallback, useEffect, useState } from "react";
import { useRouteLoaderData } from "react-router";

import { useCopy } from "~/components/copy-context";
import { siteColumn } from "~/components/site-column";
import { buttonLink } from "~/components/ui/button-variants";

import { appendSource, sourceParam, withoutSource } from "../signup-source";

/**
 * Provenienza di chi apre la demo (D304), fissata al primo caricamento: le pagine della demo si
 * aprono senza nuovi documenti e la provenienza resta per `Inizia gratis`, il sito e il cambio di
 * lingua. Come nelle pagine del sito, il parametro esce dalla barra dell'indirizzo, così un link
 * copiato non lo trasmette.
 */
export function useDemoSource() {
  const arrival = useRouteLoaderData<{ arrival: string | null }>("root")?.arrival ?? null;
  const [source] = useState(arrival);
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has(sourceParam))
      window.history.replaceState(window.history.state, "", withoutSource(window.location.href));
  }, []);
  return useCallback((path: string) => (source ? appendSource(path, source) : path), [source]);
}

/** Barra della demo: i dati sono di esempio e `Inizia gratis` porta alla registrazione. */
export function DemoBar({ signUp }: { signUp: string }) {
  const { t } = useCopy();
  return (
    <div className="border-b bg-muted/60">
      <div className={cn(siteColumn, "flex items-center gap-x-6 gap-y-2 py-2 text-sm")}>
        <p className="min-w-0 flex-1 text-pretty">
          <span className="font-medium">{t.demo.label}</span>
          <span className="text-muted-foreground max-md:hidden"> · {t.demo.note}</span>
        </p>
        <a href={signUp} {...buttonLink({ size: "sm", className: "shrink-0" })}>
          {t.demo.start}
        </a>
      </div>
    </div>
  );
}
