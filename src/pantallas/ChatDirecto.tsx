/**
 * Charla con un amigo (mensajes directos). En el celular ocupa toda la pantalla; en la computadora
 * es una ventanita abajo a la derecha. «Quitar de amigos» vive aquí, en el menú ⋯ (no estorba en la lista).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { enLinea, jugandoAhora, quitarAmigo, usePresencias, type Amigo } from "../firebase/amigos";
import { enviarMensajeDirecto, LARGO_MENSAJE_DIRECTO, marcarLeida, sinLeer, useMensajesDirectos } from "../firebase/charlas";
import { avatarPorDefecto } from "../firebase/perfil";
import { useIdioma } from "../i18n";
import { useSocial } from "./Amigos";
import { filasDeGlobos } from "./Globos";
import { AvatarCirculo } from "./PaginaPerfil";

export function ChatDirecto({ amigo, alCerrar }: { amigo: Amigo; alCerrar: () => void }) {
  const s = useSocial()!;
  const { t, idioma } = useIdioma();
  const mensajes = useMensajesDirectos(s.uid, amigo.uid);
  const presencia = usePresencias([amigo.uid], true)[amigo.uid];
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const lista = useRef<HTMLOListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const nombre = presencia?.nombre ?? amigo.nombre;
  const avatar = presencia?.avatar ?? amigo.avatar ?? avatarPorDefecto(amigo.uid);
  const juega = jugandoAhora(presencia);
  const estado = juega ? t.jugandoA(juega) : enLinea(presencia) ? t.enLinea : t.desconectado;

  // Abierta = leída (también cuando llega algo nuevo con la charla a la vista).
  const indice = s.charlas[amigo.uid];
  const porLeer = sinLeer(indice);
  useEffect(() => {
    if (porLeer) marcarLeida(s.uid, amigo.uid).catch(() => {});
  }, [porLeer, s.uid, amigo.uid, indice?.hora?.toMillis()]);

  // Siempre al último mensaje.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes?.length]);

  // Pantalla completa en el celular: la página de atrás no se mueve. Escape cierra.
  useEffect(() => {
    document.body.classList.add("sin-scroll-celular");
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", tecla);
    if (window.matchMedia("(min-width: 641px)").matches) campo.current?.focus();
    return () => {
      document.body.classList.remove("sin-scroll-celular");
      window.removeEventListener("keydown", tecla);
    };
  }, [alCerrar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    campo.current?.focus();
    try {
      await enviarMensajeDirecto(s.uid, amigo.uid, limpio);
    } catch (err) {
      console.warn(err);
      setTexto(limpio);
      setError(t.errorEnviar);
    }
  };

  const quitar = () => {
    if (!window.confirm(t.confirmarQuitarAmigo(nombre))) return;
    alCerrar();
    quitarAmigo(s.uid, amigo.uid).catch(() => {});
  };

  return (
    <section className="panel chat chat-directo abierto" role="dialog" aria-labelledby="t-charla">
      <div className="chat-cabeza">
        <div className="charla-quien">
          <AvatarCirculo avatar={avatar} tam="sm" />
          <div>
            <h2 id="t-charla">{nombre}</h2>
            <span className="suave chico-texto">{estado}</span>
          </div>
        </div>
        <div className="charla-acciones">
          <details className="menu-charla">
            <summary className="secundario chico" aria-label={t.masOpciones}>
              ⋯
            </summary>
            <div className="menu-charla-lista">
              <button className="enlace peligro" onClick={quitar}>
                {t.quitarAmigoDe(nombre)}
              </button>
            </div>
          </details>
          <button className="secundario chico cerrar-chat" onClick={alCerrar} aria-label={t.cerrar}>
            ✕
          </button>
        </div>
      </div>
      <div className="chat-cuerpo">
        <ol ref={lista} className="mensajes" aria-live="polite">
          {mensajes === null ? (
            <li className="suave vacio">…</li>
          ) : mensajes.length === 0 ? (
            <li className="suave vacio">{t.charlaVacia(nombre)}</li>
          ) : (
            filasDeGlobos(mensajes, s.uid, () => avatar, false, t, idioma)
          )}
        </ol>
      </div>
      <form className="escribir" onSubmit={enviar} noValidate>
        <label htmlFor="mensaje-directo" className="sr-only">
          {t.mensaje}
        </label>
        <input
          id="mensaje-directo"
          ref={campo}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={LARGO_MENSAJE_DIRECTO}
          value={texto}
          placeholder={t.escribeA(nombre)}
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
  );
}
