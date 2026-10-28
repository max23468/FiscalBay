import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { formatNotices, packageRoot, readPackage } from "./third-party-notices.mjs";

describe("avvisi delle licenze di terze parti", () => {
  it("ricava la cartella del pacchetto, anche con scope e nella struttura di pnpm", () => {
    assert.equal(
      packageRoot("/p/node_modules/.pnpm/react@19/node_modules/react/cjs/react.js"),
      "/p/node_modules/.pnpm/react@19/node_modules/react",
    );
    assert.equal(
      packageRoot("/p/node_modules/@base-ui/react/esm/index.js?v=1"),
      "/p/node_modules/@base-ui/react",
    );
    assert.equal(packageRoot("/p/app/root.tsx"), null);
    assert.equal(packageRoot("/p/node_modules/@scope"), null);
  });

  it("riporta licenza dichiarata e testi del pacchetto, o ne segnala l'assenza", () => {
    const root = mkdtempSync(path.join(tmpdir(), "notices-"));
    const withText = path.join(root, "con-testo");
    const without = path.join(root, "senza-testo");
    for (const directory of [withText, without]) mkdirSync(directory);
    writeFileSync(
      path.join(withText, "package.json"),
      JSON.stringify({ name: "zeta", version: "1.0.0", license: "MIT" }),
    );
    writeFileSync(path.join(withText, "LICENSE.md"), "Copyright (c) Zeta\n");
    writeFileSync(path.join(withText, "README.md"), "non è una licenza");
    writeFileSync(
      path.join(without, "package.json"),
      JSON.stringify({ name: "alfa", version: "2.0.0" }),
    );
    const zeta = readPackage(withText);
    assert.deepEqual(zeta, {
      name: "zeta",
      version: "1.0.0",
      license: "MIT",
      texts: ["Copyright (c) Zeta"],
    });
    const notices = formatNotices([zeta, readPackage(without)]);
    assert.ok(notices.indexOf("alfa 2.0.0") < notices.indexOf("zeta 1.0.0"));
    assert.match(notices, /Licenza: non dichiarata\n\nIl pacchetto non include il testo/u);
    assert.match(notices, /Licenza: MIT\n\nCopyright \(c\) Zeta/u);
    assert.doesNotMatch(notices, /non è una licenza/u);
  });
});
