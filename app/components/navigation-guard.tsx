import { createContext, useContext, useId, useLayoutEffect, useMemo, useState } from "react";
import { useBlocker, type Blocker, type BlockerFunction } from "react-router";

const unblocked: Blocker = {
  state: "unblocked",
  location: undefined,
  proceed: undefined,
  reset: undefined,
};

const NavigationContext = createContext<{
  guards: Map<string, BlockerFunction>;
  selected: string | null;
  blocker: Blocker;
} | null>(null);

/**
 * Un solo blocco per il router. I pannelli aperti più di recente decidono per primi; se non
 * intercettano la navigazione, restano attive le protezioni delle bozze della pagina.
 */
export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [guards] = useState(() => new Map<string, BlockerFunction>());
  const [selected, setSelected] = useState<string | null>(null);
  const blocker = useBlocker((navigation) => {
    const guard = [...guards.entries()].reverse().find(([, blocks]) => blocks(navigation));
    setSelected(guard?.[0] ?? null);
    return guard !== undefined;
  });
  const context = useMemo(() => ({ guards, selected, blocker }), [guards, selected, blocker]);
  return <NavigationContext value={context}>{children}</NavigationContext>;
}

/** Ogni chiamante riceve soltanto il blocco che ha richiesto, senza aprire altri dialoghi. */
export function useNavigationGuard(blocks: BlockerFunction): Blocker {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("La protezione della navigazione richiede la shell dell’app.");
  const { guards, selected, blocker } = context;
  const id = useId();
  // Aggiornare un elemento della Map conserva la priorità assegnata al suo montaggio.
  useLayoutEffect(() => {
    guards.set(id, blocks);
  }, [guards, id, blocks]);
  useLayoutEffect(
    () => () => {
      guards.delete(id);
    },
    [guards, id],
  );
  return selected === id ? blocker : unblocked;
}
