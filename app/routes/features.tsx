import { cn } from "cn";
import { LockKeyhole, RefreshCcw, Sparkles } from "lucide-react";

import { IconTile } from "~/components/icon-tile";
import { ShotRow, type ShotName } from "~/components/product-shot";
import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { Badge } from "~/components/ui/badge";
import { sitePages } from "../copy/site-pages.server";
import { featuresPath, siteSecurityPath } from "../app-links";
import { localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/features";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  const pages = sitePages[language];
  return {
    language,
    origin,
    signedIn: Boolean(session),
    copy: { ...pages.features, shots: pages.shots },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, copy: t } = loaderData;
  return siteMeta({
    language,
    origin,
    path: featuresPath,
    title: t.title,
    description: t.description,
  });
}

/** Icone delle funzioni senza schermata, nell'ordine dei testi. */
const icons = [
  { icon: RefreshCcw, tone: "green" },
  { icon: Sparkles, tone: "violet" },
] as const;

/**
 * Funzionalità in una sola pagina (§23): le principali accanto alla loro schermata reale, le
 * altre in un elenco compatto. Le voci Premium portano il loro segno.
 */
export default function Features({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  const premium = <Badge variant="premium">{t.premium}</Badge>;
  return (
    <SiteLayout path={featuresPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div className={cn(siteColumn, "grid gap-14 py-12 sm:gap-20 sm:py-16")}>
        {t.showcase.map((item, index) => (
          <ShotRow
            key={item.shot}
            id={`funzione-${item.shot}`}
            title={item.title}
            badge={item.premium ? premium : null}
            body={item.body}
            shot={item.shot as ShotName}
            language={language}
            alt={t.shots[item.shot as ShotName]}
            reverse={index % 2 === 1}
            heading="h2"
          />
        ))}
        <ul className="grid gap-6 border-t pt-12 md:grid-cols-2 md:gap-10">
          {t.items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <IconTile icon={icons[index]!.icon} tone={icons[index]!.tone} size="lg" />
              <div className="grid content-start gap-1.5">
                <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                  {item.title}
                  {item.premium ? premium : null}
                </h2>
                <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-6">
          <IconTile icon={LockKeyhole} tone="green" />
          <p className="flex-1 basis-60 text-pretty">{t.security}</p>
          <a
            href={localizedPath(language, siteSecurityPath)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.securityLink}
          </a>
        </div>
      </div>
    </SiteLayout>
  );
}
