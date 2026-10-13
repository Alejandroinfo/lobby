/** Panel de playtest → Reportes de problemas: lo más nuevo arriba, con su registro para descargar. */
import { useEffect, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
import { cambiarEstado, leerReportes, type EstadoReporte, type Reporte } from "../firebase/reportes";

const TIPOS: Record<string, string> = { trabado: "Se trabó", reglas: "Reglas", visual: "Se ve mal", otro: "Otro" };
const ESTADOS: EstadoReporte[] = ["nuevo", "visto", "resuelto"];

function bajar(nombre: string, contenido: string, tipo = "text/plain") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function Pares({ datos }: { datos: Record<string, unknown> }) {
  const pares = Object.entries(datos ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!pares.length) return null;
  return (
    <p className="suave chico-texto">
      {pares.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && " · "}
          {k}: <span className="mono">{String(v)}</span>
        </span>
      ))}
    </p>
  );
}

export function PanelReportes() {
  const [reportes, setReportes] = useState<Reporte[] | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<"abiertos" | "todos">("abiertos");

  useEffect(() => {
    leerReportes()
      .then(setReportes)
      .catch((e) => {
        console.warn(e);
        setError(true);
      });
  }, []);

  // El correo enlaza a /panel#reporte-ID: se abre y se muestra ese reporte.
  useEffect(() => {
    const id = window.location.hash.replace("#reporte-", "");
    if (!reportes || !id) return;
    const el = document.getElementById(`reporte-${id}`) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: "start" });
    }
  }, [reportes]);

  const cambiar = (id: string, estado: EstadoReporte) => {
    setReportes((l) => l?.map((r) => (r.id === id ? { ...r, estado } : r)) ?? null);
    cambiarEstado(id, estado).catch((e) => console.warn("No se pudo cambiar el estado", e));
  };

  const lista = (reportes ?? []).filter((r) => filtro === "todos" || r.estado !== "resuelto");
  const nuevos = (reportes ?? []).filter((r) => r.estado === "nuevo").length;

  return (
    <section className="panel ancho reportes-panel" aria-labelledby="t-reportes">
      <div className="invitar-cabeza">
        <h2 id="t-reportes">
          Reportes de problemas {nuevos > 0 && <span className="insignia prueba">{nuevos} nuevos</span>}
        </h2>
        <div className="segmentado" role="radiogroup" aria-label="Mostrar">
          {(["abiertos", "todos"] as const).map((f) => (
            <button key={f} role="radio" aria-checked={filtro === f} onClick={() => setFiltro(f)}>
              {f === "abiertos" ? "Sin resolver" : "Todos"}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="error">No se pudieron cargar (¿publicaste las reglas nuevas?).</p>
      ) : !reportes ? (
        <p className="suave">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="suave">No hay reportes {filtro === "abiertos" ? "sin resolver" : ""}.</p>
      ) : (
        <ul className="lista-reportes">
          {lista.map((r) => (
            <li key={r.id}>
              <details id={`reporte-${r.id}`} className={`reporte reporte-${r.estado}`}>
                <summary>
                  <span className={`chip ${r.estado === "nuevo" ? "no-conectado" : ""}`}>{r.estado}</span>{" "}
                  <strong>{r.juego ? (juegoPorId(r.juego)?.nombre ?? r.juego) : "Lobby"}</strong> · {TIPOS[r.tipo] ?? r.tipo} ·{" "}
                  <span className="suave">{r.creado?.toDate().toLocaleString() ?? ""}</span>
                  <br />
                  <span>{r.que.length > 140 ? `${r.que.slice(0, 140)}…` : r.que}</span>
                </summary>
                <div className="reporte-detalle">
                  <p>
                    <strong>Qué pasó:</strong> {r.que}
                  </p>
                  {r.esperaba && (
                    <p>
                      <strong>Qué esperaba:</strong> {r.esperaba}
                    </p>
                  )}
                  <p className="suave chico-texto">
                    De <strong>{r.nombre || "sin nombre"}</strong> · <span className="mono">{r.uid}</span> · versión{" "}
                    <span className="mono">{r.version ?? "—"}</span>
                  </p>
                  <Pares datos={r.donde} />
                  <Pares datos={r.dispositivo} />
                  {r.captura && (
                    <a href={r.captura} target="_blank" rel="noreferrer">
                      <img src={r.captura} alt="Captura del reporte" className="reporte-captura" />
                    </a>
                  )}
                  {r.errores?.length > 0 && <pre className="reporte-errores">{r.errores.join("\n")}</pre>}
                  <div className="botones">
                    {r.registro && (
                      <button className="primario chico" onClick={() => bajar(r.nombreRegistro || `registro-${r.id}.txt`, r.registro!)}>
                        Descargar registro
                      </button>
                    )}
                    <button className="secundario chico" onClick={() => bajar(`reporte-${r.id}.json`, JSON.stringify(r, null, 1), "application/json")}>
                      Reporte completo (JSON)
                    </button>
                    <label className="chico-texto">
                      Estado{" "}
                      <select value={r.estado} onChange={(e) => cambiar(r.id, e.target.value as EstadoReporte)}>
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
