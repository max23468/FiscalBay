import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/error", "routes/auth-error.tsx"),
  route("api/auth/*", "routes/auth.ts"),
] satisfies RouteConfig;
