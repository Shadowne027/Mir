/**
 * GET /api/health — diagnóstico del servidor.
 * Devuelve mongoError / openaiError porque es lo que lee el frontend
 * (src/lib/api.ts); el código original sólo mandaba errors[]/warnings[]
 * y por eso la app siempre mostraba un mensaje genérico.
 */
import { mongoHint, preflight, send } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") return send(res, 405, { error: "Método no permitido" });

  const result = {
    ok: false,
    build: "mimir-v6-openai",
    model: "gpt-5-mini-2025-08-07 + gpt-5-nano-2025-08-07",
    mongo: false,
    mongoError: null,
    openai: false,
    openaiError: null,
  };

  const hasMongoUri = Boolean(process.env.MONGODB_URI);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  if (!hasMongoUri) {
    result.mongoError = "Falta la variable MONGODB_URI en Vercel → Settings → Environment Variables.";
  } else {
    try {
      const { MongoClient } = await import("mongodb");
      const client = await MongoClient.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      try {
        await client.db().command({ ping: 1 });
        result.mongo = true;
      } finally {
        await client.close();
      }
    } catch (e) {
      result.mongoError = mongoHint(e);
    }
  }

  if (!hasOpenAIKey) {
    result.openaiError = "Falta la variable OPENAI_API_KEY: la IA no podrá responder.";
  } else {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      result.openai = response.ok;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        result.openaiError = `OpenAI respondió ${response.status}: ${errData?.error?.message || "error desconocido"}`;
      }
    } catch (e) {
      result.openaiError = "No se pudo contactar a OpenAI: " + (e?.message || "error de red");
    }
  }

  // El chat necesita AMBOS servicios; antes `ok` sólo miraba MongoDB y la app
  // se declaraba "en línea" aunque la IA no pudiera responder.
  result.ok = result.mongo && result.openai;

  return send(res, result.ok ? 200 : 503, result);
}
