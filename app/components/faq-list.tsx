import { ChevronDown } from "lucide-react";

/** Domande e risposte apribili una per una, senza JavaScript. */
export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="grid divide-y border-y">
      {items.map((item) => (
        <details key={item.q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--duration-quick) group-open:rotate-180"
            />
          </summary>
          <p className="pr-7 pb-2 leading-relaxed text-pretty text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
