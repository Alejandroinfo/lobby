/**
 * «Reportar un problema»: botón en todas las pantallas del lobby, aviso si la página falla y
 * página /reportar que los juegos abren encima de la partida (con su registro adjunto).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ORIGENES_JUEGOS } from "../datos/catalogo";
import { achicarCaptura, enviarReporte, guardarParaDespues, type ContextoReporte, type TipoReporte } from "../firebase/reportes";
import { alFallar, erroresRecientes } from "../reportes/errores";
import { leerRuta } from "../navegacion";
import { useIdioma } from "../i18n";

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "local";

function contextoDelLobby(): ContextoReporte {
  const ruta = leerRuta();
  return {
    juego: null,
    version: `lobby ${VERSION}`,
    donde: { pantalla: ruta.pantalla, sala: ruta.pantalla === "sala" ? ruta.codigo : null },
    registro: null,
    nombreRegistro: null,
    errores: erroresRecientes(),
  };
}

const TIPOS: TipoReporte[] = ["trabado", "reglas", "visual", "otro"];

interface PropsForm {
  uid: string | null;
  nombre: string;
  contexto: ContextoReporte;
  /** Texto inicial (p. ej. cuando la página falló). */
  inicial?: string;
  alTerminar: () => void;
}

export function FormReporte({ uid, nombre, contexto, inicial = "", alTerminar }: PropsForm) {
  const { t } = useIdioma();
  const [tipo, setTipo] = useState<TipoReporte | null>(inicial ? "trabado" : null);
  const [que, setQue] = useState(inicial);
  const [esperaba, setEsperaba] = useState("");
  const [captura, setCaptura] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | "guardado">("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipo) return setError(t.reporteFaltaTipo);
    if (!que.trim()) return setError(t.reporteFaltaQue);
    setEstado("enviando");
    const datos = { ...contexto, tipo, que, esperaba, captura };
    try {
      if (!navigator.onLine || !uid) {
        guardarParaDespues(datos);
        setEstado("guardado");
      } else {
        await enviarReporte(uid, nombre, datos);
        setEstado("enviado");
      }
      window.setTimeout(alTerminar, 2200);
    } catch (err) {
      console.warn(err);
      guardarParaDespues(datos); // no se pierde: se reintenta al volver a abrir el lobby
      setEstado("guardado");
      window.setTimeout(alTerminar, 2600);
    }
  };

  if (estado === "enviado" || estado === "guardado") {
    return (
      <div className="reporte-gracias" role="status">
        <p className="listo-texto">{t.reporteGracias}</p>
        {estado === "guardado" && <p className="suave chico-texto">{t.reporteGuardado}</p>}
      </div>
    );
  }

  return (
    <form className="form-reporte" onSubmit={enviar} noValidate>
      <p className="rotulo" id="r-tipo">{t.reporteTipo}</p>
      <div className="opciones-chip" role="radiogroup" aria-labelledby="r-tipo">
        {TIPOS.map((x, i) => (
          <button key={x} type="button" role="radio" aria-checked={tipo === x} className={tipo === x ? "elegido" : ""} onClick={() => (setTipo(x), setError(""))}>
            {t.reporteTipos[i]}
          </button>
        ))}
      </div>
      <label htmlFor="r-que">{t.reporteQue}</label>
      <textarea id="r-que" rows={3} maxLength={2000} value={que} placeholder={t.reporteQueAyuda} onChange={(e) => (setQue(e.target.value), setError(""))} />
      <label htmlFor="r-esperaba">{t.reporteEsperaba}</label>
      <textarea id="r-esperaba" rows={2} maxLength={2000} value={esperaba} onChange={(e) => setEsperaba(e.target.value)} />
      <label htmlFor="r-captura">{t.reporteCaptura}</label>
      <input
        id="r-captura"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return setCaptura(null);
          achicarCaptura(f).then(setCaptura, () => setError(t.reporteCapturaGrande));
        }}
      />
      {captura && <img src={captura} alt="" className="reporte-miniatura" />}
      <p className="suave chico-texto">{contexto.registro ? t.reporteAdjuntoJuego : t.reporteAdjunto}</p>
      {error && <p className="error">{error}</p>}
      <div className="botones">
        <button type="submit" className="primario" disabled={estado === "enviando"}>
          {estado === "enviando" ? t.enviando : t.reporteEnviar}
        </button>
        <button type="button" className="secundario" onClick={alTerminar}>
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}

/** Diálogo con el formulario (en el lobby). */
function DialogoReporte({ uid, nombre, inicial, alCerrar }: { uid: string | null; nombre: string; inicial?: string; alCerrar: () => void }) {
  const { t } = useIdioma();
  const ref = useRef<HTMLDialogElement>(null);
  const [contexto] = useState(contextoDelLobby);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialogo-reporte" onClose={alCerrar} aria-labelledby="t-reporte">
      <h2 id="t-reporte">{t.reporteTitulo}</h2>
      <FormReporte uid={uid} nombre={nombre} contexto={contexto} inicial={inicial} alTerminar={() => ref.current?.close()} />
    </dialog>
  );
}

/** Botón fijo «Reportar un problema» y el aviso cuando la página falla. */
export function Reportes({ uid, nombre }: { uid: string | null; nombre: string }) {
  const { t } = useIdioma();
  const [abierto, setAbierto] = useState<null | { inicial?: string }>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  useEffect(() => alFallar(setFallo), []);
  return (
    <>
      <button className="boton-reportar" onClick={() => setAbierto({})} aria-label={t.reporteTitulo} title={t.reporteTitulo}>
        ⚠️
      </button>
      {fallo && !abierto && (
        <div className="aviso-fallo" role="alert">
          <span>{t.reporteFallo}</span>
          <button className="primario chico" onClick={() => (setAbierto({ inicial: t.reporteFalloTexto }), setFallo(null))}>
            {t.reporteBoton}
          </button>
          <button className="enlace chico" onClick={() => setFallo(null)}>
            {t.ahoraNo}
          </button>
        </div>
      )}
      {abierto && <DialogoReporte uid={uid} nombre={nombre} inicial={abierto.inicial} alCerrar={() => setAbierto(null)} />}
    </>
  );
}

/**
 * /reportar: la abren los juegos en un marco encima de la partida. Pide al juego su contexto
 * (registro, versión, sala…) y avisa cuando termina para que el juego cierre el marco.
 */
export function PaginaReportar({ uid, nombre }: { uid: string | null; nombre: string }) {
  const { t } = useIdioma();
  const [contexto, setContexto] = useState<ContextoReporte | null>(null);
  const embebido = window.parent !== window;
  const origenPadre = useRef<string | null>(null);

  useEffect(() => {
    if (!embebido) {
      setContexto(contextoDelLobby());
      return;
    }
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin && !ORIGENES_JUEGOS.has(e.origin)) return;
      const d = e.data as { tipo?: string } & Partial<ContextoReporte>;
      if (d?.tipo !== "lobby:reporte-datos") return;
      origenPadre.current = e.origin;
      setContexto({
        juego: typeof d.juego === "string" ? d.juego.slice(0, 40) : null,
        version: typeof d.version === "string" ? d.version : null,
        donde: d.donde && typeof d.donde === "object" ? d.donde : {},
        registro: typeof d.registro === "string" ? d.registro : null,
        nombreRegistro: typeof d.nombreRegistro === "string" ? d.nombreRegistro : null,
        errores: Array.isArray(d.errores) ? d.errores.filter((x) => typeof x === "string").slice(-10) : [],
        nombre: typeof d.nombre === "string" ? d.nombre.slice(0, 40) : undefined,
      });
    };
    window.addEventListener("message", alRecibir);
    window.parent.postMessage({ tipo: "lobby:reporte-listo" }, "*");
    return () => window.removeEventListener("message", alRecibir);
  }, [embebido]);

  const cerrar = () => {
    if (embebido) window.parent.postMessage({ tipo: "lobby:reporte-cerrar" }, origenPadre.current ?? "*");
    else window.history.back();
  };

  return (
    <main className={`pagina-reporte ${embebido ? "embebida" : ""}`}>
      <div className="tarjeta">
        <h2>{t.reporteTitulo}</h2>
        {contexto ? (
          <FormReporte uid={uid} nombre={contexto.nombre ?? nombre} contexto={contexto} alTerminar={cerrar} />
        ) : (
          <p className="suave">{t.cargando}</p>
        )}
      </div>
    </main>
  );
}
