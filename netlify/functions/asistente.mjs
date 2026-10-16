// API REST: POST /.netlify/functions/asistente
// Flujo: Pregunta -> Google Sheets (productos) -> Prompt -> Servicio de IA -> Respuesta JSON
import { obtenerProductos, guardarHistorial, normalizar } from "../lib/sheets.mjs";
import { generarRespuesta } from "../lib/ia.mjs";

const pesos = (n) =>
  n == null ? "sin precio" : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`;

const error = (mensaje, status, detalle) =>
  Response.json({ error: mensaje, ...(detalle ? { detalle } : {}) }, { status });

const INSTRUCCIONES = `Eres el "Asistente Cloud", un asistente especializado en productos tecnológicos de una tienda.

Reglas:
1. Utiliza solamente la información del CATÁLOGO proporcionado. No inventes productos, precios ni características.
2. Si ningún producto cumple con la solicitud, indícalo claramente y, si existe, sugiere la alternativa más cercana del catálogo explicando qué condición no cumple.
3. Si la pregunta no tiene relación con los productos del catálogo, responde amablemente que solo puedes ayudar con consultas sobre el catálogo.
4. Menciona siempre el nombre exacto y el precio en pesos mexicanos de los productos que recomiendes.
5. Explica brevemente la razón de tu recomendación.
6. Respeta los filtros del usuario (presupuesto, categoría y necesidad) cuando existan.
7. Responde en español, en texto plano, sin Markdown (no uses asteriscos ni #). Puedes usar guiones para listas.
8. Máximo 150 palabras.`;

function construirPrompt({ pregunta, productos, candidatos, filtros }) {
  const catalogo = productos
    .map(
      (p) =>
        `- ID ${p.id} | ${p.nombre} | Categoría: ${p.categoria || "–"} | Precio: ${pesos(p.precio)} | RAM: ${p.ram} | Almacenamiento: ${p.almacenamiento}`
    )
    .join("\n");

  const lineasFiltros = [];
  if (filtros.presupuesto) lineasFiltros.push(`- Presupuesto máximo: ${pesos(filtros.presupuesto)}`);
  if (filtros.categoria) lineasFiltros.push(`- Categoría: ${filtros.categoria}`);
  if (filtros.necesidad) lineasFiltros.push(`- Necesidad: ${filtros.necesidad}`);

  let bloqueFiltros = "FILTROS DEL USUARIO: ninguno";
  if (lineasFiltros.length) {
    const ids = candidatos.map((p) => p.id).join(", ");
    bloqueFiltros =
      `FILTROS DEL USUARIO:\n${lineasFiltros.join("\n")}\n` +
      (filtros.presupuesto || filtros.categoria
        ? `Productos que cumplen presupuesto/categoría (calculado por el sistema): ${ids || "ninguno"}`
        : "");
  }

  return {
    sistema: INSTRUCCIONES,
    usuario: `CATÁLOGO (datos obtenidos de Google Sheets):\n${catalogo}\n\n${bloqueFiltros}\n\nPREGUNTA DEL USUARIO:\n${pregunta}`,
  };
}

export default async (req, context) => {
  if (req.method !== "POST") return error("Usa el método POST para consultar al asistente.", 405);

  // 1. Recibir la pregunta
  let body;
  try {
    body = await req.json();
  } catch {
    return error("La solicitud no tiene un JSON válido.", 400);
  }

  const pregunta = String(body?.pregunta ?? "").trim();
  if (!pregunta) return error("Escribe una pregunta antes de continuar.", 400);
  if (pregunta.length > 1000) return error("La pregunta es demasiado larga (máximo 1000 caracteres).", 400);

  const filtros = {
    presupuesto: Number(body?.presupuesto) > 0 ? Number(body.presupuesto) : null,
    categoria: String(body?.categoria ?? "").trim().slice(0, 60),
    necesidad: String(body?.necesidad ?? "").trim().slice(0, 200),
  };

  // 2. Obtener los productos de Google Sheets
  let productos;
  try {
    productos = await obtenerProductos();
  } catch (e) {
    console.error("Google Sheets:", e);
    return error("No fue posible consultar el catálogo en Google Sheets.", 502, e.message);
  }
  if (!productos.length) {
    return Response.json({
      respuesta: "El catálogo de Google Sheets no tiene productos registrados todavía.",
      sinResultados: true,
    });
  }

  // 3. Aplicar filtros y construir el contexto
  let candidatos = productos;
  if (filtros.categoria) candidatos = candidatos.filter((p) => normalizar(p.categoria) === normalizar(filtros.categoria));
  if (filtros.presupuesto) candidatos = candidatos.filter((p) => p.precio != null && p.precio <= filtros.presupuesto);

  // 4. Construir el prompt y 5. enviarlo al servicio de IA
  let resultado;
  try {
    resultado = await generarRespuesta(construirPrompt({ pregunta, productos, candidatos, filtros }));
  } catch (e) {
    console.error("Servicio de IA:", e);
    const tiempo = e.name === "TimeoutError" || e.name === "AbortError";
    return error(
      tiempo
        ? "El servicio de IA tardó demasiado en responder. Intenta de nuevo."
        : "El asistente no pudo procesar la solicitud.",
      502,
      e.message
    );
  }

  // 6. Revisar la respuesta
  if (!resultado.texto) {
    return error("El asistente no generó una respuesta. Intenta reformular la pregunta.", 502);
  }

  // Guardar en la hoja Historial sin hacer esperar al usuario
  const guardado = guardarHistorial(pregunta, resultado.texto).catch((e) =>
    console.error("No se guardó el historial:", e.message)
  );
  if (context?.waitUntil) context.waitUntil(guardado);
  else await guardado;

  // 7. Regresar JSON al frontend
  return Response.json({
    respuesta: resultado.texto,
    proveedor: resultado.proveedor,
    modelo: resultado.modelo,
    productosConsultados: productos.length,
    productosQueCumplenFiltros: candidatos.length,
    filtros,
  });
};
