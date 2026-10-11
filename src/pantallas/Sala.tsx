import { useEffect, useRef, useState, type FormEvent } from "react";
import { JUEGOS, type Categoria, type Juego } from "../datos/catalogo";
import { SelectorIdioma, textosJuego, useIdioma } from "../i18n";
import { enviarMensaje, guardarPerfil, LARGO_MENSAJE, salirDeSala, unirseASala } from "../firebase/salas";
import type { Mensaje, Sala as TSala } from "../firebase/tipos";
import { usePartidas } from "../hooks/usePartidas";
import { useResultados } from "../hooks/useResultados";
import { DESCONECTADO_MS, useAhora, useMensajes, useSala } from "../hooks/useSala";
import { enlaceSala, irA } from "../navegacion";
import { CrearPartida } from "./CrearPartida";
import { FormNombre } from "./FormNombre";
import { EncuestaPendiente } from "./Encuesta";
import { Invitaciones, ListaPartidas } from "./Partidas";
import { olvidarSala, recordarSala } from "../datos/recientes";
import { guardarAudiencia, leerPerfil, registrarPais } from "../firebase/encuestas";

interface Props {
  codigo: string;
  uid: string;
  nombre: string;
  setNombre: (n: string) => void;
}

export function Sala({ codigo, uid, nombre, setNombre }: Props) {
  const { t } = useIdioma();
  const { sala, estado, soyMiembro, confirmado } = useSala(codigo, uid);
  const [errorUnirse, setErrorUnirse] = useState("");
  const intentado = useRef(false);

  // Abrir el enlace de una sala con nombre ya elegido = entrar automáticamente.
  useEffect(() => {
    if (estado !== "lista" || !nombre || soyMiembro || intentado.current) return;
    intentado.current = true;
    unirseASala(codigo, uid, nombre).catch((e) => {
      console.error(e);
      setErrorUnirse(t.errorUnirseSala);
    });
  }, [estado, nombre, soyMiembro, codigo, uid, t]);

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
          <p>{t.invitadoTexto}</p>
        </header>
        <FormNombre
          inicial=""
          boton={t.entrarSala}
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

  return <VistaSala sala={sala} uid={uid} nombre={nombre} confirmado={confirmado} />;
}

function VistaSala({ sala, uid, nombre, confirmado }: { sala: TSala; uid: string; nombre: string; confirmado: boolean }) {
  const { t } = useIdioma();
  const [copiado, setCopiado] = useState(false);
  // Chat y partidas se escuchan solo cuando el servidor ya confirmó mi entrada a la sala.
  const mensajes = useMensajes(sala.codigo, confirmado);
  const partidas = usePartidas(sala.codigo, confirmado);
  useResultados(sala.codigo, uid, partidas, confirmado);

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
          <button className="secundario" onClick={salir}>
            {t.salir}
          </button>
        </div>
      </header>

      <Invitaciones sala={sala.codigo} uid={uid} partidas={partidas} />
      <EncuestaPendiente sala={sala.codigo} uid={uid} partidas={partidas} />

      <div className="rejilla">
        <Miembros sala={sala} uid={uid} />
        <div className="centro-sala">
          <ListaPartidas sala={sala} uid={uid} partidas={partidas} />
          <Catalogo sala={sala} uid={uid} />
        </div>
        <Chat codigo={sala.codigo} uid={uid} nombre={nombre} mensajes={mensajes} />
      </div>
    </main>
  );
}

function Miembros({ sala, uid }: { sala: TSala; uid: string }) {
  const { t } = useIdioma();
  const ahora = useAhora();
  const lista = Object.entries(sala.miembros ?? {})
    .map(([id, m]) => {
      const visto = m.ultimaVez?.toMillis() ?? ahora;
      return { id, ...m, conectado: ahora - visto < DESCONECTADO_MS };
    })
    .sort((a, b) => Number(b.conectado) - Number(a.conectado) || a.nombre.localeCompare(b.nombre));
  const conectados = lista.filter((m) => m.conectado).length;

  return (
    <section className="panel miembros" aria-labelledby="t-miembros">
      <h2 id="t-miembros">
        {t.enLaSala} <span className="contador">{t.conectados(conectados)}</span>
      </h2>
      <ul>
        {lista.map((m) => (
          <li key={m.id} className={m.conectado ? "" : "ausente"}>
            <span className={`punto ${m.conectado ? "on" : "off"}`} aria-hidden="true" />
            <span className="nombre-miembro">{m.nombre}</span>
            {m.id === uid && <span className="insignia">{t.tu}</span>}
            {m.id === sala.anfitrion && <span className="insignia anfitrion">{t.anfitrion}</span>}
            <span className="sr-only">{m.conectado ? t.conectado : t.desconectado}</span>
          </li>
        ))}
      </ul>
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

function Chat({ codigo, uid, nombre, mensajes }: { codigo: string; uid: string; nombre: string; mensajes: Mensaje[] }) {
  const { t } = useIdioma();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) {
      setError(t.escribeAlgo);
      return;
    }
    setTexto("");
    try {
      await enviarMensaje(codigo, uid, nombre, limpio);
    } catch {
      setTexto(limpio);
      setError(t.errorEnviar);
    }
  };

  return (
    <section className="panel chat" aria-labelledby="t-chat">
      <h2 id="t-chat">{t.chat}</h2>
      <ol ref={lista} className="mensajes" aria-live="polite">
        {mensajes.length === 0 && <li className="suave vacio">{t.sinMensajes}</li>}
        {mensajes.map((m) => (
          <li key={m.id} className={m.uid === uid ? "mio" : ""}>
            <span className="autor">{m.uid === uid ? t.tuMayus : m.nombre}</span>
            <span className="texto">{m.texto}</span>
            {m.hora && (
              <time className="hora" dateTime={m.hora.toDate().toISOString()}>
                {m.hora.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
            )}
          </li>
        ))}
      </ol>
      <form className="escribir" onSubmit={enviar} noValidate>
        <label htmlFor="mensaje" className="sr-only">
          {t.mensaje}
        </label>
        <input
          id="mensaje"
          autoComplete="off"
          maxLength={LARGO_MENSAJE}
          value={texto}
          placeholder={t.escribeMensaje}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setTexto(e.target.value);
            setError("");
          }}
        />
        <button type="submit" className="primario">
          {t.enviar}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
