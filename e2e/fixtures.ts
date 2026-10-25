import { setTimeout as delay } from "node:timers/promises";
import { test as base, type BrowserContext, type Page, type Request } from "@playwright/test";

export { expect } from "@playwright/test";

interface Traffic {
  pending: Set<Request>;
  /** Navigazione del frame principale non ancora confermata da un nuovo documento. */
  navigation: Request | null;
  changed: number;
}

const traffic = new WeakMap<BrowserContext, WeakMap<Page, Traffic>>();

/**
 * Osserva le richieste delle pagine del contesto per `networkIdle`. Il contesto della prova lo è
 * già; un contesto creato nella prova va osservato prima di aprirne le pagine.
 */
export function watchNetwork(context: BrowserContext) {
  if (traffic.has(context)) return;
  const pages = new WeakMap<Page, Traffic>();
  traffic.set(context, pages);
  const state = (page: Page) => {
    let current = pages.get(page);
    if (!current) {
      current = { pending: new Set(), navigation: null, changed: Date.now() };
      pages.set(page, current);
      const tracked = current;
      // Come in Playwright, il nuovo documento chiude le richieste del precedente: Chromium non
      // ne riporta sempre la fine, per esempio di un modulo caricato mentre si lascia la pagina.
      // Conta l'arrivo all'indirizzo richiesto, non un cambio di cronologia nel frattempo.
      page.on("framenavigated", (frame) => {
        const target = tracked.navigation?.url();
        if (frame !== page.mainFrame() || frame.url().split("#")[0] !== target) return;
        tracked.pending = new Set(
          [...tracked.pending].filter((request) => request === tracked.navigation),
        );
        tracked.navigation = null;
        tracked.changed = Date.now();
      });
    }
    return current;
  };
  for (const page of context.pages()) state(page);
  context.on("page", state);
  context.on("request", (request) => {
    if (request.serviceWorker()) return;
    const frame = request.frame();
    const current = state(frame.page());
    if (request.isNavigationRequest() && frame === frame.page().mainFrame())
      current.navigation = request;
    current.pending.add(request);
    current.changed = Date.now();
  });
  const done = (request: Request) => {
    if (request.serviceWorker()) return;
    const current = state(request.frame().page());
    if (current.pending.delete(request)) current.changed = Date.now();
  };
  context.on("requestfinished", done);
  context.on("requestfailed", done);
}

/**
 * Rete ferma: dopo `load`, nessuna richiesta della pagina in corso per 500 ms. Sostituisce
 * `waitForLoadState("networkidle")`, che Playwright ritira all'evento `load` se è scattato prima
 * e nel frattempo sono partite richieste, senza poi riarmarlo: su WebKit lento accade con i testi
 * della lingua importati da `entry.client` prima dell'idratazione, e l'attesa non finisce più.
 */
export async function networkIdle(page: Page) {
  const pages = traffic.get(page.context());
  if (!pages) throw new Error("Rete del contesto non osservata: chiamare watchNetwork(context).");
  await page.waitForLoadState("load");
  for (;;) {
    const current = pages.get(page);
    if (!current || (current.pending.size === 0 && Date.now() - current.changed >= 500)) return;
    if (page.isClosed()) throw new Error("Pagina chiusa durante l'attesa della rete.");
    await delay(50);
  }
}

/**
 * Errori raccolti dalla pagina della prova: `pageErrors` le sole eccezioni non gestite,
 * `browserErrors` anche i messaggi `console.error`. I listener partono solo se la prova li usa.
 */
export const test = base.extend<{ pageErrors: string[]; browserErrors: string[] }>({
  context: async ({ context }, use) => {
    watchNetwork(context);
    await use(context);
  },
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
  },
  browserErrors: async ({ page, pageErrors }, use) => {
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
    await use(pageErrors);
  },
});
