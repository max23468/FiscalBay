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
import { I18nextProvider } from "react-i18next";

import type { Route } from "./+types/root";
import { TooltipProvider } from "./components/ui/tooltip";
import { correlationId } from "./errors";
import { i18n, languageFromPath, translate } from "./i18n";
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
        <I18nextProvider i18n={i18n}>
          <TooltipProvider>{children}</TooltipProvider>
        </I18nextProvider>
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

  return (
    <main className="mx-auto grid w-[min(36rem,calc(100%-2rem))] gap-3 py-16">
      <h1 className="text-3xl font-bold">{notFound ? "404" : translate(language, "errorTitle")}</h1>
      <p>{translate(language, notFound ? "notFound" : "unexpected")}</p>
      {!notFound && reference ? (
        <p className="text-sm text-muted-foreground">
          {translate(language, "errorReference", { id: reference })}
        </p>
      ) : null}
    </main>
  );
}
