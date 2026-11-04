import { useId } from "react";

import { useCopy } from "~/components/copy-context";
import { Badge } from "~/components/ui/badge";

/**
 * Segno sul pulsante del metodo usato l'ultima volta da questo browser. Il segno descrive il
 * pulsante senza entrare nel suo nome, che resta quello di sempre per chi usa un lettore di schermo.
 */
export function useLastUsed(active: boolean) {
  const id = useId();
  const t = useCopy().t.access;
  if (!active) return { props: {}, badge: null };
  return {
    props: { "aria-describedby": id },
    badge: (
      <Badge id={id} variant="neutral" aria-hidden="true">
        {t.lastUsed}
      </Badge>
    ),
  };
}
