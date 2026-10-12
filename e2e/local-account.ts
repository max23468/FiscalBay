import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { applyLocalMigrations } from "../scripts/local-d1.mjs";
import type { PageRole } from "./page-cases";

export const localSecret = "fiscalbay-e2e-secret-at-least-32-bytes";
export const localPassword = "fiscalbay-local-synthetic-password-only";
export const localPort = process.env.E2E_PORT || "5186";
// WebAuthn richiede un dominio come RP ID: un indirizzo IP non è valido.
export const localOrigin = `http://localhost:${localPort}`;

/** Unicamente locale: nessun flag remote e nessuna sessione privilegiata sul dominio test. */
export async function seedLocalAccount() {
  applyLocalMigrations();
  execFileSync(process.execPath, ["scripts/reset-test-account.mjs", "--local", "--sessions"], {
    env: { ...process.env, E2E_ACCOUNT_PASSWORD: localPassword },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

export function localCookie(role: PageRole, baseURL: string) {
  const token = `pages-${role}`;
  return {
    name: `${new URL(baseURL).protocol === "https:" ? "__Secure-" : ""}better-auth.session_token`,
    value: encodeURIComponent(
      `${token}.${createHmac("sha256", localSecret).update(token).digest("base64")}`,
    ),
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}
