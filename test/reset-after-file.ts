import { env } from "cloudflare:workers";
import { afterAll, vi } from "vitest";

// Con `isolate: false` più file condividono lo stesso Worker di prova: ogni file lascia al
// successivo lo stato che questo avrebbe in un isolate nuovo. Niente pulizia in `beforeAll`: le
// sostituzioni create mentre Vitest raccoglie le prove del file esistono già e verrebbero tolte.
const initial = new Map(Object.entries(env));

// Il binding email è uno stub RPC di workerd: dopo un invio reale partito da un lavoro in
// background, le letture fatte da altri `waitUntil` non vedono più uno spy messo sulla sua
// proprietà `send` e chiamano il binding vero. Un oggetto JavaScript che inoltra al binding rende
// `vi.spyOn(env.AUTH_EMAIL, "send")` valido in ogni contesto.
const email = env.AUTH_EMAIL;
env.AUTH_EMAIL = { send: ((message: never) => email.send(message)) as SendEmail["send"] };

afterAll(async () => {
  restoreProcessState();
  vi.resetModules();
  await emptyExportFiles();
  await dropDatabase();
});

function restoreProcessState() {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  const bindings = env as unknown as Record<string, unknown>;
  for (const key of Object.keys(bindings)) if (!initial.has(key)) delete bindings[key];
  for (const [key, value] of initial) if (bindings[key] !== value) bindings[key] = value;
}

async function emptyExportFiles() {
  let cursor: string | undefined;
  do {
    const page = await env.EXPORT_FILES.list({ cursor });
    if (page.objects.length > 0) await env.EXPORT_FILES.delete(page.objects.map(({ key }) => key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

// Tabelle, viste e trigger tornano a zero, registro delle migration compreso: il `beforeAll` di
// `apply-migrations.ts` del file seguente ricrea lo schema e i dati iniziali delle migration.
async function dropDatabase() {
  const { results } = await env.DB.prepare(
    `SELECT type, name FROM sqlite_master
     WHERE type IN ('table', 'view', 'trigger')
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
  ).all<{ type: "table" | "view" | "trigger"; name: string }>();
  if (results.length === 0) return;
  const { results: references } = await env.DB.prepare(
    `SELECT m.name AS child, f."table" AS parent
     FROM sqlite_master AS m, pragma_foreign_key_list(m.name) AS f
     WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'`,
  ).all<{ child: string; parent: string }>();
  // Una tabella si elimina dopo quelle che la referenziano: il controllo delle chiavi esterne non
  // deve trovare figli rimasti senza la tabella del genitore.
  const tables = results.filter(({ type }) => type === "table").map(({ name }) => name);
  const dropped: string[] = [];
  const pending = new Set(tables);
  while (pending.size > 0) {
    const ready = [...pending].filter(
      (table) =>
        !references.some(
          ({ child, parent }) => parent === table && child !== table && pending.has(child),
        ),
    );
    // Un ciclo fra tabelle resta all'ordine alfabetico: il rinvio delle chiavi lo copre.
    for (const table of ready.length > 0 ? ready : [...pending]) {
      pending.delete(table);
      dropped.push(table);
    }
  }
  const statements = [
    ...results.filter(({ type }) => type === "trigger"),
    ...results.filter(({ type }) => type === "view"),
    ...dropped.map((name) => ({ type: "table" as const, name })),
  ].map(({ type, name }) => env.DB.prepare(`DROP ${type.toUpperCase()} IF EXISTS "${name}"`));
  await env.DB.batch([env.DB.prepare("PRAGMA defer_foreign_keys = on"), ...statements]);
}
