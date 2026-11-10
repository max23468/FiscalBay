import { cn } from "cn";
import { ArrowRight, CircleCheckBig, CircleX, ExternalLink, Minus } from "lucide-react";
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
import { guides, type ComparisonCell, type Guide as GuideCopy } from "../copy/guides.server";
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
      sourcesTitle: t.sourcesTitle,
      related: article.related
        ? { label: article.related.label, href: localizedPath(language, article.related.path) }
        : null,
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
        ...(copy.sources ? { citation: copy.sources.map((source) => source.href) } : {}),
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

/** Icona di una cella: spunta per ciò che c'è, trattino per ciò che le fonti non dichiarano. */
function cellIcon(
  cell: ComparisonCell,
  notStated: string,
  highlighted: boolean,
  contrast: boolean,
) {
  if (typeof cell !== "string") return CircleCheckBig;
  if (cell === notStated) return Minus;
  if (contrast) return highlighted ? CircleCheckBig : CircleX;
  return null;
}

/**
 * Confronto con la prima soluzione in evidenza, in una colonna incorniciata. Ciò che le fonti non
 * dichiarano ha il trattino, perché non è provato che manchi. Con `contrast` le altre colonne
 * hanno le croci; altrimenti la spunta va a ciò che ogni soluzione offre, senza croci. Con più di
 * due soluzioni la tabella compare dai 768 px e, se serve, scorre invece di schiacciare le colonne.
 */
function ComparisonTable({
  headers: [feature, highlighted, ...others],
  rows,
  notStated,
  contrast = false,
  title,
}: Pick<
  NonNullable<GuideCopy["comparison"]>,
  "headers" | "rows" | "notStated" | "contrast" | "title"
>) {
  return (
    <Table
      className={cn("border-separate border-spacing-0", others.length > 1 && "min-w-[40rem]")}
      // L'area che scorre sui telefoni si raggiunge anche da tastiera, con il nome della tabella.
      container={
        others.length > 1
          ? {
              tabIndex: 0,
              role: "region",
              "aria-label": title,
              className: "rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            }
          : undefined
      }
    >
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
          {others.map((other) => (
            <TableHead key={other} className="border-b whitespace-normal text-muted-foreground">
              {other}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([label, ...cells], index) => {
          const last = index === rows.length - 1;
          return (
            <TableRow key={label} className="hover:bg-transparent">
              <TableHead
                scope="row"
                className={cn("h-auto py-3 font-normal whitespace-normal", !last && "border-b")}
              >
                {label}
              </TableHead>
              {cells.map((cell, column) => {
                const first = column === 0;
                const Icon = cellIcon(cell, notStated, first, contrast);
                return (
                  <TableCell
                    key={column}
                    className={cn(
                      "py-3 whitespace-normal",
                      first
                        ? cn(
                            highlightedColumn,
                            "font-medium",
                            last ? "rounded-b-xl border-b-2 border-b-primary" : "border-b",
                          )
                        : cn("text-muted-foreground", !last && "border-b"),
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {Icon ? (
                        <Icon
                          aria-hidden
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            Icon === CircleCheckBig && "text-success",
                          )}
                        />
                      ) : null}
                      {typeof cell === "string" ? cell : cell.yes}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Confronto fra più di due soluzioni sotto i 768 px: una scheda per voce con le soluzioni una
 * sotto l'altra, la prima in evidenza, così nessuna colonna resta fuori dallo schermo.
 */
function ComparisonCards({
  headers: [, ...solutions],
  rows,
  notStated,
}: Pick<NonNullable<GuideCopy["comparison"]>, "headers" | "rows" | "notStated">) {
  return (
    <ul className="grid gap-3 md:hidden">
      {rows.map(([label, ...cells]) => (
        <li key={label} className="rounded-xl border p-4">
          <h3 className="font-medium">{label}</h3>
          <dl className="mt-3 grid gap-1.5 text-sm">
            {cells.map((cell, column) => {
              const first = column === 0;
              const Icon = cellIcon(cell, notStated, first, false);
              return (
                <div
                  key={solutions[column]}
                  className={cn(
                    "grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 rounded-lg px-3 py-2",
                    first ? "bg-primary/10" : "bg-muted/40",
                  )}
                >
                  <dt className={first ? "font-semibold text-primary" : "text-muted-foreground"}>
                    {solutions[column]}
                  </dt>
                  <dd className={cn("flex items-start gap-1.5", first && "font-medium")}>
                    {Icon ? (
                      <Icon
                        aria-hidden
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          Icon === CircleCheckBig ? "text-success" : "text-muted-foreground",
                        )}
                      />
                    ) : null}
                    {typeof cell === "string" ? cell : cell.yes}
                  </dd>
                </div>
              );
            })}
          </dl>
        </li>
      ))}
    </ul>
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
              {t.comparison.headers.length > 3 ? (
                <ComparisonCards
                  headers={t.comparison.headers}
                  rows={t.comparison.rows}
                  notStated={t.comparison.notStated}
                />
              ) : null}
              <div className={cn("min-w-0", t.comparison.headers.length > 3 && "max-md:hidden")}>
                <ComparisonTable
                  headers={t.comparison.headers}
                  rows={t.comparison.rows}
                  notStated={t.comparison.notStated}
                  contrast={t.comparison.contrast}
                  title={t.comparison.title}
                />
              </div>
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
            {t.related ? (
              <a
                href={t.related.href}
                className="flex w-fit items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                {t.related.label}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </a>
            ) : null}
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
          {t.sources ? (
            <section className="grid gap-2 border-t pt-6">
              <h2 className="text-sm font-semibold">{t.sourcesTitle}</h2>
              <ul className="grid gap-1.5 text-sm">
                {t.sources.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-start gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {source.label}
                      <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
