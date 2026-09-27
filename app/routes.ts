import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("en", "routes/home.tsx", { id: "home-en" }),
  route("auth/error", "routes/auth-error.tsx"),
  route("en/auth/error", "routes/auth-error.tsx", { id: "auth-error-en" }),
  route("accesso", "routes/sign-in.ts"),
  route("en/accesso", "routes/sign-in.ts", { id: "sign-in-en" }),
  route("negozi/collega", "routes/store-link.ts"),
  route("en/negozi/collega", "routes/store-link.ts", { id: "store-link-en" }),
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
