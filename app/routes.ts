import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/site.tsx"),
  route("en", "routes/site.tsx", { id: "site-en" }),
  route("robots.txt", "routes/robots.ts"),
  route("auth/error", "routes/auth-error.tsx"),
  route("en/auth/error", "routes/auth-error.tsx", { id: "auth-error-en" }),
  route("accesso", "routes/sign-in.tsx"),
  route("en/accesso", "routes/sign-in.tsx", { id: "sign-in-en" }),
  route("termini", "routes/legal.tsx"),
  route("en/termini", "routes/legal.tsx", { id: "terms-en" }),
  route("privacy", "routes/legal.tsx", { id: "privacy" }),
  route("en/privacy", "routes/legal.tsx", { id: "privacy-en" }),
  // La shell dell'area resta montata fra Ordini, Negozi e Impostazioni.
  layout("routes/account.tsx", [
    route("app/ordini/:ordine?", "routes/orders.tsx"),
    route("app/negozi/:negozio?", "routes/stores.tsx"),
    route("app/impostazioni/:sezione?", "routes/settings.tsx"),
  ]),
  layout("routes/account.tsx", { id: "account-en" }, [
    route("en/app/ordini/:ordine?", "routes/orders.tsx", { id: "orders-en" }),
    route("en/app/negozi/:negozio?", "routes/stores.tsx", { id: "stores-en" }),
    route("en/app/impostazioni/:sezione?", "routes/settings.tsx", { id: "settings-en" }),
  ]),
  route("app/negozi/collega", "routes/store-link.tsx"),
  route("en/app/negozi/collega", "routes/store-link.tsx", { id: "store-link-en" }),
  route("app/profilo", "routes/profile.tsx"),
  route("en/app/profilo", "routes/profile.tsx", { id: "profile-en" }),
  route("app/lingua", "routes/language.ts"),
  route("admin/:sezione?/:voce?", "routes/admin.tsx"),
  route("en/admin/:sezione?/:voce?", "routes/admin.tsx", { id: "admin-en" }),
  route("api/auth/*", "routes/auth.ts"),
  route("api/v1/page-timing", "routes/page-timing.ts"),
  route("api/v1/orders/search", "routes/order-search.ts"),
  route("api/v1/orders/export", "routes/order-export.ts"),
  route("api/v1/notifications", "routes/notifications.ts"),
  ...preview("anteprima", ""),
  ...preview("en/anteprima", "-en"),
] satisfies RouteConfig;

/** Anteprima con scenari sintetici delle schermate dell'app, assente in Production. */
function preview(path: string, suffix: string) {
  return [
    route(`${path}/ricerca`, "routes/preview-search.ts", { id: `preview-search${suffix}` }),
    route(path, "routes/preview.tsx", { id: `preview${suffix}` }, [
      route("ordini/:ordine?", "routes/preview-orders.tsx", { id: `preview-orders${suffix}` }),
      route("negozi/:negozio?", "routes/preview-stores.tsx", { id: `preview-stores${suffix}` }),
      route("impostazioni/:sezione?", "routes/preview-settings.tsx", {
        id: `preview-settings${suffix}`,
      }),
    ]),
  ];
}
