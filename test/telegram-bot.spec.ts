import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { setSwitch } from "../app/domain/service-settings.server";
import { saveTelegramChange, telegramSettings } from "../app/domain/telegram.server";
import { verifyTelegramUpdate } from "../app/integrations/telegram.server";
import { receiveWebhook } from "../app/webhooks.server";
import {
  configureBotCommands,
  configureBotProfile,
  consumeTelegramUpdate,
} from "../app/domain/telegram-bot.server";
import { insertStore, later, now, resetDatabase } from "./fixtures/database-fixtures";
import { fakeBot as bot } from "./fixtures/telegram-fixtures";
import {
  origin,
  secret,
  send,
  environment,
  account,
  linkToken,
  update,
  webhook,
  deliver,
  link,
  linked,
  order,
  run,
  sentTexts,
  keyboard,
  failure,
  tap,
  receipt,
  callbackId,
} from "./fixtures/telegram-scenarios";
import { pagePath } from "./fixtures/route-fixtures";

beforeEach(async () => {
  await resetDatabase();
  send.mockClear();
});

describe("comandi e pulsanti del bot", () => {
  const generation = async (workspace: string) => (await link(workspace))!.id.slice(0, 8);

  it("lo stato coincide con le Impostazioni e i pulsanti le modificano", async () => {
    const seller = await linked("comandi");
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher);
    const status = api.texts()[0]!;
    expect(String(status.params.text)).toContain("Premium fino al");
    expect(String(status.params.text)).toContain(
      "🔔 Notifiche attive · solo con Codice Fiscale o P.IVA\n📨 Un messaggio per ordine",
    );
    const gen = await generation(seller.workspace);
    expect(keyboard(status)[0]![0]).toEqual({ text: "⚙️ Preferenze", callback_data: `${gen}:pr` });

    await tap(`${gen}:fi:all`, seller.chat, api.fetcher);
    // Il tocco ha la risposta dall'ingresso, senza attendere la coda.
    expect(send).not.toHaveBeenCalled();
    // Un tocco ripetuto porta lo stesso valore: la scelta non si inverte.
    await tap(`${gen}:fi:all`, seller.chat, api.fetcher);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).filter).toBe("all");
    expect(api.calls.filter((call) => call.method === "answerCallbackQuery")).toHaveLength(2);
    const edited = api.calls.filter((call) => call.method === "editMessageText").at(-1)!;
    expect(edited.params).toMatchObject({ chat_id: "601", message_id: 42 });
    expect(keyboard(edited)[1]![1]).toEqual({
      text: "● Tutti gli ordini",
      callback_data: `${gen}:fi:all`,
    });

    await tap(`${gen}:mo:digest`, seller.chat, api.fetcher);
    await tap(`${gen}:tm:0800`, seller.chat, api.fetcher);
    await tap(`${gen}:sx:0:0:${seller.store}`, seller.chat, api.fetcher);
    await tap(`${gen}:en:0`, seller.chat, api.fetcher);
    // Il fuso del riepilogo resta quello fissato dal sito.
    expect(await telegramSettings(env.DB, seller.userId, "UTC")).toMatchObject({
      enabled: false,
      mode: "digest",
      digestTime: "08:00",
      timeZone: "Europe/Rome",
      stores: [{ id: seller.store, enabled: false }],
    });
  });

  it("un pulsante di un collegamento sostituito non ha effetto", async () => {
    const seller = await linked("sostituito");
    const old = await generation(seller.workspace);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 603);
    const api = bot();
    await tap(`${old}:fi:all`, seller.chat, api.fetcher);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).filter).toBe("fiscal");
    expect(api.calls).toEqual([
      expect.objectContaining({
        method: "answerCallbackQuery",
        params: expect.objectContaining({ text: "Questo pulsante non è più valido." }),
      }),
    ]);
  });

  it("scollega la chat con due tocchi e annulla le consegne in attesa", async () => {
    const seller = await linked("scollega");
    await order(seller.store, "o-scollega", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    const gen = await generation(seller.workspace);
    const api = bot();
    await tap(`${gen}:ul`, seller.chat, api.fetcher);
    expect(await link(seller.workspace)).not.toBeNull();
    await tap(`${gen}:ul:ok`, seller.chat, api.fetcher);
    expect(await link(seller.workspace)).toBeNull();
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
    // Da scollegata, sul test, la chat non vede più nulla.
    const silent = bot();
    await deliver("/stato", seller.chat, silent.fetcher);
    expect(silent.calls).toHaveLength(0);
  });

  it("gli ultimi ordini dei negozi inclusi arrivano cinque alla volta, fino a venti", async () => {
    const seller = await linked("ultimi");
    for (let index = 0; index < 7; index++)
      await order(seller.store, `o-ultimi-${index}`, {
        cf: "RSSMRA80A01H501U",
        created: index - 30,
        listed: 1,
      });
    // Un negozio escluso con ordini più recenti non toglie posto a quelli inclusi.
    await insertStore({ id: "s-ultimi-escluso", workspaceId: seller.workspace }).run();
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: "s-ultimi-escluso", value: false },
      "UTC",
    );
    for (let index = 0; index < 20; index++)
      await order("s-ultimi-escluso", `o-escluso-${index}`, { created: index - 20, listed: 1 });
    const api = bot();
    await deliver("/ultimi", seller.chat, api.fetcher);
    // Un solo messaggio con cinque ordini, dal più recente; il numero apre il dettaglio.
    const [list] = sentTexts(api);
    expect(sentTexts(api)).toHaveLength(1);
    expect(list).toContain("🛒 <b>Ultimi ordini</b> · <i>1–5 di 7</i>");
    expect(list).toContain(`<a href="${origin}/app/ordini/o-ultimi-6">ebay-o-ultimi-6</a>`);
    expect(list).not.toContain("ebay-o-ultimi-1");
    expect(list).not.toContain("o-escluso");
    const gen = await generation(seller.workspace);
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "Altri 5 ›", callback_data: `${gen}:la:5` }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini` }],
    ]);
    // Le pagine aggiornano lo stesso messaggio; un tocco ripetuto lo riscrive uguale.
    await tap(`${gen}:la:5`, seller.chat, api.fetcher);
    await tap(`${gen}:la:5`, seller.chat, api.fetcher);
    const edits = api.calls.filter((call) => call.method === "editMessageText");
    expect(api.texts()).toHaveLength(1);
    expect(edits).toHaveLength(2);
    expect(edits[0]!.params.text).toEqual(edits[1]!.params.text);
    expect(String(edits[0]!.params.text)).toContain("1–5 di 7".replace("1–5", "6–7"));
    expect(String(edits[0]!.params.text)).toContain("ebay-o-ultimi-0");
    expect(keyboard(edits[0]!)[0]).toEqual([
      { text: "‹ Precedenti", callback_data: `${gen}:la:0` },
    ]);
  });

  it("negli ultimi ordini ogni Codice Fiscale autorizzato ha il suo pulsante di copia", async () => {
    const seller = await linked("copia");
    await order(seller.store, "o-copia-uno", { cf: "rss mra80a01h501u", created: 1, listed: 2 });
    await order(seller.store, "o-copia-due", { cf: "BNCLGU80A01H501Z", created: 3, listed: 4 });
    await order(seller.store, "o-copia-senza", { created: 5, listed: 6 });
    const api = bot();
    await deliver("/ultimi", seller.chat, api.fetcher, later(10));
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "📋 BNCLGU80A01H501Z", copy_text: { text: "BNCLGU80A01H501Z" } }],
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini` }],
    ]);
  });

  it("l'aiuto presenta i comandi con le loro icone, nelle due lingue", async () => {
    const seller = await linked("aiuto");
    const api = bot();
    await deliver("/aiuto", seller.chat, api.fetcher);
    expect(sentTexts(api)[0]).toBe(
      [
        "👋 <b>FiscalBay</b>\nQui arrivano le notifiche degli ordini, secondo le preferenze delle Impostazioni.",
        "⭐ /stato · piano, notifiche e negozi\n🛒 /ultimi · gli ultimi ordini\n⚙️ /preferenze · pausa, filtro, frequenza e negozi",
        "<i>Ricerca, sblocco ed esportazione restano sul sito.</i>",
      ].join("\n\n"),
    );
    await env.DB.prepare("UPDATE telegram_links SET language = 'en' WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    await deliver("/help", seller.chat, api.fetcher, later(1));
    expect(sentTexts(api)[1]).toContain("🛒 /latest · the latest orders");
  });

  it("senza Premium lo stato dice Free e le preferenze rimandano al piano", async () => {
    const seller = await linked("free");
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(now, seller.workspace)
      .run();
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher, later(1));
    await deliver("/preferences", seller.chat, api.fetcher, later(2));
    await deliver("/aiuto", seller.chat, api.fetcher, later(3));
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("Con il piano Free le notifiche sono ferme."),
      expect.stringContaining("compresi in Premium"),
      expect.stringContaining("/ultimi"),
    ]);
  });

  it("lo stato avvisa della chat irraggiungibile, che un comando non chiude", async () => {
    const seller = await linked("stato-irraggiungibile");
    await env.DB.prepare(`UPDATE telegram_links SET delivery_failure = 'unreachable',
        delivery_failed_at = ? WHERE workspace_id = ?`)
      .bind(now, seller.workspace)
      .run();
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher, later(1));
    expect(sentTexts(api)[0]).toContain(
      "⚠️ Alcuni messaggi non sono arrivati dopo diversi tentativi.",
    );
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
      "unreachable",
    );
  });

  it("un pulsante con il negozio di un altro spazio non ha effetto", async () => {
    const seller = await linked("pulsante-negozio");
    const other = await account("pulsante-altro");
    const api = bot();
    await tap(
      `${await generation(seller.workspace)}:sx:0:0:${other.store}`,
      seller.chat,
      api.fetcher,
    );
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM telegram_store_preferences").first(),
    ).toEqual({ n: 0 });
    expect((await telegramSettings(env.DB, other.userId, "UTC")).stores).toEqual([
      expect.objectContaining({ id: other.store, enabled: true }),
    ]);
    const edited = api.calls.find((call) => call.method === "editMessageText")!;
    expect(JSON.stringify(edited.params)).not.toContain(other.store);
  });

  it("il limite per chat regge agli aggiornamenti simultanei e chiude l'attesa del tocco ignorato", async () => {
    const api = bot();
    await Promise.all(
      Array.from({ length: 25 }, () =>
        receiveWebhook(webhook(update("/aiuto", 778)), environment, api.fetcher, new Date(now)),
      ),
    );
    const receipts = () =>
      env.DB.prepare("SELECT count(*) AS n FROM webhook_receipts WHERE object_id = '778'").first();
    expect(await receipts()).toEqual({ n: 20 });
    await tap("abcdefgh:pr", 778, api.fetcher);
    expect(send).not.toHaveBeenCalled();
    expect(await receipts()).toEqual({ n: 20 });
    expect(api.calls).toEqual([
      { method: "answerCallbackQuery", params: { callback_query_id: `cb-${callbackId}` } },
    ]);
  });

  it("riconosce i comandi del menu, limita gli aggiornamenti per chat e configura il menu", async () => {
    const parse = (text: string) => verifyTelegramUpdate(JSON.stringify(update(text)), secret, env);
    expect(parse("/stato")).toMatchObject({ kind: "command", command: "status" });
    expect(parse("/latest@FiscalBayTestBot")).toMatchObject({ kind: "command", command: "latest" });
    expect(parse("/stato ora")).toBeNull();
    for (let index = 0; index < 20; index++)
      await receiveWebhook(webhook(update("/aiuto", 777)), environment);
    send.mockClear();
    expect((await receiveWebhook(webhook(update("/aiuto", 777)), environment))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const api = bot();
    await configureBotCommands(environment, api.fetcher);
    // I comandi lasciati da BotFather nell'ambito predefinito si eliminano a ogni riallineamento.
    expect(api.calls.map((call) => call.method)).toEqual([
      "deleteMyCommands",
      "setMyCommands",
      "setMyCommands",
    ]);
    expect(api.calls.map((call) => call.params)).toEqual([
      { scope: { type: "default" } },
      {
        language_code: "it",
        scope: { type: "all_private_chats" },
        commands: [
          { command: "stato", description: "Piano, notifiche e negozi" },
          { command: "ultimi", description: "Ultimi ordini" },
          { command: "preferenze", description: "Notifiche e negozi" },
          { command: "aiuto", description: "Come funziona il bot" },
        ],
      },
      {
        scope: { type: "all_private_chats" },
        commands: [
          { command: "status", description: "Plan, notifications and stores" },
          { command: "latest", description: "Latest orders" },
          { command: "preferences", description: "Notifications and stores" },
          { command: "help", description: "How the bot works" },
        ],
      },
    ]);
    // Senza il bot dell'ambiente il menu non si configura.
    const unconfigured = bot();
    await configureBotCommands(
      { ...environment, TELEGRAM_BOT_TOKEN: undefined } as unknown as Env,
      unconfigured.fetcher,
    );
    expect(unconfigured.calls).toEqual([]);
  });

  it("allinea nome e descrizioni del bot e non riscrive i campi già uguali", async () => {
    const api = bot();
    await configureBotProfile(environment, api.fetcher);
    const writes = api.calls.filter((call) => call.method.startsWith("setMy"));
    expect(writes).toHaveLength(6);
    expect(writes).toContainEqual({
      method: "setMyShortDescription",
      params: {
        language_code: "it",
        short_description:
          "Notifiche degli ordini eBay con Codice Fiscale o Partita IVA dell’acquirente.",
      },
    });
    expect(writes).toContainEqual({ method: "setMyName", params: { name: "FiscalBay" } });
    // Telegram limita i cambi di nome: un campo già uguale non si scrive di nuovo.
    const aligned = bot((call) =>
      call.method === "getMyName"
        ? Response.json({ ok: true, result: { name: "FiscalBay" } })
        : undefined,
    );
    await configureBotProfile(environment, aligned.fetcher);
    expect(aligned.methods().filter((method) => method === "setMyName")).toEqual([]);
    expect(aligned.methods().filter((method) => method.startsWith("setMy"))).toHaveLength(4);
    // Senza il bot dell'ambiente, o con gli invii spenti, il profilo non si tocca.
    const unconfigured = bot();
    await configureBotProfile(
      { ...environment, TELEGRAM_BOT_TOKEN: undefined } as unknown as Env,
      unconfigured.fetcher,
    );
    expect(unconfigured.calls).toEqual([]);
    await setSwitch(env.DB, "telegram_sends", false, new Date(now));
    const paused = bot();
    await configureBotProfile(environment, paused.fetcher);
    expect(paused.calls).toEqual([]);
  });

  /** Testi attesi delle risposte del bot, nelle due lingue. */
  const replies = {
    it: {
      path: "",
      premium: "Premium fino al 13 ott",
      trial: "Prova Premium fino al 20 set",
      lifetime: "Premium a vita",
      freeNote: "Con il piano Free le notifiche sono ferme.",
      enabled: "Notifiche attive",
      paused: "Notifiche in pausa",
      fiscal: "solo con Codice Fiscale o P.IVA",
      all: "tutti gli ordini",
      fiscalTitle: "Solo ordini con Codice Fiscale o Partita IVA",
      allTitle: "Tutti gli ordini",
      each: "Un messaggio per ordine",
      digest: "Riepilogo alle 18:00 · Roma (Italia)",
      zone: "Roma (Italia)",
      zoneNote: "Il fuso si cambia dal sito.",
      stores: "Negozi",
      notes: { reconnect: "da ricollegare", excluded: "escluso", suspended: "sospeso" },
      noDelivery: "Nessun invio finora",
      lastDelivery: "Ultimo invio oggi 20:30",
      unreachable: "Alcuni messaggi non sono arrivati dopo diversi tentativi.",
      preferences: "Preferenze",
      settings: "Impostazioni",
      choosePlan: "Scegli il piano",
      premiumRequired:
        "Notifiche e ultimi ordini nel bot sono compresi in Premium, nella prova e nel lifetime.",
      pause: "Metti in pausa",
      resume: "Riprendi le notifiche",
      fiscalOnly: "Solo con Codice Fiscale o P.IVA",
      allOrders: "Tutti gli ordini",
      eachShort: "Uno per ordine",
      digestShort: "Riepilogo",
      time: "Orario: 18:00",
      storeCount: "Negozi: 10 di 11",
      timeTitle: "Orario del riepilogo",
      storesTitle: "Negozi nelle notifiche",
      back: "Indietro",
      unlink: "Scollega la chat",
      unlinkQuestion:
        "Scollegare questa chat? Le notifiche in attesa si annullano e la chat non riceve più nulla finché non la colleghi di nuovo dal sito.",
      unlinkConfirm: "Sì, scollega",
      cancel: "Annulla",
      unlinked:
        "Chat scollegata. Puoi collegarla di nuovo da FiscalBay, in Impostazioni › Notifiche.",
      latestEmpty: "Nessun ordine da mostrare nei negozi inclusi.",
      expired: "Questo pulsante non è più valido.",
      help: [
        "👋 <b>FiscalBay</b>\nQui arrivano le notifiche degli ordini, secondo le preferenze delle Impostazioni.",
        "⭐ /stato · piano, notifiche e negozi\n🛒 /ultimi · gli ultimi ordini\n⚙️ /preferenze · pausa, filtro, frequenza e negozi",
        "<i>Ricerca, sblocco ed esportazione restano sul sito.</i>",
      ],
    },
    en: {
      path: "/en",
      premium: "Premium until 13 Oct",
      trial: "Premium trial until 20 Sept",
      lifetime: "Lifetime Premium",
      freeNote: "Notifications are stopped on the Free plan.",
      enabled: "Notifications on",
      paused: "Notifications paused",
      fiscal: "only with a tax code or VAT",
      all: "all orders",
      fiscalTitle: "Only orders with a tax code or VAT number",
      allTitle: "All orders",
      each: "One message per order",
      digest: "Summary at 18:00 · Rome (Italy)",
      zone: "Rome (Italy)",
      zoneNote: "The time zone is changed on the website.",
      stores: "Stores",
      notes: { reconnect: "to reconnect", excluded: "excluded", suspended: "suspended" },
      noDelivery: "Nothing delivered yet",
      lastDelivery: "Last delivery today 20:30",
      unreachable: "Some messages did not arrive after several attempts.",
      preferences: "Preferences",
      settings: "Settings",
      choosePlan: "Choose a plan",
      premiumRequired:
        "Notifications and latest orders in the bot are included in Premium, the trial and lifetime.",
      pause: "Pause",
      resume: "Resume notifications",
      fiscalOnly: "Only with tax code or VAT",
      allOrders: "All orders",
      eachShort: "One per order",
      digestShort: "Summary",
      time: "Time: 18:00",
      storeCount: "Stores: 10 of 11",
      timeTitle: "Summary time",
      storesTitle: "Stores in notifications",
      back: "Back",
      unlink: "Unlink this chat",
      unlinkQuestion:
        "Unlink this chat? Pending notifications are cancelled and the chat receives nothing until you link it again on the website.",
      unlinkConfirm: "Yes, unlink",
      cancel: "Cancel",
      unlinked:
        "Chat unlinked. You can link it again in FiscalBay, under Settings › Notifications.",
      latestEmpty: "No orders to show in the included stores.",
      expired: "This button is no longer valid.",
      help: [
        "👋 <b>FiscalBay</b>\nOrder notifications arrive here according to your Settings.",
        "⭐ /status · plan, notifications and stores\n🛒 /latest · the latest orders\n⚙️ /preferences · pause, filter, frequency and stores",
        "<i>Search, unlocking and export stay on the website.</i>",
      ],
    },
  } as const;

  /**
   * Chat collegata nella lingua data, con dodici negozi: da ricollegare, attivo, escluso,
   * sospeso per il piano, con un nome oltre i quaranta caratteri e altri sette.
   */
  async function storefront(language: "it" | "en") {
    const seller = await linked(`menu-${language}`);
    await env.DB.prepare("UPDATE telegram_links SET language = ? WHERE workspace_id = ?")
      .bind(language, seller.workspace)
      .run();
    const store = (id: string, name: string, minutes: number) => [
      env.DB.prepare(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, store_name, linked_at)
        VALUES (?, ?, ?, ?, ?)`).bind(id, seller.workspace, id, name, later(minutes).toISOString()),
      env.DB.prepare(`INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at,
          refresh_token, refresh_expires_at, granted_at) VALUES (?, 'a', ?, 'r', ?, ?)`).bind(
        id,
        later(60).toISOString(),
        later(365 * 24 * 60).toISOString(),
        now,
      ),
    ];
    await env.DB.batch([
      env.DB.prepare("UPDATE ebay_stores SET store_name = 'Da ricollegare' WHERE id = ?").bind(
        seller.store,
      ),
      ...store("s-m-1", "Attivo <&>", 1),
      ...store("s-m-2", "Escluso", 2),
      ...store("s-m-3", "Sospeso", 3),
      ...store("s-m-4", "N".repeat(45), 4),
      ...Array.from({ length: 7 }, (_, index) =>
        store(`s-m-${index + 5}`, `Altro ${index + 5}`, index + 5),
      ).flat(),
      env.DB.prepare(
        "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-m-3', 'plan', ?)",
      ).bind(now),
      env.DB.prepare(
        "INSERT INTO telegram_store_preferences (store_id, enabled, updated_at) VALUES ('s-m-2', 0, ?)",
      ).bind(now),
    ]);
    const gen = (await generation(seller.workspace))!;
    const api = bot();
    let minute = 0;
    /** Ultimo messaggio inviato o modificato dal bot, con i pulsanti. */
    const reply = () => {
      const { method, params } = api.calls.at(-1)!;
      const markup = params.reply_markup as
        | { inline_keyboard: Array<Array<Record<string, unknown>>> }
        | undefined;
      return { method, text: params.text, buttons: markup?.inline_keyboard };
    };
    return {
      seller,
      gen,
      api,
      say: async (text: string) => {
        await deliver(text, seller.chat, api.fetcher, later(++minute));
        return reply();
      },
      press: async (data: string) => {
        await tap(`${gen}:${data}`, seller.chat, api.fetcher, later(++minute));
        return reply();
      },
    };
  }

  it.each(["it", "en"] as const)(
    "ogni risposta di comandi e pulsanti nella lingua della chat (%s)",
    async (language) => {
      const t = replies[language];
      const { seller, gen, api, say, press } = await storefront(language);
      const settings = {
        text: `🔗 ${t.settings}`,
        url: `${origin}${pagePath(t.path, "/app/impostazioni/notifiche")}`,
      };
      const plan = {
        text: `⭐ ${t.choosePlan}`,
        url: `${origin}${pagePath(t.path, "/app/impostazioni/piano")}`,
      };
      const stores = [
        `🏪 <b>${t.stores}</b>`,
        `🔴 Da ricollegare · <i>${t.notes.reconnect}</i>`,
        "🟢 Attivo &lt;&amp;&gt;",
        `⚪ Escluso · <i>${t.notes.excluded}</i>`,
        `⏸ Sospeso · <i>${t.notes.suspended}</i>`,
        `🟢 ${"N".repeat(40)}`,
        ...[5, 6, 7, 8, 9].map((index) => `🟢 Altro ${index}`),
        "+2",
      ].join("\n");
      const status = (head: string[], delivery: string[]) =>
        [head.join("\n"), stores, delivery.join("\n")].join("\n\n");
      const premiumStatus = [
        [{ text: `⚙️ ${t.preferences}`, callback_data: `${gen}:pr` }, settings],
      ];
      const footer = [{ text: `🔌 ${t.unlink}`, callback_data: `${gen}:ul` }, settings];
      const storesButton = { text: `🏪 ${t.storeCount}`, callback_data: `${gen}:ss:0` };

      expect(await say("/stato")).toEqual({
        method: "sendMessage",
        text: status(
          [`⭐ <b>${t.premium}</b>`, `🔔 ${t.enabled} · ${t.fiscal}`, `📨 ${t.each}`],
          [`📨 <i>${t.noDelivery}</i>`],
        ),
        buttons: premiumStatus,
      });
      const fiscalEach = {
        method: "sendMessage",
        text: `🔔 <b>${t.enabled}</b>\n🧾 ${t.fiscalTitle}\n📨 ${t.each}`,
        buttons: [
          [{ text: `⏸ ${t.pause}`, callback_data: `${gen}:en:0` }],
          [
            { text: `● ${t.fiscalOnly}`, callback_data: `${gen}:fi:fiscal` },
            { text: `○ ${t.allOrders}`, callback_data: `${gen}:fi:all` },
          ],
          [
            { text: `● ${t.eachShort}`, callback_data: `${gen}:mo:each` },
            { text: `○ ${t.digestShort}`, callback_data: `${gen}:mo:digest` },
          ],
          [storesButton],
          footer,
        ],
      };
      expect(await say("/preferenze")).toEqual(fiscalEach);
      expect(await say("/ultimi")).toEqual({
        method: "sendMessage",
        text: t.latestEmpty,
        buttons: undefined,
      });
      expect(await press("tm")).toEqual({
        method: "editMessageText",
        text: `🕘 <b>${t.timeTitle}</b>\n${t.zone}\n<i>${t.zoneNote}</i>`,
        buttons: [
          [
            { text: "○ 08:00", callback_data: `${gen}:tm:0800` },
            { text: "○ 12:00", callback_data: `${gen}:tm:1200` },
            { text: "● 18:00", callback_data: `${gen}:tm:1800` },
            { text: "○ 21:00", callback_data: `${gen}:tm:2100` },
          ],
          [{ text: `‹ ${t.back}`, callback_data: `${gen}:pr` }],
        ],
      });
      const back = [{ text: `‹ ${t.back}`, callback_data: `${gen}:pr` }];
      expect(await press("ss:0")).toEqual({
        method: "editMessageText",
        text: `🏪 <b>${t.storesTitle}</b>`,
        buttons: [
          [{ text: "☑ Da ricollegare", callback_data: `${gen}:sx:0:0:${seller.store}` }],
          [{ text: "☑ Attivo <&>", callback_data: `${gen}:sx:0:0:s-m-1` }],
          [{ text: "☐ Escluso", callback_data: `${gen}:sx:0:1:s-m-2` }],
          [{ text: `⏸ Sospeso · ${t.notes.suspended}`, callback_data: `${gen}:ss:0` }],
          [{ text: `☑ ${"N".repeat(40)}`, callback_data: `${gen}:sx:0:0:s-m-4` }],
          [{ text: "☑ Altro 5", callback_data: `${gen}:sx:0:0:s-m-5` }],
          [{ text: "›", callback_data: `${gen}:ss:1` }],
          back,
        ],
      });
      expect(await press("ss:1")).toEqual({
        method: "editMessageText",
        text: `🏪 <b>${t.storesTitle}</b>`,
        buttons: [
          ...[6, 7, 8, 9, 10, 11].map((index) => [
            { text: `☑ Altro ${index}`, callback_data: `${gen}:sx:1:0:s-m-${index}` },
          ]),
          [{ text: "‹", callback_data: `${gen}:ss:0` }],
          back,
        ],
      });
      expect(await press("ul")).toEqual({
        method: "editMessageText",
        text: t.unlinkQuestion,
        buttons: [
          [
            { text: t.unlinkConfirm, callback_data: `${gen}:ul:ok` },
            { text: t.cancel, callback_data: `${gen}:pr` },
          ],
        ],
      });
      const resume = [{ text: `▶️ ${t.resume}`, callback_data: `${gen}:en:1` }];
      expect(await press("en:0")).toEqual({
        method: "editMessageText",
        text: `⏸ <b>${t.paused}</b>\n🧾 ${t.fiscalTitle}\n📨 ${t.each}`,
        buttons: [resume, footer],
      });
      expect(await press("en:1")).toEqual({ ...fiscalEach, method: "editMessageText" });
      expect(await press("fi:all")).toEqual({
        method: "editMessageText",
        text: `🔔 <b>${t.enabled}</b>\n📦 ${t.allTitle}\n📨 ${t.each}`,
        buttons: [
          fiscalEach.buttons[0],
          [
            { text: `○ ${t.fiscalOnly}`, callback_data: `${gen}:fi:fiscal` },
            { text: `● ${t.allOrders}`, callback_data: `${gen}:fi:all` },
          ],
          ...fiscalEach.buttons.slice(2),
        ],
      });
      expect((await say("/stato")).text).toEqual(
        status(
          [`⭐ <b>${t.premium}</b>`, `🔔 ${t.enabled} · ${t.all}`, `📨 ${t.each}`],
          [`📨 <i>${t.noDelivery}</i>`],
        ),
      );
      const digestText = `📦 ${t.allTitle}\n🕘 ${t.digest}\n<i>${t.zoneNote}</i>`;
      expect(await press("mo:digest")).toEqual({
        method: "editMessageText",
        text: `🔔 <b>${t.enabled}</b>\n${digestText}`,
        buttons: [
          fiscalEach.buttons[0],
          [
            { text: `○ ${t.fiscalOnly}`, callback_data: `${gen}:fi:fiscal` },
            { text: `● ${t.allOrders}`, callback_data: `${gen}:fi:all` },
          ],
          [
            { text: `○ ${t.eachShort}`, callback_data: `${gen}:mo:each` },
            { text: `● ${t.digestShort}`, callback_data: `${gen}:mo:digest` },
          ],
          [{ text: `🕘 ${t.time}`, callback_data: `${gen}:tm` }, storesButton],
          footer,
        ],
      });
      expect(await press("en:0")).toEqual({
        method: "editMessageText",
        text: `⏸ <b>${t.paused}</b>\n${digestText}`,
        buttons: [resume, footer],
      });

      // Prova in corso, consegne irraggiungibili e un invio un'ora e mezza prima.
      await env.DB.batch([
        env.DB.prepare(`UPDATE telegram_links SET last_delivery_at = ?,
            delivery_failure = 'unreachable', delivery_failed_at = ? WHERE workspace_id = ?`).bind(
          later(-90).toISOString(),
          now,
          seller.workspace,
        ),
        env.DB.prepare(
          "UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?",
        ).bind(now, seller.workspace),
        env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES (?, ?, 'trial', ?, ?)`).bind(
          `trial-${language}`,
          seller.workspace,
          now,
          later(7 * 24 * 60).toISOString(),
        ),
      ]);
      const pausedHead = [`⏸ ${t.paused}`, `🕘 ${t.digest}`];
      const troubled = [`📨 <i>${t.lastDelivery}</i>`, `⚠️ ${t.unreachable}`];
      expect(await say("/stato")).toEqual({
        method: "sendMessage",
        text: status([`⭐ <b>${t.trial}</b>`, ...pausedHead], troubled),
        buttons: premiumStatus,
      });
      await env.DB.batch([
        env.DB.prepare(`UPDATE workspace_entitlements SET revoked_at = ?
          WHERE workspace_id = ? AND revoked_at IS NULL`).bind(now, seller.workspace),
        env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, activated_at, created_at)
          VALUES (?, ?, 'active', ?, ?)`).bind(
          language === "it" ? 1 : 2,
          seller.workspace,
          now,
          now,
        ),
        env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
            granted_by, grant_reason) VALUES (?, ?, 'lifetime', ?, 'owner', 'prova')`).bind(
          `lifetime-${language}`,
          seller.workspace,
          now,
        ),
      ]);
      expect(await say("/stato")).toEqual({
        method: "sendMessage",
        text: status([`⭐ <b>${t.lifetime}</b>`, ...pausedHead], troubled),
        buttons: premiumStatus,
      });

      // Senza Premium lo stato propone il piano e ogni pulsante riporta allo stato.
      await env.DB.prepare(`UPDATE workspace_entitlements SET revoked_at = ?
          WHERE workspace_id = ? AND revoked_at IS NULL`)
        .bind(now, seller.workspace)
        .run();
      const free = {
        method: "sendMessage",
        text: status(["⭐ <b>Free</b>", `⏸ ${t.freeNote}`], troubled),
        buttons: [[plan, settings]],
      };
      expect(await say("/stato")).toEqual(free);
      expect(await say("/ultimi")).toEqual({
        method: "sendMessage",
        text: `⭐ ${t.premiumRequired}`,
        buttons: [[plan]],
      });
      expect(await press("ul:ok")).toEqual({ ...free, method: "editMessageText" });
      expect(await link(seller.workspace)).not.toBeNull();
      expect(await say("/aiuto")).toEqual({
        method: "sendMessage",
        text: t.help.join("\n\n"),
        buttons: [[settings]],
      });

      await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES (?, ?, 'admin', ?, ?)`)
        .bind(`admin-${language}`, seller.workspace, now, later(60).toISOString())
        .run();
      // Un pulsante di una generazione precedente scade, nella lingua della chat.
      await tap("zzzzzzzz:pr", seller.chat, api.fetcher, later(50));
      expect(api.calls.at(-1)).toEqual({
        method: "answerCallbackQuery",
        params: expect.objectContaining({ text: t.expired }),
      });
      expect(await press("ul:ok")).toEqual({
        method: "editMessageText",
        text: t.unlinked,
        buttons: [[{ text: t.settings, url: settings.url }]],
      });
      expect(await link(seller.workspace)).toBeNull();
    },
  );

  it("pagine fuori intervallo, scelte non previste e pulsanti senza azione non cambiano nulla", async () => {
    const { seller, gen, api, press } = await storefront("it");
    await insertStore({
      id: "s:due:punti",
      workspaceId: seller.workspace,
      linkedAt: later(30).toISOString(),
    }).run();
    const first = await press("ss:0");
    const second = await press("ss:1");
    // Tredici negozi: la terza pagina è l'ultima.
    expect(await press("ss:9")).toEqual(await press("ss:2"));
    expect(await press("ss:-1")).toEqual(first);
    expect(await press("ss:x")).toEqual(first);
    const toggled = await press("sx:1:0:s-m-6");
    expect(toggled.buttons![0]).toEqual([
      { text: "☐ Altro 6", callback_data: `${gen}:sx:1:1:s-m-6` },
    ]);
    expect(await press("sx:1:1:s-m-6")).toEqual(second);
    await press("sx:2:0:s:due:punti");
    const settings = () => telegramSettings(env.DB, seller.userId, "UTC");
    expect(
      (await settings()).stores.filter((store) => !store.enabled).map((store) => store.id),
    ).toEqual(["s-m-2", "s:due:punti"]);

    const menu = await press("pr");
    const before = await settings();
    // Ogni valore vale soltanto per la propria azione.
    for (const data of [
      "en:2",
      "en:all",
      "fi:x",
      "fi:digest",
      "mo:x",
      "mo:all",
      "xx:0800",
      "sx:0:2:s-m-1",
      "sx:0:1",
      "xx:0:0:s-m-1",
      "xx",
    ])
      expect(await press(data)).toEqual(menu);
    await tap(gen, seller.chat, api.fetcher, later(30));
    expect(api.calls.at(-1)!.params.text).toEqual(menu.text);
    const times = await press("tm");
    expect(await press("tm:0805")).toEqual(times);
    expect(await settings()).toEqual(before);
    for (const [data, change] of [
      ["fi:all", { filter: "all" }],
      ["fi:fiscal", { filter: "fiscal" }],
      ["mo:digest", { mode: "digest" }],
      ["mo:each", { mode: "each" }],
    ] as const) {
      await press(data);
      expect(await settings()).toMatchObject(change);
    }
    // Il pulsante dello stato mostra lo stesso messaggio del comando.
    const tapped = await press("st");
    await deliver("/stato", seller.chat, api.fetcher, later(31));
    const status = api.calls.at(-1)!;
    expect(tapped).toEqual({
      method: "editMessageText",
      text: status.params.text,
      buttons: keyboard(status),
    });

    // Le pagine degli ultimi ordini valgono da 0 a 19; le altre chiudono soltanto l'attesa.
    for (const data of ["la:-5", "la:20", "la:1e-1", "la:x"]) {
      const calls = api.calls.length;
      await press(data);
      expect(api.calls.slice(calls).map((call) => call.method)).toEqual(["answerCallbackQuery"]);
    }
    expect(await press("la:0")).toMatchObject({
      method: "editMessageText",
      text: "Nessun ordine da mostrare nei negozi inclusi.",
    });
    expect(await press("la:19")).toMatchObject({
      method: "editMessageText",
      text: "Nessun ordine da mostrare nei negozi inclusi.",
    });

    // Un pulsante di un'altra generazione nella chat collegata è scaduto.
    const calls = api.calls.length;
    await tap("zzzzzzzz:pr", seller.chat, api.fetcher, later(40));
    expect(api.calls.slice(calls)).toEqual([
      {
        method: "answerCallbackQuery",
        params: expect.objectContaining({ text: "Questo pulsante non è più valido." }),
      },
    ]);
  });

  it("gli ultimi ordini sandbox aprono la sandbox; a parità di data viene prima l'identificativo maggiore", async () => {
    const seller = await linked("ultimi-sandbox");
    const sandbox = (id: string, minutes: number) => [
      insertStore({
        id,
        workspaceId: seller.workspace,
        environment: "sandbox",
        linkedAt: later(minutes).toISOString(),
      }),
      env.DB.prepare(
        "INSERT INTO sync_state (store_id, history_from, history_until, updated_at) VALUES (?, ?, ?, ?)",
      ).bind(id, later(-30 * 24 * 60).toISOString(), now, now),
    ];
    await env.DB.batch([...sandbox("s-sandbox-uno", 1), ...sandbox("s-sandbox-due", 2)]);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: false },
      "UTC",
    );
    await order("s-sandbox-uno", "o-pari-a", { created: 5, listed: 6 });
    await order("s-sandbox-due", "o-pari-b", { created: 5, listed: 6 });
    for (let index = 0; index < 3; index++)
      await order("s-sandbox-uno", `o-sandbox-${index}`, { created: index - 10, listed: 6 });
    await order(seller.store, "o-production", { created: 4, listed: 6 });
    const api = bot();
    const gen = await generation(seller.workspace);
    const numbers = (text: unknown) =>
      [...String(text).matchAll(/>ebay-(o-[a-z0-9-]+)</gu)].map(([, id]) => id);
    await deliver("/ultimi", seller.chat, api.fetcher, later(10));
    const [list] = api.texts();
    // Cinque ordini esatti: nessuna pagina successiva.
    expect(numbers(list!.params.text)).toEqual([
      "o-pari-b",
      "o-pari-a",
      "o-sandbox-2",
      "o-sandbox-1",
      "o-sandbox-0",
    ]);
    expect(keyboard(list!)).toEqual([
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?environment=sandbox` }],
    ]);
    // Con un ordine Production nella pagina gli ordini si aprono in Production.
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: true },
      "UTC",
    );
    await deliver("/ultimi", seller.chat, api.fetcher, later(11));
    const mixed = api.texts()[1]!;
    expect(numbers(mixed.params.text)).toEqual([
      "o-pari-b",
      "o-pari-a",
      "o-production",
      "o-sandbox-2",
      "o-sandbox-1",
    ]);
    expect(keyboard(mixed)).toEqual([
      [{ text: "Altri 5 ›", callback_data: `${gen}:la:5` }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini` }],
    ]);
  });

  it("l'avvio senza token dalla chat collegata è l'aiuto; in Production un comando da una chat sconosciuta spiega dove collegarsi", async () => {
    const seller = await linked("avvio-aiuto");
    const api = bot();
    await deliver("/start", seller.chat, api.fetcher, later(1));
    expect(sentTexts(api)).toEqual([expect.stringMatching(/^👋 <b>FiscalBay<\/b>\nQui arrivano/u)]);
    const production = { ...env, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const unknown = bot();
    await consumeTelegramUpdate(
      production,
      receipt({ chatId: "804", command: "status" }),
      unknown.fetcher,
      new Date(now),
    );
    expect(sentTexts(unknown)).toEqual([
      expect.stringContaining("collega questa chat da FiscalBay"),
    ]);
  });

  it("una risposta rifiutata da Telegram non si ritenta; un errore temporaneo sì", async () => {
    const seller = await linked("risposta-rifiutata");
    const update = receipt({ chatId: String(seller.chat), command: "help" });
    const answering = (status: number) =>
      bot((call) => (call.method === "sendMessage" ? failure(status) : undefined)).fetcher;
    await expect(
      consumeTelegramUpdate(environment, update, answering(403), new Date(now)),
    ).resolves.toBeUndefined();
    await expect(
      consumeTelegramUpdate(environment, update, answering(502), new Date(now)),
    ).rejects.toMatchObject({
      failure: "unavailable",
    });
  });

  it("stato, preferenze e negozi senza negozi, con una sola pagina e con dieci negozi", async () => {
    const seller = await linked("pochi-negozi");
    const gen = await generation(seller.workspace);
    const api = bot();
    let minute = 0;
    const last = () => api.calls.at(-1)!;
    await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = ?")
      .bind(now, seller.store)
      .run();
    await deliver("/stato", seller.chat, api.fetcher, later(++minute));
    expect(last().params.text).toBe(
      "⭐ <b>Premium fino al 13 ott</b>\n🔔 Notifiche attive · solo con Codice Fiscale o P.IVA\n📨 Un messaggio per ordine\n\n📨 <i>Nessun invio finora</i>",
    );
    // Senza negozi e con un messaggio per ordine la riga di orario e negozi non c'è.
    await deliver("/preferenze", seller.chat, api.fetcher, later(++minute));
    expect(keyboard(last()).map((row) => row.map((button) => button.callback_data))).toEqual([
      [`${gen}:en:0`],
      [`${gen}:fi:fiscal`, `${gen}:fi:all`],
      [`${gen}:mo:each`, `${gen}:mo:digest`],
      [`${gen}:ul`, undefined],
    ]);

    // Sei negozi stanno in una pagina; il nome del negozio sospeso si accorcia come gli altri.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE ebay_stores SET data_deleted_at = NULL, store_name = ? WHERE id = ?",
      ).bind("S".repeat(45), seller.store),
      env.DB.prepare(
        "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES (?, 'plan', ?)",
      ).bind(seller.store, now),
      ...[1, 2, 3, 4, 5].map((index) =>
        insertStore({
          id: `s-pochi-${index}`,
          workspaceId: seller.workspace,
          linkedAt: later(index).toISOString(),
        }),
      ),
    ]);
    await tap(`${gen}:ss:0`, seller.chat, api.fetcher, later(++minute));
    expect(keyboard(last())).toEqual([
      [{ text: `⏸ ${"S".repeat(40)} · sospeso`, callback_data: `${gen}:ss:0` }],
      ...[1, 2, 3, 4, 5].map((index) => [
        { text: `☑ s-pochi-${index}`, callback_data: `${gen}:sx:0:0:s-pochi-${index}` },
      ]),
      [{ text: "‹ Indietro", callback_data: `${gen}:pr` }],
    ]);

    // Dieci negozi si elencano tutti, senza il conteggio di quelli in più.
    await env.DB.batch(
      [6, 7, 8, 9].map((index) =>
        insertStore({
          id: `s-pochi-${index}`,
          workspaceId: seller.workspace,
          linkedAt: later(index).toISOString(),
        }),
      ),
    );
    await deliver("/stato", seller.chat, api.fetcher, later(++minute));
    const listed = String(last().params.text).split("\n\n")[1]!.split("\n");
    expect(listed).toHaveLength(11);
    expect(listed.at(-1)).toBe("🔴 s-pochi-9 · <i>da ricollegare</i>");
  });

  it("in inglese gli ultimi ordini sono al massimo venti, a pagine nella lingua della chat", async () => {
    const seller = await linked("ultimi-inglese");
    await env.DB.batch([
      env.DB.prepare("UPDATE telegram_links SET language = 'en' WHERE workspace_id = ?").bind(
        seller.workspace,
      ),
      insertStore({ id: "s-ultimi-secondo", workspaceId: seller.workspace }),
      env.DB.prepare(
        "INSERT INTO sync_state (store_id, history_from, history_until, updated_at) VALUES (?, ?, ?, ?)",
      ).bind("s-ultimi-secondo", later(-30 * 24 * 60).toISOString(), now, now),
    ]);
    for (let index = 0; index < 11; index++) {
      await order(seller.store, `o-primo-${index}`, { created: index - 40, listed: 1 });
      await order("s-ultimi-secondo", `o-secondo-${index}`, { created: index - 20, listed: 1 });
    }
    const gen = await generation(seller.workspace);
    const api = bot();
    await deliver("/latest", seller.chat, api.fetcher, later(5));
    const first = api.texts()[0]!;
    expect(String(first.params.text)).toContain("🛒 <b>Latest orders</b> · <i>1–5 of 20</i>");
    expect(keyboard(first)).toEqual([
      [{ text: "5 more ›", callback_data: `${gen}:la:5` }],
      [{ text: "🔗 Open orders", url: `${origin}/en/app/orders` }],
    ]);
    await tap(`${gen}:la:15`, seller.chat, api.fetcher, later(6));
    const lastPage = api.calls.at(-1)!;
    expect(String(lastPage.params.text)).toContain("<i>16–20 of 20</i>");
    // Il più vecchio dei ventidue resta fuori.
    expect(String(lastPage.params.text)).toContain("ebay-o-primo-2<");
    expect(String(lastPage.params.text)).not.toContain("ebay-o-primo-1<");
    expect(keyboard(lastPage)[0]).toEqual([{ text: "‹ Previous", callback_data: `${gen}:la:10` }]);
  });
});
