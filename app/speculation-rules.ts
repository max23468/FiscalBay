import { accessPath, appBase, authErrorPath, previewBase, visitParam } from "./app-links";
import { languages, localizedPath } from "./i18n";

/**
 * Sezioni che non si precaricano: area dell'account, accesso, console, API, anteprima ed errori di
 * accesso dipendono dalla sessione o cambiano stato; nelle due lingue.
 */
const privateSections = [appBase, accessPath, "/admin", "/api", previewBase, authErrorPath];

/**
 * Regole di speculazione delle pagine pubbliche: il browser precarica un link del sito quando il
 * puntatore vi si ferma o il dito lo tocca (`moderate`). Restano fuori le sezioni private, la
 * scelta «Visita il sito» o «Apri l'app», che scrive un cookie, e, con la sessione, la home, che
 * porterebbe agli Ordini.
 */
export function speculationRules(signedIn: boolean): string {
  const excluded = languages.flatMap((language) => {
    const sections = privateSections.map((path) => localizedPath(language, path));
    return [
      ...sections.flatMap((path) => [path, `${path}/*`]),
      ...(signedIn ? [localizedPath(language)] : []),
    ];
  });
  return JSON.stringify({
    prefetch: [
      {
        source: "document",
        where: {
          and: [
            { href_matches: "/*" },
            ...excluded.map((pattern) => ({ not: { href_matches: pattern } })),
            { not: { href_matches: `/*\\?*(^|&)${visitParam}=*` } },
          ],
        },
        eagerness: "moderate",
      },
    ],
  });
}
