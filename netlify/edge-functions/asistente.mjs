// API REST (Netlify Edge Function): POST /api/asistente
// Las Edge Functions no tienen el límite de 10 s mientras esperan a Google Sheets y a la IA,
// por eso la aplicación consulta al asistente por esta ruta.
import { manejarAsistente } from "../lib/asistente.mjs";

export default (req, context) => manejarAsistente(req, context, 25000);

export const config = { path: "/api/asistente" };