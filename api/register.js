/** POST /api/register — { username, password } → { user } */
import { displayId, getDb, hashPassword, mongoHint, nextUserId, preflight, readBody, send, signToken } from "./_lib.js";
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });

  try {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (username.length < 2) {
      return send(res, 400, { error: "El nombre de usuario debe tener al menos 2 caracteres." });
    }
    if (username.length > 40) {
      return send(res, 400, { error: "El nombre de usuario es demasiado largo (máx. 40 caracteres)." });
    }
    if (password.length < 6) {
      return send(res, 400, { error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const db = await getDb();
    const users = db.collection("users");

    // Índice único: sin él, dos registros simultáneos con el mismo nombre
    // pasaban los dos el findOne y se creaban usuarios duplicados.
    await users.createIndex({ usernameLower: 1 }, { unique: true });

    const usernameLower = username.toLowerCase();
    if (await users.findOne({ usernameLower })) {
      return send(res, 409, { error: "Ese nombre de usuario ya está registrado." });
    }

    const userId = await nextUserId(db);
    const salt = crypto.randomBytes(16).toString("hex");

    try {
      await users.insertOne({
        userId,
        displayId: displayId(userId),
        username,
        usernameLower,
        salt,
        passwordHash: hashPassword(password, salt),
        createdAt: Date.now(),
      });
    } catch (e) {
      if (e?.code === 11000) {
        return send(res, 409, { error: "Ese nombre de usuario ya está registrado." });
      }
      throw e;
    }

    const token = signToken({ userId, username });

    return send(res, 201, {
      user: { userId, id: displayId(userId), username, token },
    });
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return send(res, 500, { error: mongoHint(error) });
  }
}
