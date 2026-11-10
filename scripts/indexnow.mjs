#!/usr/bin/env node
/**
 * Avvisa i motori che aderiscono a IndexNow (Bing e quelli che ne usano l'indice) delle pagine
 * della sitemap Production, dopo una promozione che aggiunge o cambia pagine pubbliche. La
 * chiave è pubblica per protocollo: il file `public/<chiave>.txt` prova che il dominio è nostro.
 * Crawler Hints di Cloudflare non basta: segnala i MISS della cache, e le pagine del sito escono
 * dal Worker con `no-store`.
 *
 * Uso: node scripts/indexnow.mjs <plan|submit>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bing aveva memorizzato come non valida la chiave precedente per fiscalbay.it e rifiutava ogni
// invio con `UserForbiddedToAccessSite`, mentre la stessa chiave valeva per test.fiscalbay.it.
export const indexNowKey = "0be556bd7bf90b7ed9f32568ef05ac3d";

export const productionOrigin = "https://fiscalbay.it";

// L'endpoint comune condivide gli invii con tutti i motori che aderiscono, Bing compreso.
const endpoint = "https://api.indexnow.org/indexnow";

/** Indirizzi `<loc>` della sitemap, nell'ordine in cui compaiono. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(([, url]) => url);
}

/** Corpo della richiesta IndexNow: soltanto indirizzi dell'host Production. */
export function payload(urls, origin = productionOrigin) {
  const { host } = new URL(origin);
  const foreign = urls.filter((url) => new URL(url).host !== host);
  if (foreign.length) throw new Error(`Indirizzi fuori da ${host}: ${foreign.join(", ")}`);
  return {
    host,
    key: indexNowKey,
    keyLocation: `${origin}/${indexNowKey}.txt`,
    urlList: urls,
  };
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command !== "plan" && command !== "submit") throw new Error("Comandi: plan, submit");
  const published = await fetch(`${productionOrigin}/${indexNowKey}.txt`);
  if ((await published.text()).trim() !== indexNowKey)
    throw new Error("Il file della chiave IndexNow non è pubblicato in Production.");
  const sitemap = await fetch(`${productionOrigin}/sitemap.xml`);
  if (!sitemap.ok) throw new Error(`Sitemap: HTTP ${sitemap.status}`);
  const body = payload(sitemapUrls(await sitemap.text()));
  if (command === "plan") return console.log(JSON.stringify(body, null, 2));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  // 200 e 202 sono accettazioni; gli altri codici spiegano il rifiuto nel corpo.
  if (response.status !== 200 && response.status !== 202)
    throw new Error(`IndexNow: HTTP ${response.status} ${await response.text()}`);
  console.log(JSON.stringify({ ok: true, status: response.status, urls: body.urlList.length }));
}

/** Chiave letta dal file pubblicato con il sito, per il test di coerenza. */
export function publishedKey(root = path.dirname(fileURLToPath(import.meta.url))) {
  return readFileSync(path.join(root, "..", "public", `${indexNowKey}.txt`), "utf8");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
