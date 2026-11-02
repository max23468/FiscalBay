import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  cf,
  cfJson,
  d1Query,
  gh,
  ghJson,
  jsonOutput,
  keychain,
  modeOf,
  retry,
  withBodyFile,
} from "./provider.mjs";

describe("uscita JSON della CLI", () => {
  it("salta il preambolo, anche con parentesi, e toglie l'involucro result", () => {
    assert.deepEqual(jsonOutput('[avviso] versione {nuova}\n{"result":[{"id":1}]}\n'), [{ id: 1 }]);
    assert.deepEqual(jsonOutput("Esecuzione...\n[1, 2]"), [1, 2]);
    assert.deepEqual(jsonOutput('{"data":[],"rows":0}'), { data: [], rows: 0 });
  });

  it("restituisce null senza JSON e fallisce su un documento troncato", () => {
    assert.equal(jsonOutput("Segreto eliminato.\n"), null);
    assert.throws(() => jsonOutput('{"result": ['), /non leggibile/u);
  });
});

describe("modalità degli script", () => {
  it("accetta test e live, con il valore predefinito soltanto se dichiarato", () => {
    assert.equal(modeOf("live"), "live");
    assert.equal(modeOf(undefined, "test"), "test");
    assert.throws(() => modeOf(undefined), /--mode accetta/u);
    assert.throws(() => modeOf("Live", "test"), /--mode accetta/u);
  });
});

describe("corpo della CLI in un file", () => {
  it("passa il file con il prefisso @ e lo rimuove", () => {
    let seen;
    const output = withBodyFile(
      { a: 1 },
      (reference) => {
        seen = reference.slice(1);
        return readFileSync(seen, "utf8");
      },
      "prova",
    );
    assert.equal(output, '{"a":1}');
    assert.throws(() => readFileSync(seen));
  });
});

describe("ripetizione", () => {
  it("ripete fino al successo con l'attesa del tentativo", async () => {
    const delays = [];
    let calls = 0;
    const value = await retry(
      () => {
        if (++calls < 3) throw new Error("instabile");
        return "ok";
      },
      { attempts: 3, delay: (attempt) => (delays.push(attempt), 0) },
    );
    assert.equal(value, "ok");
    assert.deepEqual(delays, [1, 2]);
  });

  it("propaga l'ultimo errore dopo i tentativi", async () => {
    let calls = 0;
    await assert.rejects(
      retry(
        () => {
          throw new Error(`errore ${++calls}`);
        },
        { attempts: 2, delay: () => 0 },
      ),
      /errore 2/u,
    );
  });
});

describe("D1 remota", () => {
  const ok = (rows) => ({ success: true, results: rows });

  it("unisce le istruzioni e restituisce le righe di ognuna", async () => {
    const calls = [];
    const rows = await d1Query("db", ["SELECT 1", "SELECT 2"], {
      ci: true,
      query: (args, options) => {
        calls.push({ args, options });
        return [ok([{ n: 1 }]), ok([{ n: 2 }])];
      },
    });
    assert.deepEqual(rows, [[{ n: 1 }], [{ n: 2 }]]);
    assert.deepEqual(calls, [
      { args: ["d1", "query", "db", "--sql", "SELECT 1;\nSELECT 2"], options: { ci: true } },
    ]);
  });

  it("ripete una risposta incompleta e poi fallisce", async () => {
    const responses = [[ok([])], [ok([]), { success: false }], null];
    await assert.rejects(
      d1Query("db", ["SELECT 1", "SELECT 2"], { delay: () => 0, query: () => responses.shift() }),
      /incompleta/u,
    );
    assert.equal(responses.length, 0);
  });

  it("accetta un testo con più istruzioni senza contarle", async () => {
    const rows = await d1Query("db", "SELECT 1; SELECT 2", {
      query: () => [ok([]), ok([{ n: 2 }])],
    });
    assert.deepEqual(rows, [[], [{ n: 2 }]]);
  });
});

describe("comandi esterni", () => {
  let directory;
  let previousPath;
  // Ogni comando finto stampa argomenti e `CI` in JSON, preceduti da una riga di avanzamento.
  const fake = (name, body) =>
    writeFileSync(path.join(directory, name), `#!/bin/sh\n${body}\n`, { mode: 0o700 });

  before(() => {
    directory = mkdtempSync(path.join(tmpdir(), "provider-"));
    fake(
      "pnpm",
      `echo "Avvio"; node -e 'console.log(JSON.stringify({ result: { args: process.argv.slice(1), ci: process.env.CI ?? null } }))' -- "$@"`,
    );
    fake("gh", `node -e 'console.log(JSON.stringify(process.argv.slice(1)))' -- "$@"`);
    fake(
      "security",
      `[ "$1 $2 $3 $4" = "find-generic-password -s voce -w" ] && printf 'segreto\\n' || exit 44`,
    );
    previousPath = process.env.PATH;
    process.env.PATH = `${directory}:${previousPath}`;
  });

  after(() => {
    process.env.PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  });

  it("esegue cf alla versione del progetto, con CI soltanto se richiesto", () => {
    const previous = process.env.CI;
    delete process.env.CI;
    try {
      assert.deepEqual(cfJson(["d1", "list"]), { args: ["exec", "cf", "d1", "list"], ci: null });
      assert.equal(cfJson(["d1", "list"], { ci: true }).ci, "true");
      assert.equal(cf(["d1", "raw"], { stdout: "ignore" }), null);
      assert.ok(Buffer.isBuffer(cf(["r2"], { encoding: "buffer" })));
    } finally {
      if (previous !== undefined) process.env.CI = previous;
    }
  });

  it("legge gh e il Portachiavi", () => {
    assert.deepEqual(ghJson("api", "repos/o/r"), ["api", "repos/o/r"]);
    assert.equal(gh("run", "list"), '["run","list"]');
    assert.equal(keychain("voce"), "segreto");
    assert.throws(() => keychain("assente"));
  });

  it("ripete letture GitHub temporaneamente fallite, senza duplicare un dispatch", () => {
    const counter = path.join(directory, "counter");
    writeFileSync(
      path.join(directory, "gh"),
      `#!${process.execPath}\nconst fs=require('node:fs');
const file=${JSON.stringify(counter)};const count=fs.existsSync(file)?Number(fs.readFileSync(file))+1:1;
fs.writeFileSync(file,String(count));if(count<=2){process.stderr.write('gh: Bad Gateway (HTTP 502)');process.exit(1);}process.stdout.write('ok');`,
      { mode: 0o700 },
    );
    try {
      assert.equal(gh("api", "repos/example/project"), "ok");
      assert.equal(readFileSync(counter, "utf8"), "3");
      writeFileSync(counter, "0");
      assert.throws(() => gh("workflow", "run", "publish.yml"), /Command failed/u);
      assert.equal(readFileSync(counter, "utf8"), "1");
    } finally {
      fake("gh", `node -e 'console.log(JSON.stringify(process.argv.slice(1)))' -- "$@"`);
    }
  });
});
