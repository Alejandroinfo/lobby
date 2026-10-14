/**
 * Página de perfil (`/perfil`): avatar, cuenta, rango y condecoraciones, estadísticas por juego,
 * récord cara a cara y tus últimas partidas. Los totales vienen de tu perfil (ya cargado); del
 * historial solo se leen las últimas 15 partidas.
 */
import { useEffect, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
import { porJuegoGuardado, resumenGuardado, rivalesGuardados } from "../datos/perfil";
import { avatarPorDefecto, COLORES, completarTotales, EMOJIS, guardarAvatar, leerHistorial } from "../firebase/perfil";
import type { Avatar, EntradaHistorial, Perfil as TPerfil } from "../firebase/tipos";
import type { Usuario } from "../hooks/useUsuario";
import { SelectorIdioma, useIdioma } from "../i18n";
import { irA } from "../navegacion";
import { Carrera } from "./Carrera";
import { CompletarEnlace, Cuenta } from "./Perfil";
import { Privacidad } from "./Privacidad";
import { TarjetaAvisos } from "./EnCurso";

const ADMIN = "alejandro.armasb@gmail.com";

export function AvatarCirculo({ avatar, tam = "md" }: { avatar: Avatar; tam?: "xs" | "sm" | "md" | "lg" }) {
  return (
    <span className={`avatar avatar-${tam}`} style={{ background: avatar.color }} aria-hidden="true">
      {avatar.emoji}
    </span>
  );
}

interface Props {
  usuario: Usuario;
  nombre: string;
  perfil: TPerfil | null | undefined;
}

export function PaginaPerfil({ usuario, nombre, perfil }: Props) {
  const { t, idioma } = useIdioma();
  const [historial, setHistorial] = useState<EntradaHistorial[] | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const avatar = perfil?.avatar ?? avatarPorDefecto(usuario.uid);

  useEffect(() => {
    let vivo = true;
    setHistorial(null);
    leerHistorial(usuario.uid, 15)
      .then((h) => vivo && setHistorial(h))
      .catch(() => vivo && setHistorial([]));
    return () => {
      vivo = false;
    };
  }, [usuario.uid]);

  // Perfiles de antes de los totales: se calculan una vez desde el historial.
  const sinTotales = perfil !== undefined && perfil !== null && !perfil.estadisticas;
  useEffect(() => {
    if (sinTotales && perfil) completarTotales(usuario.uid, perfil).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinTotales, usuario.uid]);

  const cambiar = (a: Avatar) => guardarAvatar(usuario.uid, a).catch(() => {});
  const nombreJuego = (id: string) => juegoPorId(id)?.nombre ?? id;
  const fecha = (e: EntradaHistorial) => e.fecha?.toDate().toLocaleDateString(idioma, { day: "numeric", month: "short", year: "numeric" }) ?? "";

  return (
    <main className="pagina-perfil">
      <header className="cabecera">
        <div className="perfil-cabeza">
          <button className="boton-avatar" onClick={() => setEligiendo((v) => !v)} aria-expanded={eligiendo} aria-label={t.cambiarAvatar}>
            <AvatarCirculo avatar={avatar} tam="lg" />
          </button>
          <div>
            <p className="etiqueta">{t.tuPerfil}</p>
            <h1>{nombre}</h1>
            <button className="enlace chico-texto" onClick={() => setEligiendo((v) => !v)}>{t.cambiarAvatar}</button>
          </div>
        </div>
        <div className="acciones">
          <SelectorIdioma />
          {usuario.email === ADMIN && <button className="secundario" onClick={() => irA({ pantalla: "panel" })}>{t.panel}</button>}
          <button className="secundario" onClick={() => irA({ pantalla: "inicio" })}>{t.volverInicio}</button>
        </div>
      </header>

      <CompletarEnlace />

      {eligiendo && (
        <section className="tarjeta elegir-avatar" aria-label={t.cambiarAvatar}>
          <p className="rotulo">{t.emoji}</p>
          <div className="rejilla-emojis" role="radiogroup" aria-label={t.emoji}>
            {EMOJIS.map((e) => (
              <button key={e} role="radio" aria-checked={avatar.emoji === e} className={avatar.emoji === e ? "elegido" : ""} onClick={() => cambiar({ ...avatar, emoji: e })}>
                {e}
              </button>
            ))}
          </div>
          <p className="rotulo">{t.color}</p>
          <div className="rejilla-colores" role="radiogroup" aria-label={t.color}>
            {COLORES.map((c, i) => (
              <button
                key={c}
                role="radio"
                aria-checked={avatar.color === c}
                aria-label={`${t.color} ${i + 1}`}
                className={avatar.color === c ? "elegido" : ""}
                style={{ background: c }}
                onClick={() => cambiar({ ...avatar, color: c })}
              />
            ))}
          </div>
        </section>
      )}

      <div className="rejilla-perfil">
        <div className="col-perfil">
          <Cuenta usuario={usuario} />
          <Carrera uid={usuario.uid} carreraEnVivo={perfil?.carrera} />
          <Privacidad uid={usuario.uid} perfil={perfil} />
          <TarjetaAvisos uid={usuario.uid} enPerfil />
        </div>
        <div className="col-perfil">
          {historial === null ? (
            <p className="suave">{t.cargando}</p>
          ) : historial.length === 0 ? (
            <section className="tarjeta">
              <h2>{t.tusEstadisticas}</h2>
              <p className="suave">{t.historialVacio}</p>
            </section>
          ) : (
            <Estadisticas historial={historial} perfil={perfil ?? null} uid={usuario.uid} nombreJuego={nombreJuego} fecha={fecha} />
          )}
        </div>
      </div>
    </main>
  );
}

function Estadisticas(props: { historial: EntradaHistorial[]; perfil: TPerfil | null; uid: string; nombreJuego: (id: string) => string; fecha: (e: EntradaHistorial) => string }) {
  const { historial, perfil, uid, nombreJuego, fecha } = props;
  const { t } = useIdioma();
  const r = resumenGuardado(perfil?.estadisticas);
  const juegos = porJuegoGuardado(perfil?.estadisticas);
  const rivales = rivalesGuardados(perfil?.rivales).slice(0, 8);
  const recientes = historial;

  return (
    <>
      <section className="tarjeta" aria-labelledby="t-stats">
        <h2 id="t-stats">{t.tusEstadisticas}</h2>
        <div className="historial-cifras">
          <div><strong>{r.partidas}</strong><span>{t.partidasCol}</span></div>
          <div><strong>{r.porcentaje === null ? "—" : `${r.porcentaje}%`}</strong><span>{t.victoriasCol}</span></div>
          <div><strong>{r.retos}</strong><span>{t.retosCol}</span></div>
          <div><strong className="pequeno">{r.favorito ? nombreJuego(r.favorito) : "—"}</strong><span>{t.favorito}</span></div>
        </div>
        <div className="tabla"><table>
          <thead><tr><th>{t.juego}</th><th>{t.partidasCol}</th><th>{t.victoriasCol}</th><th>{t.mejorCol}</th><th>{t.retosCol}</th><th>{t.mejorReto}</th></tr></thead>
          <tbody>
            {juegos.map((j) => (
              <tr key={j.juego}>
                <td>{nombreJuego(j.juego)}</td>
                <td>{j.partidas}</td>
                <td>{j.partidas ? `${j.victorias} (${Math.round((j.victorias / j.partidas) * 100)}%)` : "—"}</td>
                <td>{j.mejorPuntaje ?? "—"}</td>
                <td>{j.retos || "—"}</td>
                <td>{j.mejorReto ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {rivales.length > 0 && (
        <section className="tarjeta" aria-labelledby="t-rivales">
          <h2 id="t-rivales">{t.caraACara}</h2>
          <ul className="rivales">
            {rivales.map((v) => (
              <li key={v.uid}>
                <span className="quien">{v.nombre}</span>
                <span className="suave chico-texto">{t.partidasJuntos(v.partidas)}</span>
                <span className="marcador" aria-label={t.recordAria(v.ganadas, v.perdidas)}>
                  <span className="g">{v.ganadas}</span>–<span className="p">{v.perdidas}</span>
                  {v.juntos > 0 && <span className="suave chico-texto"> · {t.ganaronJuntos(v.juntos)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta" aria-labelledby="t-recientes-p">
        <h2 id="t-recientes-p">{t.ultimasPartidas}</h2>
        <ul className="recientes-partidas">
          {recientes.map((e) => {
            const otros = e.jugadores.filter((j) => j.uid !== uid).map((j) => j.nombre);
            const res =
              e.tipo === "reto" ? (e.diario ? t.retoDelDia : t.reto) : e.empate ? t.empate : e.gano ? t.ganaste : t.perdiste;
            return (
              <li key={e.id} className={e.tipo === "partida" ? (e.gano ? "gano" : e.empate ? "empate" : "perdio") : "es-reto"}>
                <span className="fecha">{fecha(e)}</span>
                <span>
                  <strong>{nombreJuego(e.juego)}</strong> · {res}
                  {e.puntaje !== null && <> · {e.puntaje} {t.pts}</>}
                </span>
                <span className="suave chico-texto">{otros.length ? t.con(otros.join(", ")) : ""}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
