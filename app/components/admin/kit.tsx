import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { createContext, use, useId, type ReactNode } from "react";
import { Link, useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { maxAuditReason } from "../../limits";
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
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} {...props} />
    </Field>
  );
}

/**
 * Modulo di un'operazione della console: invia `intent` e i campi nascosti, mostra l'esito
 * restituito dal server accanto al pulsante. Con `reason` chiede il motivo obbligatorio; con
 * `primary` il pulsante è blu pieno, per l'azione principale della sezione.
 */
export function ActionForm({
  intent,
  fields = {},
  submit,
  reason = false,
  destructive = false,
  primary = false,
  children,
  className,
  onResult,
}: {
  intent: string;
  fields?: Record<string, string>;
  submit: string;
  reason?: boolean;
  destructive?: boolean;
  primary?: boolean;
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
      {reason ? (
        <TextField label={t.common.reason} name="motivo" required maxLength={maxAuditReason} />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant={destructive ? "destructive" : primary ? "default" : "outline"}
          pending={pending}
        >
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
 * apre, così le azioni rare non affollano la scheda. Con `destructive` l'etichetta è rossa,
 * come il pulsante delle operazioni pericolose, e si distingue da quelle ordinarie.
 */
export function Disclosure({
  label,
  destructive = false,
  children,
}: {
  label: string;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border px-3 py-2 [&[open]>summary]:mb-3">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden",
          destructive && "text-danger",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--duration-quick) group-open:rotate-180"
        />
      </summary>
      {children}
    </details>
  );
}

export type TableRow = { key: string; cells: ReactNode[] };

/**
 * Tabella leggera da 768 px; sotto, ogni riga diventa una scheda: la prima cella fa da titolo,
 * le altre seguono con la loro etichetta e la colonna «Azioni» chiude la scheda. Le intestazioni
 * sono distinte e fanno da chiave delle celle. Senza righe dice che è vuota.
 */
export function DataTable({
  head,
  rows,
  label,
  numeric = [],
}: {
  head: string[];
  rows: TableRow[];
  /** Nome dell'area scorrevole; senza, quello del riquadro che la contiene. */
  label?: string;
  /** Indici delle colonne di numeri e importi, allineate a destra nella tabella. */
  numeric?: number[];
}) {
  const { t } = useAdmin();
  const panel = use(PanelTitle);
  // Colonna delle azioni: senza intestazione visibile, su mobile chiude la scheda.
  const actions = t.workspace.actions;
  const right = new Set(numeric);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t.common.none}</p>;
  return (
    <>
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => {
          const cells = head.map((column, index) => ({ column, cell: row.cells[index] }));
          return (
            <li key={row.key} className="grid gap-2 rounded-lg border p-3 text-sm">
              <div className="min-w-0 font-medium break-words">{cells[0]!.cell}</div>
              <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-3 gap-y-1.5">
                {cells.slice(1).map(({ column, cell }) =>
                  column !== actions && cell !== null && cell !== "" ? (
                    <div key={column} className="contents">
                      <dt className="text-muted-foreground">{column}</dt>
                      <dd className="min-w-0 break-words">{cell}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {cells
                .filter(({ column, cell }) => column === actions && cell)
                .map(({ column, cell }) => (
                  <div key={column} className="pt-1">
                    {cell}
                  </div>
                ))}
            </li>
          );
        })}
      </ul>
      {/* Su schermi medi la tabella può ancora scorrere: l'area si raggiunge da tastiera. */}
      <Table
        container={{
          className: "hidden md:block",
          role: "region",
          "aria-label": label ?? panel ?? undefined,
          tabIndex: 0,
        }}
      >
        <TableHeader>
          <TableRow className="text-xs hover:bg-transparent">
            {head.map((column, index) => (
              <TableHead
                key={column}
                scope="col"
                className={cn(
                  "h-auto py-2 text-muted-foreground",
                  right.has(index) && "text-right",
                  column === actions && "sr-only",
                )}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="align-top">
              {head.map((column, index) => (
                // I pulsanti, più alti del testo, restano centrati sulla prima riga delle celle.
                <TableCell
                  key={column}
                  className={cn(
                    "align-top whitespace-normal",
                    column === actions ? "py-1" : "py-2.5",
                    right.has(index) && "text-right",
                  )}
                >
                  {row.cells[index]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

/**
 * Griglia dei riquadri numerici: due colonne su mobile; su schermi ampi quattro, oppure tre per
 * sei riquadri, così ogni riga resta piena.
 */
export function StatGrid({ children, wide = 4 }: { children: ReactNode; wide?: 3 | 4 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", wide === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {children}
    </div>
  );
}
