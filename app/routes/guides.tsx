import { cn } from "cn";

import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { guidePaths, guidesPath } from "../app-links";
import { guides } from "../copy/guides.server";
import { localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/guides";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  const t = guides[language];
  return {
    language,
    origin,
    signedIn: Boolean(session),
    copy: {
      ...t.index,
      articles: guidePaths.map((path) => ({
        href: localizedPath(language, path),
        title: t.articles[path].title,
        description: t.articles[path].description,
      })),
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, copy } = loaderData;
  return siteMeta({
    language,
    origin,
    path: guidesPath,
    title: copy.metaTitle,
    description: copy.description,
  });
}

/** Elenco delle guide (§23): titolo e descrizione di ogni articolo, senza date né categorie. */
export default function Guides({ loaderData }: Route.ComponentProps) {
  const { signedIn, copy: t } = loaderData;
  return (
    <SiteLayout path={guidesPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div className={cn(siteColumn, "py-12 sm:py-16")}>
        <ul className="grid max-w-3xl gap-4">
          {t.articles.map((article) => (
            <li key={article.href}>
              <a
                href={article.href}
                className="grid gap-1.5 rounded-2xl border bg-card p-5 outline-none transition-colors duration-(--duration-quick) hover:border-primary focus-visible:ring-3 focus-visible:ring-ring sm:p-6"
              >
                <h2 className="text-lg font-semibold text-balance">{article.title}</h2>
                <p className="leading-relaxed text-pretty text-muted-foreground">
                  {article.description}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </SiteLayout>
  );
}
