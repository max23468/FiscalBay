import { cn } from "cn";
import { createContext, use, useId, type ReactNode } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import type { AdminActionResult } from "../../admin-console.server";
import { useAdmin } from "./use-admin";

/** Titolo del riquadro che contiene una tabella: dà il nome alla sua area scorrevole. */
const PanelTitle = createContext<string | null>(null);

/** Riquadro di una parte della sezione. */
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("grid gap-3 rounded-xl border bg-card p-4", className)}
    >
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <PanelTitle value={title}>{children}</PanelTitle>
    </section>
  );
}

/** Campo con etichetta; `name` è il nome inviato al server. */
export function TextField({
  label,
  className,
  ...props
}: { label: string } & React.ComponentProps<"input">) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

/**
 * Modulo di un'operazione della console: invia `intent` e i campi nascosti, mostra l'esito
 * restituito dal server accanto al pulsante. Con `reason` chiede il motivo obbligatorio.
 */
export function ActionForm({
  intent,
  fields = {},
  submit,
  reason = false,
  destructive = false,
  children,
  className,
  onResult,
}: {
  intent: string;
  fields?: Record<string, string>;
  submit: string;
  reason?: boolean;
  destructive?: boolean;
  children?: ReactNode;
  className?: string;
  onResult?: (result: AdminActionResult) => ReactNode;
}) {
  const { t } = useAdmin();
  const fetcher = useFetcher<AdminActionResult>();
  const pending = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const form = (
    <fetcher.Form method="post" className={cn("grid gap-3", className)}>
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {reason ? <TextField label={t.common.reason} name="motivo" required maxLength={500} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant={destructive ? "destructive" : "outline"}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {submit}
        </Button>
        {result?.notice ? (
          <p role="status" className={cn("text-sm", result.ok ? "text-success" : "text-danger")}>
            {result.notice}
          </p>
        ) : null}
      </div>
    </fetcher.Form>
  );
  // Il seguito dell'esito, come una conferma, è un modulo a sé: mai dentro questo.
  const next = result && onResult ? onResult(result) : null;
  return next ? (
    <div className="grid gap-3">
      {form}
      {next}
    </div>
  ) : (
    form
  );
}

/**
 * Operazione richiudibile: i campi, motivo compreso, compaiono soltanto quando l'admin la
 * apre, così le azioni rare non affollano la scheda.
 */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border px-3 py-2 [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
        {label}
      </summary>
      {children}
    </details>
  );
}

/** Tabella compatta con intestazioni; senza righe mostra che è vuota. */
export function DataTable({
  head,
  rows,
  label,
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
  /** Nome dell'area scorrevole; senza, quello del riquadro che la contiene. */
  label?: string;
}) {
  const { t } = useAdmin();
  const panel = use(PanelTitle);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t.common.none}</p>;
  return (
    // Su schermi stretti la tabella scorre: l'area si raggiunge anche da tastiera.
    <div
      className="overflow-x-auto"
      role="region"
      aria-label={label ?? panel ?? undefined}
      tabIndex={0}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {head.map((label) => (
              <th key={label} scope="col" className="px-2 py-2 font-medium whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b align-top last:border-0">
              {row.cells.map((cell, index) => (
                <td key={head[index]} className="px-2 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Coppie etichetta e valore. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
