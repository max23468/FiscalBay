import { expect, it, vi } from "vitest";

import { duringServiceActivity, waitUntil } from "../app/service-activity.server";

import { recordingDatabase, insideRequest, setupScenarios } from "./fixtures/webhooks-scenarios";

const router = vi.hoisted(() => ({ handle: vi.fn(), create: vi.fn() }));

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  createRequestHandler: router.create,
}));

setupScenarios(router);

it("una richiesta senza accessi D1 non tocca il registro", async () => {
  const { db, calls } = recordingDatabase();
  await expect(insideRequest(db, async () => "ok")).resolves.toBe("ok");
  expect(calls).toEqual([]);
});

it("senza lavoro in background il registro si libera prima della risposta", async () => {
  const { db, calls } = recordingDatabase();
  await duringServiceActivity(
    db,
    async () => {},
    () => {},
  );
  expect(calls.at(-1)).toBe("fine DELETE FROM service_activity WHERE id = ?");
});

it("il lavoro in background non ritarda la risposta e il rilascio lo attende", async () => {
  const { db, calls } = recordingDatabase();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const answered = duringServiceActivity(
    db,
    async () => waitUntil(pending),
    () => {},
  ).then(() => "risposta");
  const elapsed = (async () => {
    for (let tick = 0; tick < 200; tick += 1) await Promise.resolve();
    return "in attesa";
  })();
  await expect(Promise.race([answered, elapsed])).resolves.toBe("risposta");
  expect(calls).not.toContain("DELETE FROM service_activity WHERE id = ?");
  release();
  await vi.waitFor(() => expect(calls).toContain("fine DELETE FROM service_activity WHERE id = ?"));
});

it("una lettura attende la registrazione dell'ingresso", async () => {
  const { db, calls } = recordingDatabase();
  await insideRequest(db, (target) => target.DB.prepare("SELECT 1").run());
  expect(calls[1]).toMatch(/^fine INSERT INTO service_activity/u);
  expect(calls[2]).toBe("SELECT 1");
});

it("il database protetto resta usabile fuori dall'operazione e uguale fra le richieste", async () => {
  const { db, calls } = recordingDatabase();
  const first = await insideRequest(db, async (target) => target.DB);
  const second = await insideRequest(db, async (target) => target.DB);
  expect(second).toBe(first);
  await first.prepare("SELECT 1").run();
  expect(calls).toEqual(["SELECT 1", "fine SELECT 1"]);
});

it("il database protetto conserva le proprietà e rifiuta i metodi non qualificati", async () => {
  const { db, calls } = recordingDatabase();
  await insideRequest(db, async (target) => {
    const guarded = target.DB as unknown as { marker: number };
    const prepared = target.DB.prepare("SELECT 1") as unknown as { statement: string };
    expect(guarded.marker).toBe(1);
    expect(prepared.statement).toBe("SELECT 1");
    expect(() => target.DB.withSession()).toThrow("Metodo D1 non qualificato per la sospensione.");
  });
  expect(calls).toEqual([]);
});

it("batch ed exec registrano l'ingresso e usano le istruzioni native", async () => {
  const { db, calls, statements, batch, exec } = recordingDatabase();
  const foreign = {} as D1PreparedStatement;
  await insideRequest(db, async (target) => {
    await target.DB.batch([target.DB.prepare("SELECT 1"), foreign]);
    await target.DB.exec("SELECT 2");
  });
  expect(batch).toHaveBeenCalledWith([statements[0], foreign]);
  expect(batch.mock.calls[0]![0][0]).toBe(statements[0]);
  expect(exec).toHaveBeenCalledWith("SELECT 2");
  expect(calls[0]).toMatch(/^INSERT INTO service_activity/u);
});
