import { cn } from "cn";
import { MenuIcon } from "lucide-react";

import { useCopy } from "~/components/copy-context";
import { LanguageSwitch } from "~/components/language-switch";
import { SiteFooter } from "~/components/site-footer";
import { Logo } from "~/components/standalone-page";
import { buttonLink, buttonVariants } from "~/components/ui/button-variants";
import {
  accessPath,
  faqPath,
  featuresPath,
  pricingPath,
  siteSecurityPath,
  visitParam,
} from "../app-links";
import { localizedPath } from "../i18n";

/** Larghezza comune di barra, sezioni e footer. */
export const siteColumn = "mx-auto w-[min(72rem,calc(100%-2rem))]";

const navItems = [
  { path: featuresPath, key: "features" },
  { path: pricingPath, key: "pricing" },
  { path: siteSecurityPath, key: "security" },
  { path: faqPath, key: "faq" },
] as const;

/**
 * Barra superiore delle pagine pubbliche (D202): logo, pagine, lingua e `Accedi`, oppure
 * `Apri l'app` con una sessione. Sotto i 768 px pagine, lingua e azione stanno in un menu
 * `details` nativo, che si apre anche prima dell'idratazione senza JavaScript dedicato.
 * `path` è la pagina corrente senza prefisso di lingua, per lingua e voce attiva.
 */
function SiteHeader({ path, signedIn }: { path: string; signedIn: boolean }) {
  const { t, language } = useCopy();
  const action = signedIn
    ? { href: `${localizedPath(language)}?${visitParam}=0`, label: t.site.openApp }
    : { href: localizedPath(language, accessPath), label: t.site.signIn };
  const links = (className: string) =>
    navItems.map((item) => (
      <a
        key={item.key}
        href={localizedPath(language, item.path)}
        aria-current={path === item.path ? "page" : undefined}
        className={cn(
          "rounded-md text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:font-medium aria-[current=page]:text-foreground",
          className,
        )}
      >
        {t.site.nav[item.key]}
      </a>
    ));
  const languageSwitch = (
    <LanguageSwitch
      label={t.access.language}
      current={language}
      hrefFor={(code) => localizedPath(code, path)}
      reloadDocument
    />
  );
  return (
    <header className="relative border-b bg-background">
      <div className={cn(siteColumn, "flex h-16 items-center gap-6")}>
        <a
          href={localizedPath(language)}
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <Logo className="h-7 w-auto" />
        </a>
        <nav aria-label={t.site.nav.label} className="hidden gap-1 text-sm md:flex">
          {links("px-2.5 py-1.5")}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {languageSwitch}
          <a href={action.href} {...buttonLink({ size: "sm" })}>
            {action.label}
          </a>
        </div>
        <details
          className="group ml-auto md:hidden"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}
        >
          <summary
            aria-label={t.site.nav.menu}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "list-none [&::-webkit-details-marker]:hidden",
            )}
          >
            <MenuIcon aria-hidden="true" />
          </summary>
          <div className="absolute inset-x-0 top-full z-40 border-b bg-popover shadow-md">
            <div className={cn(siteColumn, "grid gap-4 py-4")}>
              <nav aria-label={t.site.nav.label} className="grid text-base">
                {links("flex min-h-11 items-center px-2")}
              </nav>
              {languageSwitch}
              <a href={action.href} {...buttonLink({ size: "lg" })}>
                {action.label}
              </a>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

/** Pagina pubblica: barra superiore, contenuto e footer comune. */
export function SiteLayout({
  path,
  signedIn,
  children,
}: {
  path: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader path={path} signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Apertura delle pagine interne: titolo e, se serve, una frase introduttiva. */
export function PageIntro({ title, lead }: { title: string; lead?: string }) {
  return (
    <section className="border-b bg-muted/40">
      <div className={cn(siteColumn, "grid gap-3 py-12 sm:py-16")}>
        <h1 className="text-3xl leading-tight font-semibold text-balance sm:text-4xl">{title}</h1>
        {lead ? (
          <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
            {lead}
          </p>
        ) : null}
      </div>
    </section>
  );
}
