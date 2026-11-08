import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { setSwitch } from "../app/domain/service-settings.server";
import { deliverTelegram } from "../app/domain/telegram-deliveries.server";
import { localClock, zonedInstant } from "../app/time";
import { escape, splitBlocks, when } from "../app/domain/telegram-messages.server";
import { saveTelegramChange, telegramSettings } from "../app/domain/telegram.server";
import { configureBotCommands } from "../app/domain/telegram-bot.server";
import { ebayOrderHref } from "../app/orders/ebay-links";
import {
  insertEntitlement,
  insertTaxIdentifiers,
  later,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { fakeBot as bot } from "./fixtures/telegram-fixtures";
import {
  origin,
  send,
  environment,
  account,
  linkToken,
  deliver,
  linked,
  order,
  run,
  sentTexts,
  keyboard,
  failure,
  rateLimited,
  deliveryOf,
  logged,
} from "./fixtures/telegram-scenarios";

beforeEach(async () => {
  await resetDatabase();
  send.mockClear();
});

describe("invii degli ordini", () => {
  it("invia tutti gli ordini di un riepilogo oltre 300 e non include altri spazi o ordini scaduti", async () => {
    const seller = await linked("riepilogo-lungo");
    const other = await linked("riepilogo-estraneo", 602);
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    for (let index = 0; index < 301; index++)
      await order(seller.store, `digest-${index}`, {
        cf: "RSSMRA80A01H501U",
        created: 10,
        listed: 15,
      });
    await order(seller.store, "digest-scaduto", { cf: "RSSMRA80A01H501U" });
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'digest-scaduto'")
      .bind(later(1).toISOString())
      .run();
    await order(other.store, "digest-estraneo", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    // La valutazione ha un budget per turno: tutti gli eventi devono essere valutati prima dell'orario.
    for (let turn = 20; turn <= 50; turn += 10) await run(api.fetcher, turn);
    await run(api.fetcher, 65);
    const texts = api
      .texts()
      .filter((call) => String(call.params.chat_id) === String(seller.chat))
      .map((call) => String(call.params.text))
      .join("\n");
    for (let index = 0; index < 301; index++) expect(texts).toContain(`ebay-digest-${index}`);
    expect(texts).not.toContain("digest-scaduto");
    expect(texts).not.toContain("digest-estraneo");
    const sent = api.texts().length;
    await run(api.fetcher, 70);
    expect(api.texts()).toHaveLength(sent);
  });
  it("oltre i duecento spazi per esecuzione il turno passa a chi aspetta da più tempo", async () => {
    const seller = await linked("audit-ultimo");
    await order(seller.store, "o-audit", { cf: "RSSMRA80A01H501U" });
    const earlier = later(-60).toISOString();
    for (let index = 0; index < 200; index++) {
      const id = `audit-${index}`;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
          VALUES (?1, ?1, ?2, 1, ?3, ?3)`).bind(id, `${id}@example.invalid`, earlier),
        env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?1, ?2)").bind(
          id,
          earlier,
        ),
        env.DB.prepare("INSERT INTO workspace_members VALUES (?1, ?1, 'owner')").bind(id),
        env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES (?1, ?1, 'admin', ?2, ?3)`).bind(id, earlier, later(30 * 24 * 60).toISOString()),
        env.DB.prepare(`INSERT INTO telegram_links (workspace_id, id, chat_id, language, linked_at)
          VALUES (?1, ?1, ?2, 'it', ?3)`).bind(id, String(index + 1000), earlier),
      ]);
    }
    const api = bot();
    await run(api.fetcher, 10);
    // I duecento collegati per primi hanno avuto il turno; il successivo arriva subito dopo.
    expect(api.texts().filter((call) => String(call.params.chat_id) === "601")).toHaveLength(0);
    await run(api.fetcher, 20);
    expect(api.texts().filter((call) => String(call.params.chat_id) === "601")).toHaveLength(1);
    const turns = await env.DB.prepare(
      "SELECT COUNT(*) AS waiting FROM telegram_links WHERE served_at IS NULL",
    ).first();
    expect(turns).toEqual({ waiting: 0 });
  }, 60000);

  it("invia il nuovo ordine con il CF normalizzato, senza contatti dell'acquirente, una volta sola", async () => {
    const seller = await linked("invio");
    await order(seller.store, "o-invio", { cf: "rss mra80a01h501u" });
    const image = "https://i.ebayimg.com/images/g/lampada/s-l500.jpg";
    await env.DB.prepare("UPDATE order_items SET image_url = ? WHERE order_id = 'o-invio'")
      .bind(image)
      .run();
    const api = bot();
    await run(api.fetcher, 10);
    const [sent] = api.texts();
    // La miniatura dell'articolo arriva dall'anteprima del link, fuori dal testo.
    expect(sent!.params).toMatchObject({
      chat_id: "601",
      parse_mode: "HTML",
      link_preview_options: { url: image, prefer_small_media: true, show_above_text: false },
    });
    const text = String(sent!.params.text);
    expect(text).toContain("<b>Nuovo ordine</b>");
    expect(text).toContain("<code>RSSMRA80A01H501U</code>");
    expect(text).toContain("Mario Rossi");
    expect(text).toContain("2 × Lampada &lt;vintage&gt; &amp; paralume");
    // Il dato fiscale in testa, i dettagli in citazione con numero e data relativa.
    expect(text).toMatch(
      /^🛒 <b>Nuovo ordine<\/b> · .+\n🧾 <code>RSSMRA80A01H501U<\/code>\n\n<blockquote>👤 Mario Rossi\n💶 <b>34,90/u,
    );
    expect(text).toContain("🕑 <i>oggi 22:01 · ebay-o-invio</i></blockquote>");
    for (const hidden of ["mario@example.invalid", "Via Roma", "333"])
      expect(text).not.toContain(hidden);
    expect(keyboard(sent!).flat()).toEqual([
      { text: "🔗 Apri in FiscalBay", url: `${origin}/app/ordini/o-invio` },
      { text: "🛍 Apri su eBay", url: ebayOrderHref("ebay-o-invio") },
      { text: "📋 Copia Codice Fiscale", copy_text: { text: "RSSMRA80A01H501U" } },
    ]);
    // Una nuova esecuzione, anche ripetuta dopo un'interruzione, non ripete l'evento.
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(1);
    expect(
      await env.DB.prepare("SELECT last_delivery_at FROM telegram_links WHERE workspace_id = ?")
        .bind(seller.workspace)
        .first(),
    ).toEqual({ last_delivery_at: later(10).toISOString() });
  });

  it("con «solo fiscali» aspetta il dato e notifica la sua rimozione senza ripresentarlo", async () => {
    const seller = await linked("fiscali");
    await order(seller.store, "o-fiscali");
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await insertTaxIdentifiers({
      id: "t-fiscali",
      orderId: "o-fiscali",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(15).toISOString(),
    }).run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)[0]).toContain("<code>BNCLGU80A01H501Z</code>");
    expect(sentTexts(api)[0]).toContain("Nuovo ordine");
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-fiscali'")
      .bind(later(25).toISOString())
      .run();
    await run(api.fetcher, 30);
    const removed = api.texts()[1]!;
    expect(String(removed.params.text)).toContain("Codice Fiscale rimosso");
    expect(String(removed.params.text)).not.toContain("BNCLGU80A01H501Z");
    expect(
      keyboard(removed)
        .flat()
        .some((button) => "copy_text" in button),
    ).toBe(false);
    await run(api.fetcher, 40);
    expect(api.texts()).toHaveLength(2);
  });

  it("con tutti gli ordini avvisa durante la verifica e poi quando il dato arriva", async () => {
    const seller = await linked("tutti");
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "all" }, "UTC");
    await order(seller.store, "o-tutti", { checking: true });
    const api = bot();
    await run(api.fetcher, 10);
    expect(sentTexts(api)[0]).toContain("Codice Fiscale in verifica");
    await insertTaxIdentifiers({
      id: "t-tutti",
      orderId: "o-tutti",
      type: "CODICE_FISCALE",
      value: "rss mra80a01h501u",
      source: "ebay_fulfillment",
      observedAt: later(15).toISOString(),
    }).run();
    await env.DB.prepare("UPDATE order_source_refs SET detail_for = last_modified_time").run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)[1]).toContain("Codice Fiscale disponibile");
    expect(sentTexts(api)[1]).toContain("<code>RSSMRA80A01H501U</code>");
  });

  it("lo storico non ha messaggi singoli: un solo riepilogo per importazione", async () => {
    const seller = await linked("storico");
    await order(seller.store, "o-storico", { created: -60, cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(12).toISOString(), seller.store)
      .run();
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(sentTexts(api)).toEqual([expect.stringContaining("Importazione completata")]);
    expect(sentTexts(api)[0]).toContain("📦 Un ordine · 🧾 <b>1</b> con Codice Fiscale o P. IVA");
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?negozio=${seller.store}` }],
    ]);
  });

  it("una variazione scritta dopo la valutazione da una lettura partita prima non va persa", async () => {
    const seller = await linked("lettura");
    await order(seller.store, "o-lettura");
    const api = bot();
    await run(api.fetcher, 10);
    // La lettura è partita a 8 e registra quell'istante, ma scrive dopo la valutazione delle 10.
    await insertTaxIdentifiers({
      id: "t-lettura",
      orderId: "o-lettura",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(8).toISOString(),
    }).run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("<code>BNCLGU80A01H501Z</code>")]);
    // La rivalutazione dello stesso dato non ripete l'evento.
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(1);
  });

  it("il riepilogo raccoglie gli eventi fino all'orario; quelli successivi vanno al giorno dopo", async () => {
    const seller = await linked("orario");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    // Un ordine delle 20:50 valutato soltanto alle 22, dopo un'interruzione, entra nel riepilogo.
    await order(seller.store, "o-prima", { cf: "RSSMRA80A01H501U", created: 45, listed: 50 });
    const api = bot();
    await run(api.fetcher, 120);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-prima")]);
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?periodo=7` }],
    ]);
    // Un ordine dopo l'orario non fa partire un secondo riepilogo, né uno tardivo.
    await order(seller.store, "o-dopo-orario", {
      cf: "BNCLGU80A01H501Z",
      created: 125,
      listed: 130,
    });
    await run(api.fetcher, 140);
    expect(api.texts()).toHaveLength(1);
    await run(api.fetcher, 24 * 60 + 65);
    expect(sentTexts(api).slice(1)).toEqual([expect.stringContaining("ebay-o-dopo-orario")]);
  });

  it("senza eventi all'orario nessun riepilogo tardivo nello stesso giorno", async () => {
    const seller = await linked("tardivo");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    const api = bot();
    await run(api.fetcher, 65);
    await order(seller.store, "o-tardivo", { cf: "RSSMRA80A01H501U", created: 75, listed: 80 });
    await run(api.fetcher, 90);
    await run(api.fetcher, 3 * 60);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 24 * 60 + 65);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-tardivo")]);
  });

  it("dopo un'interruzione riprende dalla parte successiva e aspetta il lease di chi si è fermato", async () => {
    const seller = await linked("parti");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    const ids = Array.from(
      { length: 70 },
      (_, index) => `o-parti-${String(index).padStart(2, "0")}`,
    );
    for (const [index, id] of ids.entries())
      await order(seller.store, id, {
        cf: "RSSMRA80A01H501U",
        created: 1 + index / 10,
        listed: 2 + index / 10,
      });
    let sends = 0;
    const broken = bot((call) => {
      if (call.method === "sendMessage" && ++sends === 3) throw new TypeError("rete");
      return undefined;
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await run(broken.fetcher, 70);
    } finally {
      errors.mockRestore();
    }
    expect(
      await env.DB.prepare(
        "SELECT parts_sent, attempts FROM telegram_deliveries WHERE kind = 'digest'",
      ).first(),
    ).toEqual({ parts_sent: 2, attempts: 1 });
    // Un altro esecutore ha preso la consegna e si è fermato: fino alla scadenza del lease non parte.
    await env.DB.prepare(
      "UPDATE telegram_deliveries SET lease = 'fermo', locked_until = ? WHERE kind = 'digest'",
    )
      .bind(later(80).toISOString())
      .run();
    const api = bot();
    await run(api.fetcher, 75);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 85);
    await run(api.fetcher, 95);
    // Ogni ordine compare una volta sola fra la parte consegnata e quelle riprese.
    const parts = [...sentTexts(broken).slice(0, 2), ...sentTexts(api)];
    expect(parts.length).toBeGreaterThan(2);
    for (const id of ids)
      expect(parts.filter((part) => part.includes(`>ebay-${id}</a>`))).toHaveLength(1);
    expect(keyboard(api.texts().at(-1)!)).toEqual([
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?periodo=7` }],
    ]);
  });

  it("una consegna in attesa alla fine di Pro non parte al rinnovo", async () => {
    const seller = await linked("rinnovo");
    await order(seller.store, "o-rinnovo", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(12).toISOString(), seller.workspace)
      .run();
    await run(limited.fetcher, 15);
    await insertEntitlement({
      id: "e-rinnovo-2",
      workspaceId: seller.workspace,
      source: "admin",
      startsAt: later(16).toISOString(),
      endsAt: later(30 * 24 * 60).toISOString(),
    }).run();
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    expect(await env.DB.prepare("SELECT failed_at FROM telegram_deliveries").first()).toEqual({
      failed_at: later(15).toISOString(),
    });
  });

  it("il riepilogo giornaliero parte all'orario nel fuso scelto, uno al giorno", async () => {
    const seller = await linked("riepilogo");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    await order(seller.store, "o-uno", { cf: "RSSMRA80A01H501U" });
    await order(seller.store, "o-due", { cf: "BNCLGU80A01H501Z", created: 3, listed: 4 });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 70);
    expect(api.texts()).toHaveLength(1);
    const digest = sentTexts(api)[0]!;
    expect(digest).toContain("<b>Riepilogo del 13 set</b>");
    expect(digest).toContain("2 ordini");
    expect(digest).toContain("RSSMRA80A01H501U");
    expect(digest).toContain("BNCLGU80A01H501Z");
    // Ogni Codice Fiscale del riepilogo ha il suo pulsante di copia, prima di «Apri gli ordini».
    expect(keyboard(api.texts()[0]!).map((row) => row[0]!.text)).toEqual([
      "📋 RSSMRA80A01H501U",
      "📋 BNCLGU80A01H501Z",
      "🔗 Apri gli ordini",
    ]);
    // Un ordine dopo il riepilogo del giorno aspetta il giorno successivo.
    await order(seller.store, "o-tre", { cf: "VRDGPP80A01H501X", created: 75, listed: 80 });
    await run(api.fetcher, 90);
    expect(api.texts()).toHaveLength(1);
    await run(api.fetcher, 24 * 60 + 70);
    expect(api.texts()).toHaveLength(2);
    expect(sentTexts(api)[1]).toContain("Un ordine");
    expect(sentTexts(api)[1]).toContain("VRDGPP80A01H501X");
  });

  it("il bot bloccato ferma gli invii finché la chat non scrive, senza l'arretrato del blocco", async () => {
    const seller = await linked("bloccato");
    await order(seller.store, "o-bloccato", { cf: "RSSMRA80A01H501U" });
    const blocked = bot((call) =>
      call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
    );
    await run(blocked.fetcher, 10);
    expect(blocked.texts()).toHaveLength(1);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat).toMatchObject({
      failure: "blocked",
    });
    await order(seller.store, "o-durante", { cf: "BNCLGU80A01H501Z", created: 15, listed: 20 });
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.calls).toHaveLength(0);
    // La chat scrive di nuovo: lo stato risponde e gli invii riprendono dagli eventi successivi.
    await deliver("/stato", seller.chat, api.fetcher, later(30));
    expect(sentTexts(api)[0]).toContain("Pro fino al");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
    await order(seller.store, "o-dopo", { cf: "VRDGPP80A01H501X", created: 35, listed: 40 });
    await run(api.fetcher, 45);
    expect(sentTexts(api).slice(1)).toEqual([expect.stringContaining("VRDGPP80A01H501X")]);
  });

  it("ritenta gli errori temporanei con attese crescenti, poi segnala la chat irraggiungibile", async () => {
    const seller = await linked("irraggiungibile");
    await order(seller.store, "o-ritenta", { cf: "RSSMRA80A01H501U" });
    let attempt = 0;
    const flaky = bot((call) => {
      if (call.method !== "sendMessage") return undefined;
      attempt++;
      if (attempt === 1) throw new TypeError("rete");
      return failure(502);
    });
    const retries: unknown[] = [];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const minutes of [10, 10.5, 11, 13, 17, 25, 41]) {
        await run(flaky.fetcher, minutes);
        retries.push((await deliveryOf("o-ritenta"))?.retry_at);
      }
    } finally {
      errors.mockRestore();
    }
    // Attese di 1, 2, 4 e 8 minuti: il secondo turno a 10,5 è ancora in attesa.
    expect(attempt).toBe(5);
    expect(retries).toEqual([11, 11, 13, 17, 25, 25, 25].map((at) => later(at).toISOString()));
    expect(
      await env.DB.prepare(
        "SELECT attempts, failed_at, uncertain_at FROM telegram_deliveries WHERE order_id = 'o-ritenta'",
      ).first(),
    ).toEqual({
      attempts: 5,
      failed_at: later(25).toISOString(),
      uncertain_at: later(10).toISOString(),
    });
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
      "unreachable",
    );
    // Il primo invio riuscito chiude l'avviso.
    await order(seller.store, "o-riuscito", { cf: "BNCLGU80A01H501Z", created: 50, listed: 55 });
    const api = bot();
    await run(api.fetcher, 60);
    expect(api.texts()).toHaveLength(1);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
  });

  it("rispetta l'attesa di Telegram e scarta la consegna di una chat sostituita", async () => {
    const seller = await linked("sostituita");
    await order(seller.store, "o-attesa", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    expect(
      await env.DB.prepare("SELECT retry_at, attempts FROM telegram_deliveries").first(),
    ).toEqual({ retry_at: later(20).toISOString(), attempts: 0 });
    await run(limited.fetcher, 15);
    expect(limited.texts()).toHaveLength(1);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 602, bot().fetcher, later(14));
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    expect(await env.DB.prepare("SELECT failed_at FROM telegram_deliveries").first()).toEqual({
      failed_at: later(25).toISOString(),
    });
  });

  it("notifiche spente, negozio escluso e Pro scaduto non inviano nulla", async () => {
    const seller = await linked("spente");
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    await order(seller.store, "o-spente", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    // La riattivazione non porta l'arretrato del periodo spento.
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(12),
    );
    await run(api.fetcher, 15);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: false },
      "UTC",
      later(16),
    );
    await order(seller.store, "o-escluso", { cf: "BNCLGU80A01H501Z", created: 17, listed: 18 });
    await run(api.fetcher, 20);
    expect(api.texts()).toHaveLength(0);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: true },
      "UTC",
      later(21),
    );
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(22).toISOString(), seller.workspace)
      .run();
    await order(seller.store, "o-free", { cf: "VRDGPP80A01H501X", created: 23, listed: 24 });
    await run(api.fetcher, 30);
    expect(api.calls).toHaveLength(0);
  });

  type Seller = Awaited<ReturnType<typeof linked>>;

  /**
   * Ordine notificato e dato fiscale rimosso durante una pausa: alla ripresa la rimozione non
   * arriva, il dato arrivato dopo la ripresa sì.
   */
  async function withoutBacklog(
    name: string,
    pause: (seller: Seller) => Promise<unknown>,
    resume: (seller: Seller) => Promise<unknown>,
  ) {
    const seller = await linked(name);
    await order(seller.store, `o-${name}`, { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(sentTexts(api)).toEqual([expect.stringContaining("Nuovo ordine")]);
    await pause(seller);
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = ?")
      .bind(later(15).toISOString(), `t-o-${name}`)
      .run();
    await run(api.fetcher, 20);
    await resume(seller);
    await run(api.fetcher, 30);
    await run(api.fetcher, 40);
    expect(api.texts()).toHaveLength(1);
    await insertTaxIdentifiers({
      id: `t-${name}-dopo`,
      orderId: `o-${name}`,
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(45).toISOString(),
    }).run();
    await run(api.fetcher, 50);
    expect(sentTexts(api).slice(1)).toEqual([
      expect.stringContaining("<code>BNCLGU80A01H501Z</code>"),
    ]);
    expect(sentTexts(api)[1]).toContain("Codice Fiscale disponibile");
  }

  it("alla riattivazione delle notifiche non arriva la variazione del periodo spento", () =>
    withoutBacklog(
      "pausa-spente",
      (seller) =>
        saveTelegramChange(
          env.DB,
          seller.userId,
          { name: "enabled", value: false },
          "UTC",
          later(12),
        ),
      (seller) =>
        saveTelegramChange(
          env.DB,
          seller.userId,
          { name: "enabled", value: true },
          "UTC",
          later(25),
        ),
    ));

  it("dopo il blocco del bot non arriva la variazione del periodo bloccato", () =>
    withoutBacklog(
      "pausa-blocco",
      async (seller) => {
        await order(seller.store, "o-pausa-blocco-403", {
          cf: "VRDGPP80A01H501X",
          created: 11,
          listed: 11,
        });
        const blocked = bot((call) =>
          call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
        );
        await run(blocked.fetcher, 12);
        expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
          "blocked",
        );
      },
      (seller) => deliver("/stato", seller.chat, bot().fetcher, later(25)),
    ));

  it("al rinnovo di Pro non arriva la variazione del periodo senza Pro", () =>
    withoutBacklog(
      "pausa-premium",
      (seller) =>
        env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
          .bind(later(12).toISOString(), seller.workspace)
          .run(),
      (seller) =>
        insertEntitlement({
          id: `e-${seller.workspace}-rinnovo`,
          workspaceId: seller.workspace,
          source: "admin",
          startsAt: later(25).toISOString(),
          endsAt: later(30 * 24 * 60).toISOString(),
        }).run(),
    ));

  it("gli ordini in verifica oltre il limite di un'esecuzione non fermano quelli successivi", async () => {
    const seller = await linked("coda");
    for (let index = 0; index < 101; index++)
      await order(seller.store, `o-coda-${String(index).padStart(3, "0")}`, { checking: true });
    await order(seller.store, "o-coda-fiscale", { cf: "RSSMRA80A01H501U", created: 2, listed: 3 });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-coda-fiscale")]);
  });

  it("CF, P. IVA e identificativi esteri nella forma derivata, anche nei riepiloghi suddivisi", async () => {
    const others = (orderId: string) =>
      insertTaxIdentifiers(
        {
          id: `piva-${orderId}`,
          orderId,
          type: "PartitaIVA",
          value: "0074 3110 157",
          observedAt: later(2).toISOString(),
        },
        {
          id: `estero-${orderId}`,
          orderId,
          type: "VAT_ID",
          country: "DE",
          value: "de 123 456 789",
          observedAt: later(2).toISOString(),
        },
      ).run();
    const derived = [
      "🧾 <code>RSSMRA80A01H501U</code>",
      "🧾 P. IVA <code>00743110157</code>",
      "🧾 VAT_ID · DE <code>de 123 456 789</code>",
    ];
    const single = await linked("forma");
    await order(single.store, "o-forma", { cf: "rss mra80a01h501u" });
    await others("o-forma");
    const api = bot();
    await run(api.fetcher, 10);
    for (const value of derived) expect(sentTexts(api)[0]).toContain(value);
    expect(keyboard(api.texts()[0]!).flat()).toContainEqual({
      text: "📋 Copia Codice Fiscale",
      copy_text: { text: "RSSMRA80A01H501U" },
    });

    const digest = await linked("forma-riepilogo", 602);
    await saveTelegramChange(env.DB, digest.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, digest.userId, { name: "digestTime", value: "21:00" }, "UTC");
    for (let index = 0; index < 25; index++) {
      const id = `o-forma-${String(index).padStart(2, "0")}`;
      await order(digest.store, id, {
        cf: "rss mra80a01h501u",
        created: 30 + index / 10,
        listed: 31 + index / 10,
      });
      await others(id);
    }
    const summary = bot();
    await run(summary.fetcher, 70);
    const parts = sentTexts(summary);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      for (const value of derived) expect(part).toContain(value);
      for (const original of ["rss mra80a01h501u", "0074 3110 157"])
        expect(part).not.toContain(original);
    }
    for (const call of summary.texts())
      expect(keyboard(call)[0]).toEqual([
        { text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } },
      ]);
  });

  it("una correzione del dato notifica «Codice Fiscale aggiornato» con il solo valore nuovo", async () => {
    const seller = await linked("corretto");
    await order(seller.store, "o-corretto", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    await env.DB.batch([
      env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-o-corretto'").bind(
        later(15).toISOString(),
      ),
      insertTaxIdentifiers({
        id: "t-corretto-nuovo",
        orderId: "o-corretto",
        type: "CODICE_FISCALE",
        value: "bnc lgu80a01h501z",
        source: "ebay_trading_get_orders",
        observedAt: later(15).toISOString(),
      }),
    ]);
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(2);
    const changed = sentTexts(api)[1]!;
    expect(changed).toMatch(/^✏️ <b>Codice Fiscale aggiornato<\/b>/u);
    expect(changed).toContain("<code>BNCLGU80A01H501Z</code>");
    expect(changed).not.toContain("RSSMRA80A01H501U");
  });

  it("lo stato delle notifiche conserva l'impronta del dato, mai il Codice Fiscale", async () => {
    const seller = await linked("impronta");
    await order(seller.store, "o-impronta", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    const stored = async () =>
      (await env.DB.prepare(
        "SELECT fiscal_key FROM telegram_order_notices WHERE order_id = 'o-impronta'",
      ).first<{ fiscal_key: string }>())!.fiscal_key;
    const key = await stored();
    expect(key).toMatch(/^"[0-9a-f]{64}"$/u);
    expect(key).not.toContain("RSSMRA");
  });

  it("due valutazioni contemporanee preparano un solo evento", async () => {
    const seller = await linked("contemporanee");
    await order(seller.store, "o-contemporanee", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await Promise.all([run(api.fetcher, 10), run(api.fetcher, 10.5)]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM telegram_deliveries WHERE order_id = 'o-contemporanee'",
      ).first(),
    ).toEqual({ n: 1 });
    expect(api.texts()).toHaveLength(1);
  });

  it("senza autorizzazione il Codice Fiscale non compare: conservazione scaduta, copertura revocata, piano Free", async () => {
    const seller = await linked("autorizzato");
    await order(seller.store, "o-scaduto", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-scaduto'")
      .bind(later(12).toISOString())
      .run();
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    // La consegna dell'ordine non più consultabile si chiude senza tentativi.
    expect(await deliveryOf("o-scaduto")).toMatchObject({
      attempts: 0,
      failed_at: later(25).toISOString(),
    });
    await order(seller.store, "o-revocato", { cf: "BNCLGU80A01H501Z", created: 30, listed: 31 });
    await run(limited.fetcher, 35);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(37).toISOString(), seller.workspace)
      .run();
    await run(api.fetcher, 50);
    expect(api.texts()).toHaveLength(0);
    // Senza Premium i comandi non mostrano ordini né dati fiscali.
    await deliver("/ultimi", seller.chat, api.fetcher, later(51));
    await deliver("/stato", seller.chat, api.fetcher, later(52));
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("compresi in Pro"),
      expect.stringContaining("<b>Free</b>"),
    ]);
    for (const text of sentTexts(api)) expect(text).not.toMatch(/RSSMRA|BNCLGU/u);
  });

  it("suddivide i testi lunghi senza spezzare un blocco e fa l'escape dell'HTML", () => {
    expect(escape("<a & b>")).toBe("&lt;a &amp; b&gt;");
    expect(splitBlocks(["uno", "due"], 20)).toEqual(["uno\n\ndue"]);
    expect(splitBlocks(["a".repeat(8), "b".repeat(8)], 12)).toEqual(["a".repeat(8), "b".repeat(8)]);
    expect(splitBlocks([`${"c".repeat(6)}\n${"d".repeat(6)}`], 8)).toEqual([
      "c".repeat(6),
      "d".repeat(6),
    ]);
    expect(splitBlocks(["e".repeat(10)], 4)).toEqual(["eeee", "eeee", "ee"]);
    // Le ore legali non cambiano il giorno del riepilogo: conta la data nel fuso.
    expect(localClock("Europe/Rome", new Date("2026-10-25T00:30:00Z"))).toEqual({
      day: "2026-10-25",
      time: "02:30",
    });
    expect(localClock("Europe/Rome", new Date("2026-10-25T01:30:00Z"))).toEqual({
      day: "2026-10-25",
      time: "02:30",
    });
    // Le date si leggono come le direbbe una persona, nel fuso scelto.
    const at = new Date("2026-10-25T21:30:00Z");
    expect(when("it", "Europe/Rome", "2026-10-25T21:10:00Z", at)).toBe("oggi 22:10");
    expect(when("it", "Europe/Rome", "2026-10-24T08:00:00Z", at)).toBe("ieri 10:00");
    expect(when("en", "Europe/Rome", "2026-10-24T08:00:00Z", at)).toBe("yesterday 10:00");
    expect(when("it", "Europe/Rome", "2026-10-20T08:00:00Z", at)).toBe("20 ott 10:00");
    expect(when("en", "Europe/Rome", "2025-12-31T08:00:00Z", at)).toBe("31 Dec 2025 09:00");
    // L'orario del riepilogo nel fuso, prima e dopo i cambi di ora legale.
    for (const [zone, day, time, instant] of [
      ["Europe/Rome", "2026-10-24", "08:00", "2026-10-24T06:00:00.000Z"],
      ["Europe/Rome", "2026-10-25", "08:00", "2026-10-25T07:00:00.000Z"],
      ["Europe/Rome", "2026-03-29", "21:00", "2026-03-29T19:00:00.000Z"],
      ["America/New_York", "2026-11-01", "08:00", "2026-11-01T13:00:00.000Z"],
      ["Asia/Kolkata", "2026-10-25", "12:00", "2026-10-25T06:30:00.000Z"],
      ["UTC", "2026-10-25", "21:00", "2026-10-25T21:00:00.000Z"],
    ] as const)
      expect(zonedInstant(zone, day, time).toISOString()).toBe(instant);
  });
});

describe("esiti delle consegne", () => {
  type Seller = Awaited<ReturnType<typeof linked>>;

  /** Lo spazio viene servito per primo: il suo collegamento è il più vecchio. */
  const servedFirst = (seller: Seller) =>
    env.DB.prepare("UPDATE telegram_links SET linked_at = ? WHERE workspace_id = ?")
      .bind(later(-1).toISOString(), seller.workspace)
      .run();

  const digestMode = async (seller: Seller) => {
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
  };

  const digestOf = (seller: Seller) =>
    env.DB.prepare(
      "SELECT attempts, sent_at, failed_at FROM telegram_deliveries WHERE kind = 'digest' AND workspace_id = ?",
    )
      .bind(seller.workspace)
      .first();

  const evaluatedAt = async (orderId: string) =>
    (
      await env.DB.prepare("SELECT evaluated_at FROM telegram_order_notices WHERE order_id = ?")
        .bind(orderId)
        .first<{ evaluated_at: string }>()
    )?.evaluated_at;

  /**
   * Ambiente in cui la prima istruzione che contiene `marker` riceve i parametri modificati da
   * `values`: simula una scrittura concorrente fra due letture della stessa esecuzione.
   */
  function racing(marker: string, values: (bound: unknown[]) => unknown[]) {
    let pending = true;
    const DB = new Proxy(env.DB, {
      get(target, key) {
        if (key !== "prepare") {
          const value: unknown = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return (sql: string) => {
          const statement = target.prepare(sql);
          if (!pending || !sql.includes(marker)) return statement;
          pending = false;
          return { bind: (...bound: unknown[]) => statement.bind(...values(bound)) };
        };
      },
    });
    return { ...environment, DB } as Env;
  }

  it("senza il bot dell'ambiente non prepara né invia consegne", async () => {
    const seller = await linked("senza-bot");
    await order(seller.store, "o-senza-bot", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const off = { ...environment, TELEGRAM_BOT_TOKEN: undefined } as Env;
    await deliverTelegram(off, api.fetcher, later(10));
    expect(api.calls).toHaveLength(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-senza-bot")]);
  });

  it("con gli invii spenti dalla console il bot tace e consegna alla riaccensione", async () => {
    const seller = await linked("invii-spenti");
    await order(seller.store, "o-invii-spenti", { cf: "RSSMRA80A01H501U" });
    await setSwitch(env.DB, "telegram_sends", false, later(5));
    const api = bot();
    await deliverTelegram(environment, api.fetcher, later(10));
    await configureBotCommands(environment, api.fetcher);
    await deliver("/stato", seller.chat, api.fetcher);
    expect(api.calls).toHaveLength(0);
    await setSwitch(env.DB, "telegram_sends", true, later(15));
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-invii-spenti")]);
  });

  it("con chiamate eBay spente e acquisti chiusi il bot consegna e risponde", async () => {
    const seller = await linked("altri-spenti");
    await order(seller.store, "o-altri-spenti", { cf: "RSSMRA80A01H501U" });
    for (const name of ["ebay_calls", "purchases_open"] as const)
      await setSwitch(env.DB, name, false, later(5));
    const api = bot();
    await run(api.fetcher, 10);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-altri-spenti")]);
    await deliver("/stato", seller.chat, api.fetcher, later(11));
    expect(api.texts()).toHaveLength(2);
  });

  it("l'esecuzione per un negozio non chiude le consegne degli altri spazi", async () => {
    const served = await linked("ambito", 611);
    const expired = await linked("ambito-scaduto", 612);
    await order(expired.store, "o-ambito-scaduto", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(600).fetcher, 10);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(12).toISOString(), expired.workspace)
      .run();
    await order(served.store, "o-ambito", { cf: "BNCLGU80A01H501Z", created: 12, listed: 13 });
    const api = bot();
    await deliverTelegram(environment, api.fetcher, later(15), { storeId: served.store });
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-ambito")]);
    expect(await deliveryOf("o-ambito-scaduto")).toMatchObject({ failed_at: null });
    // L'esecuzione completa chiude la consegna dello spazio senza Premium.
    await run(api.fetcher, 16);
    expect(await deliveryOf("o-ambito-scaduto")).toMatchObject({
      failed_at: later(16).toISOString(),
    });
  });

  it("l'errore di uno spazio si registra e non ferma gli altri", async () => {
    const broken = await linked("fuso-errato", 621);
    const other = await linked("fuso-valido", 622);
    await servedFirst(broken);
    await digestMode(broken);
    await env.DB.prepare("UPDATE telegram_preferences SET time_zone = ? WHERE workspace_id = ?")
      .bind("Fuso/Inesistente", broken.workspace)
      .run();
    await order(other.store, "o-fuso-valido", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 10));
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram" })]);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-fuso-valido")]);
  });

  it("l'attesa di Telegram ferma le consegne successive della chat, non gli altri spazi", async () => {
    const waiting = await linked("attesa-chat", 631);
    const other = await linked("attesa-altro", 632);
    await servedFirst(waiting);
    const api = bot((call) =>
      call.method === "sendMessage" && call.params.chat_id === "631"
        ? failure(429, { ok: false, parameters: { retry_after: 1 } })
        : undefined,
    );
    await order(waiting.store, "o-attesa-prima", { cf: "RSSMRA80A01H501U" });
    await run(api.fetcher, 10);
    await order(waiting.store, "o-attesa-dopo", {
      cf: "BNCLGU80A01H501Z",
      created: 11,
      listed: 12,
    });
    await order(other.store, "o-attesa-altro", { cf: "VRDGPP80A01H501X", created: 11, listed: 12 });
    await run(api.fetcher, 13);
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("ebay-o-attesa-prima"),
      expect.stringContaining("ebay-o-attesa-prima"),
      expect.stringContaining("ebay-o-attesa-altro"),
    ]);
    expect(await deliveryOf("o-attesa-prima")).toMatchObject({
      attempts: 0,
      retry_at: new Date(later(13).getTime() + 1000).toISOString(),
      lease: null,
    });
  });

  it("un messaggio rifiutato si chiude, si registra e lascia partire i successivi", async () => {
    const seller = await linked("rifiutato");
    await order(seller.store, "o-respinto", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await order(seller.store, "o-accolto-1", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    await order(seller.store, "o-accolto-2", { cf: "VRDGPP80A01H501X", created: 11, listed: 12 });
    const api = bot((call) =>
      call.method === "sendMessage" && String(call.params.text).includes("ebay-o-respinto")
        ? failure(400, { ok: false, error_code: 400 })
        : undefined,
    );
    const logs = await logged(() => run(api.fetcher, 13));
    expect(api.texts()).toHaveLength(3);
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram", failure: "rejected" })]);
    expect(await deliveryOf("o-respinto")).toMatchObject({
      attempts: 0,
      lease: null,
      sent_at: null,
      failed_at: later(13).toISOString(),
    });
    for (const id of ["o-accolto-1", "o-accolto-2"])
      expect(await deliveryOf(id)).toMatchObject({ sent_at: later(13).toISOString() });
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
  });

  it("un token del bot non più valido ferma l'esecuzione e rilascia la consegna", async () => {
    const first = await linked("token-primo", 641);
    const second = await linked("token-secondo", 642);
    await servedFirst(first);
    await order(first.store, "o-token-primo", { cf: "RSSMRA80A01H501U" });
    await order(second.store, "o-token-secondo", { cf: "BNCLGU80A01H501Z" });
    const revoked = bot((call) => (call.method === "sendMessage" ? failure(401) : undefined));
    const logs = await logged(() => run(revoked.fetcher, 10));
    expect(revoked.texts()).toHaveLength(1);
    expect(logs).toEqual([
      expect.objectContaining({ operation: "telegram", failure: "credentials" }),
    ]);
    expect(await deliveryOf("o-token-primo")).toEqual({
      attempts: 0,
      retry_at: null,
      uncertain_at: null,
      lease: null,
      locked_until: null,
      sent_at: null,
      failed_at: null,
    });
    // L'altro spazio non è stato valutato.
    expect(await deliveryOf("o-token-secondo")).toBeNull();
    // Alla ripresa passa prima lo spazio rimasto senza turno.
    const api = bot();
    await run(api.fetcher, 15);
    expect(api.texts().map((call) => call.params.chat_id)).toEqual(["642", "641"]);
  });

  it("il bot bloccato chiude anche le altre consegne in attesa della chat", async () => {
    const seller = await linked("bloccata");
    await order(seller.store, "o-bloccata-1", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await order(seller.store, "o-bloccata-2", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    const blocked = bot((call) =>
      call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
    );
    await run(blocked.fetcher, 13);
    expect(blocked.texts()).toHaveLength(1);
    for (const id of ["o-bloccata-1", "o-bloccata-2"])
      expect(await deliveryOf(id)).toMatchObject({
        attempts: 0,
        lease: null,
        failed_at: later(13).toISOString(),
      });
  });

  it("un errore nel comporre il testo si ritenta come un errore certo", async () => {
    const seller = await linked("fuso-invio");
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "fiscal" }, "UTC");
    await env.DB.prepare("UPDATE telegram_preferences SET time_zone = ? WHERE workspace_id = ?")
      .bind("Fuso/Inesistente", seller.workspace)
      .run();
    await order(seller.store, "o-fuso-invio", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 10));
    expect(api.calls).toHaveLength(0);
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram" })]);
    expect(await deliveryOf("o-fuso-invio")).toEqual({
      attempts: 1,
      retry_at: later(11).toISOString(),
      uncertain_at: null,
      lease: null,
      locked_until: null,
      sent_at: null,
      failed_at: null,
    });
  });

  it("una consegna presa da un altro esecutore non ferma le successive", async () => {
    const seller = await linked("occupata");
    await order(seller.store, "o-occupata", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await env.DB.prepare(
      "UPDATE telegram_deliveries SET lease = 'altro', locked_until = ? WHERE order_id = 'o-occupata'",
    )
      .bind(later(30).toISOString())
      .run();
    await order(seller.store, "o-libera", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 13));
    expect(logs).toEqual([]);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-libera")]);
    expect(await deliveryOf("o-occupata")).toMatchObject({ lease: "altro", sent_at: null });
  });

  it("un ordine in attesa passa al riepilogo scelto dopo la sua preparazione", async () => {
    const seller = await linked("passa-riepilogo");
    await order(seller.store, "o-passa", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(60).fetcher, 10);
    await digestMode(seller);
    const api = bot();
    await run(api.fetcher, 15);
    expect(api.calls).toHaveLength(0);
    expect(await deliveryOf("o-passa")).toMatchObject({
      attempts: 0,
      retry_at: null,
      lease: null,
      sent_at: null,
      failed_at: null,
    });
    await run(api.fetcher, 60);
    expect(sentTexts(api)).toEqual([expect.stringMatching(/Riepilogo del[\s\S]*ebay-o-passa/u)]);
    expect(await deliveryOf("o-passa")).toMatchObject({ sent_at: later(60).toISOString() });
  });

  it("il riepilogo riunisce gli eventi di un ordine e omette quelli non più consultabili", async () => {
    const seller = await linked("voci");
    await order(seller.store, "o-voci-notificato", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 5);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-voci-notificato")]);
    await digestMode(seller);
    await order(seller.store, "o-voci-nuovo", { cf: "BNCLGU80A01H501Z", created: 6, listed: 7 });
    await order(seller.store, "o-voci-scaduto", { cf: "VRDGPP80A01H501X", created: 6, listed: 7 });
    await run(api.fetcher, 10);
    const correct = (id: string, value: string, minutes: number) =>
      env.DB.batch([
        env.DB.prepare(
          "UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-voci-nuovo' AND removed_at IS NULL",
        ).bind(later(minutes).toISOString()),
        insertTaxIdentifiers({
          id,
          orderId: "o-voci-nuovo",
          type: "CODICE_FISCALE",
          value,
          source: "ebay_trading_get_orders",
          observedAt: later(minutes).toISOString(),
        }),
      ]);
    // Il nuovo ordine si corregge due volte prima del riepilogo; il dato dell'altro si rimuove.
    await correct("t-voci-1", "MRARSS80A01H501U", 15);
    await env.DB.prepare(
      "UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-voci-notificato'",
    )
      .bind(later(15).toISOString())
      .run();
    await run(api.fetcher, 20);
    await correct("t-voci-2", "LGUBNC80A01H501Z", 25);
    await run(api.fetcher, 30);
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-voci-scaduto'")
      .bind(later(50).toISOString())
      .run();
    await run(api.fetcher, 60);
    expect(api.texts()).toHaveLength(2);
    const digest = sentTexts(api)[1]!;
    expect(digest).toContain("2 ordini");
    // Più eventi dello stesso ordine sono una voce «nuovo», con il dato corrente.
    expect(digest).toContain(">ebay-o-voci-nuovo</a>");
    expect(digest).toContain("<code>LGUBNC80A01H501Z</code>");
    expect(digest).not.toContain("Codice Fiscale aggiornato");
    expect(digest).toContain("Codice Fiscale rimosso");
    expect(digest).not.toContain("ebay-o-voci-scaduto");
    // Gli eventi raccolti, anche quello omesso, risultano consegnati con il riepilogo.
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM telegram_deliveries WHERE digest_id IS NOT NULL AND sent_at = ?",
      )
        .bind(later(60).toISOString())
        .first(),
    ).toEqual({ n: 5 });
  });

  it("un riepilogo che non parte chiude i suoi eventi", async () => {
    const empty = await linked("riepilogo-vuoto", 651);
    const disabled = await linked("riepilogo-spento", 652);
    for (const seller of [empty, disabled]) await digestMode(seller);
    await order(empty.store, "o-riepilogo-vuoto", { cf: "RSSMRA80A01H501U" });
    await order(disabled.store, "o-riepilogo-spento", { cf: "BNCLGU80A01H501Z" });
    const api = bot((call) =>
      call.method === "sendMessage" && call.params.chat_id === "652"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(api.fetcher, 10);
    // Nessun ordine del riepilogo è ancora consultabile: non parte.
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-riepilogo-vuoto'")
      .bind(later(50).toISOString())
      .run();
    await run(api.fetcher, 60);
    expect(api.texts().map((call) => call.params.chat_id)).toEqual(["652"]);
    expect(await digestOf(empty)).toEqual({
      attempts: 0,
      sent_at: null,
      failed_at: later(60).toISOString(),
    });
    expect(await deliveryOf("o-riepilogo-vuoto")).toMatchObject({
      failed_at: later(60).toISOString(),
    });
    // Le notifiche spente prima dell'invio scartano il riepilogo in attesa.
    await saveTelegramChange(
      env.DB,
      disabled.userId,
      { name: "enabled", value: false },
      "UTC",
      later(62),
    );
    const after = bot();
    await run(after.fetcher, 75);
    expect(after.calls).toHaveLength(0);
    expect(await digestOf(disabled)).toEqual({
      attempts: 0,
      sent_at: null,
      failed_at: later(75).toISOString(),
    });
    expect(await deliveryOf("o-riepilogo-spento")).toMatchObject({
      failed_at: later(75).toISOString(),
    });
  });

  it("una consegna senza destinatario o senza importazione si chiude senza tentativi", async () => {
    const seller = await linked("chiusa");
    await order(seller.store, "o-chiusa", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(600).fetcher, 10);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: false },
      "UTC",
      later(12),
    );
    const api = bot();
    await run(api.fetcher, 25);
    expect(await deliveryOf("o-chiusa")).toMatchObject({
      attempts: 0,
      lease: null,
      failed_at: later(25).toISOString(),
    });
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(26),
    );
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(27).toISOString(), seller.store)
      .run();
    await run(rateLimited(600).fetcher, 30);
    // Una nuova importazione richiesta prima dell'invio toglie il riepilogo della precedente.
    await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL WHERE store_id = ?")
      .bind(seller.store)
      .run();
    await run(api.fetcher, 45);
    expect(api.calls).toHaveLength(0);
    expect(
      await env.DB.prepare(
        "SELECT attempts, sent_at, failed_at FROM telegram_deliveries WHERE kind = 'import'",
      ).first(),
    ).toEqual({ attempts: 0, sent_at: null, failed_at: later(45).toISOString() });
  });

  it("una chat sostituita durante l'invio scarta la consegna senza errori", async () => {
    const seller = await linked("corsa-chat");
    await order(seller.store, "o-corsa-chat", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const replaced = racing("SELECT chat_id FROM telegram_links", () => ["sostituito"]);
    const logs = await logged(() => deliverTelegram(replaced, api.fetcher, later(10)));
    expect(logs).toEqual([]);
    expect(api.calls).toHaveLength(0);
    expect(await deliveryOf("o-corsa-chat")).toMatchObject({
      attempts: 0,
      failed_at: later(10).toISOString(),
    });
  });

  it("un ordine non più consultabile durante la valutazione resta da valutare", async () => {
    const seller = await linked("corsa-ordine");
    await order(seller.store, "o-corsa-ordine", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const hidden = racing("WITH visible_orders", ([, ...rest]) => ["uscito", ...rest]);
    const logs = await logged(() => deliverTelegram(hidden, api.fetcher, later(10)));
    expect(logs).toEqual([]);
    expect(await evaluatedAt("o-corsa-ordine")).toBeUndefined();
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-corsa-ordine")]);
  });

  it("uno spazio senza membri non prepara eventi", async () => {
    const seller = await linked("senza-membri");
    await env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(5).toISOString(), seller.store)
      .run();
    await order(seller.store, "o-senza-membri", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.calls).toHaveLength(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
  });

  it("con «solo fiscali» il dato arrivato a notifiche spente non arriva alla riattivazione", async () => {
    const seller = await linked("arrivo-spente");
    await order(seller.store, "o-arrivo-spente");
    const api = bot();
    await run(api.fetcher, 10);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: false },
      "UTC",
      later(12),
    );
    await insertTaxIdentifiers({
      id: "t-arrivo-spente",
      orderId: "o-arrivo-spente",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      source: "ebay_trading_get_orders",
      observedAt: later(15).toISOString(),
    }).run();
    // Con le notifiche spente lo spazio non si valuta: lo stato resta quello registrato.
    await run(api.fetcher, 16);
    expect(await evaluatedAt("o-arrivo-spente")).toBe(later(10).toISOString());
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(18),
    );
    await run(api.fetcher, 20);
    expect(api.calls).toHaveLength(0);
    // Il dato che cambia dopo la riattivazione arriva come nuovo ordine.
    await env.DB.batch([
      env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-arrivo-spente'").bind(
        later(25).toISOString(),
      ),
      insertTaxIdentifiers({
        id: "t-arrivo-dopo",
        orderId: "o-arrivo-spente",
        type: "CODICE_FISCALE",
        value: "BNCLGU80A01H501Z",
        source: "ebay_trading_get_orders",
        observedAt: later(25).toISOString(),
      }),
    ]);
    await run(api.fetcher, 30);
    expect(sentTexts(api)).toEqual([
      expect.stringMatching(/Nuovo ordine[\s\S]*<code>BNCLGU80A01H501Z<\/code>/u),
    ]);
  });

  it("una variazione conta se scritta dopo l'inizio della finestra di lettura", async () => {
    const seller = await linked("finestra");
    await order(seller.store, "o-finestra");
    const api = bot();
    await run(api.fetcher, 30);
    expect(await evaluatedAt("o-finestra")).toBe(later(30).toISOString());
    // La finestra comincia 15 minuti prima della valutazione: un dato precedente non è una
    // variazione e l'ordine non si rivaluta.
    const start = later(15).getTime();
    await insertTaxIdentifiers({
      id: "t-finestra",
      orderId: "o-finestra",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      source: "ebay_trading_get_orders",
      observedAt: new Date(start - 1000).toISOString(),
    }).run();
    await run(api.fetcher, 40);
    expect(await evaluatedAt("o-finestra")).toBe(later(30).toISOString());
    expect(api.calls).toHaveLength(0);
    await env.DB.prepare("UPDATE tax_identifiers SET observed_at = ? WHERE id = 't-finestra'")
      .bind(new Date(start + 1000).toISOString())
      .run();
    await run(api.fetcher, 50);
    expect(await evaluatedAt("o-finestra")).toBe(later(50).toISOString());
    expect(sentTexts(api)).toEqual([expect.stringContaining("<code>RSSMRA80A01H501U</code>")]);
  });

  it("il riepilogo parte all'orario esatto; con un messaggio per ordine non c'è riepilogo", async () => {
    const digest = await linked("orario-esatto", 661);
    const each = await linked("per-ordine", 662);
    await digestMode(digest);
    await saveTelegramChange(env.DB, each.userId, { name: "digestTime", value: "21:00" }, "UTC");
    await order(digest.store, "o-orario-esatto", { cf: "RSSMRA80A01H501U" });
    await order(each.store, "o-per-ordine", { cf: "BNCLGU80A01H501Z" });
    const api = bot();
    await run(api.fetcher, 60);
    const texts = Object.fromEntries(
      api.texts().map((call) => [call.params.chat_id, String(call.params.text)]),
    );
    expect(Object.keys(texts).sort()).toEqual(["661", "662"]);
    expect(texts["661"]).toMatch(/Riepilogo del[\s\S]*ebay-o-orario-esatto/u);
    expect(texts["662"]).toMatch(/^🛒 <b>Nuovo ordine<\/b>[\s\S]*ebay-o-per-ordine/u);
    expect(await digestOf(each)).toBeNull();
  });

  it("elimina le consegne chiuse dopo sette giorni e le altre dopo trenta", async () => {
    const seller = await account("conservazione");
    const day = 86_400_000;
    const at = Date.parse(now);
    const rows: Array<[string, number, "sent_at" | "failed_at" | null]> = [
      ["inviata-7", at - 7 * day, "sent_at"],
      ["fallita-7", at - 7 * day, "failed_at"],
      ["inviata-recente", at - 7 * day + 1, "sent_at"],
      ["aperta-30", at - 30 * day, null],
      ["aperta-recente", at - 30 * day + 1, null],
      ["aperta-8", at - 8 * day, null],
    ];
    await env.DB.batch(
      rows.map(([id, created, closed]) => {
        const iso = new Date(created).toISOString();
        return env.DB.prepare(`INSERT INTO telegram_deliveries
          (id, workspace_id, link_id, kind, store_id, event_key, event_at, created_at, sent_at, failed_at)
          VALUES (?, ?, 'collegamento', 'import', ?, ?, ?, ?, ?, ?)`).bind(
          id,
          seller.workspace,
          seller.store,
          `import:${id}`,
          iso,
          iso,
          closed === "sent_at" ? iso : null,
          closed === "failed_at" ? iso : null,
        );
      }),
    );
    await purgeExpiredRecords(env.DB, new Date(now));
    const { results } = await env.DB.prepare("SELECT id FROM telegram_deliveries ORDER BY id").all<{
      id: string;
    }>();
    expect(results.map(({ id }) => id)).toEqual(["aperta-8", "aperta-recente", "inviata-recente"]);
  });
});

/** Tocco su un pulsante di un messaggio del bot, dall'ingresso alla coda. */
