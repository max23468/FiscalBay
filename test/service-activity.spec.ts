import { expect, it, vi } from "vitest";

import { duringServiceActivity, waitUntil } from "../app/service-activity.server";

/** D1 fittizio che annota inizio e fine di ogni istruzione, per provare il guscio del registro. */
function recordingDatabase() {
  const calls: string[] = [];
  const statement = (sql: string) => ({
    statement: sql,
    bind: () => statement(sql),
    run: async () => {
      calls.push(sql);
      for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
      calls.push(`fine ${sql}`);
      return { meta: { changes: 1 } };
    },
  });
  const db = {
    prepare: statement,
    batch: vi.fn(async (queries: object[]) => queries),
    exec: vi.fn(async () => ({ count: 1, duration: 0 })),
  };
  return { db: db as unknown as D1Database, calls };
}

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
