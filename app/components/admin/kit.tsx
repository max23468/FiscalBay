import { cn } from "cn";
import { createContext, use, useId, type ReactNode } from "react";
import { Link, useFetcher } from "react-router";

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
      className={cn("grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:p-5", className)}
    >
      <h2 id={id} className="text-lg font-semibold text-balance">
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

export type TableRow = { key: string; cells: ReactNode[] };

/**
 * Tabella leggera da 768 px; sotto, ogni riga diventa una scheda: la prima cella fa da titolo,
 * le altre seguono con la loro etichetta e le azioni, senza intestazione, chiudono la scheda.
 * Senza righe dice che è vuota.
 */
export function DataTable({
  head,
  rows,
  label,
}: {
  head: string[];
  rows: TableRow[];
  /** Nome dell'area scorrevole; senza, quello del riquadro che la contiene. */
  label?: string;
}) {
  const { t } = useAdmin();
  const panel = use(PanelTitle);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t.common.none}</p>;
  return (
    <>
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 font-medium break-words">{row.cells[0]}</div>
            <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-3 gap-y-1.5">
              {row.cells.slice(1).map((cell, index) =>
                head[index + 1] && cell !== null && cell !== "" ? (
                  <div key={head[index + 1]} className="contents">
                    <dt className="text-muted-foreground">{head[index + 1]}</dt>
                    <dd className="min-w-0 break-words">{cell}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {row.cells.slice(1).map((cell, index) =>
              head[index + 1] ? null : (
                <div key={`action-${index}`} className="pt-1">
                  {cell}
                </div>
              ),
            )}
          </li>
        ))}
      </ul>
      {/* Su schermi medi la tabella può ancora scorrere: l'area si raggiunge da tastiera. */}
      <div
        className="hidden overflow-x-auto md:block"
        role="region"
        aria-label={label ?? panel ?? undefined}
        tabIndex={0}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {head.map((label, index) => (
                <th
                  key={label || index}
                  scope="col"
                  className="px-2 py-2 font-medium whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b align-top last:border-0">
                {row.cells.map((cell, index) => (
                  <td key={head[index] || index} className="px-2 py-2.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Coppie etichetta e valore, in due colonne anche su mobile. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Valore chiave con etichetta e una nota, come nei riquadri della panoramica. Con `href` tutto il
 * riquadro porta alla sezione che lo approfondisce.
 */
export function Stat({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "warning" | "danger";
  href?: string;
}) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-code text-2xl font-semibold tracking-tight",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </>
  );
  const className = "grid content-start gap-1 rounded-xl border bg-card p-4";
  return href ? (
    <Link
      to={href}
      className={cn(
        className,
        "outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Griglia dei riquadri numerici: due colonne su mobile, quattro su schermi ampi. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
