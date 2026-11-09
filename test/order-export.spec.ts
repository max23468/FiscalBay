import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { standardColumns, type ExportColumn } from "../app/orders/export-columns";

import { visibleOrderTallies } from "../app/domain/orders.server";

import { loader as exportLoader } from "../app/routes/order-export";

import { loader as loadSettings } from "../app/routes/settings";

import {
  deleteExportConfiguration,
  listExportConfigurations,
  maxExportConfigurations,
  saveExportConfiguration,
} from "../app/domain/export-configurations.server";

import { exportRevision } from "../app/domain/export-files.server";

import { revokeHistoryExtension } from "../app/domain/concessions.server";

import { reversalStatements } from "../app/domain/refunds.server";

import { applyFreePlan, applyFreePlans } from "../app/domain/free-store.server";

import { deleteStoreData } from "../app/domain/stores.server";

import { confirmStoreTransfer, prepareStoreTransfer } from "../app/domain/store-transfer.server";

import { verifiedSession } from "./fixtures/account-fixtures";

import { insertTaxIdentifiers, now } from "./fixtures/database-fixtures";

import { callRoute, routePage } from "./fixtures/route-fixtures";

import { searchOrders } from "./fixtures/order-search-fixtures";

import { snapshotCursor } from "../app/orders/order-criteria";

import {
  it_,
  cookie,
  userId,
  request,
  csv,
  premium,
  xlsx,
  settingsIntent,
  configurations,
  created,
  download,
  gone,
  hours,
  setupScenarios,
} from "./fixtures/order-export-scenarios";

setupScenarios();

it("esporta la selezione con i soli valori autorizzati e il motivo dei dati vuoti", async () => {
  // o-b appartiene a un altro spazio e o-p non è pagato: nessuno dei due entra nel file.
  const response = await request("ordini=o-a,o-c,o-d,o-b,o-p");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="fiscalbay-ordini-2026-09-13.csv"',
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const { text, rows } = await csv(response);
  expect(rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a", "ebay-c", "ebay-d"]);
  expect(text).not.toContain("VRDGPP80A01H501X");
  expect(text).not.toContain("BNCLGU80A01H501Z");
  expect(rows[0]).toMatchObject({
    "Codice Fiscale": "RSSMRA80A01H501U",
    "Partita IVA": "01234567890",
    "Stato del Codice Fiscale": "Disponibile",
    Articoli: "1 × Articolo A | 2 × Articolo B",
    "Totale ordine": "12.99",
  });
  expect(rows[1]).toMatchObject({
    "Codice Fiscale": "",
    "Stato del Codice Fiscale": "Da sbloccare",
    Articoli: '1 × =HYPERLINK("http://x.invalid")',
  });
  // La formula del titolo resta neutralizzata nel file.
  expect(text).toContain(`"1 × =HYPERLINK(""http://x.invalid"")"`);
  expect(rows[2]).toMatchObject({ "Stato del Codice Fiscale": "Acquirente estero", Paese: "DE" });
});

it("neutralizza la formula di un titolo esportato per articolo", async () => {
  const { text, rows } = await csv(await request("ordini=o-c", { rows: "item" }));
  expect(rows).toHaveLength(1);
  expect(text).toContain(`"'=HYPERLINK(""http://x.invalid"")"`);
});

it("per articolo scrive una riga per articolo e il totale una volta sola", async () => {
  const { rows } = await csv(await request("ordini=o-a", { rows: "item" }));
  expect(rows.map((row) => [row.Articolo, row["Importo articolo"], row["Totale ordine"]])).toEqual([
    ["Articolo A", "9.99", "12.99"],
    ["Articolo B", "3.00", ""],
  ]);
  expect(rows.map((row) => row["Codice Fiscale"])).toEqual([
    "RSSMRA80A01H501U",
    "RSSMRA80A01H501U",
  ]);
});

it("con l'opzione dei soli dati disponibili esclude gli altri ordini", async () => {
  const { rows } = await csv(
    await request(`vista=${snapshotCursor(new Date(now))}`, { fiscal: "available" }),
  );
  expect(rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
  // Un filtro degli Ordini che esclude i dati disponibili non produce un file vuoto.
  const refused = await request("fiscale=locked", { fiscal: "available" });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ ok: false, notice: it_.settings.export.exportEmpty });
});

it("segue filtri, ricerca cifrata e «Non pagato» dell'elenco", async () => {
  const filtered = await csv(await request("fiscale=foreign"));
  expect(filtered.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-d"]);
  const unpaid = await csv(await request("pagamento=unpaid"));
  expect(unpaid.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-p"]);
  const { href } = await searchOrders(cookie, "articolo a");
  const searched = await csv(await request(href.split("?")[1]!));
  expect(searched.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
  // Un valore da sbloccare non trova l'ordine nemmeno nel file.
  const { href: guess } = await searchOrders(cookie, "VRDGPP80A01H501X");
  expect((await request(guess.split("?")[1]!)).status).toBe(409);
  // Dagli Ordini la ricerca della barra conserva i filtri, anche nel conteggio e nei suggerimenti.
  const all = await searchOrders(cookie, "articolo");
  expect(all.items.map((item) => item.ebayOrderId)).toEqual(["ebay-a"]);
  const kept = await searchOrders(cookie, "articolo", "fiscale=available&altro=x");
  expect(new URLSearchParams(kept.href.split("?")[1]).get("fiscale")).toBe("available");
  expect(kept.href).not.toContain("altro=");
  expect(kept).toMatchObject({ total: 1, items: [{ ebayOrderId: "ebay-a" }] });
  const fromKept = await csv(await request(kept.href.split("?")[1]!));
  expect(fromKept.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
  const excluded = await searchOrders(cookie, "articolo", "fiscale=locked");
  expect(excluded).toMatchObject({ total: 0, items: [] });
});

it("senza ambito degli Ordini esporta il periodo scelto e ignora quello Pro nel Free", async () => {
  await env.DB.prepare(
    `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor, retention_until)
       VALUES ('o-old', 's-a', 'ebay-old', ?1, ?1, 'EUR', 100, ?2)`,
  )
    .bind(new Date(Date.parse(now) - 10 * 86_400_000).toISOString(), "2026-12-01T00:00:00.000Z")
    .run();
  const week = await csv(await request("", { period: "7" }));
  expect(week.rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a", "ebay-c", "ebay-d"]);
  const premium = await csv(await request("", { period: "90" }));
  expect(premium.rows.map((row) => row["Numero ordine"])).toContain("ebay-old");
});

it("legge tutte le pagine una volta sola, anche con ordini nello stesso istante", async () => {
  await env.DB.batch(
    Array.from({ length: 4 }, (_, batch) =>
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
           SELECT 'p-' || printf('%03d', value), 's-a', 'page-' || printf('%03d', value), ?1, ?1, 'EUR', 100
             FROM json_each(?2)`,
      ).bind(
        new Date(Date.parse(now) - 3_600_000).toISOString(),
        JSON.stringify(Array.from({ length: 80 }, (_, index) => batch * 80 + index)),
      ),
    ),
  );
  const { rows } = await csv(await request(`vista=${snapshotCursor(new Date(now))}`));
  const pages = rows.map((row) => row["Numero ordine"]).filter((id) => id!.startsWith("page-"));
  expect(pages).toHaveLength(320);
  expect(new Set(pages).size).toBe(320);
});

it("esclude negozi con i dati eliminati, ordini scaduti e il file di un ambito vuoto", async () => {
  const deleted = (at: string | null) =>
    env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-a'").bind(at).run();
  await deleted(now);
  expect((await request("ordini=o-a")).status).toBe(409);
  await deleted(null);
  expect((await request("ordini=o-a")).status).toBe(200);
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = 'o-a'")
    .bind(new Date(Date.parse(now) - 60_000).toISOString())
    .run();
  expect((await request("ordini=o-a")).status).toBe(409);
});

it("con Pro crea l'XLSX con le colonne scelte; nel Free resta il CSV standard", async () => {
  for (const fields of [{ format: "xlsx" }, { columns: "order" }] as Record<string, string>[]) {
    const refused = await request("ordini=o-a", fields);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({
      ok: false,
      notice: it_.settings.export.exportPremium,
    });
  }
  await premium();
  const response = await request("ordini=o-a,o-c", {
    format: "xlsx",
    rows: "item",
    columns: "taxCode,order,itemTotal,total",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="fiscalbay-ordini-2026-09-13.xlsx"',
  );
  const { xml, rows } = await xlsx(response);
  expect(rows).toEqual([
    ["Codice Fiscale", "Numero ordine", "Importo articolo", "Totale ordine"],
    ["RSSMRA80A01H501U", "ebay-a", 9.99, 12.99],
    ["RSSMRA80A01H501U", "ebay-a", 3],
    // Con Premium anche il dato prima da sbloccare entra nel file.
    ["VRDGPP80A01H501X", "ebay-c", 5, 5],
  ]);
  expect(xml).toContain('<t xml:space="preserve">VRDGPP80A01H501X</t>');
  // Con Premium anche il CSV segue le colonne scelte; una scelta non valida non crea il file.
  const { rows: csvRows } = await csv(await request("ordini=o-a", { columns: "total,order" }));
  expect(csvRows).toEqual([{ "Totale ordine": "12.99", "Numero ordine": "ebay-a" }]);
  const invalid = await request("ordini=o-a", { columns: "order,order" });
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toEqual({
    ok: false,
    notice: it_.settings.export.exportColumnsInvalid,
  });
});

it("legge un dataset esteso a pagine senza moltiplicare totali o righe", async () => {
  await premium();
  const created = new Date(Date.parse(now) - 3_600_000).toISOString();
  const ids = JSON.stringify(Array.from({ length: 300 }, (_, index) => index));
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
         SELECT 'x-' || value, 's-a', 'big-' || printf('%03d', value), ?1, ?1, 'EUR', 1000 + value
           FROM json_each(?2)`,
    ).bind(created, ids),
    env.DB.prepare(
      `INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
         SELECT 'x-' || o.value || '-' || i.value, 'x-' || o.value, 'l-' || i.value,
                'Articolo ' || i.value, 1, 100, 'EUR'
           FROM json_each(?1) o, json_each('[0,1,2]') i`,
    ).bind(ids),
    env.DB.prepare(
      `INSERT INTO tax_identifiers
           (id, order_id, identifier_type, issuing_country, value, source, observed_at)
         SELECT 'tx-' || o.value || '-' || t.key, 'x-' || o.value, t.value ->> 0, t.value ->> 1,
                t.value ->> 2, 'ebay_trading_get_orders', ?2
           FROM json_each(?1) o,
                json_each('[["CODICE_FISCALE","IT","RSSMRA80A01H501U"],["VAT_ID","IT","00123456789"],["VAT","DE","DE123456789"]]') t`,
    ).bind(ids, now),
  ]);
  const { rows } = await xlsx(
    await request(`vista=${snapshotCursor(new Date(now))}`, {
      format: "xlsx",
      rows: "item",
      columns: "order,itemTotal,total,taxCode,vat,otherTax",
    }),
  );
  const big = rows.filter((row) => String(row[0]).startsWith("big-"));
  expect(big).toHaveLength(900);
  expect(new Set(big.map((row) => row[0])).size).toBe(300);
  const sum = (index: number) =>
    big.reduce((total, row) => total + Math.round(Number(row[index] ?? 0) * 100), 0);
  // Totali una volta per ordine e importi degli articoli una volta per riga.
  expect(sum(2)).toBe(
    Array.from({ length: 300 }, (_, index) => 1000 + index).reduce((a, b) => a + b),
  );
  expect(sum(1)).toBe(900 * 100);
  expect(big[0]!.slice(3)).toEqual(["RSSMRA80A01H501U", "00123456789", "VAT (DE): DE123456789"]);
});

it("salva, sostituisce ed elimina le configurazioni soltanto con Pro", async () => {
  const save = (fields: Record<string, string>) =>
    settingsIntent({
      intent: "export-save",
      name: "Commercialista",
      format: "xlsx",
      rows: "order",
      columns: "order,taxCode",
      ...fields,
    });
  expect(await save({})).toEqual({
    status: 403,
    body: { ok: false, notice: it_.settings.export.exportPremium },
  });
  await premium();
  expect(await save({ name: "  Commercialista " })).toEqual({
    status: 200,
    body: { ok: true, notice: it_.settings.export.exportConfigSaved },
  });
  expect(await configurations()).toEqual([
    {
      id: expect.any(String),
      name: "Commercialista",
      format: "xlsx",
      rows: "order",
      columns: ["order", "taxCode"],
    },
  ]);
  // Lo stesso nome sostituisce la configurazione; un altro nome ne aggiunge una.
  await save({ format: "csv", rows: "item", columns: "itemTotal,order" });
  await save({ name: "Altro" });
  expect(
    (await configurations()).map(({ name, format, rows, columns }) => [
      name,
      format,
      rows,
      columns,
    ]),
  ).toEqual([
    ["Altro", "xlsx", "order", ["order", "taxCode"]],
    ["Commercialista", "csv", "item", ["itemTotal", "order"]],
  ]);
  // Un nome di 60 caratteri è ammesso; un campo assente no.
  expect((await save({ name: "x".repeat(60) })).status).toBe(200);
  await env.DB.prepare("DELETE FROM export_configurations WHERE length(name) = 60").run();
  for (const missing of ["name", "format", "rows", "columns"])
    expect(
      (
        await settingsIntent(
          Object.fromEntries(
            Object.entries({
              intent: "export-save",
              name: "Senza campo",
              format: "csv",
              rows: "order",
              columns: "order",
            }).filter(([key]) => key !== missing),
          ),
        )
      ).status,
    ).toBe(400);
  for (const fields of [
    { name: " " },
    { name: "x".repeat(61) },
    { format: "pdf" },
    { rows: "riga" },
    { columns: "order,ignota" },
    { columns: "itemTotal" },
  ] as Record<string, string>[])
    expect((await save(fields)).status).toBe(400);
  // Oltre il limite non si aggiunge una configurazione, ma si sostituisce ancora una esistente.
  for (let index = 0; index < maxExportConfigurations - 2; index++)
    expect((await save({ name: `C${index}` })).status).toBe(200);
  expect(await save({ name: "Ultima" })).toEqual({
    status: 409,
    body: {
      ok: false,
      notice: it_.settings.export.exportConfigFull(maxExportConfigurations),
    },
  });
  expect((await save({ name: "Altro", format: "csv" })).status).toBe(200);
  expect(await configurations()).toHaveLength(maxExportConfigurations);
  // Un'altra persona non elimina le configurazioni; il titolare sì, anche senza Premium.
  const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
  const [first] = await configurations();
  expect(
    (await settingsIntent({ intent: "export-delete", id: first!.id }, other.cookie)).status,
  ).toBe(404);
  await env.DB.prepare("DELETE FROM workspace_entitlements").run();
  expect(await settingsIntent({ intent: "export-delete", id: first!.id })).toEqual({
    status: 200,
    body: { ok: true, notice: it_.settings.export.exportConfigDeleted },
  });
  expect(await configurations()).toHaveLength(maxExportConfigurations - 1);
  // Una colonna non più prevista lascia le colonne standard; l'account porta via tutto.
  await env.DB.prepare("UPDATE export_configurations SET columns = 'ignota' WHERE user_id = ?")
    .bind(userId)
    .run();
  expect((await configurations())[0]!.columns).toEqual(standardColumns("order"));
  await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run();
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_configurations").first("n")).toBe(
    0,
  );
});

it("rifiuta richieste senza sessione, da un'altra origine o in lettura", async () => {
  const anonymous = await request("ordini=o-a", {}, { cookie: null });
  expect(anonymous.status).toBe(401);
  // Un'origine estranea o assente, come un modulo inviato da altrove, è rifiutata.
  for (const origin of ["https://altro.invalid", null])
    expect((await request("ordini=o-a", {}, { origin })).status, String(origin)).toBe(403);
  expect((await callRoute(exportLoader, "/api/v1/orders/export")).status).toBe(405);
  // Senza JavaScript un rifiuto torna alla sezione con lo stesso ambito.
  const form = await request("fiscale=locked", { fiscal: "available" }, { json: false });
  expect(form.status).toBe(303);
  expect(form.headers.get("location")).toBe("/app/impostazioni/esportazione?fiscale=locked");
});

it("la sezione conta l'ambito e ogni periodo con le regole del file", async () => {
  const single = await routePage(loadSettings, "/app/impostazioni/esportazione?ordini=o-c", {
    cookie,
    params: { sezione: "esportazione" },
  });
  expect(single.page.exportContext).toMatchObject({
    kind: "orders",
    order: "ebay-c",
    filtered: false,
    returnHref: "/app/ordini",
    estimate: { orders: 1, locked: 1, available: 0 },
  });
  expect(single.page.exportPeriods).toBeNull();
  // Le prime righe sono quelle del file: il dato da sbloccare resta vuoto.
  expect(single.page.exportSample?.all.map((order) => order.rows.order[0])).toEqual([
    expect.objectContaining({ order: "ebay-c", taxCode: "" }),
  ]);
  expect(single.page.exportSample?.available).toEqual([]);
  const selection = await routePage(
    loadSettings,
    "/app/impostazioni/esportazione?ordini=o-a,o-c,o-b,o-p",
    { cookie, params: { sezione: "esportazione" } },
  );
  expect(selection.page.exportContext).toMatchObject({
    order: null,
    estimate: { orders: 2, locked: 1, available: 1 },
  });
  const sample = selection.page.exportSample!;
  expect(sample.all).toHaveLength(2);
  expect(sample.available.map((order) => order.rows.item[0]!.order)).toEqual(["ebay-a"]);
  expect(sample.available[0]!.rows.order[0]!.taxCode).not.toBe("");
  // Per ordine una riga con gli articoli insieme, per articolo una riga ciascuno.
  expect(sample.available[0]!.rows.order.map((row) => row.items)).toEqual([
    "1 × Articolo A | 2 × Articolo B",
  ]);
  expect(sample.available[0]!.rows.item.map((row) => row.items)).toEqual([
    "Articolo A",
    "Articolo B",
  ]);
  // Con i soli dati da sbloccare nessuna riga è disponibile.
  const locked = await routePage(loadSettings, "/app/impostazioni/esportazione?fiscale=locked", {
    cookie,
    params: { sezione: "esportazione" },
  });
  expect(locked.page.exportSample?.all.length).toBeGreaterThan(0);
  expect(locked.page.exportSample?.available).toEqual([]);
  expect(locked.page.exportContext).toMatchObject({ filtered: true, search: null, store: null });
  // L'ambito filtrato nomina la ricerca già decifrata, che resta fuori dall'indirizzo.
  const { href } = await searchOrders(cookie, "articolo a");
  const searched = await routePage(
    loadSettings,
    `/app/impostazioni/esportazione?${href.split("?")[1]}`,
    { cookie, params: { sezione: "esportazione" } },
  );
  expect(searched.page.exportContext).toMatchObject({ filtered: true, search: "articolo a" });
  expect(searched.page.exportContext?.query).not.toContain("articolo");
  const periods = await routePage(loadSettings, "/app/impostazioni/esportazione", {
    cookie,
    params: { sezione: "esportazione" },
  });
  expect(periods.page.exportContext).toBeNull();
  expect(periods.page.exportPeriods?.["7"]).toEqual({ orders: 3, locked: 1, available: 1 });
  expect(periods.page.sections).toContain("esportazione");
  expect(periods.page.exportSample?.all).toHaveLength(3);
  const elsewhere = await routePage(loadSettings, "/app/impostazioni/piano", {
    cookie,
    params: { sezione: "piano" },
  });
  expect(elsewhere.page.exportSample).toBeNull();
});

it("conta per inizio di periodo con una sola lettura", async () => {
  const userId = (await env.DB.prepare(
    "SELECT user_id FROM workspace_members WHERE workspace_id = 'w-a'",
  ).first<{ user_id: string }>())!.user_id;
  const at = (minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
  const tallies = await visibleOrderTallies(
    env.DB,
    userId,
    "production",
    new Date(now),
    { criteria: {} },
    [at(15), at(0), at(60)],
  );
  expect(tallies).toEqual([
    { orders: 2, locked: 1, available: 1 },
    { orders: 1, locked: 0, available: 1 },
    { orders: 3, locked: 1, available: 1 },
  ]);
});

it("dal dettaglio esporta l'ordine come lo mostra il dettaglio, fuori dai filtri dell'elenco", async () => {
  // L'elenco «Da sbloccare» è stato aperto prima che o-c entrasse; o-c è appena sbloccato.
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET listed_at = ? WHERE id = 'o-c'").bind(hours(1)),
    env.DB.prepare(
      `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
         VALUES ('g-c', 'w-a', 'o-c', NULL, 'admin', ?)`,
    ).bind(now),
  ]);
  vi.setSystemTime(Date.parse(hours(2)));
  const list = `fiscale=locked&vista=${snapshotCursor(new Date(now))}`;
  const rows = async (query: string) =>
    (await csv(await request(query))).rows.map((row) => [
      row["Numero ordine"],
      row["Codice Fiscale"],
    ]);
  expect(await rows(`${list}&ordine=o-c`)).toEqual([["ebay-c", "VRDGPP80A01H501X"]]);
  // La selezione conta invece soltanto gli ordini ancora presenti nell'elenco.
  expect((await request(`${list}&ordini=o-c`)).status).toBe(409);
  // Come il dettaglio: l'acquisto non pagato soltanto con «Non pagato», mai un altro spazio.
  expect((await request("ordine=o-p")).status).toBe(409);
  expect(await rows("pagamento=unpaid&ordine=o-p")).toEqual([["ebay-p", ""]]);
  expect((await request("ordine=o-b")).status).toBe(409);
  // La sezione conta lo stesso ordine e torna all'elenco di partenza.
  const { page } = await routePage(
    loadSettings,
    `/app/impostazioni/esportazione?${list}&ordine=o-c`,
    { cookie, params: { sezione: "esportazione" } },
  );
  expect(page.exportContext).toMatchObject({
    kind: "orders",
    order: "ebay-c",
    returnHref: `/app/ordini?${list}`,
    estimate: { orders: 1, locked: 0, available: 1 },
  });
});

it("il file riporta la stessa avvertenza della pagina dopo una lettura non riuscita", async () => {
  await env.DB.prepare(
    `INSERT INTO order_tax_checks (order_id, source, observed_at, availability, verification)
       VALUES ('o-a', 'ebay_fulfillment', ?, 'present', 'error')`,
  )
    .bind(hours(-1))
    .run();
  const [row] = (await csv(await request("ordini=o-a"))).rows;
  expect(row).toMatchObject({
    "Codice Fiscale": "RSSMRA80A01H501U",
    "Stato del Codice Fiscale": "Disponibile, ultima lettura da eBay non riuscita",
  });
});

it("CF e Partita IVA letti da Trading e da Fulfillment compaiono una volta nel file", async () => {
  await insertTaxIdentifiers(
    {
      id: "t-a3",
      orderId: "o-a",
      type: "CODICE_FISCALE",
      country: "IT",
      value: "RSSMRA80A01H501U",
      source: "ebay_fulfillment",
    },
    {
      id: "t-a4",
      orderId: "o-a",
      type: "VATIN",
      country: "IT",
      value: "01234567890",
      source: "ebay_fulfillment",
    },
  ).run();
  const [row] = (await csv(await request("ordini=o-a"))).rows;
  expect(row).toMatchObject({
    "Codice Fiscale": "RSSMRA80A01H501U",
    "Partita IVA": "01234567890",
  });
});

it("le revoche dei percorsi reali invalidano i file, le ripetizioni non aumentano la revisione", async () => {
  const revision = () => exportRevision(env.DB, userId);
  const valid = async () => (await download(await created())).status === 200;
  // Concessione revocata: l'estensione dello storico.
  await env.DB.prepare(
    `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
       VALUES ('x-a', 'w-a', 18, 'Storico verificato', 'owner', ?)`,
  )
    .bind(now)
    .run();
  let id = await created();
  expect(await revokeHistoryExtension(env.DB, { workspaceId: "w-a", extensionId: "x-a" })).toBe(
    "done",
  );
  expect(await revision()).toBe(1);
  await gone(await download(id));
  expect(await revokeHistoryExtension(env.DB, { workspaceId: "w-a", extensionId: "x-a" })).toBe(
    "not_found",
  );
  expect(await revision()).toBe(1);
  // Rimborso di una copertura pagata.
  await env.DB.prepare(
    `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at,
         stripe_invoice_id, amount_paid, currency, paid_at)
       VALUES ('e-paid', 'w-a', 'premium', ?1, ?2, 'in_rimborso', 999, 'EUR', ?1)`,
  )
    .bind(now, hours(24 * 30))
    .run();
  id = await created();
  const refund = () =>
    env.DB.batch(
      reversalStatements(
        env.DB,
        "stripe_invoice_id",
        "in_rimborso",
        { refunded: 999, revocation: "refund" },
        now,
      ),
    );
  await refund();
  expect(await revision()).toBe(2);
  await gone(await download(id));
  await refund();
  expect(await revision()).toBe(2);
  // Nel Free un secondo negozio entra in pausa una volta sola, anche con il cron ripetuto.
  id = await created();
  await env.DB.prepare(
    `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
       VALUES ('s-a2', 'w-a', 'e-a2', ?)`,
  )
    .bind(hours(1))
    .run();
  await applyFreePlan(env.DB, userId);
  const paused = await revision();
  expect(paused).toBe(3);
  await gone(await download(id));
  id = await created();
  await applyFreePlan(env.DB, userId);
  await applyFreePlans(env.DB);
  expect(await revision()).toBe(paused);
  expect(await valid()).toBe(true);
  // Dati del negozio eliminati dall'utente.
  await env.DB.prepare("UPDATE ebay_stores SET store_name = 'Negozio A' WHERE id = 's-a'").run();
  const deleted = await revision();
  expect(await deleteStoreData(env.DB, userId, "s-a", "Negozio A")).toBe("done");
  expect(await revision()).toBeGreaterThan(deleted);
  await gone(await download(id));
});

it("il trasferimento di un negozio invalida i file dello spazio di partenza", async () => {
  const id = await created();
  const prepared = await prepareStoreTransfer(env.DB, {
    storeId: "s-a",
    toWorkspaceId: "w-b",
    actor: "owner",
    reason: "Richiesta del titolare",
  });
  expect(prepared.result).toBe("prepared");
  expect((await download(id)).status).toBe(200);
  const confirmed = await confirmStoreTransfer(env, {
    id: prepared.result === "prepared" ? prepared.id : "",
    actor: "owner",
  });
  expect(confirmed.result).toBe("done");
  expect(await exportRevision(env.DB, userId)).toBeGreaterThan(0);
  await gone(await download(id));
  // Lo spazio di arrivo non riceve una revoca dei propri file.
  expect(
    await env.DB.prepare("SELECT access_revision FROM workspaces WHERE id = 'w-b'").first(
      "access_revision",
    ),
  ).toBe(0);
});

it("le configurazioni restano di ciascun utente, anche con lo stesso nome e salvataggi concorrenti", async () => {
  const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
  const layout = (columns: ExportColumn[]) => ({
    format: "csv" as const,
    rows: "order" as const,
    columns,
  });
  expect(
    await saveExportConfiguration(env.DB, userId, "Commercialista", layout(["order"]), new Date()),
  ).toBe(true);
  expect(
    await saveExportConfiguration(
      env.DB,
      other.userId,
      "Commercialista",
      layout(["taxCode"]),
      new Date(),
    ),
  ).toBe(true);
  expect((await listExportConfigurations(env.DB, userId)).map((c) => c.columns)).toEqual([
    ["order"],
  ]);
  expect((await listExportConfigurations(env.DB, other.userId)).map((c) => c.columns)).toEqual([
    ["taxCode"],
  ]);
  // L'eliminazione con l'identificativo di un altro utente non tocca la sua configurazione.
  const [mine] = await listExportConfigurations(env.DB, userId);
  expect(await deleteExportConfiguration(env.DB, other.userId, mine!.id)).toBe(false);
  expect(await listExportConfigurations(env.DB, userId)).toHaveLength(1);
  // Al limite meno uno, tre salvataggi concorrenti di nomi nuovi ne aggiungono uno soltanto.
  for (let index = 1; index < maxExportConfigurations - 1; index++)
    await saveExportConfiguration(env.DB, userId, `C${index}`, layout(["order"]), new Date());
  const saved = await Promise.all(
    ["X", "Y", "Z"].map((name) =>
      saveExportConfiguration(env.DB, userId, name, layout(["order"]), new Date()),
    ),
  );
  expect(saved.filter(Boolean)).toHaveLength(1);
  expect(await listExportConfigurations(env.DB, userId)).toHaveLength(maxExportConfigurations);
  // Il limite è per utente: l'altro salva ancora.
  expect(
    await saveExportConfiguration(env.DB, other.userId, "Altro", layout(["order"]), new Date()),
  ).toBe(true);
});
