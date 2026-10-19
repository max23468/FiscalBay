/**
 * Rilegge uno stato finché non è confermato o finché scade l'attesa, sempre entro il tempo
 * dello streaming della pagina. Restituisce l'ultima lettura, confermata o no.
 */
export async function settle<T>(
  read: () => Promise<T>,
  confirmed: (value: T) => boolean,
  { timeoutMs = 3_000, intervalMs = 750 } = {},
): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  let value = await read();
  while (!confirmed(value) && performance.now() + intervalMs < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    value = await read();
  }
  return value;
}
