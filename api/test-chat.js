/**
 * GET /api/test-chat — diagnóstico paso a paso (entorno, Mongo, OpenAI).
 * Útil para depurar el despliegue; puedes borrar este archivo en producción.
 */
import { preflight, send } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") return send(res, 405, { error: "Método no permitido" });

  const results = {
    step1_env: false,
    step2_mongodb: false,
    step3_openai_key: false,
    step4_openai_call: false,
    errors: [],
  };

  const hasMongoUri = Boolean(process.env.MONGODB_URI);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  results.step1_env = hasMongoUri && hasOpenAIKey;
  results.step3_openai_key = hasOpenAIKey;
  if (!hasMongoUri) results.errors.push("Falta MONGODB_URI");
  if (!hasOpenAIKey) results.errors.push("Falta OPENAI_API_KEY");
  if (!results.step1_env) return send(res, 500, results);

  try {
    const { MongoClient } = await import("mongodb");
    const client = await MongoClient.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.db().command({ ping: 1 });
      results.step2_mongodb = true;
    } finally {
      await client.close();
    }
  } catch (e) {
    results.errors.push("MongoDB: " + e.message);
    return send(res, 500, results);
  }

  try {
    const testResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: 'Di "OK" si funcionas' }],
        max_completion_tokens: 16,
      }),
    });
    if (!testResponse.ok) {
      const errorData = await testResponse.json().catch(() => ({}));
      results.errors.push("OpenAI: " + (errorData?.error?.message || `Status ${testResponse.status}`));
      return send(res, 500, results);
    }
    results.step4_openai_call = true;
  } catch (e) {
    results.errors.push("OpenAI call: " + e.message);
    return send(res, 500, results);
  }

  return send(res, 200, { ...results, message: "Todos los componentes del chat funcionan correctamente" });
}
