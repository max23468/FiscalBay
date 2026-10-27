import { cn } from "cn";

import { FaqList } from "~/components/faq-list";
import { PageIntro, SiteLayout, siteColumn } from "~/components/site-layout";
import { buttonLink } from "~/components/ui/button-variants";
import { appCopy, supportEmail } from "../app-copy";
import { faqPath, supportPath, supportSettingsPath } from "../app-links";
import { localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/support";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  return { language, origin, signedIn: Boolean(session) };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin } = loaderData;
  const t = appCopy[language].supportPage;
  return siteMeta({
    language,
    origin,
    path: supportPath,
    title: t.title,
    description: t.description,
  });
}

/**
 * Supporto pubblico (§14): domande sull'uso e contatti, senza modulo anonimo. Il modulo con il
 * riepilogo diagnostico sta nell'app, dove la richiesta porta l'account; senza sessione
 * l'indirizzo dell'app passa dall'accesso. Le domande prima di iniziare stanno nella FAQ.
 */
export default function Support({ loaderData }: Route.ComponentProps) {
  const { language, signedIn } = loaderData;
  const t = appCopy[language];
  return (
    <SiteLayout path={supportPath} signedIn={signedIn}>
      <PageIntro title={t.supportPage.title} />
      <div className={cn(siteColumn, "py-12 sm:py-16")}>
        <div className="grid max-w-3xl gap-10">
          <section aria-labelledby="faq" className="grid gap-3">
            <h2 id="faq" className="text-xl font-semibold">
              {t.settings.support.faq}
            </h2>
            <FaqList items={t.settings.support.faqItems} />
            <a
              href={localizedPath(language, faqPath)}
              className="w-fit font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.supportPage.faq}
            </a>
          </section>
          <section aria-labelledby="contatti" className="grid gap-3">
            <h2 id="contatti" className="text-xl font-semibold">
              {t.supportPage.contact}
            </h2>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              {t.supportPage.member}
            </p>
            <a
              href={localizedPath(language, supportSettingsPath)}
              {...buttonLink({ className: "w-fit" })}
            >
              {t.supportPage.openForm}
            </a>
            <p className="text-muted-foreground">
              {t.supportPage.email}{" "}
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
                {supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
