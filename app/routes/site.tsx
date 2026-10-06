import { env } from "cloudflare:workers";
import { cn } from "cn";
import { ClipboardList, Copy, Store } from "lucide-react";
import { redirect } from "react-router";

import { LanguageSwitch } from "~/components/language-switch";
import { Logo } from "~/components/standalone-page";
import { buttonVariants } from "~/components/ui/button-variants";
import { appCopy } from "../app-copy";
import { accessPath, ordersPath, visitCookie, visitParam } from "../app-links";
import { createAuth } from "../auth.server";
import { tracePhase } from "../errors";
import { languageFromPath, languages, localizedPath } from "../i18n";
import type { Route } from "./+types/site";

const noStore = { "cache-control": "no-store" };

/**
 * Radice pubblica. Con la sessione porta agli Ordini, salvo la scelta «Visita fiscalbay.it»:
 * il parametro diventa un cookie di sessione del browser e l'indirizzo torna pulito, così la
 * pagina resta una sola e non c'è un ciclo fra sito e app. La risposta dipende dalla sessione:
 * nessuna cache la conserva.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const visit = url.searchParams.get(visitParam);
  if (visit !== null) {
    const leaving = visit === "0";
    const secure = env.APP_ORIGIN.startsWith("https:") ? "; Secure" : "";
    const headers = new Headers(noStore);
    headers.append(
      "set-cookie",
      `${visitCookie}=${leaving ? "; Max-Age=0" : "1"}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    throw redirect(localizedPath(language, leaving ? ordersPath : "/"), { headers });
  }
  const visiting = (request.headers.get("cookie") ?? "")
    .split(";")
    .some((cookie) => cookie.trim() === `${visitCookie}=1`);
  const auth = createAuth(env);
  await auth.$context;
  const session = await auth.api.getSession({ headers: request.headers });
  tracePhase(request, "session");
  if (session && !visiting) {
    throw redirect(localizedPath(language, ordersPath), { headers: noStore });
  }
  return { language, signedIn: Boolean(session), origin: new URL(env.APP_ORIGIN).origin };
}

export function headers(): HeadersInit {
  return noStore;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaderData) return [];
  const { language, origin } = loaderData;
  const t = appCopy[language].site;
  return [
    { title: `FiscalBay | ${t.title}` },
    { name: "description", content: t.description },
    { tagName: "link", rel: "canonical", href: `${origin}${localizedPath(language)}` },
    ...languages.map((code) => ({
      tagName: "link",
      rel: "alternate",
      hrefLang: code,
      href: `${origin}${localizedPath(code)}`,
    })),
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: `${origin}/` },
  ];
}

// Sulla fascia blu i pulsanti restano chiari anche al passaggio e nel tema scuro.
const onBrand = "bg-white text-brand-navy hover:bg-white/90 hover:text-brand-navy";

const featureIcons = [
  { Icon: ClipboardList, className: "text-brand-sky" },
  { Icon: Copy, className: "text-[#f5c451]" },
  { Icon: Store, className: "text-[#5fd0c9]" },
];

export default function Site({ loaderData }: Route.ComponentProps) {
  const { language, signedIn } = loaderData;
  const t = appCopy[language].site;
  const { features } = appCopy[language].access;
  const access = localizedPath(language, accessPath);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-[min(72rem,calc(100%-2rem))] items-center justify-between gap-4 py-4">
        <Logo className="h-7 w-auto" />
        <LanguageSwitch
          label={appCopy[language].access.language}
          current={language}
          hrefFor={(code) => localizedPath(code)}
          reloadDocument
        />
      </header>
      <main className="flex-1">
        <section className="relative overflow-hidden bg-brand-navy text-white">
          {/* Righe della tessera del logo, come nella pagina di accesso. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -bottom-16 grid rotate-[-8deg] gap-6 opacity-25"
          >
            <span className="h-8 w-[28rem] rounded-full bg-brand-sky" />
            <span className="h-8 w-80 rounded-full bg-brand-green" />
            <span className="h-8 w-40 rounded-full bg-brand-red" />
          </div>
          <div className="relative mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-6 py-16 sm:py-24">
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold text-balance sm:text-5xl">
              {t.hero}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-pretty text-white/80">{t.body}</p>
            <div className="flex flex-wrap gap-3">
              {signedIn ? (
                <a
                  href={`${localizedPath(language)}?${visitParam}=0`}
                  className={cn(buttonVariants({ size: "lg" }), onBrand)}
                >
                  {t.openApp}
                </a>
              ) : (
                <>
                  <a
                    href={`${access}?registrati`}
                    className={cn(buttonVariants({ size: "lg" }), onBrand)}
                  >
                    {t.start}
                  </a>
                  <a
                    href={access}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent dark:hover:bg-white/10",
                    )}
                  >
                    {t.signIn}
                  </a>
                </>
              )}
            </div>
          </div>
        </section>
        <section className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-8 py-12">
          <ul className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => {
              const { Icon, className } = featureIcons[index]!;
              return (
                <li key={feature.title} className="grid content-start gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-lg bg-brand-navy"
                  >
                    <Icon className={cn("size-5", className)} />
                  </span>
                  <h2 className="font-semibold">{feature.title}</h2>
                  <p className="leading-relaxed text-pretty text-muted-foreground">
                    {feature.body}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="text-pretty text-muted-foreground">{t.trust}</p>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-[min(72rem,calc(100%-2rem))] flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground">
          <p>{t.independent}</p>
          <nav aria-label={appCopy[language].legal.navigation} className="flex flex-wrap gap-4">
            <a href={localizedPath(language, "/termini")} className="underline underline-offset-4">
              {appCopy[language].legal.termini}
            </a>
            <a href={localizedPath(language, "/privacy")} className="underline underline-offset-4">
              {appCopy[language].legal.privacy}
            </a>
            <a href="mailto:supporto@fiscalbay.it" className="underline underline-offset-4">
              {t.support}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
