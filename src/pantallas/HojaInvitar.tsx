/**
 * Hoja «Invitar»: todo lo necesario para traer gente en un solo lugar. El enlace (copiar, compartir,
 * WhatsApp), un código QR para quien está al lado, el código de la sala y tus amigos para invitarlos
 * con un toque. Si viene con una partida, el enlace entra directo a esa partida, ya listo.
 */
import { useEffect, useRef, useState } from "react";
import { enLinea, invitarASala, jugandoAhora, usePresencias } from "../firebase/amigos";
import { avatarPorDefecto } from "../firebase/perfil";
import { enlaceInvitacion } from "../firebase/partidas";
import { useIdioma } from "../i18n";
import { enlaceSala } from "../navegacion";
import { useSocial } from "./Amigos";
import { AvatarCirculo } from "./PaginaPerfil";
import { compartirEnlace } from "./Partidas";

export interface PartidaAInvitar {
  id: string;
  juego: string;
  quien: string;
}

interface Props {
  sala: { codigo: string; nombre: string; miembros: string[] };
  partida: PartidaAInvitar | null;
  alCerrar: () => void;
}

/** QR como SVG (la librería se carga solo al abrir la hoja). */
function useQR(texto: string) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode")
      .then((qr) => qr.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d2a22", light: "#ffffff" } }))
      .then((s) => vivo && setSvg(s))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [texto]);
  return svg;
}

export function HojaInvitar({ sala, partida, alCerrar }: Props) {
  const { t } = useIdioma();
  const s = useSocial();
  const ref = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [qrGrande, setQrGrande] = useState(false);
  const [invitados, setInvitados] = useState<Set<string>>(new Set());
  const url = partida ? enlaceInvitacion(sala.codigo, partida.id) : enlaceSala(sala.codigo);
  const texto = partida ? t.textoEnlacePartida(partida.quien, partida.juego) : t.uneteA(sala.nombre);
  const qr = useQR(url);
  const amigos = (s?.amigos ?? []).filter((a) => !sala.miembros.includes(a.uid));
  const presencias = usePresencias(
    amigos.map((a) => a.uid),
    amigos.length > 0,
  );
  const ordenados = [...amigos].sort(
    (a, b) => Number(enLinea(presencias[b.uid])) - Number(enLinea(presencias[a.uid])) || a.nombre.localeCompare(b.nombre),
  );

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const compartir = async () => {
    if ((await compartirEnlace(url, partida ? `${partida.juego} · ${sala.nombre}` : sala.nombre, texto)) === "copiado") {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    }
  };

  return (
    <dialog
      ref={ref}
      className="hoja-invitar"
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="t-invitar"
    >
      <div className="hoja-cabeza">
        <h2 id="t-invitar">{partida ? t.invitarAPartida(partida.juego) : t.invitarASalaTitulo(sala.nombre)}</h2>
        <button className="secundario chico" onClick={() => ref.current?.close()} aria-label={t.cerrar}>
          ✕
        </button>
      </div>
      <p className="suave chico-texto">{partida ? t.enlacePartidaExplica : t.enlaceSalaExplica}</p>

      <div className="hoja-enlace">
        <code className="hoja-url">{url.replace(/^https?:\/\//, "")}</code>
        <div className="botones">
          <button className="primario" onClick={compartir}>
            🔗 {copiado ? t.enlaceCopiado : t.compartirEnlacePartida}
          </button>
          <a className="boton-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </div>

      <div className="hoja-qr">
        <button className={`qr ${qrGrande ? "grande" : ""}`} onClick={() => setQrGrande((g) => !g)} aria-label={t.qrAgrandar}>
          {qr ? <span dangerouslySetInnerHTML={{ __html: qr }} /> : <span className="suave">…</span>}
        </button>
        <div>
          <p className="rotulo">{t.qrTitulo}</p>
          <p className="suave chico-texto">{t.qrTexto}</p>
          <p className="chico-texto">
            {t.codigo} <strong className="mono codigo-grande">{sala.codigo}</strong>
          </p>
        </div>
      </div>

      {s && (
        <div className="hoja-amigos">
          <p className="rotulo">{t.tusAmigos}</p>
          {ordenados.length === 0 ? (
            <p className="suave chico-texto">{(s.amigos ?? []).length ? t.todosEnLaSala : t.sinAmigosHoja}</p>
          ) : (
            <ul className="lista-amigos">
              {ordenados.map((a) => {
                const p = presencias[a.uid];
                const juega = jugandoAhora(p);
                const linea = enLinea(p);
                return (
                  <li key={a.uid}>
                    <span className="avatar-con-punto">
                      <AvatarCirculo avatar={p?.avatar ?? a.avatar ?? avatarPorDefecto(a.uid)} tam="sm" />
                      <span className={`punto ${juega ? "juega" : linea ? "on" : "off"}`} aria-hidden="true" />
                    </span>
                    <span className="quien">
                      {p?.nombre ?? a.nombre}
                      <span className="suave chico-texto estado-amigo">{juega ? t.jugandoA(juega) : linea ? t.enLinea : t.desconectado}</span>
                    </span>
                    <button
                      className={invitados.has(a.uid) ? "secundario chico" : "primario chico"}
                      disabled={invitados.has(a.uid)}
                      onClick={() =>
                        invitarASala(s.yo, a.uid, sala.codigo, sala.nombre, partida?.id)
                          .then(() => setInvitados((x) => new Set(x).add(a.uid)))
                          .catch(() => {})
                      }
                    >
                      {invitados.has(a.uid) ? t.invitado : t.invitarAmigo}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </dialog>
  );
}
