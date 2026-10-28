import { strToU8, Zip, ZipDeflate } from "fflate";

/**
 * Cartella XLSX con un solo foglio, scritta in streaming (§12). Le stringhe sono celle di testo
 * in linea con il formato Testo, mai formule: un valore che inizia con `=` resta testo. Importi
 * e quantità sono numeri, date e ore valori di data. Niente macro, collegamenti esterni o
 * hyperlink.
 */

/** Cella del foglio; un valore vuoto lascia la cella vuota. */
export type XlsxCell =
  | { type: "text"; value: string }
  /** Numero decimale esatto come `15.99`, mostrato con le sue cifre decimali. */
  | { type: "number"; value: string }
  /** Data e ora già nel fuso dell'utente, nella forma `AAAA-MM-GG hh:mm:ss`. */
  | { type: "date"; value: string };

/** Righe di un foglio di Excel, intestazione compresa: oltre, il file non si apre per intero. */
export const xlsxMaxRows = 1_048_576;

/**
 * Righe oltre `xlsxMaxRows`: il file non si crea, perché nessun tentativo lo farebbe stare. I
 * log riportano soltanto campi enumerati, quindi l'errore non porta un messaggio.
 */
export class XlsxRowLimitError extends Error {}

export interface XlsxSheet {
  name: string;
  header: string[];
  /** Larghezza di ogni colonna, in caratteri. */
  widths: number[];
  /** Data dei file nell'archivio. */
  modified: Date;
}

/** Dichiarazione e spazi dei nomi delle parti, calcolati a ogni uso. */
function xml() {
  return {
    declaration: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
    main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    relationships: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    package: "http://schemas.openxmlformats.org/package/2006/relationships",
  };
}

/** Stili delle celle, nell'ordine di `cellXfs`. */
const style = {
  header: 1,
  text: 2,
  integer: 3,
  decimal2: 4,
  date: 5,
  decimal3: 6,
} as const;

/**
 * Testo per XML: caratteri non ammessi da XML 1.0 e ritorno a capo come `_xHHHH_`, che Excel
 * riconverte nel carattere; una sequenza `_xHHHH_` già presente nel valore riceve il proprio
 * prefisso, così il foglio mostra gli stessi caratteri della fonte. Un surrogato isolato non è
 * un carattere e diventa U+FFFD.
 */
export function xlsxText(value: string): string {
  return value
    .replace(
      // oxlint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio quelli da codificare
      /_(?=x[\dA-Fa-f]{4}_)|[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDFFF]/gu,
      (match) =>
        /[\uD800-\uDFFF]/u.test(match)
          ? "\uFFFD"
          : `_x${match.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}_`,
    )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Lettere della colonna, da 0: A, B, …, Z, AA. */
export function columnLetters(index: number): string {
  let letters = "";
  // Stryker disable next-line ArithmeticOperator: con un'altra operazione il ciclo non finisce e Stryker lo conta come Timeout; le lettere fino a AAA sono provate.
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26))
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  return letters;
}

/** Numero di serie di Excel per data e ora locali: giorni dal 30 dicembre 1899. */
export function serialDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return (
    (Date.UTC(year, month - 1, day, hour, minute, second) - Date.UTC(1899, 11, 30)) / 86_400_000
  );
}

/** Stile di un numero dalle sue cifre decimali; null se non è un numero decimale esatto. */
function numberStyle(value: string): number | null {
  const match = /^-?\d+(?:\.(\d+))?$/u.exec(value);
  if (!match) return null;
  const decimals = match[1]?.length ?? 0;
  return decimals === 0
    ? style.integer
    : decimals === 2
      ? style.decimal2
      : decimals === 3
        ? style.decimal3
        : null;
}

/** Cella XML; un valore che non è il numero o la data dichiarati resta testo. */
export function xlsxCell(cell: XlsxCell, reference: string): string {
  if (cell.value === "") return "";
  if (cell.type === "number") {
    const number = numberStyle(cell.value);
    if (number !== null) return `<c r="${reference}" s="${number}"><v>${cell.value}</v></c>`;
  }
  if (cell.type === "date") {
    const serial = serialDate(cell.value);
    if (serial !== null) return `<c r="${reference}" s="${style.date}"><v>${serial}</v></c>`;
  }
  return `<c r="${reference}" s="${style.text}" t="inlineStr"><is><t xml:space="preserve">${xlsxText(cell.value)}</t></is></c>`;
}

export function xlsxRow(cells: readonly XlsxCell[], row: number): string {
  return `<row r="${row}">${cells.map((cell, index) => xlsxCell(cell, `${columnLetters(index)}${row}`)).join("")}</row>`;
}

function contentTypes() {
  return `${xml().declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

function packageRels() {
  return `${xml().declaration}<Relationships xmlns="${xml().package}"><Relationship Id="rId1" Type="${xml().relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookRels() {
  return `${xml().declaration}<Relationships xmlns="${xml().package}"><Relationship Id="rId1" Type="${xml().relationships}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${xml().relationships}/styles" Target="styles.xml"/></Relationships>`;
}

/** Testo, intestazione in grassetto, interi, decimali e date; Testo è il formato 49 (`@`). */
function styles() {
  const xf = (format: number, font = 0) =>
    `<xf numFmtId="${format}" fontId="${font}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"${font ? ' applyFont="1"' : ""}/>`;
  return `${xml().declaration}<styleSheet xmlns="${xml().main}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/><numFmt numFmtId="165" formatCode="0.000"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xf(49, 1)}${xf(49)}${xf(1)}${xf(2)}${xf(164)}${xf(165)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

/** Riferimento assoluto dell'intervallo, con il nome del foglio fra apici. */
function filterRange(sheet: XlsxSheet, rows: number) {
  const last = columnLetters(sheet.header.length - 1);
  return `'${xlsxText(sheet.name).replaceAll("'", "''")}'!$A$1:$${last}$${rows}`;
}

function workbook(sheet: XlsxSheet, rows: number) {
  return `${xml().declaration}<workbook xmlns="${xml().main}" xmlns:r="${xml().relationships}"><bookViews><workbookView/></bookViews><sheets><sheet name="${xlsxText(sheet.name)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${filterRange(sheet, rows)}</definedName></definedNames></workbook>`;
}

/** Inizio del foglio fino alla riga d'intestazione, bloccata e con il filtro. */
function sheetStart(sheet: XlsxSheet) {
  const columns = sheet.widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const header = `<row r="1">${sheet.header
    .map(
      (name, index) =>
        `<c r="${columnLetters(index)}1" s="${style.header}" t="inlineStr"><is><t xml:space="preserve">${xlsxText(name)}</t></is></c>`,
    )
    .join("")}</row>`;
  return `${xml().declaration}<worksheet xmlns="${xml().main}" xmlns:r="${xml().relationships}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columns}</cols><sheetData>${header}`;
}

function sheetEnd(sheet: XlsxSheet, rows: number) {
  return `</sheetData><autoFilter ref="A1:${columnLetters(sheet.header.length - 1)}${rows}"/></worksheet>`;
}

/**
 * File XLSX in streaming: il foglio si comprime pagina per pagina, la cartella di lavoro si
 * scrive per ultima con l'intervallo del filtro. Un errore a metà interrompe il flusso, così
 * il file incompleto non risulta scaricato; interrompere il download chiude anche le pagine.
 * Una pagina che porterebbe il foglio oltre `maxRows` righe interrompe il flusso con
 * `XlsxRowLimitError`, prima di scriverla.
 */
export function xlsxStream<Page>(
  sheet: XlsxSheet,
  pages: AsyncGenerator<Page>,
  cells: (page: Page) => XlsxCell[][],
  maxRows = xlsxMaxRows,
): ReadableStream<Uint8Array> {
  let rows = 1;
  let chunks = 0;
  let worksheet: ZipDeflate;
  const zip = new Zip();
  const entry = (name: string) => {
    const file = new ZipDeflate(name);
    file.mtime = sheet.modified;
    zip.add(file);
    return file;
  };
  const write = (name: string, text: string) => entry(name).push(strToU8(text), true);
  return new ReadableStream({
    start(controller) {
      zip.ondata = (error, chunk, final) => {
        // Stryker disable next-line ConditionalExpression,BlockStatement: un errore di compressione senza dati malformati non si riproduce.
        if (error) return controller.error(error);
        controller.enqueue(chunk);
        // Stryker disable next-line UpdateOperator: basta che il conteggio cambi, in un verso o nell'altro.
        chunks++;
        if (final) controller.close();
      };
      write("[Content_Types].xml", contentTypes());
      write("_rels/.rels", packageRels());
      write("xl/_rels/workbook.xml.rels", workbookRels());
      write("xl/styles.xml", styles());
      worksheet = entry("xl/worksheets/sheet1.xml");
      worksheet.push(strToU8(sheetStart(sheet)));
    },
    /**
     * La compressione trattiene i byte finché non completa un blocco: una lettura senza byte
     * nuovi non verrebbe ripetuta, quindi si leggono pagine finché non ne esce almeno uno.
     */
    async pull() {
      const before = chunks;
      // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: senza byte nuovi la lettura non finisce e Stryker la conta come Timeout; la prova con pagine senza fine verifica l'uscita.
      while (chunks === before) {
        const next = await pages.next();
        if (next.done) {
          worksheet.push(strToU8(sheetEnd(sheet, rows)), true);
          write("xl/workbook.xml", workbook(sheet, rows));
          zip.end();
          return;
        }
        const page = cells(next.value);
        if (rows + page.length > maxRows) {
          await pages.return(undefined);
          throw new XlsxRowLimitError();
        }
        worksheet.push(strToU8(page.map((row) => xlsxRow(row, ++rows)).join("")));
      }
    },
    async cancel() {
      await pages.return(undefined);
    },
  });
}
