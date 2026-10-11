import { useEffect } from "react";
import { juegoPorId } from "../datos/catalogo";
import {
  cancelar,
  definirEquipos,
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

const activa = (p: Partida) => p.estado === "invitando" || p.estado === "jugando";

function nombreVariante(p: Partida) {
  const juego = juegoPorId(p.juego);
  return juego?.variantes.find((v) => v.id === p.variante)?.nombre ?? null;
}

/** Avisos de invitación para mí, arriba de todo. */
export function Invitaciones({ sala, uid, partidas }: { sala: string; uid: string; partidas: Partida[] }) {
  const pendientes = partidas.filter(
    (p) => p.estado === "invitando" && p.invitados[uid]?.respuesta === "pendiente",
  );

  useEffect(() => {
    const base = "Lobby de juegos";
    document.title = pendientes.length ? `(${pendientes.length}) Invitación · ${base}` : base;
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
            <p>
              {yo.rol === "jugador"
                ? `Juegas en el asiento ${(yo.asiento ?? 0) + 1}` +
                  (yo.equipo !== undefined ? `, en el ${NOMBRE_EQUIPO[yo.equipo]}.` : ".")
                : "Entras como espectador."}{" "}
              <span className="suave">
                Por ahora abran el juego por su cuenta; la apertura automática desde el lobby llega en el
                próximo paso.
              </span>
            </p>
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
