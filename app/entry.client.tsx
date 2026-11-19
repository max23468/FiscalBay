import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { loadCopy } from "./app-copy";
import { setUpInstalledApp } from "./installed-app";
import { installTrustedTypes } from "./trusted-types";

// Prima di ogni scrittura nel DOM: anche l'idratazione passa dalla policy.
installTrustedTypes(window as Parameters<typeof installTrustedTypes>[0], location.origin);

// Prima dell'attesa dei testi: il browser può offrire l'installazione subito.
setUpInstalledApp(window);

// Il browser scarica soltanto i testi della lingua della pagina, prima di idratarla.
await loadCopy(location.pathname);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
