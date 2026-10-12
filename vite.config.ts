import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

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

// La preview serve soltanto la Build Output, anche da un'altra cartella: niente plugin di build.
export default defineConfig(({ isPreview }) => ({
  plugins: [
    // Stato locale unico anche per la preview.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: { path: path.resolve(import.meta.dirname, ".cloudflare/state") },
    }),
    ...(isPreview ? [] : [tailwindcss(), reactRouter(), linkClientAssets()]),
  ],
  environments: { ssr: { build: { sourcemap: true } } },
  resolve: {
    tsconfigPaths: true,
  },
}));
