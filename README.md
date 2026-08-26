# CCA-F Simulation

Simulador de práctica para el examen **Claude Certified Architect (CCA-F)**, hecho para el curso de INMEGA. Es una app de una sola página HTML (sin build, sin backend propio) que usa Firebase Firestore como base de datos y jsPDF para exportar resultados y documentos.

**En vivo:** https://purple-sand-0a77d3110.7.azurestaticapps.net

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

## Banco de preguntas

Un solo banco de **97 preguntas** repartido en los 5 dominios del examen (18 en Agentic Architecture, Tool Design & MCP, Prompt Engineering, y Context Management; 25 en Claude Code Configuration & Workflows), usado tanto por las Sesiones Live como por el Documento de Estudio. El contenido nuevo se generó a partir de las guías "Quick Reference" oficiales de cada dominio, con el mismo estilo y nivel de dificultad que el examen real: escenario + pregunta + 4 opciones + explicación de por qué la respuesta correcta lo es y por qué las demás no.

## Cómo funciona técnicamente

- **`CCA-F Simulation.html`** — toda la app: HTML, CSS y JavaScript en un solo archivo (sin frameworks, sin paso de build).
- **`CCA-F Simulation_files/`** — dependencias vendored: Firebase (App + Firestore, versión compat) y jsPDF.
- **`index.html`** — redirige a `CCA-F Simulation.html`, existe solo porque Azure Static Web Apps requiere un `index.html` en la raíz para desplegar.
- **`staticwebapp.config.json`** — hace que la URL raíz del sitio sirva `CCA-F Simulation.html` directamente.
- **Firebase Firestore** — guarda usuarios, historial de intentos y el estado de las sesiones Live (código, participantes, progreso). La configuración de Firebase está hardcodeada en el HTML a propósito (es pública por diseño; la seguridad real vive en las reglas de Firestore del proyecto, no en ocultar esos valores).

## Despliegue

Hospedado en **Azure Static Web Apps** (tier Free), bajo la suscripción de estudiante de Azure. El repo tiene un workflow de GitHub Actions (`.github/workflows/azure-static-web-apps-*.yml`) configurado para desplegar automáticamente en cada push a `main`, aunque actualmente no se está disparando por una restricción a nivel de cuenta de GitHub — mientras tanto, el despliegue se hace manualmente con `swa deploy` usando el token del recurso.

## Desarrollo local

No requiere build. Basta con abrir `CCA-F Simulation.html` en un navegador (o servirlo con cualquier servidor estático) para probar cambios.
