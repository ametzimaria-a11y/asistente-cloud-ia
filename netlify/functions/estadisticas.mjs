// API REST: GET /.netlify/functions/estadisticas
// Datos para el dashboard, calculados desde Google Sheets.
import { obtenerEstadisticas } from "../lib/sheets.mjs";

export default async () => {
  try {
    const { consultas = 0, productos = 0, categorias = 0 } = await obtenerEstadisticas();
    return Response.json({ conexion: "OK", consultas, productos, categorias });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return Response.json(
      { conexion: "ERROR", error: "No fue posible obtener las estadísticas.", detalle: error.message },
      { status: 502 }
    );
  }
};
