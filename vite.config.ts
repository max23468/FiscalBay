import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import {
  formatNotices,
  noticesFile,
  packageRoot,
  readPackage,
  type NoticePackage,
} from "./scripts/third-party-notices.mjs";

/**
 * Adattamento temporaneo, da rimuovere quando il plugin Cloudflare 2.x e React Router
 * concordano sulla cartella client. Il plugin scrive gli asset nella Build Output
 * (`.cloudflare/output/.../assets`), mentre React Router legge e scrive manifest e asset
 * in `build/client`: il collegamento fa coincidere le due cartelle.
 */
const linkClientAssets = (): Plugin => ({
  name: "link-client-assets",
  apply: "build",
  applyToEnvironment: (environment) => environment.name === "client",
  buildStart() {
    const { root, build } = this.environment.config;
    rmSync(path.resolve(root, "build/client"), { recursive: true, force: true });
    mkdirSync(path.resolve(root, "build"), { recursive: true });
    symlinkSync(path.resolve(root, build.outDir), path.resolve(root, "build/client"), "dir");
  },
});

/**
 * Avvisi delle licenze dei pacchetti che il browser riceve, ricavati da moduli e asset della
 * build client e scritti accanto agli asset.
 */
const thirdPartyNotices = (): Plugin => ({
  name: "third-party-notices",
  apply: "build",
  applyToEnvironment: (environment) => environment.name === "client",
  generateBundle(_options, bundle) {
    const roots = new Set<string>();
    // Gli asset, come i font, riportano il percorso d'origine relativo alla radice del progetto.
    const { root } = this.environment.config;
    for (const output of Object.values(bundle))
      for (const file of output.type === "chunk" ? output.moduleIds : output.originalFileNames) {
        const found = packageRoot(path.resolve(root, file.replace(/^\0/u, "")));
        if (found && existsSync(path.join(found, "package.json"))) roots.add(found);
      }
    const packages = new Map<string, NoticePackage>();
    for (const found of roots) {
      const notice = readPackage(found);
      packages.set(`${notice.name}@${notice.version}`, notice);
    }
    if (packages.size === 0) this.error("Nessun pacchetto di terze parti nella build client.");
    this.emitFile({
      type: "asset",
      fileName: noticesFile,
      source: formatNotices(packages.values()),
    });
  },
});

// La preview serve soltanto la Build Output, anche da un'altra cartella: niente plugin di build.
export default defineConfig(({ isPreview }) => ({
  plugins: [
    // Stato locale unico anche per la preview.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: { path: path.resolve(import.meta.dirname, ".cloudflare/state") },
    }),
    ...(isPreview ? [] : [tailwindcss(), reactRouter(), linkClientAssets(), thirdPartyNotices()]),
  ],
  environments: { ssr: { build: { sourcemap: true } } },
  resolve: {
    tsconfigPaths: true,
  },
}));
