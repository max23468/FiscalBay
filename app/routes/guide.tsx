import { cn } from "cn";
import { data } from "react-router";

import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { buttonLink } from "~/components/ui/button-variants";
import { accessPath, featuresPath, guidePaths, guidesPath, type GuidePath } from "../app-links";
import { guides } from "../copy/guides.server";
import { formatDate } from "../format";
import { canonicalPath, localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { ogImage, siteMeta } from "../site-meta";
import type { Route } from "./+types/guide";

function isGuide(path: string): path is GuidePath {
  return (guidePaths as readonly string[]).includes(path);
}

/** Articolo delle Guide, riconosciuto dal percorso italiano in entrambe le lingue. */
export async function loader({ request }: Route.LoaderArgs) {
  const path = canonicalPath(new URL(request.url).pathname);
  if (!isGuide(path)) throw data(null, { status: 404 });
  const { language, origin, session } = await publicPage(request);
  const t = guides[language];
  const article = t.articles[path];
  return {
    language,
    origin,
    path,
    signedIn: Boolean(session),
    copy: {
      ...article,
      updatedLabel: t.updated(formatDate(article.updated, language, "date")),
      start: t.start,
      back: t.back,
      featureHref: `${localizedPath(language, featuresPath)}#funzione-${article.feature.shot}`,
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaderData) return [];
  const { language, origin, path, copy } = loaderData;
  const url = `${origin}${localizedPath(language, path)}`;
  return [
    ...siteMeta({ language, origin, path, title: copy.title, description: copy.description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: copy.title,
        description: copy.description,
        inLanguage: language,
        datePublished: copy.published,
        dateModified: copy.updated,
        mainEntityOfPage: url,
        image: `${origin}${ogImage(language, path)}`,
        author: { "@id": `${origin}/#organization` },
        publisher: { "@id": `${origin}/#organization` },
      },
    },
  ];
}

export default function Guide({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  return (
    <SiteLayout path={guidesPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <article className={cn(siteColumn, "py-12 sm:py-16")}>
        <div className="grid max-w-3xl gap-10">
          <p className="text-sm text-muted-foreground">{t.updatedLabel}</p>
          {t.sections.map((section) => (
            <section key={section.title} className="grid gap-3">
              <h2 className="text-xl font-semibold text-balance">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-pretty text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <a
            href={t.featureHref}
            className="w-fit font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.feature.label}
          </a>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-8">
            {signedIn ? null : (
              <a
                href={`${localizedPath(language, accessPath)}?registrati`}
                {...buttonLink({ size: "lg" })}
              >
                {t.start}
              </a>
            )}
            <a
              href={localizedPath(language, guidesPath)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.back}
            </a>
          </div>
        </div>
      </article>
    </SiteLayout>
  );
}
