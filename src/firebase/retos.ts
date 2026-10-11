/**
 * Retos en solitario con semilla: todos juegan exactamente la misma operación y comparan puntaje.
 *  - Reto del día: no tiene documento; su id y su semilla salen de la fecha, así es el mismo en
 *    todas las salas, y cada sala tiene su propio ranking.
 *  - Reto directo: alguien de la sala lo crea con una semilla al azar y lo juega primero.
 * Solo cuenta el primer intento de cada persona (la marca se escribe una vez y no se cambia).
 */
import { collection, doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import type { Juego } from "../datos/catalogo";
import { db } from "./config";
import { enviarMensaje, generarCodigo } from "./salas";
import type { ResultadoJuego, Reto } from "./tipos";

/** Fecha local "AAAA-MM-DD" (el reto del día cambia a medianoche de cada quien, como Wordle). */
export function fechaHoy(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

export function retoDiario(juego: Juego, fecha = fechaHoy()): Reto {
  return {
    id: `diario-${fecha}`,
    juego: juego.id,
    tipo: "diario",
    semilla: "D" + fecha.replace(/-/g, ""),
    variante: juego.retos?.variante ?? "",
    dificultad: juego.retos?.dificultad ?? "hard",
    creador: null,
    creadorNombre: "",
    creado: null,
  };
}

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function semillaAlAzar(): string {
  const azar = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(azar, (n) => LETRAS[n % LETRAS.length]).join("");
}

/** Prepara un reto directo nuevo. El id se genera aquí para poder abrir la pestaña del juego
 *  en el mismo clic (si no, el navegador la bloquea); luego se guarda con `guardarReto`. */
export function nuevoReto(sala: string, juego: Juego, uid: string, nombre: string): Reto {
  return {
    id: doc(collection(db, "salas", sala, "retos")).id,
    juego: juego.id,
    tipo: "directo",
    semilla: semillaAlAzar(),
    variante: juego.retos?.variante ?? "",
    dificultad: juego.retos?.dificultad ?? "hard",
    creador: uid,
    creadorNombre: nombre,
    creado: null,
  };
}

export async function guardarReto(sala: string, r: Reto) {
  await setDoc(doc(db, "salas", sala, "retos", r.id), {
    juego: r.juego,
    tipo: "directo",
    semilla: r.semilla,
    variante: r.variante,
    dificultad: r.dificultad,
    creador: r.creador,
    creadorNombre: r.creadorNombre,
    creado: serverTimestamp(),
  });
}

/** Enlace para jugar el reto (en solitario; el juego avisa el puntaje al terminar). */
export function enlaceReto(juego: Juego, sala: string, r: Reto, nombre: string, idioma: "es" | "en"): string | null {
  if (!juego.url) return null;
  const q = new URLSearchParams({
    lobby: "1",
    codigo: generarCodigo(), // solo identifica la pestaña; el reto no usa sala en línea
    asiento: "0",
    jugadores: "1",
    rol: "jugador",
    nombre,
    nombres: nombre.replace(/\|/g, "/"),
    idioma,
    variante: r.variante,
    lsala: sala,
    lpartida: `reto:${r.id}`,
    volver: `${window.location.origin}/s/${sala}`,
    reto: "1",
    semilla: r.semilla,
    dificultad: r.dificultad,
  });
  return `${juego.url}${juego.url.includes("?") ? "&" : "?"}${q}`;
}

/**
 * Guarda el primer intento de esta persona en el reto. Devuelve false si ya tenía marca.
 * Además deja un aviso en el chat de la sala para que el resto se entere.
 */
export async function guardarMarca(
  sala: string,
  retoId: string,
  uid: string,
  nombre: string,
  r: ResultadoJuego,
  aviso: string,
): Promise<boolean> {
  const puntaje = Number(r.puntajes?.["0"]);
  if (!Number.isFinite(puntaje)) return false;
  const ref = doc(db, "salas", sala, "retos", retoId, "marcas", uid);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(ref, {
    nombre,
    puntaje,
    version: typeof r.version === "string" ? r.version.slice(0, 40) : null,
    detalleJson: JSON.stringify(r.detalle ?? null).slice(0, 200_000),
    hora: serverTimestamp(),
  });
  await enviarMensaje(sala, uid, nombre, aviso).catch(() => {});
  return true;
}

/** Condecoraciones de un asiento: las que el juego informó en `logros`, o en su resumen. */
export function logrosDe(r: ResultadoJuego, asiento: number): string[] {
  const directos = r.logros?.[String(asiento)];
  if (Array.isArray(directos)) return directos.filter((x) => typeof x === "string").slice(0, 12);
  const jugadores = (r.detalle as { players?: { medals?: unknown }[] } | undefined)?.players;
  const m = Array.isArray(jugadores) ? jugadores[asiento]?.medals : null;
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
}

/** Suma una partida (o un reto) a la trayectoria de la persona. */
export async function sumarACarrera(uid: string, juego: string, opciones: { gano: boolean; reto: boolean; logros: string[] }) {
  const logros: Record<string, ReturnType<typeof increment>> = {};
  for (const id of opciones.logros) logros[`${juego}:${id}`] = increment(1);
  await setDoc(
    doc(db, "jugadores", uid),
    {
      carrera: {
        partidas: increment(1),
        ...(opciones.gano ? { victorias: increment(1) } : {}),
        ...(opciones.reto ? { retos: increment(1) } : {}),
        ...(opciones.logros.length ? { logros } : {}),
      },
    },
    { merge: true },
  );
}
