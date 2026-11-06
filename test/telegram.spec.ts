import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { forward } from "../telegram-worker/forward";
import { setSwitch } from "../app/domain/service-settings.server";
import { noticesOf } from "../app/domain/telegram-deliveries.server";
import type { VisibleOrder } from "../app/domain/orders.server";
import * as orderReads from "../app/domain/orders.server";
import {
  copyButtons,
  digestMessage,
  emptyFiscalKey,
  fiscalDigest,
  fiscalKey,
  importMessage,
  orderEntry,
  orderMessage,
  orderNotice,
  settingsUrl,
  splitBlocks,
  zoneName,
  type OrderNotice,
} from "../app/domain/telegram-messages.server";
import {
  consumeTelegramStart,
  parseTelegramChange,
  saveTelegramChange,
  startTelegramLink,
  storeNotifications,
  telegramRecipient,
  telegramSettings,
} from "../app/domain/telegram.server";
import {
  chatLabel,
  editMessage,
  sendMessage,
  sendText,
  telegramConfigured,
  linkToken as randomLinkToken,
  botUrl,
  verifyTelegramUpdate,
  type TelegramStart,
} from "../app/integrations/telegram.server";
import { consumeWebhooks, receiveWebhook } from "../app/webhooks.server";
import { ebayOrderHref } from "../app/orders/ebay-links";
import { formatAmount } from "../app/i18n";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { loader as storesLoader } from "../app/routes/stores";
import { verifiedSession } from "./fixtures/account-fixtures";
import {
  insertOrder,
  insertStorePause,
  later,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { appUrl } from "../app/app-links";
import { queueMessage } from "./fixtures/queue-fixture";
import { routePage } from "./fixtures/route-fixtures";
import { fakeBot as bot } from "./fixtures/telegram-fixtures";
import {
  origin,
  secret,
  send,
  environment,
  account,
  settingsForm,
  linkToken,
  update,
  endpoint,
  webhook,
  deliver,
  link,
  nextUpdateId,
} from "./fixtures/telegram-scenarios";

beforeEach(async () => {
  await resetDatabase();
  send.mockClear();
});

describe("testi dei messaggi", () => {
  const site = { APP_ORIGIN: "https://fiscalbay.invalid/percorso" };
  // Importo nella forma condivisa con l'app, spazi tipografici compresi.
  const amountIt = formatAmount(124950, "EUR", "it");
  const amountEn = formatAmount(124950, "EUR", "en");
  const at = new Date("2026-10-25T21:30:00Z");
  const cf = { kind: "CF" as const, label: null, value: "RSSMRA80A01H501U" };
  const vat = { kind: "PIVA" as const, label: null, value: "IT01234567890" };
  const notice = (fields: Partial<OrderNotice> = {}): OrderNotice => ({
    id: "o-1",
    ebayOrderId: "12-34567-89012",
    environment: "production",
    storeName: "Negozio <A&B>",
    createdAt: "2026-10-25T13:03:00Z",
    buyer: "Mario Rossi",
    items: [{ title: "Lampada", quantity: 2 }],
    imageUrl: null,
    totalMinor: 124950,
    currency: "EUR",
    fiscal: "available",
    country: null,
    values: [cf],
    ...fields,
  });
  const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ title: `Articolo ${index + 1}`, quantity: 1 }));
  const orderLink = "https://fiscalbay.invalid/app/ordini/o-1";
  const ebay = { text: "🛍 Apri su eBay", url: ebayOrderHref("12-34567-89012") };
  const copyCf = { text: "📋 Copia Codice Fiscale", copy_text: { text: cf.value } };

  it("riempie ogni messaggio fino al limite esatto e spezza per righe soltanto i blocchi troppo lunghi", () => {
    expect(splitBlocks([])).toEqual([]);
    expect(splitBlocks(["ab", "cd"], 6)).toEqual(["ab\n\ncd"]);
    expect(splitBlocks(["abc", "cd"], 6)).toEqual(["abc", "cd"]);
    // Un blocco che sta in un messaggio, anche al limite esatto, non si divide fra due.
    expect(splitBlocks(["aaaa", "b\nc"], 8)).toEqual(["aaaa", "b\nc"]);
    expect(splitBlocks(["a", "bb\nccc"], 6)).toEqual(["a", "bb\nccc"]);
    // Le righe di un blocco lungo restano separate dal blocco precedente come i blocchi.
    expect(splitBlocks(["x", `yy\nww\n${"z".repeat(10)}`], 10)).toEqual([
      "x\n\nyy\nww",
      "z".repeat(10),
    ]);
  });

  it("compone il nuovo ordine con dato fiscale, dettagli in citazione e pulsanti", () => {
    expect(orderMessage(site, "it", "Europe/Rome", notice(), "new", at)).toEqual([
      {
        html:
          "🛒 <b>Nuovo ordine</b> · Negozio &lt;A&amp;B&gt;\n🧾 <code>RSSMRA80A01H501U</code>\n\n" +
          `<blockquote>👤 Mario Rossi\n💶 <b>${amountIt}</b>\n📦 2 × Lampada\n` +
          "🕑 <i>oggi 14:03 · 12-34567-89012</i></blockquote>",
        buttons: [[{ text: "🔗 Apri in FiscalBay", url: orderLink }, ebay], [copyCf]],
      },
    ]);
  });

  it("in verifica avvisa del prossimo messaggio; oltre tre articoli li conta", () => {
    expect(
      orderMessage(
        site,
        "it",
        "Europe/Rome",
        notice({
          environment: "sandbox",
          buyer: null,
          items: items(4),
          imageUrl: "https://i.ebayimg.com/a.jpg",
          fiscal: "checking",
          values: [],
        }),
        "new",
        at,
      ),
    ).toEqual([
      {
        html:
          "🛒 <b>Nuovo ordine</b> · Negozio &lt;A&amp;B&gt;\n⏳ Codice Fiscale in verifica\n" +
          `Se arriva, ricevi un nuovo messaggio.\n\n<blockquote>💶 <b>${amountIt}</b>\n` +
          "📦 1 × Articolo 1\n📦 1 × Articolo 2\n📦 1 × Articolo 3\ne un altro articolo\n" +
          "🕑 <i>oggi 14:03 · 12-34567-89012</i></blockquote>",
        buttons: [[{ text: "🔗 Apri in FiscalBay", url: `${orderLink}?environment=sandbox` }]],
        preview: "https://i.ebayimg.com/a.jpg",
      },
    ]);
    // Soltanto il nuovo ordine in verifica annuncia il messaggio successivo.
    const [changed] = orderMessage(
      site,
      "it",
      "Europe/Rome",
      notice({ fiscal: "checking", items: items(3), values: [vat, cf] }),
      "changed",
      at,
    );
    expect(changed).toEqual({
      html:
        "✏️ <b>Codice Fiscale aggiornato</b> · Negozio &lt;A&amp;B&gt;\n" +
        "🧾 P.IVA <code>IT01234567890</code>\n🧾 <code>RSSMRA80A01H501U</code>\n\n" +
        `<blockquote>👤 Mario Rossi\n💶 <b>${amountIt}</b>\n📦 1 × Articolo 1\n` +
        "📦 1 × Articolo 2\n📦 1 × Articolo 3\n🕑 <i>oggi 14:03 · 12-34567-89012</i></blockquote>",
      buttons: [[{ text: "🔗 Apri in FiscalBay", url: orderLink }, ebay], [copyCf]],
    });
    // Con la sola Partita IVA il pulsante la nomina e la copia.
    expect(
      orderMessage(site, "it", "Europe/Rome", notice({ values: [vat] }), "new", at)[0]!.buttons,
    ).toEqual([
      [{ text: "🔗 Apri in FiscalBay", url: orderLink }, ebay],
      [{ text: "📋 Copia Partita IVA", copy_text: { text: vat.value } }],
    ]);
    expect(
      orderMessage(site, "en", "Europe/Rome", notice({ values: [vat] }), "new", at)[0]!
        .buttons?.[1],
    ).toEqual([{ text: "📋 Copy VAT number", copy_text: { text: vat.value } }]);
    expect(
      orderMessage(site, "it", "Europe/Rome", notice({ items: items(5) }), "new", at)[0]!.html,
    ).toContain("📦 1 × Articolo 3\ne altri 2 articoli\n🕑");
    expect(
      orderMessage(site, "it", "Europe/Rome", notice({ values: [] }), "removed", at)[0]!.html,
    ).toMatch(
      /^⚠️ <b>Codice Fiscale rimosso<\/b> · Negozio &lt;A&amp;B&gt;\nIl codice notificato in precedenza non è più nell'ordine\.\n\n/u,
    );
    // Senza dato fiscale non c'è il pulsante di copia.
    expect(
      orderMessage(site, "it", "Europe/Rome", notice({ values: [] }), "new", at)[0]!.buttons,
    ).toEqual([[{ text: "🔗 Apri in FiscalBay", url: orderLink }, ebay]]);
  });

  it("in inglese la rimozione spiega il dato precedente e conta gli articoli in più", () => {
    expect(
      orderMessage(
        site,
        "en",
        "Europe/Rome",
        notice({ items: items(5), fiscal: "missing", values: [] }),
        "removed",
        at,
      ),
    ).toEqual([
      {
        html:
          "⚠️ <b>Tax code removed</b> · Negozio &lt;A&amp;B&gt;\n" +
          "The code notified earlier is no longer in the order.\n➖ No tax code\n\n" +
          `<blockquote>👤 Mario Rossi\n💶 <b>${amountEn}</b>\n📦 1 × Articolo 1\n` +
          "📦 1 × Articolo 2\n📦 1 × Articolo 3\nand 2 more items\n" +
          "🕑 <i>today 14:03 · 12-34567-89012</i></blockquote>",
        buttons: [
          [
            { text: "🔗 Open in FiscalBay", url: "https://fiscalbay.invalid/en/app/orders/o-1" },
            { text: "🛍 Open on eBay", url: ebayOrderHref("12-34567-89012") },
          ],
        ],
      },
    ]);
    const english = (fields: Partial<OrderNotice>, change: "new" | "available" | "changed") =>
      orderMessage(site, "en", "Europe/Rome", notice(fields), change, at)[0]!;
    expect(english({ items: items(4), values: [vat, cf] }, "available")).toEqual({
      html:
        "✅ <b>Tax code available</b> · Negozio &lt;A&amp;B&gt;\n🧾 VAT <code>IT01234567890</code>\n" +
        `🧾 <code>RSSMRA80A01H501U</code>\n\n<blockquote>👤 Mario Rossi\n💶 <b>${amountEn}</b>\n` +
        "📦 1 × Articolo 1\n📦 1 × Articolo 2\n📦 1 × Articolo 3\nand one more item\n" +
        "🕑 <i>today 14:03 · 12-34567-89012</i></blockquote>",
      buttons: [
        [
          { text: "🔗 Open in FiscalBay", url: "https://fiscalbay.invalid/en/app/orders/o-1" },
          { text: "🛍 Open on eBay", url: ebayOrderHref("12-34567-89012") },
        ],
        [{ text: "📋 Copy Codice Fiscale", copy_text: { text: cf.value } }],
      ],
    });
    expect(english({ values: [] }, "changed").html).toMatch(
      /^✏️ <b>Tax code updated<\/b> · Negozio &lt;A&amp;B&gt;\n\n<blockquote>/u,
    );
    expect(english({ fiscal: "checking", values: [] }, "new").html).toMatch(
      /^🛒 <b>New order<\/b> · Negozio &lt;A&amp;B&gt;\n⏳ Tax code being checked\nIf it arrives, you get a new message\.\n\n/u,
    );
  });

  it("ogni stato fiscale senza valori ha la sua riga, nelle due lingue", () => {
    const line = (language: "it" | "en", fields: Partial<OrderNotice>) =>
      orderEntry(site, language, "Europe/Rome", notice({ values: [], ...fields }), null, at)
        .split("\n")
        .slice(2)
        .join("\n");
    const states = [
      [{ fiscal: "checking" }, "⏳ Codice Fiscale in verifica", "⏳ Tax code being checked"],
      [{ fiscal: "missing" }, "➖ Nessun Codice Fiscale", "➖ No tax code"],
      [
        { fiscal: "foreign", country: "DE" },
        "🌍 Fatturazione estera (DE)",
        "🌍 Billing abroad (DE)",
      ],
      [{ fiscal: "foreign" }, "🌍 Fatturazione estera ()", "🌍 Billing abroad ()"],
      [
        { fiscal: "error" },
        "⚠️ Codice Fiscale non letto: riprova da FiscalBay",
        "⚠️ Tax code not read: try again from FiscalBay",
      ],
      [{ fiscal: "locked" }, "🔒 Da sbloccare in FiscalBay", "🔒 To unlock in FiscalBay"],
      [{ fiscal: "available" }, "", ""],
    ] as const;
    for (const [fields, italian, english] of states) {
      expect(line("it", fields)).toBe(italian);
      expect(line("en", fields)).toBe(english);
    }
    // Gli identificativi esteri portano il proprio tipo e Paese, con l'escape dell'HTML.
    expect(
      line("en", { values: [{ kind: "OTHER", label: "VAT <DE>", value: "DE 123 & 4" }] }),
    ).toBe("🧾 VAT &lt;DE&gt; <code>DE 123 &amp; 4</code>");
  });

  it("accorcia articolo e acquirente oltre la lunghezza massima, con i puntini", () => {
    const html = (title: string, buyer: string) =>
      orderMessage(
        site,
        "it",
        "Europe/Rome",
        notice({ items: [{ title, quantity: 1 }], buyer }),
        "new",
        at,
      )[0]!.html;
    expect(html("t".repeat(80), "b".repeat(64))).toContain(
      `👤 ${"b".repeat(64)}\n💶 <b>${amountIt}</b>\n📦 1 × ${"t".repeat(80)}\n`,
    );
    expect(html("t".repeat(81), "b".repeat(65))).toContain(
      `👤 ${"b".repeat(63)}…\n💶 <b>${amountIt}</b>\n📦 1 × ${"t".repeat(79)}…\n`,
    );
  });

  it("un ordine troppo lungo per un messaggio porta pulsanti e anteprima soltanto nell'ultimo", () => {
    const messages = orderMessage(
      site,
      "it",
      "Europe/Rome",
      notice({ storeName: "N".repeat(5000), imageUrl: "https://i.ebayimg.com/a.jpg" }),
      "new",
      at,
    );
    expect(messages.map((message) => Object.keys(message))).toEqual([
      ["html"],
      ["html", "buttons", "preview"],
    ]);
    expect(messages.map(({ html }) => html).join("")).toContain("N".repeat(5000));
  });

  it("negli elenchi l'ordine apre il dettaglio e mostra la variazione se non è nuovo", () => {
    expect(orderEntry(site, "it", "Europe/Rome", notice(), "changed", at)).toBe(
      `<a href="${orderLink}">12-34567-89012</a> · Negozio &lt;A&amp;B&gt;\n` +
        "✏️ <i>Codice Fiscale aggiornato</i>\n" +
        `👤 Mario Rossi · 💶 <b>${amountIt}</b> · <i>oggi 14:03</i>\n` +
        "🧾 <code>RSSMRA80A01H501U</code>",
    );
    const plain =
      `<a href="${orderLink}?environment=sandbox">12-34567-89012</a> · Negozio &lt;A&amp;B&gt;\n` +
      `💶 <b>${amountIt}</b> · <i>oggi 14:03</i>\n🧾 <code>RSSMRA80A01H501U</code>`;
    for (const change of ["new", null] as const)
      expect(
        orderEntry(
          site,
          "it",
          "Europe/Rome",
          notice({ environment: "sandbox", buyer: null }),
          change,
          at,
        ),
      ).toBe(plain);
    expect(orderEntry(site, "en", "Europe/Rome", notice({ values: [] }), "removed", at)).toBe(
      '<a href="https://fiscalbay.invalid/en/app/orders/o-1">12-34567-89012</a> · Negozio &lt;A&amp;B&gt;\n' +
        `⚠️ <i>Tax code removed</i>\n👤 Mario Rossi · 💶 <b>${amountEn}</b> · <i>today 14:03</i>`,
    );
  });

  it("un pulsante di copia per Codice Fiscale presente nel testo, senza ripetizioni", () => {
    const other = "BNCLGU80A01H501Z";
    const notices = [
      notice({ values: [cf, vat] }),
      notice({ values: [cf, { kind: "CF", label: null, value: other }] }),
    ];
    expect(
      copyButtons(notices, `<code>${cf.value}</code> <code>${vat.value}</code> ${other}`),
    ).toEqual([[{ text: `📋 ${cf.value}`, copy_text: { text: cf.value } }]]);
    // Un ordine con la sola Partita IVA la offre da copiare.
    expect(copyButtons([notice({ values: [vat] })], `<code>${vat.value}</code>`)).toEqual([
      [{ text: `📋 ${vat.value}`, copy_text: { text: vat.value } }],
    ]);
  });

  it("il riepilogo conta gli ordini e apre i sette giorni nell'ambiente comune", () => {
    const day = "2026-10-25T20:00:00Z";
    const sandbox = notice({ environment: "sandbox" });
    expect(
      digestMessage(site, "it", "Europe/Rome", day, [{ notice: sandbox, change: "new" }], at),
    ).toEqual([
      {
        html:
          "🗓 <b>Riepilogo del 25 ott</b>\n<i>Un ordine dall'ultimo riepilogo</i>\n\n" +
          orderEntry(site, "it", "Europe/Rome", sandbox, "new", at),
        buttons: [
          [{ text: `📋 ${cf.value}`, copy_text: { text: cf.value } }],
          [
            {
              text: "🔗 Apri gli ordini",
              url: "https://fiscalbay.invalid/app/ordini?periodo=7&environment=sandbox",
            },
          ],
        ],
      },
    ]);
    const mixed = [
      { notice: sandbox, change: "new" as const },
      { notice: notice({ values: [] }), change: "removed" as const },
    ];
    const [english] = digestMessage(site, "en", "Europe/Rome", day, mixed, at);
    expect(english!.html).toMatch(
      /^🗓 <b>Summary of 25 Oct<\/b>\n<i>2 orders since the last summary<\/i>\n\n/u,
    );
    expect(english!.buttons!.at(-1)).toEqual([
      { text: "🔗 Open orders", url: "https://fiscalbay.invalid/en/app/orders?periodo=7" },
    ]);
    expect(
      digestMessage(site, "it", "Europe/Rome", day, [...mixed, ...mixed], at)[0]!.html,
    ).toContain("<i>4 ordini dall'ultimo riepilogo</i>");
    expect(digestMessage(site, "en", "Europe/Rome", day, [mixed[0]!], at)[0]!.html).toContain(
      "<i>One order since the last summary</i>",
    );
  });

  it("nel riepilogo suddiviso l'accesso agli ordini sta soltanto nell'ultimo messaggio", () => {
    const parts = digestMessage(
      site,
      "it",
      "Europe/Rome",
      "2026-10-25T20:00:00Z",
      [
        { notice: notice({ storeName: "A".repeat(3000), values: [] }), change: "new" },
        { notice: notice({ storeName: "B".repeat(3000) }), change: "new" },
      ],
      at,
    );
    expect(parts.map((part) => Object.keys(part))).toEqual([["html"], ["html", "buttons"]]);
    expect(parts[1]!.buttons).toEqual([
      [{ text: `📋 ${cf.value}`, copy_text: { text: cf.value } }],
      [{ text: "🔗 Apri gli ordini", url: "https://fiscalbay.invalid/app/ordini?periodo=7" }],
    ]);
  });

  it("l'importazione riassume ordini, dati fiscali e periodo nelle due lingue", () => {
    const summary = {
      storeId: "s-1",
      storeName: "Negozio <A&B>",
      environment: "production" as const,
      from: "2025-11-01T10:00:00Z",
      until: "2026-10-25T10:00:00Z",
      orders: 1,
      fiscal: 0,
    };
    expect(importMessage(site, "it", "Europe/Rome", summary, at)).toEqual({
      html:
        "📥 <b>Importazione completata</b> · Negozio &lt;A&amp;B&gt;\n" +
        "📦 Un ordine · 🧾 <b>0</b> con Codice Fiscale o P.IVA\n🗓 dal 1 nov 2025 al 25 ott\n" +
        "<i>Gli ordini importati non ricevono messaggi singoli: da ora arrivano quelli nuovi.</i>",
      buttons: [
        [{ text: "🔗 Apri gli ordini", url: "https://fiscalbay.invalid/app/ordini?negozio=s-1" }],
      ],
    });
    expect(
      importMessage(
        site,
        "en",
        "Europe/Rome",
        { ...summary, environment: "sandbox", orders: 3, fiscal: 2 },
        at,
      ),
    ).toEqual({
      html:
        "📥 <b>Import completed</b> · Negozio &lt;A&amp;B&gt;\n" +
        "📦 3 orders · 🧾 <b>2</b> with a tax code or VAT\n🗓 from 1 Nov 2025 to 25 Oct\n" +
        "<i>Imported orders get no individual messages: new orders arrive from now on.</i>",
      buttons: [
        [
          {
            text: "🔗 Open orders",
            url: "https://fiscalbay.invalid/en/app/orders?negozio=s-1&environment=sandbox",
          },
        ],
      ],
    });
    expect(importMessage(site, "it", "UTC", { ...summary, orders: 3 }, at).html).toContain(
      "📦 3 ordini · 🧾",
    );
    expect(importMessage(site, "en", "UTC", summary, at).html).toContain("📦 One order · 🧾");
  });

  it("indirizzi dell'app con ambiente e filtri, nomi dei fusi", () => {
    expect(appUrl(site, "it", "/app/ordini")).toBe("https://fiscalbay.invalid/app/ordini");
    expect(appUrl(site, "en", "/app/ordini", "sandbox")).toBe(
      "https://fiscalbay.invalid/en/app/orders?environment=sandbox",
    );
    expect(settingsUrl(site, "it")).toBe("https://fiscalbay.invalid/app/impostazioni/notifiche");
    expect(settingsUrl(site, "en")).toBe("https://fiscalbay.invalid/en/app/settings/notifications");
    expect(zoneName("it", "Europe/Rome")).toBe("Roma (Italia)");
    expect(zoneName("en", "Europe/Rome")).toBe("Rome (Italy)");
    expect(zoneName("it", "")).toBe("");
  });

  it("riduce l'ordine ai dati del messaggio e ne calcola l'impronta fiscale", async () => {
    const order = (buyer: unknown, taxIdentifiers: unknown[] = []) =>
      orderNotice(
        {
          id: "o-1",
          ebayOrderId: "12-34567-89012",
          storeName: "Negozio",
          creationTime: "2026-10-25T13:03:00Z",
          totalMinor: 100,
          currency: "EUR",
          fiscalState: "foreign",
          summary: {
            buyer,
            lineItems: [
              { title: "Uno", quantity: 1, imageUrl: null },
              { title: "Due", quantity: 2, imageUrl: "https://i.ebayimg.com/b.jpg" },
            ],
          },
          taxIdentifiers,
        } as unknown as VisibleOrder,
        "sandbox",
      );
    expect(
      order({ name: "MARIO ROSSI", username: "mrossi", billingAddress: { countryCode: "DE" } }, [
        { type: "CODICE_FISCALE", issuingCountry: "IT", value: "rssmra 80a01h501u" },
        { type: "PartitaIVA", issuingCountry: "IT", value: "it 01234567890" },
        { type: "CODICE_FISCALE", issuingCountry: "IT", value: "0123 4567 897" },
        { type: "VAT_ID", issuingCountry: null, value: "de 123" },
        { type: "VAT_ID", issuingCountry: "DE", value: "de 123" },
      ]),
    ).toEqual({
      id: "o-1",
      ebayOrderId: "12-34567-89012",
      environment: "sandbox",
      storeName: "Negozio",
      createdAt: "2026-10-25T13:03:00Z",
      buyer: "Mario Rossi",
      items: [
        { title: "Uno", quantity: 1 },
        { title: "Due", quantity: 2 },
      ],
      imageUrl: "https://i.ebayimg.com/b.jpg",
      totalMinor: 100,
      currency: "EUR",
      fiscal: "foreign",
      country: "DE",
      values: [
        { kind: "CF", label: null, value: "RSSMRA80A01H501U" },
        { kind: "PIVA", label: null, value: "IT01234567890" },
        { kind: "PIVA", label: null, value: "01234567897" },
        { kind: "OTHER", label: "VAT_ID", value: "de 123" },
        { kind: "OTHER", label: "VAT_ID · DE", value: "de 123" },
      ],
    });
    // Senza nome resta lo username; senza acquirente o indirizzo nessun Paese.
    expect(order({ name: null, username: "mrossi", billingAddress: null })).toMatchObject({
      buyer: "mrossi",
      country: null,
    });
    expect(order(null)).toMatchObject({ buyer: null, country: null });

    // L'impronta non dipende dall'ordine dei valori né dal nome mostrato dei codici italiani.
    const expected = await fiscalDigest(
      JSON.stringify([
        ["CF", null, vat.value],
        ["CF", null, cf.value],
      ]),
    );
    expect(await fiscalKey({ values: [cf, vat] })).toBe(expected);
    expect(await fiscalKey({ values: [vat, cf] })).toBe(expected);
    expect(await fiscalKey({ values: [] })).toBe(emptyFiscalKey);
    expect(expected).toMatch(/^"[\da-f]{64}"$/u);
  });
});

describe("riepiloghi lunghi", () => {
  beforeEach(resetDatabase);

  it("legge gli avvisi di tutti gli ordini, oltre il limite di una lettura", async () => {
    const { userId, workspace } = await account("lungo");
    const ids = Array.from({ length: 301 }, (_, index) => `lungo-${index}`);
    expect(workspace).toBe("w-lungo");
    for (let start = 0; start < ids.length; start += 50)
      await env.DB.batch(
        ids.slice(start, start + 50).flatMap((id) => insertOrder(id, { storeId: "s-lungo" })),
      );
    const list = orderReads.listVisibleOrders;
    const reads = vi.spyOn(orderReads, "listVisibleOrders").mockImplementation((...args) => {
      expect(reads.mock.calls.length).toBeLessThanOrEqual(2);
      const filter = args[5]!;
      expect(filter.ids!.length).toBeGreaterThan(0);
      expect(filter.ids!.length).toBeLessThanOrEqual(300);
      expect(filter.suggestions).toBe(false);
      return list(...args);
    });
    try {
      const notices = await noticesOf(
        env.DB,
        userId,
        ids.map((id) => ({ id, environment: "production" })),
        new Date(now),
      );
      expect(notices.size).toBe(301);
      expect(reads).toHaveBeenCalledTimes(2);
      expect(reads.mock.calls.map((args) => args[5]!.ids!.length)).toEqual([300, 1]);
      expect(reads.mock.calls.flatMap((args) => args[5]!.ids!).sort()).toEqual(ids.sort());
    } finally {
      reads.mockRestore();
    }
  });
});

describe("ingresso del bot", () => {
  it("rifiuta metodo, segreto e corpo non validi e accoglie soltanto /start in chat privata", async () => {
    const get = await receiveWebhook(new Request(endpoint), environment);
    expect(get?.status).toBe(405);
    expect(get?.headers.get("allow")).toBe("POST");
    expect((await receiveWebhook(webhook(update("/start")), environment))?.status).toBe(204);
    send.mockClear();
    expect((await receiveWebhook(webhook(update("/start"), null), environment))?.status).toBe(401);
    expect((await receiveWebhook(webhook(update("/start"), "altro"), environment))?.status).toBe(
      401,
    );
    const garbage = new Request("https://test.fiscalbay.it/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": secret },
      body: "{",
    });
    expect((await receiveWebhook(garbage, environment))?.status).toBe(412);
    const large = webhook({ update_id: 1, padding: "x".repeat(300_000) });
    expect((await receiveWebhook(large, environment))?.status).toBe(413);
    // Gruppi, altri messaggi e aggiornamenti senza messaggio non hanno effetti né ricevute.
    for (const body of [
      update("/start token", 501, "group"),
      update("ciao"),
      { update_id: nextUpdateId(), my_chat_member: {} },
    ])
      expect((await receiveWebhook(webhook(body), environment))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const receipts = await env.DB.prepare("SELECT COUNT(*) AS n FROM webhook_receipts").first<{
      n: number;
    }>();
    expect(receipts?.n).toBe(1);
  });

  it("senza il bot dell'ambiente l'ingresso non è disponibile", async () => {
    const off = { ...environment, TELEGRAM_BOT_TOKEN: undefined } as Env;
    expect(telegramConfigured(off)).toBe(false);
    // Una configurazione incompleta non rispetta i tipi dell'ambiente per costruzione.
    const blank = { ...environment, TELEGRAM_BOT_USERNAME: "" } as unknown as Env;
    expect(telegramConfigured(blank)).toBe(false);
    for (const change of [
      { TELEGRAM_BOT_USERNAME: undefined },
      { TELEGRAM_WEBHOOK_SECRET: undefined },
      { TELEGRAM_BOT_USERNAME: "@FiscalBayTestBot" },
      { TELEGRAM_BOT_USERNAME: "FiscalBayTestBot!" },
      { TELEGRAM_WEBHOOK_SECRET: `!${"a".repeat(40)}` },
      { TELEGRAM_WEBHOOK_SECRET: `${"a".repeat(40)}!` },
    ])
      expect(telegramConfigured({ ...environment, ...change } as Env)).toBe(false);
    expect(telegramConfigured({ ...environment, TELEGRAM_WEBHOOK_SECRET: "corto" } as Env)).toBe(
      false,
    );
    expect(telegramConfigured(environment)).toBe(true);
    // La chat con il bot dell'ambiente, senza avvio del collegamento.
    expect(botUrl(environment)).toBe("https://t.me/FiscalBayTestBot");
    expect((await receiveWebhook(webhook(update("/start")), off))?.status).toBe(503);
  });

  it("conserva chat e impronta del token, mai il testo, e risponde una volta sola", async () => {
    const token = "A".repeat(43);
    const body = update(`/start ${token}`, 777);
    const api = bot();
    expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    // L'ingresso esegue subito l'aggiornamento: nessuna coda, e un nuovo tentativo non lo ripete.
    expect(send).not.toHaveBeenCalled();
    const receipt = await env.DB.prepare("SELECT * FROM webhook_receipts").first();
    expect(receipt).toMatchObject({
      provider: "telegram",
      environment: "test",
      provider_id: String(body.update_id),
      topic: "start",
      object_id: "777",
      store_id: null,
      link_token_hash: createHash("sha256").update(token).digest("hex"),
      event_at: now,
    });
    expect(JSON.stringify(receipt)).not.toContain(token);
    expect(receipt).toMatchObject({ queued_at: null, completed_at: expect.any(String) });
    // Lo stesso aggiornamento con un contenuto diverso non cambia la ricevuta.
    const changed = { ...body, message: { ...body.message, chat: { id: 778, type: "private" } } };
    expect((await receiveWebhook(webhook(changed), environment))?.status).toBe(409);
  });

  it("riconosce il comando con il nome del bot e ignora un token malformato", () => {
    const start = (text: string) =>
      verifyTelegramUpdate(JSON.stringify(update(text)), secret, env) as TelegramStart | null;
    expect(start(`/start@FiscalBayTestBot ${"b".repeat(43)}`)?.tokenHash).toHaveLength(64);
    expect(start("/start corto")).toMatchObject({ tokenHash: null, chatId: "501" });
    expect(start("/start")).toMatchObject({ tokenHash: null });
    expect(start("/stop")).toBeNull();
    expect(start(`/start ${"c".repeat(43)} altro`)).toBeNull();
    // Spazi in più e in coda non cambiano il token; un testo prima del comando non è un comando.
    expect(start(`/start   ${"d".repeat(43)}  `)?.tokenHash).toHaveLength(64);
    expect(start(`ciao /start ${"d".repeat(43)}`)).toBeNull();
    // Il token ha esattamente 43 caratteri ammessi.
    expect(start(`/start ${"e".repeat(44)}`)).toMatchObject({ tokenHash: null });
    expect(start(`/start !${"e".repeat(43)}`)).toMatchObject({ tokenHash: null });
    // Un messaggio senza testo, come una foto, non è un comando.
    const photo = {
      update_id: nextUpdateId(),
      message: { date: 1, chat: { id: 1, type: "private" } },
    };
    expect(verifyTelegramUpdate(JSON.stringify(photo), secret, env)).toBeNull();
  });

  it("il token del deep link ha il formato accettato da Telegram", () => {
    const token = randomLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(randomLinkToken()).not.toBe(token);
  });

  it("riconosce ogni nome dei comandi e i tocchi con dati validi in chat privata", () => {
    const command = (text: string) =>
      verifyTelegramUpdate(JSON.stringify(update(text)), secret, env);
    for (const [name, expected] of [
      ["stato", "status"],
      ["status", "status"],
      ["ultimi", "latest"],
      ["latest", "latest"],
      ["preferenze", "preferences"],
      ["preferences", "preferences"],
      ["aiuto", "help"],
      ["help", "help"],
    ])
      expect(command(`/${name}`)).toMatchObject({ kind: "command", command: expected });
    // Il nome del bot e gli spazi in coda non cambiano il comando; un testo in più sì.
    expect(command("/stato@FiscalBayTestBot  ")).toMatchObject({ command: "status" });
    expect(command("/aiuto  ")).toMatchObject({ command: "help" });
    for (const text of ["x/stato", "ciao /stato", "/stato extra", "/sconosciuto"])
      expect(command(text)).toBeNull();
    const message = { message_id: 42, chat: { id: 501, type: "private" } };
    const tapped = (callback: Record<string, unknown>) =>
      verifyTelegramUpdate(
        JSON.stringify({ update_id: 1, callback_query: { id: "cb", ...callback } }),
        secret,
        env,
        new Date(now),
      );
    expect(tapped({ data: "st:a_b-1", message })).toEqual({
      kind: "callback",
      updateId: 1,
      chatId: "501",
      eventAt: now,
      callbackId: "cb",
      messageId: 42,
      data: "st:a_b-1",
    });
    expect(tapped({ data: "x".repeat(64), message })).toMatchObject({ kind: "callback" });
    // Dati assenti, troppo lunghi o con caratteri non ammessi, anche solo in testa o in coda.
    for (const data of ["x".repeat(65), "ok!", "!ok", "ok ok", "", undefined])
      expect(tapped({ data, message })).toBeNull();
    expect(tapped({ data: "st", message: { ...message, chat: { id: 501, type: "group" } } })).toBe(
      null,
    );
    expect(tapped({ data: "st" })).toBeNull();
  });

  it("in Production a invii spenti un avvio senza token o con un token ignoto non risponde", async () => {
    const production = { ...environment, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const start = { receiptId: "r-silenzio", chatId: "654", eventAt: new Date(now).toISOString() };
    for (const reply of [false, true]) {
      const api = bot();
      for (const tokenHash of [null, "0".repeat(64)])
        await consumeTelegramStart(
          production,
          { ...start, tokenHash },
          api.fetcher,
          new Date(now),
          {
            reply,
          },
        );
      // Con le risposte attive partono l'aiuto e l'avviso del link non valido.
      expect(api.texts()).toHaveLength(reply ? 2 : 0);
    }
  });

  it("in Production la ricevuta del bot appartiene all'ambiente live", async () => {
    const production = { ...environment, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const api = bot();
    expect((await receiveWebhook(webhook(update("/aiuto")), production, api.fetcher))?.status).toBe(
      204,
    );
    expect(await env.DB.prepare("SELECT environment FROM webhook_receipts").first()).toEqual({
      environment: "live",
    });
  });

  it("avvio, comandi e tocchi si eseguono subito, senza passare dalla coda", async () => {
    const api = bot();
    for (const body of [
      update(`/start ${"h".repeat(43)}`),
      update("/stato"),
      {
        update_id: nextUpdateId(),
        callback_query: {
          id: "cb-subito",
          data: "st:x",
          message: { message_id: 42, chat: { id: 501, type: "private" } },
        },
      },
    ])
      expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const { results } = await env.DB.prepare(
      "SELECT topic, queued_at, completed_at FROM webhook_receipts ORDER BY topic",
    ).all();
    expect(results).toEqual(
      ["callback", "command", "start"].map((topic) => ({
        topic,
        queued_at: null,
        completed_at: expect.any(String),
      })),
    );
  });

  it("lo stesso aggiornamento con altro contenuto è un conflitto; un tocco riprovato più tardi no", async () => {
    const api = bot();
    const status = async (body: unknown, at = new Date(now)) =>
      (await receiveWebhook(webhook(body), environment, api.fetcher, at))?.status;
    const message = (text: string, date = Date.parse(now) / 1000) => ({
      update_id: nextUpdateId(),
      message: { date, chat: { id: 501, type: "private" }, text },
    });
    const pairs: Array<[unknown, unknown]> = [];
    const start = message(`/start ${"f".repeat(43)}`);
    pairs.push([
      start,
      { ...start, message: { ...start.message, text: `/start ${"g".repeat(43)}` } },
    ]);
    const command = message("/stato");
    pairs.push([command, { ...command, message: { ...command.message, text: "/aiuto" } }]);
    const late = message("/aiuto");
    pairs.push([late, { ...late, message: { ...late.message, date: late.message.date - 60 } }]);
    const callback = (id: string, messageId: number) => ({
      id,
      data: "st:x",
      message: { message_id: messageId, chat: { id: 501, type: "private" } },
    });
    const tap = (callbackQuery: ReturnType<typeof callback>, update_id = nextUpdateId()) => ({
      update_id,
      callback_query: callbackQuery,
    });
    const other = tap(callback("cb-uno", 42));
    pairs.push([other, tap(callback("cb-due", 42), other.update_id)]);
    const moved = tap(callback("cb-tre", 42));
    pairs.push([moved, tap(callback("cb-tre", 43), moved.update_id)]);
    for (const [first, second] of pairs) {
      expect(await status(first)).toBe(204);
      expect(await status(second)).toBe(409);
    }
    // Il tocco prende la data dalla ricezione: un nuovo tentativo più tardi è lo stesso.
    const retried = tap(callback("cb-quattro", 42));
    expect(await status(retried)).toBe(204);
    expect(await status(retried, later(1))).toBe(204);
  });
});

describe("collegamento della chat", () => {
  it("collega la chat che avvia il bot con il token dello spazio e lo conferma nella sua lingua", async () => {
    const seller = await account("collega");
    const token = await linkToken(seller.cookie);
    // Nel database resta l'impronta, legata a spazio e sessione.
    const request = await env.DB.prepare("SELECT * FROM telegram_link_requests").first();
    expect(JSON.stringify(request)).not.toContain(token);
    expect(request).toMatchObject({
      workspace_id: seller.workspace,
      user_id: seller.userId,
      language: "it",
      time_zone: "Europe/Rome",
      expires_at: later(15).toISOString(),
      consumed_at: null,
    });
    const api = bot();
    const message = await deliver(`/start ${token}`, 501, api.fetcher);
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect(await link(seller.workspace)).toMatchObject({
      chat_id: "501",
      chat_label: "@venditore",
      language: "it",
    });
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "501",
          text: expect.stringContaining("Chat collegata a FiscalBay"),
        }),
      }),
    ]);
    // Predefiniti: notifiche attive, soli ordini con dato fiscale, un messaggio per ordine.
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Rome")).toMatchObject({
      chat: { label: "@venditore", linkedAt: now },
      enabled: true,
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      stores: [{ id: seller.store, enabled: true, paused: false }],
    });
    // Il token è monouso: un altro aggiornamento, anche da un'altra chat, non lo riusa.
    const replay = bot();
    await deliver(`/start ${token}`, 999, replay.fetcher);
    expect((await link(seller.workspace))?.chat_id).toBe("501");
    expect(replay.texts()[0]?.params.text).toContain("Questo link non è più valido");
    expect(replay.calls.some((call) => call.method === "getChat")).toBe(false);
  });

  it("lo stesso aggiornamento riprovato ritrova il collegamento e ripete soltanto la conferma", async () => {
    const seller = await account("riprova");
    const token = await linkToken(seller.cookie);
    send.mockClear();
    // Telegram non risponde alla conferma: la ricevuta passa alla coda, che la riprova con
    // l'attesa indicata.
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 7 } },
            { status: 429 },
          )
        : undefined,
    );
    await receiveWebhook(
      webhook(update(`/start ${token}`, 601)),
      environment,
      limited.fetcher,
      new Date(now),
    );
    const body = send.mock.calls[0]![0];
    const first = queueMessage(body);
    await consumeWebhooks({ messages: [first] }, environment, limited.fetcher, new Date(now));
    expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 7 });
    const linked = await link(seller.workspace);
    expect(linked?.chat_id).toBe("601");
    // Il nuovo tentativo arriva dopo la scadenza del link: vale l'istante del messaggio.
    const api = bot();
    const second = queueMessage(body, 2);
    await consumeWebhooks({ messages: [second] }, environment, api.fetcher, later(30));
    expect(second.ack).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toEqual(linked);
    expect(api.texts()[0]?.params.text).toContain("Chat collegata");
  });

  it("con gli invii spenti il collegamento si crea senza conferma e il blocco si chiude", async () => {
    const seller = await account("invii-spenti-avvio");
    const token = await linkToken(seller.cookie);
    await setSwitch(env.DB, "telegram_sends", false, new Date(now));
    const api = bot();
    // Senza token o con un token che non vale, a invii spenti, nemmeno l'aiuto parte.
    await deliver("/start", 652, api.fetcher);
    // Un token della forma giusta ma mai emesso.
    const unknown = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    await deliver(`/start ${unknown}`, 653, api.fetcher);
    expect(api.texts()).toEqual([]);
    await deliver(`/start ${token}`, 651, api.fetcher);
    expect(await link(seller.workspace)).toMatchObject({ chat_id: "651" });
    expect(api.texts()).toEqual([]);
    // Un messaggio della chat bloccata, anche a invii spenti, chiude il blocco.
    await env.DB.prepare("UPDATE telegram_links SET delivery_failure = 'blocked' WHERE chat_id = ?")
      .bind("651")
      .run();
    await deliver("/stato", 651, api.fetcher, later(1));
    expect(
      await env.DB.prepare("SELECT delivery_failure FROM telegram_links WHERE chat_id = ?")
        .bind("651")
        .first(),
    ).toEqual({ delivery_failure: null });
    expect(api.texts()).toEqual([]);
  });

  it("un vecchio /start riprovato dopo un cambio di chat non ripristina la chat precedente", async () => {
    const seller = await account("riprova-vecchia");
    const token = await linkToken(seller.cookie);
    send.mockClear();
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 7 } },
            { status: 429 },
          )
        : undefined,
    );
    await receiveWebhook(
      webhook(update(`/start ${token}`, 611)),
      environment,
      limited.fetcher,
      new Date(now),
    );
    const body = send.mock.calls[0]![0];
    expect((await link(seller.workspace))?.chat_id).toBe("611");
    // Un'altra chat si collega prima che la conferma della prima venga riprovata.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 612, bot().fetcher, later(5));
    const current = await link(seller.workspace);
    expect(current?.chat_id).toBe("612");
    const api = bot();
    const retried = queueMessage(body, 2);
    await consumeWebhooks({ messages: [retried] }, environment, api.fetcher, later(10));
    expect(retried.ack).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toEqual(current);
    expect(api.calls.some((call) => call.method === "getChat")).toBe(false);
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "611",
          text: expect.stringContaining("Questo link non è più valido"),
        }),
      }),
    ]);
  });

  it("un link già usato non vale per un altro /start, anche dalla chat collegata", async () => {
    const seller = await account("link-usato");
    const token = await linkToken(seller.cookie);
    await deliver(`/start ${token}`, 621, bot().fetcher, later(1));
    const linked = await link(seller.workspace);
    expect(linked?.chat_id).toBe("621");
    // Un nuovo aggiornamento con lo stesso token è un'altra ricevuta: il link è già consumato.
    const api = bot();
    await deliver(`/start ${token}`, 621, api.fetcher, later(2));
    expect(await link(seller.workspace)).toEqual(linked);
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "621",
          text: expect.stringContaining("http://localhost:5173/app/impostazioni/notifiche"),
        }),
      }),
    ]);
    expect(api.texts()[0]!.params.text).toContain("Questo link non è più valido");
  });

  it("il collegamento e il cambio di chat fissano il fuso dell'account anche con preferenze salvate", async () => {
    const seller = await account("fuso-collegamento");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    const token = async (zone: string) => {
      const response = (await settingsAction({
        request: new Request(`${origin}/app/impostazioni/notifiche`, {
          method: "POST",
          headers: {
            cookie: `${seller.cookie}; fiscalbay_fuso=${encodeURIComponent(zone)}`,
            origin,
          },
          body: new URLSearchParams({ intent: "telegram-link" }),
        }),
      } as Parameters<typeof settingsAction>[0])) as Response;
      return new URL(response.headers.get("location")!).searchParams.get("start")!;
    };
    await deliver(`/start ${await token("America/New_York")}`, 2001);
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      mode: "digest",
      timeZone: "America/New_York",
    });
    await deliver(`/start ${await token("Asia/Tokyo")}`, 2002, bot().fetcher, later(5));
    expect((await link(seller.workspace))?.chat_id).toBe("2002");
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "Asia/Tokyo",
    );
  });

  it("rifiuta il link scaduto, sostituito, di una sessione chiusa o di chi ha lasciato lo spazio", async () => {
    const seller = await account("rifiuti");
    const expired = await linkToken(seller.cookie);
    const late = bot();
    await deliver(`/start ${expired}`, 701, late.fetcher, later(15));
    expect(await link(seller.workspace)).toBeNull();
    expect(late.texts()[0]?.params.text).toContain("Questo link non è più valido");

    // Un nuovo link sostituisce quello non ancora usato.
    const replaced = await linkToken(seller.cookie);
    const current = await linkToken(seller.cookie);
    await deliver(`/start ${replaced}`, 701);
    expect(await link(seller.workspace)).toBeNull();

    // L'utente non è più nello spazio.
    await env.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?")
      .bind(seller.userId)
      .run();
    await deliver(`/start ${current}`, 701);
    expect(await link(seller.workspace)).toBeNull();
    await env.DB.prepare("INSERT INTO workspace_members VALUES (?, ?, 'owner')")
      .bind(seller.workspace, seller.userId)
      .run();

    // Chiudere la sessione elimina il link: sul test il bot non risponde a una chat sconosciuta.
    const closed = await linkToken(seller.cookie);
    await env.DB.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(seller.userId).run();
    const api = bot();
    const message = await deliver(`/start ${closed}`, 701, api.fetcher);
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect(await link(seller.workspace)).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("sul test il bot tace con chi non arriva da un link; in Production spiega dove collegarsi", async () => {
    const silent = bot();
    await deliver("/start", 801, silent.fetcher);
    expect(silent.calls).toEqual([]);
    const production = { ...env, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const start = (tokenHash: string | null) => ({
      receiptId: crypto.randomUUID(),
      chatId: "802",
      tokenHash,
      eventAt: now,
    });
    const help = bot();
    await consumeTelegramStart(production, start(null), help.fetcher, new Date(now));
    const text = String(help.texts()[0]?.params.text);
    expect(text).toContain("collega questa chat da FiscalBay");
    expect(text).toContain("link this chat in FiscalBay");
    expect(text).toContain("https://fiscalbay.it/app/impostazioni/notifiche");
    expect(text).toContain("https://fiscalbay.it/en/app/settings/notifications");
    // Le due lingue stanno in paragrafi separati.
    expect(text).toContain("/app/impostazioni/notifiche\n\nTo receive");
    const unknown = bot();
    await consumeTelegramStart(production, start("f".repeat(64)), unknown.fetcher, new Date(now));
    const invalid = String(unknown.texts()[0]?.params.text);
    expect(invalid).toContain("Questo link non è più valido");
    expect(invalid).toContain("This link is no longer valid");
  });

  it("il cambio di chat sostituisce la precedente: le sue consegne non hanno più destinatario", async () => {
    const seller = await account("cambio");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 901);
    const first = (await link(seller.workspace))!;
    const event = { storeId: seller.store, eventAt: later(1).toISOString() };
    expect(await telegramRecipient(env.DB, { ...event, linkId: first.id }, later(2))).toMatchObject(
      { chatId: "901", linkId: first.id },
    );
    // Fino all'«Avvia» della nuova chat resta la precedente.
    const token = await linkToken(seller.cookie);
    expect((await link(seller.workspace))?.chat_id).toBe("901");
    // La stessa chat che riavvia il bot resta lo stesso collegamento.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 901);
    expect((await link(seller.workspace))?.id).toBe(first.id);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 902, bot().fetcher, later(3));
    const second = (await link(seller.workspace))!;
    expect(second).toMatchObject({ chat_id: "902" });
    expect(second.id).not.toBe(first.id);
    expect(token).not.toBe("");
    // La consegna preparata per la chat precedente non va da nessuna parte.
    expect(await telegramRecipient(env.DB, { ...event, linkId: first.id }, later(4))).toBeNull();
    // La nuova chat riceve soltanto gli eventi successivi al proprio collegamento.
    expect(await telegramRecipient(env.DB, event, later(4))).toBeNull();
    expect(
      await telegramRecipient(
        env.DB,
        { storeId: seller.store, eventAt: later(3).toISOString() },
        later(4),
      ),
    ).toMatchObject({ chatId: "902", linkId: second.id });
  });

  it("senza Premium non si crea il link; la chat senza nome resta collegata", async () => {
    const free = await account("senza-premium", false);
    expect(await settingsForm(free.cookie, { intent: "telegram-link" })).toMatchObject({
      data: { ok: false, notice: "Le notifiche degli ordini su Telegram sono incluse in Premium." },
      init: { status: 409 },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM telegram_link_requests").first(),
    ).toEqual({ n: 0 });

    const seller = await account("senza-nome");
    const api = bot((call) =>
      call.method === "getChat"
        ? Response.json({ ok: false, error_code: 400 }, { status: 400 })
        : undefined,
    );
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1001, api.fetcher);
    expect(await link(seller.workspace)).toMatchObject({ chat_id: "1001", chat_label: null });
  });

  it("il bot bloccato subito dopo «Avvia» non fa riprovare il collegamento già fatto", async () => {
    const seller = await account("bloccato");
    const blocked = bot((call) =>
      call.method === "sendMessage"
        ? Response.json({ ok: false, error_code: 403 }, { status: 403 })
        : undefined,
    );
    const message = await deliver(
      `/start ${await linkToken(seller.cookie)}`,
      1101,
      blocked.fetcher,
    );
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect((await link(seller.workspace))?.chat_id).toBe("1101");
  });

  it("collega dal consumer anche senza passare dalla coda, con la risposta in inglese", async () => {
    const seller = await account("inglese");
    const response = (await settingsAction({
      request: new Request(`${origin}/en/app/settings/notifications`, {
        method: "POST",
        headers: { cookie: seller.cookie, origin },
        body: new URLSearchParams({ intent: "telegram-link" }),
      }),
    } as Parameters<typeof settingsAction>[0])) as Response;
    const token = new URL(response.headers.get("location")!).searchParams.get("start")!;
    const api = bot();
    await consumeTelegramStart(
      env,
      {
        receiptId: crypto.randomUUID(),
        chatId: "1201",
        tokenHash: createHash("sha256").update(token).digest("hex"),
        eventAt: now,
      },
      api.fetcher,
      new Date(now),
    );
    expect(await link(seller.workspace)).toMatchObject({ chat_id: "1201", language: "en" });
    expect(api.texts()[0]?.params.text).toContain("Chat linked to FiscalBay");
  });
});

describe("preferenze e destinatario", () => {
  it("accetta soltanto le scelte previste", () => {
    expect(parseTelegramChange("telegram", "false")).toEqual({ name: "enabled", value: false });
    expect(parseTelegramChange("telegram-filter", "all")).toEqual({ name: "filter", value: "all" });
    expect(parseTelegramChange("telegram-mode", "digest")).toEqual({
      name: "mode",
      value: "digest",
    });
    expect(parseTelegramChange("telegram-digest-time", "21:00")).toEqual({
      name: "digestTime",
      value: "21:00",
    });
    expect(parseTelegramChange("store-notifications:s-1", "true")).toEqual({
      name: "store",
      storeId: "s-1",
      value: true,
    });
    for (const [name, value] of [
      ["telegram", "si"],
      ["telegram-filter", "nessuno"],
      ["telegram-mode", "settimanale"],
      ["telegram-digest-time", "09:30"],
      ["store-notifications:", "true"],
      ["store-notifications:s-1", "1"],
      ["altro", "true"],
    ])
      expect(parseTelegramChange(name!, value!)).toBeNull();
  });

  it("salva le scelte dalle Impostazioni e le rilegge all'invio", async () => {
    const seller = await account("preferenze");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1301);
    const recipient = (eventAt: Date, at: Date) =>
      telegramRecipient(env.DB, { storeId: seller.store, eventAt: eventAt.toISOString() }, at);
    expect(await recipient(later(1), later(1))).toMatchObject({
      chatId: "1301",
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      language: "it",
    });
    const save = (name: string, value: string, cookie = seller.cookie) =>
      settingsForm(cookie, { intent: "save", name, value });
    expect(await save("telegram-filter", "all")).toEqual({ ok: true });
    expect(await save("telegram-mode", "digest")).toEqual({ ok: true });
    expect(await save("telegram-digest-time", "08:00")).toEqual({ ok: true });
    expect(await save("telegram-digest-time", "07:00")).toMatchObject({ init: { status: 400 } });
    expect(await recipient(later(1), later(1))).toMatchObject({
      filter: "all",
      mode: "digest",
      digestTime: "08:00",
    });

    // Disattivate: nessun destinatario. Riattivate: soltanto gli eventi successivi.
    vi.setSystemTime(later(10));
    expect(await save("telegram", "false")).toEqual({ ok: true });
    expect(await recipient(later(11), later(11))).toBeNull();
    vi.setSystemTime(later(20));
    expect(await save("telegram", "true")).toEqual({ ok: true });
    expect(await recipient(later(15), later(21))).toBeNull();
    expect(await recipient(later(20), later(21))).not.toBeNull();
    // Riattivare quando sono già attive non sposta l'inizio degli eventi.
    vi.setSystemTime(later(30));
    expect(await save("telegram", "true")).toEqual({ ok: true });
    expect(await recipient(later(25), later(31))).not.toBeNull();

    // Lo stesso per il negozio.
    vi.setSystemTime(later(40));
    expect(await save(`store-notifications:${seller.store}`, "false")).toEqual({ ok: true });
    expect(await recipient(later(41), later(41))).toBeNull();
    vi.setSystemTime(later(50));
    expect(await save(`store-notifications:${seller.store}`, "true")).toEqual({ ok: true });
    expect(await recipient(later(45), later(51))).toBeNull();
    expect(await recipient(later(50), later(51))).not.toBeNull();

    // Il negozio di un altro spazio non si tocca.
    const other = await account("preferenze-altro");
    expect(await save(`store-notifications:${seller.store}`, "false", other.cookie)).toMatchObject({
      init: { status: 404 },
    });
    expect(await recipient(later(52), later(52))).not.toBeNull();

    // Senza Premium, nessun invio; la chat resta collegata per il ritorno.
    const ended = later(31 * 24 * 60);
    expect(await recipient(ended, ended)).toBeNull();
    expect((await link(seller.workspace))?.chat_id).toBe("1301");
  });

  it("frequenza e orario fissano il fuso dell'account in quel momento", async () => {
    const seller = await account("fuso");
    const save = (name: string, value: string) =>
      settingsAction({
        request: new Request(`${origin}/app/impostazioni/notifiche`, {
          method: "POST",
          headers: { cookie: `${seller.cookie}; fiscalbay_fuso=America%2FNew_York`, origin },
          body: new URLSearchParams({ intent: "save", name, value }),
        }),
      } as Parameters<typeof settingsAction>[0]);
    expect(await save("telegram-filter", "all")).toEqual({ ok: true });
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "America/New_York",
    );
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "digestTime", value: "21:00" },
      "Europe/London",
    );
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      digestTime: "21:00",
      timeZone: "Europe/London",
    });
    // Il filtro non cambia il fuso del riepilogo.
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "fiscal" }, "UTC");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).timeZone).toBe("Europe/London");
  });

  it("nessuna chat di uno spazio riceve gli eventi dei negozi di un altro", async () => {
    const first = await account("isolamento-a");
    const second = await account("isolamento-b");
    await deliver(`/start ${await linkToken(first.cookie)}`, 1401);
    const event = (storeId: string) => ({ storeId, eventAt: later(1).toISOString() });
    expect(await telegramRecipient(env.DB, event(first.store), later(1))).toMatchObject({
      chatId: "1401",
    });
    expect(await telegramRecipient(env.DB, event(second.store), later(1))).toBeNull();
    const firstLink = (await link(first.workspace))!;
    expect(
      await telegramRecipient(env.DB, { ...event(second.store), linkId: firstLink.id }, later(1)),
    ).toBeNull();
    // Lo stesso utente Telegram può collegare la propria chat anche al secondo spazio.
    await deliver(`/start ${await linkToken(second.cookie)}`, 1401, bot().fetcher, later(2));
    expect(await telegramRecipient(env.DB, event(second.store), later(1))).toBeNull();
    expect(
      await telegramRecipient(
        env.DB,
        { storeId: second.store, eventAt: later(2).toISOString() },
        later(2),
      ),
    ).toMatchObject({ chatId: "1401" });
    expect((await link(second.workspace))?.id).not.toBe(firstLink.id);
    // Un negozio eliminato non ha destinatario.
    await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = ?")
      .bind(now, first.store)
      .run();
    expect(await telegramRecipient(env.DB, event(first.store), later(1))).toBeNull();
  });
});

describe("casi limite del collegamento e delle preferenze", () => {
  it("senza Premium il dominio non crea il link e lo dice", async () => {
    const free = await account("limite-free", false);
    const session = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
      .bind(free.userId)
      .first<{ id: string }>();
    expect(
      await startTelegramLink(env.DB, env, {
        userId: free.userId,
        sessionId: session!.id,
        language: "it",
        timeZone: "Europe/Rome",
      }),
    ).toEqual({ reason: "premium_required" });
  });

  it("un errore temporaneo nel leggere la chat fa riprovare senza collegare", async () => {
    const seller = await account("limite-getchat");
    const down = bot((call) =>
      call.method === "getChat" ? new Response("{}", { status: 503 }) : undefined,
    );
    const message = await deliver(`/start ${await linkToken(seller.cookie)}`, 1701, down.fetcher);
    expect(message!.retry).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toBeNull();
    expect(down.texts()).toEqual([]);
  });

  it("la stessa chat che riavvia il bot aggiorna soltanto il nome mostrato", async () => {
    const seller = await account("limite-nome");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1801);
    const first = (await link(seller.workspace))!;
    const renamed = bot((call) =>
      call.method === "getChat"
        ? Response.json({ ok: true, result: { username: "nuovo_nome" } })
        : undefined,
    );
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1801, renamed.fetcher, later(5));
    expect(await link(seller.workspace)).toEqual({ ...first, chat_label: "@nuovo_nome" });
  });

  it("il collegamento fissa il fuso della richiesta e lo conserva", async () => {
    const seller = await account("limite-fuso");
    const response = (await settingsAction({
      request: new Request(`${origin}/app/impostazioni/notifiche`, {
        method: "POST",
        headers: { cookie: `${seller.cookie}; fiscalbay_fuso=America%2FNew_York`, origin },
        body: new URLSearchParams({ intent: "telegram-link" }),
      }),
    } as Parameters<typeof settingsAction>[0])) as Response;
    const token = new URL(response.headers.get("location")!).searchParams.get("start")!;
    await deliver(`/start ${token}`, 1901);
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "America/New_York",
    );
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      mode: "digest",
      timeZone: "UTC",
    });
  });

  it("senza spazio valgono i predefiniti e nessuna scelta si salva", async () => {
    const { userId, cookie } = await verifiedSession("limite-senza-spazio@example.invalid");
    expect(await telegramSettings(env.DB, userId, "Europe/Rome")).toEqual({
      chat: null,
      enabled: true,
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      stores: [],
    });
    expect(
      await saveTelegramChange(env.DB, userId, { name: "filter", value: "all" }, "Europe/Rome"),
    ).toBe(false);
    expect(
      await settingsForm(cookie, { intent: "save", name: "telegram-filter", value: "all" }),
    ).toMatchObject({ init: { status: 404 } });
  });

  it("legge notifiche spente, scelte salvate e negozi in pausa per il piano", async () => {
    const seller = await account("limite-stato");
    // Collegata senza preferenze salvate: valgono i predefiniti. La pausa del piano si scrive
    // dopo, perché le Impostazioni di uno spazio Premium la tolgono.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 2001);
    await insertStorePause({ storeId: seller.store, reason: "plan" }).run();
    await env.DB.prepare("DELETE FROM telegram_preferences WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    expect(await telegramSettings(env.DB, seller.userId, "UTC")).toMatchObject({
      enabled: true,
      stores: [{ id: seller.store, paused: true }],
    });
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).enabled).toBe(false);
  });

  it("accetta i valori predefiniti e rifiuta un negozio con un nome di troppo", () => {
    expect(parseTelegramChange("telegram-filter", "fiscal")).toEqual({
      name: "filter",
      value: "fiscal",
    });
    expect(parseTelegramChange("telegram-mode", "each")).toEqual({ name: "mode", value: "each" });
    expect(parseTelegramChange(`store-notifications:${"s".repeat(129)}`, "true")).toBeNull();
    expect(parseTelegramChange("x-store-notifications:s-1", "true")).toBeNull();
  });
});

describe("pagine", () => {
  it("le Impostazioni mostrano chat, preferenze e negozi dello spazio", async () => {
    const seller = await account("pagina");
    const page = async () => {
      const result = await routePage(settingsLoader, "/app/impostazioni/notifiche", {
        cookie: seller.cookie,
        params: { sezione: "notifiche" },
      });
      return result.page;
    };
    expect(await page()).toMatchObject({
      services: { telegram: true },
      telegram: { chat: null, enabled: true, filter: "fiscal", stores: [{ id: seller.store }] },
    });
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1501);
    await settingsForm(seller.cookie, {
      intent: "save",
      name: `store-notifications:${seller.store}`,
      value: "false",
    });
    expect(await page()).toMatchObject({
      telegram: {
        chat: { label: "@venditore" },
        stores: [{ id: seller.store, enabled: false }],
      },
    });
  });

  it("i Negozi mostrano le notifiche per negozio soltanto con Premium", async () => {
    const seller = await account("negozi");
    const free = await account("negozi-free", false);
    const stores = async (cookie: string) => {
      const result = await storesLoader({
        request: new Request(`${origin}/app/negozi`, { headers: { cookie } }),
        params: {},
      } as unknown as Parameters<typeof storesLoader>[0]);
      return (result as unknown as { data: { page: Record<string, unknown> } }).data.page;
    };
    expect(await stores(free.cookie)).toMatchObject({
      account: { plan: "free" },
      notificationSettings: true,
      stores: [{ id: free.store, notifications: null }],
    });
    expect(await stores(seller.cookie)).toMatchObject({
      account: { plan: "premium" },
      stores: [{ id: seller.store, notifications: false }],
    });
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1601);
    expect(await stores(seller.cookie)).toMatchObject({
      stores: [{ id: seller.store, notifications: true }],
    });
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    expect((await storeNotifications(env.DB, seller.userId))?.get(seller.store)).toBe(false);
    // Uno spazio senza negozi, o un utente senza spazio, non ha stati da mostrare.
    const { userId } = await verifiedSession("negozi-nessuno@example.invalid");
    expect(await storeNotifications(env.DB, userId)).toBeNull();
  });
});

describe("Bot API e conservazione", () => {
  it("classifica gli errori di Telegram come quelli degli altri provider", async () => {
    const answer = (response: Response | Error) =>
      vi.fn<typeof fetch>(async () => {
        if (response instanceof Error) throw response;
        return response;
      });
    const failure = (fetcher: typeof fetch) =>
      sendText(env, "1", "testo", fetcher).catch((error: unknown) => error);
    expect(await failure(answer(new TypeError("rete")))).toMatchObject({ failure: "unavailable" });
    expect(await failure(answer(new Response("{}", { status: 502 })))).toMatchObject({
      failure: "unavailable",
      details: { status: 502 },
    });
    expect(await failure(answer(new Response("{}", { status: 500 })))).toMatchObject({
      failure: "unavailable",
      details: { status: 500 },
    });
    expect(
      await failure(answer(new Response("", { status: 429, headers: { "retry-after": "3" } }))),
    ).toMatchObject({ failure: "rate_limited", details: { retryAfter: 3 } });
    // Una risposta JSON senza parametri lascia l'attesa all'intestazione.
    expect(
      await failure(
        answer(Response.json({ ok: false }, { status: 429, headers: { "retry-after": "4" } })),
      ),
    ).toMatchObject({ failure: "rate_limited", details: { retryAfter: 4 } });
    expect(await failure(answer(new Response("{}", { status: 401 })))).toMatchObject({
      failure: "credentials",
      details: { status: 401 },
    });
    expect(await failure(answer(new Response("{}", { status: 404 })))).toMatchObject({
      failure: "credentials",
    });
    expect(await failure(answer(new Response("{}", { status: 400 })))).toMatchObject({
      failure: "rejected",
      details: { status: 400 },
    });
    // Con stato 200 contano `ok` e la forma del risultato.
    expect(
      await failure(answer(Response.json({ ok: false, result: { message_id: 1 } }))),
    ).toMatchObject({ failure: "invalid_response", details: { status: 200 } });
    expect(await failure(answer(new Response("non json")))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    expect(await failure(answer(Response.json({ ok: true, result: {} })))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    expect(await failure(answer(new Response("x".repeat(70_000))))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    // Il messaggio parte senza anteprima dei link, verso la chat indicata.
    const sent = answer(Response.json({ ok: true, result: { message_id: 1 } }));
    await sendText(env, "77", "testo", sent);
    expect(JSON.parse(String(sent.mock.calls[0]![1]?.body))).toEqual({
      chat_id: "77",
      text: "testo",
      link_preview_options: { is_disabled: true },
    });
    const named = (result: Record<string, string>) =>
      chatLabel(env, "1", answer(Response.json({ ok: true, result })));
    expect(await named({ first_name: "Mario", last_name: "Rossi" })).toBe("Mario Rossi");
    expect(await named({ first_name: "Mario " })).toBe("Mario");
    expect(await named({ last_name: "Rossi" })).toBe("Rossi");
    expect(await named({ username: "u".repeat(140) })).toHaveLength(128);
    expect(await named({})).toBeNull();
    const asked = answer(Response.json({ ok: true, result: { username: "venditore" } }));
    await chatLabel(env, "88", asked);
    expect(JSON.parse(String(asked.mock.calls[0]![1]?.body))).toEqual({ chat_id: "88" });
  });

  it("con il Worker del bot chiama la Bot API dal binding, senza il token nell'indirizzo", async () => {
    const worker = vi.fn<Fetcher["fetch"]>(async () =>
      Response.json({ ok: true, result: { username: "venditore" } }),
    );
    const direct = vi.fn<typeof fetch>();
    const bound = { ...env, TELEGRAM: { fetch: worker } as unknown as Fetcher };
    expect(await chatLabel(bound, "88", direct)).toBe("@venditore");
    expect(direct).not.toHaveBeenCalled();
    const [url, init] = worker.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://telegram.invalid/getChat");
    expect(url).not.toContain(env.TELEGRAM_BOT_TOKEN!);
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: "88" });
  });

  it("il Worker del bot aggiunge il token e inoltra soltanto metodi della Bot API", async () => {
    const telegram = vi.fn<typeof fetch>(async () => new Response("{}", { status: 429 }));
    const call = (path: string, method = "POST") =>
      forward(
        new Request(`https://telegram.invalid${path}`, {
          method,
          body: method === "POST" ? "{}" : null,
        }),
        "123:segreto",
        telegram,
      );
    expect((await call("/sendMessage")).status).toBe(429);
    expect(telegram).toHaveBeenCalledWith("https://api.telegram.org/bot123:segreto/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    for (const [path, method] of [
      ["/sendMessage", "GET"],
      ["/bot/getMe", "POST"],
      ["/", "POST"],
    ] as const)
      expect((await call(path, method)).status).toBe(404);
    expect(
      (
        await forward(
          new Request("https://telegram.invalid/getMe", { method: "POST" }),
          undefined,
          telegram,
        )
      ).status,
    ).toBe(503);
    expect(telegram).toHaveBeenCalledOnce();
  });

  it("invia e modifica i messaggi con anteprima e pulsanti soltanto se presenti", async () => {
    const api = bot();
    expect(await sendMessage(env, "77", { html: "<b>uno</b>" }, api.fetcher)).toBe(1);
    expect(await sendMessage(env, "77", { html: "due", buttons: [] }, api.fetcher)).toBe(2);
    expect(api.calls.map((call) => call.params)).toEqual(
      ["<b>uno</b>", "due"].map((text) => ({
        chat_id: "77",
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      })),
    );
    // Un rifiuto lascia il messaggio com'è; gli altri errori restano errori.
    const edit = (status: number, body: Record<string, unknown> = { ok: false }) =>
      editMessage(
        env,
        "77",
        5,
        { html: "tre" },
        bot(() => Response.json(body, { status })).fetcher,
      );
    await expect(edit(400)).resolves.toBeUndefined();
    await expect(edit(500)).rejects.toMatchObject({ failure: "unavailable" });
    await expect(edit(429, { ok: false, parameters: { retry_after: 2 } })).rejects.toMatchObject({
      failure: "rate_limited",
      details: { retryAfter: 2 },
    });
    await expect(edit(401)).rejects.toMatchObject({ failure: "credentials" });
  });

  it("elimina le richieste un giorno dopo la scadenza", async () => {
    const seller = await account("pulizia");
    await linkToken(seller.cookie);
    await purgeExpiredRecords(env.DB, new Date(later(15).getTime() + 86_400_000 - 1));
    const count = () =>
      env.DB.prepare("SELECT COUNT(*) AS n FROM telegram_link_requests").first<{ n: number }>();
    expect((await count())?.n).toBe(1);
    await purgeExpiredRecords(env.DB, new Date(later(15).getTime() + 86_400_000));
    expect((await count())?.n).toBe(0);
  });
});
