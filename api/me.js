import { authUser, displayId, preflight, send } from "./_lib.js";

/** GET /api/me — valida el token y devuelve el usuario actual. */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") return send(res, 405, { error: "Método no permitido" });
  try {
    const user = await authUser(req);
    if (!user) return send(res, 401, { error: "Sesión inválida. Inicia sesión de nuevo." });
    return send(res, 200, {
      user: { userId: user.userId, id: user.displayId || displayId(user.userId), username: user.username },
    });
  } catch (e) {
    console.error("[ME] Error:", e);
    return send(res, 500, { error: "Error interno del servidor." });
  }
}
