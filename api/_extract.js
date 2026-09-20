/**
 * Extracción de texto de los archivos que sube el estudiante.
 *
 * Todo se hace con módulos nativos de Node (`zlib`): sin dependencias nuevas,
 * sin aumentar el tiempo de arranque en frío de la función serverless y sin
 * paquetes que puedan romperse en el runtime de Vercel.
 *
 * Formatos soportados:
 *   - Imágenes (jpg, png, gif, webp) → se mandan tal cual al modelo (visión)
 *   - Word .docx                     → texto de los párrafos y tablas
 *   - Excel .xlsx                    → celdas por hoja, en filas separadas por tabuladores
 *   - PowerPoint .pptx               → texto de cada diapositiva
 *   - PDF                            → texto de la capa de texto (no OCR)
 *   - Texto plano: txt, md, csv, tsv, json, xml, html, y código fuente
 */
import zlib from "node:zlib";

/* ============================================================================
   Lector mínimo de ZIP (docx, xlsx y pptx son archivos ZIP)
   ========================================================================== */

/**
 * Devuelve un Map<nombre, Buffer> con las entradas del ZIP.
 * Se recorre el "central directory" desde el final del archivo, que es la
 * forma robusta de leer un ZIP (los encabezados locales pueden mentir sobre
 * los tamaños cuando se usa data descriptor).
 */
function unzip(buffer) {
  const files = new Map();

  // Buscar la firma del End Of Central Directory (0x06054b50) desde el final.
  let eocd = -1;
  const minStart = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= minStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un ZIP válido");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > buffer.length) break;
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break; // firma de entrada

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);

    // Saltar al encabezado local para conocer el tamaño real de sus campos.
    if (buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const lNameLen = buffer.readUInt16LE(localOffset + 26);
      const lExtraLen = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buffer.subarray(dataStart, dataStart + compressedSize);
      try {
        if (method === 0) files.set(name, Buffer.from(raw));
        else if (method === 8) files.set(name, zlib.inflateRawSync(raw));
      } catch {
        /* entrada corrupta: se ignora y se sigue con las demás */
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

/* ============================================================================
   Utilidades de XML
   ========================================================================== */

const XML_ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function decodeXml(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
}

/** Texto de todas las etiquetas <w:t>, <a:t>, <t>… de un XML. */
function textOfTags(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1]));
  return out;
}

function clean(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ============================================================================
   Word (.docx)
   ========================================================================== */

function extractDocx(buffer) {
  const files = unzip(buffer);
  const parts = [];

  // El cuerpo, más encabezados y pies si existen.
  const order = ["word/document.xml", ...[...files.keys()].filter((k) => /^word\/(header|footer)\d*\.xml$/.test(k))];

  for (const name of order) {
    const entry = files.get(name);
    if (!entry) continue;
    let xml = entry.toString("utf8");

    // Se marcan los saltos de párrafo/línea/celda con caracteres de control
    // antes de descartar el resto del marcado, y las entidades XML se decodifican
    // AL FINAL: si se decodifican antes, un "&lt;" se convierte en "<" y el
    // limpiador de etiquetas se lo come junto con el texto que le sigue.
    xml = xml
      .replace(/<\/w:p>/g, "\u0001")
      .replace(/<w:br\s*\/?>/g, "\u0001")
      .replace(/<\/w:tc>/g, "\u0002")
      .replace(/<\/w:tr>/g, "\u0001");

    let text = "";
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|([\u0001\u0002])/g;
    let m;
    while ((m = re.exec(xml))) {
      if (m[1] !== undefined) text += m[1];
      else text += m[2] === "\u0002" ? "\t" : "\n";
    }

    text = decodeXml(text);
    if (text.trim()) parts.push(text);
  }

  return clean(parts.join("\n\n"));
}

/* ============================================================================
   Excel (.xlsx)
   ========================================================================== */

/** Convierte "C" → 2, "AB" → 27 (índice de columna, base 0). */
function colIndex(ref) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function extractXlsx(buffer, { maxRowsPerSheet = 200 } = {}) {
  const files = unzip(buffer);

  // Tabla de cadenas compartidas: las celdas de texto sólo guardan un índice.
  const sharedXml = files.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  const shared = [];
  const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let si;
  while ((si = siRe.exec(sharedXml))) {
    shared.push(textOfTags(si[1], "t").join(""));
  }

  // Nombres de las hojas en el orden del libro.
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") || "";
  const sheetNames = [...workbook.matchAll(/<sheet[^>]*\sname="([^"]*)"/g)].map((m) => decodeXml(m[1]));

  const sheetFiles = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  const out = [];

  sheetFiles.forEach((name, idx) => {
    const xml = files.get(name).toString("utf8");
    const rows = [];

    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    while ((rowMatch = rowRe.exec(xml)) && rows.length < maxRowsPerSheet) {
      const cells = [];
      const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[1]))) {
        const attrs = cellMatch[1] || "";
        const inner = cellMatch[2] || "";
        const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
        const type = (attrs.match(/t="([^"]+)"/) || [])[1];

        let value = "";
        if (type === "s") {
          const i = Number(textOfTags(inner, "v")[0]);
          value = shared[i] ?? "";
        } else if (type === "inlineStr") {
          value = textOfTags(inner, "t").join("");
        } else {
          value = textOfTags(inner, "v")[0] ?? "";
        }

        if (value !== "") cells.push({ col: ref ? colIndex(ref) : cells.length, value });
      }

      if (cells.length) {
        // Reconstruir la fila respetando las columnas vacías.
        const width = Math.max(...cells.map((c) => c.col)) + 1;
        const line = new Array(width).fill("");
        for (const c of cells) line[c.col] = String(c.value).replace(/\s+/g, " ").trim();
        rows.push(line.join("\t"));
      }
    }

    if (rows.length) {
      out.push(`## Hoja: ${sheetNames[idx] || `Hoja ${idx + 1}`}\n${rows.join("\n")}`);
    }
  });

  return clean(out.join("\n\n"));
}

/* ============================================================================
   PowerPoint (.pptx)
   ========================================================================== */

function extractPptx(buffer) {
  const files = unzip(buffer);
  const slides = [...files.keys()]
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  const out = slides.map((name, i) => {
    const xml = files.get(name).toString("utf8").replace(/<\/a:p>/g, "\u0001");
    let raw = "";
    const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|(\u0001)/g;
    let m;
    while ((m = re.exec(xml))) raw += m[1] !== undefined ? m[1] : "\n";
    const text = clean(decodeXml(raw));
    return text ? `## Diapositiva ${i + 1}\n${text}` : "";
  });

  return clean(out.filter(Boolean).join("\n\n"));
}

/* ============================================================================
   PDF (capa de texto; no hace OCR)
   ========================================================================== */

/** Decodifica una cadena PDF literal: (Hola \(mundo\)) */
function pdfLiteral(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = s[++i];
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b" || next === "f") out += " ";
    else if (next >= "0" && next <= "7") {
      let oct = next;
      while (oct.length < 3 && s[i + 1] >= "0" && s[i + 1] <= "7") oct += s[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += next;
  }
  return out;
}

/** Decodifica una cadena PDF hexadecimal: <48656C6C6F> */
function pdfHex(s) {
  const hex = s.replace(/[^0-9a-f]/gi, "");
  let out = "";
  // Las fuentes CID usan 2 bytes por carácter; se detecta de forma aproximada.
  const step = hex.length % 4 === 0 && /^00/.test(hex) ? 4 : 2;
  for (let i = 0; i + step <= hex.length; i += step) {
    const code = parseInt(hex.substr(i, step), 16);
    if (code > 8) out += String.fromCharCode(code);
  }
  return out;
}

/** Saca el texto de los operadores Tj / TJ / ' / " de un content stream. */
function textFromContentStream(content) {
  const out = [];
  // TJ: arreglos [(a) -120 (b)] TJ   |   Tj: (texto) Tj   |   <hex> Tj
  const re = /\[((?:[^\][\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|T\*|ET/g;
  let m;
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      // Dentro del arreglo hay cadenas y números de ajuste (kerning).
      let line = "";
      const inner = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g;
      let p;
      while ((p = inner.exec(m[1]))) {
        if (p[1] !== undefined) line += pdfLiteral(p[1]);
        else if (p[2] !== undefined) line += pdfHex(p[2]);
        else if (Number(p[3]) < -180) line += " "; // desplazamiento grande = espacio
      }
      out.push(line);
    } else if (m[2] !== undefined) {
      out.push(pdfLiteral(m[2]));
    } else if (m[3] !== undefined) {
      out.push(pdfHex(m[3]));
    } else {
      out.push("\n"); // T* o ET → salto de línea
    }
  }
  return out.join("");
}

/** Filtro /ASCII85Decode (lo usan reportlab y muchos generadores de PDF). */
function ascii85Decode(input) {
  const s = input.replace(/\s/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const out = [];
  let tuple = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "z" && tuple.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const code = ch.charCodeAt(0) - 33;
    if (code < 0 || code > 84) continue;
    tuple.push(code);
    if (tuple.length === 5) {
      let n = 0;
      for (const t of tuple) n = n * 85 + t;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      tuple = [];
    }
  }
  if (tuple.length > 1) {
    const missing = 5 - tuple.length;
    for (let i = 0; i < missing; i++) tuple.push(84);
    let n = 0;
    for (const t of tuple) n = n * 85 + t;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, 4 - missing));
  }
  return Buffer.from(out);
}

/** Filtro /ASCIIHexDecode. */
function asciiHexDecode(input) {
  const hex = input.replace(/>[\s\S]*$/, "").replace(/[^0-9a-f]/gi, "");
  return Buffer.from(hex.length % 2 ? hex + "0" : hex, "hex");
}

/**
 * Aplica la cadena de filtros declarada en /Filter.
 * Puede ser uno solo (/FlateDecode) o una lista ([/ASCII85Decode /FlateDecode]),
 * y hay que aplicarlos en orden. La versión anterior sólo entendía FlateDecode
 * a secas y por eso no sacaba nada de los PDF de reportlab, LaTeX y similares.
 */
function applyPdfFilters(raw, dict) {
  const filterMatch = dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/);
  if (!filterMatch) return raw;

  const filters = [...filterMatch[1].matchAll(/\/(\w+)/g)].map((m) => m[1]);
  let data = raw;

  for (const filter of filters) {
    if (filter === "ASCII85Decode" || filter === "A85") {
      data = ascii85Decode(data.toString("latin1"));
    } else if (filter === "ASCIIHexDecode" || filter === "AHx") {
      data = asciiHexDecode(data.toString("latin1"));
    } else if (filter === "FlateDecode" || filter === "Fl") {
      try {
        data = zlib.inflateSync(data);
      } catch {
        // Algunos generadores omiten la cabecera zlib.
        data = zlib.inflateRawSync(data);
      }
    } else {
      // LZWDecode, DCTDecode, JBIG2Decode… no soportados.
      return null;
    }
  }
  return data;
}

function extractPdf(buffer) {
  const parts = [];

  // Recorrer todos los objetos "stream ... endstream" del archivo.
  let pos = 0;
  while (true) {
    const start = buffer.indexOf("stream", pos);
    if (start < 0) break;
    const end = buffer.indexOf("endstream", start);
    if (end < 0) break;

    // El diccionario del objeto está justo antes de la palabra "stream".
    const dictStart = Math.max(0, buffer.lastIndexOf("<<", start));
    const dict = buffer.toString("latin1", dictStart, start);

    // Saltar el EOL que sigue a "stream".
    let dataStart = start + 6;
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const raw = buffer.subarray(dataStart, end);
    pos = end + 9;

    // Ignorar imágenes y fuentes incrustadas: sólo interesan los content streams.
    if (/\/Subtype\s*\/Image|\/FontFile/.test(dict)) continue;

    let decoded;
    try {
      decoded = applyPdfFilters(raw, dict);
    } catch {
      continue;
    }
    if (!decoded) continue;
    const content = decoded.toString("latin1");

    if (/\b(Tj|TJ)\b/.test(content)) {
      parts.push(textFromContentStream(content));
    }
  }

  // Los bytes vienen en latin1; se reinterpretan si el texto era UTF-8.
  const text = clean(parts.join("\n"));
  return text;
}

/* ============================================================================
   Punto de entrada
   ========================================================================== */

export const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm",
  "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "cs", "php", "rb",
  "go", "rs", "sql", "sh", "yml", "yaml", "ini", "log",
];

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "xlsx", "xlsm", "pptx", ...TEXT_EXTENSIONS];

/** Formatos antiguos de Office: son binarios OLE, no ZIP, y no se pueden leer así. */
const LEGACY = { doc: "Word 97-2003", xls: "Excel 97-2003", ppt: "PowerPoint 97-2003" };

function extensionOf(name) {
  return String(name || "").split(".").pop().toLowerCase();
}

/**
 * @param {{name: string, type: string, data: Buffer}} file
 * @returns {{ name: string, ok: boolean, text?: string, error?: string, truncated?: boolean }}
 */
export function extractText(file, { maxChars = 20_000 } = {}) {
  const ext = extensionOf(file.name);

  if (LEGACY[ext]) {
    return {
      name: file.name,
      ok: false,
      error: `El formato ${LEGACY[ext]} (.${ext}) no se puede leer. Ábrelo y guárdalo como .${ext}x.`,
    };
  }

  try {
    let text;
    if (ext === "pdf") text = extractPdf(file.data);
    else if (ext === "docx") text = extractDocx(file.data);
    else if (ext === "xlsx" || ext === "xlsm") text = extractXlsx(file.data);
    else if (ext === "pptx") text = extractPptx(file.data);
    else if (TEXT_EXTENSIONS.includes(ext)) text = clean(file.data.toString("utf8"));
    else {
      return { name: file.name, ok: false, error: `No sé leer archivos .${ext}.` };
    }

    if (!text || text.replace(/\s/g, "").length < 10) {
      return {
        name: file.name,
        ok: false,
        error:
          ext === "pdf"
            ? "No se encontró texto en el PDF. Si es un documento escaneado, súbelo como imagen (JPG o PNG) para que pueda leerlo."
            : "El archivo está vacío o no contiene texto legible.",
      };
    }

    const truncated = text.length > maxChars;
    return {
      name: file.name,
      ok: true,
      truncated,
      text: truncated ? text.slice(0, maxChars) + "\n\n[…documento recortado…]" : text,
    };
  } catch (e) {
    return { name: file.name, ok: false, error: `No se pudo leer el archivo: ${e.message}` };
  }
}
