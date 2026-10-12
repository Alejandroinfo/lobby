/** Partidas dentro de una sala: invitar, responder, prepararse, lanzar y terminar. */
import { addDoc, collection, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Juego } from "../datos/catalogo";
import { db } from "./config";
import { generarCodigo, latido } from "./salas";
import type { Invitado, Partida, ResultadoJuego, Rol } from "./tipos";

const refPartida = (sala: string, id: string) => doc(db, "salas", sala, "partidas", id);

export interface Invitacion {
  uid: string;
  nombre: string;
  rol: Rol;
}

/** Crea la partida. Quien la crea queda aceptado y listo; los demás, pendientes. */
export async function crearPartida(
  sala: string,
  creador: string,
  juego: Juego,
  variante: string | null,
  invitaciones: Invitacion[],
  nivel?: "hard" | "easy",
): Promise<string> {
  const invitados: Record<string, Record<string, unknown>> = {};
  for (const inv of invitaciones) {
    const soyYo = inv.uid === creador;
    invitados[inv.uid] = {
      nombre: inv.nombre,
      rol: inv.rol,
      respuesta: soyYo ? "acepta" : "pendiente",
      listo: soyYo,
      respondio: soyYo ? serverTimestamp() : null,
      asiento: null,
    };
  }
  const ref = await addDoc(collection(db, "salas", sala, "partidas"), {
    juego: juego.id,
    variante,
    ...(nivel ? { nivel } : {}),
    anfitrion: creador,
    estado: "invitando",
    invitados,
    codigoJuego: null,
    creada: serverTimestamp(),
    iniciada: null,
    terminada: null,
  });
  return ref.id;
}

/**
 * Partida en solitario contra la máquina: se crea y se lanza de una vez (no hay a quién esperar).
 * Queda en la lista de la sala, con su resultado, como cualquier partida.
 */
export async function crearPartidaSolo(sala: string, yo: { uid: string; nombre: string }, juego: Juego, variante: string | null, nivel: "hard" | "easy") {
  const id = await crearPartida(sala, yo.uid, juego, variante, [{ uid: yo.uid, nombre: yo.nombre, rol: "jugador" }], nivel);
  const codigoJuego = generarCodigo();
  await updateDoc(refPartida(sala, id), {
    estado: "jugando",
    iniciada: serverTimestamp(),
    codigoJuego,
    [`invitados.${yo.uid}.asiento`]: 0,
  });
  return { id, codigoJuego };
}

/** Id de la partida número `ronda` de una serie de «Jugar de nuevo» (la 1 es la original). */
export const idRonda = (base: string, ronda: number) => (ronda > 1 ? `${base}-r${ronda}` : base);

/**
 * «Jugar de nuevo» dentro del juego: la partida siguiente, con los mismos jugadores, asientos y
 * opciones, ya en juego. La crea el primero que se entera (cualquiera de los jugadores); si ya
 * existe, la devuelve. Así cuenta en la sala, el historial y el perfil como cualquier partida.
 */
export async function asegurarRonda(sala: string, base: string, ronda: number, codigoJuego?: string | null): Promise<Partida | null> {
  if (!Number.isInteger(ronda) || ronda < 2 || ronda > 500 || !/^[A-Za-z0-9]{1,40}$/.test(base)) return null;
  const ref = refPartida(sala, idRonda(base, ronda));
  return runTransaction(db, async (tx) => {
    const ya = await tx.get(ref);
    if (ya.exists()) return { id: ref.id, ...(ya.data() as Omit<Partida, "id">) };
    const b = await tx.get(refPartida(sala, base));
    if (!b.exists()) return null;
    const d = b.data() as Omit<Partida, "id">;
    const invitados = Object.fromEntries(
      Object.entries(d.invitados)
        .filter(([, i]) => i.respuesta === "acepta")
        .map(([u, i]) => [
          u,
          {
            nombre: i.nombre,
            rol: i.rol,
            respuesta: "acepta",
            listo: true,
            respondio: i.respondio ?? null,
            asiento: i.asiento ?? null,
            ...(i.equipo !== undefined ? { equipo: i.equipo } : {}),
          },
        ]),
    );
    const nueva = {
      juego: d.juego,
      variante: d.variante ?? null,
      ...(d.nivel ? { nivel: d.nivel } : {}),
      ...(d.equipos ? { equipos: d.equipos } : {}),
      anfitrion: d.anfitrion,
      estado: "jugando",
      invitados,
      codigoJuego: codigoJuego && /^[A-Z0-9]{4,8}$/.test(codigoJuego) ? codigoJuego : d.codigoJuego,
      creada: serverTimestamp(),
      iniciada: serverTimestamp(),
      terminada: null,
      revanchaDe: base,
      ronda,
    };
    tx.set(ref, nueva);
    return { id: ref.id, ...(nueva as unknown as Omit<Partida, "id">) };
  });
}

/** El invitado acepta (como jugador o espectador) o rechaza. */
export async function responder(sala: string, id: string, uid: string, respuesta: "acepta" | "rechaza", rol: Rol) {
  latido(sala, uid).catch(() => {}); // quien responde está aquí
  await updateDoc(refPartida(sala, id), {
    [`invitados.${uid}.respuesta`]: respuesta,
    [`invitados.${uid}.rol`]: rol,
    [`invitados.${uid}.listo`]: false,
    [`invitados.${uid}.respondio`]: serverTimestamp(),
  });
}

export async function marcarListo(sala: string, id: string, uid: string, listo: boolean) {
  latido(sala, uid).catch(() => {}); // quien marca "listo" está aquí
  await updateDoc(refPartida(sala, id), { [`invitados.${uid}.listo`]: listo });
}

/** Solo quien creó la partida: quitar a alguien que no responde o que se desconectó. */
export async function quitarInvitado(sala: string, id: string, uid: string) {
  await updateDoc(refPartida(sala, id), { [`invitados.${uid}`]: deleteField() });
}

/** Jugadores que aceptaron, en orden de asiento: primero quien creó la partida, luego por hora de respuesta. */
export function jugadoresAceptados(p: Partida): [string, Invitado][] {
  return Object.entries(p.invitados)
    .filter(([, i]) => i.respuesta === "acepta" && i.rol === "jugador")
    .sort(([a, x], [b, y]) => {
      if (a === p.anfitrion) return -1;
      if (b === p.anfitrion) return 1;
      return (x.respondio?.toMillis() ?? 0) - (y.respondio?.toMillis() ?? 0);
    });
}

/** ¿Esta partida se juega en equipos? (depende del juego y de cuántos jugadores aceptaron). */
export function usaEquipos(p: Partida, juego: Juego): boolean {
  return Boolean(juego.equiposCon?.includes(jugadoresAceptados(p).length));
}

/** Equipos elegidos a mano válidos: todos los jugadores asignados y la misma cantidad en cada equipo. */
function equiposManualesValidos(p: Partida): boolean {
  const jugadores = jugadoresAceptados(p);
  const de = p.equipos?.de ?? {};
  const enEquipo0 = jugadores.filter(([uid]) => de[uid] === 0).length;
  const enEquipo1 = jugadores.filter(([uid]) => de[uid] === 1).length;
  return enEquipo0 + enEquipo1 === jugadores.length && enEquipo0 === enEquipo1;
}

export async function definirEquipos(sala: string, id: string, modo: "azar" | "manual", de: Record<string, 0 | 1> = {}) {
  await updateDoc(refPartida(sala, id), { equipos: modo === "azar" ? { modo } : { modo, de } });
}

/** Si quien creó la partida se desconecta, otro jugador que aceptó puede tomar el control. */
export async function tomarControl(sala: string, id: string, uid: string) {
  await updateDoc(refPartida(sala, id), { anfitrion: uid });
}

export type Motivo =
  | { tipo: "faltan"; n: number; min: number }
  | { tipo: "sobran"; n: number; max: number }
  | { tipo: "desconectados"; nombres: string[] }
  | { tipo: "esperando"; nombres: string[] }
  | { tipo: "equipos"; mitad: number }
  | { tipo: "listos" }
  | { tipo: "desconocido" };

export interface Preparacion {
  puede: boolean;
  motivo: Motivo;
  /** Todo listo salvo que alguien parece desconectado: quien organiza puede empezar igual. */
  forzable?: boolean;
}

/**
 * ¿Se puede lanzar ya? Si no, explica por qué (la interfaz lo traduce).
 * `conectado(uid)` dice si esa persona sigue con el lobby abierto.
 */
export function preparacion(p: Partida, juego: Juego, conectado: (uid: string) => boolean): Preparacion {
  const jugadores = jugadoresAceptados(p);
  const n = jugadores.length;
  const { max } = juego.jugadores;
  // En solitario (contra la máquina) basta con una persona.
  const min = p.nivel && juego.solo ? 1 : juego.jugadores.min;
  if (n < min) return { puede: false, motivo: { tipo: "faltan", n, min } };
  if (n > max) return { puede: false, motivo: { tipo: "sobran", n, max } };
  const aceptados = Object.entries(p.invitados).filter(([, i]) => i.respuesta === "acepta");
  const sinListo = aceptados.filter(([, i]) => !i.listo).map(([, i]) => i.nombre);
  if (sinListo.length) return { puede: false, motivo: { tipo: "esperando", nombres: sinListo } };
  if (usaEquipos(p, juego) && p.equipos?.modo === "manual" && !equiposManualesValidos(p)) {
    return { puede: false, motivo: { tipo: "equipos", mitad: n / 2 } };
  }
  // Todos marcaron "listo" (así que estuvieron aquí). Si alguien parece desconectado puede ser un
  // celular que congeló la pestaña o una señal que tarda: se avisa, pero no impide empezar.
  const ausentes = aceptados.filter(([uid]) => !conectado(uid)).map(([, i]) => i.nombre);
  if (ausentes.length) return { puede: false, forzable: true, motivo: { tipo: "desconectados", nombres: ausentes } };
  return { puede: true, motivo: { tipo: "listos" } };
}

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  const azar = crypto.getRandomValues(new Uint32Array(copia.length));
  for (let i = copia.length - 1; i > 0; i--) {
    const j = azar[i] % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Orden de asientos al lanzar. En juegos por equipos, el equipo 0 ocupa los asientos pares
 * (1.º y 3.º) y el equipo 1 los impares (2.º y 4.º), como espera Astrolabe.
 */
export function ordenDeAsientos(p: Partida, juego: Juego): { uid: string; equipo?: 0 | 1 }[] {
  const jugadores = jugadoresAceptados(p).map(([uid]) => uid);
  if (!usaEquipos(p, juego)) return jugadores.map((uid) => ({ uid }));
  const de = p.equipos?.modo === "manual" && equiposManualesValidos(p) ? p.equipos.de! : null;
  const mezcla = de ? jugadores : barajar(jugadores);
  const equipo0 = de ? mezcla.filter((u) => de[u] === 0) : mezcla.slice(0, mezcla.length / 2);
  const equipo1 = de ? mezcla.filter((u) => de[u] === 1) : mezcla.slice(mezcla.length / 2);
  return equipo0.flatMap((u, k) => [
    { uid: u, equipo: 0 as const },
    { uid: equipo1[k], equipo: 1 as const },
  ]);
}

/** Asigna asientos, genera el código de sala del juego y pasa a "jugando". */
export async function lanzar(sala: string, p: Partida, juego: Juego) {
  const cambios: Record<string, unknown> = {
    estado: "jugando",
    iniciada: serverTimestamp(),
    codigoJuego: generarCodigo(),
  };
  ordenDeAsientos(p, juego).forEach(({ uid, equipo }, asiento) => {
    cambios[`invitados.${uid}.asiento`] = asiento;
    if (equipo !== undefined) cambios[`invitados.${uid}.equipo`] = equipo;
  });
  await updateDoc(refPartida(sala, p.id), cambios);
}

export async function terminar(sala: string, id: string) {
  await updateDoc(refPartida(sala, id), { estado: "terminada", terminada: serverTimestamp() });
}

export async function cancelar(sala: string, id: string) {
  await updateDoc(refPartida(sala, id), { estado: "cancelada", terminada: serverTimestamp() });
}

/**
 * Enlace con el que cada persona abre el juego (parámetros que entiende el lobby-puente del juego).
 * `volver` es la sala del lobby: el juego regresa ahí al terminar.
 */
export function enlaceJuego(juego: Juego, sala: string, p: Partida, uid: string, idioma: "es" | "en"): string | null {
  const yo = p.invitados[uid];
  if (!juego.url || !p.codigoJuego || !yo || yo.respuesta !== "acepta") return null;
  const jugadores = Object.values(p.invitados)
    .filter((i) => i.respuesta === "acepta" && i.rol === "jugador" && i.asiento !== null)
    .sort((a, b) => (a.asiento ?? 0) - (b.asiento ?? 0));
  const q = new URLSearchParams({
    lobby: "1",
    codigo: p.codigoJuego,
    asiento: String(yo.rol === "jugador" ? (yo.asiento ?? 0) : 0),
    jugadores: String(jugadores.length),
    rol: yo.rol,
    nombre: yo.nombre,
    nombres: jugadores.map((i) => i.nombre.replace(/\|/g, "/")).join("|"),
    idioma,
    variante: p.variante ?? "",
    lsala: sala,
    // Una partida de «Jugar de nuevo» se abre como la original más su número: así la siguiente
    // revancha sigue la misma serie.
    lpartida: p.revanchaDe ?? p.id,
    ...(p.ronda && p.ronda > 1 ? { ronda: String(p.ronda) } : {}),
    volver: `${window.location.origin}/s/${sala}`,
    ...(p.nivel ? { dificultad: p.nivel, solo: "1" } : {}),
  });
  return `${juego.url}${juego.url.includes("?") ? "&" : "?"}${q}`;
}

/**
 * Guarda el resultado que informó el juego (uno por persona) y, si la partida seguía en juego,
 * la da por terminada con ese resultado.
 */
export async function guardarResultado(sala: string, id: string, uid: string, asiento: number, r: ResultadoJuego): Promise<boolean> {
  const ganadores = Array.isArray(r.ganadores) ? r.ganadores.filter((n) => Number.isInteger(n)).slice(0, 8) : [];
  const puntajes: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.puntajes ?? {})) if (typeof v === "number" && Number.isFinite(v)) puntajes[k] = v;
  const refRes = doc(db, "salas", sala, "partidas", id, "resultados", uid);
  if ((await getDoc(refRes)).exists()) return false; // ya guardado (p. ej. llegó por mensaje y por enlace)
  await setDoc(refRes, {
    asiento,
    ganadores,
    puntajes,
    duracionSeg: typeof r.duracionSeg === "number" ? r.duracionSeg : null,
    version: typeof r.version === "string" ? r.version.slice(0, 40) : null,
    detalleJson: JSON.stringify(r.detalle ?? null).slice(0, 200_000),
    recibido: serverTimestamp(),
  });
  const partida = await getDoc(refPartida(sala, id));
  if (partida.exists() && partida.data().estado === "jugando") {
    await updateDoc(refPartida(sala, id), {
      estado: "terminada",
      terminada: serverTimestamp(),
      resultado: { ganadores, puntajes },
    });
  }
  return true;
}
