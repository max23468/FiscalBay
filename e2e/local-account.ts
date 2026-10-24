import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
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

export function localCookie(role: PageRole, baseURL: string, token = `pages-${role}`) {
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

/** Sessioni sintetiche locali: WebKit Linux non conserva cookie Secure su HTTP. */
export async function useLocalAccount(
  context: BrowserContext,
  role: PageRole,
  baseURL: string,
  token?: string,
) {
  if (process.env.E2E_BASE_URL)
    throw new Error("Sessione sintetica soltanto in locale: la prova non vale sul dominio remoto.");
  const cookie = localCookie(role, baseURL, token);
  await context.addCookies([cookie]);
  const origin = new URL(baseURL).origin;
  const jar = new Map<string, string>([[cookie.name, cookie.value]]);
  // Cookie che passano dal proxy: il browser potrebbe conservarne una copia già eliminata.
  const managed = new Set(jar.keys());
  // Il report delle misure non usa la sessione e Playwright con WebKit non inoltra il corpo
  // dei beacon intercettati: resta fuori dall'instradamento.
  await context.route(
    (url) =>
      url.origin === origin &&
      !url.pathname.startsWith("/assets/") &&
      url.pathname !== "/api/v1/page-timing",
    async (route) => {
      const request = route.request();
      // I cookie scritti dalla pagina, come il fuso del dispositivo, restano accanto alla sessione.
      const cookies = new Map(
        (await context.cookies(request.url()))
          .filter(({ name }) => !managed.has(name))
          .map(({ name, value }) => [name, value] as const),
      );
      for (const [name, value] of jar) cookies.set(name, value);
      const response = await route.fetch({
        headers: {
          ...request.headers(),
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
        },
        maxRedirects: 0,
      });
      for (const { name, value } of response.headersArray()) {
        if (name.toLowerCase() !== "set-cookie") continue;
        const [pair = ""] = value.split(";");
        const [key = "", ...rest] = pair.split("=");
        managed.add(key.trim());
        if (/max-age=0/iu.test(value)) jar.delete(key.trim());
        else jar.set(key.trim(), rest.join("="));
      }
      const location = response.headers().location;
      if (!location || !request.isNavigationRequest()) return route.fulfill({ response });
      // Ogni redirect del documento ripassa dal proxy e conserva la sessione sintetica.
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/html" },
        body: `<script>location.replace(${JSON.stringify(location)})</script>`,
      });
    },
  );
}
