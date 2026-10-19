/**
 * Jugar en este celular: los juegos que funcionan sin internet. Aparece sola cuando no hay red
 * (la app instalada abre igual) y también se puede abrir desde el inicio (/en-este-celular).
 * Las partidas se juegan y se guardan solo en el celular: no pasan por las salas ni el perfil.
 */
import { useEffect, useState } from "react";
import { irA } from "../navegacion";
import { presenciaAlJugar } from "../firebase/amigos";
import { EnlaceReportar } from "./Reportar";
import { parametrosPreferencias } from "../preferencias";
import { useIdioma } from "../i18n";

interface JuegoLocal {
  id: string;
  nombre: string;
  url: string;
}

/** Vercel los sirve desde el sitio del lobby (ver vercel.json); el service worker los guarda. */
export const JUEGOS_LOCALES: JuegoLocal[] = [
  { id: "split-loyalty", nombre: "Split Loyalty", url: "/juegos/split-loyalty/index.html" },
  { id: "astrolabe", nombre: "Astrolabe", url: "/juegos/astrolabe/offline/index.html" },
  // Como carpeta: su sitio redirige /index.html a / (cleanUrls de Vercel).
  { id: "double-cross", nombre: "Split Loyalty: Double Cross", url: "/juegos/double-cross/" },
];

/** ¿Hay conexión? (lo que dice el navegador; se actualiza al perderla o recuperarla). */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);
  return enLinea;
}

/** Qué juegos ya están guardados en el celular (null: aún no se sabe o no hay service worker). */
function useGuardados() {
  const [guardados, setGuardados] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!("caches" in window)) return;
    let vivo = true;
    Promise.all(JUEGOS_LOCALES.map(async (j) => [j.id, Boolean(await caches.match(j.url.endsWith("/") ? j.url + "index.html" : j.url))] as const))
      .then((lista) => vivo && setGuardados(Object.fromEntries(lista)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return guardados;
}

/** Con conexión, pide al service worker que guarde (o ponga al día) los juegos. Como mucho cada 6 h. */
export function precargarJuegos() {
  if (!navigator.onLine || !("serviceWorker" in navigator)) return;
  try {
    const ultima = Number(localStorage.getItem("lobby_juegos_precargados") ?? 0);
    if (Date.now() - ultima < 6 * 3600_000) return;
    localStorage.setItem("lobby_juegos_precargados", String(Date.now()));
  } catch {
    /* sin almacenamiento: se pide igual */
  }
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage("precargar-juegos")).catch(() => {});
}

/** Lo que el juego necesita saber: que viene del lobby, el idioma y tu nombre (para no volver a pedirlo). */
function parametros(idioma: string) {
  let nombre = "";
  try {
    nombre = localStorage.getItem("lobby_nombre") ?? "";
  } catch {
    /* sin almacenamiento */
  }
  return new URLSearchParams({ desde: "lobby", idioma, ...(nombre ? { nombre: nombre.slice(0, 20) } : {}), ...parametrosPreferencias() }).toString();
}

export function SinConexion({ enLinea }: { enLinea: boolean }) {
  const { t, idioma } = useIdioma();
  const guardados = useGuardados();

  return (
    <main className="inicio sin-conexion">
      <header className="portada">
        <h1>{enLinea ? t.enEsteCelularTitulo : t.sinConexionTitulo}</h1>
        <p>{t.sinConexionTexto}</p>
      </header>
      <div className="juegos-locales">
        {JUEGOS_LOCALES.map((j) => {
          const falta = !enLinea && guardados !== null && !guardados[j.id];
          return (
            <section key={j.id} className="tarjeta juego-local">
              <h2>{j.nombre}</h2>
              <p className="suave">{t.juegoLocalTexto(j.id)}</p>
              {falta ? (
                <p className="chico-texto aviso-invitado">{t.juegoLocalFalta}</p>
              ) : (
                <button
                  className="primario"
                  onClick={async () => {
                    // Con conexión, tus amigos te ven «jugando …» (se espera un momento: al cambiar de página se pierde).
                    const aviso = enLinea ? presenciaAlJugar.publicar?.(j.nombre).catch(() => {}) : null;
                    if (aviso) await Promise.race([aviso, new Promise((ok) => setTimeout(ok, 800))]);
                    window.location.assign(`${j.url}?${parametros(idioma)}`);
                  }}
                >
                  {t.jugar}
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="suave chico-texto">{t.sinConexionNota}</p>
      <p>
        <EnlaceReportar />
      </p>
      {enLinea && (
        <button className="secundario" onClick={() => irA({ pantalla: "inicio" })}>
          ← {t.volverInicio}
        </button>
      )}
    </main>
  );
}
