import { cn } from "cn";

import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import type { Route } from "./+types/legal";
import { appCopy, infoEmail } from "../app-copy";
import { sitePages } from "../copy/site-pages.server";
import { privacyPath, termsPath } from "../app-links";
import { legalVersions } from "../domain/registration.server";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";

const documents = {
  termini: { version: "terms", path: termsPath },
  privacy: { version: "privacy", path: privacyPath },
} as const;

/**
 * Termini e Privacy: pubblici ma `noindex` e fuori dalla sitemap (D204), con l'operatore
 * Temisfera, che non compare altrove nel sito.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  const document: keyof typeof documents = new URL(request.url).pathname.endsWith(privacyPath)
    ? "privacy"
    : "termini";
  return {
    language,
    origin,
    signedIn: Boolean(session),
    document,
    version: legalVersions[documents[document].version],
    description: sitePages[language].legal.description[document],
    operator: sitePages[language].legal.operator[document],
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, document, description } = loaderData;
  const t = appCopy[language].legal;
  return siteMeta({
    language,
    origin,
    path: documents[document].path,
    title: t[document],
    description,
  });
}

export default function Legal({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, document, version, operator } = loaderData;
  const t = appCopy[language].legal;
  return (
    <SiteLayout path={documents[document].path} signedIn={signedIn}>
      <PageIntro title={t[document]} />
      <div className={cn(siteColumn, "py-12 sm:py-16")}>
        <div className="grid max-w-3xl gap-8">
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">{t.version(version)}</p>
            <p className="leading-relaxed text-pretty text-muted-foreground">{t.draft}</p>
          </div>
          <section aria-labelledby="operatore" className="grid gap-2">
            <h2 id="operatore" className="text-xl font-semibold">
              {operator.title}
            </h2>
            <p className="leading-relaxed text-pretty">
              {operator.body}{" "}
              <a href={`mailto:${infoEmail}`} className="underline underline-offset-4">
                {infoEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
