import { env } from "cloudflare:workers";

import { sitemap } from "../site.server";

export function loader() {
  return new Response(sitemap(new URL(env.APP_ORIGIN).origin), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
