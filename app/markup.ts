/**
 * Testo dentro HTML o XML: i caratteri riservati indicati diventano entità. Il valore
 * predefinito vale per il testo e per un attributo fra virgolette doppie; l'HTML di Telegram
 * sostituisce soltanto `&`, `<` e `>`, una richiesta XML anche l'apostrofo.
 */
export function escapeMarkup(value: string, reserved = /[&<>"]/gu): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(reserved, (char) => entities[char]!);
}
