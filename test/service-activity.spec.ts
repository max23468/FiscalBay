import { env } from "cloudflare:workers";
import { beforeEach, expect, it, vi } from "vitest";

import { duringServiceActivity, waitUntil } from "../app/service-activity.server";

const registered = async () =>
  (await env.DB.prepare("SELECT COUNT(*) AS rows FROM service_activity").first<{ rows: number }>())!
    .rows;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM service_activity").run();
});

it("senza lavoro in background il registro si libera prima della risposta", async () => {
  let during = -1;
  await duringServiceActivity(
    env.DB,
    async () => {
      during = await registered();
    },
    () => {},
  );
  expect(during).toBe(1);
  expect(await registered()).toBe(0);
});

it("il lavoro in background non ritarda la risposta e il rilascio lo attende", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  // Con il lavoro ancora in sospeso la risposta arriva lo stesso: se lo attendesse, la prova
  // scadrebbe.
  await duringServiceActivity(
    env.DB,
    async () => waitUntil(pending),
    () => {},
  );
  expect(await registered()).toBe(1);
  release();
  await vi.waitFor(async () => expect(await registered()).toBe(0));
});

it("con il ripristino in corso il lavoro non parte e non si registra", async () => {
  await env.DB.prepare(
    `INSERT INTO service_settings (name, value, updated_at) VALUES ('recovery_frozen', 'true', ?)
     ON CONFLICT (name) DO UPDATE SET value = 'true'`,
  )
    .bind(new Date().toISOString())
    .run();
  try {
    const run = vi.fn();
    expect(await duringServiceActivity(env.DB, run, () => "bloccato")).toBe("bloccato");
    expect(run).not.toHaveBeenCalled();
    expect(await registered()).toBe(0);
  } finally {
    await env.DB.prepare("DELETE FROM service_settings WHERE name = 'recovery_frozen'").run();
  }
});
