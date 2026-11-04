/**
 * Frammenti delle PR in `changes/`: le voci del changelog di ciascuna PR, riunite alla build nella
 * versione in cima. JavaScript puro perché lo leggono anche gli script della CI prima di
 * installare il Node del progetto, oltre alla build e alle prove.
 */

/** Gruppi delle voci, nell'ordine della pagina, con il titolo `####` in ciascuna lingua. */
export const whatsNewKinds = /** @type {const} */ ({
  features: { it: "Funzionalità", en: "Features" },
  improvements: { it: "Miglioramenti", en: "Improvements" },
  fixes: { it: "Correzioni", en: "Fixes" },
});

/** Titoli `###` delle parti con le Novità, in ciascuna lingua. */
export const headings = /** @type {const} */ ({ it: "Novità", en: "What's new" });

/** Parti della versione nell'ordine del changelog; le altre seguono. */
const partOrder = ["Novità", "What's new", "Altre modifiche"];

/**
 * Gruppi `####` di una parte nella sua lingua, nell'ordine della pagina.
 * @param {string} partTitle
 * @returns {string[]}
 */
const groupOrder = (partTitle) =>
  Object.values(whatsNewKinds).map((titles) => (partTitle === headings.en ? titles.en : titles.it));

/**
 * Indice dopo l'ultima riga non vuota fra `start` e `end`.
 * @param {string[]} lines
 * @param {number} start
 * @param {number} end
 */
const afterContent = (lines, start, end) => {
  let index = end;
  while (index > start && !lines[index - 1].trim()) index -= 1;
  return index;
};

/**
 * Fine del blocco che inizia a `start`: la riga che apre un livello uguale o superiore.
 * @param {string[]} lines
 * @param {number} start
 * @param {number} end
 * @param {string[]} levels
 */
const blockEnd = (lines, start, end, levels) => {
  for (let index = start + 1; index < end; index++)
    if (levels.some((level) => lines[index].startsWith(level))) return index;
  return end;
};

/**
 * Voci nuove di un blocco: dopo un titolo serve una riga vuota, dopo una voce no.
 * @param {string[]} lines
 * @param {number} start
 * @param {number} end
 * @param {string[]} entries
 */
const spaced = (lines, start, end, entries) => {
  const last = lines[afterContent(lines, start, end) - 1] ?? "";
  return last.startsWith("#") ? ["", ...entries] : entries;
};

/**
 * Parte `## Changelog` di un frammento di `changes/`: parti `###` della versione in preparazione,
 * con gruppi `####` e voci. Una PR aggiunge il proprio frammento invece di modificare la sezione
 * in cima, così più PR aperte non si contendono le stesse righe.
 * @param {string} fragment
 * @returns {Array<{ title: string; groups: Array<{ title: string | null; lines: string[] }> }>}
 */
export function fragmentEntries(fragment) {
  const lines = fragment.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Changelog");
  if (start === -1) return [];
  const end = blockEnd(lines, start, lines.length, ["## "]);
  /** @type {Array<{ title: string; groups: Array<{ title: string | null; lines: string[] }> }>} */
  const parts = [];
  for (const line of lines.slice(start + 1, end)) {
    if (line.startsWith("### ")) parts.push({ title: line.slice(4).trim(), groups: [] });
    else if (!parts.length) continue;
    else if (line.startsWith("#### "))
      parts[parts.length - 1].groups.push({ title: line.slice(5).trim(), lines: [] });
    else if (line.trim()) {
      // Le voci senza gruppo, come quelle di «Altre modifiche», stanno nella parte.
      const { groups } = parts[parts.length - 1];
      if (!groups.length) groups.push({ title: null, lines: [] });
      groups[groups.length - 1].lines.push(line);
    }
  }
  return parts.filter(({ groups }) => groups.some(({ lines: own }) => own.length));
}

/**
 * Changelog con le voci dei frammenti nella versione in cima, o in quella indicata, ciascuna nella
 * propria parte e nel proprio gruppo, dopo le voci già presenti e nell'ordine dei frammenti. Parti
 * e gruppi mancanti si aggiungono nell'ordine della pagina. È il changelog che build, note di
 * rilascio e controlli leggono; il giorno della pubblicazione lo scrive in `CHANGELOG.md`, nella
 * versione pubblicata anche se nel frattempo ne è stata aperta un'altra.
 * @param {string} changelog
 * @param {string[]} fragments
 * @param {string} [version]
 */
export function withChanges(changelog, fragments, version) {
  const lines = changelog.split("\n");
  const top = lines.findIndex((line) =>
    version ? /^## \[?([^\]\s]+)\]?/u.exec(line)?.[1] === version : line.startsWith("## "),
  );
  if (top === -1) return changelog;
  for (const fragment of fragments)
    for (const part of fragmentEntries(fragment)) {
      const end = blockEnd(lines, top, lines.length, ["## "]);
      let start = lines.findIndex(
        (line, index) => index > top && index < end && line.trim() === `### ${part.title}`,
      );
      if (start === -1) {
        const order = partOrder.indexOf(part.title);
        const next = lines.findIndex((line, index) => {
          if (index <= top || index >= end || !line.startsWith("### ")) return false;
          const position = partOrder.indexOf(line.slice(4).trim());
          return order !== -1 && (position === -1 || position > order);
        });
        const at = afterContent(lines, top, next === -1 ? end : next);
        lines.splice(at, 0, "", `### ${part.title}`);
        start = at + 1;
      }
      for (const group of part.groups) {
        const partEnd = blockEnd(lines, start, blockEnd(lines, top, lines.length, ["## "]), [
          "## ",
          "### ",
        ]);
        if (group.title === null) {
          lines.splice(
            afterContent(lines, start, partEnd),
            0,
            ...spaced(lines, start, partEnd, group.lines),
          );
          continue;
        }
        const own = lines.findIndex(
          (line, index) =>
            index > start && index < partEnd && line.trim() === `#### ${group.title}`,
        );
        if (own !== -1) {
          const groupEnd = blockEnd(lines, own, partEnd, ["## ", "### ", "#### "]);
          lines.splice(
            afterContent(lines, own, groupEnd),
            0,
            ...spaced(lines, own, groupEnd, group.lines),
          );
          continue;
        }
        const order = groupOrder(part.title);
        const position = order.indexOf(group.title);
        const next = lines.findIndex((line, index) => {
          if (index <= start || index >= partEnd || !line.startsWith("#### ")) return false;
          const other = order.indexOf(line.slice(5).trim());
          return position !== -1 && (other === -1 || other > position);
        });
        const at = afterContent(lines, start, next === -1 ? partEnd : next);
        lines.splice(at, 0, "", `#### ${group.title}`, "", ...group.lines);
      }
    }
  return lines.join("\n");
}
