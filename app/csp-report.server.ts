import { canonicalPath } from "./i18n";
import { writeLog } from "./log-records";

/**
 * Violazione della CSP ridotta ai campi che servono a trovarne la causa. Indirizzi e codice
 * possono contenere identificativi o dati dell'utente: restano soltanto parole chiave del
 * browser, origini esterne, i primi due segmenti dei percorsi dell'app e, per gli script inline,
 * i primi 40 caratteri del codice, che è dell'app.
 */
export interface CspViolation {
  directive: string;
  disposition: "enforce" | "report";
  blocked: string;
  page: string;
  source?: string;
  line?: number;
  column?: number;
  sample?: string;
}

/** Segnalazioni registrate per richiesta: un lotto più grande è rumore o un abuso. */
export const maxViolationsPerReport = 5;

/** Valori di `blockedURL` che il browser usa al posto di un indirizzo. */
const blockedKeywords = new Set([
  "inline",
  "eval",
  "wasm-eval",
  "data",
  "blob",
  "self",
  "trusted-types-policy",
  "trusted-types-sink",
]);

const directives = /^[a-z-]{3,40}$/u;

/** Percorso dell'app ridotto ai primi due segmenti, senza lingua: gli altri sono identificativi. */
function shortPath(pathname: string) {
  return `/${canonicalPath(pathname).split("/").filter(Boolean).slice(0, 2).join("/")}`;
}

/** Indirizzo dell'origine ridotto al percorso breve; uno esterno alla sola origine. */
function reportedUrl(value: unknown, origin: string): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (blockedKeywords.has(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "other";
  }
  if (url.origin === origin) return shortPath(url.pathname);
  return ["http:", "https:"].includes(url.protocol) ? url.origin : url.protocol.slice(0, -1);
}

const position = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 10_000_000
    ? value
    : undefined;

/**
 * Campione del codice: per Trusted Types soltanto il punto del DOM coinvolto, mai il valore
 * scritto; per uno script inline i primi caratteri del codice dell'app; per il resto nulla.
 */
function reportedSample(sample: unknown, directive: string, blocked: string) {
  if (typeof sample !== "string" || !sample) return undefined;
  if (directive === "require-trusted-types-for") return sample.split("|")[0]!.slice(0, 40);
  return blocked === "inline" ? sample.slice(0, 40) : undefined;
}

type Fields = Record<string, unknown>;

/** Corpo di una segnalazione nei due formati: Reporting API e `report-uri`. */
function bodies(payload: unknown): Fields[] {
  if (Array.isArray(payload))
    return payload.flatMap((report) =>
      report && typeof report === "object" && (report as Fields).type === "csp-violation"
        ? [(report as Fields).body as Fields].filter((body) => body && typeof body === "object")
        : [],
    );
  const legacy = (payload as Fields | null)?.["csp-report"];
  if (!legacy || typeof legacy !== "object") return [];
  const fields = legacy as Fields;
  return [
    {
      documentURL: fields["document-uri"],
      effectiveDirective: fields["effective-directive"] ?? fields["violated-directive"],
      blockedURL: fields["blocked-uri"],
      disposition: fields.disposition,
      sourceFile: fields["source-file"],
      lineNumber: fields["line-number"],
      columnNumber: fields["column-number"],
      sample: fields["script-sample"],
    },
  ];
}

/**
 * Violazioni valide di una segnalazione, al più `maxViolationsPerReport`: quelle di documenti di
 * altre origini, come pagine salvate o estensioni, non riguardano l'app e si scartano.
 */
export function cspViolations(payload: unknown, origin: string): CspViolation[] {
  return bodies(payload)
    .flatMap((body): CspViolation[] => {
      const directive = String(body.effectiveDirective ?? "").split(" ")[0]!;
      if (!directives.test(directive) || typeof body.documentURL !== "string") return [];
      let document: URL;
      try {
        document = new URL(body.documentURL);
      } catch {
        return [];
      }
      if (document.origin !== origin) return [];
      const blocked = reportedUrl(body.blockedURL, origin) ?? "inline";
      return [
        {
          directive,
          disposition: body.disposition === "report" ? "report" : "enforce",
          blocked,
          page: shortPath(document.pathname),
          source: reportedUrl(body.sourceFile, origin),
          line: position(body.lineNumber),
          column: position(body.columnNumber),
          sample: reportedSample(body.sample, directive, blocked),
        },
      ];
    })
    .slice(0, maxViolationsPerReport);
}

/** Registra le violazioni nei log del Worker, una riga per violazione. */
export function logCspViolations(violations: CspViolation[]) {
  for (const violation of violations)
    writeLog("info", {
      event: "csp_violation",
      ...Object.fromEntries(Object.entries(violation).filter(([, value]) => value !== undefined)),
    });
}
