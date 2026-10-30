#!/usr/bin/env node
/**
 * Immagini del sito pubblico prese dalle schermate reali dell'anteprima, con i soli dati di
 * esempio: ogni immagine è ritagliata sull'elemento, senza la barra dell'anteprima, in italiano e
 * inglese e nei temi chiaro e scuro. Il messaggio Telegram, che l'app non mostra, è ricostruito
 * con il formato di `orderMessage` sul tema di Telegram. Scrive i WebP in `public/site/` e le
 * dimensioni in `app/site-shots.json`, letto dalle pagine per riservare lo spazio.
 *
 * Da rieseguire quando cambiano le schermate mostrate dal sito, su una preview locale della build:
 *   pnpm build && E2E_PORT=5300 node scripts/local-preview.mjs
 *   node node_modules/vite/bin/vite.js preview .cloudflare/preview --config vite.config.ts --port 5300
 *   pnpm site:screenshots http://localhost:5300
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5186";
const output = "public/site";
const languages = ["it", "en"];
const schemes = ["light", "dark"];

/**
 * Schermate: percorso dell'anteprima, scenario, finestra, elemento da ritagliare e densità. Le
 * pagine intere stanno a densità 1 perché il sito le mostra rimpicciolite; i dettagli a 2.
 * `mobile` cambia la finestra, ed eventualmente il ritaglio, della variante `<nome>-mobile`
 * che il sito usa sotto i 640 px, dove una schermata larga sarebbe illeggibile.
 */
const phone = { width: 390, height: 1400 };
const shots = [
  {
    name: "ordini",
    path: "/anteprima/ordini",
    scenario: "premium",
    viewport: { width: 1280, height: 800 },
    scale: 1,
    mobile: { viewport: { width: 390, height: 640 }, scale: 2 },
  },
  {
    name: "scheda",
    path: "/anteprima/ordini",
    scenario: "premium",
    // In una colonna la scheda non condivide le righe con quella accanto: nessuno spazio vuoto.
    viewport: { width: 720, height: 1400 },
    element: 'article:has-text("27-10293-84756")',
    scale: 2,
    mobile: { viewport: phone },
  },
  {
    name: "negozi",
    path: "/anteprima/negozi",
    scenario: "premium",
    viewport: { width: 1180, height: 1000 },
    region: ["main h1", "main table"],
    scale: 2,
    // Su smartphone i negozi sono un elenco, non una tabella.
    mobile: { viewport: phone, region: ["main h1", "main ul"] },
  },
  {
    name: "sicurezza",
    path: "/anteprima/impostazioni/sicurezza",
    scenario: "premium",
    viewport: { width: 1000, height: 1600 },
    // Il bordo che separa il gruppo dall'email resta fuori dall'immagine.
    hide: { borderTop: 'section[aria-labelledby="security-methods"]' },
    region: [
      'section[aria-labelledby="security-methods"]',
      'section[aria-labelledby="security-sessions"]',
    ],
    scale: 2,
    // Su smartphone le sessioni allungherebbero troppo l'immagine.
    mobile: { viewport: phone, region: ['section[aria-labelledby="security-methods"]'] },
  },
];

/** Messaggio di un nuovo ordine come lo invia il bot, con l'ordine «ord-02» dell'anteprima. */
const telegram = {
  it: {
    title: "Nuovo ordine",
    today: "oggi",
    open: "Apri in FiscalBay",
    ebay: "Apri su eBay",
    copy: "Copia Codice Fiscale",
    total: "49,90 €",
  },
  en: {
    title: "New order",
    today: "today",
    open: "Open in FiscalBay",
    ebay: "Open on eBay",
    copy: "Copy tax code",
    total: "€49.90",
  },
};

function telegramPage(language, scheme) {
  const t = telegram[language];
  const dark = scheme === "dark";
  const colors = dark
    ? {
        chat: "#0e1621",
        bubble: "#182533",
        text: "#f5f5f5",
        muted: "#7f91a4",
        quote: "#6ab3f3",
        button: "rgba(43,82,120,.75)",
        code: "#6ab3f3",
        head: "#17212b",
      }
    : {
        chat: "#c4d6a7",
        bubble: "#ffffff",
        text: "#000000",
        muted: "#7c8b95",
        quote: "#3a8fd6",
        // Più scuro di Telegram: il testo bianco dei pulsanti resta oltre 4,5:1 (5,6:1).
        button: "rgba(0,0,0,.5)",
        code: "#2b6cb0",
        head: "#ffffff",
      };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; font: 15px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; color: ${colors.text}; }
    #shot { width: 420px; background: ${colors.chat}; }
    header { display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: ${colors.head}; }
    header img { width: 38px; height: 38px; border-radius: 50%; }
    header b { display: block; } header span { color: ${colors.muted}; font-size: 13px; }
    .chat { padding: 16px 12px 14px; display: grid; gap: 6px; }
    .bubble { background: ${colors.bubble}; border-radius: 14px 14px 14px 4px; padding: 8px 12px 6px; }
    code { font: 14px ui-monospace, Menlo, monospace; color: ${colors.code}; }
    blockquote { margin: 6px 0 2px; padding: 2px 8px; border-left: 3px solid ${colors.quote}; border-radius: 3px; background: ${colors.quote}1a; }
    .time { text-align: right; color: ${colors.muted}; font-size: 12px; }
    .row { display: flex; gap: 6px; }
    .row span { flex: 1; text-align: center; padding: 9px 6px; border-radius: 10px; background: ${colors.button}; color: #fff; font-size: 14px; font-weight: 500; }
  </style></head><body><div id="shot">
    <header><img src="${base}/apple-touch-icon.png" alt=""><div><b>FiscalBay</b><span>bot</span></div></header>
    <div class="chat"><div class="bubble">
      🛒 <b>${t.title}</b> · Vintage Garage Italia<br>
      🧾 <code>RSSMRA80A41H501Y</code>
      <blockquote>👤 Maria Rossi<br>💶 <b>${t.total}</b><br>📦 1 × Carburatore Dell’Orto PHBG 19 revisionato<br>🕑 <i>${t.today} 14:22 · 27-10293-84756</i></blockquote>
      <div class="time">14:22</div>
    </div>
    <div class="row"><span>🔗 ${t.open}</span><span>🛍 ${t.ebay}</span></div>
    <div class="row"><span>📋 ${t.copy}</span></div></div>
  </div></body></html>`;
}

/**
 * File dell'esportazione aperto in un foglio di calcolo: colonne dell'export e ordini
 * dell'anteprima, con il dato fiscale soltanto dove è disponibile.
 */
const sheet = {
  it: {
    file: "fiscalbay-ordini-2026-09-27.xlsx",
    columns: [
      "Numero ordine",
      "Data",
      "Acquirente",
      "Codice Fiscale",
      "Partita IVA",
      "Totale ordine",
    ],
    decimal: ",",
  },
  en: {
    file: "fiscalbay-orders-2026-09-27.xlsx",
    columns: ["Order number", "Date", "Buyer", "Codice Fiscale", "Partita IVA", "Order total"],
    decimal: ".",
  },
};
const sheetRows = [
  ["40-10001-20002", "27/09/2026 14:57", "Giorgio Neri", "NREGRG80A01G337P", "", "18.40"],
  [
    "12-34567-89012",
    "27/09/2026 14:22",
    "Società Cooperativa Agricola Val di Non",
    "",
    "01234567897",
    "1259.00",
  ],
  ["27-10293-84756", "27/09/2026 13:25", "Maria Rossi", "RSSMRA80A41H501Y", "", "49.90"],
  [
    "11-60325-94410",
    "25/09/2026 19:40",
    "Elena Galli",
    "GLLLNE82D45A794P",
    "03456789019",
    "212.00",
  ],
  ["25-30491-88120", "24/09/2026 07:00", "Roberto Ricci", "RCCRRT77B10G702J", "", "30.00"],
];

/**
 * `columns` sceglie le colonne e `compact` tiene i soli ordini con il Codice Fiscale: su
 * smartphone restano ordine, acquirente e Codice Fiscale in un foglio abbastanza stretto da leggersi.
 */
function sheetPage(language, scheme, columns = [0, 1, 2, 3, 4, 5], compact = false) {
  const t = sheet[language];
  const c =
    scheme === "dark"
      ? {
          bg: "#1f1f1f",
          bar: "#2b2b2b",
          grid: "#3a3a3a",
          text: "#e8e8e8",
          head: "#333",
          muted: "#9a9a9a",
          accent: "#4caf7a",
        }
      : {
          bg: "#ffffff",
          bar: "#f3f3f3",
          grid: "#dcdcdc",
          text: "#1f1f1f",
          head: "#f0f0f0",
          muted: "#6b6b6b",
          accent: "#1d7a46",
        };
  const letters = ["", ...columns.map((_, index) => "ABCDEF"[index])];
  const rows = [
    t.columns,
    ...sheetRows
      .filter((row) => !compact || row[3] !== "")
      .map((row) => [...row.slice(0, 5), row[5].replace(".", t.decimal)]),
  ].map((row) => columns.map((column) => row[column]));
  const cellClass = (row, column) =>
    row === 0
      ? ""
      : columns[column] === 5
        ? "num"
        : columns[column] === 3 || columns[column] === 4
          ? "code"
          : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; font: 13px -apple-system, "Segoe UI", Roboto, sans-serif; color: ${c.text}; }
    #shot { display: inline-block; background: ${c.bg}; border: 1px solid ${c.grid}; }
    .title { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: ${c.bar}; border-bottom: 1px solid ${c.grid}; }
    .title i { width: 16px; height: 16px; border-radius: 3px; background: ${c.accent}; }
    table { border-collapse: collapse; }
    td, th { border: 1px solid ${c.grid}; padding: 5px 9px; white-space: nowrap; text-align: left; }
    th { background: ${c.head}; color: ${c.muted}; font-weight: 500; text-align: center; }
    tr:nth-child(2) td { font-weight: 600; }
    td.num { text-align: right; } td.code { font-family: ui-monospace, Menlo, monospace; }
  </style></head><body><div id="shot">
    <div class="title"><i></i>${t.file}</div>
    <table><tr>${letters.map((letter) => `<th>${letter}</th>`).join("")}</tr>${rows
      .map(
        (row, index) =>
          `<tr><th>${index + 1}</th>${row
            .map((cell, column) => `<td class="${cellClass(index, column)}">${cell}</td>`)
            .join("")}</tr>`,
      )
      .join("")}</table>
  </div></body></html>`;
}

/** Riquadro che contiene gli elementi indicati, con un margine uniforme. */
async function region(page, selectors, margin = 16) {
  const boxes = await Promise.all(
    selectors.map((selector) => page.locator(selector).first().boundingBox()),
  );
  const left = Math.max(Math.min(...boxes.map((box) => box.x)) - margin, 0);
  const top = Math.max(Math.min(...boxes.map((box) => box.y)) - margin, 0);
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + margin;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + margin;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** WebP dal PNG della schermata, codificato da Chromium: nessuno strumento esterno. */
async function webp(page, png) {
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = Object.assign(document.createElement("canvas"), {
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    canvas.getContext("2d").drawImage(image, 0, 0);
    return {
      data: canvas.toDataURL("image/webp", 0.86).split(",")[1],
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }, png.toString("base64"));
}

async function capture(browser, shot, language, scheme) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    colorScheme: scheme,
    reducedMotion: "reduce",
    locale: language === "it" ? "it-IT" : "en-GB",
    timezoneId: "Europe/Rome",
  });
  const page = await context.newPage();
  const prefix = language === "it" ? "" : "/en";
  await page.request.post(`${base}${prefix}/anteprima`, {
    form: { scenario: shot.scenario, redirectTo: `${prefix}/anteprima/ordini` },
    maxRedirects: 0,
  });
  await page.goto(`${base}${prefix}${shot.path}`, { waitUntil: "networkidle" });
  await page.locator("#preview-scenario").waitFor();
  // La barra dell'anteprima non fa parte del prodotto.
  await page.evaluate(() => {
    document.querySelector("#preview-scenario")?.closest(".border-b")?.remove();
  });
  // Le barre fisse dell'app stanno nelle sole schermate a tutto schermo.
  if (shot.element || shot.region)
    await page.evaluate(() => {
      for (const element of document.querySelectorAll("body *"))
        if (getComputedStyle(element).position === "fixed") element.remove();
    });
  if (shot.hide?.borderTop)
    await page.locator(shot.hide.borderTop).evaluate((element) => {
      element.style.borderTop = "none";
    });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = shot.element
    ? await page.locator(shot.element).first().screenshot({ animations: "disabled" })
    : await page.screenshot({
        animations: "disabled",
        ...(shot.region ? { clip: await region(page, shot.region) } : {}),
      });
  const encoded = await webp(page, png);
  await context.close();
  return encoded;
}

async function captureHtml(browser, html, scheme) {
  const page = await browser.newPage({ deviceScaleFactor: 2, colorScheme: scheme });
  await page.setContent(html, { waitUntil: "networkidle" });
  const png = await page.locator("#shot").screenshot();
  const encoded = await webp(page, png);
  await page.close();
  return encoded;
}

const browser = await chromium.launch();
mkdirSync(output, { recursive: true });
const sizes = {};
const write = async (name, language, scheme, image, scale) => {
  const file = `${name}-${language}-${scheme}.webp`;
  const bytes = Buffer.from(image.data, "base64");
  writeFileSync(path.join(output, file), bytes);
  // Dimensioni CSS della variante chiara: il tema scuro ha la stessa impaginazione.
  if (scheme === "light") {
    sizes[name] ??= {};
    sizes[name][language] = {
      width: Math.round(image.width / scale),
      height: Math.round(image.height / scale),
    };
  }
  console.log(`${file} ${(bytes.length / 1024).toFixed(0)} KiB`);
};
for (const language of languages)
  for (const scheme of schemes) {
    for (const shot of shots) {
      await write(
        shot.name,
        language,
        scheme,
        await capture(browser, shot, language, scheme),
        shot.scale,
      );
      if (shot.mobile) {
        const mobile = { ...shot, ...shot.mobile };
        await write(
          `${shot.name}-mobile`,
          language,
          scheme,
          await capture(browser, mobile, language, scheme),
          mobile.scale,
        );
      }
    }
    await write(
      "telegram",
      language,
      scheme,
      await captureHtml(browser, telegramPage(language, scheme), scheme),
      2,
    );
    await write(
      "esportazione",
      language,
      scheme,
      await captureHtml(browser, sheetPage(language, scheme), scheme),
      2,
    );
    await write(
      "esportazione-mobile",
      language,
      scheme,
      await captureHtml(browser, sheetPage(language, scheme, [0, 2, 3], true), scheme),
      2,
    );
  }
await browser.close();
writeFileSync("app/site-shots.json", `${JSON.stringify(sizes, null, 2)}\n`);
