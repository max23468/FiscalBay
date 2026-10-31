/** Elenco SQL di costanti scritte nel codice, mai di valori arrivati dall'esterno. */
export const sqlList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");
