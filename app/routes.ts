import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/error", "routes/auth-error.tsx"),
  route("api/auth/*", "routes/auth.ts"),
  route("api/stripe/checkout", "routes/stripe-checkout.ts"),
  route("webhooks/stripe", "routes/stripe-webhook.ts"),
] satisfies RouteConfig;
