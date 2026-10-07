import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";

import { cn } from "cn";
import { CircleAlert, FileQuestion } from "lucide-react";

import type { Route } from "./+types/root";
import { StandalonePage } from "./components/standalone-page";
import { buttonVariants } from "./components/ui/button-variants";
import { correlationId } from "./errors";
import { appCopy } from "./app-copy";
import { languageFromPath, localizedPath } from "./i18n";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export function loader({ request }: Route.LoaderArgs) {
  return {
    language: languageFromPath(new URL(request.url).pathname),
    correlationId: correlationId(request),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const location = useLocation();
  const language = data?.language ?? languageFromPath(location.pathname);
  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  const language =
    useRouteLoaderData<typeof loader>("root")?.language ?? languageFromPath(location.pathname);
  const reference = useRouteLoaderData<typeof loader>("root")?.correlationId;
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const t = appCopy[language].errors;

  const title = notFound ? t.notFoundTitle : t.title;
  return (
    <StandalonePage
      icon={notFound ? FileQuestion : CircleAlert}
      tone={notFound ? "neutral" : "rose"}
      title={title}
      homeHref={localizedPath(language)}
    >
      <title>{`FiscalBay | ${title}`}</title>
      <p className="leading-relaxed text-pretty text-muted-foreground">
        {notFound ? t.notFound : t.unexpected}
      </p>
      {!notFound && reference ? (
        <p className="font-code text-xs text-muted-foreground">{t.reference(reference)}</p>
      ) : null}
      <a
        href={localizedPath(language)}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.home}
      </a>
    </StandalonePage>
  );
}
