import { activeEntitlementSql } from "./grants.server";
import { dayMilliseconds } from "../time";

/**
 * Finestra dello storico (§4, §11, §30). Il Free importa, consulta e conserva gli ordini per
 * trenta giorni dalla loro data; una copertura in corso (Premium, prova, lifetime o concessa)
 * per un anno di calendario, o per l'estensione più lunga concessa allo spazio, mai oltre i due
 * anni che eBay restituisce. La stessa finestra fissa l'inizio dell'importazione, il termine di
 * un ordine nuovo e il riallineamento dei termini quando la copertura cambia.
 * Gli argomenti sono espressioni SQL, mai valori.
 */

/** Storico del Free, in giorni dalla data dell'ordine. */
export const freeHistoryDays = 30;
/** Storico di una copertura senza estensioni, in mesi di calendario. */
const premiumHistoryMonths = 12;

/** Giorni della finestra senza estensioni che termina all'istante indicato. */
export function historyWindowDays(premium: boolean, now: Date) {
  if (!premium) return freeHistoryDays;
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - premiumHistoryMonths);
  return Math.round((now.getTime() - start.getTime()) / dayMilliseconds);
}

const utcSql = (from: string, modifier: string) =>
  `strftime('%Y-%m-%dT%H:%M:%fZ', ${from}, ${modifier})`;

/** Mesi dello storico di uno spazio coperto: l'estensione valida più lunga, altrimenti un anno. */
export function coveredMonthsSql(workspace: string, at: string) {
  return `COALESCE((SELECT MAX(x.months) FROM history_extensions x
    WHERE x.workspace_id = ${workspace} AND julianday(x.granted_at) <= julianday(${at})
      AND (x.revoked_at IS NULL OR julianday(${at}) < julianday(x.revoked_at))),
    ${premiumHistoryMonths})`;
}

/** Termine di un ordine creato all'istante `creation`, con la finestra dello spazio a `at`. */
export function historyEndSql(creation: string, workspace: string, at: string) {
  return `CASE WHEN ${activeEntitlementSql(workspace, at)}
    THEN ${utcSql(creation, `'+' || ${coveredMonthsSql(workspace, at)} || ' months'`)}
    ELSE ${utcSql(creation, `'+${freeHistoryDays} days'`)} END`;
}

/** Inizio della finestra dello spazio all'istante `at`: il limite più vecchio da importare. */
export function historyStartSql(workspace: string, at: string) {
  return `CASE WHEN ${activeEntitlementSql(workspace, at)}
    THEN ${utcSql(at, `'-' || ${coveredMonthsSql(workspace, at)} || ' months'`)}
    ELSE ${utcSql(at, `'-${freeHistoryDays} days'`)} END`;
}

/** Spazio del negozio indicato. */
export const storeWorkspaceSql = (store: string) =>
  `(SELECT workspace_id FROM ebay_stores WHERE id = ${store})`;
