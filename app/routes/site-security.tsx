import { cn } from "cn";
import { Ban, Eye, Fingerprint, MapPin, Wallet } from "lucide-react";

import { IconTile } from "~/components/icon-tile";
import { ProductShot } from "~/components/product-shot";
import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import { infoEmail } from "../app-copy";
import { sitePages } from "../copy/site-pages.server";
import { siteSecurityPath } from "../app-links";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/site-security";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  const pages = sitePages[language];
  return {
    language,
    origin,
    signedIn: Boolean(session),
    copy: { ...pages.security, shot: pages.shots.sicurezza },
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, copy: t } = loaderData;
  return siteMeta({
    language,
    origin,
    path: siteSecurityPath,
    title: t.title,
    description: t.description,
  });
}

// Blu e verde soltanto: ambra e viola significano attenzione e Premium.
const summaryIcons = [
  { icon: Eye, tone: "blue" },
  { icon: MapPin, tone: "green" },
  { icon: Fingerprint, tone: "blue" },
  { icon: Wallet, tone: "green" },
] as const;

/** Sicurezza a due livelli (§23): in breve per tutti, nel dettaglio per chi vuole capire. */
export default function SiteSecurity({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  return (
    <SiteLayout path={siteSecurityPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div className={cn(siteColumn, "grid gap-14 py-12 sm:py-16")}>
        <section aria-labelledby="in-breve" className="grid gap-6">
          <h2 id="in-breve" className="text-2xl font-semibold">
            {t.summaryTitle}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.summary.map((item, index) => (
              <li key={item.title} className="flex gap-4 lg:grid lg:content-start lg:gap-3">
                <IconTile
                  icon={summaryIcons[index]!.icon}
                  tone={summaryIcons[index]!.tone}
                  size="lg"
                />
                <div className="grid content-start gap-1.5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="nel-dettaglio" className="grid gap-6">
          <h2 id="nel-dettaglio" className="text-2xl font-semibold">
            {t.detailsTitle}
          </h2>
          <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="grid gap-8">
              {t.details.map((item) => (
                <div key={item.title} className="grid content-start gap-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
            <ProductShot name="sicurezza" language={language} alt={t.shot} />
          </div>
        </section>
        <section aria-labelledby="cosa-non-facciamo" className="grid gap-4">
          <h2 id="cosa-non-facciamo" className="text-2xl font-semibold">
            {t.notTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {t.not.map((item) => (
              <li key={item} className="flex gap-2 text-pretty">
                <Ban aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="segnalazioni"
          className="grid gap-2 rounded-2xl border bg-card p-6"
        >
          <h2 id="segnalazioni" className="text-lg font-semibold">
            {t.reportTitle}
          </h2>
          <p className="text-pretty text-muted-foreground">
            {t.report}{" "}
            <a href={`mailto:${infoEmail}`} className="underline underline-offset-4">
              {infoEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </SiteLayout>
  );
}
