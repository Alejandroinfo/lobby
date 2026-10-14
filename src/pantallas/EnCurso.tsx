/**
 * Inicio: «Tus partidas en curso» (de todas tus salas, primero las que te toca jugar) y la tarjeta
 * para activar los avisos en este celular.
 */
import { useEffect, useState } from "react";
import { juegoPorId } from "../datos/catalogo";
import { activarAvisos, desactivarAvisos, estadoAvisos, type EstadoAvisos } from "../firebase/avisos";
import type { Perfil } from "../firebase/tipos";
import { irA } from "../navegacion";
import { useIdioma } from "../i18n";

const VIGENCIA_MS = 30 * 86_400_000; // una partida sin jugadas en 30 días ya no se muestra

export function PartidasEnCurso({ perfil }: { perfil: Perfil | null | undefined }) {
  const { t } = useIdioma();
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
            <button className="enlace-sala" onClick={() => irA({ pantalla: "sala", codigo: e.sala })}>
              <span>
                <strong>{juegoPorId(e.juego)?.nombre ?? e.juego}</strong> <span className="suave">· {e.nombreSala}</span>
                <br />
                <span className={e.miTurno ? "te-toca-texto" : "suave chico-texto"}>
                  {e.miTurno ? t.teToca : e.esperando.length ? t.leTocaA(e.esperando.join(", ")) : t.enJuego}
                </span>
              </span>
              <span className="suave chico-texto">{haceCuanto(ahora - e.hora, t)}</span>
            </button>
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
  useEffect(() => {
    estadoAvisos().then(setEstado, () => setEstado("sin-soporte"));
  }, []);
  if (!estado || estado === "sin-soporte") return null;
  if (estado === "activos" && !enPerfil) return null;

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
      {!enPerfil && <p className="suave chico-texto">{t.avisosDondeApagar}</p>}
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
