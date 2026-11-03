import { env } from "cloudflare:workers";

import { llms } from "../site.server";

export function loader() {
  return new Response(llms(new URL(env.APP_ORIGIN).origin), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
