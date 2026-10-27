/** Nome del file proposto dal server, senza dati personali. */
function fileName(response: Response) {
  return /filename="([^"]+)"/u.exec(response.headers.get("content-disposition") ?? "")?.[1];
}

/**
 * Salva il file di una risposta riuscita. Il file arriva intero prima del salvataggio: un flusso
 * interrotto non diventa un file.
 */
export async function saveFile(response: Response) {
  const href = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName(response) ?? "fiscalbay";
  link.click();
  // Safari legge l'oggetto dopo il clic: si libera più tardi.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/**
 * Scarica un file esportato dal suo percorso autenticato. Restituisce l'avviso del server se il
 * file non è più disponibile, null se il file è stato salvato.
 */
export async function downloadExport(href: string): Promise<string | null> {
  const response = await fetch(href, {
    headers: { accept: "application/octet-stream, application/json" },
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { notice?: string } | null;
    return result?.notice ?? "";
  }
  await saveFile(response);
  return null;
}
