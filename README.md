# CCA-F Simulation

Simulador de práctica para el examen **Claude Certified Architect (CCA-F)**, hecho para el curso de INMEGA. Es una app de una sola página HTML (sin build, sin backend propio) que usa Firebase Firestore como base de datos y jsPDF para exportar resultados y documentos.

**En vivo:** https://cca-f-apoyo.pages.dev

*(Sitio anterior en Azure Static Web Apps, sin la función de generar preguntas desde PDF: https://purple-sand-0a77d3110.7.azurestaticapps.net — se quedó sin crédito de Azure for Students, ver sección "Despliegue".)*

## Qué hace

### Para cualquier persona que entra
- **Registro simple**: solo pide nombre y correo (se guarda en `localStorage` del navegador).
- **Examen general**: 25 preguntas de opción múltiple mezcladas, cubriendo los 5 dominios del examen real, con retroalimentación inmediata (correcta/incorrecta + explicación) y reporte final descargable en PDF.
- **Módulos por dominio**: practicar un dominio específico a la vez.
- **Historial**: resultados de intentos anteriores guardados por usuario.
- **Unirse a una sesión Live**: con un código de 5 letras que comparte un Admin.

### Para el Admin (panel `Panel Admin` en el menú)
- **Crear sesión Live**: elige número de preguntas (5/10/15/20) y duración por persona; genera un código de sesión para compartir con el grupo. Cada participante avanza a su propio ritmo (no es sincronizado), sin ver si acertó hasta el final.
- **Monitorear sesiones**: progreso en tiempo real de cada participante (aciertos, % completado, tiempo restante), con descarga de PDF grupal.
- **Documento de estudio**: genera y descarga un documento (Markdown o PDF) con N preguntas (5 hasta "todas las disponibles") tomadas del banco completo, repartidas proporcionalmente entre los 5 dominios, incluyendo la respuesta correcta y su explicación — útil para imprimir o repasar offline.
- **Generar preguntas desde un PDF**: sube un PDF (apuntes, guía, material del curso), el navegador extrae el texto con pdf.js, y una función serverless llama a la API de Anthropic (Claude) para generar preguntas nuevas en el mismo formato y nivel de dificultad del examen, listas para descargar en Markdown o PDF.

## Banco de preguntas

Un solo banco de **97 preguntas** repartido en los 5 dominios del examen (18 en Agentic Architecture, Tool Design & MCP, Prompt Engineering, y Context Management; 25 en Claude Code Configuration & Workflows), usado tanto por las Sesiones Live como por el Documento de Estudio. El contenido nuevo se generó a partir de las guías "Quick Reference" oficiales de cada dominio, con el mismo estilo y nivel de dificultad que el examen real: escenario + pregunta + 4 opciones + explicación de por qué la respuesta correcta lo es y por qué las demás no.

## Cómo funciona técnicamente

- **`CCA-F Simulation.html`** — toda la app: HTML, CSS y JavaScript en un solo archivo (sin frameworks, sin paso de build).
- **`CCA-F Simulation_files/`** — dependencias vendored: Firebase (App + Firestore, versión compat), jsPDF, y pdf.js (extracción de texto de PDFs en el navegador).
- **`index.html`** — redirige a `CCA-F Simulation.html`, existe solo porque los hosts de sitios estáticos esperan un `index.html` en la raíz.
- **`functions/api/generate-questions.js`** — Cloudflare Pages Function (serverless): recibe el texto extraído de un PDF, llama a la API de Anthropic con la key guardada como secreto del lado del servidor (nunca en el código ni en el repo), y devuelve preguntas en formato estructurado.
- **`staticwebapp.config.json`** — configuración específica de Azure Static Web Apps (host anterior, ver abajo); Cloudflare Pages no la usa.
- **Firebase Firestore** — guarda usuarios, historial de intentos y el estado de las sesiones Live (código, participantes, progreso). La configuración de Firebase está hardcodeada en el HTML a propósito (es pública por diseño; la seguridad real vive en las reglas de Firestore del proyecto, no en ocultar esos valores).

## Despliegue

Hospedado en **Cloudflare Pages** (plan Free, sin costo). Se despliega con `wrangler pages deploy` (incluye tanto el sitio estático como la función `functions/api/generate-questions.js`). La API key de Anthropic vive como secreto de Cloudflare (`wrangler pages secret put ANTHROPIC_API_KEY`), no en el repo.

Antes estuvo en Azure Static Web Apps, bajo una suscripción de estudiante compartida con otro proyecto — cuando ese crédito se agotó, la función serverless de Azure quedó bloqueada (el sitio estático seguía funcionando, solo la función se caía). Por eso se migró todo a Cloudflare, que no depende de ningún crédito por tiempo limitado.

## Desarrollo local

No requiere build. Basta con abrir `CCA-F Simulation.html` en un navegador (o servirlo con cualquier servidor estático) para probar cambios.
