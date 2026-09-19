import { env } from "cloudflare:workers";

import { createAuth } from "../auth.server";
import type { Route } from "./+types/auth";

export async function loader({ request }: Route.LoaderArgs) {
  return createAuth(env).handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return createAuth(env).handler(request);
}
