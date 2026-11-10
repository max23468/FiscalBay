import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
  /** Pagina che approfondisce la risposta, con il percorso già nella lingua della pagina. */
  link?: { label: string; href: string };
}

/** Domande e risposte apribili una per una, senza JavaScript. */
export function FaqList({ items }: { items: readonly FaqItem[] }) {
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
          {item.link ? (
            <p className="pr-7 pb-3">
              <a
                href={item.link.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.link.label}
              </a>
            </p>
          ) : null}
        </details>
      ))}
    </div>
  );
}
