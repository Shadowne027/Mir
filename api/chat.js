/**
 * POST /api/chat
 *
 * Body JSON:
 *   {
 *     conversationId: string,
 *     message: string,
 *     images?:    [{ name, type, dataUrl }],   // jpg, png, gif, webp
 *     documents?: [{ name, type, base64  }]    // pdf, docx, xlsx, pptx, csv, txt…
 *   }
 *
 * Respuesta:
 *   { text, sources[], followups[], model, fromCache, attachments[] }
 *
 * Tres cosas pasan aquí, en este orden:
 *   1. Se leen los adjuntos y se convierten a texto (o a imágenes para visión).
 *   2. Se mira la caché de MongoDB: si esa misma pregunta ya se respondió,
 *      se devuelve la respuesta guardada sin gastar tokens.
 *   3. Si no hay caché, se elige modelo (nano o mini) y se llama a OpenAI.
 */
import {
  SYSTEM_PROMPT,
  getDb,
  mongoHint,
  preflight,
  readBody,
  send,
  authPayload,
  cacheKey,
  readCache,
  writeCache,
} from "./_lib.js";
import { extractText, SUPPORTED_EXTENSIONS } from "./_extract.js";
import { ObjectId } from "mongodb";

const MAX_HISTORY = 12;              // mensajes previos enviados al modelo
const MAX_IMAGES = 5;      // 5 fotos por carga
const MAX_DOCUMENTS = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;   // por archivo, ya decodificado
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // Vercel corta el body sobre ~4.5 MB
const MAX_DOC_CHARS = 20_000;             // texto que se manda por documento

/* ============================================================================
   Elección de modelo
   ========================================================================== */

/**
 * Señales de que la pregunta necesita razonamiento de verdad.
 *
 * Ojo con las alternancias: `\b` sólo afecta a la primera opción, así que cada
 * alternativa va dentro de su propio grupo con `\b`. Sin esto, "tesis" hacía
 * match dentro de "fotosín-tesis" y mandaba a mini una pregunta trivial.
 */
const COMPLEX_PATTERNS = [
  /\b(analiz|compar|demuestr|justific|argument|deduc|razon|sintetiz|interpret)/i,
  /\b(resuelv|calcul|despej|factoriz|deriv|integr|ecuaci[oó]n|teorema|f[oó]rmula|demostraci[oó]n)/i,
  /\b(c[oó]digo|program|algoritmo|depur|compil|script|consulta sql)/i,
  /\b(ensayo|redact|redacci[oó]n|informe|monograf[ií]a|tesis|corrig|rev[ií]sa)\b/i,
  /\b(paso a paso|en detalle|detalladamente|profundiza|desarroll)/i,
  /\b(por\s?qu[eé]|para\s?qu[eé]|c[oó]mo funciona|qu[eé] pasar[ií]a|diferencia[s]? entre)/i,
  /\b(ventajas y desventajas|pros y contras|causas y consecuencias)/i,
  /\b(traduc|resum|parafrase)/i,
  /\b(plan de estudio|ruta de aprendizaje|cronograma|gu[ií]a de estudio)/i,
  /\b(ejercicio|taller|examen|tarea|problema)\b/i,
];

/** Saludos, cortesías y preguntas sobre el propio MIMIR. */
const SIMPLE_PATTERNS = [
  /^¿?\s*(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|qu[eé] tal|saludos)\b/i,
  /^¿?\s*(gracias|muchas gracias|vale|ok|okey|listo|perfecto|genial|adi[oó]s|chao|hasta luego|nos vemos)\b/i,
  /^¿?\s*(s[ií]|no|claro|entiendo|entendido|ya|de acuerdo)[.!]?$/i,
  /^¿?\s*(qui[eé]n eres|c[oó]mo te llamas|qu[eé] eres|qui[eé]n te (cre[oó]|hizo)|para qu[eé] sirves)/i,
];

/**
 * Consultas de dato puntual: tienen una respuesta corta y verificable, no
 * necesitan que el modelo razone.
 */
const FACTUAL_PATTERNS = [
  /^¿?\s*(cu[aá]l es (la|el) (capital|moneda|r[ií]o|monta[ñn]a|s[ií]mbolo))/i,
  /^¿?\s*(en qu[eé] a[ñn]o|cu[aá]ndo (fue|naci[oó]|muri[oó]|ocurri[oó]|se))/i,
  /^¿?\s*(qui[eé]n (fue|es|escribi[oó]|invent[oó]|descubri[oó]|pint[oó]|compuso))/i,
  /^¿?\s*(c[oó]mo se (dice|escribe|llama))/i,
  /^¿?\s*(cu[aá]nto[s]? (a[ñn]os|habitantes|planetas|continentes|huesos))/i,
];

const FACTUAL_MAX_WORDS = 14;

/**
 * gpt-5-nano para lo que no exige razonar: saludos, cortesías, preguntas sobre
 * el propio MIMIR y datos puntuales cortos.
 * gpt-5-mini para todo lo demás, porque el valor de un tutor está en la
 * explicación paso a paso con fuentes, y ahí el modelo pequeño se queda corto.
 * Con adjuntos, siempre mini.
 *
 * Se devuelve el motivo y se escribe en el log (Vercel → Logs) para poder
 * afinar los umbrales con casos reales.
 */
export function chooseModel(message, { hasAttachments = false, historyLength = 0 } = {}) {
  const text = String(message || "").trim();

  if (hasAttachments) return { model: "gpt-5-mini", reason: "adjuntos" };

  for (const re of SIMPLE_PATTERNS) {
    if (re.test(text)) return { model: "gpt-5-nano", reason: "saludo o cortesía" };
  }

  for (const re of COMPLEX_PATTERNS) {
    if (re.test(text)) return { model: "gpt-5-mini", reason: "requiere razonamiento" };
  }

  if ((text.match(/\?/g) || []).length >= 2) {
    return { model: "gpt-5-mini", reason: "varias preguntas" };
  }

  if (/[=∫∑√]|\d\s*[+\-*/^]\s*\d/.test(text)) {
    return { model: "gpt-5-mini", reason: "notación matemática" };
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (historyLength === 0 && words <= FACTUAL_MAX_WORDS) {
    for (const re of FACTUAL_PATTERNS) {
      if (re.test(text)) return { model: "gpt-5-nano", reason: "dato puntual" };
    }
  }

  return { model: "gpt-5-mini", reason: "explicación de tutor" };
}

/* ============================================================================
   Adjuntos
   ========================================================================== */

function decodeBase64(value) {
  const comma = String(value || "").indexOf(",");
  const payload = comma >= 0 ? value.slice(comma + 1) : value;
  return Buffer.from(payload, "base64");
}

/**
 * Prepara los documentos para el prompt.
 *
 * Lo normal es que el navegador ya haya extraído el texto (src/lib/extract.ts)
 * y mande `{ name, text }`: así un PDF de 20 MB no tiene que viajar entero, que
 * es imposible con el tope de ~4.5 MB por petición de Vercel. Si en cambio
 * llega `{ name, base64 }` (cliente antiguo o navegador sin DecompressionStream),
 * el servidor lo extrae aquí.
 */
function processDocuments(documents) {
  const blocks = [];
  const summary = [];

  for (const doc of documents.slice(0, MAX_DOCUMENTS)) {
    const name = String(doc?.name || "documento");

    // Camino normal: el texto ya viene extraído del navegador.
    if (typeof doc?.text === "string") {
      const text = doc.text.slice(0, MAX_DOC_CHARS);
      if (text.replace(/\s/g, "").length < 10) {
        summary.push({ name, ok: false, error: "El archivo no tiene texto legible." });
      } else {
        summary.push({ name, ok: true, truncated: Boolean(doc.truncated) });
        blocks.push(`### Archivo adjunto: ${name}\n\n${text}`);
      }
      continue;
    }

    let data;
    try {
      data = decodeBase64(doc?.base64);
    } catch {
      summary.push({ name, ok: false, error: "No se pudo decodificar el archivo." });
      continue;
    }

    if (!data.length || data.length > MAX_FILE_BYTES) {
      summary.push({ name, ok: false, error: "El archivo está vacío o es demasiado grande." });
      continue;
    }

    const result = extractText({ name, type: doc?.type, data }, { maxChars: MAX_DOC_CHARS });
    summary.push({ name, ok: result.ok, error: result.error, truncated: result.truncated });
    if (result.ok) {
      blocks.push(`### Archivo adjunto: ${name}\n\n${result.text}`);
    }
  }

  return { blocks, summary };
}

/* ============================================================================
   Respuesta del tutor
   ========================================================================== */

/** Extrae el JSON del tutor aunque el modelo lo envuelva en ```json … ```. */
function parseTutorReply(raw) {
  const cleaned = String(raw || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj.text === "string") {
      return {
        text: obj.text,
        sources: Array.isArray(obj.sources)
          ? obj.sources.filter((s) => s && typeof s.url === "string").slice(0, 6)
          : [],
        followups: Array.isArray(obj.followups)
          ? obj.followups.filter((f) => typeof f === "string").slice(0, 3)
          : [],
      };
    }
  } catch {
    /* el modelo no devolvió JSON: se usa el texto tal cual */
  }
  return {
    text: cleaned || "No pude generar una respuesta. Intenta reformular tu pregunta.",
    sources: [],
    followups: [],
  };
}

/* ============================================================================
   Handler
   ========================================================================== */

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });

  const payload = authPayload(req);
  if (!payload) return send(res, 401, { error: "Sesión inválida. Inicia sesión de nuevo." });

  if (!process.env.OPENAI_API_KEY) {
    return send(res, 503, { error: "El servidor no tiene configurada OPENAI_API_KEY." });
  }

  try {
    const body = await readBody(req);
    const message = String(body.message || "").trim();
    const conversationId = body.conversationId ? String(body.conversationId) : null;

    /* ---- 1. Adjuntos ---- */
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const rawDocs = Array.isArray(body.documents) ? body.documents : [];

    const totalBase64 =
      rawImages.reduce((n, i) => n + String(i?.dataUrl || "").length, 0) +
      rawDocs.reduce((n, d) => n + String(d?.base64 || "").length, 0);
    if (totalBase64 > MAX_TOTAL_BYTES * 1.4) {
      return send(res, 413, {
        error: `Los archivos pesan demasiado en conjunto. Envía menos de ${Math.round(
          MAX_TOTAL_BYTES / 1024 / 1024
        )} MB por mensaje.`,
      });
    }

    const images = rawImages
      .filter((img) => img && typeof img.dataUrl === "string" && img.dataUrl.startsWith("data:image/"))
      .slice(0, MAX_IMAGES);

    const { blocks: docBlocks, summary: docSummary } = processDocuments(rawDocs);
    const hasAttachments = images.length > 0 || rawDocs.length > 0;

    if (!message && !hasAttachments) {
      return send(res, 400, { error: "Escribe una pregunta." });
    }

    // Si mandó archivos y ninguno se pudo leer, mejor decirlo que responder a ciegas.
    if (rawDocs.length > 0 && docBlocks.length === 0 && images.length === 0) {
      const detail = docSummary.map((d) => `• ${d.name}: ${d.error}`).join("\n");
      return send(res, 422, {
        error:
          `No pude leer ${rawDocs.length === 1 ? "el archivo" : "ninguno de los archivos"}.\n\n${detail}\n\n` +
          `Formatos que sí puedo leer: ${SUPPORTED_EXTENSIONS.join(", ")}, además de imágenes.`,
        attachments: docSummary,
      });
    }

    /* ---- 2. Historial de la conversación ---- */
    const db = await getDb();
    const col = db.collection("conversations");

    let convo = null;
    if (conversationId && ObjectId.isValid(conversationId)) {
      convo = await col.findOne({ _id: new ObjectId(conversationId), userId: payload.userId });
    }

    const history = (convo?.messages || [])
      .slice(-MAX_HISTORY)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    /* ---- 3. Caché ----
       Sólo se consulta con preguntas independientes: si hay adjuntos o mensajes
       previos, la respuesta depende del contexto y reutilizar una respuesta
       guardada daría resultados equivocados. */
    const cacheable = !hasAttachments && history.length === 0 && message.length > 0;
    const key = cacheable ? cacheKey(message) : null;

    let reply = null;
    let model = null;
    let fromCache = false;

    if (key) {
      const hit = await readCache(db, key);
      if (hit) {
        reply = { text: hit.text, sources: hit.sources || [], followups: hit.followups || [] };
        model = hit.model || "caché";
        fromCache = true;
        console.log(`[CHAT] Caché HIT (uso nº ${(hit.hits || 0) + 1}) — 0 tokens gastados`);
      }
    }

    /* ---- 4. Llamada a OpenAI (sólo si no hubo caché) ---- */
    if (!reply) {
      const chosen = chooseModel(message, { hasAttachments, historyLength: history.length });
      model = chosen.model;
      console.log(`[CHAT] Modelo ${model} (${chosen.reason})`);

      let userText = message || "Analiza los archivos que te envié y explícamelos.";
      if (docBlocks.length) {
        userText =
          `${userText}\n\n---\nContenido de los archivos que adjunté ` +
          `(úsalo para responder y menciona el nombre del archivo cuando te refieras a él):\n\n` +
          docBlocks.join("\n\n---\n\n");
      }

      const userContent = images.length
        ? [
            { type: "text", text: userText },
            ...images.map((img) => ({ type: "image_url", image_url: { url: img.dataUrl } })),
          ]
        : userText;

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userContent },
      ];

      // Los modelos gpt-5-* no aceptan `max_tokens` ni `temperature` personalizada.
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json().catch(() => ({}));
        const detail = errData?.error?.message || `Status ${aiRes.status}`;
        console.error("[CHAT] OpenAI error:", aiRes.status, detail);
        return send(res, aiRes.status === 429 ? 429 : 502, {
          error: `La IA no respondió: ${detail}`,
          model,
        });
      }

      const data = await aiRes.json();
      reply = parseTutorReply(data?.choices?.[0]?.message?.content);

      if (key) await writeCache(db, key, { question: message, ...reply, model });
    }

    /* ---- 5. Persistir la conversación ---- */
    if (convo) {
      const now = Date.now();
      const files = [
        ...images.map((i) => ({ name: i.name || "imagen", type: i.type || "image" })),
        ...docSummary.filter((d) => d.ok).map((d) => ({ name: d.name, type: "documento" })),
      ];
      const update = {
        $push: {
          messages: {
            $each: [
              { role: "user", content: message, at: now, ...(files.length ? { files } : {}) },
              {
                role: "assistant",
                content: reply.text,
                sources: reply.sources,
                followUps: reply.followups,
                at: now + 1,
                model,
                fromCache,
              },
            ],
          },
        },
        $set: { updatedAt: now },
      };
      if ((convo.messages || []).length === 0 && message) {
        update.$set.title = message.slice(0, 48) + (message.length > 48 ? "…" : "");
      }
      await col.updateOne({ _id: convo._id, userId: payload.userId }, update);
    }

    return send(res, 200, {
      text: reply.text,
      sources: reply.sources,
      followups: reply.followups,
      model,
      fromCache,
      attachments: docSummary,
    });
  } catch (error) {
    console.error("[CHAT] Error:", error);
    const isMongo = /Mongo|topology|Server selection/i.test(String(error?.message || ""));
    return send(res, 500, {
      error: isMongo ? mongoHint(error) : "Error al procesar el mensaje.",
      details: error?.message || "Error desconocido",
    });
  }
}
