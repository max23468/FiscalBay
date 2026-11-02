/** Ricevute del provider: il colore di una run non identifica la versione attiva. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gh, ghJson } from "../lib/provider.mjs";

/** Identità osservata, con SHA e digest dell'artefatto registrati da Cloudflare. */
export function observedRelease(current, schema) {
  const match = /^([a-f0-9]{40}):([a-f0-9]{32})$/u.exec(current?.identity ?? "");
  if (!match || !current.version) throw new Error("Versione provider senza provenienza valida.");
  return {
    version: current.version,
    sha: match[1],
    identity: current.identity,
    identityDigest: match[2],
    ...(schema ? { schema } : {}),
  };
}

/** Lettura anonima sul dominio reale, senza dipendere dai permessi Cloudflare della sessione. */
export async function publicVersion(origin, read = fetch) {
  const response = await read(`${origin}/api/auth/get-session`, {
    headers: { "cache-control": "no-cache" },
    signal: AbortSignal.timeout(20_000),
  });
  const version = response.headers.get("x-fiscalbay-version");
  if (!response.ok || !/^[a-f0-9-]{36}$/u.test(version ?? ""))
    throw new Error("Versione attiva non confermata dal dominio reale.");
  return version;
}

export function receiptActive(receipt, version) {
  if (receipt?.environment !== "production") return undefined;
  if (receipt.active?.version === version) {
    const active = observedRelease(receipt.active, receipt.active.schema);
    if (active.sha !== receipt.active.sha) throw new Error("Ricevuta provider incoerente.");
    return active;
  }
  // Ricevute anteriori all'introduzione della riconciliazione finale: sempre legate al readback.
  if (
    receipt.version === version &&
    receipt.readback &&
    !receipt.rolledBack &&
    /^[a-f0-9]{40}$/u.test(receipt.sha ?? "") &&
    /^[a-f0-9]{64}$/u.test(receipt.digest ?? "")
  )
    return observedRelease(
      { version, identity: `${receipt.sha}:${receipt.digest.slice(0, 32)}` },
      receipt.schema,
    );
  return undefined;
}

export function downloadRecord(repository, artifact) {
  const directory = mkdtempSync(path.join(tmpdir(), "publication-record-"));
  try {
    gh(
      "run",
      "download",
      String(artifact.workflow_run.id),
      "--repo",
      repository,
      "--name",
      artifact.name,
      "--dir",
      directory,
    );
    const file = path.join(directory, "release.json");
    return JSON.parse(
      readFileSync(existsSync(file) ? file : path.join(directory, "reports/release.json"), "utf8"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Cerca anche nelle run fallite: un ritiro o un errore nel giorno non cancella il readback. */
export function publicationRecord(
  repository,
  version,
  api = (url) => ghJson("api", url),
  download = downloadRecord,
) {
  const repositoryId = api(`repos/${repository}`).id;
  const valid = (artifact) =>
    !artifact.expired &&
    artifact.workflow_run?.repository_id === repositoryId &&
    artifact.workflow_run.head_repository_id === repositoryId;
  const named = api(
    `repos/${repository}/actions/artifacts?name=production-state-${version}&per_page=20`,
  ).artifacts;
  const inspect = (artifact, knownRun) => {
    if (!valid(artifact)) return undefined;
    const run = knownRun ?? api(`repos/${repository}/actions/runs/${artifact.workflow_run.id}`);
    if (
      ![".github/workflows/publish.yml", ".github/workflows/rollback.yml"].includes(run.path) ||
      run.head_branch !== "main"
    )
      return undefined;
    const receipt = download(repository, artifact);
    const active = receiptActive(receipt, version);
    return active ? { ...receipt, active, artifact: artifact.id, run: run.id } : undefined;
  };
  for (const artifact of named.sort((a, b) => b.id - a.id)) {
    const record = inspect(artifact);
    if (record) return record;
  }
  // La prima adozione deve poter leggere le ricevute del processo precedente, senza un deploy.
  {
    const runs = api(
      `repos/${repository}/actions/workflows/publish.yml/runs?branch=main&per_page=50`,
    ).workflow_runs;
    for (const run of runs) {
      const artifacts = api(
        `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
      ).artifacts;
      for (const artifact of artifacts
        .filter((entry) => entry.name.startsWith("release-receipt-"))
        .sort((a, b) => b.id - a.id)) {
        const record = inspect(
          {
            ...artifact,
            workflow_run: artifact.workflow_run ?? {
              id: run.id,
              repository_id: repositoryId,
              head_repository_id: run.head_repository?.id,
            },
          },
          run,
        );
        if (record) return record;
      }
    }
  }
  throw new Error("Nessuna ricevuta valida per la versione realmente attiva.");
}
