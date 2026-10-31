import { env } from "cloudflare:workers";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useMatches,
  useRouteLoaderData,
  useRevalidator,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { useEffect } from "react";

import { CircleAlert, FileQuestion } from "lucide-react";

import type { Route } from "./+types/root";
import { LinksProvider } from "./components/copy-context";
import { UnavailablePage } from "./components/not-found";
import { StandalonePage } from "./components/standalone-page";
import { TimeZoneContext } from "./components/time-zone";
import { buttonLink } from "./components/ui/button-variants";
import { correlationId } from "./errors";
import { appCopy, loadCopy, pageTitle } from "./app-copy";
import { appBase, previewBase } from "./app-links";
import { languageFromPath, localizedPath } from "./i18n";
import { revalidateUnlessSnapshot } from "./orders/order-list";
import { defaultDisplay, matchedShell } from "./preferences";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

// Facoltativo: dichiararlo con `bindings.secret()` lo renderebbe obbligatorio in ogni ambiente.
declare global {
  namespace Cloudflare {
    interface Env {
      WEB_ANALYTICS_TOKEN?: string;
    }
  }
}

export function loader({ request }: Route.LoaderArgs) {
  return {
    language: languageFromPath(new URL(request.url).pathname),
    correlationId: correlationId(request),
    // Chiave pubblica del widget Turnstile dell'ambiente, per i moduli che la usano.
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    // Token pubblico del sito Web Analytics dell'ambiente; senza, le pagine pubbliche non
    // caricano il beacon, come in locale e nelle prove.
    webAnalyticsToken: env.WEB_ANALYTICS_TOKEN ?? null,
  };
}

/** Una navigazione verso l'altra lingua ne scarica i testi prima di caricare e disegnare. */
// oxlint-disable-next-line react-doctor/only-export-components -- export di React Router assente dall'elenco della regola
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ request }) => loadCopy(new URL(request.url).pathname),
];

/** L'istantanea aggiunta all'elenco Ordini non cambia lingua né pagina: nessuna nuova lettura. */
export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return revalidateUnlessSnapshot(args);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const location = useLocation();
  const language = data?.language ?? languageFromPath(location.pathname);
  // Nell'area dell'account tema e fuso sono quelli scelti; altrove valgono i predefiniti.
  const display = matchedShell(useMatches())?.display ?? defaultDisplay;
  return (
    <html lang={language} data-theme={display.theme === "system" ? undefined : display.theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <TimeZoneContext value={display.timeZone}>{children}</TimeZoneContext>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const preview = new RegExp(`^(/en)?${previewBase}(/|$)`, "u").test(pathname);
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!/^\/(en\/)?(app(?:\/|$)|accesso$)/u.test(pathname)) return;
    let refreshing = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      void revalidator.revalidate().finally(() => {
        refreshing = false;
      });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, revalidator]);
  return (
    <LinksProvider value={{ language: loaderData.language, base: preview ? previewBase : appBase }}>
      <Outlet />
    </LinksProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  const root = useRouteLoaderData<typeof loader>("root");
  const language = root?.language ?? languageFromPath(location.pathname);
  const reference = root?.correlationId;
  const t = appCopy[language].errors;
  const status = isRouteErrorResponse(error) ? error.status : 500;
  // Auth o database non rispondono: la stessa pagina si riapre appena tornano disponibili.
  if (status === 503) return <UnavailablePage language={language} reference={reference} />;
  const home = localizedPath(language);
  const page =
    status === 404
      ? { icon: FileQuestion, tone: "neutral" as const, title: t.notFoundTitle, body: t.notFound }
      : { icon: CircleAlert, tone: "rose" as const, title: t.title, body: t.unexpected };
  return (
    <StandalonePage icon={page.icon} tone={page.tone} title={page.title} homeHref={home}>
      <title>{pageTitle(page.title)}</title>
      <p className="leading-relaxed text-pretty text-muted-foreground">{page.body}</p>
      {status !== 404 && reference ? (
        <p className="font-code text-xs text-muted-foreground">{t.reference(reference)}</p>
      ) : null}
      <a href={home} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {t.home}
      </a>
    </StandalonePage>
  );
}
