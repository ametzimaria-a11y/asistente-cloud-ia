// Comunicación con Google Sheets a través del script de Apps Script (aplicación web).
// La URL y el token viven en variables de entorno del servidor, nunca en el frontend.

export const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function configuracion() {
  const url = process.env.SHEETS_API_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) {
    throw new Error("Faltan las variables de entorno SHEETS_API_URL o SHEETS_TOKEN.");
  }
  return { url, token };
}

async function leerJSON(res) {
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error(
      `Google Sheets no respondió JSON (HTTP ${res.status}). Revisa que la aplicación web de Apps Script tenga acceso "Cualquier persona".`
    );
  }
  if (data.error) throw new Error(data.error);
  return data;
}

function aNumero(valor) {
  const limpio = String(valor ?? "").replace(/[^0-9.]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function mapearProducto(fila) {
  const f = {};
  for (const [clave, valor] of Object.entries(fila)) f[normalizar(clave)] = valor;
  return {
    id: String(f.id ?? "").trim(),
    nombre: String(f.producto ?? f.nombre ?? "").trim(),
    categoria: String(f.categoria ?? "").trim(),
    precio: aNumero(f.precio),
    ram: String(f.ram ?? "").trim() || "–",
    almacenamiento: String(f.almacenamiento ?? "").trim() || "–",
  };
}

// Copia en memoria del catálogo: evita esperar a Apps Script en cada consulta
// y sirve de respaldo si Google tarda demasiado en responder.
let cache = { productos: null, fecha: 0 };
const VIGENCIA_CACHE_MS = 5 * 60 * 1000;

export async function obtenerProductos({ usarCache = true, tiempoMs = 7000 } = {}) {
  if (usarCache && cache.productos && Date.now() - cache.fecha < VIGENCIA_CACHE_MS) {
    return cache.productos;
  }
  const { url, token } = configuracion();
  try {
    const res = await fetch(`${url}?accion=productos&token=${encodeURIComponent(token)}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(tiempoMs),
    });
    const data = await leerJSON(res);
    const productos = (data.filas ?? []).map(mapearProducto).filter((p) => p.nombre);
    cache = { productos, fecha: Date.now() };
    return productos;
  } catch (error) {
    if (cache.productos) {
      console.warn("Google Sheets no respondió a tiempo; se usa la última copia del catálogo.", error.message);
      return cache.productos;
    }
    if (error.name === "TimeoutError") {
      throw new Error("Google Sheets (Apps Script) tardó demasiado en responder.");
    }
    throw error;
  }
}

export async function obtenerEstadisticas() {
  const { url, token } = configuracion();
  const res = await fetch(`${url}?accion=estadisticas&token=${encodeURIComponent(token)}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  return leerJSON(res);
}

export async function guardarHistorial(pregunta, respuesta) {
  const { url, token } = configuracion();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token, accion: "historial", pregunta, respuesta }),
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
  });
  return leerJSON(res);
}