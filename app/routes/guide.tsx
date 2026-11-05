import { cn } from "cn";
import { data } from "react-router";

import { ProductShot } from "~/components/product-shot";
import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { buttonLink } from "~/components/ui/button-variants";
import { accessPath, featuresPath, guidePaths, guidesPath, type GuidePath } from "../app-links";
import { guides } from "../copy/guides.server";
import { sitePages } from "../copy/site-pages.server";
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
      alt: sitePages[language].shots[article.solution.shot],
      updatedLabel: t.updated(formatDate(article.updated, language, "date")),
      solutionTitle: t.solutionTitle,
      start: t.start,
      signIn: t.signIn,
      back: t.back,
      guidesTitle: t.index.title,
      guidesHref: localizedPath(language, guidesPath),
      featureHref: `${localizedPath(language, featuresPath)}#funzione-${article.solution.shot}`,
      menu: guidePaths.map((guide) => ({
        href: localizedPath(language, guide),
        label: t.articles[guide].nav,
        current: guide === path,
      })),
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaderData) return [];
  const { language, origin, path, copy } = loaderData;
  const url = `${origin}${localizedPath(language, path)}`;
  return [
    ...siteMeta({
      language,
      origin,
      path,
      title: copy.metaTitle,
      description: copy.description,
      type: "article",
    }),
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
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { name: copy.guidesTitle, item: `${origin}${copy.guidesHref}` },
          { name: copy.title, item: url },
        ].map((entry, index) => ({ "@type": "ListItem", position: index + 1, ...entry })),
      },
    },
  ];
}

/**
 * Articolo delle Guide (§23): sezioni, riquadro con la soluzione di FiscalBay e la sua schermata,
 * menu di tutte le guide a lato da 1024 px e dopo l'articolo sotto.
 */
export default function Guide({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, path, copy: t } = loaderData;
  return (
    <SiteLayout path={path} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div
        className={cn(
          siteColumn,
          "grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16",
        )}
      >
        <article className="grid max-w-3xl content-start gap-10">
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
          <section className="grid gap-5 rounded-2xl border bg-muted/40 p-5 sm:p-8">
            <h2 className="text-xl font-semibold text-balance sm:text-2xl">{t.solutionTitle}</h2>
            {t.solution.body.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-pretty">
                {paragraph}
              </p>
            ))}
            <figure className="grid gap-3">
              <ProductShot
                name={t.solution.shot}
                language={language}
                alt={t.alt}
                className={cn(t.solution.shot === "telegram" && "mx-auto max-w-md")}
              />
              <figcaption className="text-sm">
                <a
                  href={t.featureHref}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t.solution.caption}
                </a>
              </figcaption>
            </figure>
            {signedIn ? null : (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`${localizedPath(language, accessPath)}?registrati`}
                  {...buttonLink({ size: "lg" })}
                >
                  {t.start}
                </a>
                <a
                  href={localizedPath(language, accessPath)}
                  {...buttonLink({ variant: "outline", size: "lg" })}
                >
                  {t.signIn}
                </a>
              </div>
            )}
          </section>
        </article>
        <nav aria-label={t.guidesTitle} className="lg:sticky lg:top-8 lg:self-start">
          <a
            href={t.guidesHref}
            className="font-semibold underline-offset-4 hover:text-primary hover:underline"
          >
            {t.back}
          </a>
          <ul className="mt-3 grid gap-1 border-l">
            {t.menu.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className={cn(
                    "-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-pretty text-muted-foreground transition-colors duration-(--duration-quick) hover:text-foreground",
                    item.current && "border-primary font-medium text-foreground",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </SiteLayout>
  );
}
