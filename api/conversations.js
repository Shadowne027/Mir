/**
 * /api/conversations
 *  GET     → lista las conversaciones del usuario
 *  POST    → crea una conversación   { title? }
 *  DELETE  → elimina una conversación (?id=...)
 */
import { ObjectId } from "mongodb";
import { authPayload, getDb, mongoHint, preflight, readBody, send } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;

  // Verificación de token centralizada: firma en tiempo constante + caducidad.
  const payload = authPayload(req);
  if (!payload) return send(res, 401, { error: "Sesión inválida. Inicia sesión de nuevo." });

  try {
    // Pool reutilizado: antes se abría y cerraba una conexión nueva en cada
    // petición (y varias rutas de error la dejaban abierta).
    const db = await getDb();
    const col = db.collection("conversations");

    if (req.method === "GET") {
      const docs = await col
        .find({ userId: payload.userId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();
      return send(res, 200, {
        conversations: docs.map(({ _id, ...rest }) => ({ ...rest, id: String(_id) })),
      });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const title = String(body.title || "Nueva conversación").slice(0, 80);
      const now = Date.now();
      const doc = { userId: payload.userId, title, createdAt: now, updatedAt: now, messages: [] };
      const result = await col.insertOne(doc);
      const { _id, ...rest } = doc;
      return send(res, 201, { conversation: { ...rest, id: String(result.insertedId) } });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) return send(res, 400, { error: "Falta el id de la conversación." });
      if (!ObjectId.isValid(String(id))) {
        return send(res, 400, { error: "ID de conversación inválido." });
      }
      const result = await col.deleteOne({ _id: new ObjectId(String(id)), userId: payload.userId });
      if (result.deletedCount === 0) {
        return send(res, 404, { error: "Conversación no encontrada." });
      }
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: "Método no permitido" });
  } catch (error) {
    console.error("[CONVERSATIONS] Error:", error);
    return send(res, 500, { error: mongoHint(error) });
  }
}
