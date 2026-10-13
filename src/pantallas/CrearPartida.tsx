import { esApp } from "../pwa";
import { presenciaAlJugar } from "../firebase/amigos";
import { useState, type FormEvent } from "react";
import type { Juego } from "../datos/catalogo";
import { crearPartida, crearPartidaSolo, enlaceJuego, type Invitacion } from "../firebase/partidas";
import type { Partida, Rol, Sala } from "../firebase/tipos";
import { DESCONECTADO_MS, useAhora } from "../hooks/useSala";
import { textosJuego, useIdioma } from "../i18n";

interface Props {
  juego: Juego;
  sala: Sala;
  uid: string;
  alCerrar: () => void;
}

/**
 * Crea y lanza una partida en solitario y abre el juego en otra pestaña. La pestaña se abre en el
 * mismo clic (si no, el navegador la bloquea) y después recibe la dirección.
 */
export async function abrirPartidaSolo(
  sala: string,
  yo: { uid: string; nombre: string },
  juego: Juego,
  variante: string | null,
  nivel: "hard" | "easy",
  idioma: "es" | "en",
) {
  // En la app instalada el juego se abre en la misma ventana (ver abrirJuego).
  const pestana = esApp() ? null : window.open("", "_blank");
  try {
    const { id, codigoJuego } = await crearPartidaSolo(sala, yo, juego, variante, nivel);
    const p = {
      id,
      juego: juego.id,
      variante,
      nivel,
      codigoJuego,
      invitados: { [yo.uid]: { nombre: yo.nombre, rol: "jugador", respuesta: "acepta", listo: true, respondio: null, asiento: 0 } },
    } as unknown as Partida;
    const enlace = enlaceJuego(juego, sala, p, yo.uid, idioma);
    // Tus amigos ven «jugando …» (en la app, el lobby se cierra al abrir el juego: se avisa antes).
    const aviso = presenciaAlJugar.publicar?.(juego.nombre).catch(() => {});
    if (!enlace) pestana?.close();
    else if (pestana) pestana.location.href = enlace;
    else {
      await Promise.race([aviso, new Promise((ok) => setTimeout(ok, 800))]);
      window.location.href = enlace;
    }
  } catch (e) {
    pestana?.close();
    throw e;
  }
}

/** Elegir variante e invitados (toda la sala o algunas personas) con su rol. */
export function CrearPartida({ juego, sala, uid, alCerrar }: Props) {
  const { t, idioma } = useIdioma();
  const ahora = useAhora();
  const [variante, setVariante] = useState(juego.variantes[0]?.id ?? null);
  const [roles, setRoles] = useState<Record<string, Rol | null>>({ [uid]: "jugador" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [solo, setSolo] = useState(false);
  const [nivel, setNivel] = useState<"hard" | "easy">(juego.solo?.niveles[0]?.id ?? "hard");
  const yo = (sala.miembros ?? {})[uid];

  const jugarSolo = async () => {
    setError("");
    setEnviando(true);
    try {
      await abrirPartidaSolo(sala.codigo, { uid, nombre: yo?.nombre ?? "" }, juego, variante, nivel, idioma);
      alCerrar();
    } catch (err) {
      console.error(err);
      setError(t.errorCrearPartida);
      setEnviando(false);
    }
  };

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
      setError(t.necesitaMin(juego.nombre, min, min - jugadores));
      return;
    }
    if (jugadores > max) {
      setError(t.admiteMax(juego.nombre, max, juego.espectadores));
      return;
    }
    setEnviando(true);
    try {
      await crearPartida(sala.codigo, uid, juego, variante, invitaciones);
      alCerrar();
    } catch (err) {
      console.error(err);
      setError(t.errorCrearPartida);
      setEnviando(false);
    }
  };

  const opcionesRol = (
    <>
      <option value="jugador">{t.jugador}</option>
      {juego.espectadores && <option value="espectador">{t.espectador}</option>}
    </>
  );

  return (
    <form className="crear-partida" onSubmit={enviar} noValidate>
      <div className="crear-cabeza">
        <h3>{t.nuevaPartidaDe(juego.nombre)}</h3>
        <button type="button" className="enlace" onClick={alCerrar}>
          {t.cancelar}
        </button>
      </div>

      {juego.solo && (
        <div className="segmentado modo-partida" role="radiogroup" aria-label={t.comoJugar}>
          <button type="button" role="radio" aria-checked={!solo} onClick={() => setSolo(false)}>{t.conLaSala}</button>
          <button type="button" role="radio" aria-checked={solo} onClick={() => setSolo(true)}>{t.soloContraMaquina}</button>
        </div>
      )}

      {juego.variantes.length > 0 && (
        <>
          <label htmlFor="variante">{t.modo}</label>
          <select id="variante" value={variante ?? ""} onChange={(e) => setVariante(e.target.value)}>
            {juego.variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {textosJuego(juego, idioma).variante(v.id)}
              </option>
            ))}
          </select>
        </>
      )}

      {solo && juego.solo ? (
        <>
          {juego.solo.niveles.length > 1 ? (
            <>
              <label htmlFor="nivel">{t.rival}</label>
              <select id="nivel" value={nivel} onChange={(e) => setNivel(e.target.value as "hard" | "easy")}>
                {juego.solo.niveles.map((n) => (
                  <option key={n.id} value={n.id}>{idioma === "en" ? n.en : n.es}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="suave">
              {t.rival}: <strong>{idioma === "en" ? juego.solo.niveles[0].en : juego.solo.niveles[0].es}</strong>
            </p>
          )}
          <p className="suave chico-texto">{t.soloTexto}</p>
          {error && <p className="error">{error}</p>}
          <button type="button" className="primario" disabled={enviando} onClick={jugarSolo}>
            {enviando ? t.enviando : t.jugarSolo}
          </button>
        </>
      ) : (
      <>
      <div className="invitar-cabeza">
        <p className="rotulo">{t.aQuienInvitas}</p>
        {otros.length > 0 && (
          <button type="button" className="secundario chico" onClick={invitarATodos}>
            {t.invitarTodos}
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
                  {soyYo && t.tuParen}
                  {!m.conectado && <span className="suave">{t.desconectadoPunto}</span>}
                </span>
              </label>
              {rol && (
                <select
                  aria-label={t.rolDe(m.nombre)}
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
        <p className="suave">{t.nadieMas}</p>
      )}
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primario" disabled={enviando}>
        {enviando ? t.enviando : t.enviarInvitaciones}
      </button>
      </>
      )}
    </form>
  );
}
