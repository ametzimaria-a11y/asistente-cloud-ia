import { useEffect, useState } from "react";

const API = "/.netlify/functions";

const EJEMPLOS = [
  "Necesito una laptop para programación con un presupuesto de 20000 pesos.",
  "¿Qué producto tiene mayor capacidad de almacenamiento?",
  "¿Qué laptop cuesta menos de 15000 pesos?",
  "¿Qué producto recomiendas para programación?",
  "¿Cuál es la capital de Francia?",
];

const PASOS = ["React", "API REST", "Google Sheets + IA", "Respuesta"];

const pesos = (n) =>
  n == null ? "–" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

async function pedirJSON(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch {
    throw new Error("No fue posible consultar el servicio Cloud. Revisa tu conexión a Internet.");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("No fue posible consultar el servicio Cloud.");
  }
  if (!res.ok) throw new Error(data?.error || "El asistente no pudo procesar la solicitud.");
  return data;
}

function leerTema() {
  try {
    return localStorage.getItem("tema") || "claro";
  } catch {
    return "claro";
  }
}

export default function App() {
  const [pregunta, setPregunta] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [necesidad, setNecesidad] = useState("");

  const [respuesta, setRespuesta] = useState("");
  const [meta, setMeta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [productos, setProductos] = useState([]);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [stats, setStats] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [verCatalogo, setVerCatalogo] = useState(false);
  const [tema, setTema] = useState(leerTema);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem("tema", tema);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [tema]);

  const cargarEstadisticas = () =>
    pedirJSON(`${API}/estadisticas`)
      .then(setStats)
      .catch(() => setStats(null));

  useEffect(() => {
    pedirJSON(`${API}/productos`)
      .then((data) => setProductos(data.productos || []))
      .catch((e) => setErrorCatalogo(e.message));
    cargarEstadisticas();
  }, []);

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];

  async function consultar(e) {
    e?.preventDefault();
    setError("");

    if (!pregunta.trim()) {
      setError("Escribe una pregunta antes de continuar.");
      return;
    }

    setCargando(true);
    setRespuesta("");
    setMeta(null);

    try {
      const data = await pedirJSON(`${API}/asistente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta,
          presupuesto: presupuesto ? Number(presupuesto) : null,
          categoria,
          necesidad,
        }),
      });

      if (!data.respuesta) {
        setError("El asistente no encontró resultados para tu consulta.");
        return;
      }

      setRespuesta(data.respuesta);
      setMeta(data);
      setHistorial((h) => [{ pregunta, respuesta: data.respuesta, hora: new Date() }, ...h].slice(0, 5));
      setTimeout(cargarEstadisticas, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pagina">
      <header className="encabezado">
        <div className="marca">
          <span className="logo" aria-hidden="true">☁</span>
          <div>
            <h1>Asistente Cloud con IA</h1>
            <p>React · API REST · Google Sheets · IA · Netlify</p>
          </div>
        </div>
        <button
          className="boton-tema"
          onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")}
          aria-label="Cambiar tema"
        >
          {tema === "oscuro" ? "☀ Modo claro" : "☾ Modo oscuro"}
        </button>
      </header>

      <ol className="flujo" aria-label="Flujo de la consulta">
        {PASOS.map((paso, i) => (
          <li key={paso} className={cargando && i < 3 ? "activo" : respuesta && !cargando ? "listo" : ""}>
            {paso}
          </li>
        ))}
      </ol>

      <section className="dashboard" aria-label="Estadísticas del asistente">
        <div className="tarjeta-stat">
          <span className="valor">{stats ? stats.consultas : "–"}</span>
          <span className="etiqueta">Consultas realizadas</span>
        </div>
        <div className="tarjeta-stat">
          <span className="valor">{stats ? stats.productos : productos.length || "–"}</span>
          <span className="etiqueta">Productos disponibles</span>
        </div>
        <div className="tarjeta-stat">
          <span className="valor">{stats ? stats.categorias : categorias.length || "–"}</span>
          <span className="etiqueta">Categorías</span>
        </div>
      </section>

      <main className="contenido">
        <form className="panel" onSubmit={consultar}>
          <label htmlFor="pregunta" className="titulo-panel">
            ¿Qué deseas consultar?
          </label>
          <textarea
            id="pregunta"
            rows={3}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej. Necesito una laptop para programación con un presupuesto de 20000 pesos."
            maxLength={1000}
          />

          <div className="ejemplos">
            {EJEMPLOS.map((ej) => (
              <button type="button" key={ej} onClick={() => setPregunta(ej)}>
                {ej}
              </button>
            ))}
          </div>

          <fieldset className="filtros">
            <legend>Filtros (opcionales)</legend>
            <label>
              Presupuesto máximo
              <input
                type="number"
                min="0"
                step="100"
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                placeholder="20000"
              />
            </label>
            <label>
              Categoría
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Necesidad
              <input
                type="text"
                value={necesidad}
                onChange={(e) => setNecesidad(e.target.value)}
                placeholder="Programación"
                maxLength={200}
              />
            </label>
          </fieldset>

          <button className="boton-principal" type="submit" disabled={cargando}>
            {cargando ? "Consultando…" : "Consultar"}
          </button>
        </form>

        <section className="panel respuesta" aria-live="polite">
          <h2 className="titulo-panel">Respuesta del asistente</h2>

          {cargando && (
            <div className="cargando">
              <span className="spinner" aria-hidden="true" /> Analizando información...
            </div>
          )}

          {error && !cargando && <div className="alerta">{error}</div>}

          {respuesta && !cargando && (
            <>
              <p className="texto-respuesta">{respuesta}</p>
              {meta && (
                <p className="meta">
                  {meta.proveedor} · {meta.modelo} · {meta.productosConsultados} productos leídos de Google Sheets
                  {meta.filtros?.presupuesto || meta.filtros?.categoria
                    ? ` · ${meta.productosQueCumplenFiltros} cumplen los filtros`
                    : ""}
                </p>
              )}
            </>
          )}

          {!respuesta && !cargando && !error && (
            <p className="vacio">Escribe una pregunta y presiona “Consultar”.</p>
          )}
        </section>
      </main>

      {historial.length > 0 && (
        <section className="panel">
          <h2 className="titulo-panel">Consultas de esta sesión</h2>
          <ul className="historial">
            {historial.map((h, i) => (
              <li key={i}>
                <span className="hora">{h.hora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                <strong>{h.pregunta}</strong>
                <span>{h.respuesta.length > 140 ? `${h.respuesta.slice(0, 140)}…` : h.respuesta}</span>
              </li>
            ))}
          </ul>
          <p className="meta">Cada consulta también se guarda en la hoja “Historial” de Google Sheets.</p>
        </section>
      )}

      <section className="panel">
        <button className="boton-secundario" onClick={() => setVerCatalogo(!verCatalogo)}>
          {verCatalogo ? "Ocultar catálogo" : "Ver catálogo (Google Sheets)"}
        </button>
        {verCatalogo &&
          (errorCatalogo ? (
            <div className="alerta">{errorCatalogo}</div>
          ) : (
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>RAM</th>
                    <th>Almacenamiento</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id || p.nombre}>
                      <td>{p.id}</td>
                      <td>{p.nombre}</td>
                      <td>{p.categoria}</td>
                      <td>{pesos(p.precio)}</td>
                      <td>{p.ram}</td>
                      <td>{p.almacenamiento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <footer className="pie">Instituto Tecnológico Superior de Puruándiro · Cloud Computing · Unidad 2</footer>
    </div>
  );
}
