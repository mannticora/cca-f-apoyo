# CCA-F Simulation

Simulador de práctica para el examen **Claude Certified Architect (CCA-F)**, hecho para el curso de INMEGA. Es una app de una sola página HTML (sin build, sin backend propio) que usa Firebase Firestore como base de datos y jsPDF para exportar resultados y documentos.

**En vivo:** https://cca-f-apoyo.pages.dev

*(Sitio anterior en Azure Static Web Apps: https://purple-sand-0a77d3110.7.azurestaticapps.net — se quedó sin crédito de Azure for Students, ver sección "Despliegue".)*

## Qué hace

### Para cualquier persona que entra
- **Registro simple**: solo pide nombre y correo (se guarda en `localStorage` del navegador).
- **Examen general**: 25 preguntas de opción múltiple mezcladas, cubriendo los 5 dominios del examen real, con retroalimentación inmediata (correcta/incorrecta + explicación) y reporte final descargable en PDF.
- **Módulos por dominio**: practicar un dominio específico a la vez.
- **Historial**: resultados de intentos anteriores guardados por usuario.
- **Unirse a una sesión Live**: con un código de 5 letras que comparte un Admin.

### Para el Admin (panel `Panel Admin` en el menú)
- **Documento de estudio**: genera y descarga un documento (Markdown o PDF) con N preguntas (5 hasta "todas las disponibles") tomadas del banco completo, repartidas proporcionalmente entre los 5 dominios, incluyendo la respuesta correcta y su explicación — útil para imprimir o repasar offline. Justo después de generarlo aparece un botón para crear una sesión Live con ese mismo conjunto de preguntas.
- **Crear sesión Live**: elige duración por persona y sube el PDF del Documento de estudio — el navegador vuelve a extraer su texto y empareja cada pregunta contra el banco de 97 para crear la sesión con exactamente esas preguntas, en ese orden. Genera un código de sesión para compartir con el grupo. Cada participante avanza a su propio ritmo (no es sincronizado), sin ver si acertó hasta el final.
- **Monitorear sesiones**: progreso en tiempo real de cada participante (aciertos, % completado, tiempo restante), con descarga de PDF grupal.
- **Gestión de usuarios y roles**: lista todas las cuentas registradas y su rol, con botón para quitar/otorgar el rol Admin.

## Banco de preguntas

Un solo banco de **97 preguntas** repartido en los 5 dominios del examen (18 en Agentic Architecture, Tool Design & MCP, Prompt Engineering, y Context Management; 25 en Claude Code Configuration & Workflows), usado tanto por las Sesiones Live como por el Documento de Estudio. El contenido nuevo se generó a partir de las guías "Quick Reference" oficiales de cada dominio, con el mismo estilo y nivel de dificultad que el examen real: escenario + pregunta + 4 opciones + explicación de por qué la respuesta correcta lo es y por qué las demás no.

## Cómo funciona técnicamente

- **`CCA-F Simulation.html`** — toda la app: HTML, CSS y JavaScript en un solo archivo (sin frameworks, sin paso de build).
- **`CCA-F Simulation_files/`** — dependencias vendored: Firebase (App + Firestore, versión compat), jsPDF, y pdf.js (extracción de texto de PDFs en el navegador).
- **`index.html`** — redirige a `CCA-F Simulation.html`, existe solo porque los hosts de sitios estáticos esperan un `index.html` en la raíz.
- **`functions/api/verify-admin-pin.js`** — Cloudflare Pages Function (serverless): recibe el PIN que un usuario intenta usar para registrarse como Admin y lo compara contra el secreto `ADMIN_PIN` guardado del lado del servidor (nunca en el código ni en el repo).
- **`staticwebapp.config.json`** — configuración específica de Azure Static Web Apps (host anterior, ver abajo); Cloudflare Pages no la usa.
- **Firebase Firestore** — guarda usuarios, historial de intentos y el estado de las sesiones Live (código, participantes, progreso). La configuración de Firebase está hardcodeada en el HTML a propósito (es pública por diseño; la seguridad real vive en las reglas de Firestore del proyecto, no en ocultar esos valores).

## Despliegue

Hospedado en **Cloudflare Pages** (plan Free, sin costo), conectado directo al repo de GitHub — cualquier push a `main` se despliega solo en 1-2 minutos, sin pasos manuales. La API key de Cloudflare no aplica aquí; lo único que vive como secreto del lado del servidor es el PIN de Admin (`wrangler pages secret put ADMIN_PIN`), no en el repo.

Antes estuvo en Azure Static Web Apps, bajo una suscripción de estudiante compartida con otro proyecto — cuando ese crédito se agotó, la función serverless de Azure quedó bloqueada (el sitio estático seguía funcionando, solo la función se caía). Por eso se migró todo a Cloudflare, que no depende de ningún crédito por tiempo limitado.

## Desarrollo local

No requiere build. Basta con abrir `CCA-F Simulation.html` directamente en un navegador (doble clic, o arrastrarlo a una pestaña) para probar cambios de UI/CSS/lógica del examen.

Esto **no** incluye la verificación del PIN de Admin — esa vive en `functions/api/verify-admin-pin.js` y necesita el runtime de Cloudflare para responder. Para probarla localmente:

```bash
npm install -g wrangler
echo "ADMIN_PIN=tu-pin-aqui" > .dev.vars
wrangler pages dev . --compatibility-date=2026-01-01
```

Esto levanta el sitio completo (estático + función) en `http://localhost:8788`, usando el PIN que pongas en `.dev.vars` (ese archivo nunca se sube al repo — ya está en `.gitignore`... si no está, agrégalo antes de crear el archivo).

## Clonar el repo y hacer cambios

```bash
git clone https://github.com/mannticora/cca-f-apoyo.git
cd cca-f-apoyo
```

A partir de ahí, edita `CCA-F Simulation.html` directamente (es un solo archivo, sin build) y prueba localmente como se explica arriba.

### Para contribuir al sitio en vivo (cca-f-apoyo.pages.dev)

1. Pide acceso de colaborador al repositorio de GitHub (a quien administre `mannticora`).
2. Haz tus cambios, commitea y sube tu rama / abre un Pull Request.
3. Al hacer merge a `main`, Cloudflare Pages despliega solo (está conectado directo al repo) — no hace falta correr nada manualmente.

### Para desplegar tu propia copia independiente (fork)

Si quieres tu propio sitio (no tocar el de producción), no necesitas acceso a nada existente:

1. Haz fork del repo en GitHub, o clónalo y crea tu propio remoto.
2. Crea tu cuenta gratis en [cloudflare.com](https://dash.cloudflare.com/sign-up) (sin tarjeta).
3. ```bash
   npm install -g wrangler
   wrangler login
   wrangler pages project create tu-nombre-de-proyecto
   wrangler pages deploy . --project-name=tu-nombre-de-proyecto
   wrangler pages secret put ADMIN_PIN --project-name=tu-nombre-de-proyecto
   ```
   (la última pide que definas tu propio PIN de Admin — necesitas el tuyo, el de este proyecto no es reutilizable).
4. Tu sitio queda en `https://tu-nombre-de-proyecto.pages.dev`.
5. **Opcional — Firebase propio**: por defecto la app usa el proyecto de Firebase de INMEGA (usuarios, historial y sesiones Live quedarían mezclados con los del sitio original). Si quieres datos completamente aislados, crea tu propio proyecto en [Firebase Console](https://console.firebase.google.com), y reemplaza el objeto `HARDCODED_FIREBASE_CONFIG` dentro de `CCA-F Simulation.html` (buscar ese nombre en el archivo) con la config de tu proyecto.

## Requisitos

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (para `npm install -g wrangler`)
- Una cuenta gratuita de [Cloudflare](https://dash.cloudflare.com/sign-up) (solo si vas a desplegar, no para editar/probar en local)
