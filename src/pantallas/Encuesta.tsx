/**
 * Encuesta corta al volver de una partida (playtesting). La primera vez también pregunta,
 * de forma opcional y por rangos, edad, cómo llegó y cuánto juega juegos de mesa.
 */
import { useEffect, useState, type FormEvent } from "react";
import { juegoPorId } from "../datos/catalogo";
import { textosJuego, useIdioma } from "../i18n";
import { guardarAudiencia, guardarEncuesta, leerPerfil, yaRespondio } from "../firebase/encuestas";
import type { ComoLlego, Duracion, Experiencia, Partida, Perfil, RangoEdad } from "../firebase/tipos";

const HORAS_VIGENCIA = 12;
const CLAVE_LISTA = "lobby_encuesta_lista:";
const CLAVE_AUDIENCIA = "lobby_audiencia_omitida";

function marcada(id: string) {
  try {
    return Boolean(localStorage.getItem(CLAVE_LISTA + id));
  } catch {
    return false;
  }
}
function marcar(id: string) {
  try {
    localStorage.setItem(CLAVE_LISTA + id, "1");
  } catch {
    /* sin almacenamiento */
  }
}

function leerSeguro(clave: string) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** La partida más reciente que terminé, sin encuesta respondida ni descartada. */
function pendiente(partidas: Partida[], uid: string): Partida | null {
  const limite = Date.now() - HORAS_VIGENCIA * 3600_000;
  return (
    partidas.find(
      (p) =>
        p.estado === "terminada" &&
        p.invitados[uid]?.respuesta === "acepta" &&
        (p.terminada?.toMillis() ?? Date.now()) > limite &&
        !marcada(p.id),
    ) ?? null
  );
}

export function EncuestaPendiente({ sala, uid, partidas }: { sala: string; uid: string; partidas: Partida[] }) {
  const [, refrescar] = useState(0);
  const p = pendiente(partidas, uid);
  const [revisada, setRevisada] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);

  // Si ya la respondió en otro dispositivo o pestaña, no volver a mostrarla.
  useEffect(() => {
    if (!p || revisada === p.id) return;
    let vivo = true;
    yaRespondio(sala, p.id, uid).then((si) => {
      if (!vivo) return;
      if (si) {
        marcar(p.id);
        refrescar((x) => x + 1);
      }
      setRevisada(p.id);
    });
    return () => {
      vivo = false;
    };
  }, [p, revisada, sala, uid]);

  useEffect(() => {
    leerPerfil(uid).then(setPerfil);
  }, [uid]);

  if (!p || revisada !== p.id || perfil === undefined) return null;

  const cerrar = () => {
    marcar(p.id);
    refrescar((x) => x + 1);
  };

  return <FormEncuesta key={p.id} sala={sala} uid={uid} p={p} perfil={perfil} alTerminar={cerrar} />;
}

function Escala({ id, valor, alElegir, bajo, alto }: { id: string; valor: number | null; alElegir: (n: number) => void; bajo: string; alto: string }) {
  return (
    <div className="escala" role="radiogroup" aria-labelledby={id}>
      <span className="suave chico-texto">{bajo}</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} className={valor === n ? "elegido" : ""} onClick={() => alElegir(n)}>
          {n}
        </button>
      ))}
      <span className="suave chico-texto">{alto}</span>
    </div>
  );
}

function Opciones<T extends string>({ id, valor, opciones, alElegir }: { id: string; valor: T | null; opciones: [T, string][]; alElegir: (v: T) => void }) {
  return (
    <div className="opciones-chip" role="radiogroup" aria-labelledby={id}>
      {opciones.map(([v, texto]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} className={valor === v ? "elegido" : ""} onClick={() => alElegir(v)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

interface PropsForm {
  sala: string;
  uid: string;
  p: Partida;
  perfil: Perfil | null;
  alTerminar: () => void;
}

function FormEncuesta({ sala, uid, p, perfil, alTerminar }: PropsForm) {
  const { t, idioma } = useIdioma();
  const juego = juegoPorId(p.juego);
  const enPrueba = juego?.categoria === "prueba";
  const pedirAudiencia = !perfil?.rangoEdad && !leerSeguro(CLAVE_AUDIENCIA);

  const [diversion, setDiversion] = useState<number | null>(null);
  const [claridad, setClaridad] = useState<number | null>(null);
  const [duracion, setDuracion] = useState<Duracion | null>(null);
  const [comentario, setComentario] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [edad, setEdad] = useState<RangoEdad | null>(null);
  const [comoLlego, setComoLlego] = useState<ComoLlego | null>(null);
  const [experiencia, setExperiencia] = useState<Experiencia | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gracias, setGracias] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (diversion === null) {
      setError(t.errorDiversion);
      return;
    }
    setEnviando(true);
    try {
      await guardarEncuesta(sala, p.id, uid, {
        juego: p.juego,
        diversion,
        claridad,
        duracion,
        comentario: comentario.trim(),
        extra: Object.fromEntries(Object.entries(extra).filter(([, v]) => v.trim())),
      });
      if (pedirAudiencia && edad) {
        const datos: Partial<Perfil> = { rangoEdad: edad };
        // A menores de 13 no se les pregunta nada más.
        if (edad !== "menos-13") {
          if (comoLlego) datos.comoLlego = comoLlego;
          if (experiencia) datos.experiencia = experiencia;
        }
        await guardarAudiencia(uid, datos).catch(() => {});
      }
      setGracias(true);
      window.setTimeout(alTerminar, 1800);
    } catch (err) {
      console.error(err);
      setError(t.errorEnviar);
      setEnviando(false);
    }
  };

  const omitir = () => {
    if (pedirAudiencia) {
      try {
        localStorage.setItem(CLAVE_AUDIENCIA, "1");
      } catch {
        /* sin almacenamiento */
      }
    }
    alTerminar();
  };

  if (gracias) {
    return (
      <section className="panel encuesta" aria-live="polite">
        <p className="listo-texto">{t.gracias}</p>
      </section>
    );
  }

  return (
    <form className="panel encuesta" onSubmit={enviar} noValidate aria-labelledby="t-encuesta">
      <div className="encuesta-cabeza">
        <h2 id="t-encuesta">{t.encuestaTitulo(juego?.nombre ?? p.juego)}</h2>
        {enPrueba && <span className="insignia prueba">{t.enPrueba}</span>}
      </div>
      <p className="suave">
        {enPrueba ? t.encuestaTextoPrueba : t.encuestaTextoListo}
      </p>

      <p className="rotulo" id="q-diversion">{t.qDiversion}</p>
      <Escala id="q-diversion" valor={diversion} alElegir={(n) => { setDiversion(n); setError(""); }} bajo={t.nada} alto={t.muchisimo} />

      <p className="rotulo" id="q-claridad">{t.qClaridad}</p>
      <Escala id="q-claridad" valor={claridad} alElegir={setClaridad} bajo={t.confusas} alto={t.muyClaras} />

      <p className="rotulo" id="q-duracion">{t.qDuracion}</p>
      <Opciones id="q-duracion" valor={duracion} alElegir={setDuracion} opciones={[["corta", t.corta], ["justa", t.justa], ["larga", t.larga]]} />

      {juego?.preguntas?.map((q) => (
        <div key={q.id}>
          <p className="rotulo" id={`q-${q.id}`}>{juego ? textosJuego(juego, idioma).pregunta(q.id) : q.texto}</p>
          {q.tipo === "si-no" ? (
            <Opciones
              id={`q-${q.id}`}
              valor={(extra[q.id] as "si" | "no" | undefined) ?? null}
              alElegir={(v) => setExtra((x) => ({ ...x, [q.id]: v }))}
              opciones={[["si", t.si], ["no", t.no]]}
            />
          ) : (
            <input
              aria-labelledby={`q-${q.id}`}
              maxLength={500}
              value={extra[q.id] ?? ""}
              onChange={(e) => setExtra((x) => ({ ...x, [q.id]: e.target.value }))}
            />
          )}
        </div>
      ))}

      <label htmlFor="comentario">{t.qComentario}</label>
      <textarea id="comentario" rows={2} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} />

      {pedirAudiencia && (
        <fieldset className="audiencia">
          <legend>{t.audienciaLeyenda}</legend>
          <p className="rotulo" id="q-edad">{t.qEdad}</p>
          <Opciones
            id="q-edad"
            valor={edad}
            alElegir={setEdad}
            opciones={(["menos-13", "13-17", "18-24", "25-34", "35-44", "45-mas", "no-dice"] as RangoEdad[]).map((v, k) => [v, t.edades[k]])}
          />
          {edad && edad !== "menos-13" && (
            <>
              <p className="rotulo" id="q-llego">{t.qComoLlego}</p>
              <Opciones
                id="q-llego"
                valor={comoLlego}
                alElegir={setComoLlego}
                opciones={(["amigo", "convencion", "redes", "otro", "no-dice"] as ComoLlego[]).map((v, k) => [v, t.comoLlego[k]])}
              />
              <p className="rotulo" id="q-exp">{t.qExperiencia}</p>
              <Opciones
                id="q-exp"
                valor={experiencia}
                alElegir={setExperiencia}
                opciones={(["casual", "frecuente", "muy-frecuente", "no-dice"] as Experiencia[]).map((v, k) => [v, t.experiencia[k]])}
              />
            </>
          )}
        </fieldset>
      )}

      {error && <p className="error">{error}</p>}
      <div className="botones">
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? t.enviando : t.enviar}
        </button>
        <button type="button" className="secundario" onClick={omitir}>
          {t.ahoraNo}
        </button>
      </div>
    </form>
  );
}
