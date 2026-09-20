/**
 * Utilidades compartidas por las funciones serverless de MIMIR IA (Vercel).
 * Variables de entorno requeridas: MONGODB_URI, OPENAI_API_KEY, TOKEN_SECRET.
 */
import { MongoClient } from "mongodb";
import crypto from "node:crypto";

const MONGODB_URI = process.env.MONGODB_URI;
export const DB_NAME = "mimiria";

/**
 * Un único secreto para TODA la app.
 * Antes login.js/register.js/conversations.js usaban 'mimiria-dev-secret' y
 * _lib.js usaba otro distinto: si TOKEN_SECRET no estaba definida, /api/me
 * rechazaba los tokens emitidos por /api/login y la sesión nunca se restauraba.
 */
export const TOKEN_SECRET =
  process.env.TOKEN_SECRET || "mimiria-dev-secret-cambiar-en-produccion";

/* ---------------- Conexión a MongoDB (pool reutilizado entre invocaciones) ---------------- */
export function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI no está configurada");
  if (!globalThis.__mimirMongo) {
    globalThis.__mimirMongo = MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      appName: "mimiria",
    }).catch((err) => {
      // Si falla la conexión hay que descartar la promesa cacheada,
      // si no la función queda "envenenada" hasta el próximo cold start.
      globalThis.__mimirMongo = null;
      throw err;
    });
  }
  return globalThis.__mimirMongo.then((client) => client.db(DB_NAME));
}

/** Traduce errores típicos de MongoDB a mensajes útiles (sin revelar la URI). */
export function mongoHint(err) {
  const msg = String(err?.message || err || "");
  if (/Invalid scheme/i.test(msg)) {
    return 'La variable MONGODB_URI no es una cadena de conexión válida: debe empezar con "mongodb://" o "mongodb+srv://". En MongoDB Atlas ve a Database → Connect → Drivers, copia la cadena y reemplaza <username> y <password> por tus datos reales (sin los símbolos < >). Verifica que en Vercel la variable se llame exactamente MONGODB_URI y haz Redeploy.';
  }
  if (/Server selection timed out|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
    return "No se pudo conectar a MongoDB. Verifica la variable MONGODB_URI y en Atlas → Network Access permite la IP 0.0.0.0/0. Después haz Redeploy en Vercel.";
  }
  if (/bad auth|Authentication failed|auth/i.test(msg)) {
    return "MongoDB rechazó la autenticación. Revisa usuario y contraseña dentro de MONGODB_URI (caracteres especiales deben ir codificados, ej. @ como %40).";
  }
  return "Error de base de datos: " + msg.slice(0, 160);
}

/* ---------------- Contraseñas (scrypt, sin dependencias nativas) ---------------- */
export function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

/** Comparación en tiempo constante de dos hashes hexadecimales. */
export function verifyPassword(password, salt, expectedHex) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(String(expectedHex || ""), "hex");
  if (actual.length !== expected.length || expected.length === 0) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/* ---------------- Tokens de sesión (HMAC) ---------------- */
export function signToken(payload, ttlHours = 24 * 30) {
  const body = Buffer
    .from(JSON.stringify({ ...payload, exp: Date.now() + ttlHours * 3600_000 }))
    .toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- HTTP helpers ---------------- */
/**
 * vercel.json NO define cabeceras CORS (el comentario original mentía),
 * así que las añadimos aquí, en un único sitio, para todas las respuestas.
 */
export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function send(res, status, body) {
  cors(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}

/**
 * Responde el preflight CORS (OPTIONS) con 204.
 * Devuelve true si ya se respondió (para que el handler haga `return`).
 */
export function preflight(req, res) {
  cors(res);
  if (req.method !== "OPTIONS") return false;
  res.status(204).end();
  return true;
}

/**
 * Lee el cuerpo JSON de la petición.
 * En Vercel `req.body` ya viene parseado para application/json: leer el stream
 * con `for await (const chunk of req)` devuelve vacío porque ya se consumió.
 * Por eso se comprueba req.body ANTES de tocar el stream.
 */
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

/* ---------------- Autenticación ---------------- */
export function authPayload(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || typeof payload.userId !== "number") return null;
  return payload;
}

export async function authUser(req) {
  const payload = authPayload(req);
  if (!payload) return null;
  const db = await getDb();
  const user = await db.collection("users").findOne({ userId: payload.userId });
  return user || null;
}

/* ---------------- ID correlativo de estudiante ---------------- */
export const displayId = (n) => `#${String(n).padStart(3, "0")}`;

export async function nextUserId(db) {
  const doc = await db
    .collection("counters")
    .findOneAndUpdate(
      { _id: "users" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  // El driver v5 devuelve { value }, el v6+ devuelve el documento directamente.
  const value = doc?.value ?? doc;
  const seq = value?.seq;
  if (typeof seq !== "number") throw new Error("No se pudo generar el ID de estudiante");
  return seq;
}

/* ============================================================================
   Caché de preguntas frecuentes
   --------------------------------------------------------------------------
   Muchos estudiantes preguntan exactamente lo mismo ("¿qué es la fotosíntesis?").
   Guardar la respuesta y reutilizarla ahorra tokens y responde al instante.
   ========================================================================== */

export const CACHE_COLLECTION = "qa_cache";
export const CACHE_TTL_DAYS = 30;

/** Muletillas que no cambian el significado de la pregunta. */
const FILLERS = [
  /^(oye|hola|hey|buenas)[,\s]+/,
  /^(por favor|porfa|porfis)[,\s]+/,
  /^(me puedes|puedes|podr[ií]as|me podr[ií]as)\s+(explicar|decir|contar|ayudar con)\s+/,
  /^(explicame|expl[ií]came|dime|cu[eé]ntame|ay[uú]dame con)\s+/,
  /[,\s]+(por favor|porfa|gracias)[.!?]*$/,
];

/**
 * Normaliza la pregunta para que variantes triviales compartan la misma entrada:
 * minúsculas, sin tildes, sin signos repetidos, sin muletillas y sin espacios
 * sobrantes. NO se tocan las palabras interrogativas ("qué", "por qué"…),
 * porque cambian la respuesta.
 */
export function normalizeQuestion(question) {
  let q = String(question || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quitar tildes
    .replace(/\s+/g, " ")
    .trim();

  for (const re of FILLERS) q = q.replace(re, "").trim();

  return q
    .replace(/^[¿¡]+/, "")
    .replace(/[?!.¿¡]+$/, "")
    .trim();
}

/** Clave de caché: SHA-256 de la pregunta normalizada. */
export function cacheKey(question) {
  const normalized = normalizeQuestion(question);
  if (normalized.length < 8) return null; // demasiado corta para ser útil
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

let cacheIndexReady = false;

async function ensureCacheIndexes(db) {
  if (cacheIndexReady) return;
  cacheIndexReady = true;
  try {
    // Índice TTL: MongoDB borra solo las entradas viejas.
    await db.collection(CACHE_COLLECTION).createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: CACHE_TTL_DAYS * 24 * 3600 }
    );
  } catch (e) {
    cacheIndexReady = false;
    console.error("[CACHE] No se pudo crear el índice TTL:", e.message);
  }
}

/**
 * Busca una respuesta guardada. Un fallo de caché NUNCA debe tumbar el chat,
 * así que cualquier error se registra y se devuelve null (se llama a la IA).
 */
export async function readCache(db, key) {
  if (!key) return null;
  try {
    await ensureCacheIndexes(db);
    const doc = await db.collection(CACHE_COLLECTION).findOneAndUpdate(
      { _id: key },
      { $inc: { hits: 1 }, $set: { lastUsedAt: new Date() } },
      { returnDocument: "after" }
    );
    const hit = doc?.value ?? doc;
    return hit && typeof hit.text === "string" ? hit : null;
  } catch (e) {
    console.error("[CACHE] Error al leer:", e.message);
    return null;
  }
}

/** Guarda una respuesta nueva en la caché. */
export async function writeCache(db, key, { question, text, sources, followups, model }) {
  if (!key || !text) return;
  try {
    await ensureCacheIndexes(db);
    await db.collection(CACHE_COLLECTION).updateOne(
      { _id: key },
      {
        $set: {
          question: String(question).slice(0, 500),
          normalized: normalizeQuestion(question),
          text,
          sources: sources || [],
          followups: followups || [],
          model,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
        $setOnInsert: { hits: 0 },
      },
      { upsert: true }
    );
  } catch (e) {
    console.error("[CACHE] Error al guardar:", e.message);
  }
}

/* ---------------- Prompt del tutor ---------------- */
export const SYSTEM_PROMPT = `Eres MIMIR IA, un tutor personal creado por estudiantes del SENA (ficha 3156695) para la Institución Educativa Gonzalo Rivera Laguado de Cúcuta, Colombia.

## Sobre ti (MIMIR IA):
- **Nombre completo:** MIMIR IA (Mente Inteligente para Mejorar el Rendimiento)
- **Propósito:** Plan de mejoramiento académico a partir de inteligencia artificial
- **Creado por:** Estudiantes del SENA, programa 233108, ficha 3156695
- **Institución:** Institución Educativa Gonzalo Rivera Laguado, Cúcuta, Norte de Santander, Colombia
- **Tecnología:** Usas GPT-5-mini y GPT-5-nano de OpenAI con enrutamiento inteligente según la dificultad de la pregunta
- **Funcionalidades:** Explicas conceptos paso a paso, buscas información con fuentes verificadas, diseñas rutas de estudio personalizadas, guardas el historial de conversaciones
- **Acceso:** Gratuito para estudiantes, disponible 24/7 desde cualquier dispositivo
- **Privacidad:** Las contraseñas se guardan cifradas, no se venden datos, cumple con la Ley 1581 de 2012 de Protección de Datos Personales
- **ID de estudiante:** Cada usuario recibe un ID único correlativo (#001, #002, etc.) que vincula todo su historial

Cuando te pregunten sobre ti mismo, quién te creó, cómo funcionas, o cualquier pregunta sobre MIMIR IA, responde con esta información de forma clara y amigable.

## FORMATO DE RESPUESTA (MUY IMPORTANTE):
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin texto ni bloques de código alrededor.

El JSON debe tener EXACTAMENTE esta estructura:
{
  "text": "tu explicación completa en formato markdown",
  "sources": [
    {"label": "Nombre de la fuente — Tema", "url": "https://..."}
  ],
  "followups": [
    "pregunta de seguimiento 1",
    "pregunta de seguimiento 2"
  ]
}

## Reglas del contenido:
- Responde SIEMPRE en español, con tono cálido, paciente y motivador.
- En "text": explica paso a paso con estructura clara usando **negritas**, listas numeradas y ejemplos. Cierra con una pregunta que fomente el pensamiento crítico.
- En "sources": incluye entre 2 y 4 fuentes reales y verificables (Wikipedia, Khan Academy, sitios .edu, .gov, MDN, Britannica, Banrepcultural, Colombia Aprende, etc.).
- En "followups": sugiere 2-3 preguntas de seguimiento relacionadas con el tema.

Recuerda: SOLO el JSON, nada más.`;
