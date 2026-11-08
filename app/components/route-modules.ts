import { matchRoutes, type RouteObject } from "react-router";

declare global {
  interface Window {
    __reactRouterManifest?: {
      routes: Record<string, { module: string; imports?: string[] } | undefined>;
    };
    __reactRouterDataRouter?: { routes: RouteObject[] };
  }
}

const requested = new Set<string>();

/**
 * Precarica il codice di una pagina dell'area quando il puntatore o il focus arrivano sul suo
 * link. I dati restano fuori: la risposta è `no-store`, quindi il browser non potrebbe riusarla
 * e il loader lavorerebbe due volte.
 */
export function prefetchRouteModules(href: string) {
  const { __reactRouterManifest: manifest, __reactRouterDataRouter: router } = window;
  if (!manifest || !router) return;
  for (const { route } of matchRoutes(router.routes, href) ?? []) {
    const entry = route.id ? manifest.routes[route.id] : undefined;
    for (const url of entry ? [entry.module, ...(entry.imports ?? [])] : []) {
      if (requested.has(url)) continue;
      requested.add(url);
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = url;
      document.head.appendChild(link);
    }
  }
}
