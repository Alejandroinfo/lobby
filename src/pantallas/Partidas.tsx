import { useEffect, useRef, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
import { textosJuego, useIdioma, type Textos } from "../i18n";
import {
  cancelar,
  crearPartida,
  definirEquipos,
  enlaceJuego,
  jugadoresAceptados,
  lanzar,
  marcarListo,
  preparacion,
  quitarInvitado,
  responder,
  terminar,
  tomarControl,
  usaEquipos,
  type Motivo,
} from "../firebase/partidas";
import type { Invitado, Partida, Sala } from "../firebase/tipos";
import { DESCONECTADO_MS, useAhora } from "../hooks/useSala";

/**
 * En curso = invitando o jugando, salvo que lleve demasiado tiempo así (nadie la terminó):
 * esas se consideran abandonadas y dejan de mostrarse.
 */
const HORAS_INVITANDO = 2;
const HORAS_JUGANDO = 6;
function activa(p: Partida) {
  const ahora = Date.now();
  if (p.estado === "invitando") return ahora - (p.creada?.toMillis() ?? ahora) < HORAS_INVITANDO * 3600_000;
  if (p.estado === "jugando") return ahora - (p.iniciada?.toMillis() ?? ahora) < HORAS_JUGANDO * 3600_000;
  return false;
}

/** Un "ding" corto sin archivos de audio (si el navegador lo permite). */
function sonarAviso() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.42);
    o.onended = () => ctx.close();
  } catch {
    /* sin audio */
  }
}

function nombreVariante(p: Partida, idioma: "es" | "en") {
  const juego = juegoPorId(p.juego);
  return juego ? textosJuego(juego, idioma).variante(p.variante) : null;
}

function textoMotivo(m: Motivo, t: Textos): string {
  switch (m.tipo) {
    case "faltan": return t.motivoFaltan(m.n, m.min);
    case "sobran": return t.motivoSobran(m.n, m.max);
    case "desconectados": return t.motivoDesconectados(m.nombres);
    case "esperando": return t.motivoEsperando(m.nombres);
    case "equipos": return t.motivoEquipos(m.mitad);
    case "listos": return t.motivoListos;
    default: return t.motivoDesconocido;
  }
}

/** Avisos de invitación para mí, arriba de todo. */
export function Invitaciones({ sala, uid, partidas }: { sala: string; uid: string; partidas: Partida[] }) {
  const { t, idioma } = useIdioma();
  const pendientes = partidas.filter(
    (p) => p.estado === "invitando" && p.invitados[uid]?.respuesta === "pendiente",
  );

  const antes = useRef(0);
  useEffect(() => {
    document.title = pendientes.length ? t.tituloInvitacion(pendientes.length) : t.nombreApp;
    if (pendientes.length > antes.current) sonarAviso();
    antes.current = pendientes.length;
  }, [pendientes.length, t]);

  if (!pendientes.length) return null;
  return (
    <section className="invitaciones" aria-label={t.invitacionesAria}>
      {pendientes.map((p) => {
        const juego = juegoPorId(p.juego);
        const yo = p.invitados[uid];
        const quien = p.invitados[p.anfitrion]?.nombre ?? t.alguien;
        const variante = nombreVariante(p, idioma);
        return (
          <div key={p.id} className="invitacion" role="alert">
            <p>
              <strong>{quien}</strong> {t.teInvitaA} {yo.rol === "jugador" ? t.verboJugar : t.verboMirar}{" "}
              <strong>{juego?.nombre ?? p.juego}</strong>
              {variante && <span className="suave"> · {variante}</span>}
            </p>
            <div className="botones">
              <button className="primario" onClick={() => responder(sala, p.id, uid, "acepta", yo.rol)}>
                {yo.rol === "jugador" ? t.jugar : t.mirar}
              </button>
              {yo.rol === "jugador" && juego?.espectadores && (
                <button className="secundario" onClick={() => responder(sala, p.id, uid, "acepta", "espectador")}>
                  {t.soloMirar}
                </button>
              )}
              <button className="secundario" onClick={() => responder(sala, p.id, uid, "rechaza", yo.rol)}>
                {t.ahoraNo}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Partidas en curso de la sala y las últimas terminadas. */
export function ListaPartidas({ sala, uid, partidas }: { sala: Sala; uid: string; partidas: Partida[] }) {
  const { t } = useIdioma();
  const ahora = useAhora();
  const enCurso = partidas.filter(activa);
  const recientes = partidas.filter((p) => p.estado === "terminada").slice(0, 3);
  if (!enCurso.length && !recientes.length) return null;

  const conectado = (id: string) => {
    const m = sala.miembros?.[id];
    return Boolean(m) && ahora - (m!.ultimaVez?.toMillis() ?? ahora) < DESCONECTADO_MS;
  };

  return (
    <section className="panel partidas" aria-labelledby="t-partidas">
      <h2 id="t-partidas">{t.partidas}</h2>
      {enCurso.map((p) => (
        <TarjetaPartida key={p.id} sala={sala.codigo} uid={uid} p={p} conectado={conectado} />
      ))}
      {recientes.length > 0 && (
        <div className="recientes">
          <p className="rotulo">{t.recientes}</p>
          <ul>
            {recientes.map((p) => (
              <li key={p.id}>
                {juegoPorId(p.juego)?.nombre ?? p.juego} ·{" "}
                {jugadoresAceptados(p)
                  .map(([, i]) => i.nombre)
                  .join(", ")}
                {resumenResultado(p, t) && <strong> · {resumenResultado(p, t)}</strong>}
                {p.invitados[uid]?.respuesta === "acepta" && <BotonRevancha sala={sala.codigo} uid={uid} p={p} />}
                {p.terminada && (
                  <span className="suave">
                    {" "}
                    · {p.terminada.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}


/** "Ganó Ana" / "Ganaron Ana y Bea" / "Empate", a partir de los asientos ganadores. */
function resumenResultado(p: Partida, t: Textos): string | null {
  if (!p.resultado) return null;
  const porAsiento = new Map(Object.values(p.invitados).filter((i) => i.asiento !== null).map((i) => [i.asiento!, i.nombre]));
  const nombres = p.resultado.ganadores.map((a) => porAsiento.get(a)).filter(Boolean) as string[];
  if (!nombres.length) return t.sinGanador;
  const jugadores = jugadoresAceptados(p).length;
  if (nombres.length === jugadores && jugadores > 1) return t.empate;
  return nombres.length === 1 ? t.gano(nombres[0]) : t.ganaron(nombres);
}

function estadoInvitado(i: Invitado, jugando: boolean, enLinea: boolean, t: Textos): { texto: string; clase: string } {
  if (i.respuesta === "acepta" && !enLinea) return { texto: t.chipDesconectado, clase: "no-conectado" };
  if (jugando) {
    if (i.rol === "espectador") return { texto: t.chipMira, clase: "neutro" };
    const equipo = i.equipo !== undefined ? ` · ${t.equipos[i.equipo]}` : "";
    return { texto: `${t.chipAsiento((i.asiento ?? 0) + 1)}${equipo}`, clase: "ok" };
  }
  if (i.respuesta === "rechaza") return { texto: t.chipNoVa, clase: "no" };
  if (i.respuesta === "pendiente") return { texto: t.chipSinResponder, clase: "neutro" };
  return i.listo ? { texto: t.chipListo, clase: "ok" } : { texto: t.chipPreparandose, clase: "espera" };
}

interface PropsTarjeta {
  sala: string;
  uid: string;
  p: Partida;
  conectado: (uid: string) => boolean;
}

function TarjetaPartida({ sala, uid, p, conectado }: PropsTarjeta) {
  const { t, idioma } = useIdioma();
  const juego = juegoPorId(p.juego);
  const yo = p.invitados[uid];
  const soyCreador = p.anfitrion === uid;
  const jugando = p.estado === "jugando";
  const variante = nombreVariante(p, idioma);
  const prep = juego ? preparacion(p, juego, conectado) : { puede: false, motivo: { tipo: "desconocido" } as Motivo };
  const conEquipos = Boolean(juego && usaEquipos(p, juego));
  const creador = p.invitados[p.anfitrion]?.nombre ?? t.quienCreo;
  const puedoTomarControl = !soyCreador && yo?.respuesta === "acepta" && !conectado(p.anfitrion);
  const enlace = juego ? enlaceJuego(juego, sala, p, uid, idioma) : null;

  const lista = Object.entries(p.invitados)
    .filter(([, i]) => !jugando || i.respuesta === "acepta")
    .sort(([, a], [, b]) => (a.asiento ?? 99) - (b.asiento ?? 99) || a.nombre.localeCompare(b.nombre));

  return (
    <article className={`partida ${jugando ? "en-juego" : ""}`}>
      <header>
        <div>
          <strong>{juego?.nombre ?? p.juego}</strong>
          {variante && <span className="suave"> · {variante}</span>}
          {conEquipos && <span className="suave"> · {t.porEquipos}</span>}
        </div>
        <span className={`estado-partida ${p.estado}`}>{jugando ? t.enJuego : t.preparando}</span>
      </header>

      <ul className="invitados">
        {lista.map(([id, i]) => {
          const e = estadoInvitado(i, jugando, conectado(id), t);
          return (
            <li key={id}>
              <span>
                {i.nombre}
                {id === uid && <span className="suave">{t.tuParen}</span>}
                {id === p.anfitrion && <span className="suave"> · {t.organiza}</span>}
                {!jugando && i.rol === "espectador" && <span className="suave"> · {t.espectador.toLowerCase()}</span>}
              </span>
              <span className={`chip ${e.clase}`}>{e.texto}</span>
              {soyCreador && !jugando && id !== uid && (
                <button className="enlace chico" onClick={() => quitarInvitado(sala, p.id, id)}>
                  {t.quitar}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {puedoTomarControl && (
        <div className="aviso-control">
          <p>{t.seDesconectoOrganizador(creador)}</p>
          <button className="secundario chico" onClick={() => tomarControl(sala, p.id, uid)}>
            {t.tomarControl}
          </button>
        </div>
      )}

      {!jugando && yo?.respuesta === "acepta" && (
        <div className="botones">
          <button
            className={yo.listo ? "secundario" : "primario"}
            onClick={() => marcarListo(sala, p.id, uid, !yo.listo)}
          >
            {yo.listo ? t.yaNoListo : t.estoyListo}
          </button>
          {!soyCreador && (
            <button className="enlace" onClick={() => responder(sala, p.id, uid, "rechaza", yo.rol)}>
              {t.salirme}
            </button>
          )}
        </div>
      )}

      {!jugando && conEquipos && <Equipos sala={sala} p={p} editable={soyCreador} />}

      {!jugando && soyCreador && juego && (
        <div className="lanzar">
          <p className={prep.puede ? "listo-texto" : "suave"}>{textoMotivo(prep.motivo, t)}</p>
          <div className="botones">
            <button className="primario" disabled={!prep.puede} onClick={() => lanzar(sala, p, juego)}>
              {t.lanzar}
            </button>
            <button className="secundario" onClick={() => cancelar(sala, p.id)}>
              {t.cancelarPartida}
            </button>
          </div>
        </div>
      )}

      {jugando && (
        <div className="lanzar">
          {yo?.respuesta === "acepta" && (
            <>
              <p>
                {yo.rol === "jugador"
                  ? t.juegasAsiento((yo.asiento ?? 0) + 1, yo.equipo !== undefined ? t.equipos[yo.equipo] : null)
                  : t.entrasEspectador}{" "}
                {!enlace && <span className="suave">{t.noConectado}</span>}
              </p>
              {enlace && juego && (
                <div className="botones">
                  <button
                    className="primario"
                    onClick={() => {
                      // Pestaña nueva: el lobby sigue abierto y recibe el resultado al terminar.
                      const w = window.open(enlace, `juego-${p.id}`);
                      if (!w) window.location.href = enlace; // si el navegador bloqueó la pestaña
                    }}
                  >
                    {t.abrir(juego.nombre)}
                  </button>
                  <span className="suave chico-texto">{juego.informaResultado === false ? t.otraPestanaSinResultado : t.otraPestana}</span>
                </div>
              )}
            </>
          )}
          {soyCreador && (
            <button className="secundario" onClick={() => terminar(sala, p.id)}>
              {t.terminarPartida}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Elegir equipos al azar o a mano (quien organiza); los demás solo ven cómo quedan. */
function Equipos({ sala, p, editable }: { sala: string; p: Partida; editable: boolean }) {
  const { t } = useIdioma();
  const jugadores = jugadoresAceptados(p);
  const modo = p.equipos?.modo ?? "azar";
  const de = p.equipos?.de ?? {};

  const elegirModo = (nuevo: "azar" | "manual") => {
    if (nuevo === "azar") {
      definirEquipos(sala, p.id, "azar");
      return;
    }
    // Propuesta inicial: alternar en el orden actual; luego se ajusta tocando a cada jugador.
    const inicial: Record<string, 0 | 1> = {};
    jugadores.forEach(([uid], k) => (inicial[uid] = (k % 2) as 0 | 1));
    definirEquipos(sala, p.id, "manual", { ...inicial, ...de });
  };

  const mover = (uid: string) => definirEquipos(sala, p.id, "manual", { ...de, [uid]: de[uid] === 0 ? 1 : 0 });

  return (
    <div className="equipos">
      <div className="equipos-cabeza">
        <p className="rotulo">{t.rotuloEquipos}</p>
        {editable ? (
          <div className="segmentado" role="radiogroup" aria-label={t.comoEquipos}>
            <button role="radio" aria-checked={modo === "azar"} onClick={() => elegirModo("azar")}>
              {t.alAzar}
            </button>
            <button role="radio" aria-checked={modo === "manual"} onClick={() => elegirModo("manual")}>
              {t.elegirlos}
            </button>
          </div>
        ) : (
          <span className="suave">{modo === "azar" ? t.seSortean : t.elegidosPorOrganizador}</span>
        )}
      </div>
      {modo === "azar" ? (
        <p className="suave">{t.seSorteanLargo}</p>
      ) : (
        <>
          <div className="columnas-equipos">
            {([0, 1] as const).map((eq) => (
              <div key={eq} className="columna-equipo">
                <p className="rotulo">{t.equipos[eq]}</p>
                <ul>
                  {jugadores
                    .filter(([uid]) => de[uid] === eq)
                    .map(([uid, i]) => (
                      <li key={uid}>
                        {editable ? (
                          <button className="ficha" onClick={() => mover(uid)} title={t.cambiarEquipo}>
                            {i.nombre} <span aria-hidden="true">⇄</span>
                          </button>
                        ) : (
                          i.nombre
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          {editable && <p className="suave chico-texto">{t.tocaNombre}</p>}
        </>
      )}
    </div>
  );
}

/** Misma partida otra vez: mismo juego, modo y personas (cada una con su rol). */
function BotonRevancha({ sala, uid, p }: { sala: string; uid: string; p: Partida }) {
  const { t } = useIdioma();
  const [estado, setEstado] = useState<"" | "creando" | "error">("");
  const juego = juegoPorId(p.juego);
  if (!juego) return null;
  const revancha = async () => {
    setEstado("creando");
    const invitaciones = Object.entries(p.invitados)
      .filter(([, i]) => i.respuesta === "acepta")
      .map(([id, i]) => ({ uid: id, nombre: i.nombre, rol: i.rol }));
    try {
      await crearPartida(sala, uid, juego, p.variante, invitaciones);
      setEstado("");
    } catch (e) {
      console.error(e);
      setEstado("error");
    }
  };
  return (
    <>
      {" "}
      <button className="enlace chico" onClick={revancha} disabled={estado === "creando"}>
        {estado === "creando" ? t.creandoMin : t.revancha}
      </button>
      {estado === "error" && <span className="error"> {t.noSePudoCrear}</span>}
    </>
  );
}
