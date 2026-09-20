/**
 * Lectura de archivos en el navegador.
 *
 * El texto de los PDF, Word, Excel y PowerPoint se extrae AQUÍ, en el equipo del
 * estudiante, y al servidor sólo viaja el texto resultante. Esto es lo que
 * permite aceptar archivos de hasta 20 MB: las funciones serverless de Vercel
 * rechazan cualquier petición mayor a ~4.5 MB, así que enviar un PDF de 20 MB en
 * base64 (que además crece un 33%) nunca podría funcionar.
 *
 * Se usa `DecompressionStream`, que viene incluido en el navegador: no hace
 * falta instalar ninguna librería. Los formatos de Office son archivos ZIP con
 * XML dentro, y los PDF guardan su contenido comprimido con el mismo algoritmo.
 */

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB por archivo
export const MAX_IMAGES = 5;                    // 5 fotos por carga
export const MAX_DOCUMENTS = 5;                 // 5 documentos por carga
export const MAX_DOC_CHARS = 20_000;            // texto que se envía por documento

/** Lado mayor al que se reducen las fotos antes de enviarlas. */
const IMAGE_MAX_SIDE = 1600;
const IMAGE_QUALITY = 0.82;

export const DOCUMENT_EXTENSIONS = [
  "pdf", "docx", "xlsx", "xlsm", "pptx",
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm",
  "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "cs", "php", "rb",
  "go", "rs", "sql", "sh", "yml", "yaml", "ini", "log",
];

const TEXT_EXTENSIONS = DOCUMENT_EXTENSIONS.filter(
  (e) => !["pdf", "docx", "xlsx", "xlsm", "pptx"].includes(e)
);

/** Formatos viejos de Office: binarios OLE, no ZIP. No se pueden leer. */
export const LEGACY_EXTENSIONS: Record<string, string> = {
  doc: "Word 97-2003",
  xls: "Excel 97-2003",
  ppt: "PowerPoint 97-2003",
};

export function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** ¿Se puede enviar este archivo? Devuelve el motivo si no. */
export function fileRejectionReason(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `pesa ${formatBytes(file.size)} y el máximo es 20 MB`;
  }
  if (isImageFile(file)) return null;

  const ext = extensionOf(file.name);
  if (LEGACY_EXTENSIONS[ext]) {
    return `es un archivo ${LEGACY_EXTENSIONS[ext]}; ábrelo y guárdalo como .${ext}x`;
  }
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    return `el formato .${ext || "desconocido"} no está soportado`;
  }
  return null;
}

/* ============================================================================
   Descompresión (nativa del navegador)
   ========================================================================== */

function hasDecompression(): boolean {
  return typeof DecompressionStream !== "undefined";
}

async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/* ============================================================================
   Lector de ZIP (docx, xlsx, pptx)
   ========================================================================== */

/** Lee el "central directory" desde el final, que es la forma fiable. */
async function unzip(buffer: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const files = new Map<string, Uint8Array>();

  let eocd = -1;
  const minStart = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= minStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un ZIP válido");

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");

  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > buffer.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLen));

    if (view.getUint32(localOffset, true) === 0x04034b50) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buffer.subarray(dataStart, dataStart + compressedSize);
      try {
        if (method === 0) files.set(name, raw);
        else if (method === 8) files.set(name, await inflate(raw, "deflate-raw"));
      } catch {
        /* entrada corrupta: se ignora y se sigue con las demás */
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

/* ============================================================================
   XML
   ========================================================================== */

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
}

function textOfTags(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1]));
  return out;
}

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const utf8 = (b: Uint8Array) => new TextDecoder("utf-8").decode(b as BufferSource);
const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b as BufferSource);

/* ============================================================================
   Word
   ========================================================================== */

async function extractDocx(buffer: Uint8Array): Promise<string> {
  const files = await unzip(buffer);
  const parts: string[] = [];

  const order = [
    "word/document.xml",
    ...[...files.keys()].filter((k) => /^word\/(header|footer)\d*\.xml$/.test(k)),
  ];

  for (const name of order) {
    const entry = files.get(name);
    if (!entry) continue;

    // Los saltos se marcan con caracteres de control antes de descartar el
    // marcado, y las entidades XML se decodifican al final: si se decodifican
    // antes, un "&lt;" se vuelve "<" y el limpiador de etiquetas se lo come.
    const xml = utf8(entry)
      .replace(/<\/w:p>/g, "\u0001")
      .replace(/<w:br\s*\/?>/g, "\u0001")
      .replace(/<\/w:tc>/g, "\u0002")
      .replace(/<\/w:tr>/g, "\u0001");

    let text = "";
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|([\u0001\u0002])/g;
    let m: RegExpExecArray | null;
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
   Excel
   ========================================================================== */

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function extractXlsx(buffer: Uint8Array, maxRowsPerSheet = 200): Promise<string> {
  const files = await unzip(buffer);

  // Las celdas de texto sólo guardan un índice a esta tabla compartida.
  const sharedXml = files.has("xl/sharedStrings.xml") ? utf8(files.get("xl/sharedStrings.xml")!) : "";
  const shared: string[] = [];
  const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(sharedXml))) shared.push(textOfTags(si[1], "t").join(""));

  const workbook = files.has("xl/workbook.xml") ? utf8(files.get("xl/workbook.xml")!) : "";
  const sheetNames = [...workbook.matchAll(/<sheet[^>]*\sname="([^"]*)"/g)].map((m) => decodeXml(m[1]));

  const sheetFiles = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const out: string[] = [];

  sheetFiles.forEach((name, idx) => {
    const xml = utf8(files.get(name)!);
    const rows: string[] = [];

    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(xml)) && rows.length < maxRowsPerSheet) {
      const cells: { col: number; value: string }[] = [];
      const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1]))) {
        const attrs = cellMatch[1] || "";
        const inner = cellMatch[2] || "";
        const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
        const type = (attrs.match(/t="([^"]+)"/) || [])[1];

        let value = "";
        if (type === "s") value = shared[Number(textOfTags(inner, "v")[0])] ?? "";
        else if (type === "inlineStr") value = textOfTags(inner, "t").join("");
        else value = textOfTags(inner, "v")[0] ?? "";

        if (value !== "") cells.push({ col: ref ? colIndex(ref) : cells.length, value });
      }

      if (cells.length) {
        // Se respetan las columnas vacías para no descuadrar la tabla.
        const width = Math.max(...cells.map((c) => c.col)) + 1;
        const line = new Array(width).fill("");
        for (const c of cells) line[c.col] = String(c.value).replace(/\s+/g, " ").trim();
        rows.push(line.join("\t"));
      }
    }

    if (rows.length) out.push(`## Hoja: ${sheetNames[idx] || `Hoja ${idx + 1}`}\n${rows.join("\n")}`);
  });

  return clean(out.join("\n\n"));
}

/* ============================================================================
   PowerPoint
   ========================================================================== */

async function extractPptx(buffer: Uint8Array): Promise<string> {
  const files = await unzip(buffer);
  const slides = [...files.keys()]
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const out = slides.map((name, i) => {
    const xml = utf8(files.get(name)!).replace(/<\/a:p>/g, "\u0001");
    let raw = "";
    const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|(\u0001)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) raw += m[1] !== undefined ? m[1] : "\n";
    const text = clean(decodeXml(raw));
    return text ? `## Diapositiva ${i + 1}\n${text}` : "";
  });

  return clean(out.filter(Boolean).join("\n\n"));
}

/* ============================================================================
   PDF (capa de texto; no hace OCR)
   ========================================================================== */

function pdfLiteral(s: string): string {
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

function pdfHex(s: string): string {
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

function textFromContentStream(content: string): string {
  const out: string[] = [];
  const re = /\[((?:[^\][\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|T\*|ET/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      let line = "";
      const inner = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g;
      let p: RegExpExecArray | null;
      while ((p = inner.exec(m[1]))) {
        if (p[1] !== undefined) line += pdfLiteral(p[1]);
        else if (p[2] !== undefined) line += pdfHex(p[2]);
        else if (Number(p[3]) < -180) line += " "; // kerning grande = espacio
      }
      out.push(line);
    } else if (m[2] !== undefined) out.push(pdfLiteral(m[2]));
    else if (m[3] !== undefined) out.push(pdfHex(m[3]));
    else out.push("\n");
  }
  return out.join("");
}

function ascii85Decode(input: string): Uint8Array {
  const s = input.replace(/\s/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const out: number[] = [];
  let tuple: number[] = [];
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
  return new Uint8Array(out);
}

function asciiHexDecode(input: string): Uint8Array {
  const hex = input.replace(/>[\s\S]*$/, "").replace(/[^0-9a-f]/gi, "");
  const even = hex.length % 2 ? hex + "0" : hex;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(even.substr(i * 2, 2), 16);
  return out;
}

/**
 * Aplica la cadena de filtros de /Filter. Puede ser uno solo (/FlateDecode) o
 * una lista ([/ASCII85Decode /FlateDecode]), y hay que aplicarlos en orden.
 */
/**
 * Descomprime tolerando basura al final.
 *
 * `DecompressionStream` es más estricto que zlib: falla si sobran bytes después
 * del flujo, y entre los datos y la palabra `endstream` casi siempre hay un
 * salto de línea. Por eso se prueban varios recortes y los dos formatos
 * (con y sin cabecera zlib) hasta que uno funcione.
 */
async function inflateTolerant(raw: Uint8Array, declaredLength: number | null): Promise<Uint8Array> {
  const candidates: Uint8Array[] = [];

  if (declaredLength !== null && declaredLength > 0 && declaredLength <= raw.length) {
    candidates.push(raw.subarray(0, declaredLength));
  }

  let end = raw.length;
  while (end > 0 && (raw[end - 1] === 0x0a || raw[end - 1] === 0x0d || raw[end - 1] === 0x20)) end--;
  if (end !== raw.length) candidates.push(raw.subarray(0, end));
  candidates.push(raw);

  let lastError: unknown = new Error("no se pudo descomprimir");
  for (const candidate of candidates) {
    for (const format of ["deflate", "deflate-raw"] as const) {
      try {
        return await inflate(candidate, format);
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError;
}

async function applyPdfFilters(
  raw: Uint8Array,
  dict: string,
  declaredLength: number | null
): Promise<Uint8Array | null> {
  const filterMatch = dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/);
  if (!filterMatch) return raw;

  const filters = [...filterMatch[1].matchAll(/\/(\w+)/g)].map((m) => m[1]);
  let data = raw;

  for (const [i, filter] of filters.entries()) {
    if (filter === "ASCII85Decode" || filter === "A85") data = ascii85Decode(latin1(data));
    else if (filter === "ASCIIHexDecode" || filter === "AHx") data = asciiHexDecode(latin1(data));
    else if (filter === "FlateDecode" || filter === "Fl") {
      // /Length sólo describe los bytes tal como están en el archivo, así que
      // únicamente sirve si Flate es el primer filtro de la cadena.
      data = await inflateTolerant(data, i === 0 ? declaredLength : null);
    } else {
      return null; // LZWDecode, DCTDecode, JBIG2Decode… no soportados
    }
  }
  return data;
}

function indexOfBytes(haystack: Uint8Array, needle: string, from: number): number {
  const pat = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - pat.length; i++) {
    for (let j = 0; j < pat.length; j++) if (haystack[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}

function lastIndexOfBytes(haystack: Uint8Array, needle: string, from: number): number {
  const pat = new TextEncoder().encode(needle);
  outer: for (let i = Math.min(from, haystack.length - pat.length); i >= 0; i--) {
    for (let j = 0; j < pat.length; j++) if (haystack[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}

async function extractPdf(buffer: Uint8Array): Promise<string> {
  const parts: string[] = [];
  let pos = 0;

  while (true) {
    const start = indexOfBytes(buffer, "stream", pos);
    if (start < 0) break;
    const end = indexOfBytes(buffer, "endstream", start);
    if (end < 0) break;

    const dictStart = Math.max(0, lastIndexOfBytes(buffer, "<<", start));
    const dict = latin1(buffer.subarray(dictStart, start));

    let dataStart = start + 6;
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const raw = buffer.subarray(dataStart, end);
    pos = end + 9;

    // Ignorar imágenes y fuentes incrustadas: sólo interesan los content streams.
    if (/\/Subtype\s*\/Image|\/FontFile/.test(dict)) continue;

    // /Length puede ser una referencia indirecta ("12 0 R"); ésa no sirve.
    const lengthMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    const declaredLength = lengthMatch ? Number(lengthMatch[1]) : null;

    let decoded: Uint8Array | null;
    try {
      decoded = await applyPdfFilters(raw, dict, declaredLength);
    } catch {
      continue;
    }
    if (!decoded) continue;

    const content = latin1(decoded);
    if (/\b(Tj|TJ)\b/.test(content)) parts.push(textFromContentStream(content));
  }

  return clean(parts.join("\n"));
}

/* ============================================================================
   Punto de entrada
   ========================================================================== */

export interface ExtractedDocument {
  name: string;
  ok: boolean;
  text?: string;
  error?: string;
  truncated?: boolean;
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const name = file.name;
  const ext = extensionOf(name);

  const rejection = fileRejectionReason(file);
  if (rejection) return { name, ok: false, error: rejection };

  const needsInflate = ["pdf", "docx", "xlsx", "xlsm", "pptx"].includes(ext);
  if (needsInflate && !hasDecompression()) {
    return {
      name,
      ok: false,
      error: "tu navegador es muy antiguo para leer este formato; actualízalo o sube el contenido como imagen",
    };
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    let text: string;

    if (ext === "pdf") text = await extractPdf(data);
    else if (ext === "docx") text = await extractDocx(data);
    else if (ext === "xlsx" || ext === "xlsm") text = await extractXlsx(data);
    else if (ext === "pptx") text = await extractPptx(data);
    else if (TEXT_EXTENSIONS.includes(ext)) text = clean(utf8(data));
    else return { name, ok: false, error: `no sé leer archivos .${ext}` };

    if (!text || text.replace(/\s/g, "").length < 10) {
      return {
        name,
        ok: false,
        error:
          ext === "pdf"
            ? "no encontré texto en el PDF; si está escaneado, súbelo como imagen (JPG o PNG) y lo leo con visión"
            : "el archivo está vacío o no tiene texto legible",
      };
    }

    const truncated = text.length > MAX_DOC_CHARS;
    return {
      name,
      ok: true,
      truncated,
      text: truncated ? text.slice(0, MAX_DOC_CHARS) + "\n\n[…documento recortado…]" : text,
    };
  } catch (e) {
    return { name, ok: false, error: `no se pudo leer: ${(e as Error).message}` };
  }
}

/* ============================================================================
   Imágenes
   ========================================================================== */

/**
 * Reduce la foto antes de enviarla. Una foto de cámara de 20 MB queda en unos
 * cientos de KB sin perder legibilidad, que es lo que permite cumplir el límite
 * de 20 MB por archivo sin chocar con el tope de petición de Vercel.
 * Si algo falla, se envía la imagen original.
 */
export async function imageToDataUrl(file: File): Promise<string> {
  const original = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      reader.readAsDataURL(file);
    });

  // Los GIF animados y los SVG se envían tal cual: redibujarlos los rompería.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return original();

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");

    // Fondo blanco: los PNG con transparencia se verían negros en JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
    if (!dataUrl.startsWith("data:image/")) throw new Error("conversión fallida");
    return dataUrl;
  } catch {
    return original();
  }
}
