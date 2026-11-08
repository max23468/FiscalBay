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
  unpermittedLicenses,
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
    const unpermitted = unpermittedLicenses(packages.values());
    if (unpermitted.length)
      this.error(`Licenze non permissive nella build client: ${unpermitted.join(", ")}.`);
    this.emitFile({
      type: "asset",
      fileName: noticesFile,
      source: formatNotices(packages.values()),
    });
  },
});

/**
 * Moduli dei testi di ogni lingua, con i loro import statici, dalla build del client al bundle
 * del server: il documento li precarica (`copyModules` in `app/app-copy.ts`). Il client si costruisce per
 * primo; un nome mancante ferma la build invece di togliere il precaricamento in silenzio.
 */
const preloadCopyModules = (): Plugin => {
  let modules: Record<string, string[]> | undefined;
  return {
    name: "preload-copy-modules",
    apply: "build",
    sharedDuringBuild: true,
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const chunks = Object.values(bundle).flatMap((item) => (item.type === "chunk" ? [item] : []));
      const files = (fileName: string, seen = new Set<string>()) => {
        if (seen.has(fileName)) return seen;
        seen.add(fileName);
        for (const target of chunks.find((chunk) => chunk.fileName === fileName)?.imports ?? [])
          files(target, seen);
        return seen;
      };
      modules = Object.fromEntries(
        ["it", "en"].map((language) => {
          const entry = chunks.find((chunk) =>
            chunk.facadeModuleId?.endsWith(`/app/copy/copy-${language}.ts`),
          );
          if (!entry) this.error(`Modulo dei testi assente dalla build: ${language}.`);
          return [language, [...files(entry.fileName)].map((file) => `/${file}`)];
        }),
      );
    },
    transform(code, id) {
      if (this.environment.name === "client" || !id.endsWith("/app/app-copy.ts")) return;
      if (!modules) this.error("Build del server partita prima di quella del client.");
      // Il codice arriva già compilato: spazi e a capo non sono quelli del sorgente.
      const empty = /copyModules\s*=\s*\{\s*it:\s*\[\],\s*en:\s*\[\]\s*\}/u;
      if (!empty.test(code)) this.error("Valore dei moduli dei testi non trovato.");
      return code.replace(empty, `copyModules = ${JSON.stringify(modules)}`);
    },
  };
};

// La preview serve soltanto la Build Output, anche da un'altra cartella: niente plugin di build.
export default defineConfig(({ isPreview }) => ({
  plugins: [
    // Stato locale unico anche per la preview.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: { path: path.resolve(import.meta.dirname, ".cloudflare/state") },
    }),
    ...(isPreview
      ? []
      : [
          tailwindcss(),
          reactRouter(),
          linkClientAssets(),
          thirdPartyNotices(),
          preloadCopyModules(),
        ]),
  ],
  environments: { ssr: { build: { sourcemap: true } } },
  resolve: {
    tsconfigPaths: true,
  },
}));
