import { useEffect, useState } from "react";

/**
 * Elementi mostrati subito con l'ultimo stato salvato e sostituiti, appena arriva nella stessa
 * risposta, dallo stato confermato dal server. Una conferma non riuscita lascia lo stato salvato;
 * una conferma di dati superati (dopo una nuova lettura della pagina) non si applica.
 */
export function useConfirmed<Item extends { id: string }>(
  items: Item[],
  confirmation?: Promise<Item[]>,
): Item[] {
  const [settled, setSettled] = useState<{ source: Promise<Item[]>; items: Item[] } | null>(null);
  useEffect(() => {
    if (!confirmation) return;
    let current = true;
    confirmation.then(
      (confirmed) => {
        if (current) setSettled({ source: confirmation, items: confirmed });
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [confirmation]);
  if (!confirmation || settled?.source !== confirmation) return items;
  const confirmed = new Map(settled.items.map((item) => [item.id, item]));
  return items.map((item) => confirmed.get(item.id) ?? item);
}
