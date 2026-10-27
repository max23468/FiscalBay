import { useEffect, useEffectEvent, useState } from "react";
import { useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";

import { snapshotParam } from "../../orders/order-list";
import type { OrderView } from "../../view-models";
import type { OrdersPageData } from "./page";

/** Distanza dall'inizio della pagina entro cui l'utente è considerato in cima alla lista. */
const topThreshold = 120;

/** Pausa dopo l'ultimo scorrimento oltre la quale l'utente è considerato fermo. */
const scrollSettle = 250;

/**
 * L'indirizzo riceve l'istantanea dell'elenco quando c'è qualcosa da tenere fermo: l'utente
 * lontano dalla cima, una selezione o un dettaglio (`held`), ordini in arrivo. Così ricarica,
 * dettaglio e Indietro ritrovano gli stessi ordini nello stesso ordine, e in cima l'indirizzo
 * resta pulito. I nuovi ordini entrano subito se stanno tutti sopra il primo mostrato e
 * l'utente è in cima alla lista senza selezionare né leggere un dettaglio; altrimenti resta
 * l'indicatore, così nulla si sposta mentre legge, il pannello aperto non si chiude e un
 * ordine recuperato dallo storico non entra fra quelli già letti.
 */
export function useListSnapshot(data: OrdersPageData, held: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { snapshot, freshHref, incomingAtTop } = data;
  const synced = params.get(snapshotParam) === snapshot;
  // Durante un'altra navigazione, per esempio Indietro, la sostituzione prenderebbe il posto
  // della pagina di destinazione: si attende il router inattivo e l'indirizzo del browser
  // ancora uguale all'elenco mostrato.
  const idle = useNavigation().state === "idle";
  const shown = `${location.pathname}${location.search}`;
  const current = () => `${window.location.pathname}${window.location.search}` === shown;
  // Lo scorrimento conta quando si ferma: un clic subito dopo avvia prima la sua navigazione,
  // che la sostituzione altrimenti interromperebbe.
  const [away, setAway] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => setAway(window.scrollY >= topThreshold);
    const scrolled = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, scrollSettle);
    };
    settle();
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", scrolled);
    };
  }, []);
  useEffect(() => {
    if (synced || !idle || !current() || !(held || away || freshHref !== null)) return;
    const next = new URLSearchParams(params);
    next.set(snapshotParam, snapshot);
    setParams(next, { replace: true, preventScrollReset: true });
  });
  const insertAtTop = useEffectEvent(() => {
    if (freshHref && incomingAtTop && window.scrollY < topThreshold && !held && current())
      void navigate(freshHref, { replace: true, preventScrollReset: true });
  });
  // Si parte dall'indirizzo con l'istantanea: la nuova la cambia o la toglie, mai la aggiunge,
  // e quindi rilegge sempre l'elenco.
  const ready = synced && idle && freshHref !== null;
  useEffect(() => {
    if (!ready) return;
    insertAtTop();
    window.addEventListener("scroll", insertAtTop, { passive: true });
    return () => window.removeEventListener("scroll", insertAtTop);
  }, [ready, freshHref]);
}

/**
 * Ordini entrati con una nuova istantanea, a criteri invariati, sopra quelli già mostrati:
 * compaiono come nuovi. Un nuovo filtro o una nuova ricerca non ne introducono.
 */
export function useNewOrders(orders: OrderView[], snapshot: string, criteria: string) {
  const [list, setList] = useState(() => ({
    snapshot,
    criteria,
    seen: new Set(orders.map((order) => order.id)),
    added: new Set<string>(),
  }));
  if (
    list.snapshot === snapshot &&
    list.criteria === criteria &&
    orders.every((order) => list.seen.has(order.id))
  )
    return list.added;
  const added = new Set(list.added);
  if (list.snapshot !== snapshot && list.criteria === criteria) {
    const firstSeen = orders.findIndex((order) => list.seen.has(order.id));
    for (const order of firstSeen < 0 ? [] : orders.slice(0, firstSeen)) added.add(order.id);
  }
  setList({
    snapshot,
    criteria,
    seen: new Set([...list.seen, ...orders.map((order) => order.id)]),
    added,
  });
  return added;
}

/**
 * Ogni scheda non nuova riceve la sua posizione d'ingresso la prima volta che compare e la
 * conserva: con «Carica altri» entrano soltanto le nuove, dalla prima in giù.
 */
export function useEnterIndexes(orders: OrderView[], newIds: ReadonlySet<string>) {
  const entering = (known: ReadonlyMap<string, number>) =>
    orders.filter((order) => !known.has(order.id) && !newIds.has(order.id));
  const [indexes, setIndexes] = useState(
    () => new Map(entering(new Map()).map((order, index) => [order.id, index])),
  );
  const added = entering(indexes);
  if (added.length === 0) return indexes;
  const next = new Map(indexes);
  added.forEach((order, index) => next.set(order.id, index));
  setIndexes(next);
  return next;
}
