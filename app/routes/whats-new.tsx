import { data } from "react-router";
import { Megaphone, Sparkles, TrendingUp, Wrench } from "lucide-react";

import { IconTile, PageTitle } from "~/components/icon-tile";
import { NotFoundState } from "~/components/not-found";
import { useCopy } from "~/components/copy-context";
import { Badge } from "~/components/ui/badge";
import { areaPage, requireAccountArea } from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { formatDate } from "../format";
import { languageFromPath } from "../i18n";
import { whatsNewKinds, type WhatsNewKind } from "../changelog";
import { whatsNewView } from "../whats-new.server";
import type { Route } from "./+types/whats-new";

const kinds = Object.keys(whatsNewKinds) as WhatsNewKind[];

// Il Supporto segue le Impostazioni: tessere neutre, l'icona distingue il gruppo.
const kindIcons: Record<WhatsNewKind, typeof Sparkles> = {
  features: Sparkles,
  improvements: TrendingUp,
  fixes: Wrench,
};

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
    <div className="grid gap-6">
      <PageTitle icon={Megaphone} tone="neutral">
        {t.shell.whatsNew}
      </PageTitle>
      {loaderData.releases.map((release) => (
        <section
          key={release.version}
          aria-labelledby={`release-${release.version}`}
          className="grid gap-6 rounded-xl border bg-card p-4 sm:p-6"
        >
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`release-${release.version}`} className="text-lg font-semibold">
              {t.shell.whatsNewVersion(release.version)}
            </h2>
            {release.date === null ? (
              <Badge variant="neutral">{t.shell.whatsNewUpcoming}</Badge>
            ) : (
              <time dateTime={release.date} className="text-sm text-muted-foreground">
                {formatDate(`${release.date}T12:00:00Z`, language, "date", "UTC")}
              </time>
            )}
          </header>
          {/* Un gruppo occupa tutta la scheda; più gruppi si affiancano dove c'è spazio. */}
          <div className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] md:gap-8">
            {kinds.flatMap((kind) => {
              const items = release.items.filter((item) => item.kind === kind);
              if (items.length === 0) return [];

              return [
                <section
                  key={kind}
                  aria-labelledby={`release-${release.version}-${kind}`}
                  className="grid content-start gap-3"
                >
                  <h3
                    id={`release-${release.version}-${kind}`}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <IconTile icon={kindIcons[kind]} tone="neutral" size="sm" />
                    {whatsNewKinds[kind][language]}
                  </h3>
                  <ul className="columns-[18rem] gap-x-8">
                    {items.map((item) => (
                      <li
                        key={item.title}
                        className="mb-3 grid break-inside-avoid gap-0.5 text-sm last:mb-0"
                      >
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="leading-relaxed text-pretty text-muted-foreground">
                          {item.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>,
              ];
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
