# MIMIR IA — cambios de esta entrega

Partí del ZIP que me enviaste (el que corresponde a mimiria.vercel.app), **no**
del que te devolví antes. Esa landing morada era otra versión del archivo; la
descarté por completo. El diseño verde, los textos, las imágenes y las zonas
clicables quedan exactamente como estaban: no moví un solo color, título ni
sección del original.

## Verificación

Compilé el proyecto y lo abrí en un navegador real (Chromium) para comprobarlo,
no solo leyendo el código:

- Las 13 secciones renderizan: navbar, hero, chat teaser, características, cómo
  funciona, sobre MIMIRIA, carrusel, institución, FAQ y pie.
- Cero errores de JavaScript en consola.
- El modo oscuro aplica (`body` pasa a `rgb(11, 17, 32)`).
- El carrusel avanza, el FAQ despliega y el modal de registro abre.
- `npx tsc --noEmit` y `npm run build` pasan limpios.

Lo único que no pude ver son las fotos de ImgBB, Unsplash y del sitio del
colegio, porque mi entorno no tiene acceso a internet. Los `<img>` y las rutas
están intactos, así que en tu despliegue cargan igual que ahora.

---

## 1. Archivos: hasta 20 MB y 5 fotos por carga

Formatos aceptados: **fotos** (JPG, PNG, GIF, WEBP), **PDF**, **Word .docx**,
**Excel .xlsx/.xlsm**, **PowerPoint .pptx**, y texto/código (txt, md, csv, tsv,
json, xml, html y unas veinte extensiones más).

Límites: 20 MB por archivo, 5 fotos y 5 documentos por envío.

### Cómo se logró el límite de 20 MB

Hay un obstáculo real: **Vercel rechaza cualquier petición de más de ~4.5 MB**.
Un PDF de 20 MB convertido a base64 pesa unos 27 MB, así que enviarlo al
servidor nunca podría funcionar, por mucho que el código lo permitiera.

La solución fue mover el trabajo al navegador (`src/lib/extract.ts`):

- **Documentos**: el texto se extrae en el equipo del estudiante y al servidor
  solo viaja ese texto (máximo 20.000 caracteres). Un PDF de 20 MB se convierte
  en unos pocos KB antes de salir del navegador.
- **Fotos**: se reducen a 1600 px de lado mayor y se recomprimen a JPEG antes de
  enviarlas. Una foto de celular de 20 MB queda en unos cientos de KB sin perder
  legibilidad.

Todo con `DecompressionStream`, que ya viene en el navegador: **no instalé
ninguna librería nueva**. Los formatos de Office son ZIP con XML dentro, y los
PDF guardan su contenido comprimido con el mismo algoritmo.

Lo probé con un .docx, .xlsx, .pptx, tres PDF distintos (FlateDecode,
ASCII85+Flate y sin comprimir), un .csv y un .md generados de verdad,
verificando acentos, ñ, símbolos escapados, tablas, varias hojas, varias
diapositivas y cadenas hexadecimales.

### Lo que no funciona, y la app lo dice

- **`.doc`, `.xls`, `.ppt` antiguos**: son binarios OLE, otro formato. El aviso
  pide guardarlos como `.docx`/`.xlsx`/`.pptx`.
- **PDF escaneados**: no hay OCR. Si el PDF no tiene capa de texto, el mensaje
  sugiere subir la página como foto, que sí funciona porque la lee el modelo de
  visión.
- **Navegadores muy viejos** sin `DecompressionStream` (Safari anterior a 16.4):
  avisa y sugiere actualizar.

## 2. nano para lo simple, mini para lo complejo

`chooseModel()` en `api/chat.js`, con el motivo de cada decisión en los logs de
Vercel para que puedas afinarlo con casos reales.

**gpt-5-nano** con saludos y cortesías, preguntas sobre el propio MIMIR
("¿quién eres?") y datos puntuales cortos ("¿cuál es la capital de Colombia?",
"¿en qué año nació Simón Bolívar?").

**gpt-5-mini** en todo lo demás y siempre que haya adjuntos: señales de
razonamiento (analiza, compara, resuelve, demuestra, ensayo, código, paso a
paso, por qué, diferencia entre…), notación matemática y mensajes con varias
preguntas.

El umbral está del lado de mini a propósito: el valor de un tutor está en la
explicación con fuentes, y ahí el modelo pequeño se queda corto.

## 3. Caché de preguntas

Reemplacé la caché anterior, que tenía un problema serio de rendimiento: cargaba
**toda** la colección en memoria en cada pregunta y comparaba una por una. Con
unos cientos de entradas eso ya se nota; con unos miles, la función se cae.

La nueva usa la clave primaria de MongoDB: el SHA-256 de la pregunta
normalizada (minúsculas, sin tildes, sin signos, sin muletillas). Una sola
búsqueda indexada, sin importar cuántas entradas haya. Estas cinco comparten
entrada:

```
¿Qué es la fotosíntesis?      Explícame qué es la fotosíntesis por favor
que es la fotosintesis         QUE ES LA FOTOSINTESIS!!
Oye, ¿qué es la fotosíntesis?
```

Y "¿por qué llueve?" y "¿qué es la lluvia?" siguen dando claves distintas, que
es lo importante. Solo se cachean preguntas independientes: si hay adjuntos o la
conversación ya tiene mensajes, la respuesta depende del contexto y reutilizarla
daría resultados equivocados. Caducan solas a los 30 días con un índice TTL.

En el chat, las respuestas de caché llevan debajo un aviso discreto.

## 4. Modo claro y oscuro

El botón flotante ya existía y funciona bien; lo dejé igual. Lo que sí arreglé:
**los modales estaban con los colores fijos en claro** (`bg-[#FDFCF8]`,
`text-[#0F172A]`), así que en modo oscuro salía un panel blanco. Ahora usan las
variables del tema. En modo claro se ven idénticos a antes.

También faltaban las animaciones `animate-overlay-in` y `animate-modal-in`: las
clases se usaban en el Dialog pero no estaban definidas en el CSS, así que los
modales aparecían de golpe.

## 5. Términos, Privacidad y Contacto

Nueva columna "Legal y contacto" en el pie, con tres enlaces. Al pasar el mouse
aparece una tarjeta flotante con el resumen y tres puntos clave; al hacer clic
se abre el texto completo. En móvil no hay hover, así que el toque abre
directamente el detalle.

- **Términos y condiciones**: 8 apartados reales (quién puede usarlo, uso
  aceptable, límites de la IA, archivos, disponibilidad, propiedad intelectual).
- **Política de privacidad**: 7 apartados, con la Ley 1581 de 2012, qué datos se
  guardan, con quién se comparten (OpenAI, MongoDB Atlas, Vercel), cómo funciona
  la caché y cómo pedir que borren tu cuenta.
- **Contacto**: correo `Cristiancaro027@gmail.com` (abre el cliente de correo con
  asunto) y WhatsApp `+57 324 472 8516` (abre el chat con mensaje inicial).

Además, un **botón flotante de WhatsApp** en la esquina inferior derecha, encima
del de tema, con su etiqueta al pasar el mouse.

Los textos legales los escribí yo según lo que hace la aplicación. **No son un
documento revisado por un abogado**: para un proyecto del SENA sirven, pero si
la plataforma se abre a más colegios conviene que alguien con formación jurídica
les dé una pasada.

---

## Correcciones de fallos

Además de lo que pediste, arreglé esto:

1. **`api/chat.js` enviaba `temperature: 0.7`**, que los modelos gpt-5 no
   aceptan: la API devolvía 400 en cada llamada.
2. **Dos secretos de token distintos**: `_lib.js` usaba uno y
   `login/register/conversations` otro. Si `TOKEN_SECRET` no estaba configurada,
   `/api/me` rechazaba los tokens recién emitidos por `/api/login` y la sesión no
   sobrevivía a un refresco.
3. **Los tokens no caducaban nunca**: se firmaban sin campo `exp`.
4. **El cuerpo de las peticiones se leía del stream ya consumido**
   (`for await (const chunk of req)`). En Vercel `req.body` ya viene parseado, así
   que se leía vacío: por eso el título de las conversaciones siempre quedaba en
   "Nueva conversación".
5. **Conexión nueva a MongoDB en cada petición**, y varias rutas de error la
   dejaban sin cerrar. Ahora hay un pool compartido.
6. **Registro con condición de carrera**: sin índice único, dos registros
   simultáneos con el mismo nombre creaban usuarios duplicados.
7. **Comparaciones sensibles a timing** en la contraseña y en la firma del token.
8. **CORS**: el comentario decía que las cabeceras las ponía `vercel.json`, pero
   ahí no había ninguna sección `headers`.
9. **`<button>` dentro de `<button>`** en la lista de conversaciones: HTML
   inválido, con el clic propagándose de forma impredecible.
10. **`/api/health` no devolvía los campos que lee el frontend** (`mongoError`,
    `openaiError`), y marcaba `ok` mirando solo MongoDB: la app se declaraba "en
    línea" aunque la IA no pudiera responder.
11. **`.gitignore` con comillas de markdown**: no ignoraba nada, por eso
    `node_modules/` venía dentro del ZIP.
12. **Diez dependencias sin usar** (`@supabase/supabase-js`, `framer-motion`,
    `recharts`, `@dnd-kit/*`, `embla-carousel-react`, `date-fns`, `uuid`,
    `canvas-confetti`). Ninguna se importa en el código.

## Antes de desplegar

1. `rm -rf node_modules dist && npm install` — borré `package-lock.json` porque
   quedó desfasado al quitar dependencias; se regenera solo.
2. En Vercel → Settings → Environment Variables: `MONGODB_URI`, `OPENAI_API_KEY`
   y `TOKEN_SECRET`. Si cambias `TOKEN_SECRET`, todas las sesiones abiertas se
   cierran.
3. Comprueba `https://mimiria.vercel.app/api/health`: debe responder
   `{"ok": true, "mongo": true, "openai": true}`.

Lo que no pude probar por falta de red: la llamada real a OpenAI y la conexión
real a MongoDB Atlas. Eso lo sabrás en el primer despliegue con `/api/health`.

## Detalles que quizá quieras revisar

- Una de las imágenes del carrusel (`IMG_AUTODIDACTA`) viene de
  `encrypted-tbn0.gstatic.com`, que es la caché de miniaturas de Google
  Imágenes: puede desaparecer en cualquier momento y su licencia es dudosa.
  Conviene subirla a ImgBB con las demás.
- `api/test-chat.js` expone diagnóstico del servidor sin autenticación. Es útil
  mientras despliegas; bórralo cuando esté estable.
- La caché es global entre todos los estudiantes. Para preguntas académicas es
  justo lo que quieres, pero si algún día agregas respuestas personalizadas
  ("¿cómo van mis notas?"), hay que incluir el `userId` en la clave.
