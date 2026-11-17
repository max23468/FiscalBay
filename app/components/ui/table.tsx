import { cn } from "cn";
import * as React from "react";

/**
 * Ombre ai bordi dell'area che scorre, soltanto dove c'è altro contenuto: le coperture seguono il
 * contenuto (`local`) e nascondono le ombre ferme sul contenitore (`scroll`) quando si è a un capo.
 * Le coperture hanno il colore del fondo, `--table-surface`, la pagina se non indicato.
 */
const surface = "var(--table-surface, var(--background))";
const shadow = "color-mix(in oklab, var(--foreground) 14%, transparent)";
const scrollShadows: React.CSSProperties = {
  background: [
    `linear-gradient(to right, ${surface} 40%, transparent) left center / 2rem 100% no-repeat local`,
    `linear-gradient(to left, ${surface} 40%, transparent) right center / 2rem 100% no-repeat local`,
    `radial-gradient(farthest-side at 0 50%, ${shadow}, transparent) left center / 0.75rem 100% no-repeat scroll`,
    `radial-gradient(farthest-side at 100% 50%, ${shadow}, transparent) right center / 0.75rem 100% no-repeat scroll`,
  ].join(", "),
};

/** `container` va all'area che scorre, per esempio per darle un nome e raggiungerla da tastiera. */
function Table({
  className,
  container,
  ...props
}: React.ComponentProps<"table"> & { container?: React.ComponentProps<"div"> }) {
  return (
    <div
      data-slot="table-container"
      {...container}
      style={{ ...scrollShadows, ...container?.style }}
      className={cn("relative w-full overflow-x-auto", container?.className)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
