import { env } from "cloudflare:workers";

import { handleAuthRequest } from "../auth-route.server";
import type { Route } from "./+types/auth";

export async function loader({ request }: Route.LoaderArgs) {
  return handleAuthRequest(request, env);
}

export async function action({ request }: Route.ActionArgs) {
  return handleAuthRequest(request, env);
}
