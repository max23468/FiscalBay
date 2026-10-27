import {
  maxConfigurationName,
  parseColumns,
  standardColumns,
  type ExportColumn,
  type ExportFormat,
  type ExportRows,
} from "../orders/export-columns";

/**
 * Configurazioni dell'esportazione salvate con Premium (§12): formato, granularità e colonne
 * nel loro ordine, con un nome unico per utente. Non contengono ambito, filtri o diritti: il
 * file si crea sempre con quelli correnti.
 */

export interface ExportConfiguration {
  id: string;
  name: string;
  format: ExportFormat;
  rows: ExportRows;
  columns: ExportColumn[];
}

export type ExportLayout = Omit<ExportConfiguration, "id" | "name">;

export const maxExportConfigurations = 20;

type ConfigurationRow = {
  id: string;
  name: string;
  format: ExportFormat;
  granularity: ExportRows;
  columns: string;
};

/** Configurazioni dell'utente in ordine di nome. */
export async function listExportConfigurations(
  db: D1Database,
  userId: string,
): Promise<ExportConfiguration[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, format, granularity, columns FROM export_configurations
        WHERE user_id = ? ORDER BY name, id`,
    )
    .bind(userId)
    .all<ConfigurationRow>();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    format: row.format,
    rows: row.granularity,
    // Una colonna non più prevista lascia le standard invece di un file senza colonne.
    columns: parseColumns(row.columns, row.granularity) ?? standardColumns(row.granularity),
  }));
}

/** Formato, granularità e colonne di un modulo; null se una scelta non è valida. */
export function parseExportLayout(form: FormData): ExportLayout | null {
  // Un campo assente vale "null", che non è una scelta valida.
  const format = String(form.get("format"));
  const rows = String(form.get("rows"));
  if ((format !== "csv" && format !== "xlsx") || (rows !== "order" && rows !== "item")) return null;
  const columns = parseColumns(String(form.get("columns")), rows);
  return columns ? { format, rows, columns } : null;
}

/** Nome della configurazione senza spazi agli estremi; null se vuoto o troppo lungo. */
export function parseConfigurationName(form: FormData): string | null {
  const name = String(form.get("name") ?? "").trim();
  return name && name.length <= maxConfigurationName ? name : null;
}

/**
 * Salva la configurazione con il suo nome: un nome già usato la sostituisce. Una nuova oltre il
 * limite non si salva e la funzione restituisce false; conteggio e scrittura stanno nella stessa
 * istruzione.
 */
export async function saveExportConfiguration(
  db: D1Database,
  userId: string,
  name: string,
  layout: ExportLayout,
  now: Date,
): Promise<boolean> {
  const saved = await db
    .prepare(
      `INSERT INTO export_configurations (id, user_id, name, format, granularity, columns, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
        WHERE (SELECT count(*) FROM export_configurations WHERE user_id = ?2) < ?8
           OR EXISTS (SELECT 1 FROM export_configurations WHERE user_id = ?2 AND name = ?3)
       ON CONFLICT (user_id, name) DO UPDATE SET
         format = excluded.format,
         granularity = excluded.granularity,
         columns = excluded.columns,
         updated_at = excluded.updated_at`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      name,
      layout.format,
      layout.rows,
      layout.columns.join(","),
      now.toISOString(),
      maxExportConfigurations,
    )
    .run();
  return saved.meta.changes > 0;
}

/** Elimina una configurazione dell'utente; false se non esiste o è di un altro utente. */
export async function deleteExportConfiguration(
  db: D1Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .prepare("DELETE FROM export_configurations WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return deleted.meta.changes > 0;
}
