import { cn } from "cn";
import {
  Archive,
  BellRing,
  ClipboardCopy,
  LockKeyhole,
  ListFilter,
  RefreshCcw,
  Sheet,
  Sparkles,
  Table,
} from "lucide-react";

import { IconTile } from "~/components/icon-tile";
import { PageIntro, SiteLayout, siteColumn } from "~/components/site-layout";
import { Badge } from "~/components/ui/badge";
import { sitePages } from "../copy/site-pages.server";
import { featuresPath, siteSecurityPath } from "../app-links";
import { localizedPath } from "../i18n";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";
import type { Route } from "./+types/features";

export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  return { language, origin, signedIn: Boolean(session), copy: sitePages[language].features };
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

/** Icone nell'ordine delle voci dei testi. */
const icons = [
  { icon: ClipboardCopy, tone: "blue" },
  { icon: RefreshCcw, tone: "green" },
  { icon: ListFilter, tone: "teal" },
  { icon: Table, tone: "amber" },
  { icon: Sheet, tone: "violet" },
  { icon: BellRing, tone: "violet" },
  { icon: Archive, tone: "violet" },
  { icon: Sparkles, tone: "violet" },
] as const;

/** Funzionalità in una sola pagina (§23): le voci Premium portano il loro segno. */
export default function Features({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, copy: t } = loaderData;
  return (
    <SiteLayout path={featuresPath} signedIn={signedIn}>
      <PageIntro title={t.title} lead={t.lead} />
      <div className={cn(siteColumn, "grid gap-12 py-12 sm:py-16")}>
        <ul className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {t.items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <IconTile icon={icons[index]!.icon} tone={icons[index]!.tone} size="lg" />
              <div className="grid content-start gap-2">
                <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                  {item.title}
                  {item.premium ? <Badge variant="premium">{t.premium}</Badge> : null}
                </h2>
                <p className="leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-6">
          <IconTile icon={LockKeyhole} tone="green" />
          <p className="flex-1 text-pretty">{t.security}</p>
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
