/** POST /api/login — { username, password } → { user } */
import { displayId, getDb, mongoHint, preflight, readBody, send, signToken, verifyPassword } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });

  try {
    const { username, password } = await readBody(req);
    if (!username || !password) {
      return send(res, 400, { error: "Escribe tu usuario y tu contraseña." });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({
      usernameLower: String(username).trim().toLowerCase(),
    });

    // Mismo mensaje para "no existe" y "clave incorrecta" (no filtrar qué usuarios existen).
    // La comparación es en tiempo constante; antes era un `!==` sobre el hash.
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return send(res, 401, { error: "Usuario o contraseña incorrectos." });
    }

    // signToken añade `exp`: los tokens del código original no caducaban nunca.
    const token = signToken({ userId: user.userId, username: user.username });

    return send(res, 200, {
      user: {
        userId: user.userId,
        id: user.displayId || displayId(user.userId),
        username: user.username,
        token,
      },
    });
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    return send(res, 500, { error: mongoHint(error) });
  }
}
