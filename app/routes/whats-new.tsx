import { data } from "react-router";
import { Megaphone, Sparkles } from "lucide-react";

import { IconTile, PageTitle } from "~/components/icon-tile";
import { NotFoundState } from "~/components/not-found";
import { useCopy } from "~/components/copy-context";
import { Badge } from "~/components/ui/badge";
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
    <div className="grid max-w-3xl gap-6">
      <PageTitle icon={Megaphone} tone="blue">
        {t.shell.whatsNew}
      </PageTitle>
      {loaderData.releases.map((release) => (
        <section
          key={release.version}
          aria-labelledby={`release-${release.version}`}
          className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6"
        >
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`release-${release.version}`} className="text-lg font-semibold">
              {t.shell.whatsNewVersion(release.version)}
            </h2>
            {release.date === null ? (
              <Badge variant="info">{t.shell.whatsNewUpcoming}</Badge>
            ) : (
              <time dateTime={release.date} className="text-sm text-muted-foreground">
                {formatDate(`${release.date}T12:00:00Z`, language, "date", "UTC")}
              </time>
            )}
          </header>
          <ul className="grid gap-5">
            {release.items.map((item) => (
              <li key={item.title} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <IconTile icon={Sparkles} tone="blue" size="sm" className="row-span-2" />
                <h3 className="self-center font-medium">{item.title}</h3>
                <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
