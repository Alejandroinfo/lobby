import { useState, type FormEvent } from "react";
import type { Juego } from "../datos/catalogo";
import { crearPartida, type Invitacion } from "../firebase/partidas";
import type { Rol, Sala } from "../firebase/tipos";
import { DESCONECTADO_MS, useAhora } from "../hooks/useSala";

interface Props {
  juego: Juego;
  sala: Sala;
  uid: string;
  alCerrar: () => void;
}

/** Elegir variante e invitados (toda la sala o algunas personas) con su rol. */
export function CrearPartida({ juego, sala, uid, alCerrar }: Props) {
  const ahora = useAhora();
  const [variante, setVariante] = useState(juego.variantes[0]?.id ?? null);
  const [roles, setRoles] = useState<Record<string, Rol | null>>({ [uid]: "jugador" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const miembros = Object.entries(sala.miembros ?? {})
    .map(([id, m]) => ({ id, nombre: m.nombre, conectado: ahora - (m.ultimaVez?.toMillis() ?? ahora) < DESCONECTADO_MS }))
    .sort((a, b) => Number(b.id === uid) - Number(a.id === uid) || Number(b.conectado) - Number(a.conectado));
  const otros = miembros.filter((m) => m.id !== uid);

  const cambiar = (id: string, rol: Rol | null) => {
    setRoles((r) => ({ ...r, [id]: rol }));
    setError("");
  };

  const invitarATodos = () => {
    const nuevo: Record<string, Rol | null> = { [uid]: roles[uid] ?? "jugador" };
    let jugadores = nuevo[uid] === "jugador" ? 1 : 0;
    for (const m of otros.filter((o) => o.conectado)) {
      const cabe = jugadores < juego.jugadores.max;
      nuevo[m.id] = cabe ? "jugador" : juego.espectadores ? "espectador" : null;
      if (cabe) jugadores++;
    }
    setRoles(nuevo);
    setError("");
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const invitaciones: Invitacion[] = miembros
      .filter((m) => roles[m.id])
      .map((m) => ({ uid: m.id, nombre: m.nombre, rol: roles[m.id]! }));
    const jugadores = invitaciones.filter((i) => i.rol === "jugador").length;
    const { min, max } = juego.jugadores;
    if (jugadores < min) {
      setError(`${juego.nombre} necesita al menos ${min} jugadores; invita a ${min - jugadores} más.`);
      return;
    }
    if (jugadores > max) {
      setError(
        `${juego.nombre} admite como máximo ${max} jugadores.` +
          (juego.espectadores ? " Pon al resto como espectadores." : " Quita a alguien de la lista."),
      );
      return;
    }
    setEnviando(true);
    try {
      await crearPartida(sala.codigo, uid, juego, variante, invitaciones);
      alCerrar();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la partida. Intenta de nuevo.");
      setEnviando(false);
    }
  };

  const opcionesRol = (
    <>
      <option value="jugador">Jugador</option>
      {juego.espectadores && <option value="espectador">Espectador</option>}
    </>
  );

  return (
    <form className="crear-partida" onSubmit={enviar} noValidate>
      <div className="crear-cabeza">
        <h3>Nueva partida de {juego.nombre}</h3>
        <button type="button" className="enlace" onClick={alCerrar}>
          Cancelar
        </button>
      </div>

      {juego.variantes.length > 0 && (
        <>
          <label htmlFor="variante">Modo</label>
          <select id="variante" value={variante ?? ""} onChange={(e) => setVariante(e.target.value)}>
            {juego.variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="invitar-cabeza">
        <p className="rotulo">A quién invitas</p>
        {otros.length > 0 && (
          <button type="button" className="secundario chico" onClick={invitarATodos}>
            Invitar a toda la sala
          </button>
        )}
      </div>
      <ul className="lista-invitar">
        {miembros.map((m) => {
          const rol = roles[m.id] ?? null;
          const soyYo = m.id === uid;
          return (
            <li key={m.id} className={m.conectado ? "" : "ausente"}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(rol)}
                  disabled={soyYo}
                  onChange={(e) => cambiar(m.id, e.target.checked ? "jugador" : null)}
                />
                <span>
                  {m.nombre}
                  {soyYo && " (tú)"}
                  {!m.conectado && <span className="suave"> · desconectado</span>}
                </span>
              </label>
              {rol && (
                <select
                  aria-label={`Rol de ${m.nombre}`}
                  value={rol}
                  onChange={(e) => cambiar(m.id, e.target.value as Rol)}
                >
                  {opcionesRol}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {otros.length === 0 && (
        <p className="suave">Aún no hay nadie más en la sala. Usa "Invitar" arriba para compartir el enlace.</p>
      )}
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primario" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar invitaciones"}
      </button>
    </form>
  );
}
