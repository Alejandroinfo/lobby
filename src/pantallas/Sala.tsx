import { useEffect, useRef, useState, type FormEvent } from "react";
import { JUEGOS, juegoPorId, type Categoria, type Juego } from "../datos/catalogo";
import { SelectorIdioma, textosJuego, useIdioma } from "../i18n";
import { actualizarAvatarEnSala, cerrarSala, DIAS_INACTIVIDAD, enviarMensaje, guardarPerfil, LARGO_MENSAJE, motivoCierre, salirDeSala, unirseASala } from "../firebase/salas";
import { avatarPorDefecto } from "../firebase/perfil";
import { AvatarCirculo } from "./PaginaPerfil";
import type { Avatar, Mensaje, Partida, Perfil as TPerfil, Sala as TSala } from "../firebase/tipos";
import { usePartidas } from "../hooks/usePartidas";
import { useEsCelular } from "../hooks/useEsCelular";
import { useResultados } from "../hooks/useResultados";
import { DESCONECTADO_MS, useAhora, useMensajes, useSala } from "../hooks/useSala";
import { enlaceSala, irA } from "../navegacion";
import { CrearPartida } from "./CrearPartida";
import { FormNombre } from "./FormNombre";
import { unirmePorEnlace } from "../firebase/partidas";
import { filasDeGlobos } from "./Globos";
import { EncuestaPendiente } from "./Encuesta";
import { Invitaciones, ListaPartidas } from "./Partidas";
import { Retos } from "./Retos";
import { FichaJugador } from "./Ficha";
import { PanelAmigos, useJugandoEnPresencia, useSalaActual } from "./Amigos";
import { olvidarSala, recordarSala } from "../datos/recientes";
import { guardarAudiencia, leerPerfil, registrarPais } from "../firebase/encuestas";

interface Props {
  codigo: string;
  uid: string;
  nombre: string;
  setNombre: (n: string) => void;
  perfil: TPerfil | null | undefined;
}

export function Sala({ codigo, uid, nombre, setNombre, perfil }: Props) {
  const avatar = perfil?.avatar;
  const { t } = useIdioma();
  const { sala, estado, soyMiembro, confirmado } = useSala(codigo, uid);
  const [errorUnirse, setErrorUnirse] = useState("");
  const intentado = useRef(false);
  // Enlace de invitación a una partida (/s/CODIGO?unirse=ID): al entrar, directo a la partida y listo.
  const [unirse] = useState(() => new URLSearchParams(window.location.search).get("unirse"));

  const cierre = sala ? motivoCierre(sala) : null;

  // Abrir el enlace de una sala con nombre ya elegido = entrar automáticamente (si no está cerrada).
  useEffect(() => {
    if (estado !== "lista" || !nombre || soyMiembro || intentado.current || cierre) return;
    intentado.current = true;
    unirseASala(codigo, uid, nombre, avatar ?? avatarPorDefecto(uid)).catch((e) => {
      console.error(e);
      setErrorUnirse(t.errorUnirseSala);
    });
  }, [estado, nombre, soyMiembro, codigo, uid, t, cierre]);

  // Una sala cerrada sale de «Tus salas recientes».
  useEffect(() => {
    if (cierre) olvidarSala(codigo);
  }, [cierre, codigo]);

  if (estado === "no-existe") {
    return (
      <main className="centro">
        <div className="tarjeta">
          <h2>{t.noEncontramos(codigo)}</h2>
          <p className="suave">{t.revisaCodigo}</p>
          <button className="primario" onClick={() => irA({ pantalla: "inicio" })}>
            {t.volverInicio}
          </button>
        </div>
      </main>
    );
  }
  if (sala && cierre) {
    return (
      <main className="centro">
        <div className="tarjeta" style={{ maxWidth: 460 }}>
          <p className="etiqueta">{t.sala}</p>
          <h2>{sala.nombre}</h2>
          <p>{cierre === "anfitrion" ? t.salaCerradaAnfitrion(sala.cerrada?.toDate().toLocaleDateString() ?? "") : t.salaCerradaInactiva(DIAS_INACTIVIDAD)}</p>
          <p className="suave chico-texto">{t.salaCerradaNota}</p>
          <div className="botones">
            <button className="primario" onClick={() => irA({ pantalla: "inicio" })}>
              {t.crearOtraSala}
            </button>
          </div>
        </div>
      </main>
    );
  }
  if (estado === "error") {
    return (
      <main className="centro">
        <p className="error">{t.errorCargarSala}</p>
      </main>
    );
  }
  if (!nombre) {
    return (
      <main className="inicio">
        <header className="portada">
          <h1>{sala?.nombre ?? t.nombreApp}</h1>
          <p>{unirse ? t.invitadoAPartida(sala?.nombre ?? "") : t.invitadoTexto}</p>
        </header>
        <FormNombre
          inicial=""
          boton={unirse ? t.entrarYJugar : t.entrarSala}
          alGuardar={(n) => {
            setNombre(n);
            guardarPerfil(uid, n).catch(() => {});
          }}
        />
      </main>
    );
  }
  if (!sala || !soyMiembro) {
    return (
      <main className="centro">
        {errorUnirse ? <p className="error">{errorUnirse}</p> : <p className="suave">{t.entrandoSala}</p>}
      </main>
    );
  }

  return (
    <VistaSala sala={sala} uid={uid} nombre={nombre} confirmado={confirmado} avatar={avatar ?? avatarPorDefecto(uid)} perfil={perfil} unirse={unirse} />
  );
}

/** Entra a la partida del enlace (una vez confirmada la entrada a la sala) y avisa cómo quedó. */
function useUnirsePorEnlace(sala: TSala, uid: string, nombre: string, confirmado: boolean, unirse: string | null) {
  const { t } = useIdioma();
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(unirse ? { texto: t.uniendoPartida, ok: true } : null);
  const hecho = useRef(false);
  useEffect(() => {
    if (!unirse || !confirmado || hecho.current) return;
    hecho.current = true;
    // El enlace ya se usó: fuera de la dirección (al recargar no se repite).
    const q = new URLSearchParams(window.location.search);
    q.delete("unirse");
    window.history.replaceState(null, "", window.location.pathname + (q.size ? `?${q}` : ""));
    unirmePorEnlace(sala.codigo, unirse, uid, nombre)
      .then(({ r, p }) => {
        const juego = (p && juegoPorId(p.juego)?.nombre) ?? "";
        const quien = (p && p.invitados[p.anfitrion]?.nombre) ?? t.alguien;
        const texto =
          r === "dentro" || r === "ya-estabas"
            ? t.unidoPorEnlace(juego, quien)
            : r === "espectador"
              ? t.unidoEspectador(juego)
              : r === "llena"
                ? t.enlaceLlena(juego)
                : r === "empezo"
                  ? t.enlaceEmpezo(juego)
                  : t.enlaceNoExiste;
        setAviso({ texto, ok: r === "dentro" || r === "ya-estabas" || r === "espectador" });
        if (p)
          window.setTimeout(() => {
            const el = document.getElementById(`partida-${p.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.classList.add("resaltada");
          }, 500);
      })
      .catch((e) => {
        console.warn(e);
        setAviso({ texto: t.enlaceNoExiste, ok: false });
      });
  }, [unirse, confirmado, sala.codigo, uid, nombre, t]);
  return [aviso, () => setAviso(null)] as const;
}

function VistaSala(props: {
  sala: TSala;
  uid: string;
  nombre: string;
  confirmado: boolean;
  avatar: Avatar;
  perfil: TPerfil | null | undefined;
  unirse: string | null;
}) {
  const { sala, uid, nombre, confirmado, avatar, perfil, unirse } = props;
  const [avisoEnlace, cerrarAvisoEnlace] = useUnirsePorEnlace(sala, uid, nombre, confirmado, unirse);
  useSalaActual(sala.codigo, confirmado ? sala.nombre : undefined);
  const { t } = useIdioma();
  // Si cambiaste de avatar (o la sala aún no lo tiene), se actualiza tu entrada.
  const enSala = sala.miembros?.[uid]?.avatar;
  useEffect(() => {
    if (!confirmado) return;
    if (enSala?.emoji === avatar.emoji && enSala?.color === avatar.color) return;
    actualizarAvatarEnSala(sala.codigo, uid, avatar).catch(() => {});
  }, [confirmado, sala.codigo, uid, avatar.emoji, avatar.color, enSala?.emoji, enSala?.color]);
  const [copiado, setCopiado] = useState(false);
  // Chat y partidas se escuchan solo cuando el servidor ya confirmó mi entrada a la sala.
  const mensajes = useMensajes(sala.codigo, confirmado);
  const partidas = usePartidas(sala.codigo, confirmado);
  // Si estás jugando una partida de esta sala, tus amigos lo ven («jugando Split Loyalty»).
  useJugandoEnPresencia(jugandoAhora(partidas, Date.now()).get(uid) ?? null);
  useResultados(sala.codigo, uid, nombre, partidas, confirmado);

  // Recordar esta sala en "Tus salas recientes" y, una vez confirmada la entrada, anotar el país
  // (solo el código de 2 letras) y la sala por la que llegó la primera vez.
  useEffect(() => {
    recordarSala(sala.codigo, sala.nombre);
  }, [sala.codigo, sala.nombre]);
  useEffect(() => {
    if (!confirmado) return;
    registrarPais(uid);
    leerPerfil(uid).then((perfil) => {
      if (!perfil?.salaOrigen) guardarAudiencia(uid, { nombre, salaOrigen: sala.codigo }).catch(() => {});
    });
  }, [confirmado, uid, sala.codigo, nombre]);

  const copiar = async () => {
    const enlace = enlaceSala(sala.codigo);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: sala.nombre, text: t.uneteA(sala.nombre), url: enlace });
        return;
      }
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt(t.copiaEnlace, enlace);
    }
  };

  const cerrar = async () => {
    if (!window.confirm(t.confirmarCerrarSala)) return;
    await cerrarSala(sala.codigo).catch((e) => console.warn("No se pudo cerrar la sala", e));
  };

  const salir = async () => {
    if (!window.confirm(t.confirmarSalir)) return;
    await salirDeSala(sala.codigo, uid).catch(() => {});
    olvidarSala(sala.codigo);
    irA({ pantalla: "inicio" });
  };

  return (
    <main className="sala">
      <header className="cabecera">
        <div>
          <p className="etiqueta">{t.sala}</p>
          <h1>{sala.nombre}</h1>
          <p className="codigo-sala">
            {t.codigo} <strong>{sala.codigo}</strong>
          </p>
        </div>
        <div className="acciones">
          <SelectorIdioma />
          <button className="primario" onClick={copiar}>
            {copiado ? t.enlaceCopiado : t.invitar}
          </button>
          {sala.anfitrion === uid && (
            <button className="secundario" onClick={cerrar}>
              {t.cerrarSala}
            </button>
          )}
          <button className="secundario" onClick={salir}>
            {t.salir}
          </button>
        </div>
      </header>

      {avisoEnlace && (
        <div className={`aviso-enlace ${avisoEnlace.ok ? "ok" : ""}`} role="status">
          <p>{avisoEnlace.texto}</p>
          <button className="secundario chico" onClick={cerrarAvisoEnlace} aria-label={t.cerrar}>
            ✕
          </button>
        </div>
      )}
      <Invitaciones sala={sala.codigo} uid={uid} partidas={partidas} />
      <EncuestaPendiente sala={sala.codigo} uid={uid} partidas={partidas} />

      <div className="rejilla">
        <div className="col-izquierda">
          <Miembros sala={sala} uid={uid} rivales={perfil?.rivales} partidas={partidas} />
          <PanelAmigos sala={{ codigo: sala.codigo, nombre: sala.nombre, miembros: Object.keys(sala.miembros ?? {}) }} />
        </div>
        <div className="centro-sala">
          <ListaPartidas sala={sala} uid={uid} partidas={partidas} />
          <Retos sala={sala.codigo} uid={uid} nombre={nombre} miembros={Object.keys(sala.miembros ?? {})} confirmado={confirmado} retosPropios={perfil === undefined ? undefined : (perfil?.retosDiarios ?? {})} />
          <Catalogo sala={sala} uid={uid} />
        </div>
        <Chat codigo={sala.codigo} uid={uid} nombre={nombre} mensajes={mensajes} miembros={sala.miembros ?? {}} />
      </div>
    </main>
  );
}

/**
 * Quién está jugando ahora una partida de la sala (uid → juego). Mientras juegas, la pestaña del
 * lobby queda en segundo plano (o cerrada, en la app) y deja de avisar «sigo aquí»: sin esto se te
 * vería desconectado aunque estés jugando. Una partida abandonada deja de contar a las 4 horas.
 */
export function jugandoAhora(partidas: Partida[], ahora: number): Map<string, string> {
  const jugando = new Map<string, string>();
  for (const p of partidas) {
    if (p.estado !== "jugando" || ahora - (p.iniciada?.toMillis() ?? ahora) > 4 * 3600_000) continue;
    for (const [u, i] of Object.entries(p.invitados)) if (i.respuesta === "acepta") jugando.set(u, juegoPorId(p.juego)?.nombre ?? p.juego);
  }
  return jugando;
}

function Miembros({ sala, uid, rivales, partidas }: { sala: TSala; uid: string; rivales: TPerfil["rivales"]; partidas: Partida[] }) {
  const { t } = useIdioma();
  const ahora = useAhora();
  const enJuego = jugandoAhora(partidas, ahora);
  const lista = Object.entries(sala.miembros ?? {})
    .map(([id, m]) => {
      const visto = m.ultimaVez?.toMillis() ?? ahora;
      const conectado = ahora - visto < DESCONECTADO_MS;
      return { id, ...m, conectado: conectado || enJuego.has(id), jugando: conectado ? null : (enJuego.get(id) ?? null) };
    })
    .sort((a, b) => Number(b.conectado) - Number(a.conectado) || a.nombre.localeCompare(b.nombre));
  const conectados = lista.filter((m) => m.conectado).length;
  const [ficha, setFicha] = useState<{ uid: string; nombre: string } | null>(null);

  return (
    <section className="panel miembros" aria-labelledby="t-miembros">
      <h2 id="t-miembros">
        {t.enLaSala} <span className="contador">{t.conectados(conectados)}</span>
      </h2>
      <ul>
        {lista.map((m) => (
          <li key={m.id} className={m.conectado ? "" : "ausente"}>
            <span className="avatar-con-punto">
              <AvatarCirculo avatar={m.avatar ?? avatarPorDefecto(m.id)} tam="sm" />
              <span className={`punto ${m.jugando ? "juega" : m.conectado ? "on" : "off"}`} aria-hidden="true" />
            </span>
            <button
              className="nombre-miembro enlace-nombre"
              onClick={() => (m.id === uid ? irA({ pantalla: "perfil" }) : setFicha({ uid: m.id, nombre: m.nombre }))}
              aria-label={m.id === uid ? t.verPerfil : t.verFichaDe(m.nombre)}
            >
              {m.nombre}
            </button>
            {m.id === uid && <span className="insignia">{t.tu}</span>}
            {m.id === sala.anfitrion && <span className="insignia anfitrion">{t.anfitrion}</span>}
            {m.jugando && <span className="suave chico-texto">· {t.jugandoA(m.jugando)}</span>}
            <span className="sr-only">{m.jugando ? "" : m.conectado ? t.conectado : t.desconectado}</span>
          </li>
        ))}
      </ul>
      {ficha && <FichaJugador uid={ficha.uid} nombre={ficha.nombre} record={rivales?.[ficha.uid] ?? null} alCerrar={() => setFicha(null)} />}
    </section>
  );
}

function Catalogo({ sala, uid }: { sala: TSala; uid: string }) {
  const { t, idioma } = useIdioma();
  const grupos: Categoria[] = ["listo", "prueba"];
  const [elegido, setElegido] = useState<Juego | null>(null);

  if (elegido) {
    return (
      <section className="panel catalogo" aria-label={t.nuevaPartidaDe(elegido.nombre)}>
        <CrearPartida juego={elegido} sala={sala} uid={uid} alCerrar={() => setElegido(null)} />
      </section>
    );
  }

  return (
    <section className="panel catalogo" aria-labelledby="t-juegos">
      <h2 id="t-juegos">{t.juegos}</h2>
      {grupos.map((cat) => (
        <div key={cat} className={`grupo grupo-${cat}`}>
          <h3>
            {t.categorias[cat].titulo} <span className="suave">· {t.categorias[cat].nota}</span>
          </h3>
          <ul className="juegos">
            {JUEGOS.filter((j) => j.categoria === cat).map((j) => (
              <li key={j.id} className="juego">
                <div className="juego-cabeza">
                  <strong>{j.nombre}</strong>
                  {cat === "prueba" && <span className="insignia prueba">{t.enPrueba}</span>}
                </div>
                <p>{textosJuego(j, idioma).descripcion}</p>
                <p className="datos">
                  {t.jugadores(j.jugadores.min, j.jugadores.max)} · {textosJuego(j, idioma).duracion}
                  {j.espectadores ? ` · ${t.conEspectadores}` : ""}
                </p>
                <button className="secundario" onClick={() => setElegido(j)}>
                  {t.crearPartida}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Chat de la sala con globos (los tuyos a la derecha). En computadora queda fijo a la vista; en el
 * celular es un botón 💬 con los no leídos que lo abre a pantalla completa.
 */
function Chat({ codigo, uid, nombre, mensajes, miembros }: { codigo: string; uid: string; nombre: string; mensajes: Mensaje[]; miembros: TSala["miembros"] }) {
  const { t, idioma } = useIdioma();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false); // solo en el celular
  const [abajo, setAbajo] = useState(true); // ¿se está viendo lo último?
  const lista = useRef<HTMLOListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const claveLeido = `lobby_chat_leido:${codigo}`;
  const [leido, setLeido] = useState(() => {
    try {
      return Number(localStorage.getItem(claveLeido) ?? 0);
    } catch {
      return 0;
    }
  });
  const celular = useEsCelular();
  const visible = !celular || abierto;

  const ultimo = mensajes.at(-1);
  const ultimaHora = ultimo?.hora?.toMillis() ?? 0;
  const noLeidos = mensajes.filter((m) => m.uid !== uid && (m.hora?.toMillis() ?? 0) > leido).length;

  // Lo que está a la vista cuenta como leído.
  useEffect(() => {
    if (!visible || !ultimaHora || ultimaHora <= leido) return;
    setLeido(ultimaHora);
    try {
      localStorage.setItem(claveLeido, String(ultimaHora));
    } catch {
      /* sin almacenamiento */
    }
  }, [visible, ultimaHora, leido, claveLeido]);

  // Bajar al último mensaje si ya estabas abajo o si lo mandaste tú (no si estabas leyendo arriba).
  const irAbajo = (suave = false) => {
    const el = lista.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (abajo || ultimo?.uid === uid) irAbajo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes.length]);
  useEffect(() => {
    if (!abierto) return;
    irAbajo();
    // En el celular el chat ocupa toda la pantalla: la página de atrás no se mueve.
    document.body.classList.add("sin-scroll");
    return () => document.body.classList.remove("sin-scroll");
  }, [abierto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) {
      setError(t.escribeAlgo);
      return;
    }
    setTexto("");
    campo.current?.focus();
    try {
      await enviarMensaje(codigo, uid, nombre, limpio);
    } catch {
      setTexto(limpio);
      setError(t.errorEnviar);
    }
  };

  const filas = filasDeGlobos(mensajes, uid, (u) => miembros[u]?.avatar ?? avatarPorDefecto(u), true, t, idioma);

  return (
    <>
      {celular && !abierto && (
        <button className="boton-chat" onClick={() => setAbierto(true)} aria-label={noLeidos ? t.abrirChatNoLeidos(noLeidos) : t.abrirChat}>
          💬
          {noLeidos > 0 && <span className="globo-contador">{noLeidos > 9 ? "9+" : noLeidos}</span>}
        </button>
      )}
      <section className={`panel chat ${abierto ? "abierto" : ""}`} aria-labelledby="t-chat">
        <div className="chat-cabeza">
          <h2 id="t-chat">{t.chat}</h2>
          {abierto && (
            <button className="secundario chico cerrar-chat" onClick={() => setAbierto(false)} aria-label={t.cerrar}>
              ✕
            </button>
          )}
        </div>
        <div className="chat-cuerpo">
          <ol
            ref={lista}
            className="mensajes"
            aria-live="polite"
            onScroll={(e) => {
              const el = e.currentTarget;
              setAbajo(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
            }}
          >
            {mensajes.length === 0 && <li className="suave vacio">{t.sinMensajes}</li>}
            {filas}
          </ol>
          {!abajo && (
            <button className="ir-abajo" onClick={() => irAbajo(true)} aria-label={t.irAlFinal}>
              ↓
            </button>
          )}
        </div>
        <form className="escribir" onSubmit={enviar} noValidate>
          <label htmlFor="mensaje" className="sr-only">
            {t.mensaje}
          </label>
          <input
            id="mensaje"
            ref={campo}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={LARGO_MENSAJE}
            value={texto}
            placeholder={t.escribeMensaje}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setTexto(e.target.value);
              setError("");
            }}
          />
          <button type="submit" className="primario enviar-chat" aria-label={t.enviar} disabled={!texto.trim()}>
            ➤
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </>
  );
}

