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
  /** Pannello modale aperto dalla route dopo l'idratazione. */
  dialog?: boolean;
  /** Visitata anche dopo il deploy test: prova ambiente, D1, sessione e segreti. */
  remote?: boolean;
}

export function expectedPageError(text: string, resource: string, status: number, page: URL) {
  if (status < 400 || !text.includes(`${status}`) || !URL.canParse(resource)) return false;
  const location = new URL(resource);
  const dataPath = `${page.pathname.replace(/\/$/u, "")}.data`;
  return (
    location.origin === page.origin &&
    (location.pathname === page.pathname || location.pathname === dataPath)
  );
}

/**
 * WebKit annota come errore JavaScript una richiesta di dati interrotta da una navigazione
 * ("Fetch API cannot load … due to access control checks") e Playwright la riporta come
 * eccezione della pagina, anche se React Router ha già gestito il rifiuto. Una richiesta `.data`
 * della stessa origine non attraversa controlli di accesso: soltanto quel caso non è un errore.
 */
export function abortedDataRequest(error: Error, origin: string) {
  const [text = ""] = (error.stack ?? "").split("\n");
  const [, resource = ""] =
    /^Fetch API cannot load (\S+) due to access control checks\.$/u.exec(text) ?? [];
  if (!URL.canParse(resource)) return false;
  const url = new URL(resource);
  return url.origin === origin && url.pathname.endsWith(".data");
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

/** File mai creato: identificativo nella forma di quelli reali. */
const missingExportFile = "00000000-0000-4000-8000-000000000000";

const settings = [
  "profilo",
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
  const admin = `${prefix}/admin/:sezione?/:voce?`;
  const preview = (path: string, area: string, options: Partial<PageCase> = {}) =>
    make(`/anteprima${path}`, area, { preview: true, ...options });
  return [
    make("", "public", { remote: true }),
    // Con la sessione la radice porta agli Ordini, salvo la scelta di visitare il sito.
    make("", "public", { role: "member", redirect: orders, remote: true }),
    make("?visita=1", "public", { role: "member", pattern: home, redirect: home, remote: !prefix }),
    make("/accesso", "auth", { remote: !prefix }),
    make("/accesso?token=synthetic-reset-token", "auth", { pattern: access }),
    make("/accesso", "auth", { role: "member", redirect: orders }),
    make("/app/ordini", "orders", { pattern: `${orders}/:ordine?`, redirect: access }),
    // Un ordine inesistente o di un altro spazio risponde 404 dentro la shell.
    ...["", "/non-esiste"].map((suffix) =>
      make(`/app/ordini${suffix}`, "orders", {
        role: "member",
        pattern: `${orders}/:ordine?`,
        status: suffix ? 404 : 200,
        remote: !suffix,
      }),
    ),
    make("/auth/error", "auth", { remote: !prefix }),
    ...["email_not_found", "account_not_linked", "account_already_linked_to_different_user"].map(
      (error) =>
        make(`/auth/error?error=${error}&provider=ebay`, "auth", {
          pattern: `${prefix}/auth/error`,
        }),
    ),
    make("/termini", "public", { remote: !prefix }),
    make("/privacy", "public"),
    make("/supporto", "public", { remote: !prefix }),
    make("/funzionalita", "public", { remote: !prefix }),
    make("/prezzi", "public", { remote: true }),
    // Con la sessione le pagine del sito restano visibili e la barra porta all'app.
    make("/prezzi", "public", { role: "member" }),
    make("/sicurezza", "public"),
    make("/faq", "public", { remote: !prefix }),
    make("/app/negozi/collega", "stores", { redirect: access }),
    make("/app/negozi/collega", "stores", { role: "member" }),
    make(`/app/negozi/collega?ricollega=${testAccount.stores.expiring}`, "stores", {
      role: "member",
      pattern: `${prefix}/app/negozi/collega`,
    }),
    make("/app/negozi/collega?ricollega", "stores", {
      role: "member",
      status: 400,
      pattern: `${prefix}/app/negozi/collega`,
    }),
    make("/app/negozi", "stores", {
      pattern: `${prefix}/app/negozi/:negozio?`,
      redirect: access,
      remote: !prefix,
    }),
    // Un negozio inesistente o di un altro spazio risponde 404 dentro la shell.
    ...["", `/${testAccount.stores.active}`, "/non-esiste"].map((suffix) =>
      make(`/app/negozi${suffix}`, "stores", {
        role: "member",
        pattern: `${prefix}/app/negozi/:negozio?`,
        status: suffix === "/non-esiste" ? 404 : 200,
        remote: !prefix && suffix !== "/non-esiste",
        dialog: suffix === `/${testAccount.stores.active}`,
      }),
    ),
    make("/app/profilo", "profile", { redirect: access }),
    make("/app/profilo", "profile", {
      role: "member",
      redirect: `${prefix}/app/impostazioni/profilo`,
      remote: !prefix,
    }),
    make("/app/impostazioni", "settings", {
      pattern: `${prefix}/app/impostazioni/:sezione?`,
      redirect: access,
    }),
    ...["", ...settings.map((section) => `/${section}`), "/non-esiste"].map((suffix) =>
      make(`/app/impostazioni${suffix}`, "settings", {
        role: "member",
        pattern: `${prefix}/app/impostazioni/:sezione?`,
        status: suffix === "/non-esiste" ? 404 : 200,
        remote: !prefix && (suffix === "" || suffix === "/sicurezza"),
      }),
    ),
    make("/app/novita", "settings", { redirect: access }),
    // Senza voci nell'elenco versionato la pagina Novità non esiste (D203).
    make("/app/novita", "settings", { role: "member", status: 404 }),
    ...(
      [
        { role: "anonymous", status: 404 },
        { role: "member", status: 404 },
        { role: "admin-verify", status: 200 },
      ] as const
    ).map(({ role, status }) => make("/admin", "auth", { role, status, pattern: admin })),
    // Ogni sezione della console con la conferma della passkey, la scheda dello spazio di
    // collaudo e un indirizzo inesistente, che risponde come per chi non è admin.
    ...[
      "",
      "/account",
      "/negozi",
      "/lavori",
      "/quote",
      "/commerciale",
      "/antiabuso",
      "/comunicazioni",
      "/interruttori",
      "/registro",
      `/spazi/${testAccount.workspaceId}`,
      "/non-esiste",
    ].map((suffix) =>
      make(`/admin${suffix}`, "auth", {
        role: "admin-granted",
        pattern: admin,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    preview("", "orders", { redirect: `${prefix}/anteprima/ordini` }),
    ...["", "/ord-02", "/non-esiste"].map((suffix) =>
      preview(`/ordini${suffix}`, "orders", {
        pattern: `${prefix}/anteprima/ordini/:ordine?`,
        status: suffix === "/non-esiste" ? 404 : 200,
        remote: !prefix && !suffix,
        dialog: suffix === "/ord-02",
      }),
    ),
    ...["", "/neg-vintage", "/non-esiste"].map((suffix) =>
      preview(`/negozi${suffix}`, "stores", {
        pattern: `${prefix}/anteprima/negozi/:negozio?`,
        status: suffix === "/non-esiste" ? 404 : 200,
        dialog: suffix === "/neg-vintage",
      }),
    ),
    ...["", ...settings.map((section) => `/${section}`), "/non-esiste"].map((suffix) =>
      preview(`/impostazioni${suffix}`, "settings", {
        pattern: `${prefix}/anteprima/impostazioni/:sezione?`,
        status: suffix === "/non-esiste" ? 404 : 200,
      }),
    ),
    // Riceve soltanto ricerche: una lettura risponde senza contenuto.
    preview("/ricerca", "orders", { endpoint: true, status: 405 }),
    // Download di un file esportato: senza sessione porta all'accesso, un file inesistente,
    // scaduto o revocato torna alla sezione Esportazione.
    ...(["anonymous", "member"] as const).map((role) =>
      make(`/api/v1/exports/${missingExportFile}`, "settings", {
        role,
        pattern: `${prefix}/api/v1/exports/:file`,
        redirect: role === "member" ? `${prefix}/app/impostazioni/esportazione` : access,
      }),
    ),
    make("/pagina-inesistente", "public", { status: 404, pattern: "*", remote: !prefix }),
    ...(prefix
      ? []
      : [
          make("/api/auth/get-session", "auth", {
            pattern: "/api/auth/*",
            endpoint: true,
            remote: true,
          }),
          make("/robots.txt", "public", { endpoint: true, remote: true }),
          make("/sitemap.xml", "public", { endpoint: true, remote: true }),
          // Riceve soltanto i report del browser: una lettura risponde senza contenuto.
          make("/api/v1/page-timing", "public", { endpoint: true, status: 405 }),
          make("/api/v1/orders/search", "orders", { endpoint: true, status: 405 }),
          // Crea soltanto file con la conferma della sezione Esportazione.
          make("/api/v1/orders/export", "settings", { endpoint: true, status: 405 }),
          // Ricevono soltanto la scelta della lingua e le letture della campanella.
          make("/app/lingua", "settings", { endpoint: true, status: 405 }),
          make("/api/v1/notifications", "settings", { endpoint: true, status: 405 }),
        ]),
  ];
});
