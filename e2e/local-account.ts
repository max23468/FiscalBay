import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import type { PageRole } from "./page-cases";

export const localSecret = "fiscalbay-e2e-secret-at-least-32-bytes";
export const localPassword = "fiscalbay-local-synthetic-password-only";
export const localPort = process.env.E2E_PORT || "5186";

/** Unicamente locale: nessun flag remote e nessuna sessione privilegiata sul dominio test. */
export async function seedLocalAccount() {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "migrations", "apply", "fiscalbay-test", "--local"],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync(process.execPath, ["scripts/reset-test-account.mjs", "--local", "--sessions"], {
    env: { ...process.env, E2E_ACCOUNT_PASSWORD: localPassword },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

export function localCookie(role: PageRole, baseURL: string) {
  const token = `pages-${role}`;
  return {
    name: "__Secure-better-auth.session_token",
    value: encodeURIComponent(
      `${token}.${createHmac("sha256", localSecret).update(token).digest("base64")}`,
    ),
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}
