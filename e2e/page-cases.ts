import { testAccount } from "./test-account.ts";

/** Scenari delle route esistenti: le azioni esterne non vengono inviate dal collaudo. */
export type PageRole = "anonymous" | "member" | "admin-verify" | "admin-granted";
export interface PageCase {
  pattern: string;
  path: string;
  area: string;
  role: PageRole;
  status: number;
  redirect?: string;
  preview?: boolean;
  endpoint?: boolean;
}

export function knownPagePath(pathname: string) {
  return pageCases.some(({ pattern }) => {
    if (pattern === "*") return false;
    const expression = pattern
      .split("/")
      .map((segment, index) => {
        if (!segment) return "";
        const slash = index ? "/" : "";
        if (segment.startsWith(":"))
          return segment.endsWith("?") ? `(?:${slash}[^/]+)?` : `${slash}[^/]+`;
        if (segment === "*") return `${slash}.*`;
        return slash + segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      })
      .join("");
    return new RegExp(`^${expression || "/"}$`, "u").test(pathname);
  });
}

const settings = [
  "piano",
  "notifiche",
  "esportazione",
  "sicurezza",
  "aspetto",
  "messaggio",
  "privacy",
  "supporto",
];
export const pageCases: PageCase[] = ["", "/en"].flatMap((prefix) => {
  const make = (path: string, area: string, options: Partial<PageCase> = {}): PageCase => ({
    pattern: `${prefix}${path}` || "/",
    path: `${prefix}${path}` || "/",
    area,
    role: "anonymous",
    status: 200,
    ...options,
  });
  const home = prefix || "/";
  const access = `${prefix}/accesso`;
  const orders = `${prefix}/app/ordini`;
  const preview = (path: string, area: string, options: Partial<PageCase> = {}) =>
    make(`/anteprima${path}`, area, { preview: true, ...options });
  return [
    make("", "public"),
    // Con la sessione la radice porta agli Ordini, salvo la scelta di visitare il sito.
    make("", "public", { role: "member", redirect: orders }),
    make("?visita=1", "public", { role: "member", pattern: home, redirect: home }),
    make("/accesso", "auth"),
    make("/accesso?token=synthetic-reset-token", "auth", { pattern: access }),
    make("/accesso", "auth", { role: "member", redirect: orders }),
    make("/app/ordini", "orders", { redirect: access }),
    make("/app/ordini", "orders", { role: "member" }),
    make("/auth/error", "auth"),
    ...["email_not_found", "account_not_linked", "account_already_linked_to_different_user"].map(
      (error) =>
        make(`/auth/error?error=${error}&provider=ebay`, "auth", {
          pattern: `${prefix}/auth/error`,
        }),
    ),
    make("/termini", "public"),
    make("/privacy", "public"),
    make("/app/negozi/collega", "stores", { redirect: access }),
    make("/app/negozi/collega", "stores", { role: "member" }),
    make("/app/negozi/collega?ricollega", "stores", {
      role: "member",
      pattern: `${prefix}/app/negozi/collega`,
    }),
    make("/app/negozi", "stores", { pattern: `${prefix}/app/negozi/:negozio?`, redirect: access }),
    // Un negozio inesistente o di un altro spazio risponde 404 dentro la shell.
    ...["", `/${testAccount.stores.active}`, "/non-esiste"].map((suffix) =>
      make(`/app/negozi${suffix}`, "stores", {
        role: "member",
        pattern: `${prefix}/app/negozi/:negozio?`,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    make("/app/profilo", "profile", { redirect: access }),
    make("/app/profilo", "profile", { role: "member" }),
    make("/app/impostazioni/sicurezza", "auth", { redirect: access }),
    make("/app/impostazioni/sicurezza", "auth", { role: "member" }),
    make("/admin", "auth", { status: 404 }),
    make("/admin", "auth", { role: "member", status: 404 }),
    make("/admin", "auth", { role: "admin-verify" }),
    make("/admin", "auth", { role: "admin-granted" }),
    preview("", "orders", { redirect: `${prefix}/anteprima/ordini` }),
    ...["", "/ord-02", "/non-esiste"].map((suffix) =>
      preview(`/ordini${suffix}`, "orders", {
        pattern: `${prefix}/anteprima/ordini/:ordine?`,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    ...["", "/neg-vintage", "/non-esiste"].map((suffix) =>
      preview(`/negozi${suffix}`, "stores", {
        pattern: `${prefix}/anteprima/negozi/:negozio?`,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    ...["", ...settings.map((section) => `/${section}`), "/non-esiste"].map((suffix) =>
      preview(`/impostazioni${suffix}`, "settings", {
        pattern: `${prefix}/anteprima/impostazioni/:sezione?`,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    preview("/profilo", "profile"),
    make("/pagina-inesistente", "public", { status: 404, pattern: "*" }),
    ...(prefix
      ? []
      : [
          make("/api/auth/get-session", "auth", { pattern: "/api/auth/*", endpoint: true }),
          make("/robots.txt", "public", { endpoint: true }),
        ]),
  ];
});
