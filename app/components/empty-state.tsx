import { cn } from "cn";
import { Search, Unplug } from "lucide-react";

import { TesseraArt } from "~/components/brand";

/** Stato vuoto: illustrazione contestuale, titolo, conseguenza e una sola azione. */
export function EmptyState({
  title,
  description,
  action,
  className,
  variant = "first-use",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "first-use" | "search" | "connection";
}) {
  const firstUse = variant === "first-use";
  const Icon = variant === "search" ? Search : Unplug;
  return (
    <div
      className={cn(
        firstUse
          ? "grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[12rem_1fr] md:items-center md:p-8"
          : "grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-4 border-y py-5 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto] sm:items-center",
        className,
      )}
    >
      {firstUse ? (
        <div aria-hidden="true" className="relative mx-auto h-32 w-48">
          <TesseraArt className="absolute left-0 top-0 h-24 w-32 -rotate-6 opacity-35" />
          <TesseraArt className="absolute left-5 top-3 h-24 w-32 opacity-60" />
          <TesseraArt className="absolute left-12 top-6 h-24 w-32 rotate-8" />
        </div>
      ) : (
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0 sm:mt-0",
            variant === "connection" ? "text-warning" : "text-muted-foreground",
          )}
        />
      )}
      <div className={cn("grid min-w-0 gap-2", firstUse && "max-w-md")}>
        <h3
          className={
            firstUse ? "text-xl leading-snug font-semibold text-pretty" : "text-sm font-medium"
          }
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
        {firstUse && action ? <div className="pt-2">{action}</div> : null}
      </div>
      {!firstUse && action ? (
        <div className="col-start-2 sm:col-start-3 sm:row-start-1">{action}</div>
      ) : null}
    </div>
  );
}
