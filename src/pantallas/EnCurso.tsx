/**
 * Inicio: «Tus partidas en curso» (de todas tus salas, primero las que te toca jugar) y la tarjeta
 * para activar los avisos en este celular.
 */
import { IconoJuego } from "../datos/iconos";
import { useEffect, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
import { activarAvisos, desactivarAvisos, estadoAvisos, type EstadoAvisos } from "../firebase/avisos";
import { conLlave } from "../firebase/llaveJuego";
import { enlaceDePartida } from "../firebase/partidas";
import type { Perfil } from "../firebase/tipos";
import { abrirJuego } from "../pwa";
import { irA } from "../navegacion";
import { useIdioma } from "../i18n";

const VIGENCIA_MS = 30 * 86_400_000; // una partida sin jugadas en 30 días ya no se muestra

export function PartidasEnCurso({ perfil, uid }: { perfil: Perfil | null | undefined; uid: string }) {
  const { t, idioma } = useIdioma();
  const ahora = Date.now();
  const lista = Object.entries(perfil?.enCurso ?? {})
    .filter(([, e]) => e && ahora - e.hora < VIGENCIA_MS)
    .sort(([, a], [, b]) => Number(b.miTurno) - Number(a.miTurno) || b.hora - a.hora);
  if (!lista.length) return null;
  const meToca = lista.filter(([, e]) => e.miTurno).length;
  return (
    <section className="tarjeta en-curso" aria-labelledby="t-en-curso">
      <h2 id="t-en-curso">
        {t.enCursoTitulo} {meToca > 0 && <span className="insignia te-toca">{t.teTocaN(meToca)}</span>}
      </h2>
      <ul className="lista-en-curso">
        {lista.map(([id, e]) => (
          <li key={id} className={e.miTurno ? "mi-turno" : ""}>
            <IconoJuego id={e.juego} tam={36} />
            <div className="en-curso-info">
              <strong>{juegoPorId(e.juego)?.nombre ?? e.juego}</strong>{" "}
              <button className="enlace suave" onClick={() => irA({ pantalla: "sala", codigo: e.sala })}>
                · {e.nombreSala}
              </button>
              <br />
              <span className={e.miTurno ? "te-toca-texto" : "suave chico-texto"}>
                {e.miTurno ? t.teToca : e.esperando.length ? t.leTocaA(e.esperando.join(", ")) : t.enJuego}
              </span>{" "}
              <span className="suave chico-texto">· {haceCuanto(ahora - e.hora, t)}</span>
            </div>
            {(() => {
              const juego = juegoPorId(e.juego);
              if (!juego?.url) return null;
              return (
                <button
                  className={e.miTurno ? "primario" : "secundario"}
                  onClick={() => abrirJuego(enlaceDePartida(juego, e.sala, id, uid, idioma).then((u) => (u.includes("/s/") ? u : conLlave(juego.id, u))), `juego-${id}`, juego.nombre)}
                >
                  ▶ {e.miTurno ? t.jugarMiTurno : t.entrarPartida}
                </button>
              );
            })()}
          </li>
        ))}
      </ul>
    </section>
  );
}

function haceCuanto(ms: number, t: ReturnType<typeof useIdioma>["t"]): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return t.haceUnMomento;
  if (min < 60) return t.haceMin(min);
  const h = Math.round(min / 60);
  if (h < 24) return t.haceHoras(h);
  return t.haceDias(Math.round(h / 24));
}

/**
 * Activar o apagar los avisos en este aparato. En el inicio solo aparece mientras no están
 * activados (después estorba); para apagarlos, la misma tarjeta está en tu perfil (`enPerfil`).
 */
export function TarjetaAvisos({ uid, enPerfil = false }: { uid: string; enPerfil?: boolean }) {
  const { t, idioma } = useIdioma();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [descartada, setDescartada] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem("lobby_avisos_ahora_no") ?? 0) < 14 * 86_400_000;
    } catch {
      return false;
    }
  });
  const descartar = () => {
    try {
      localStorage.setItem("lobby_avisos_ahora_no", String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    setDescartada(true);
  };
  useEffect(() => {
    estadoAvisos().then(setEstado, () => setEstado("sin-soporte"));
  }, []);
  if (!estado || estado === "sin-soporte") return null;
  if (estado === "activos" && !enPerfil) return null;
  // En el inicio, una franja delgada que se puede cerrar (vuelve a ofrecerse a las dos semanas).
  if (!enPerfil) {
    if (descartada || estado === "bloqueados") return null;
    return (
      <div className="franja-avisos" role="region" aria-label={t.avisosTitulo}>
        <span aria-hidden="true">🔔</span>
        <span className="franja-texto">{estado === "falta-instalar" ? t.avisosFaltaInstalar : t.avisosFranja}</span>
        {estado === "apagados" && (
          <button className="primario chico" disabled={ocupado} onClick={() => cambiar(true)}>
            {t.avisosActivarCorto}
          </button>
        )}
        <button className="enlace chico cerrar-franja" onClick={descartar} aria-label={t.ahoraNo}>
          ✕
        </button>
        {error && <span className="error">{error}</span>}
      </div>
    );
  }

  const cambiar = async (activar: boolean) => {
    setOcupado(true);
    setError("");
    try {
      setEstado(activar ? await activarAvisos(uid, idioma) : await desactivarAvisos(uid));
    } catch (e) {
      console.warn(e);
      setError(t.avisosError);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="tarjeta tarjeta-avisos" aria-labelledby="t-avisos">
      <h2 id="t-avisos">🔔 {t.avisosTitulo}</h2>
      <p className="suave chico-texto">{t.avisosTexto}</p>
      {estado === "activos" ? (
        <p className="listo-texto">
          {t.avisosActivos}{" "}
          <button className="enlace" disabled={ocupado} onClick={() => cambiar(false)}>
            {t.avisosApagar}
          </button>
        </p>
      ) : estado === "falta-instalar" ? (
        <p className="chico-texto aviso-invitado">{t.avisosFaltaInstalar}</p>
      ) : estado === "bloqueados" ? (
        <p className="chico-texto aviso-invitado">{t.avisosBloqueados}</p>
      ) : (
        <button className="primario" disabled={ocupado} onClick={() => cambiar(true)}>
          {t.avisosActivar}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
