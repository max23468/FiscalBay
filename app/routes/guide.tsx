import { cn } from "cn";
import { CircleCheckBig, CircleX, Minus } from "lucide-react";
import { data } from "react-router";

import { ProductShot } from "~/components/product-shot";
import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { buttonLink } from "~/components/ui/button-variants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { accessPath, featuresPath, guidePaths, guidesPath, type GuidePath } from "../app-links";
import { guides, type Guide as GuideCopy } from "../copy/guides.server";
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

const highlightedColumn = "border-x-2 border-x-primary bg-primary/10";

/**
 * Confronto con la prima soluzione in evidenza: colonna incorniciata e spunte, croci sull'altra.
 * Ciò che le fonti non dichiarano ha il trattino, perché non è provato che manchi.
 */
function ComparisonTable({
  headers: [feature, highlighted, other],
  rows,
  notStated,
}: Pick<NonNullable<GuideCopy["comparison"]>, "headers" | "rows" | "notStated">) {
  return (
    <Table className="border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="border-b">
            <span className="sr-only">{feature}</span>
          </TableHead>
          <TableHead
            className={cn(
              highlightedColumn,
              "h-12 rounded-t-xl border-t-2 border-b border-t-primary text-base font-semibold text-primary",
            )}
          >
            {highlighted}
          </TableHead>
          <TableHead className="border-b text-muted-foreground">{other}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([label, first, second], index) => {
          const last = index === rows.length - 1;
          const Icon = second === notStated ? Minus : CircleX;
          return (
            <TableRow key={label} className="hover:bg-transparent">
              <TableHead
                scope="row"
                className={cn("h-auto py-3 font-normal whitespace-normal", !last && "border-b")}
              >
                {label}
              </TableHead>
              <TableCell
                className={cn(
                  highlightedColumn,
                  "py-3 font-medium whitespace-normal",
                  last ? "rounded-b-xl border-b-2 border-b-primary" : "border-b",
                )}
              >
                <span className="flex items-start gap-2">
                  <CircleCheckBig aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {first}
                </span>
              </TableCell>
              <TableCell
                className={cn("py-3 whitespace-normal text-muted-foreground", !last && "border-b")}
              >
                <span className="flex items-start gap-2">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {second}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
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
          {t.comparison ? (
            <section className="grid gap-3">
              <h2 className="text-xl font-semibold text-balance">{t.comparison.title}</h2>
              <ComparisonTable
                headers={t.comparison.headers}
                rows={t.comparison.rows}
                notStated={t.comparison.notStated}
              />
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                {t.comparison.note}
              </p>
            </section>
          ) : null}
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
