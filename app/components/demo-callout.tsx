import { cn } from "cn";

import { buttonLink } from "~/components/ui/button-variants";

/**
 * Invito alla demo nelle pagine del sito: titolo, il fatto che non serve registrarsi e il pulsante,
 * con lo stesso bordo tenue del riquadro della demo nelle Guide.
 */
export function DemoCallout({
  copy,
  href,
  heading: Heading = "h3",
  className,
}: {
  copy: { title: string; body: string; link: string };
  href: string;
  heading?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6",
        className,
      )}
    >
      <div className="grid flex-1 basis-72 gap-1.5">
        <Heading className="text-lg font-semibold text-balance">{copy.title}</Heading>
        <p className="leading-relaxed text-pretty text-muted-foreground">{copy.body}</p>
      </div>
      <a href={href} {...buttonLink({ size: "lg" })}>
        {copy.link}
      </a>
    </div>
  );
}
