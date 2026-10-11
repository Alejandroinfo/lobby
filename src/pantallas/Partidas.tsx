import { useEffect, useRef, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
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

function nombreVariante(p: Partida) {
  const juego = juegoPorId(p.juego);
  return juego?.variantes.find((v) => v.id === p.variante)?.nombre ?? null;
}

/** Avisos de invitación para mí, arriba de todo. */
export function Invitaciones({ sala, uid, partidas }: { sala: string; uid: string; partidas: Partida[] }) {
  const pendientes = partidas.filter(
    (p) => p.estado === "invitando" && p.invitados[uid]?.respuesta === "pendiente",
  );

  const antes = useRef(0);
  useEffect(() => {
    const base = "Lobby de juegos";
    document.title = pendientes.length ? `(${pendientes.length}) Invitación · ${base}` : base;
    if (pendientes.length > antes.current) sonarAviso();
    antes.current = pendientes.length;
  }, [pendientes.length]);

  if (!pendientes.length) return null;
  return (
    <section className="invitaciones" aria-label="Invitaciones">
      {pendientes.map((p) => {
        const juego = juegoPorId(p.juego);
        const yo = p.invitados[uid];
        const quien = p.invitados[p.anfitrion]?.nombre ?? "Alguien";
        const variante = nombreVariante(p);
        return (
          <div key={p.id} className="invitacion" role="alert">
            <p>
              <strong>{quien}</strong> te invita a {yo.rol === "jugador" ? "jugar" : "mirar"}{" "}
              <strong>{juego?.nombre ?? p.juego}</strong>
              {variante && <span className="suave"> · {variante}</span>}
            </p>
            <div className="botones">
              <button className="primario" onClick={() => responder(sala, p.id, uid, "acepta", yo.rol)}>
                {yo.rol === "jugador" ? "Jugar" : "Mirar"}
              </button>
              {yo.rol === "jugador" && juego?.espectadores && (
                <button className="secundario" onClick={() => responder(sala, p.id, uid, "acepta", "espectador")}>
                  Solo mirar
                </button>
              )}
              <button className="secundario" onClick={() => responder(sala, p.id, uid, "rechaza", yo.rol)}>
                Ahora no
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
      <h2 id="t-partidas">Partidas</h2>
      {enCurso.map((p) => (
        <TarjetaPartida key={p.id} sala={sala.codigo} uid={uid} p={p} conectado={conectado} />
      ))}
      {recientes.length > 0 && (
        <div className="recientes">
          <p className="rotulo">Recientes</p>
          <ul>
            {recientes.map((p) => (
              <li key={p.id}>
                {juegoPorId(p.juego)?.nombre ?? p.juego} ·{" "}
                {jugadoresAceptados(p)
                  .map(([, i]) => i.nombre)
                  .join(", ")}
                {resumenResultado(p) && <strong> · {resumenResultado(p)}</strong>}
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

const NOMBRE_EQUIPO = ["Equipo A", "Equipo B"] as const;

/** "Ganó Ana" / "Ganaron Ana y Bea" / "Empate", a partir de los asientos ganadores. */
function resumenResultado(p: Partida): string | null {
  if (!p.resultado) return null;
  const porAsiento = new Map(Object.values(p.invitados).filter((i) => i.asiento !== null).map((i) => [i.asiento!, i.nombre]));
  const nombres = p.resultado.ganadores.map((a) => porAsiento.get(a)).filter(Boolean) as string[];
  if (!nombres.length) return "sin ganador";
  const jugadores = jugadoresAceptados(p).length;
  if (nombres.length === jugadores && jugadores > 1) return "empate";
  return nombres.length === 1 ? `ganó ${nombres[0]}` : `ganaron ${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

function estadoInvitado(i: Invitado, jugando: boolean, enLinea: boolean): { texto: string; clase: string } {
  if (i.respuesta === "acepta" && !enLinea) return { texto: "desconectado", clase: "no-conectado" };
  if (jugando) {
    if (i.rol === "espectador") return { texto: "mira", clase: "neutro" };
    const equipo = i.equipo !== undefined ? ` · ${NOMBRE_EQUIPO[i.equipo]}` : "";
    return { texto: `asiento ${(i.asiento ?? 0) + 1}${equipo}`, clase: "ok" };
  }
  if (i.respuesta === "rechaza") return { texto: "no va", clase: "no" };
  if (i.respuesta === "pendiente") return { texto: "sin responder", clase: "neutro" };
  return i.listo ? { texto: "listo", clase: "ok" } : { texto: "preparándose", clase: "espera" };
}

interface PropsTarjeta {
  sala: string;
  uid: string;
  p: Partida;
  conectado: (uid: string) => boolean;
}

function TarjetaPartida({ sala, uid, p, conectado }: PropsTarjeta) {
  const juego = juegoPorId(p.juego);
  const yo = p.invitados[uid];
  const soyCreador = p.anfitrion === uid;
  const jugando = p.estado === "jugando";
  const variante = nombreVariante(p);
  const prep = juego ? preparacion(p, juego, conectado) : { puede: false, motivo: "Juego desconocido." };
  const conEquipos = Boolean(juego && usaEquipos(p, juego));
  const creador = p.invitados[p.anfitrion]?.nombre ?? "Quien creó la partida";
  const puedoTomarControl = !soyCreador && yo?.respuesta === "acepta" && !conectado(p.anfitrion);
  const enlace = juego ? enlaceJuego(juego, sala, p, uid) : null;

  const lista = Object.entries(p.invitados)
    .filter(([, i]) => !jugando || i.respuesta === "acepta")
    .sort(([, a], [, b]) => (a.asiento ?? 99) - (b.asiento ?? 99) || a.nombre.localeCompare(b.nombre));

  return (
    <article className={`partida ${jugando ? "en-juego" : ""}`}>
      <header>
        <div>
          <strong>{juego?.nombre ?? p.juego}</strong>
          {variante && <span className="suave"> · {variante}</span>}
          {conEquipos && <span className="suave"> · por equipos</span>}
        </div>
        <span className={`estado-partida ${p.estado}`}>{jugando ? "en juego" : "preparando"}</span>
      </header>

      <ul className="invitados">
        {lista.map(([id, i]) => {
          const e = estadoInvitado(i, jugando, conectado(id));
          return (
            <li key={id}>
              <span>
                {i.nombre}
                {id === uid && <span className="suave"> (tú)</span>}
                {id === p.anfitrion && <span className="suave"> · organiza</span>}
                {!jugando && i.rol === "espectador" && <span className="suave"> · espectador</span>}
              </span>
              <span className={`chip ${e.clase}`}>{e.texto}</span>
              {soyCreador && !jugando && id !== uid && (
                <button className="enlace chico" onClick={() => quitarInvitado(sala, p.id, id)}>
                  quitar
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {puedoTomarControl && (
        <div className="aviso-control">
          <p>
            {creador} se desconectó. Si no vuelve, puedes organizar tú la partida.
          </p>
          <button className="secundario chico" onClick={() => tomarControl(sala, p.id, uid)}>
            Tomar el control
          </button>
        </div>
      )}

      {!jugando && yo?.respuesta === "acepta" && (
        <div className="botones">
          <button
            className={yo.listo ? "secundario" : "primario"}
            onClick={() => marcarListo(sala, p.id, uid, !yo.listo)}
          >
            {yo.listo ? "Ya no estoy listo" : "Estoy listo"}
          </button>
          {!soyCreador && (
            <button className="enlace" onClick={() => responder(sala, p.id, uid, "rechaza", yo.rol)}>
              Salirme
            </button>
          )}
        </div>
      )}

      {!jugando && conEquipos && <Equipos sala={sala} p={p} editable={soyCreador} />}

      {!jugando && soyCreador && juego && (
        <div className="lanzar">
          <p className={prep.puede ? "listo-texto" : "suave"}>{prep.motivo}</p>
          <div className="botones">
            <button className="primario" disabled={!prep.puede} onClick={() => lanzar(sala, p, juego)}>
              Lanzar partida
            </button>
            <button className="secundario" onClick={() => cancelar(sala, p.id)}>
              Cancelar partida
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
                  ? `Juegas en el asiento ${(yo.asiento ?? 0) + 1}` +
                    (yo.equipo !== undefined ? `, en el ${NOMBRE_EQUIPO[yo.equipo]}.` : ".")
                  : "Entras como espectador."}{" "}
                {!enlace && (
                  <span className="suave">
                    Este juego aún no está conectado al lobby: ábranlo por su cuenta y, al acabar, quien
                    organiza marca "Terminar partida".
                  </span>
                )}
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
                    Abrir {juego.nombre}
                  </button>
                  <span className="suave chico-texto">Se abre en otra pestaña. El resultado llega solo al terminar.</span>
                </div>
              )}
            </>
          )}
          {soyCreador && (
            <button className="secundario" onClick={() => terminar(sala, p.id)}>
              Terminar partida
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Elegir equipos al azar o a mano (quien organiza); los demás solo ven cómo quedan. */
function Equipos({ sala, p, editable }: { sala: string; p: Partida; editable: boolean }) {
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
        <p className="rotulo">Equipos</p>
        {editable ? (
          <div className="segmentado" role="radiogroup" aria-label="Cómo se forman los equipos">
            <button role="radio" aria-checked={modo === "azar"} onClick={() => elegirModo("azar")}>
              Al azar
            </button>
            <button role="radio" aria-checked={modo === "manual"} onClick={() => elegirModo("manual")}>
              Elegirlos
            </button>
          </div>
        ) : (
          <span className="suave">{modo === "azar" ? "se sortean al lanzar" : "elegidos por quien organiza"}</span>
        )}
      </div>
      {modo === "azar" ? (
        <p className="suave">Se sortean al lanzar la partida.</p>
      ) : (
        <>
          <div className="columnas-equipos">
            {([0, 1] as const).map((eq) => (
              <div key={eq} className="columna-equipo">
                <p className="rotulo">{NOMBRE_EQUIPO[eq]}</p>
                <ul>
                  {jugadores
                    .filter(([uid]) => de[uid] === eq)
                    .map(([uid, i]) => (
                      <li key={uid}>
                        {editable ? (
                          <button className="ficha" onClick={() => mover(uid)} title="Cambiar de equipo">
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
          {editable && <p className="suave chico-texto">Toca un nombre para cambiarlo de equipo.</p>}
        </>
      )}
    </div>
  );
}

/** Misma partida otra vez: mismo juego, modo y personas (cada una con su rol). */
function BotonRevancha({ sala, uid, p }: { sala: string; uid: string; p: Partida }) {
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
        {estado === "creando" ? "creando…" : "revancha"}
      </button>
      {estado === "error" && <span className="error"> no se pudo crear</span>}
    </>
  );
}
