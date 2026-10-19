/**
 * Partidas jugadas en «Jugar en este celular» (también sin internet). Los juegos se sirven desde
 * el mismo sitio del lobby (/juegos/…), así que comparten su localStorage: al terminar, guardan el
 * resultado en `lobby_resultados_locales`. Con conexión, el lobby los suma a tu perfil (carrera,
 * estadísticas, medallas e historial) y los quita de la lista.
 *
 * Formato de cada entrada (lo escriben Split Loyalty en app/index.html y Astrolabe en
 * src/lobby/RegistroLocal.tsx):
 *   { id, juego, variante, solo, jugadores, asiento, nombres, fecha, resultado: ResultadoJuego }
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config";
import { registrarEnHistorial, sumarAlPerfil } from "./perfil";
import { logrosDe } from "./retos";
import type { ResultadoJuego } from "./tipos";

export const CLAVE_RESULTADOS_LOCALES = "lobby_resultados_locales";
const JUEGOS = new Set(["split-loyalty", "astrolabe", "double-cross"]);

export interface ResultadoLocal {
  id: string;
  juego: string;
  variante: string | null;
  /** Contra la máquina (sin empates: ganas o no). */
  solo: boolean;
  /** Cuántos jugaron (para saber si fue empate de todos). */
  jugadores: number;
  /** Tu asiento (en una mesa compartida, el que tiene tu nombre). */
  asiento: number;
  nombres: string[];
  fecha: number;
  resultado: ResultadoJuego;
}

function leer(): ResultadoLocal[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_RESULTADOS_LOCALES) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function quitar(id: string) {
  try {
    localStorage.setItem(CLAVE_RESULTADOS_LOCALES, JSON.stringify(leer().filter((e) => e.id !== id)));
  } catch {
    /* sin almacenamiento */
  }
}

const valido = (e: ResultadoLocal) =>
  e &&
  typeof e.id === "string" &&
  /^[A-Za-z0-9_-]{1,60}$/.test(e.id) &&
  JUEGOS.has(e.juego) &&
  Number.isInteger(e.asiento) &&
  Array.isArray(e.resultado?.ganadores);

let subiendo = false;

/** Suma a tu perfil las partidas jugadas en este celular que aún no se subieron. Devuelve cuántas. */
export async function subirResultadosLocales(uid: string): Promise<number> {
  if (subiendo) return 0;
  subiendo = true;
  let subidas = 0;
  try {
    for (const e of leer()) {
      if (!valido(e)) {
        quitar(e?.id);
        continue;
      }
      const idHistorial = `local-${e.id}`;
      // Ya estaba (se cortó justo después de subirla): no se cuenta dos veces.
      if ((await getDoc(doc(db, "jugadores", uid, "historial", idHistorial))).exists()) {
        quitar(e.id);
        continue;
      }
      const r = e.resultado;
      const empate = !e.solo && r.ganadores.length >= Math.max(1, e.jugadores);
      const gano = r.ganadores.includes(e.asiento) && !empate;
      const p = r.puntajes?.[String(e.asiento)];
      const puntaje = typeof p === "number" && Number.isFinite(p) ? p : null;
      await sumarAlPerfil(uid, {
        juego: e.juego,
        tipo: "partida",
        gano,
        empate,
        puntaje,
        logros: logrosDe(r, e.asiento),
        jugadores: [], // en una mesa compartida los demás no tienen cuenta: no hay récord contra ellos
      });
      await registrarEnHistorial(uid, idHistorial, {
        tipo: "partida",
        juego: e.juego,
        sala: "",
        gano,
        empate,
        puntaje,
        variante: typeof e.variante === "string" ? e.variante.slice(0, 40) : null,
        jugadores: (e.nombres ?? []).slice(0, 12).map((nombre, i) => ({
          uid: i === e.asiento ? uid : "",
          nombre: String(nombre).slice(0, 24),
          gano: r.ganadores.includes(i) && !empate,
        })),
      });
      quitar(e.id);
      subidas++;
    }
  } catch (err) {
    console.warn("No se pudieron subir las partidas jugadas en este celular (se reintentará)", err);
  } finally {
    subiendo = false;
  }
  return subidas;
}
