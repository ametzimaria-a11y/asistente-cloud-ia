# Asistente Cloud con IA

Práctica de Cloud Computing (Unidad 2) — Instituto Tecnológico Superior de Puruándiro.

Aplicación que responde preguntas sobre un catálogo de productos guardado en Google Sheets, usando un servicio de Inteligencia Artificial.

## Arquitectura

```
Usuario → React (frontend/) → API REST (netlify/functions/) → Google Sheets + API de IA → Respuesta → React
```

| Componente | Ubicación | Tipo |
|---|---|---|
| Interfaz React (Vite) | `frontend/` | Frontend |
| API REST serverless | `netlify/functions/` | Backend |
| Google Sheets (Apps Script) | `google-apps-script/Code.gs` | Servicio Cloud externo |
| Google Gemini / OpenAI | `netlify/lib/ia.mjs` | Servicio Cloud externo |
| Netlify | `netlify.toml` | Despliegue |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/.netlify/functions/productos` | Catálogo leído de Google Sheets |
| POST | `/.netlify/functions/asistente` | Recibe `{ pregunta, presupuesto, categoria, necesidad }` y responde con IA |
| GET | `/.netlify/functions/estadisticas` | Datos del dashboard |

## Variables de entorno

Ver `.env.example`. Las credenciales **nunca** se escriben en el código ni se suben a GitHub.

## Ejecutar en local

```bash
cd frontend
npm install
npm run dev
```

Para probar también las funciones: `npm install -g netlify-cli` y luego `netlify dev` desde la raíz.
