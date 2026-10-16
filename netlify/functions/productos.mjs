// API REST: GET /.netlify/functions/productos
// Consulta Google Sheets y devuelve el catálogo en JSON.
import { obtenerProductos } from "../lib/sheets.mjs";

export default async () => {
  try {
    const productos = await obtenerProductos();
    return Response.json({
      conexion: "OK",
      fuente: "Google Sheets",
      total: productos.length,
      productos,
    });
  } catch (error) {
    console.error("Error al consultar Google Sheets:", error);
    return Response.json(
      { conexion: "ERROR", error: "No fue posible consultar Google Sheets.", detalle: error.message },
      { status: 502 }
    );
  }
};
