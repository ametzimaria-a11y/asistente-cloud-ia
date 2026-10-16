/**
 * Asistente Cloud con IA - Puente entre Google Sheets y la API (Netlify Functions)
 *
 * Este script se pega en: Google Sheets > Extensiones > Apps Script
 * y se implementa como "Aplicación web".
 *
 * IMPORTANTE: cambia el valor de TOKEN SOLO dentro del editor de Apps Script.
 * Usa el mismo valor en la variable de entorno SHEETS_TOKEN de Netlify.
 * No subas el token real a GitHub.
 */

const TOKEN = 'CAMBIA_ESTE_TOKEN';
const HOJA_PRODUCTOS = 'Productos';
const HOJA_HISTORIAL = 'Historial';

// ---------- Solicitudes GET: leer datos ----------
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.token !== TOKEN) return json({ error: 'Token inválido.' });

    if (p.accion === 'productos') return json({ filas: leerProductos() });
    if (p.accion === 'estadisticas') return json(estadisticas());

    return json({ error: 'Acción no válida. Usa accion=productos o accion=estadisticas.' });
  } catch (err) {
    return json({ error: 'Error en Apps Script: ' + err.message });
  }
}

// ---------- Solicitudes POST: guardar historial ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== TOKEN) return json({ error: 'Token inválido.' });

    if (body.accion === 'historial') {
      const hoja = obtenerHojaHistorial();
      hoja.appendRow([
        new Date(),
        String(body.pregunta || '').slice(0, 1000),
        String(body.respuesta || '').slice(0, 4000)
      ]);
      return json({ ok: true });
    }

    return json({ error: 'Acción no válida.' });
  } catch (err) {
    return json({ error: 'Error en Apps Script: ' + err.message });
  }
}

// ---------- Funciones auxiliares ----------
function leerProductos() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PRODUCTOS);
  if (!hoja) throw new Error('No existe la hoja "' + HOJA_PRODUCTOS + '".');

  const valores = hoja.getDataRange().getDisplayValues();
  const encabezados = valores.shift().map(function (h) { return String(h).trim(); });

  return valores
    .filter(function (fila) { return fila.some(function (c) { return String(c).trim() !== ''; }); })
    .map(function (fila) {
      const obj = {};
      encabezados.forEach(function (h, i) { obj[h] = fila[i]; });
      return obj;
    });
}

function obtenerHojaHistorial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_HISTORIAL);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_HISTORIAL);
    hoja.appendRow(['Fecha', 'Pregunta', 'Respuesta']);
  }
  return hoja;
}

function estadisticas() {
  const productos = leerProductos();
  const categorias = {};
  productos.forEach(function (p) {
    Object.keys(p).forEach(function (k) {
      if (/^categor/i.test(k) && p[k]) categorias[String(p[k]).trim().toLowerCase()] = true;
    });
  });
  const historial = obtenerHojaHistorial();
  return {
    consultas: Math.max(historial.getLastRow() - 1, 0),
    productos: productos.length,
    categorias: Object.keys(categorias).length
  };
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
