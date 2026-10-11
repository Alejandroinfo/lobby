import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIAS, JUEGOS, type Categoria } from "../datos/catalogo";
import { enviarMensaje, guardarPerfil, LARGO_MENSAJE, salirDeSala, unirseASala } from "../firebase/salas";
import type { Mensaje, Sala as TSala } from "../firebase/tipos";
import { DESCONECTADO_MS, useAhora, useMensajes, useSala } from "../hooks/useSala";
import { enlaceSala, irA } from "../navegacion";
import { FormNombre } from "./FormNombre";

interface Props {
  codigo: string;
  uid: string;
  nombre: string;
  setNombre: (n: string) => void;
}

export function Sala({ codigo, uid, nombre, setNombre }: Props) {
  const { sala, estado, soyMiembro } = useSala(codigo, uid);
  const [errorUnirse, setErrorUnirse] = useState("");
  const intentado = useRef(false);

  // Abrir el enlace de una sala con nombre ya elegido = entrar automáticamente.
  useEffect(() => {
    if (estado !== "lista" || !nombre || soyMiembro || intentado.current) return;
    intentado.current = true;
    unirseASala(codigo, uid, nombre).catch((e) => {
      console.error(e);
      setErrorUnirse("No se pudo entrar a la sala. Recarga la página para intentarlo de nuevo.");
    });
  }, [estado, nombre, soyMiembro, codigo, uid]);

  if (estado === "no-existe") {
    return (
      <main className="centro">
        <div className="tarjeta">
          <h2>No encontramos la sala {codigo}</h2>
          <p className="suave">Revisa el código con quien te invitó; puede que lo hayas escrito mal.</p>
          <button className="primario" onClick={() => irA({ pantalla: "inicio" })}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }
  if (estado === "error") {
    return (
      <main className="centro">
        <p className="error">No se pudo cargar la sala. Revisa tu conexión y recarga la página.</p>
      </main>
    );
  }
  if (!nombre) {
    return (
      <main className="inicio">
        <header className="portada">
          <h1>{sala?.nombre ?? "Lobby de juegos"}</h1>
          <p>Te invitaron a esta sala. Elige tu nombre para entrar.</p>
        </header>
        <FormNombre
          inicial=""
          boton="Entrar a la sala"
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
        {errorUnirse ? <p className="error">{errorUnirse}</p> : <p className="suave">Entrando a la sala…</p>}
      </main>
    );
  }

  return <VistaSala sala={sala} uid={uid} nombre={nombre} />;
}

function VistaSala({ sala, uid, nombre }: { sala: TSala; uid: string; nombre: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensajes = useMensajes(sala.codigo, true);

  const copiar = async () => {
    const enlace = enlaceSala(sala.codigo);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: sala.nombre, text: `Únete a ${sala.nombre}`, url: enlace });
        return;
      }
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia este enlace:", enlace);
    }
  };

  const salir = async () => {
    if (!window.confirm("¿Salir de la sala? Podrás volver con el mismo enlace.")) return;
    await salirDeSala(sala.codigo, uid).catch(() => {});
    irA({ pantalla: "inicio" });
  };

  return (
    <main className="sala">
      <header className="cabecera">
        <div>
          <p className="etiqueta">Sala</p>
          <h1>{sala.nombre}</h1>
          <p className="codigo-sala">
            Código <strong>{sala.codigo}</strong>
          </p>
        </div>
        <div className="acciones">
          <button className="primario" onClick={copiar}>
            {copiado ? "¡Enlace copiado!" : "Invitar"}
          </button>
          <button className="secundario" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <div className="rejilla">
        <Miembros sala={sala} uid={uid} />
        <Catalogo />
        <Chat codigo={sala.codigo} uid={uid} nombre={nombre} mensajes={mensajes} />
      </div>
    </main>
  );
}

function Miembros({ sala, uid }: { sala: TSala; uid: string }) {
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
        En la sala <span className="contador">{conectados} conectados</span>
      </h2>
      <ul>
        {lista.map((m) => (
          <li key={m.id} className={m.conectado ? "" : "ausente"}>
            <span className={`punto ${m.conectado ? "on" : "off"}`} aria-hidden="true" />
            <span className="nombre-miembro">{m.nombre}</span>
            {m.id === uid && <span className="insignia">tú</span>}
            {m.id === sala.anfitrion && <span className="insignia anfitrion">anfitrión</span>}
            <span className="sr-only">{m.conectado ? "conectado" : "desconectado"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Catalogo() {
  const grupos: Categoria[] = ["listo", "prueba"];
  return (
    <section className="panel catalogo" aria-labelledby="t-juegos">
      <h2 id="t-juegos">Juegos</h2>
      {grupos.map((cat) => (
        <div key={cat} className={`grupo grupo-${cat}`}>
          <h3>
            {CATEGORIAS[cat].titulo} <span className="suave">· {CATEGORIAS[cat].nota}</span>
          </h3>
          <ul className="juegos">
            {JUEGOS.filter((j) => j.categoria === cat).map((j) => (
              <li key={j.id} className="juego">
                <div className="juego-cabeza">
                  <strong>{j.nombre}</strong>
                  {cat === "prueba" && <span className="insignia prueba">en prueba</span>}
                </div>
                <p>{j.descripcion}</p>
                <p className="datos">
                  {j.jugadores.min === j.jugadores.max
                    ? `${j.jugadores.min} jugadores`
                    : `${j.jugadores.min}–${j.jugadores.max} jugadores`}{" "}
                  · {j.duracion}
                  {j.espectadores ? " · con espectadores" : ""}
                </p>
                <button className="secundario" disabled title="Llega en el próximo paso">
                  Crear partida · pronto
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
      setError("Escribe algo antes de enviar.");
      return;
    }
    setTexto("");
    try {
      await enviarMensaje(codigo, uid, nombre, limpio);
    } catch {
      setTexto(limpio);
      setError("No se pudo enviar. Intenta de nuevo.");
    }
  };

  return (
    <section className="panel chat" aria-labelledby="t-chat">
      <h2 id="t-chat">Chat</h2>
      <ol ref={lista} className="mensajes" aria-live="polite">
        {mensajes.length === 0 && <li className="suave vacio">Aún no hay mensajes. ¡Saluda!</li>}
        {mensajes.map((m) => (
          <li key={m.id} className={m.uid === uid ? "mio" : ""}>
            <span className="autor">{m.uid === uid ? "Tú" : m.nombre}</span>
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
          Mensaje
        </label>
        <input
          id="mensaje"
          autoComplete="off"
          maxLength={LARGO_MENSAJE}
          value={texto}
          placeholder="Escribe un mensaje…"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setTexto(e.target.value);
            setError("");
          }}
        />
        <button type="submit" className="primario">
          Enviar
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
