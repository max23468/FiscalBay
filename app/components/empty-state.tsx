import { cn } from "cn";

import { TesseraArt } from "~/components/brand";

/** Stato vuoto: illustrazione della tessera, un titolo, una frase e una sola azione. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <TesseraArt />
      <div className="grid max-w-sm gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
