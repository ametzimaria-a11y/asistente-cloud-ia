// Comunicación con Google Sheets a través del script de Apps Script (aplicación web).
// La URL y el token viven en variables de entorno del servidor, nunca en el frontend.

export const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

export async function obtenerProductos() {
  const { url, token } = configuracion();
  const res = await fetch(`${url}?accion=productos&token=${encodeURIComponent(token)}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  const data = await leerJSON(res);
  return (data.filas ?? []).map(mapearProducto).filter((p) => p.nombre);
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
