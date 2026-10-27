import { cn } from "cn";

import { FaqList } from "~/components/faq-list";
import { PageIntro, SiteLayout, siteColumn } from "~/components/site-layout";
import { sitePages } from "../copy/site-pages.server";
import { faqPath, supportPath } from "../app-links";
import { localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/faq";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  return { language, origin, signedIn: Boolean(session), copy: sitePages[language].faq };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, copy: t } = loaderData;
  return [
    ...siteMeta({ language, origin, path: faqPath, title: t.title, description: t.description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: language,
        mainEntity: t.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    },
  ];
}

/** Domande prima di iniziare; quelle sull'uso dell'app stanno in Supporto. */
export default function Faq({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  return (
    <SiteLayout path={faqPath} signedIn={signedIn}>
      <PageIntro title={t.title} />
      <div className={cn(siteColumn, "py-12 sm:py-16")}>
        <div className="grid max-w-3xl gap-8">
          <FaqList items={t.items} />
          <p className="text-pretty">
            {t.more}{" "}
            <a
              href={localizedPath(language, supportPath)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.support}
            </a>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
