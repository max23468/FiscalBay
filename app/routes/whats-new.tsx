import { data } from "react-router";
import { Megaphone } from "lucide-react";

import { PageTitle } from "~/components/icon-tile";
import { NotFoundState } from "~/components/not-found";
import { useCopy } from "~/components/copy-context";
import { areaPage, requireAccountArea } from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { formatDate } from "../format";
import { languageFromPath } from "../i18n";
import { whatsNewView } from "../whats-new.server";
import type { Route } from "./+types/whats-new";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.shell.whatsNew) }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/**
 * Novità dell'app (D203): senza voci da mostrare la pagina non esiste, come la sua voce nel menu.
 */
export function loader({ request }: Route.LoaderArgs) {
  return areaPage(request, async () => {
    const { language } = await requireAccountArea(request);
    const releases = whatsNewView(language);
    return releases.length === 0 ? data({ releases }, { status: 404 }) : { releases };
  });
}

export default function WhatsNew({ loaderData }: Route.ComponentProps) {
  const { t, language } = useCopy();
  if (loaderData.releases.length === 0) return <NotFoundState kind="page" />;
  return (
    <div className="grid max-w-2xl gap-8">
      <PageTitle icon={Megaphone} tone="neutral">
        {t.shell.whatsNew}
      </PageTitle>
      {loaderData.releases.map((release) => (
        <section
          key={release.version}
          aria-labelledby={`release-${release.version}`}
          className="grid gap-4"
        >
          <h2
            id={`release-${release.version}`}
            className="text-sm font-medium text-muted-foreground"
          >
            {release.date === null ? (
              t.shell.whatsNewUpcoming
            ) : (
              <time dateTime={release.date}>
                {formatDate(`${release.date}T12:00:00Z`, language, "date", "UTC")}
              </time>
            )}
          </h2>
          <ul className="grid gap-4 border-t pt-4">
            {release.items.map((item) => (
              <li key={item.title} className="grid gap-1">
                <h3 className="font-medium">{item.title}</h3>
                <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
