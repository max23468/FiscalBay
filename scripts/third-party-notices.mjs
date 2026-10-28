/**
 * Avvisi delle licenze di terze parti per il codice e i font che il browser riceve: i pacchetti
 * si ricavano dai moduli e dagli asset della build client, così l'elenco segue ciò che viene
 * distribuito davvero. Il bundle minificato non conserva i commenti di licenza.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const noticesFile = "third-party-notices.txt";

const licenseFile = /^(?:licen[cs]e|copying|ofl)(?:[-.].*)?$/iu;

/**
 * Cartella del pacchetto che contiene il file, oppure null fuori da `node_modules`.
 * @param {string} file
 */
export function packageRoot(file) {
  const parts = file.split(/[\\/]/u);
  const index = parts.lastIndexOf("node_modules");
  if (index < 0 || index === parts.length - 1) return null;
  const length = parts[index + 1]?.startsWith("@") ? 2 : 1;
  if (index + length >= parts.length) return null;
  return parts.slice(0, index + 1 + length).join("/");
}

/** @typedef {{ name: string; version: string; license: string; texts: string[] }} NoticePackage */

/**
 * Nome, versione, licenza dichiarata e testi di licenza di un pacchetto.
 * @param {string} root
 * @returns {NoticePackage}
 */
export function readPackage(root) {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const texts = readdirSync(root)
    .filter((name) => licenseFile.test(name))
    .sort()
    .map((name) => readFileSync(path.join(root, name), "utf8").trim());
  return {
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? "non dichiarata",
    texts,
  };
}

/**
 * Testo degli avvisi, un pacchetto per sezione in ordine di nome.
 * @param {Iterable<NoticePackage>} packages
 */
export function formatNotices(packages) {
  const sections = [...packages]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, version, license, texts }) =>
      [
        `${name} ${version}`,
        `Licenza: ${license}`,
        texts.length ? texts.join("\n\n") : "Il pacchetto non include il testo della licenza.",
      ].join("\n\n"),
    );
  return [
    "FiscalBay: componenti di terze parti distribuiti nell'applicazione web.",
    ...sections,
  ].join(`\n\n${"-".repeat(72)}\n\n`);
}
