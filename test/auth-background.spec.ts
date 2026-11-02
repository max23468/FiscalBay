import { env } from "cloudflare:workers";
import { beforeEach, expect, it, vi } from "vitest";

const background = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }));
vi.mock("cloudflare:workers", async (original) => ({
  ...(await original<typeof import("cloudflare:workers")>()),
  waitUntil: (task: Promise<unknown>) => background.tasks.push(task),
}));

// La preparazione importa Auth prima dei mock del file: ricarica anche il registro del servizio.
vi.resetModules();
const { createAuthOptions } = await import("../app/auth.server");
const { duringRequestActivity } = await import("../app/service-activity.server");
beforeEach(() => {
  background.tasks.length = 0;
});

it("con la dashboard gli invii in background restano al Worker fino alla fine, senza errori", async () => {
  const plugin = createAuthOptions({
    ...env,
    BETTER_AUTH_API_KEY: "chiave-di-prova",
  }).plugins?.find((entry) => entry.id === "durable-background");
  const context = (await plugin?.init?.({} as never)) as {
    context: { runInBackground: (task: Promise<unknown>) => void };
  };
  context.context.runInBackground(Promise.reject(new Error("invio non riuscito")));
  expect(background.tasks).toHaveLength(1);
  await expect(background.tasks[0]).resolves.toBeUndefined();
});

it("mantiene viva la richiesta prima della risposta, fino alla pulizia del registro", async () => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const operation = duringRequestActivity(
    env,
    async (target) => {
      await target.DB.prepare("SELECT 1").first();
      await pending;
      return new Response(null, { status: 200 });
    },
    () => new Response(null, { status: 503 }),
  );
  try {
    // Il client può scollegarsi già ora: il runtime deve avere ricevuto la promise completa.
    expect(background.tasks).toHaveLength(1);
    await vi.waitFor(async () => {
      expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(1);
    });
  } finally {
    complete();
    await operation;
    await Promise.all(background.tasks);
  }
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM service_activity").first("n")).toBe(0);
});
