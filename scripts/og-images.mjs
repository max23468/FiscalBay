#!/usr/bin/env node
/**
 * Immagini delle condivisioni, 1200×630, per ogni pagina della sitemap e lingua: logo, titolo
 * della pagina e descrittore del servizio sul blu del marchio, come le righe della tessera del
 * logo. I testi arrivano dai testi del sito, così restano allineati ai titoli. Scrive i PNG in
 * `public/og/` con i nomi letti da `ogImage` in `app/site-meta.ts`.
 *
 * Da rieseguire quando cambiano titoli delle pagine o guide: `pnpm site:og`.
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { guides } from "../app/copy/guides.server.ts";
import { sitePages } from "../app/copy/site-pages.server.ts";

const output = "public/og";
const logo = readFileSync("docs/brand/logo/fiscalbay-logo-dark.svg", "utf8");
const font = readFileSync(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
).toString("base64");

/** Nome del file, titolo grande e riga sotto, per pagina e lingua. */
function images(language) {
  const pages = sitePages[language];
  const t = guides[language];
  const descriptor = pages.home.title;
  return [
    ["fiscalbay", pages.home.hero, descriptor],
    ["funzionalita", pages.features.metaTitle, descriptor],
    ["prezzi", pages.pricing.metaTitle, pages.pricing.lead],
    ["sicurezza", pages.security.metaTitle, pages.security.summary[0].title],
    ["faq", pages.faq.metaTitle, descriptor],
    ["supporto", language === "it" ? "Supporto FiscalBay" : "FiscalBay support", descriptor],
    ["guide", t.index.metaTitle, descriptor],
    ...Object.entries(t.articles).map(([page, article]) => [
      page.slice(1).replaceAll("/", "-"),
      article.title,
      t.index.title,
    ]),
  ];
}

const html = (title, subtitle) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0e3372; font-family: Inter, sans-serif; color: #fff; position: relative; }
  .logo { position: absolute; left: 80px; top: 72px; height: 62px; }
  .logo svg { height: 62px; width: auto; }
  h1 { position: absolute; left: 80px; right: 220px; top: 210px; font-size: 64px; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; text-wrap: balance; }
  p { position: absolute; left: 80px; right: 360px; bottom: 72px; font-size: 28px; color: rgb(255 255 255 / 0.8); }
  .lines { position: absolute; right: -60px; bottom: 40px; transform: rotate(-8deg); display: grid; gap: 28px; justify-items: end; opacity: 0.25; }
  .lines span { height: 36px; border-radius: 18px; }
</style></head><body>
  <div class="logo">${logo}</div>
  <h1>${title}</h1>
  <p>${subtitle}</p>
  <div class="lines"><span style="width:420px;background:#4f87e3"></span><span style="width:300px;background:#1f9f9a"></span><span style="width:160px;background:#da353e"></span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const language of ["it", "en"])
  for (const [name, title, subtitle] of images(language)) {
    await page.setContent(html(title, subtitle), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(output, `${name}-${language}.png`);
    writeFileSync(file, await page.screenshot({ type: "png" }));
    console.log(file);
  }
await browser.close();
