import { useEffect } from "react";
import { juegoPorId } from "../datos/catalogo";
import {
  cancelar,
  jugadoresAceptados,
  lanzar,
  marcarListo,
  preparacion,
  quitarInvitado,
  responder,
  terminar,
} from "../firebase/partidas";
import type { Invitado, Partida } from "../firebase/tipos";

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
export function ListaPartidas({ sala, uid, partidas }: { sala: string; uid: string; partidas: Partida[] }) {
  const enCurso = partidas.filter(activa);
  const recientes = partidas.filter((p) => p.estado === "terminada").slice(0, 3);
  if (!enCurso.length && !recientes.length) return null;

  return (
    <section className="panel partidas" aria-labelledby="t-partidas">
      <h2 id="t-partidas">Partidas</h2>
      {enCurso.map((p) => (
        <TarjetaPartida key={p.id} sala={sala} uid={uid} p={p} />
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

function estadoInvitado(i: Invitado, jugando: boolean): { texto: string; clase: string } {
  if (jugando) {
    if (i.rol === "espectador") return { texto: "mira", clase: "neutro" };
    return { texto: `asiento ${(i.asiento ?? 0) + 1}`, clase: "ok" };
  }
  if (i.respuesta === "rechaza") return { texto: "no va", clase: "no" };
  if (i.respuesta === "pendiente") return { texto: "sin responder", clase: "neutro" };
  return i.listo ? { texto: "listo", clase: "ok" } : { texto: "preparándose", clase: "espera" };
}

function TarjetaPartida({ sala, uid, p }: { sala: string; uid: string; p: Partida }) {
  const juego = juegoPorId(p.juego);
  const yo = p.invitados[uid];
  const soyCreador = p.anfitrion === uid;
  const jugando = p.estado === "jugando";
  const variante = nombreVariante(p);
  const prep = juego ? preparacion(p, juego) : { puede: false, motivo: "Juego desconocido." };

  const lista = Object.entries(p.invitados)
    .filter(([, i]) => !jugando || i.respuesta === "acepta")
    .sort(([, a], [, b]) => (a.asiento ?? 99) - (b.asiento ?? 99) || a.nombre.localeCompare(b.nombre));

  return (
    <article className={`partida ${jugando ? "en-juego" : ""}`}>
      <header>
        <div>
          <strong>{juego?.nombre ?? p.juego}</strong>
          {variante && <span className="suave"> · {variante}</span>}
        </div>
        <span className={`estado-partida ${p.estado}`}>{jugando ? "en juego" : "preparando"}</span>
      </header>

      <ul className="invitados">
        {lista.map(([id, i]) => {
          const e = estadoInvitado(i, jugando);
          return (
            <li key={id}>
              <span>
                {i.nombre}
                {id === uid && <span className="suave"> (tú)</span>}
                {!jugando && i.rol === "espectador" && <span className="suave"> · espectador</span>}
              </span>
              <span className={`chip ${e.clase}`}>{e.texto}</span>
              {soyCreador && !jugando && id !== uid && i.respuesta !== "acepta" && (
                <button className="enlace chico" onClick={() => quitarInvitado(sala, p.id, id)}>
                  quitar
                </button>
              )}
            </li>
          );
        })}
      </ul>

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

      {!jugando && soyCreador && (
        <div className="lanzar">
          <p className={prep.puede ? "listo-texto" : "suave"}>{prep.motivo}</p>
          <div className="botones">
            <button className="primario" disabled={!prep.puede} onClick={() => lanzar(sala, p)}>
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
                ? `Juegas en el asiento ${(yo.asiento ?? 0) + 1}.`
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
