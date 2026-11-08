import { beforeEach } from "vitest";

import { whatsNewReleases } from "../../app/whats-new.server";

// Le prove non dipendono dalle Novità del changelog versionato, che fuori da Production
// compaiono nella campanella e nelle Impostazioni: la prova delle Novità le imposta da sé.
beforeEach(() => {
  whatsNewReleases().length = 0;
});
