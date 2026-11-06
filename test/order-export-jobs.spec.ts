import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { appCopy } from "../app/app-copy";

import { standardColumns } from "../app/orders/export-columns";

import { XlsxRowLimitError } from "../app/domain/xlsx.server";

import { purgeExportFiles } from "../app/domain/export-files.server";

import {
  consumeExportJob,
  exportJobOrders,
  maxQueuedExports,
  publishOrderFile,
  queueOrderFile,
  resumeExportJobs,
} from "../app/domain/export-jobs.server";

import { consumeTask, taskSlot } from "../app/domain/scheduled-work.server";

import { verifiedSession } from "./fixtures/account-fixtures";

import { queued, queueMessage } from "./fixtures/queue-fixture";

import { insertEntitlement, now } from "./fixtures/database-fixtures";

import {
  it_,
  userId,
  request,
  csv,
  download,
  expiry,
  hours,
  queuedJob,
  job,
  sectionFiles,
  bell,
  setupScenarios,
} from "./fixtures/order-export-scenarios";

setupScenarios();

it("oltre la soglia prepara il file dalla coda e la campanella lo annuncia", async () => {
  await env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
       INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor, payment_status)
       SELECT 'bulk-' || i, 's-a', 'bulk-' || i,
              strftime('%Y-%m-%dT%H:%M:%fZ', ?2, '-' || i || ' seconds'), ?2, 'EUR', 100, 'PAID'
         FROM n`,
  )
    .bind(exportJobOrders, now)
    .run();
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
  let message: unknown;
  try {
    const response = await request("", { period: "30" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      ok: true,
      notice: it_.settings.export.exportQueued,
    });
    expect(send).toHaveBeenCalledOnce();
    message = send.mock.calls[0]![0];
  } finally {
    send.mockRestore();
  }
  const { exportJob: id } = message as { exportJob: string };
  // La richiesta resta cifrata finché il lavoro non si conclude: niente ambito in chiaro.
  const pending = await job(id);
  expect(pending).toMatchObject({ state: "queued", file_id: null, finished_at: null });
  expect(pending!.request_sealed).not.toMatch(/since|production|Europe/u);
  expect(await sectionFiles()).toEqual([
    {
      id,
      name: "fiscalbay-ordini-2026-09-13.csv",
      state: "queued",
      at: now,
      expiresAt: null,
    },
  ]);
  expect(await bell()).toEqual([]);
  const delivery = queueMessage(message);
  await consumeExportJob(delivery, env);
  expect(delivery.ack).toHaveBeenCalledOnce();
  const ready = await job(id);
  expect(ready).toMatchObject({ state: "ready", request_sealed: null, locked_until: null });
  const response = await download(ready!.file_id!);
  expect(response.status).toBe(200);
  // Gli ordini del periodo, compresi quelli già presenti; un acquisto non pagato no.
  expect((await csv(response)).rows).toHaveLength(exportJobOrders + 3);
  expect(await sectionFiles()).toEqual([
    expect.objectContaining({ id: ready!.file_id, state: "ready", expiresAt: hours(24) }),
  ]);
  expect(await bell()).toEqual([
    {
      id: `export:${id}`,
      kind: "export-ready",
      tone: "success",
      title: it_.shell.storeNotifications.exportReadyTitle,
      body: it_.shell.storeNotifications.exportReadyBody("fiscalbay-ordini-2026-09-13.csv"),
      at: now,
      read: false,
      href: "impostazioni/esportazione",
    },
  ]);
  // Una consegna ripetuta non crea un altro file.
  const repeated = queueMessage(message);
  await consumeExportJob(repeated, env);
  expect(repeated.ack).toHaveBeenCalledOnce();
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(1);
  // Revocato il file, la campanella non lo annuncia più; dopo 24 ore la pulizia toglie tutto.
  await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-c'")
    .bind(now)
    .run();
  expect(await bell()).toEqual([]);
  expect(await sectionFiles()).toEqual([]);
  vi.setSystemTime(Date.parse(hours(24)));
  await purgeExportFiles(env, new Date());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(0);
});

it("un lavoro accodato prima di una revoca non pubblica il file", async () => {
  const id = await queuedJob();
  await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-c'")
    .bind(now)
    .run();
  const delivery = queueMessage({ exportJob: id });
  const put = vi.spyOn(env.EXPORT_FILES, "put");
  try {
    await consumeExportJob(delivery, env);
    // La revoca si legge prima di generare: nessun byte arriva al bucket.
    expect(put).not.toHaveBeenCalled();
  } finally {
    put.mockRestore();
  }
  expect(delivery.ack).toHaveBeenCalledOnce();
  expect(await job(id)).toMatchObject({ state: "failed", file_id: null, request_sealed: null });
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
  expect(await sectionFiles()).toEqual([expect.objectContaining({ id, state: "failed" })]);
  expect(await bell()).toEqual([
    expect.objectContaining({
      id: `export:${id}`,
      kind: "export-failed",
      tone: "warning",
      title: it_.shell.storeNotifications.exportFailedTitle,
      href: "impostazioni/esportazione",
    }),
  ]);
});

it("un lavoro rilegge Premium all'avvio e non parte dopo 24 ore dalla richiesta", async () => {
  await insertEntitlement({
    source: "admin",
    endsAt: hours(1),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  const ready = await queuedJob({ format: "xlsx" });
  await consumeExportJob(queueMessage({ exportJob: ready }), env);
  const { file_id: file } = (await job(ready))!;
  expect(await expiry(file!)).toBe(hours(1));
  const late = await queuedJob();
  const xlsx = await queuedJob({ format: "xlsx" });
  vi.setSystemTime(Date.parse(hours(1)));
  await consumeExportJob(queueMessage({ exportJob: xlsx }), env);
  expect(await job(xlsx)).toMatchObject({ state: "failed" });
  const columns = await queuedJob({ columns: ["order", "taxCode"] });
  await consumeExportJob(queueMessage({ exportJob: columns }), env);
  expect(await job(columns)).toMatchObject({ state: "failed" });
  // Colonne uguali allo schema standard non chiedono Premium, anche finito prima del lavoro.
  const standard = await queuedJob({ columns: standardColumns("order") });
  await consumeExportJob(queueMessage({ exportJob: standard }), env);
  expect(await job(standard)).toMatchObject({ state: "ready" });
  vi.setSystemTime(Date.parse(hours(24)));
  await consumeExportJob(queueMessage({ exportJob: late }), env);
  expect(await job(late)).toMatchObject({ state: "failed" });
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(2);
});

it("un lavoro senza ordini o senza spazio si chiude senza file, uno non accodato non resta", async () => {
  const empty = await queuedJob({ filter: { ids: ["o-assente"], criteria: {} } });
  const orphan = await queuedJob();
  await env.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?").bind(userId).run();
  for (const id of [empty, orphan]) {
    const delivery = queueMessage({ exportJob: id });
    await consumeExportJob(delivery, env);
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(delivery.retry).not.toHaveBeenCalled();
    expect(await job(id)).toMatchObject({ state: "failed", file_id: null });
  }
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
  // Se la coda non accetta il messaggio il lavoro non resta registrato.
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockRejectedValue(new Error("coda"));
  try {
    await expect(
      queueOrderFile(env, {
        userId,
        revision: 0,
        request: {
          environment: "production",
          filter: { criteria: {} },
          rows: "order",
          format: "csv",
          columns: null,
          language: "it",
          timeZone: "Europe/Rome",
        },
        fileName: "fiscalbay-ordini-2026-09-13.csv",
        now: new Date(),
      }),
    ).rejects.toThrow("coda");
  } finally {
    send.mockRestore();
  }
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(2);
  // La pulizia conserva i lavori delle ultime 24 ore.
  vi.setSystemTime(Date.parse(hours(24)) - 1);
  await purgeExportFiles(env, new Date());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(2);
  vi.setSystemTime(Date.parse(hours(24)));
  await purgeExportFiles(env, new Date());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(0);
});

it("la copertura limita il file soltanto se finisce prima dei dati", async () => {
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = 'o-a'")
    .bind(hours(3))
    .run();
  const file = (ids: string[], coverageEndsAt: string | null) =>
    publishOrderFile(env, {
      userId,
      revision: 0,
      request: {
        environment: "production",
        filter: { ids, criteria: {} },
        rows: "order",
        format: "csv",
        columns: null,
        language: "it",
        timeZone: "Europe/Rome",
      },
      fileName: "fiscalbay-ordini-2026-09-13.csv",
      now: new Date(),
      coverageEndsAt,
    });
  expect(await expiry((await file(["o-a"], hours(5)))!)).toBe(hours(3));
  expect(await expiry((await file(["o-a"], hours(2)))!)).toBe(hours(2));
  expect(await expiry((await file(["o-a"], null))!)).toBe(hours(3));
  // Senza ordini resta il termine della copertura.
  expect(await expiry((await file(["o-assente"], hours(5)))!)).toBe(hours(5));
});

it("un lavoro in corso altrove si riprova, un errore riprova fino al terzo tentativo", async () => {
  const id = await queuedJob();
  await env.DB.prepare("UPDATE export_jobs SET locked_until = ? WHERE id = ?")
    .bind(hours(0.25), id)
    .run();
  // La consegna aspetta lo scadere del blocco con un solo tentativo, invece di uno al minuto.
  const busy = queueMessage({ exportJob: id });
  await consumeExportJob(busy, env);
  expect(busy.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 900 });
  expect(busy.ack).not.toHaveBeenCalled();
  const soon = queueMessage({ exportJob: id }, 2);
  await consumeExportJob(soon, env, new Date(Date.parse(hours(0.25)) - 1_500));
  expect(soon.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 2 });
  // Allo scadere del blocco il lavoro riparte; un errore di R2 lo libera per il tentativo dopo.
  vi.setSystemTime(Date.parse(hours(0.25)));
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  // Durante l'esecuzione il lavoro resta bloccato per 15 minuti.
  const locks: Array<string | null> = [];
  const failing = vi.spyOn(env.EXPORT_FILES, "put").mockImplementation(async () => {
    locks.push((await job(id))!.locked_until);
    throw new Error("R2");
  });
  try {
    const first = queueMessage({ exportJob: id });
    await consumeExportJob(first, env);
    expect(locks).toEqual([hours(0.5)]);
    expect(first.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 30 });
    expect(await job(id)).toMatchObject({ state: "queued", locked_until: null });
    expect(errors.mock.calls.map(([entry]) => JSON.parse(entry).operation)).toEqual([
      "export_files",
    ]);
    const second = queueMessage({ exportJob: id }, 2);
    await consumeExportJob(second, env);
    expect(second.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 60 });
    const last = queueMessage({ exportJob: id }, 3);
    await consumeExportJob(last, env);
    expect(last.ack).toHaveBeenCalledOnce();
    expect(await job(id)).toMatchObject({ state: "failed", request_sealed: null });
  } finally {
    failing.mockRestore();
    errors.mockRestore();
  }
  // Un lavoro eliminato, per esempio con l'account, chiude la consegna.
  const missing = queueMessage({ exportJob: crypto.randomUUID() });
  await consumeExportJob(missing, env);
  expect(missing.ack).toHaveBeenCalledOnce();
});

it("un consumer che ha perso il blocco non libera quello preso da un altro", async () => {
  const id = await queuedJob();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const newer = hours(1);
  // Il blocco scade durante la generazione e un altro consumer prende il lavoro.
  const failing = vi.spyOn(env.EXPORT_FILES, "put").mockImplementation(async () => {
    await env.DB.prepare("UPDATE export_jobs SET locked_until = ? WHERE id = ?")
      .bind(newer, id)
      .run();
    throw new Error("R2");
  });
  try {
    const message = queueMessage({ exportJob: id });
    await consumeExportJob(message, env);
    expect(message.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 30 });
    expect(await job(id)).toMatchObject({ state: "queued", locked_until: newer });
  } finally {
    failing.mockRestore();
    errors.mockRestore();
  }
});

it("se il blocco non si libera dopo un errore, lo segnala e riprova allo scadere", async () => {
  const id = await queuedJob();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const failing = vi.spyOn(env.EXPORT_FILES, "put").mockRejectedValue(new Error("R2"));
  const prepare = env.DB.prepare.bind(env.DB);
  const release = vi.spyOn(env.DB, "prepare").mockImplementation((sql: string) =>
    sql.includes("SET locked_until = NULL WHERE id = ?1 AND state = 'queued'")
      ? ({
          bind: () => ({ run: () => Promise.reject(new Error("D1")) }),
        } as unknown as D1PreparedStatement)
      : prepare(sql),
  );
  try {
    const message = queueMessage({ exportJob: id });
    await consumeExportJob(message, env);
    expect(message.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 30 });
    // Il blocco resta fino alla scadenza: il tentativo seguente parte comunque dopo.
    expect(await job(id)).toMatchObject({ state: "queued", locked_until: hours(0.25) });
    // Una segnalazione per l'errore del lavoro e una per il blocco rimasto.
    expect(errors.mock.calls.map(([entry]) => JSON.parse(entry).operation)).toEqual([
      "export_files",
      "export_files",
    ]);
  } finally {
    release.mockRestore();
    failing.mockRestore();
    errors.mockRestore();
  }
});

it("la ripresa oraria riaccoda un lavoro interrotto e due consumer creano un solo file", async () => {
  const id = await queuedJob();
  // Un consumer prende il lavoro e si interrompe senza concluderlo.
  await env.DB.prepare("UPDATE export_jobs SET locked_until = ? WHERE id = ?")
    .bind(hours(0.25), id)
    .run();
  const sendBatch = vi.spyOn(env.WORK_QUEUE, "sendBatch").mockResolvedValue(queued);
  try {
    // Finché il blocco vale il lavoro resta a quel consumer.
    vi.setSystemTime(Date.parse(hours(0.25)) - 1);
    expect(await resumeExportJobs(env, new Date())).toBe(0);
    expect(sendBatch).not.toHaveBeenCalled();
    vi.setSystemTime(Date.parse(hours(1)));
    expect(await resumeExportJobs(env, new Date())).toBe(1);
    expect(sendBatch).toHaveBeenCalledExactlyOnceWith([{ body: { exportJob: id } }]);
  } finally {
    sendBatch.mockRestore();
  }
  // Il messaggio riaccodato e quello originale arrivano insieme: uno crea il file, l'altro
  // aspetta lo scadere del blocco del primo.
  const deliveries = [queueMessage({ exportJob: id }), queueMessage({ exportJob: id }, 5)];
  await Promise.all(deliveries.map((delivery) => consumeExportJob(delivery, env)));
  expect(deliveries.map((delivery) => delivery.ack.mock.calls.length).sort()).toEqual([0, 1]);
  expect(deliveries.flatMap((delivery) => delivery.retry.mock.calls)).toEqual([
    [{ delaySeconds: 900 }],
  ]);
  expect(await job(id)).toMatchObject({ state: "ready", locked_until: null });
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(1);
  // La consegna rimandata trova il lavoro concluso e si chiude; la ripresa non ha altro da fare.
  const later = queueMessage({ exportJob: id }, 6);
  await consumeExportJob(later, env);
  expect(later.ack).toHaveBeenCalledOnce();
  expect(await resumeExportJobs(env, new Date())).toBe(0);
});

it("il compito orario riaccoda un lavoro senza messaggio e chiude quello che non può più concludersi", async () => {
  const lost = await queuedJob();
  const running = await queuedJob();
  const run = async (at: string) => {
    const slot = taskSlot("export_files", new Date(at));
    await env.DB.prepare(
      `INSERT INTO scheduled_tasks (task, slot, queued_at) VALUES ('export_files', ?1, ?2)
         ON CONFLICT(task) DO UPDATE SET slot = excluded.slot, queued_at = excluded.queued_at,
           done_at = NULL, lease = NULL, locked_until = NULL`,
    )
      .bind(slot, at)
      .run();
    const delivery = queueMessage({ task: "export_files", slot });
    await consumeTask(delivery, env, fetch, new Date(at));
    expect(delivery.ack).toHaveBeenCalledOnce();
  };
  const sendBatch = vi.spyOn(env.WORK_QUEUE, "sendBatch").mockResolvedValue(queued);
  try {
    // Un lavoro appena richiesto aspetta ancora il suo messaggio.
    await run(hours(0.2));
    expect(sendBatch).not.toHaveBeenCalled();
    await run(hours(0.25));
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(
      [...sendBatch.mock.calls[0]![0]]
        .map(({ body }) => (body as { exportJob: string }).exportJob)
        .sort(),
    ).toEqual([lost, running].sort());
    // Dopo 24 ore il lavoro libero non riesce; quello di un consumer in corso resta a lui.
    sendBatch.mockClear();
    await env.DB.prepare("UPDATE export_jobs SET locked_until = ? WHERE id = ?")
      .bind(hours(24.1), running)
      .run();
    await run(hours(24));
    expect(sendBatch).not.toHaveBeenCalled();
  } finally {
    sendBatch.mockRestore();
  }
  expect(await job(lost)).toEqual({
    state: "failed",
    file_id: null,
    request_sealed: null,
    locked_until: null,
    finished_at: hours(24),
  });
  expect(await job(running)).toMatchObject({ state: "queued", locked_until: hours(24.1) });
  vi.setSystemTime(Date.parse(hours(24)));
  expect(await bell()).toEqual([
    expect.objectContaining({ id: `export:${lost}`, tone: "warning", at: hours(24) }),
  ]);
  // Richiesti nello stesso istante: l'ordine fra i due segue l'identificativo.
  expect((await sectionFiles()).map(({ id, state }) => `${id} ${state}`).sort()).toEqual(
    [`${running} queued`, `${lost} failed`].sort(),
  );
});

it("un errore dopo la pubblicazione non lascia un secondo file al tentativo successivo", async () => {
  const id = await queuedJob();
  const keys = async () => (await env.EXPORT_FILES.list()).objects.map(({ key }) => key);
  const before = await keys();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const prepare = env.DB.prepare.bind(env.DB);
  let failed = false;
  // La conclusione del lavoro non riesce una volta, con il file già scritto nel bucket.
  const concluding = vi.spyOn(env.DB, "prepare").mockImplementation((sql: string) => {
    if (!failed && /^\s*UPDATE export_jobs SET state = /u.test(sql) && sql.includes("file_id")) {
      failed = true;
      return {
        bind: () => prepare("SELECT * FROM conclusione_non_riuscita"),
      } as unknown as D1PreparedStatement;
    }
    return prepare(sql);
  });
  try {
    const first = queueMessage({ exportJob: id });
    await consumeExportJob(first, env);
    expect(failed).toBe(true);
    expect(first.retry).toHaveBeenCalledOnce();
    expect(await job(id)).toMatchObject({ state: "queued", file_id: null, locked_until: null });
    expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
    const second = queueMessage({ exportJob: id }, 2);
    await consumeExportJob(second, env);
    expect(second.ack).toHaveBeenCalledOnce();
  } finally {
    concluding.mockRestore();
    errors.mockRestore();
  }
  const { file_id: file } = (await job(id))!;
  expect(
    (await env.DB.prepare("SELECT id FROM export_files").all<{ id: string }>()).results,
  ).toEqual([{ id: file }]);
  expect((await keys()).filter((key) => !before.includes(key))).toEqual([file]);
});

it("la campanella annuncia il file finché resta scaricabile e il lavoro non riuscito per 24 ore", async () => {
  const ready = await queuedJob();
  const failed = await queuedJob({ filter: { ids: ["o-assente"], criteria: {} } });
  // Il consumer parte due ore dopo la richiesta: il file vale fino a 26 ore da essa.
  vi.setSystemTime(Date.parse(hours(2)));
  await consumeExportJob(queueMessage({ exportJob: ready }), env);
  await consumeExportJob(queueMessage({ exportJob: failed }), env);
  const { file_id: file } = (await job(ready))!;
  expect(await expiry(file!)).toBe(hours(26));
  const announced = async () =>
    (await bell())
      .map(({ id, tone, at }) => [id, tone, at])
      .sort((a, b) => a[0]!.localeCompare(b[0]!));
  vi.setSystemTime(Date.parse(hours(26)) - 1);
  expect(await announced()).toEqual(
    [
      [`export:${failed}`, "warning", hours(2)],
      [`export:${ready}`, "success", hours(2)],
    ].sort((a, b) => a[0]!.localeCompare(b[0]!)),
  );
  expect((await sectionFiles()).map(({ state }) => state).sort()).toEqual(["failed", "ready"]);
  await purgeExportFiles(env, new Date());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(2);
  vi.setSystemTime(Date.parse(hours(26)));
  expect(await bell()).toEqual([]);
  expect(await sectionFiles()).toEqual([]);
  await purgeExportFiles(env, new Date());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_jobs").first("n")).toBe(0);
});

it("ammette due lavori in preparazione per utente, anche con richieste concorrenti", async () => {
  const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
  const queue = (user: string) =>
    queueOrderFile(env, {
      userId: user,
      revision: 0,
      request: {
        environment: "production",
        filter: { ids: ["o-a"], criteria: {} },
        rows: "order",
        format: "csv",
        columns: null,
        language: "it",
        timeZone: "Europe/Rome",
      },
      fileName: "fiscalbay-ordini-2026-09-13.csv",
      now: new Date(),
    });
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
  try {
    const ids = await Promise.all([queue(userId), queue(userId), queue(userId)]);
    expect(ids.filter((id) => id === null)).toHaveLength(3 - maxQueuedExports);
    expect(send).toHaveBeenCalledTimes(maxQueuedExports);
    // Il limite vale per utente; concluso un lavoro se ne chiede un altro.
    expect(await queue(other.userId)).not.toBeNull();
    expect(await queue(userId)).toBeNull();
    await consumeExportJob(queueMessage({ exportJob: ids.find((id) => id !== null)! }), env);
    expect(await queue(userId)).not.toBeNull();
  } finally {
    send.mockRestore();
  }
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM export_jobs WHERE user_id = ? AND state = 'queued'",
    )
      .bind(userId)
      .first("n"),
  ).toBe(maxQueuedExports);
});

it("dalla sezione, un CSV standard resta senza Premium e oltre due file in preparazione c'è l'avviso", async () => {
  await env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
       INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor, payment_status)
       SELECT 'bulk-' || i, 's-a', 'bulk-' || i,
              strftime('%Y-%m-%dT%H:%M:%fZ', ?2, '-' || i || ' seconds'), ?2, 'EUR', 100, 'PAID'
         FROM n`,
  )
    .bind(exportJobOrders, now)
    .run();
  await insertEntitlement({
    source: "admin",
    endsAt: hours(1),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  // Con Premium la sezione invia sempre le colonne, qui uguali a quelle standard.
  const fields = { period: "30", format: "csv", columns: standardColumns("order").join(",") };
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
  let message: unknown;
  try {
    for (const _ of [1, 2]) expect((await request("", fields)).status).toBe(202);
    message = send.mock.calls[0]![0];
    const busy = await request("", fields);
    expect(busy.status).toBe(429);
    expect(await busy.json()).toEqual({
      ok: false,
      notice: it_.settings.export.exportBusy(maxQueuedExports),
    });
    expect(send).toHaveBeenCalledTimes(2);
  } finally {
    send.mockRestore();
  }
  expect(it_.settings.export.exportBusy(2)).toBe(
    "Hai già 2 file in preparazione: potrai crearne un altro quando uno sarà pronto.",
  );
  expect(appCopy.en.settings.export.exportBusy(2)).toBe(
    "You already have 2 files being prepared: you can create another one when one is ready.",
  );
  // Premium finisce prima che il lavoro parta: il CSV standard si crea comunque.
  vi.setSystemTime(Date.parse(hours(1)));
  const { exportJob: id } = message as { exportJob: string };
  await consumeExportJob(queueMessage(message), env);
  expect(await job(id)).toMatchObject({ state: "ready" });
  // Nel Free le colonne standard valgono come lo schema standard, quelle scelte no.
  expect(
    (await request("ordini=o-a", { columns: standardColumns("order").join(",") })).status,
  ).toBe(200);
  expect((await request("ordini=o-a", { columns: "taxCode,order" })).status).toBe(403);
});

it("un XLSX oltre il limite di righe del foglio non riesce subito e lo dice", async () => {
  await insertEntitlement({
    source: "admin",
    endsAt: hours(48),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  const id = await queuedJob({ format: "xlsx" });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const full = vi.spyOn(env.EXPORT_FILES, "put").mockRejectedValue(new XlsxRowLimitError());
  try {
    const delivery = queueMessage({ exportJob: id });
    await consumeExportJob(delivery, env);
    expect(delivery.retry).not.toHaveBeenCalled();
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(await job(id)).toMatchObject({ state: "failed", request_sealed: null });
    const response = await request("ordini=o-a", { format: "xlsx" });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      ok: false,
      notice: it_.settings.export.exportTooManyRows,
    });
  } finally {
    full.mockRestore();
    errors.mockRestore();
  }
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
});
