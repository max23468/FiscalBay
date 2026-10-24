import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/**
 * Errori raccolti dalla pagina della prova: `pageErrors` le sole eccezioni non gestite,
 * `browserErrors` anche i messaggi `console.error`. I listener partono solo se la prova li usa.
 */
export const test = base.extend<{ pageErrors: string[]; browserErrors: string[] }>({
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
