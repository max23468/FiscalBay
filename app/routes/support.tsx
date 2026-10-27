import { ChevronDown, LifeBuoy } from "lucide-react";

import { SiteFooter } from "~/components/site-footer";
import { StandalonePage } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import { appCopy, pageTitle, supportEmail } from "../app-copy";
import { supportSettingsPath } from "../app-links";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/support";

export function loader({ request }: Route.LoaderArgs) {
  return { language: languageFromPath(new URL(request.url).pathname) };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: pageTitle(appCopy[loaderData.language].supportPage.title) }];
}

/**
 * Supporto pubblico (§14): domande frequenti e contatti, senza modulo anonimo. Il modulo con il
 * riepilogo diagnostico sta nell'app, dove la richiesta porta l'account; senza sessione
 * l'indirizzo dell'app passa dall'accesso.
 */
export default function Support({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = appCopy[language];
  return (
    <StandalonePage
      icon={LifeBuoy}
      tone="neutral"
      title={t.supportPage.title}
      homeHref={localizedPath(language)}
      footer={<SiteFooter />}
    >
      <section aria-labelledby="faq" className="grid gap-2">
        <h2 id="faq" className="font-medium">
          {t.settings.support.faq}
        </h2>
        <div className="grid divide-y border-y">
          {t.settings.support.faqItems.map((item) => (
            <details key={item.q} className="group py-1 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--duration-quick) group-open:rotate-180"
                />
              </summary>
              <p className="pr-7 pb-2 leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section aria-labelledby="contatti" className="grid gap-3">
        <h2 id="contatti" className="font-medium">
          {t.supportPage.contact}
        </h2>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {t.supportPage.member}
        </p>
        <a
          href={localizedPath(language, supportSettingsPath)}
          {...buttonLink({ className: "w-fit" })}
        >
          {t.supportPage.openForm}
        </a>
        <p className="text-sm text-muted-foreground">
          {t.supportPage.email}{" "}
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
            {supportEmail}
          </a>
          .
        </p>
      </section>
    </StandalonePage>
  );
}
