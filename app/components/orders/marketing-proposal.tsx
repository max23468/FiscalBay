import { Mail } from "lucide-react";

import { useAction } from "~/components/action";
import { useCopy } from "~/components/copy-context";
import { Button } from "~/components/ui/button";

/**
 * Proposta del consenso facoltativo dopo i primi passi, separata da quella della registrazione:
 * nessuna scelta predefinita, e il servizio resta disponibile qualunque sia la risposta.
 */
export function MarketingProposal() {
  const { t } = useCopy();
  const action = useAction();
  const proposal = t.orders.marketingProposal;
  if (action.result?.ok) return null;
  return (
    <section
      aria-labelledby="marketing-proposal"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card p-4"
    >
      <Mail aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 flex-1 basis-64 gap-1">
        <h2 id="marketing-proposal" className="text-sm font-medium">
          {proposal.title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{proposal.body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={action.pending}
          onClick={() => action.run("marketing", { value: "false" })}
        >
          {proposal.decline}
        </Button>
        <Button
          size="sm"
          disabled={action.pending}
          onClick={() => action.run("marketing", { value: "true" })}
        >
          {proposal.accept}
        </Button>
      </div>
    </section>
  );
}
