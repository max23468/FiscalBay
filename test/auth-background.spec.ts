import { env } from "cloudflare:workers";
import { expect, it, vi } from "vitest";

const background = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }));
vi.mock("../app/service-activity.server", async (original) => ({
  ...(await original<typeof import("../app/service-activity.server")>()),
  waitUntil: (task: Promise<unknown>) => background.tasks.push(task),
}));

const { createAuthOptions } = await import("../app/auth.server");

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
