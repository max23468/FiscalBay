import type { DiffOptions } from "vitest";

/**
 * Diff degli errori della suite Cloudflare senza colori. Vitest confronta le stringhe un'unità
 * UTF-16 alla volta: fra due emoji con la stessa prima metà, come 💶 e 📦, il colore cade nel
 * mezzo e lascia metà isolate. Il worker le manda al processo dei test come UTF-8 non valido e
 * il WebSocket chiude la connessione: la prova fallita diventa un errore del pool, senza esito.
 */
const plain = (text: string) => text;

export default {
  aColor: plain,
  bColor: plain,
  changeColor: plain,
  commonColor: plain,
  patchColor: plain,
} satisfies DiffOptions;
