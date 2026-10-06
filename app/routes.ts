import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/site.tsx"),
  route("en", "routes/site.tsx", { id: "site-en" }),
  route("robots.txt", "routes/robots.ts"),
  route("auth/error", "routes/auth-error.tsx"),
  route("en/auth/error", "routes/auth-error.tsx", { id: "auth-error-en" }),
  route("accesso", "routes/sign-in.ts"),
  route("en/accesso", "routes/sign-in.ts", { id: "sign-in-en" }),
  route("termini", "routes/legal.tsx"),
  route("en/termini", "routes/legal.tsx", { id: "terms-en" }),
  route("privacy", "routes/legal.tsx", { id: "privacy" }),
  route("en/privacy", "routes/legal.tsx", { id: "privacy-en" }),
  route("app/ordini", "routes/home.tsx"),
  route("en/app/ordini", "routes/home.tsx", { id: "home-en" }),
  route("app/negozi/collega", "routes/store-link.tsx"),
  route("en/app/negozi/collega", "routes/store-link.tsx", { id: "store-link-en" }),
  route("app/negozi/:negozio?", "routes/stores.tsx"),
  route("en/app/negozi/:negozio?", "routes/stores.tsx", { id: "stores-en" }),
  route("app/profilo", "routes/profile.tsx"),
  route("en/app/profilo", "routes/profile.tsx", { id: "profile-en" }),
  route("app/impostazioni/sicurezza", "routes/security.tsx"),
  route("en/app/impostazioni/sicurezza", "routes/security.tsx", { id: "security-en" }),
  route("admin", "routes/admin.tsx"),
  route("en/admin", "routes/admin.tsx", { id: "admin-en" }),
  route("api/auth/*", "routes/auth.ts"),
  ...preview("anteprima", ""),
  ...preview("en/anteprima", "-en"),
] satisfies RouteConfig;

/** Anteprima con scenari sintetici delle schermate dell'app, assente in Production. */
function preview(path: string, suffix: string) {
  return [
    route(path, "routes/preview.tsx", { id: `preview${suffix}` }, [
      route("ordini/:ordine?", "routes/preview-orders.tsx", { id: `preview-orders${suffix}` }),
      route("negozi/:negozio?", "routes/preview-stores.tsx", { id: `preview-stores${suffix}` }),
      route("impostazioni/:sezione?", "routes/preview-settings.tsx", {
        id: `preview-settings${suffix}`,
      }),
      route("profilo", "routes/preview-profile.tsx", { id: `preview-profile${suffix}` }),
    ]),
  ];
}
