import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Progetto a sé dentro la repository: la radice è questa cartella, con la sua Build Output.
export default defineConfig({ root: import.meta.dirname, plugins: [cloudflare()] });
