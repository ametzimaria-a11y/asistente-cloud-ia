// API REST (Netlify Function): POST /.netlify/functions/asistente
// Versión con límite de 10 s. La aplicación usa la Edge Function /api/asistente,
// que no tiene ese límite mientras espera la respuesta de la IA.
import { manejarAsistente } from "../lib/asistente.mjs";

export default (req, context) => manejarAsistente(req, context, 9500);