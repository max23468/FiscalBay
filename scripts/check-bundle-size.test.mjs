import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import { budgetKiB } from "./check-bundle-size.mjs";

describe("budget del JavaScript client", () => {
  // KiB di ogni file della build sintetica; `lazy` non è nel manifest, come un import dinamico,
  // mentre i testi di una lingua (`copy-it`) si scaricano prima dell'idratazione.
  const run = ({ entry = 10, site = 10, orders = 10, area = 0, lazy = 0, copy = 0 }) => {
    const directory = mkdtempSync(path.join(tmpdir(), "bundle-"));
    mkdirSync(path.join(directory, "assets"));
    // Byte casuali: gzip non li comprime, quindi la dimensione misurata è nota.
    for (const [name, kib] of Object.entries({
      entry,
      site,
      orders,
      area,
      lazy,
      "copy-it-a1": copy,
    }))
      writeFileSync(path.join(directory, "assets", `${name}.js`), randomBytes(kib * 1024));
    const route = (id, routePath, parentId, module) => ({
      id,
      path: routePath,
      parentId,
      hasDefaultExport: true,
      module,
      imports: [],
    });
    const manifest = {
      entry: { module: "/assets/entry.js", imports: [] },
      routes: {
        root: { ...route("root", "", undefined, "/assets/entry.js"), parentId: undefined },
        site: { ...route("site", undefined, "root", "/assets/site.js"), index: true },
        // Layout senza percorso dell'area: pesa negli Ordini, non come pagina pubblica.
        area: route("area", undefined, "root", "/assets/area.js"),
        orders: route("orders", "en/app/ordini/:ordine?", "area", "/assets/orders.js"),
      },
    };
    writeFileSync(
      path.join(directory, "assets", "manifest-abc.js"),
      `window.__reactRouterManifest=${JSON.stringify(manifest)};`,
    );
    return spawnSync(process.execPath, ["scripts/check-bundle-size.mjs", directory]).status;
  };

  it("accetta pagine entro le soglie della loro classe", () =>
    assert.equal(
      run({ entry: 100, site: budgetKiB.public - 110, orders: budgetKiB.app - 110 }),
      0,
    ));
  it("fa fallire una pagina pubblica oltre la sua soglia", () =>
    assert.equal(run({ entry: 100, site: budgetKiB.public - 90 }), 1));
  it("fa fallire una pagina riservata oltre la sua soglia", () =>
    assert.equal(run({ entry: 100, orders: budgetKiB.app - 90 }), 1));
  it("conta una layout senza percorso nelle sue pagine, con la loro soglia", () => {
    assert.equal(run({ entry: 100, area: budgetKiB.public - 90 }), 0);
    assert.equal(run({ entry: 100, area: budgetKiB.app - 120, orders: 30 }), 1);
  });
  it("ignora per il budget i file caricati dopo e il totale della build", () =>
    assert.equal(run({ entry: 100, lazy: budgetKiB.app + 10 }), 0));
  it("conta i testi della lingua più pesante, scaricati prima dell'idratazione", () =>
    assert.equal(run({ entry: 100, orders: budgetKiB.app - 110, copy: 20 }), 1));
  it("fallisce senza manifest", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "bundle-"));
    writeFileSync(path.join(directory, "entry.js"), randomBytes(1024));
    assert.equal(
      spawnSync(process.execPath, ["scripts/check-bundle-size.mjs", directory]).status,
      1,
    );
  });
});
