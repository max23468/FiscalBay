import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import type { APIResponse, BrowserContext } from "@playwright/test";
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
      const cookie = async (url: string) => {
        const cookies = new Map(
          (await context.cookies(url))
            .filter(({ name }) => !managed.has(name))
            .map(({ name, value }) => [name, value] as const),
        );
        for (const [name, value] of jar) cookies.set(name, value);
        return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      };
      const remember = (response: APIResponse) => {
        for (const { name, value } of response.headersArray()) {
          if (name.toLowerCase() !== "set-cookie") continue;
          const [pair = ""] = value.split(";");
          const [key = "", ...rest] = pair.split("=");
          managed.add(key.trim());
          if (/max-age=0/iu.test(value)) jar.delete(key.trim());
          else jar.set(key.trim(), rest.join("="));
        }
      };
      let response = await route.fetch({
        headers: { ...request.headers(), cookie: await cookie(request.url()) },
        maxRedirects: 0,
      });
      remember(response);
      // WebKit non accetta un redirect per una richiesta della pagina, come il file creato che
      // rimanda al download: il proxy lo segue con la stessa sessione, come farebbe il browser.
      for (let hop = 0; hop < 5 && !request.isNavigationRequest(); hop++) {
        const next = response.headers().location;
        if (!next) break;
        const url = new URL(next, request.url()).href;
        const { "content-type": _type, "content-length": _length, ...headers } = request.headers();
        response = await context.request.get(url, {
          headers: { ...headers, cookie: await cookie(url) },
          maxRedirects: 0,
        });
        remember(response);
      }
      // Una ricarica o una nuova pagina chiude la richiesta mentre il proxy la serve: la
      // risposta in ritardo non ha più destinatario.
      const fulfill = (options: Parameters<typeof route.fulfill>[0]) =>
        route.fulfill(options).catch((error: unknown) => {
          if (!/Route is already handled/u.test(String(error))) throw error;
        });
      const location = response.headers().location;
      if (!location || !request.isNavigationRequest()) return fulfill({ response });
      // Ogni redirect del documento ripassa dal proxy e conserva la sessione sintetica.
      return fulfill({
        status: 200,
        headers: { "content-type": "text/html" },
        body: `<script>location.replace(${JSON.stringify(location)})</script>`,
      });
    },
  );
}
