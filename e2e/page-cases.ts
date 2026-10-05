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
  const preview = (path: string, area: string, options: Partial<PageCase> = {}) =>
    make(`/anteprima${path}`, area, { preview: true, ...options });
  return [
    make("", "public"),
    make("", "orders", { role: "member" }),
    make("?token=synthetic-reset-token", "auth", { pattern: home }),
    make("/auth/error", "auth"),
    ...["email_not_found", "account_not_linked", "account_already_linked_to_different_user"].map(
      (error) =>
        make(`/auth/error?error=${error}&provider=ebay`, "auth", {
          pattern: `${prefix}/auth/error`,
        }),
    ),
    make("/accesso", "auth", { redirect: home }),
    make("/termini", "public"),
    make("/privacy", "public"),
    make("/negozi/collega", "stores", { redirect: home }),
    make("/negozi/collega", "stores", { role: "member" }),
    make("/negozi/collega?ricollega", "stores", {
      role: "member",
      pattern: `${prefix}/negozi/collega`,
    }),
    make("/impostazioni/sicurezza", "auth", { redirect: home }),
    make("/impostazioni/sicurezza", "auth", { role: "member" }),
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
      : [make("/api/auth/get-session", "auth", { pattern: "/api/auth/*", endpoint: true })]),
  ];
});
