# MIMIR IA — Despliegue en Vercel (MongoDB + Gemini)

La app está lista para subir a Vercel tal como está:

- **Frontend:** Vite + React (se compila a `dist/`).
- **Backend:** funciones serverless en la carpeta `api/` (Vercel las detecta automáticamente):
  - `api/register.js` — crea la cuenta y asigna el **ID correlativo en MongoDB** (`#001`, `#002`, …).
  - `api/login.js` / `api/me.js` — sesión con token firmado.
  - `api/conversations.js` — historial de conversaciones por usuario (MongoDB).
  - `api/chat.js` — responde con **GPT-5-mini y GPT-5-nano** (OpenAI) usando enrutamiento inteligente según la dificultad de la pregunta, con sistema de caché para preguntas frecuentes, y guarda cada mensaje.

## 1. MongoDB Atlas

1. Crea un cluster gratuito (M0) en [MongoDB Atlas](https://www.mongodb.com/atlas).
2. En **Database Access** crea un usuario con contraseña.
3. En **Network Access** permite `0.0.0.0/0` (acceso desde cualquier IP — Vercel cambia de IP).
4. En **Database → Connect → Drivers** copia la cadena de conexión:
   `mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/`

La base `mimiria` y las colecciones (`users`, `conversations`, `counters`) se crean solas al primer uso.
El contador de IDs vive en `counters` → cada registro nuevo recibe el siguiente número (`#001`, `#002`, …).

## 2. OpenAI (GPT-5-mini y GPT-5-nano)

1. Entra a [platform.openai.com/api-keys](https://platform.openai.com/api-keys) y crea una API key.
2. Verifica que tu cuenta tenga acceso a los modelos `gpt-5-mini` y `gpt-5-nano`.
3. Agrega créditos a tu cuenta (mínimo $5 USD para empezar).

## 3. Vercel

1. Sube el proyecto a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repositorio.
3. Framework: **Vite** (se detecta solo). No cambies el build command.
4. En **Settings → Environment Variables** agrega las tres variables (ver `.env.example`):
   - `MONGODB_URI`
   - `OPENAI_API_KEY`
   - `TOKEN_SECRET` (genera uno largo y aleatorio)
5. **Deploy**. Listo: `https://tu-proyecto.vercel.app`.

## 4. Comprobación

- **El paso clave:** abre en el navegador `https://tu-sitio.vercel.app/api/health`.
  - `{"ok": true, "mongo": true, "openai": true}` → todo conectado.
  - Si `mongo: false` → el JSON te dice el motivo exacto (lee `mongoError`).
  - Si `openai: false` → revisa `openaiError` (clave inválida, sin saldo, etc.).
- Abre la app y crea una cuenta: el toast te muestra tu ID (`#001`).
- En el chat, el panel lateral debe decir **"Conectado · GPT-5-mini + MongoDB"**. **“Conectado · Gemini + MongoDB”**.
- En Atlas verás los documentos en `users` y `conversations`, vinculados por `userId`.

## 5. Si algo falla (solución de problemas)

1. **¿Agregaste variables pero nada cambió?** Las variables de entorno solo aplican a
   deploys nuevos. Ve a *Deployments → ⋯ → Redeploy* (marca "Use existing Build Cache"
   si quieres que sea rápido). Sin Redeploy, las funciones siguen sin ver las variables.
2. **Cuentas/historial no se comparten entre dispositivos** → significa que `/api/health`
   está devolviendo `ok: false` (la página cae al modo local). Ábrelo y lee el error.
3. **`mongoError: Server selection timed out`** → en MongoDB Atlas ve a
   *Network Access* y agrega la IP `0.0.0.0/0` (Allow from anywhere). Vercel usa IPs variables.
4. **`mongoError: bad auth / Authentication failed`** → el usuario o la contraseña dentro
   de `MONGODB_URI` están mal. Si la contraseña tiene caracteres como `@`, `:`, `/`,
   debes codificarlos (`@` → `%40`). Ejemplo correcto:
   `mongodb+srv://juan:mi%40clave@cluster0.ab12c.mongodb.net/?retryWrites=true&w=majority`
5. **La IA responde un error de OpenAI** → el chat ahora muestra el mensaje exacto:
   - `401 Incorrect API key` → la clave está mal copiada (sobran espacios, falta un trozo).
   - `429 / quota` → la cuenta de OpenAI no tiene saldo o excedió el límite.
   - `model_not_found` → tu cuenta aún no tiene acceso a `gpt-5-mini` o `gpt-5-nano`.
6. **Los nombres de las variables deben ser exactos:** `MONGODB_URI`, `OPENAI_API_KEY`,
   `TOKEN_SECRET` — sin espacios antes/después de la `=` ni de los valores.

## Estructura relevante

```
api/                ← funciones serverless (Node 20)
  _lib.js           ← Mongo, tokens, hash de contraseñas, prompt del tutor
  health.js         ← estado del backend (lo usa el frontend para modo demo)
  register.js       ← POST  /api/register   → ID #001…
  login.js          ← POST  /api/login
  me.js             ← GET   /api/me
  conversations.js  ← GET/POST/DELETE /api/conversations
  chat.js           ← POST  /api/chat       → GPT-5-mini/nano (enrutamiento + caché) + historial
src/lib/api.ts      ← cliente del frontend (API real con caída a modo demo)
vercel.json         ← SPA rewrites + configuración de funciones
```
