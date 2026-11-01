import { redirect } from "react-router";

import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/profile";

/** Il profilo è una categoria delle Impostazioni: il vecchio indirizzo porta lì. */
export function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  return redirect(localizedPath(language, "/app/impostazioni/account"), {
    headers: { "cache-control": "no-store" },
  });
}
