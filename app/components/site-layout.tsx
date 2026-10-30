import { cn } from "cn";

import { useCopy } from "~/components/copy-context";
import { LanguageSwitch } from "~/components/language-switch";
import { siteColumn } from "~/components/site-column";
import { SiteFooter } from "~/components/site-footer";
import { Logo } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import {
  accessPath,
  faqPath,
  featuresPath,
  pricingPath,
  siteSecurityPath,
  visitParam,
} from "../app-links";
import { localizedPath } from "../i18n";

const navItems = [
  { path: featuresPath, key: "features" },
  { path: pricingPath, key: "pricing" },
  { path: siteSecurityPath, key: "security" },
  { path: faqPath, key: "faq" },
] as const;

/**
 * Barra superiore delle pagine pubbliche (D202): logo, pagine, lingua e `Accedi`, oppure
 * `Apri l'app` con una sessione. Sotto i 768 px le pagine passano in una seconda riga sempre
 * visibile, allineate al logo con spazi uguali, senza menu da aprire, e la lingua mostra il solo codice.
 * `path` è la pagina corrente senza prefisso di lingua, per lingua e voce attiva.
 */
function SiteHeader({ path, signedIn }: { path: string; signedIn: boolean }) {
  const { t, language } = useCopy();
  const action = signedIn
    ? { href: `${localizedPath(language)}?${visitParam}=0`, label: t.site.openApp }
    : { href: localizedPath(language, accessPath), label: t.site.signIn };
  const switchFor = (compact: boolean) => (
    <LanguageSwitch
      label={t.access.language}
      current={language}
      hrefFor={(code) => localizedPath(code, path)}
      reloadDocument
      compact={compact}
    />
  );
  return (
    <header className="border-b bg-background">
      <div
        className={cn(
          siteColumn,
          "flex h-14 items-center gap-2 min-[360px]:gap-3 md:h-16 md:gap-6",
        )}
      >
        <a
          href={localizedPath(language)}
          className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <Logo className="h-5 w-auto min-[360px]:h-6 md:h-7" />
        </a>
        <nav aria-label={t.site.nav.label} className="max-md:hidden">
          <NavLinks path={path} className="gap-1 text-sm" />
        </nav>
        <div className="ml-auto flex items-center gap-1 min-[360px]:gap-2">
          <div className="md:hidden">{switchFor(true)}</div>
          <div className="max-md:hidden">{switchFor(false)}</div>
          <a href={action.href} {...buttonLink({ size: "sm" })}>
            {action.label}
          </a>
        </div>
      </div>
      <nav aria-label={t.site.nav.label} className="border-t md:hidden">
        <NavLinks path={path} className={cn(siteColumn, "gap-5 text-sm min-[360px]:gap-7")} />
      </nav>
    </header>
  );
}

/** Pagine del sito; la voce attiva è sottolineata su smartphone e in grassetto ovunque. */
function NavLinks({ path, className }: { path: string; className: string }) {
  const { t, language } = useCopy();
  return (
    <ul className={cn("flex", className)}>
      {navItems.map((item) => (
        <li key={item.key}>
          <a
            href={localizedPath(language, item.path)}
            aria-current={path === item.path ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-md px-2.5 text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:font-medium aria-[current=page]:text-foreground max-md:rounded-none max-md:border-b-2 max-md:border-transparent max-md:px-0 max-md:aria-[current=page]:border-primary md:min-h-0 md:py-1.5"
          >
            {t.site.nav[item.key]}
          </a>
        </li>
      ))}
    </ul>
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
      <div className={cn(siteColumn, "grid gap-2 py-8 sm:gap-3 sm:py-14")}>
        <h1 className="text-2xl leading-tight font-semibold text-balance sm:text-4xl">{title}</h1>
        {lead ? (
          <p className="max-w-2xl leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {lead}
          </p>
        ) : null}
      </div>
    </section>
  );
}
