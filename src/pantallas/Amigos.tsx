/**
 * Amigos: contexto social de toda la app, panel de amigos (inicio y sala), avisos de
 * invitaciones y solicitudes en cualquier pantalla, y el botón de amistad de la ficha.
 */
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  aceptarSolicitud,
  descartarInvitacion,
  enLinea,
  formatoCodigoAmigo,
  jugandoAhora,
  presenciaAlJugar,
  invitarASala,
  LATIDO_PRESENCIA_MS,
  normalizarCodigoAmigo,
  obtenerCodigoAmigo,
  pedirAmistad,
  publicarPresencia,
  quitarAmigo,
  rechazarSolicitud,
  solicitudEnviada,
  uidDeCodigo,
  useAmigos,
  useInvitacionesASala,
  usePresencias,
  useSolicitudes,
  type Amigo,
  type Solicitud,
} from "../firebase/amigos";
import { avatarPorDefecto } from "../firebase/perfil";
import type { Avatar, Perfil } from "../firebase/tipos";
import { useIdioma } from "../i18n";
import { irA } from "../navegacion";
import { AvatarCirculo } from "./PaginaPerfil";
import { sonarAviso } from "./Partidas";

interface Social {
  uid: string;
  yo: { uid: string; nombre: string; avatar: Avatar };
  codigo: string | undefined;
  amigos: Amigo[] | null;
  solicitudes: Solicitud[] | null;
  /** La sala que tienes abierta (se comparte con tus amigos en tu presencia). */
  setSalaActual: (s: { codigo: string; nombre: string } | null) => void;
  /** El juego que estás jugando desde esa sala (también se comparte). */
  setJugando: (juego: string | null) => void;
}
const Contexto = createContext<Social | null>(null);
export const useSocial = () => useContext(Contexto);

export function SocialProvider({ uid, nombre, perfil, children }: { uid: string; nombre: string; perfil: Perfil | null | undefined; children: ReactNode }) {
  const amigos = useAmigos(uid);
  const solicitudes = useSolicitudes(uid);
  const [salaActual, setSalaActual] = useState<{ codigo: string; nombre: string } | null>(null);
  const [jugando, setJugando] = useState<string | null>(null);
  const avatar = perfil?.avatar ?? avatarPorDefecto(uid);
  const yo = { uid, nombre, avatar };

  // Presencia: solo si tienes amigos (si no, nadie la vería). Se renueva cada pocos minutos y al
  // cambiar de sala o volver a la pestaña.
  const tieneAmigos = (amigos?.length ?? 0) > 0;
  const clave = `${tieneAmigos}|${nombre}|${avatar.emoji}|${avatar.color}|${salaActual?.codigo ?? ""}|${salaActual?.nombre ?? ""}|${jugando ?? ""}`;
  useEffect(() => {
    if (!tieneAmigos || !nombre) {
      presenciaAlJugar.publicar = null;
      return;
    }
    const datos = (j: string | null) => ({ nombre, avatar, sala: salaActual?.codigo ?? null, nombreSala: salaActual?.nombre ?? null, jugando: j });
    presenciaAlJugar.publicar = (j) => publicarPresencia(uid, datos(j));
    const publicar = (forzar?: unknown) => {
      // En segundo plano no se renueva (salvo al cambiar algo, como empezar a jugar): así «en línea»
      // significa que tiene el lobby a la vista.
      if (forzar !== true && document.visibilityState !== "visible") return;
      publicarPresencia(uid, datos(jugando)).catch(() => {});
    };
    publicar(true);
    const id = window.setInterval(publicar, LATIDO_PRESENCIA_MS);
    document.addEventListener("visibilitychange", publicar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", publicar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, clave]);

  return (
    <Contexto.Provider value={{ uid, yo, codigo: perfil?.codigoAmigo, amigos, solicitudes, setSalaActual, setJugando }}>
      {children}
      <AvisosSociales />
    </Contexto.Provider>
  );
}

/** Marca en tu presencia el juego que estás jugando desde la sala (null: ninguno). */
export function useJugandoEnPresencia(juego: string | null) {
  const s = useSocial();
  useEffect(() => {
    if (!s) return;
    s.setJugando(juego);
    return () => s.setJugando(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juego]);
}

/** Marca la sala abierta en tu presencia mientras el componente está montado. */
export function useSalaActual(codigo: string, nombre: string | undefined) {
  const s = useSocial();
  useEffect(() => {
    if (!s || !nombre) return;
    s.setSalaActual({ codigo, nombre });
    return () => s.setSalaActual(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, nombre]);
}

// ── Avisos: invitaciones a sala y solicitudes, en cualquier pantalla ─────────────

const VIGENCIA_INVITACION_MS = 2 * 3600_000;

function AvisosSociales() {
  const s = useSocial()!;
  const { t } = useIdioma();
  const invitaciones = useInvitacionesASala(s.uid);
  const vistas = useRef<Set<string> | null>(null);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  const vigentes = (invitaciones ?? []).filter((i) => !i.hora || Date.now() - i.hora.toMillis() < VIGENCIA_INVITACION_MS);
  const enEstaSala = window.location.pathname.toUpperCase().replace(/\/$/, "");
  const mostrar = vigentes.filter((i) => !enEstaSala.endsWith(`/S/${i.sala}`));
  const solicitudes = (s.solicitudes ?? []).filter((x) => !ocultas.has(x.uid));

  // Sonido al llegar una invitación o solicitud nueva (no por las que ya estaban al abrir).
  const cargado = invitaciones !== null && s.solicitudes !== null;
  useEffect(() => {
    if (!cargado) return;
    const claves = [...mostrar.map((i) => `i:${i.uid}:${i.hora?.toMillis() ?? 0}`), ...solicitudes.map((x) => `s:${x.uid}`)];
    if (vistas.current === null) {
      vistas.current = new Set(claves);
      return;
    }
    const nuevas = claves.filter((k) => !vistas.current!.has(k));
    claves.forEach((k) => vistas.current!.add(k));
    if (nuevas.length) sonarAviso();
  });

  if (!mostrar.length && !solicitudes.length) return null;
  return (
    <div className="avisos-sociales" role="region" aria-live="polite" aria-label={t.avisosAmigos}>
      {mostrar.map((i) => (
        <div key={`i-${i.uid}`} className="aviso-social">
          <AvatarCirculo avatar={i.avatar ?? avatarPorDefecto(i.uid)} tam="sm" />
          <span>{t.teInvitaASala(i.nombre, i.nombreSala)}</span>
          <button
            className="primario"
            onClick={() => {
              descartarInvitacion(s.uid, i.uid).catch(() => {});
              irA({ pantalla: "sala", codigo: i.sala });
            }}
          >
            {t.ir}
          </button>
          <button className="secundario" onClick={() => descartarInvitacion(s.uid, i.uid).catch(() => {})} aria-label={t.ahoraNo}>✕</button>
        </div>
      ))}
      {solicitudes.map((x) => (
        <div key={`s-${x.uid}`} className="aviso-social">
          <AvatarCirculo avatar={x.avatar ?? avatarPorDefecto(x.uid)} tam="sm" />
          <span>{t.quiereSerTuAmigo(x.nombre)}</span>
          <button className="primario" onClick={() => aceptarSolicitud(s.yo, x).catch(() => {})}>{t.aceptar}</button>
          <button
            className="secundario"
            onClick={() => {
              setOcultas((o) => new Set(o).add(x.uid));
              rechazarSolicitud(s.uid, x.uid).catch(() => {});
            }}
          >
            {t.rechazar}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Panel de amigos ────────────────────────────────────────────────────────────

/** En la sala (`sala` presente) permite invitar; en el inicio, unirse a la sala de un amigo. */
export function PanelAmigos({ sala }: { sala?: { codigo: string; nombre: string; miembros: string[] } }) {
  const s = useSocial();
  const { t } = useIdioma();
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [miCodigo, setMiCodigo] = useState<string | undefined>(s?.codigo);
  const [invitados, setInvitados] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const amigos = s?.amigos ?? [];
  const presencias = usePresencias(amigos.map((a) => a.uid), amigos.length > 0);
  useEffect(() => setMiCodigo(s?.codigo), [s?.codigo]);
  if (!s) return null;

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    const limpio = normalizarCodigoAmigo(codigo);
    if (limpio.length !== 8) {
      setMensaje({ tipo: "error", texto: t.codigoAmigoInvalido });
      return;
    }
    try {
      const otro = await uidDeCodigo(limpio);
      if (!otro) {
        setMensaje({ tipo: "error", texto: t.codigoAmigoNoExiste });
        return;
      }
      const r = await pedirAmistad(s.yo, otro);
      setMensaje({ tipo: r === "eres-tu" ? "error" : "ok", texto: t.resultadoSolicitud[r] });
      if (r !== "eres-tu") setCodigo("");
    } catch (err) {
      console.error(err);
      setMensaje({ tipo: "error", texto: t.errCuenta });
    }
  };

  const verCodigo = async () => {
    try {
      setMiCodigo(await obtenerCodigoAmigo(s.uid, s.codigo));
    } catch {
      setMensaje({ tipo: "error", texto: t.errCuenta });
    }
  };

  const copiar = async () => {
    if (!miCodigo) return;
    try {
      await navigator.clipboard.writeText(formatoCodigoAmigo(miCodigo));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      window.prompt("", formatoCodigoAmigo(miCodigo));
    }
  };

  const presente = (p: (typeof presencias)[string]) => enLinea(p) || !!jugandoAhora(p);
  const ordenados = [...amigos].sort((a, b) => {
    const pa = presencias[a.uid], pb = presencias[b.uid];
    return Number(presente(pb)) - Number(presente(pa)) || a.nombre.localeCompare(b.nombre);
  });
  const conectados = amigos.filter((a) => presente(presencias[a.uid])).length;

  return (
    <section className="panel amigos" aria-labelledby="t-amigos">
      <h2 id="t-amigos">
        {t.amigos} {amigos.length > 0 && <span className="contador">{t.conectados(conectados)}</span>}
      </h2>

      {(s.solicitudes ?? []).length > 0 && (
        <ul className="lista-amigos solicitudes">
          {(s.solicitudes ?? []).map((x) => (
            <li key={x.uid}>
              <AvatarCirculo avatar={x.avatar ?? avatarPorDefecto(x.uid)} tam="sm" />
              <span className="quien">{x.nombre} <span className="suave chico-texto">· {t.teQuiereAgregar}</span></span>
              <button className="primario chico" onClick={() => aceptarSolicitud(s.yo, x).catch(() => {})}>{t.aceptar}</button>
              <button className="secundario chico" onClick={() => rechazarSolicitud(s.uid, x.uid).catch(() => {})} aria-label={`${t.rechazar} ${x.nombre}`}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {amigos.length === 0 ? (
        <p className="suave chico-texto">{t.sinAmigos}</p>
      ) : (
        <ul className="lista-amigos">
          {ordenados.map((a) => {
            const p = presencias[a.uid];
            const juega = jugandoAhora(p);
            const linea = enLinea(p);
            const nombre = p?.nombre ?? a.nombre;
            const enMiSala = sala && sala.miembros.includes(a.uid);
            const suSala = linea && p?.sala ? p : null;
            return (
              <li key={a.uid}>
                <span className="avatar-con-punto">
                  <AvatarCirculo avatar={p?.avatar ?? a.avatar ?? avatarPorDefecto(a.uid)} tam="sm" />
                  <span className={`punto ${juega ? "juega" : linea ? "on" : "off"}`} aria-hidden="true" />
                </span>
                <span className="quien">
                  {nombre}
                  <span className="suave chico-texto estado-amigo">
                    {juega
                      ? `${t.jugandoA(juega)}${p?.nombreSala && !enMiSala ? ` · ${t.enLaSalaDe(p.nombreSala)}` : ""}`
                      : enMiSala
                        ? t.enEstaSala
                        : suSala
                          ? t.enLaSalaDe(suSala.nombreSala ?? suSala.sala ?? "")
                          : linea
                            ? t.enLinea
                            : t.desconectado}
                  </span>
                </span>
                {sala && !enMiSala && (
                  <button
                    className="secundario chico"
                    disabled={invitados.has(a.uid)}
                    onClick={() =>
                      invitarASala(s.yo, a.uid, sala.codigo, sala.nombre)
                        .then(() => setInvitados((x) => new Set(x).add(a.uid)))
                        .catch(() => setMensaje({ tipo: "error", texto: t.errCuenta }))
                    }
                  >
                    {invitados.has(a.uid) ? t.invitado : t.invitarAmigo}
                  </button>
                )}
                {!sala && suSala?.sala && (
                  <button className="secundario chico" onClick={() => irA({ pantalla: "sala", codigo: suSala.sala! })}>{t.unirme}</button>
                )}
                <button
                  className="enlace quitar-amigo"
                  aria-label={t.quitarAmigoDe(nombre)}
                  title={t.quitarAmigoDe(nombre)}
                  onClick={() => window.confirm(t.confirmarQuitarAmigo(nombre)) && quitarAmigo(s.uid, a.uid).catch(() => {})}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className="agregar-amigo" onSubmit={agregar} noValidate>
        <label htmlFor="codigo-amigo">{t.agregarConCodigo}</label>
        <div className="fila">
          <input id="codigo-amigo" value={codigo} placeholder="K7Q2-M8XZ" autoComplete="off" onChange={(e) => setCodigo(e.target.value)} />
          <button type="submit" className="secundario">{t.agregar}</button>
        </div>
      </form>
      {mensaje && <p className={mensaje.tipo === "error" ? "error" : "listo-texto"} role="status">{mensaje.texto}</p>}
      <p className="suave chico-texto tu-codigo">
        {miCodigo ? (
          <>
            {t.tuCodigoAmigo} <strong className="mono">{formatoCodigoAmigo(miCodigo)}</strong>{" "}
            <button className="enlace" onClick={copiar}>{copiado ? t.copiado : t.copiar}</button>
          </>
        ) : (
          <button className="enlace" onClick={verCodigo}>{t.verMiCodigo}</button>
        )}
      </p>
    </section>
  );
}

// ── Botón de amistad en la ficha de otra persona ───────────────────────────────

export function BotonAmistad({ otro, nombre }: { otro: string; nombre: string }) {
  const s = useSocial();
  const { t } = useIdioma();
  const [enviada, setEnviada] = useState<boolean | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  useEffect(() => {
    if (!s) return;
    solicitudEnviada(s.uid, otro).then(setEnviada);
  }, [s, otro]);
  if (!s || s.uid === otro) return null;

  const esAmigo = (s.amigos ?? []).some((a) => a.uid === otro);
  const meLaPidio = (s.solicitudes ?? []).find((x) => x.uid === otro);
  if (esAmigo) return <p className="listo-texto chico-texto">✓ {t.sonAmigos}</p>;
  if (meLaPidio) return <button className="primario" onClick={() => aceptarSolicitud(s.yo, meLaPidio).catch(() => {})}>{t.aceptarSolicitudDe(nombre)}</button>;
  if (enviada) return <p className="suave chico-texto">{t.solicitudEnviada}</p>;
  return (
    <button
      className="secundario"
      disabled={trabajando || enviada === null}
      onClick={async () => {
        setTrabajando(true);
        try {
          await pedirAmistad(s.yo, otro);
          setEnviada(true);
        } finally {
          setTrabajando(false);
        }
      }}
    >
      {t.agregarAmigos}
    </button>
  );
}
