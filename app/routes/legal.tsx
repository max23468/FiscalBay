import { cn } from "cn";
import type { ReactNode } from "react";

import { siteColumn } from "~/components/site-column";
import { PageIntro, SiteLayout } from "~/components/site-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { Route } from "./+types/legal";
import { appCopy, infoEmail } from "../app-copy";
import { legalDocuments, type LegalBlock } from "../copy/legal-documents.server";
import { sitePages } from "../copy/site-pages.server";
import { privacyPath, termsPath } from "../app-links";
import { legalVersions } from "../domain/registration.server";
import { publicPage } from "../site.server";
import { siteMeta } from "../site-meta";

const documents = {
  termini: { version: "terms", path: termsPath },
  privacy: { version: "privacy", path: privacyPath },
} as const;

/**
 * Termini e Privacy: pubblici ma `noindex` e fuori dalla sitemap (D204), con l'operatore
 * Temisfera, che non compare altrove nel sito.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { language, origin, session } = await publicPage(request);
  const document: keyof typeof documents = new URL(request.url).pathname.endsWith(privacyPath)
    ? "privacy"
    : "termini";
  return {
    language,
    origin,
    signedIn: Boolean(session),
    document,
    version: legalVersions[documents[document].version],
    description: sitePages[language].legal.description[document],
    sections: legalDocuments[language][document],
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const { language, origin, document, description } = loaderData;
  const t = appCopy[language].legal;
  return siteMeta({
    language,
    origin,
    path: documents[document].path,
    title: t[document],
    description,
  });
}

/** Il contatto dentro il testo, al più una volta per blocco, diventa un collegamento email. */
function withEmail(text: string): ReactNode {
  const at = text.indexOf(infoEmail);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a href={`mailto:${infoEmail}`} className="underline underline-offset-4">
        {infoEmail}
      </a>
      {text.slice(at + infoEmail.length)}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string")
    return <p className="leading-relaxed text-pretty">{withEmail(block)}</p>;
  if ("items" in block)
    return (
      <ul className="grid list-disc gap-2 pl-5 leading-relaxed text-pretty">
        {block.items.map((item) => (
          <li key={item}>{withEmail(item)}</li>
        ))}
      </ul>
    );
  // Sotto i 640 px tre colonne non si leggono: ogni riga diventa una scheda con le stesse voci.
  return (
    <>
      <ul className="grid gap-3 sm:hidden">
        {block.rows.map(([label, ...cells]) => (
          <li key={label} className="grid gap-2 rounded-xl border p-4 text-sm leading-relaxed">
            <p className="font-medium text-pretty">{label}</p>
            <dl className="grid gap-2">
              {block.head.slice(1).map((term, index) => (
                <div key={term}>
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-pretty">{cells[index]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <Table container={{ className: "hidden sm:block" }}>
        <TableHeader>
          <TableRow>
            {block.head.map((cell) => (
              <TableHead key={cell} className="whitespace-normal">
                {cell}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.rows.map(([label, ...cells]) => (
            <TableRow key={label}>
              <TableHead scope="row" className="align-top font-normal whitespace-normal">
                {label}
              </TableHead>
              {block.head.slice(1).map((term, index) => (
                <TableCell key={term} className="align-top whitespace-normal">
                  {cells[index]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export default function Legal({ loaderData }: Route.ComponentProps) {
  const { language, signedIn, document, version, sections } = loaderData;
  const t = appCopy[language].legal;
  return (
    <SiteLayout path={documents[document].path} signedIn={signedIn}>
      <PageIntro title={t[document]} />
      <div className={cn(siteColumn, "py-12 sm:py-16")}>
        <div className="grid max-w-3xl gap-10">
          <p className="text-sm text-muted-foreground">{t.version(version)}</p>
          {sections.map((section, index) => (
            <section
              key={section.title}
              aria-labelledby={`sezione-${index + 1}`}
              className="grid gap-3"
            >
              <h2 id={`sezione-${index + 1}`} className="text-xl font-semibold">
                {index + 1}. {section.title}
              </h2>
              {section.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
