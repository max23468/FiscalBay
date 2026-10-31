import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { loadCopy } from "./app-copy";

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
