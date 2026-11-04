import { expect, it, vi } from "vitest";

import { duringServiceActivity, waitUntil } from "../app/service-activity.server";

import { recordingDatabase, setupScenarios } from "./fixtures/webhooks-scenarios";

const router = vi.hoisted(() => ({ handle: vi.fn(), create: vi.fn() }));

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  createRequestHandler: router.create,
}));

setupScenarios(router);

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
