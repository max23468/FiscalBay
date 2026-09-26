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
] satisfies RouteConfig;
