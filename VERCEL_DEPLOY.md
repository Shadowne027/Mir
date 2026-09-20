# 🚀 Despliegue en Vercel - Guía Rápida

## ✅ Estado del Código
- ✅ ChatGPT 5 mini configurado
- ✅ MongoDB integrado
- ✅ Build funciona sin errores
- ✅ vercel.json simplificado

## 📋 Pasos para Desplegar

### 1. Sube los cambios a GitHub
```bash
git add .
git commit -m "Fix: vercel.json simplificado"
git push
```

### 2. Configura Vercel
1. Ve a tu proyecto en Vercel
2. **Settings** → **General**
3. Verifica:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Root Directory:** (déjalo VACÍO)

### 3. Variables de Entorno
En **Settings** → **Environment Variables**, agrega:

```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/mimiria
OPENAI_API_KEY=sk-proj-tu-clave-aqui
TOKEN_SECRET=un-texto-largo-aleatorio
```

### 4. Redeploy
1. Ve a **Deployments**
2. Último deploy → **⋮** → **Redeploy**
3. Espera 1-2 minutos

### 5. Verifica
Abre: `https://tu-sitio.vercel.app/api/health`

Debe mostrar:
```json
{
  "ok": true,
  "build": "mimir-v5-openai",
  "mongo": true,
  "openai": true,
  "model": "gpt-5-mini + gpt-5-nano (enrutamiento inteligente + caché)"
}
```

## ❌ Si Sigue Fallando

### Problema: "El servidor no tiene las funciones /api desplegadas"

**Causa:** Las funciones serverless no se están ejecutando.

**Soluciones:**

1. **Verifica que la carpeta `api/` esté en GitHub**
   - Debe tener 7 archivos: `_lib.js`, `chat.js`, `conversations.js`, `health.js`, `login.js`, `me.js`, `register.js`

2. **Revisa los logs de Vercel**
   - Ve a **Deployments** → último deploy → **View Build Logs**
   - Busca errores como "Cannot find module" o "Syntax error"

3. **Elimina y recrea el proyecto**
   - En Vercel: **Settings** → baja hasta **Delete Project**
   - Crea uno nuevo importando el repositorio
   - Asegúrate de que Framework Preset sea **Vite**

4. **Verifica las variables de entorno**
   - Deben estar configuradas ANTES del deploy
   - Nombres exactos: `MONGODB_URI`, `OPENAI_API_KEY`, `TOKEN_SECRET`

## 🔧 Configuración Actual

### Backend (API)
- `api/chat.js` → Usa GPT-5-mini y GPT-5-nano con enrutamiento inteligente y caché
- `api/health.js` → Verifica MongoDB y OpenAI
- `api/register.js` → Crea usuarios con ID correlativo
- `api/login.js` → Autenticación
- `api/me.js` → Obtiene usuario actual
- `api/conversations.js` → CRUD de conversaciones
- `api/_lib.js` → Utilidades compartidas

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- React Router
- Lucide React (iconos)

### Base de Datos
- MongoDB Atlas
- Colecciones: `users`, `conversations`, `counters`

### IA
- OpenAI GPT-5-mini y GPT-5-nano
- Respuestas en JSON con fuentes y preguntas de seguimiento

## 📞 Soporte

Si después de seguir todos los pasos sigue fallando:
1. Abre `/api/health` y copia el error exacto
2. Revisa los logs de Vercel (Build Logs)
3. Verifica que las variables de entorno estén bien escritas

---

**Nota:** El código está 100% funcional. El problema es de configuración en Vercel.
