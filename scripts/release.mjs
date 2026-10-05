#!/usr/bin/env node
/** Provenienza, migration e readback. Nessun effetto remoto nei comandi manifest/verify. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const targets = {
  test: { worker: "fiscalbay-test", origin: "https://test.fiscalbay.it", ref: "develop" },
  production: { worker: "fiscalbay", origin: "https://fiscalbay.it", ref: "main" },
};

export function digestDirectory(directory) {
  const files = [];
  const visit = (relative) => {
    for (const item of readdirSync(path.join(directory, relative), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const name = path.join(relative, item.name);
      if (item.isSymbolicLink()) throw new Error("Link simbolico nell'artefatto.");
      if (item.isDirectory()) visit(name);
      else if (name !== "release-manifest.json")
        files.push([name, hash(readFileSync(path.join(directory, name)))]);
    }
  };
  visit("");
  if (!files.length) throw new Error("Artefatto vuoto.");
  return hash(JSON.stringify(files));
}

export function migrationPlan(migrations, applied, reviewed = "") {
  if (applied.some((name) => !migrations.some((migration) => migration.name === name)))
    throw new Error("Schema remoto contiene migration assenti dal candidato.");
  const pending = migrations.filter(({ name }) => !applied.includes(name));
  const digest = hash(JSON.stringify(pending.map(({ name, digest }) => ({ name, digest }))));
  const unsafe = pending.filter(({ sql }) => {
    const text = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//gu, "");
    return (
      /\b(?:DROP|DELETE|UPDATE|INSERT|REPLACE|RENAME|TRIGGER)\b/iu.test(text) ||
      /\bALTER\s+TABLE\b/iu.test(text)
    );
  });
  if (unsafe.length && reviewed !== digest)
    throw new Error(
      `Migration da approvare: ${unsafe.map(({ name }) => name).join(", ")}. Digest ${digest}`,
    );
  return { pending, digest, rollbackCompatible: pending.length === 0 };
}

export function assertResume(receipt, manifest) {
  if (
    receipt &&
    (receipt.tree !== manifest.tree ||
      receipt.digest !== manifest.digest ||
      receipt.environment !== manifest.environment)
  )
    throw new Error("Ricevuta di un candidato diverso.");
}

export function assertAppliedMigrations(migrations, previous, applied) {
  for (const name of applied) {
    const current = migrations.find((migration) => migration.name === name);
    const prior = previous.find((migration) => migration.name === name);
    if (!current || !prior || current.digest !== prior.digest)
      throw new Error(`Migration applicata modificata: ${name}.`);
  }
}

/** Passi riprendibili: la fonte dell'esito remoto viene riletta anche dopo un'interruzione. */
export async function publish(manifest, io, receipt = {}) {
  assertResume(Object.keys(receipt).length ? receipt : null, manifest);
  const state = {
    ...receipt,
    sha: manifest.sha,
    tree: manifest.tree,
    digest: manifest.digest,
    environment: manifest.environment,
  };
  await io.assertCurrent();
  await io.preflight();
  state.readback = false;
  delete state.rolledBack;
  const migrations = await io.migrations();
  if (migrations.pending.length) {
    state.schemaChanged = true;
    state.rollbackCompatible = false;
    await io.save(state);
    await io.migrate(migrations);
  }
  state.schema = await io.schema();
  await io.save(state);
  const current = await io.current();
  const identity = `${manifest.sha}:${manifest.digest}`;
  if (current.identity?.startsWith(`${manifest.sha}:`) && current.identity !== identity)
    throw new Error(
      "Commit già distribuito con artefatto diverso: recuperare l'artefatto originale.",
    );
  if (current.identity !== identity) {
    await io.assertCurrent();
    state.previous = current.version;
    state.rollbackCompatible =
      migrations.rollbackCompatible && !state.schemaChanged && (await io.canRollback(current));
    await io.save(state);
    await io.deploy(identity);
  }
  const deployed = await io.current();
  if (deployed.identity !== identity)
    throw new Error("Versione distribuita diversa dall'artefatto atteso.");
  state.version = deployed.version;
  state.deployed = true;
  await io.save(state);
  await io.readback(deployed.version);
  state.readback = true;
  await io.save(state);
  return state;
}

function manifests(environment) {
  if (git("status", "--porcelain"))
    throw new Error("Sorgenti non salvati nel commit: provenienza non attestabile.");
  const config = JSON.parse(readFileSync("build/server/wrangler.json", "utf8"));
  const target = targets[environment];
  if (
    !target ||
    config.name !== target.worker ||
    config.vars.APP_ORIGIN !== target.origin ||
    !config.no_bundle
  )
    throw new Error("Build o configurazione dell'ambiente errata.");
  const migrations = readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, digest: hash(readFileSync(`migrations/${name}`)) }));
  return {
    sha: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
    digest: digestDirectory("build"),
    environment,
    config: hash(readFileSync("wrangler.jsonc")),
    lockfile: hash(readFileSync("pnpm-lock.yaml")),
    migrations,
    node: process.version,
    packageManager: JSON.parse(readFileSync("package.json", "utf8")).packageManager,
  };
}

function verify(environment) {
  const saved = JSON.parse(readFileSync("build/release-manifest.json", "utf8"));
  const current = manifests(environment);
  for (const key of [
    "tree",
    "digest",
    "environment",
    "config",
    "lockfile",
    "node",
    "packageManager",
  ])
    if (saved[key] !== current[key]) throw new Error(`Provenienza non valida: ${key}.`);
  if (JSON.stringify(saved.migrations) !== JSON.stringify(current.migrations))
    throw new Error("Migration diverse da quelle verificate.");
  // Un merge può cambiare SHA conservando esattamente lo stesso tree verificato.
  return { ...saved, sha: current.sha };
}

export function productionReadiness(backlog) {
  for (const suffix of ["01", "02", "03"]) {
    const task = "M" + "9-" + suffix;
    const section = backlog.split(`### ${task} `)[1]?.split("\n### ")[0];
    if (!section || !/\*\*Stato:\*\* DONE\b/u.test(section))
      throw new Error("Checkpoint Production non chiusi nel backlog.");
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      environment: { type: "string", default: "test" },
      "reviewed-migrations": { type: "string", default: "" },
      "expected-sha": { type: "string" },
    },
  });
  const environment = values.environment;
  const target = targets[environment];
  if (!target) throw new Error("Ambiente non supportato.");
  const command = positionals[0];
  if (command === "readiness") {
    productionReadiness(readFileSync("BACKLOG.md", "utf8"));
    return;
  }
  if (command === "manifest") {
    // Il preview crea questo file con segreti locali: non entra mai nell'artefatto.
    rmSync("build/server/.dev.vars", { force: true });
    writeFileSync("build/release-manifest.json", JSON.stringify(manifests(environment), null, 2));
    return;
  }
  const manifest = verify(environment);
  if (command === "verify") {
    console.log("Provenienza dell'artefatto confermata.");
    return;
  }
  if (!["deploy", "rollback"].includes(command)) throw new Error("Comando non supportato.");
  if (environment === "production") {
    if (
      process.env.PRODUCTION_PUBLISH_ENABLED !== "true" ||
      process.env.OWNER_APPROVED_SHA !== manifest.sha ||
      values["expected-sha"] !== manifest.sha
    )
      throw new Error("Manca il via Production sul commit atteso.");
    productionReadiness(readFileSync("BACKLOG.md", "utf8"));
  }
  const wrangler = (...args) =>
    execFileSync("pnpm", ["exec", "wrangler", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  const config = JSON.parse(readFileSync("build/server/wrangler.json", "utf8"));
  const database = config.d1_databases.find(({ binding }) => binding === "DB");
  const currentVersion = async () => {
    const status = JSON.parse(wrangler("deployments", "status", "--name", target.worker, "--json"));
    const version = status.versions.find(({ percentage }) => percentage === 100)?.version_id;
    if (!version) throw new Error("Deployment non interamente assegnato a una versione.");
    const metadata = JSON.parse(
      wrangler("versions", "view", version, "--name", target.worker, "--json"),
    );
    return { version, identity: metadata.annotations?.["workers/message"] };
  };
  const liveReadback = async (version) => {
    for (const pathname of ["/", "/en", "/api/auth/get-session"]) {
      const response = await fetch(`${target.origin}${pathname}`, {
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok || response.headers.get("x-fiscalbay-version") !== version)
        throw new Error(`Readback della versione non riuscito: ${pathname}.`);
      if (pathname === "/api/auth/get-session" && (await response.json()) !== null)
        throw new Error("Risposta anonima Auth non valida.");
    }
  };
  const query = async (sql, params = []) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${database.database_id}/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.success || body.result.some(({ success }) => !success))
      throw new Error("Readback D1 non riuscito.");
    return body.result[0].results;
  };
  const applied = async () => {
    const tables = await query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'",
    );
    return tables.length
      ? (await query("SELECT name FROM d1_migrations ORDER BY id")).map(({ name }) => name)
      : [];
  };
  const receiptFile = "reports/release.json";
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : {};
  if (command === "rollback") {
    assertResume(Object.keys(receipt).length ? receipt : null, manifest);
    if (!receipt.deployed || !receipt.previous) return;
    if (!receipt.rollbackCompatible)
      throw new Error(
        "Rollback automatico escluso: schema modificato, serve forward-fix o compatibilità qualificata.",
      );
    const current = JSON.parse(
      wrangler("deployments", "status", "--name", target.worker, "--json"),
    );
    if (current.versions.length !== 1 || current.versions[0].version_id !== receipt.version)
      throw new Error("Stato remoto cambiato: rollback rifiutato.");
    wrangler(
      "rollback",
      receipt.previous,
      "--name",
      target.worker,
      "--message",
      "Collaudo non superato",
      "--yes",
    );
    const after = JSON.parse(wrangler("deployments", "status", "--name", target.worker, "--json"));
    if (after.versions[0]?.version_id !== receipt.previous || after.versions[0]?.percentage !== 100)
      throw new Error("Rollback non confermato.");
    await liveReadback(receipt.previous);
    writeFileSync(receiptFile, JSON.stringify({ ...receipt, rolledBack: true }, null, 2));
    return;
  }
  const state = await publish(
    manifest,
    {
      assertCurrent: async () => {
        const remote = git("ls-remote", "origin", `refs/heads/${target.ref}`).split(/\s/u)[0];
        if (remote !== manifest.sha)
          throw new Error("Candidato superato: il branch remoto è avanzato.");
      },
      preflight: async () => {
        if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
          throw new Error("Accesso provider non configurato.");
        const bindings = JSON.parse(wrangler("secret", "list", "--name", target.worker));
        if (
          config.secrets.required.some((name) => !bindings.some((binding) => binding.name === name))
        )
          throw new Error("Segreti runtime richiesti assenti.");
      },
      migrations: async () => {
        const names = await applied();
        const previousSha = (await currentVersion()).identity?.split(":")[0];
        if (/^[0-9a-f]{40}$/u.test(previousSha ?? "") && previousSha !== manifest.sha) {
          const previous = names.map((name) => ({
            name,
            digest: hash(execFileSync("git", ["show", `${previousSha}:migrations/${name}`])),
          }));
          assertAppliedMigrations(manifest.migrations, previous, names);
        }
        return migrationPlan(
          manifest.migrations.map((entry) => ({
            ...entry,
            sql: readFileSync(`migrations/${entry.name}`, "utf8"),
          })),
          names,
          values["reviewed-migrations"],
        );
      },
      migrate: async () => {
        wrangler(
          "d1",
          "migrations",
          "apply",
          database.database_name,
          "--remote",
          "--config",
          "build/server/wrangler.json",
        );
      },
      schema: async () => {
        const names = await applied();
        if (manifest.migrations.some(({ name }) => !names.includes(name)))
          throw new Error("Migration non applicate.");
        // D1 espone i nomi applicati, non l'hash SQL: non attribuire al remoto i digest locali.
        return names.map((name) => ({ name }));
      },
      current: currentVersion,
      deploy: async (identity) => {
        wrangler(
          "deploy",
          "--config",
          "build/server/wrangler.json",
          "--strict",
          "--tag",
          manifest.sha.slice(0, 12),
          "--message",
          identity,
        );
      },
      canRollback: async (current) => {
        const previousSha = current.identity?.split(":")[0];
        if (!/^[0-9a-f]{40}$/u.test(previousSha ?? "")) return false;
        try {
          git(
            "diff",
            "--exit-code",
            previousSha,
            manifest.sha,
            "--",
            "migrations",
            "wrangler.jsonc",
          );
          return true;
        } catch {
          return false;
        }
      },
      readback: liveReadback,
      save: async (state) => {
        mkdirSync("reports", { recursive: true });
        writeFileSync(receiptFile, JSON.stringify(state, null, 2));
      },
    },
    receipt,
  );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `deployed=true\nversion=${state.version}\nrollback-compatible=${state.rollbackCompatible === true}\nprevious=${state.previous || ""}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### Distribuzione e readback\n\nCommit ${state.sha}; tree ${state.tree}; SHA256 ${state.digest}; versione ${state.version}; schema ${state.schema.length} migration. Collaudo browser nel passo successivo.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
