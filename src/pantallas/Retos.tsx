/**
 * Retos de la sala:
 *  - Reto del día: el mismo para todos. Ranking de esta sala (sus miembros) o global.
 *  - Historial: liga de los últimos 7 días, tu racha, tu mejor marca y tus días anteriores.
 *  - Retos directos que crea alguien de la sala (ranking de la sala).
 * Se juegan en solitario; solo cuenta el primer intento.
 */
import { abrirJuego } from "../pwa";
import { conLlave } from "../firebase/llaveJuego";
import { useEffect, useState } from "react";
import { JUEGOS, juegoPorId, type Juego } from "../datos/catalogo";
import { claveDia, diasAntes, enlaceReto, fechaDeClave, fechaHoy, guardarReto, nuevoReto, ponerAlDiaMarcaDiaria, retoDiario } from "../firebase/retos";
import type { FilaRanking, Reto } from "../firebase/tipos";
import { useHistorialRetos, useMarcas, useRankingDelDia, useRetos, type DiaHistorial } from "../hooks/useRetos";
import { useIdioma } from "../i18n";

const MOSTRAR = 5;
const DIAS_DIRECTO = 7;
const DIAS_LIGA = 7;

type Ambito = "sala" | "global";

function abrir(url: string, juego: string) {
  // Pestaña nueva (o la misma ventana en la app instalada): el puntaje vuelve a la sala al terminar.
  // Con la llave del juego, el reto se retoma desde cualquier aparato de tu cuenta.
  abrirJuego(conLlave(juego, url), "_blank", juegoPorId(juego)?.nombre);
}

interface Props {
  sala: string;
  uid: string;
  nombre: string;
  miembros: string[];
  confirmado: boolean;
  /** Tus marcas del reto del día (del perfil): racha, mejor y promedio sin lecturas extra. */
  retosPropios: Record<string, number> | undefined;
}

export function Retos({ sala, uid, nombre, miembros, confirmado, retosPropios }: Props) {
  const { t, idioma } = useIdioma();
  const conRetos = JUEGOS.filter((j) => j.retos && j.url);
  const [juegoId, setJuegoId] = useState(() => {
    try {
      return localStorage.getItem("lobby_reto_juego") ?? conRetos[0]?.id ?? "";
    } catch {
      return conRetos[0]?.id ?? "";
    }
  });
  const juego = conRetos.find((j) => j.id === juegoId) ?? conRetos[0];
  const elegirJuego = (id: string) => {
    setJuegoId(id);
    try {
      localStorage.setItem("lobby_reto_juego", id);
    } catch {
      /* sin almacenamiento */
    }
  };
  const retos = useRetos(sala, confirmado && Boolean(juego));
  const [error, setError] = useState("");
  const [ambito, setAmbito] = useState<Ambito>("sala");
  const fecha = fechaHoy();

  // Marcas de hoy y ayer guardadas con versiones anteriores: se ponen al día (una vez por sala abierta).
  const perfilListo = retosPropios !== undefined;
  useEffect(() => {
    if (!confirmado || !perfilListo) return;
    // (Solo Split Loyalty tuvo marcas guardadas con versiones anteriores.)
    for (const f of [fecha, diasAntes(fecha, 1)]) ponerAlDiaMarcaDiaria(sala, f, uid, retosPropios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmado, perfilListo, sala, fecha, uid]);

  if (!juego) return null;
  const diario = retoDiario(juego, fecha);
  const limite = Date.now() - DIAS_DIRECTO * 86_400_000;
  const directos = retos.filter((r) => r.juego === juego.id && (r.creado?.toMillis() ?? Date.now()) > limite);

  const crear = () => {
    setError("");
    const r = nuevoReto(sala, juego, uid, nombre);
    const url = enlaceReto(juego, sala, r, nombre, idioma);
    if (!url) return;
    abrir(url, juego.id);
    guardarReto(sala, r).catch((e) => {
      console.error(e);
      setError(t.errorCrearReto);
    });
  };

  // Tus marcas del reto del día de este juego, por fecha.
  const propias: Record<string, number> = {};
  for (const [clave, p] of Object.entries(retosPropios ?? {})) {
    const f = fechaDeClave(juego.id, clave);
    if (f) propias[f] = p;
  }

  return (
    <section className="panel retos" aria-labelledby="t-retos">
      <div className="retos-cabeza">
        <h2 id="t-retos">{conRetos.length > 1 ? t.retosTituloGeneral : t.retosTitulo(juego.nombre)}</h2>
        <button className="secundario" onClick={crear}>{t.crearReto}</button>
      </div>
      {conRetos.length > 1 && (
        <div className="segmentado selector-juego-reto" role="radiogroup" aria-label={t.juego}>
          {conRetos.map((j) => (
            <button key={j.id} role="radio" aria-checked={j.id === juego.id} onClick={() => elegirJuego(j.id)}>
              {j.nombre}
            </button>
          ))}
        </div>
      )}
      <p className="suave chico-texto">{t.retosTexto}</p>
      <details className="como-se-puntua">
        <summary className="chico-texto">{t.comoSePuntua}</summary>
        <p className="suave chico-texto">{idioma === "en" ? juego.retos!.puntaje.en : juego.retos!.puntaje.es}</p>
      </details>
      {error && <p className="error">{error}</p>}
      <ul className="lista-retos">
        <TarjetaDiaria key={diario.id} sala={sala} uid={uid} nombre={nombre} juego={juego} reto={diario} miembros={miembros} confirmado={confirmado} ambito={ambito} setAmbito={setAmbito} />
        {directos.map((r) => (
          <TarjetaReto
            key={r.id}
            sala={sala}
            uid={uid}
            nombre={nombre}
            juego={juego}
            reto={r}
            confirmado={confirmado}
            titulo={r.creador === uid ? t.tuReto : t.retoDe(r.creadorNombre)}
          />
        ))}
      </ul>
      <Historial key={juego.id} hoy={fecha} juego={juego.id} uid={uid} miembros={miembros} ambito={ambito} setAmbito={setAmbito} confirmado={confirmado} retosPropios={propias} />
    </section>
  );
}

function SelectorAmbito({ ambito, setAmbito }: { ambito: Ambito; setAmbito: (a: Ambito) => void }) {
  const { t } = useIdioma();
  return (
    <div className="segmentado chico" role="radiogroup" aria-label={t.rankingDe}>
      {(["sala", "global"] as Ambito[]).map((a) => (
        <button key={a} role="radio" aria-checked={ambito === a} onClick={() => setAmbito(a)}>
          {a === "sala" ? t.estaSala : t.global}
        </button>
      ))}
    </div>
  );
}

function Ranking({ marcas, uid, limite = MOSTRAR }: { marcas: FilaRanking[]; uid: string; limite?: number }) {
  const { t } = useIdioma();
  const [verTodo, setVerTodo] = useState(false);
  if (!marcas.length) return null;
  const yo = marcas.findIndex((m) => m.uid === uid);
  let lista = verTodo ? marcas.map((m, i) => ({ m, i })) : marcas.slice(0, limite).map((m, i) => ({ m, i }));
  // Si estás fuera del top, se te muestra igual al final.
  if (!verTodo && yo >= limite) lista = [...lista, { m: marcas[yo], i: yo }];
  return (
    <>
      <ol className="ranking">
        {lista.map(({ m, i }) => (
          <li key={m.uid} className={m.uid === uid ? "mio" : ""}>
            <span className="pos">{i + 1}</span>
            <span className="quien">{m.uid === uid ? t.tuMayus : m.nombre}</span>
            <span className="pts">{m.puntaje}</span>
          </li>
        ))}
      </ol>
      {marcas.length > limite && (
        <button className="enlace chico-texto" onClick={() => setVerTodo((v) => !v)}>
          {verTodo ? t.verMenos : t.verTodos(marcas.length)}
        </button>
      )}
    </>
  );
}

function TarjetaDiaria(props: Omit<Props, "retosPropios"> & { juego: Juego; reto: Reto; ambito: Ambito; setAmbito: (a: Ambito) => void }) {
  const { sala, uid, nombre, juego, reto, miembros, confirmado, ambito, setAmbito } = props;
  const { t, idioma } = useIdioma();
  const todas = useRankingDelDia(reto.id.slice(7), confirmado);
  const enSala = todas.filter((m) => miembros.includes(m.uid));
  const marcas = ambito === "sala" ? enSala : todas;
  const mia = todas.find((m) => m.uid === uid);
  const url = enlaceReto(juego, sala, reto, nombre, idioma);

  return (
    <li className="reto diario">
      <div className="reto-cabeza">
        <div>
          <strong>{t.retoDelDia}</strong>
          <span className="mono suave chico-texto"> · {t.operacion} {reto.semilla}</span>
        </div>
        {url && (
          <button className={mia ? "secundario" : "primario"} onClick={() => abrir(url, juego.id)}>
            {mia ? t.jugarDeNuevo : t.jugarReto}
          </button>
        )}
      </div>
      <SelectorAmbito ambito={ambito} setAmbito={setAmbito} />
      {mia ? (
        <p className="chico-texto">
          {t.tuMarcaDoble(mia.puntaje, enSala.indexOf(mia) + 1, enSala.length, todas.indexOf(mia) + 1, todas.length)}
        </p>
      ) : (
        <p className="suave chico-texto">{todas.length ? t.soloPrimerIntento : t.nadieAun}</p>
      )}
      <Ranking marcas={marcas} uid={uid} />
      {ambito === "sala" && !enSala.length && todas.length > 0 && <p className="suave chico-texto">{t.nadieEnSala(todas.length)}</p>}
    </li>
  );
}

function TarjetaReto(props: { sala: string; uid: string; nombre: string; juego: Juego; reto: Reto; confirmado: boolean; titulo: string }) {
  const { sala, uid, nombre, juego, reto, confirmado, titulo } = props;
  const { t, idioma } = useIdioma();
  const marcas = useMarcas(sala, reto.id, confirmado);
  const mia = marcas.find((m) => m.uid === uid);
  const puesto = mia ? marcas.indexOf(mia) + 1 : null;
  const url = enlaceReto(juego, sala, reto, nombre, idioma);
  const lider = marcas[0];

  return (
    <li className={`reto ${reto.tipo}`}>
      <div className="reto-cabeza">
        <div>
          <strong>{titulo}</strong>
          <span className="mono suave chico-texto"> · {t.operacion} {reto.semilla}</span>
        </div>
        {url && (
          <button className={mia ? "secundario" : "primario"} onClick={() => abrir(url, juego.id)}>
            {mia ? t.jugarDeNuevo : lider ? t.superarlo(lider.puntaje) : t.jugarReto}
          </button>
        )}
      </div>
      {mia ? (
        <p className="chico-texto">{t.tuMarca(mia.puntaje, puesto ?? 1, marcas.length)}</p>
      ) : (
        <p className="suave chico-texto">{marcas.length ? t.soloPrimerIntento : t.nadieAun}</p>
      )}
      <Ranking marcas={marcas} uid={uid} />
    </li>
  );
}

// ── Historial: liga de 7 días, racha y tus días anteriores ─────────────────────

interface FilaLiga {
  uid: string;
  nombre: string;
  total: number;
  dias: number;
  mejor: number;
}

function liga(dias: DiaHistorial[], filtro: (uid: string) => boolean): FilaLiga[] {
  const filas = new Map<string, FilaLiga>();
  for (const d of dias) {
    for (const m of d.filas) {
      if (!filtro(m.uid)) continue;
      const f = filas.get(m.uid) ?? { uid: m.uid, nombre: m.nombre, total: 0, dias: 0, mejor: 0 };
      f.total += m.puntaje;
      f.dias++;
      f.mejor = Math.max(f.mejor, m.puntaje);
      filas.set(m.uid, f);
    }
  }
  return [...filas.values()].sort((a, b) => b.total - a.total || b.mejor - a.mejor);
}

/** Días seguidos con reto jugado, terminando hoy (o ayer, si hoy aún no lo juegas). */
function racha(propias: Record<string, number>, hoy: string, jugadoHoy: boolean): number {
  let n = jugadoHoy ? 1 : 0;
  let i = 1;
  while (propias[diasAntes(hoy, i)] !== undefined) {
    n++;
    i++;
  }
  return n;
}

function Historial(props: { hoy: string; juego: string; uid: string; miembros: string[]; ambito: Ambito; setAmbito: (a: Ambito) => void; confirmado: boolean; retosPropios: Record<string, number> }) {
  const { hoy, juego, uid, miembros, ambito, setAmbito, confirmado, retosPropios } = props;
  const { t, idioma } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const deHoy = useRankingDelDia(claveDia(juego, hoy), confirmado && abierto);
  const anteriores = useHistorialRetos(hoy, juego, confirmado && abierto);

  const formato = (f: string) => {
    const [a, m, d] = f.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString(idioma, { weekday: "short", day: "numeric", month: "short" });
  };

  let cuerpo = <p className="suave chico-texto">{t.cargando}</p>;
  if (anteriores) {
    const dias: DiaHistorial[] = [{ fecha: hoy, filas: deHoy }, ...anteriores];
    const filtro = ambito === "sala" ? (u: string) => miembros.includes(u) : () => true;
    const tabla = liga(dias.slice(0, DIAS_LIGA), filtro);
    const mioHoy = deHoy.find((m) => m.uid === uid);
    const propias = { ...retosPropios, ...(mioHoy ? { [hoy]: mioHoy.puntaje } : {}) };
    const valores = Object.values(propias);
    const mejor = valores.length ? Math.max(...valores) : null;
    const media = valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
    const yo = tabla.findIndex((f) => f.uid === uid);
    const filasLiga = tabla.slice(0, 10);
    if (yo >= 10) filasLiga.push(tabla[yo]);

    cuerpo = (
      <>
        <div className="historial-cifras">
          <div><strong>{racha(propias, hoy, Boolean(mioHoy))}</strong><span>{t.racha}</span></div>
          <div><strong>{mejor ?? "—"}</strong><span>{t.mejorMarca}</span></div>
          <div><strong>{media ?? "—"}</strong><span>{t.promedio}</span></div>
          <div><strong>{valores.length}</strong><span>{t.retosJugados}</span></div>
        </div>

        <div className="historial-liga">
          <div className="retos-cabeza">
            <h3>{t.ligaTitulo(DIAS_LIGA)}</h3>
            <SelectorAmbito ambito={ambito} setAmbito={setAmbito} />
          </div>
          <p className="suave chico-texto">{t.ligaTexto}</p>
          {filasLiga.length ? (
            <div className="tabla"><table>
              <thead><tr><th>#</th><th>{t.jugador}</th><th>{t.puntosTotales}</th><th>{t.diasJugados}</th><th>{t.mejorCol}</th></tr></thead>
              <tbody>
                {filasLiga.map((f) => (
                  <tr key={f.uid} className={f.uid === uid ? "mio" : ""}>
                    <td>{tabla.indexOf(f) + 1}</td><td>{f.uid === uid ? t.tuMayus : f.nombre}</td><td>{f.total}</td><td>{f.dias}/{DIAS_LIGA}</td><td>{f.mejor}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <p className="suave chico-texto">{t.ligaVacia}</p>
          )}
        </div>

        <h3>{t.tusDias}</h3>
        <ul className="tus-dias">
          {dias.slice(0, Math.max(1, ...dias.map((d, i) => (d.filas.some((m) => filtro(m.uid)) ? i + 1 : 0)))).map((d) => {
            const enAmbito = d.filas.filter((m) => filtro(m.uid));
            const mia = enAmbito.find((m) => m.uid === uid);
            const primero = enAmbito[0];
            return (
              <li key={d.fecha}>
                <span className="fecha">{formato(d.fecha)}</span>
                <span>
                  {mia ? (
                    <><strong>{mia.puntaje}</strong> <span className="suave">· {enAmbito.indexOf(mia) + 1}.º {t.de} {enAmbito.length}</span></>
                  ) : (
                    <span className="suave">{t.noJugaste}</span>
                  )}
                </span>
                <span className="suave chico-texto">
                  {primero ? t.ganoDia(primero.uid === uid ? t.tuMayus : primero.nombre, primero.puntaje) : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <details className="historial-retos" onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary>{t.historialRetos}</summary>
      {abierto && cuerpo}
    </details>
  );
}
