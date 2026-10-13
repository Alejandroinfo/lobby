/**
 * Panel de playtest (`/panel`): solo lo puede leer la cuenta de Google del dueño del lobby
 * (lo verifican las reglas de Firestore). Resume partidas, resultados, encuestas y audiencia.
 */
import { PanelReportes, ReabrirSala } from "./PanelReportes";
import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { JUEGOS, juegoPorId } from "../datos/catalogo";
import {
  contar,
  csvEncuestas,
  csvPartidas,
  descargar,
  habilidades,
  porTipoJugador,
  porVersion,
  resumenRetos,
  resumen,
  victoriasPorAsiento,
  type DatosPanel,
  type EncuestaPanel,
  type MarcaPanel,
  type PartidaPanel,
  type ResultadoPanel,
} from "../datos/estadisticas";
import type { Perfil } from "../firebase/tipos";
import { guardarConGoogle, type Usuario } from "../hooks/useUsuario";
import { irA } from "../navegacion";

type Periodo = "7" | "30" | "todo";

async function cargar(): Promise<DatosPanel> {
  const [ps, rs, es, js, ms] = await Promise.all([
    getDocs(collectionGroup(db, "partidas")),
    getDocs(collectionGroup(db, "resultados")),
    getDocs(collectionGroup(db, "encuestas")),
    getDocs(collection(db, "jugadores")),
    // Las marcas de retos se agregaron después: si las reglas aún no lo permiten, el panel sigue funcionando.
    getDocs(collectionGroup(db, "marcas")).catch((e) => {
      console.warn("Marcas de retos no disponibles", e);
      return null;
    }),
  ]);
  return {
    partidas: ps.docs.map((d) => ({ id: d.id, sala: d.ref.parent.parent?.id ?? "", ...(d.data() as Omit<PartidaPanel, "id" | "sala">) })),
    resultados: rs.docs.map((d) => ({ partida: d.ref.parent.parent?.id ?? "", uid: d.id, ...(d.data() as Omit<ResultadoPanel, "partida" | "uid">) })),
    encuestas: es.docs.map((d) => ({ partida: d.ref.parent.parent?.id ?? "", uid: d.id, ...(d.data() as Omit<EncuestaPanel, "partida" | "uid">) })),
    perfiles: Object.fromEntries(js.docs.map((d) => [d.id, d.data() as Perfil])),
    marcas: (ms?.docs ?? []).map((d) => ({
      // salas/{sala}/retos/{reto}/marcas/{uid}
      sala: d.ref.parent.parent?.parent.parent?.id ?? "",
      reto: d.ref.parent.parent?.id ?? "",
      uid: d.id,
      ...(d.data() as Omit<MarcaPanel, "sala" | "reto" | "uid">),
    })),
  };
}

function filtrar(d: DatosPanel, juego: string, periodo: Periodo): DatosPanel {
  const desde = periodo === "todo" ? 0 : Date.now() - Number(periodo) * 86_400_000;
  const partidas = d.partidas.filter(
    (p) => (juego === "todos" || p.juego === juego) && (p.creada?.toMillis() ?? 0) >= desde,
  );
  const ids = new Set(partidas.map((p) => p.id));
  return {
    partidas,
    resultados: d.resultados.filter((r) => ids.has(r.partida)),
    encuestas: d.encuestas.filter((e) => ids.has(e.partida)),
    perfiles: d.perfiles,
    // Hoy solo Split Loyalty tiene retos.
    marcas: d.marcas.filter((m) => (juego === "todos" || juego === "split-loyalty") && (m.hora?.toMillis() ?? Date.now()) >= desde),
  };
}

const n1 = (x: number | null) => (x === null ? "—" : x.toFixed(1));
const ETIQUETAS: Record<string, string> = {
  corta: "Corta", justa: "Justa", larga: "Larga",
  "menos-13": "Menos de 13", "13-17": "13–17", "18-24": "18–24", "25-34": "25–34", "35-44": "35–44", "45-mas": "45 o más", "no-dice": "Prefiere no decir",
  amigo: "Un amigo", convencion: "Convención", redes: "Redes", otro: "Otro",
  casual: "De vez en cuando", frecuente: "Seguido", "muy-frecuente": "Muchísimo",
  estratega: "Estratega", social: "Social", competitivo: "Competitivo", "sin-dato": "Sin responder",
  si: "Sí", no: "No",
};
const et = (k: string) => ETIQUETAS[k] ?? k;

export function Panel({ usuario }: { usuario: Usuario }) {
  const [datos, setDatos] = useState<DatosPanel | null>(null);
  const [error, setError] = useState<"" | "permiso" | "otro">("");
  const [juego, setJuego] = useState("todos");
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    setError("");
    setDatos(null);
    cargar()
      .then(setDatos)
      .catch((e) => {
        console.warn(e);
        setError((e as { code?: string }).code === "permission-denied" ? "permiso" : "otro");
      });
  }, [usuario.uid, usuario.email]);

  const vista = useMemo(() => (datos ? filtrar(datos, juego, periodo) : null), [datos, juego, periodo]);

  if (error === "permiso") {
    return (
      <main className="centro">
        <div className="tarjeta" style={{ maxWidth: 480 }}>
          <h2>Panel de playtest</h2>
          <p className="suave">
            {usuario.anonimo
              ? "Solo lo puede ver el dueño del lobby. Entra con tu cuenta de Google para verlo."
              : `La cuenta ${usuario.email ?? ""} no tiene acceso al panel.`}
          </p>
          <div className="botones">
            {usuario.anonimo && (
              <button
                className="primario"
                disabled={entrando}
                onClick={() => {
                  setEntrando(true);
                  guardarConGoogle().catch(() => setEntrando(false));
                }}
              >
                Entrar con Google
              </button>
            )}
            <button className="secundario" onClick={() => irA({ pantalla: "inicio" })}>
              Volver al inicio
            </button>
          </div>
        </div>
      </main>
    );
  }
  if (error) return <main className="centro"><p className="error">No se pudieron cargar los datos. Recarga la página.</p></main>;
  if (!datos || !vista) return <main className="centro"><p className="suave">Cargando datos de playtest…</p></main>;

  const r = resumen(vista);
  const habs = habilidades(vista);
  const rr = resumenRetos(vista);
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const versiones = porVersion(vista);
  const asientos = victoriasPorAsiento(vista);
  const personas = new Set(vista.partidas.flatMap((p) => Object.entries(p.invitados).filter(([, i]) => i.respuesta === "acepta").map(([u]) => u)));
  const perfiles = [...personas].map((u) => vista.perfiles[u]).filter(Boolean);
  const comentarios = vista.encuestas
    .filter((e) => e.comentario || Object.values(e.extra ?? {}).some(Boolean))
    .sort((a, b) => (b.hora?.toMillis() ?? 0) - (a.hora?.toMillis() ?? 0))
    .slice(0, 30);
  const preguntasJuego = juego === "todos" ? [] : (juegoPorId(juego)?.preguntas ?? []);
  const sufijo = `${juego}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <main className="panel-playtest">
      <header className="cabecera">
        <div>
          <p className="etiqueta">Playtesting</p>
          <h1>Panel de playtest</h1>
        </div>
        <div className="acciones">
          <button className="secundario" onClick={() => descargar(`partidas-${sufijo}.csv`, csvPartidas(vista))}>Partidas (CSV)</button>
          <button className="secundario" onClick={() => descargar(`encuestas-${sufijo}.csv`, csvEncuestas(vista))}>Encuestas (CSV)</button>
          <button className="secundario" onClick={() => irA({ pantalla: "inicio" })}>Inicio</button>
        </div>
      </header>

      <PanelReportes />
      <ReabrirSala />

      <div className="filtros" role="group" aria-label="Filtros">
        <div className="segmentado" role="radiogroup" aria-label="Juego">
          {[{ id: "todos", nombre: "Todos" }, ...JUEGOS].map((j) => (
            <button key={j.id} role="radio" aria-checked={juego === j.id} onClick={() => setJuego(j.id)}>{j.nombre}</button>
          ))}
        </div>
        <div className="segmentado" role="radiogroup" aria-label="Período">
          {([["7", "7 días"], ["30", "30 días"], ["todo", "Todo"]] as [Periodo, string][]).map(([v, t]) => (
            <button key={v} role="radio" aria-checked={periodo === v} onClick={() => setPeriodo(v)}>{t}</button>
          ))}
        </div>
      </div>

      <section className="tiles" aria-label="Resumen">
        <Tile valor={String(r.partidas)} rotulo="partidas terminadas" />
        <Tile valor={r.minutosMediana === null ? "—" : `${Math.round(r.minutosMediana)} min`} rotulo="duración real (mediana)" />
        <Tile valor={n1(r.diversion)} rotulo="diversión media (1–5)" />
        <Tile valor={n1(r.claridad)} rotulo="claridad media (1–5)" />
        <Tile valor={String(r.personas)} rotulo={`personas · ${r.paises} ${r.paises === 1 ? "país" : "países"}`} />
        <Tile valor={String(r.encuestas)} rotulo="encuestas respondidas" />
      </section>

      {(habs.length > 0 || rr.intentos > 0) && (
        <div className="rejilla-panel">
          {habs.length > 0 && (
            <section className="panel ancho">
              <h2>Habilidades</h2>
              <p className="suave chico-texto">
                Qué habilidad se elige y cómo le va a quien la tiene. «Esperado» es el % de victorias que tocaría por azar
                (1 entre el número de jugadores): muy por encima o por debajo sugiere que está desbalanceada. Con pocas partidas, tómalo como pista.
              </p>
              <div className="tabla"><table>
                <thead><tr><th>Habilidad</th><th>Elegida</th><th>Partidas</th><th>Victorias</th><th>Esperado</th><th>Puntaje medio</th><th>En retos</th><th>Usos por partida</th></tr></thead>
                <tbody>
                  {habs.map((h) => (
                    <tr key={h.clave}>
                      <td>{h.nombre}</td><td>{h.elegida}</td><td>{h.partidas}</td>
                      <td>{h.partidas ? `${h.victorias} (${pct(h.victorias / h.partidas)})` : "—"}</td>
                      <td className="suave">{pct(h.esperado)}</td>
                      <td>{n1(h.puntajePartidas)}</td><td>{n1(h.puntajeRetos)}</td><td>{n1(h.usosMedios)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </section>
          )}
          {rr.intentos > 0 && (
            <section className="panel">
              <h2>Retos en solitario</h2>
              <p>{rr.intentos} {rr.intentos === 1 ? "intento" : "intentos"} de {rr.personas} {rr.personas === 1 ? "persona" : "personas"} en {rr.retos} {rr.retos === 1 ? "reto" : "retos"}.</p>
              <p className="suave">Puntaje medio {n1(rr.media)} · mejor {rr.mejor ?? "—"}</p>
            </section>
          )}
        </div>
      )}

      {r.partidas === 0 ? (
        <p className="suave vacio-panel">Todavía no hay partidas terminadas con estos filtros. Aparecerán aquí al jugar desde el lobby.</p>
      ) : (
        <div className="rejilla-panel">
          <section className="panel">
            <h2>Por versión de reglas</h2>
            <div className="tabla"><table>
              <thead><tr><th>Versión</th><th>Partidas</th><th>Min (mediana)</th><th>Diversión</th><th>Claridad</th><th>Encuestas</th></tr></thead>
              <tbody>
                {versiones.map((v) => (
                  <tr key={v.version}>
                    <td className="mono">{v.version}</td><td>{v.partidas}</td><td>{v.minutos === null ? "—" : Math.round(v.minutos)}</td>
                    <td>{n1(v.diversion)}</td><td>{n1(v.claridad)}</td><td>{v.encuestas}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>

          <section className="panel">
            <h2>Victorias por asiento</h2>
            <p className="suave chico-texto">Para ver si jugar primero da ventaja. No cuenta los empates de todos.</p>
            <div className="tabla"><table>
              <thead><tr><th>Jugadores</th><th>Partidas</th>{[1, 2, 3, 4, 5, 6].slice(0, Math.max(0, ...asientos.map((a) => a.jugadores))).map((n) => <th key={n}>Asiento {n}</th>)}</tr></thead>
              <tbody>
                {asientos.map((a) => (
                  <tr key={a.jugadores}>
                    <td>{a.jugadores}</td><td>{a.partidas}</td>
                    {a.victorias.map((v, i) => <td key={i}>{v} <span className="suave">({Math.round((v / a.partidas) * 100)}%)</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>

          <section className="panel">
            <h2>Cómo se sintió</h2>
            <Conteo titulo="Duración" pares={contar(vista.encuestas.map((e) => e.duracion))} />
            {preguntasJuego.map((q) => {
              const respuestas = vista.encuestas.map((e) => e.extra?.[q.id]).filter((x): x is string => Boolean(x));
              return q.tipo === "si-no" ? (
                <Conteo key={q.id} titulo={q.texto} pares={contar(respuestas)} />
              ) : (
                <div key={q.id} className="conteo">
                  <p className="rotulo">{q.texto}</p>
                  {respuestas.length ? <ul className="citas">{respuestas.slice(0, 8).map((t, i) => <li key={i}>“{t}”</li>)}</ul> : <p className="suave">Sin respuestas.</p>}
                </div>
              );
            })}
          </section>

          <section className="panel">
            <h2>Quién juega</h2>
            <Conteo titulo="País" pares={contar(perfiles.map((p) => p.pais ?? null))} />
            <Conteo titulo="Edad" pares={contar(perfiles.map((p) => p.rangoEdad))} />
            <Conteo titulo="Cómo llegó" pares={contar(perfiles.map((p) => p.comoLlego))} />
            <Conteo titulo="Experiencia" pares={contar(perfiles.map((p) => p.experiencia))} />
          </section>

          <section className="panel">
            <h2>Según el tipo de jugador</h2>
            <p className="suave chico-texto">Lo que cada uno marcó en su perfil (pregunta opcional). Sirve para ver si un juego gusta a un tipo de jugador y a otro no.</p>
            <div className="tabla"><table>
              <thead><tr><th>Tipo</th><th>Encuestas</th><th>Diversión</th><th>Claridad</th><th>Duración más votada</th></tr></thead>
              <tbody>
                {porTipoJugador(vista).map((f) => (
                  <tr key={f.tipo}>
                    <td>{f.tipo === "casual" ? "Casual" : et(f.tipo)}</td><td>{f.encuestas}</td><td>{n1(f.diversion)}</td><td>{n1(f.claridad)}</td><td>{f.duracion ? et(f.duracion) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>

          <section className="panel ancho">
            <h2>Comentarios recientes</h2>
            {comentarios.length === 0 ? (
              <p className="suave">Aún no hay comentarios.</p>
            ) : (
              <ul className="comentarios">
                {comentarios.map((e) => (
                  <li key={e.partida + e.uid}>
                    <p className="suave chico-texto">
                      {juegoPorId(e.juego)?.nombre ?? e.juego} · {e.hora?.toDate().toLocaleDateString()} · diversión {e.diversion ?? "—"}, claridad {e.claridad ?? "—"}
                    </p>
                    {e.comentario && <p>“{e.comentario}”</p>}
                    {Object.entries(e.extra ?? {}).filter(([, v]) => v).map(([k, v]) => (
                      <p key={k} className="suave chico-texto">{juegoPorId(e.juego)?.preguntas?.find((q) => q.id === k)?.texto ?? k}: <strong>{et(v)}</strong></p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Tile({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="tile">
      <p className="tile-valor">{valor}</p>
      <p className="tile-rotulo">{rotulo}</p>
    </div>
  );
}

function Conteo({ titulo, pares }: { titulo: string; pares: [string, number][] }) {
  const total = pares.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="conteo">
      <p className="rotulo">{titulo}</p>
      {total === 0 ? (
        <p className="suave">Sin datos.</p>
      ) : (
        <ul>
          {pares.map(([k, n]) => (
            <li key={k}>
              <span>{et(k)}</span>
              <span className="barra" aria-hidden="true"><span style={{ width: `${(n / total) * 100}%` }} /></span>
              <span className="mono">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
