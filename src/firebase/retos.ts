/**
 * Retos en solitario con semilla: todos juegan exactamente la misma operación y comparan puntaje.
 *  - Reto del día: el mismo para todos. Las marcas se guardan una sola vez por persona y por día
 *    en `retosDiarios/{fecha}/marcas/{uid}`: el ranking global las muestra todas y cada sala
 *    muestra las de sus miembros. Así nadie juega el reto "en serio" dos veces.
 *  - Reto directo: alguien de la sala lo crea con una semilla al azar y lo juega primero.
 * Solo cuenta el primer intento de cada persona (la marca se escribe una vez y no se cambia).
 */
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type { Juego } from "../datos/catalogo";
import { db } from "./config";
import { enviarMensaje, generarCodigo } from "./salas";
import type { FilaRanking, Marca, ResultadoJuego, ResumenDia, Reto } from "./tipos";

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Fecha local "AAAA-MM-DD" (el reto del día cambia a medianoche de cada quien, como Wordle). */
export function fechaHoy(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** La fecha de `n` días antes de `fecha` ("AAAA-MM-DD"). */
export function diasAntes(fecha: string, n: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return fechaHoy(new Date(a, m - 1, d - n));
}

/**
 * Semilla del reto del día. Desde el 12 de octubre de 2026 no es la fecha a la vista, para que
 * no se pueda practicar el reto de mañana escribiendo su código en el modo Solo.
 */
export function semillaDiaria(fecha: string): string {
  if (fecha <= "2026-10-11") return "D" + fecha.replace(/-/g, "");
  let h = 0x811c9dc5;
  for (const c of `split-loyalty|${fecha}|operacion-del-dia`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += LETRAS[h % LETRAS.length];
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return "D" + s;
}

export function retoDiario(juego: Juego, fecha = fechaHoy()): Reto {
  return {
    id: `diario-${fecha}`,
    juego: juego.id,
    tipo: "diario",
    semilla: semillaDiaria(fecha),
    variante: juego.retos?.variante ?? "",
    dificultad: juego.retos?.dificultad ?? "hard",
    creador: null,
    creadorNombre: "",
    creado: null,
  };
}

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
  const fecha = retoId.startsWith("diario-") ? retoId.slice(7) : null;
  const ref = fecha ? refMarcaDiaria(fecha, uid) : doc(db, "salas", sala, "retos", retoId, "marcas", uid);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(ref, {
    nombre,
    puntaje,
    version: typeof r.version === "string" ? r.version.slice(0, 40) : null,
    detalleJson: JSON.stringify(r.detalle ?? null).slice(0, 200_000),
    hora: serverTimestamp(),
    ...(fecha ? { sala } : {}),
  });
  // Reto del día: tu fila en el resumen del día (el ranking completo en un solo documento).
  if (fecha) await setDoc(refResumenDia(fecha), { jugadores: { [uid]: { n: nombre, p: puntaje } } }, { merge: true });
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

// ── Reto del día: marcas globales e historial ──────────────────────────────────

export const refMarcaDiaria = (fecha: string, uid: string) => doc(db, "retosDiarios", fecha, "marcas", uid);
/** `retosDiarios/{fecha}`: el ranking del día en un documento. Leer el ranking cuesta 1 lectura. */
export const refResumenDia = (fecha: string) => doc(db, "retosDiarios", fecha);

/** Filas del ranking de un resumen del día, de mayor a menor. */
export function filasResumen(r: ResumenDia | undefined | null): FilaRanking[] {
  return Object.entries(r?.jugadores ?? {})
    .map(([uid, j]) => ({ uid, nombre: j.n, puntaje: j.p }))
    .sort((a, b) => b.puntaje - a.puntaje || a.nombre.localeCompare(b.nombre));
}

/** El ranking de un día ya pasado (1 lectura). */
export async function rankingDelDia(fecha: string): Promise<FilaRanking[]> {
  const d = await getDoc(refResumenDia(fecha));
  return filasResumen(d.exists() ? (d.data() as ResumenDia) : null);
}
export const coleccionMarcasDiarias = (fecha: string) => collection(db, "retosDiarios", fecha, "marcas");

export function ordenarMarcas(lista: Marca[]): Marca[] {
  return [...lista].sort((a, b) => b.puntaje - a.puntaje || (a.hora?.toMillis() ?? Infinity) - (b.hora?.toMillis() ?? Infinity));
}

/** Todas las marcas del reto de un día (global), de mayor a menor. */
export async function marcasDelDia(fecha: string): Promise<Marca[]> {
  const snap = await getDocs(coleccionMarcasDiarias(fecha));
  return ordenarMarcas(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Marca, "uid">) })));
}

/**
 * Pone al día lo guardado con versiones anteriores, para hoy y ayer:
 *  - una marca del reto del día guardada dentro de la sala pasa a la marca global;
 *  - una marca global sin fila en el resumen del día (o en tu perfil) se agrega.
 * Cuesta unas pocas lecturas al abrir la sala.
 */
export async function ponerAlDiaMarcaDiaria(sala: string, fecha: string, uid: string, retosPropios: Record<string, number> | undefined) {
  const global = refMarcaDiaria(fecha, uid);
  let marca = await getDoc(global);
  if (!marca.exists()) {
    const vieja = await getDoc(doc(db, "salas", sala, "retos", `diario-${fecha}`, "marcas", uid));
    if (!vieja.exists()) return;
    const d = vieja.data() as Omit<Marca, "uid">;
    await setDoc(global, { nombre: d.nombre, puntaje: d.puntaje, version: d.version ?? null, detalleJson: d.detalleJson ?? "null", hora: serverTimestamp(), sala });
    marca = await getDoc(global);
  }
  const m = marca.data() as Omit<Marca, "uid">;
  const resumen = await getDoc(refResumenDia(fecha));
  if (!(resumen.data() as ResumenDia | undefined)?.jugadores?.[uid]) {
    await setDoc(refResumenDia(fecha), { jugadores: { [uid]: { n: m.nombre, p: m.puntaje } } }, { merge: true });
  }
  if (retosPropios && retosPropios[fecha] === undefined) {
    await setDoc(doc(db, "jugadores", uid), { retosDiarios: { [fecha]: m.puntaje } }, { merge: true });
  }
}
