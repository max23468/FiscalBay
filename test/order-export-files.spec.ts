import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { action as exportAction } from "../app/routes/order-export";

import {
  exportPartBytes,
  exportRevision,
  publishExportFile,
  purgeExportFiles,
} from "../app/domain/export-files.server";

import { consumeExportJob } from "../app/domain/export-jobs.server";

import { verifiedSession } from "./fixtures/account-fixtures";

import { queueMessage } from "./fixtures/queue-fixture";

import { insertEntitlement, now } from "./fixtures/database-fixtures";

import { routeResponse } from "./fixtures/route-fixtures";

import {
  it_,
  cookie,
  userId,
  request,
  csv,
  created,
  download,
  gone,
  expiry,
  hours,
  queuedJob,
  job,
  setupScenarios,
} from "./fixtures/order-export-scenarios";

setupScenarios();

it("salva il file con una chiave opaca e lo scarica soltanto per il suo utente fino a scadenza", async () => {
  const id = await created();
  expect(await env.DB.prepare("SELECT * FROM export_files WHERE id = ?").bind(id).first()).toEqual({
    id,
    user_id: userId,
    file_name: "fiscalbay-ordini-2026-09-13.csv",
    content_type: "text/csv; charset=utf-8",
    access_revision: 0,
    created_at: now,
    expires_at: new Date(Date.parse(now) + 86_400_000).toISOString(),
  });
  const object = await env.EXPORT_FILES.head(id);
  expect(object?.httpMetadata?.contentType).toBe("text/csv; charset=utf-8");
  // Il file resta scaricabile più volte, con le stesse intestazioni del file creato.
  for (const _ of [1, 2]) {
    const response = await download(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(object!.size));
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="fiscalbay-ordini-2026-09-13.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await csv(response)).rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
  }
  // Senza sessione, o con la sessione di un altro utente, il file non esiste.
  expect((await download(id, { cookie: null })).status).toBe(401);
  const anonymous = await download(id, { cookie: null, json: false });
  expect(anonymous.headers.get("location")).toBe("/accesso");
  const other = await verifiedSession(`altro-${crypto.randomUUID()}@example.invalid`);
  await gone(await download(id, { cookie: other.cookie }));
  await gone(await download(crypto.randomUUID()));
  // L'ultimo istante vale ancora; alla scadenza il file è negato anche se i byte esistono.
  vi.setSystemTime(Date.parse(now) + 86_400_000 - 1);
  expect((await download(id)).status).toBe(200);
  vi.setSystemTime(Date.parse(now) + 86_400_000);
  await gone(await download(id));
  const navigation = await download(id, { json: false });
  expect(navigation.status).toBe(303);
  expect(navigation.headers.get("location")).toBe("/app/impostazioni/esportazione");
  expect(await env.EXPORT_FILES.head(id)).not.toBeNull();
  // La pulizia elimina oggetto e riga.
  expect(await purgeExportFiles(env, new Date())).toBe(1);
  expect(await env.EXPORT_FILES.head(id)).toBeNull();
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
});

it("in inglese rimanda al download in inglese e un modulo senza JavaScript lo segue", async () => {
  const response = await routeResponse(exportAction, "/api/v1/orders/export?ordini=o-a", {
    cookie,
    fields: { language: "en" },
  });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toMatch(/^\/en\/api\/v1\/exports\/[0-9a-f-]{36}$/u);
});

it("con Pro il file non vale oltre la fine della copertura", async () => {
  const endsAt = new Date(Date.parse(now) + 2 * 3_600_000).toISOString();
  await insertEntitlement({
    source: "admin",
    endsAt,
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  const id = await created("ordini=o-a", { format: "xlsx" });
  expect(
    await env.DB.prepare("SELECT expires_at FROM export_files WHERE id = ?")
      .bind(id)
      .first("expires_at"),
  ).toBe(endsAt);
  vi.setSystemTime(Date.parse(endsAt));
  await gone(await download(id));
});

it("ogni revoca dello spazio invalida i suoi file, un nuovo ordine no", async () => {
  const revision = () => exportRevision(env.DB, userId);
  const id = await created();
  await env.DB.prepare(
    `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES ('o-new', 's-a', 'ebay-new', ?1, ?1, 'EUR', 100)`,
  )
    .bind(now)
    .run();
  expect(await revision()).toBe(0);
  expect((await download(id)).status).toBe(200);
  // Copertura revocata.
  await insertEntitlement({
    id: "e-revoked",
    source: "admin",
    endsAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE id = 'e-revoked'")
    .bind(now)
    .run();
  expect(await revision()).toBe(1);
  await gone(await download(id));
  expect(await env.EXPORT_FILES.head(id)).not.toBeNull();
  // Negozio escluso dal piano, poi dati del negozio eliminati e negozio trasferito.
  await env.DB.prepare(
    "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'plan', ?)",
  )
    .bind(now)
    .run();
  expect(await revision()).toBe(2);
  await env.DB.prepare(
    "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
  )
    .bind(now)
    .run();
  expect(await revision()).toBe(2);
  await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-a'")
    .bind(now)
    .run();
  expect(await revision()).toBe(3);
  await env.DB.prepare("UPDATE ebay_stores SET workspace_id = 'w-b' WHERE id = 's-a'").run();
  expect(await revision()).toBe(4);
  expect(await purgeExportFiles(env, new Date())).toBe(1);
  expect(await env.EXPORT_FILES.head(id)).toBeNull();
});

it("un file generato durante una revoca non diventa scaricabile", async () => {
  const revision = await exportRevision(env.DB, userId);
  const before = (await env.EXPORT_FILES.list()).objects.length;
  const encoder = new TextEncoder();
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      sent = true;
      await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-a'")
        .bind(now)
        .run();
      controller.enqueue(encoder.encode("ordine"));
    },
  });
  const file = {
    userId,
    revision,
    fileName: "fiscalbay-ordini-2026-09-13.csv",
    contentType: "text/csv; charset=utf-8",
    now: new Date(now),
  };
  expect(await publishExportFile(env, { ...file, body })).toBeNull();
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before);
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
  // La revisione nuova pubblica di nuovo; una scadenza già passata no.
  const fresh = await exportRevision(env.DB, userId);
  const text = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("ordine"));
        controller.close();
      },
    });
  expect(await publishExportFile(env, { ...file, revision: fresh, body: text() })).toMatch(
    /^[0-9a-f-]{36}$/u,
  );
  expect(
    await publishExportFile(env, { ...file, revision: fresh, body: text(), expiresAt: now }),
  ).toBeNull();
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before + 1);
});

it("scrive un file grande a parti e annulla il caricamento di un flusso interrotto", async () => {
  const size = 2 * exportPartBytes + 3;
  const source = new Uint8Array(size);
  for (let i = 0; i < size; i++) source[i] = (i * 31) % 251;
  // Pezzi di dimensione irregolare, che attraversano i confini delle parti.
  const chunked = (fail = false) => {
    let offset = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= size) {
          controller.close();
          return;
        }
        if (fail && offset > exportPartBytes) {
          controller.error(new Error("lettura interrotta"));
          return;
        }
        const next = Math.min(size, offset + 1_000_003);
        controller.enqueue(source.slice(offset, next));
        offset = next;
      },
    });
  };
  const file = {
    userId,
    revision: 0,
    fileName: "fiscalbay-ordini-2026-09-13.csv",
    contentType: "text/csv; charset=utf-8",
    now: new Date(now),
  };
  const multipart = vi.spyOn(env.EXPORT_FILES, "createMultipartUpload");
  let id: string | null;
  try {
    id = await publishExportFile(env, { ...file, body: chunked() });
    // Il file non resta intero in memoria: passa dal caricamento a parti.
    expect(multipart).toHaveBeenCalledOnce();
  } finally {
    multipart.mockRestore();
  }
  const object = await env.EXPORT_FILES.get(id!);
  expect(object?.size).toBe(size);
  const digest = async (bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) =>
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].join(",");
  expect(await digest(await object!.arrayBuffer())).toBe(await digest(source));
  const before = (await env.EXPORT_FILES.list()).objects.length;
  // Il caricamento a parti già iniziato si annulla: `list()` non mostra le parti caricate, che
  // senza annullamento resterebbero nel bucket fino alla sua scadenza.
  const started = env.EXPORT_FILES.createMultipartUpload.bind(env.EXPORT_FILES);
  const uploads: Array<{ parts: number; aborted: boolean }> = [];
  const interrupted = vi
    .spyOn(env.EXPORT_FILES, "createMultipartUpload")
    .mockImplementation(async (...args) => {
      const upload = await started(...args);
      const seen = { parts: 0, aborted: false };
      uploads.push(seen);
      return {
        key: upload.key,
        uploadId: upload.uploadId,
        uploadPart: (number: number, value: Uint8Array) => {
          seen.parts++;
          return upload.uploadPart(number, value);
        },
        complete: (parts: R2UploadedPart[]) => upload.complete(parts),
        abort: async () => {
          seen.aborted = true;
          await upload.abort();
        },
      } as R2MultipartUpload;
    });
  try {
    await expect(publishExportFile(env, { ...file, body: chunked(true) })).rejects.toThrow(
      "lettura interrotta",
    );
  } finally {
    interrupted.mockRestore();
  }
  expect(uploads).toEqual([{ parts: 1, aborted: true }]);
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before);
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(1);
  // Un file di una parte esatta è una parte sola, senza una parte vuota in coda.
  const exact = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(source.slice(0, exportPartBytes));
      controller.close();
    },
  });
  const bucket = env.EXPORT_FILES;
  const create = bucket.createMultipartUpload.bind(bucket);
  const sent: number[] = [];
  const counted = vi.spyOn(bucket, "createMultipartUpload").mockImplementation(async (...args) => {
    const upload = await create(...args);
    return {
      key: upload.key,
      uploadId: upload.uploadId,
      uploadPart: (number: number, value: Uint8Array) => {
        sent.push(value.byteLength);
        return upload.uploadPart(number, value);
      },
      complete: (parts: R2UploadedPart[]) => upload.complete(parts),
      abort: () => upload.abort(),
    } as R2MultipartUpload;
  });
  let single: string | null;
  try {
    single = await publishExportFile(env, { ...file, body: exact });
  } finally {
    counted.mockRestore();
  }
  expect(sent).toEqual([exportPartBytes]);
  expect((await env.EXPORT_FILES.head(single!))?.size).toBe(exportPartBytes);
  // Un errore prima della prima parte resta l'errore del flusso.
  const broken = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("lettura impossibile"));
    },
  });
  await expect(publishExportFile(env, { ...file, body: broken })).rejects.toThrow(
    "lettura impossibile",
  );
  // Una riga che non si registra non lascia l'oggetto nel bucket.
  const objects = (await env.EXPORT_FILES.list()).objects.length;
  const text = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("ordine"));
      controller.close();
    },
  });
  await expect(
    publishExportFile(env, { ...file, userId: "utente-assente", body: text }),
  ).rejects.toThrow();
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(objects);
});

it("un errore a metà del file risponde con l'avviso senza lasciare un file", async () => {
  const before = (await env.EXPORT_FILES.list()).objects.length;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const failing = vi
    .spyOn(env.EXPORT_FILES, "put")
    .mockRejectedValueOnce(new Error("R2 non disponibile"));
  try {
    const response = await request("ordini=o-a");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      notice: it_.settings.export.exportFailed,
    });
  } finally {
    failing.mockRestore();
    errors.mockRestore();
  }
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before);
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
});

it("il file non vale oltre il primo termine dei dati inclusi, anche con la pulizia sospesa", async () => {
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = 'o-a'")
    .bind(hours(3))
    .run();
  const retained = await created();
  expect(await expiry(retained)).toBe(hours(3));
  // Uno sblocco con una scadenza propria anticipa il termine; un ordine fuori dal file no.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM order_grants WHERE id = 'g-a'"),
    env.DB.prepare(
      `INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at, expires_at)
         VALUES ('g-a2', 'w-a', 'o-a', NULL, 'admin', ?, ?)`,
    ).bind(now, hours(2)),
  ]);
  const unlocked = await created();
  expect(await expiry(unlocked)).toBe(hours(2));
  expect(await expiry(await created("ordini=o-c"))).toBe(hours(24));
  // L'ultimo istante prima del termine vale ancora; dal termine il file è negato, anche se la
  // pulizia non è passata e i byte esistono.
  vi.setSystemTime(Date.parse(hours(2)) - 1);
  expect((await download(unlocked)).status).toBe(200);
  vi.setSystemTime(Date.parse(hours(2)));
  await gone(await download(unlocked));
  expect((await download(retained)).status).toBe(200);
  vi.setSystemTime(Date.parse(hours(3)));
  await gone(await download(retained));
  expect(await env.EXPORT_FILES.head(retained)).not.toBeNull();
  expect(await purgeExportFiles(env, new Date())).toBe(2);
});

it("con Pro i periodi di 6 e 12 mesi seguono quelli degli Ordini", async () => {
  await insertEntitlement({
    source: "admin",
    endsAt: hours(24 * 30),
    grantedBy: "owner",
    grantReason: "prova",
  }).run();
  await env.DB.prepare(
    `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor, retention_until, purge_after)
       VALUES ('o-8m', 's-a', 'ebay-8m', ?1, ?1, 'EUR', 100, ?2, ?2)`,
  )
    .bind(hours(-24 * 240), hours(24 * 125))
    .run();
  const ids = async (period: string) =>
    (await csv(await request("", { period }))).rows.map((row) => row["Numero ordine"]).sort();
  expect(await ids("6m")).toEqual(["ebay-a", "ebay-c", "ebay-d"]);
  expect(await ids("12m")).toEqual(["ebay-8m", "ebay-a", "ebay-c", "ebay-d"]);
});

it("estensione revocata, dato fiscale rimosso e ordine eliminato prima del termine invalidano i file", async () => {
  const revision = () => exportRevision(env.DB, userId);
  await env.DB.prepare(
    `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
       VALUES ('x-a', 'w-a', 18, 'Storico verificato', 'owner', ?)`,
  )
    .bind(now)
    .run();
  const id = await created();
  expect(await revision()).toBe(0);
  await env.DB.prepare("UPDATE history_extensions SET revoked_at = ? WHERE id = 'x-a'")
    .bind(now)
    .run();
  expect(await revision()).toBe(1);
  await gone(await download(id));
  // La fonte rimuove o sostituisce un valore fiscale; un valore di un altro spazio non conta.
  await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-c'")
    .bind(now)
    .run();
  expect(await revision()).toBe(2);
  await env.DB.prepare(
    "UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-b' AND removed_at IS NULL",
  )
    .bind(now)
    .run();
  expect(await revision()).toBe(2);
  // La pulizia di un ordine già scaduto non invalida; un ordine eliminato prima del termine sì.
  await env.DB.prepare(
    `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
         currency, total_minor, retention_until, purge_after)
       VALUES ('o-old', 's-a', 'ebay-old', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z',
               'EUR', 100, '2025-01-31T00:00:00.000Z', '2025-01-31T00:00:00.000Z'),
              ('o-kept', 's-a', 'ebay-kept', ?1, ?1, 'EUR', 100,
               '2099-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')`,
  )
    .bind(now)
    .run();
  await env.DB.prepare("DELETE FROM orders WHERE id = 'o-old'").run();
  expect(await revision()).toBe(2);
  await env.DB.prepare("DELETE FROM orders WHERE id = 'o-kept'").run();
  expect(await revision()).toBe(3);
});

it("una revoca fra la revisione e la lettura dei dati non rende il file scaricabile", async () => {
  const before = (await env.EXPORT_FILES.list()).objects.length;
  const prepare = env.DB.prepare.bind(env.DB);
  let revoked = false;
  const revoke = async () => {
    if (revoked) return;
    revoked = true;
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-c'")
      .bind(now)
      .run();
  };
  // La revoca arriva appena prima che il file legga gli ordini.
  const reading = vi.spyOn(env.DB, "prepare").mockImplementation((sql: string) => {
    const statement = prepare(sql);
    if (revoked || !sql.trimStart().startsWith("WITH visible_orders")) return statement;
    return {
      bind: (...values: unknown[]) => {
        const bound = statement.bind(...values);
        return {
          all: async () => {
            await revoke();
            return bound.all();
          },
        };
      },
    } as unknown as D1PreparedStatement;
  });
  let response: Response;
  try {
    response = await request("ordini=o-a");
  } finally {
    reading.mockRestore();
  }
  expect(revoked).toBe(true);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ ok: false, notice: it_.settings.export.exportGone });
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before);
  expect(await env.DB.prepare("SELECT count(*) AS n FROM export_files").first("n")).toBe(0);
  // Lo stesso vale per un lavoro dalla coda: si chiude come non riuscito, senza file.
  const id = await queuedJob();
  revoked = false;
  const queuedReading = vi.spyOn(env.DB, "prepare").mockImplementation((sql: string) => {
    const statement = prepare(sql);
    if (revoked || !sql.trimStart().startsWith("WITH visible_orders")) return statement;
    return {
      bind: (...values: unknown[]) => {
        const bound = statement.bind(...values);
        return {
          all: async () => {
            revoked = true;
            await env.DB.prepare(
              `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at, revoked_at)
                 VALUES ('x-revocata', 'w-a', 18, 'Storico', 'owner', ?1, NULL)`,
            )
              .bind(now)
              .run();
            await env.DB.prepare(
              "UPDATE history_extensions SET revoked_at = ? WHERE id = 'x-revocata'",
            )
              .bind(now)
              .run();
            return bound.all();
          },
        };
      },
    } as unknown as D1PreparedStatement;
  });
  const delivery = queueMessage({ exportJob: id });
  try {
    await consumeExportJob(delivery, env);
  } finally {
    queuedReading.mockRestore();
  }
  expect(revoked).toBe(true);
  expect(delivery.ack).toHaveBeenCalledOnce();
  expect(await job(id)).toMatchObject({ state: "failed", file_id: null, request_sealed: null });
  expect((await env.EXPORT_FILES.list()).objects.length).toBe(before);
});

it("un download già autorizzato si completa, quello dopo la revoca è negato", async () => {
  const id = await created();
  const get = env.EXPORT_FILES.get.bind(env.EXPORT_FILES);
  // La revoca arriva fra il controllo della riga e la lettura dei byte.
  const reading = vi.spyOn(env.EXPORT_FILES, "get").mockImplementation(async (...args) => {
    await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-a'")
      .bind(now)
      .run();
    return get(...(args as [string]));
  });
  let response: Response;
  try {
    response = await download(id);
  } finally {
    reading.mockRestore();
  }
  expect(response.status).toBe(200);
  expect((await csv(response)).rows.map((row) => row["Numero ordine"])).toEqual(["ebay-a"]);
  await gone(await download(id));
});
