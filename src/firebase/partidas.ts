/** Partidas dentro de una sala: invitar, responder, prepararse, lanzar y terminar. */
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Juego } from "../datos/catalogo";
import { db } from "./config";
import { generarCodigo } from "./salas";
import type { Invitado, Partida, Rol } from "./tipos";

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

/** El invitado acepta (como jugador o espectador) o rechaza. */
export async function responder(sala: string, id: string, uid: string, respuesta: "acepta" | "rechaza", rol: Rol) {
  await updateDoc(refPartida(sala, id), {
    [`invitados.${uid}.respuesta`]: respuesta,
    [`invitados.${uid}.rol`]: rol,
    [`invitados.${uid}.listo`]: false,
    [`invitados.${uid}.respondio`]: serverTimestamp(),
  });
}

export async function marcarListo(sala: string, id: string, uid: string, listo: boolean) {
  await updateDoc(refPartida(sala, id), { [`invitados.${uid}.listo`]: listo });
}

/** Solo quien creó la partida: quitar a alguien que no responde. */
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

export interface Preparacion {
  puede: boolean;
  motivo: string;
}

/** ¿Se puede lanzar ya? Si no, explica por qué. */
export function preparacion(p: Partida, juego: Juego): Preparacion {
  const jugadores = jugadoresAceptados(p);
  const n = jugadores.length;
  const { min, max } = juego.jugadores;
  if (n < min) return { puede: false, motivo: `Faltan jugadores: ${n} de al menos ${min}.` };
  if (n > max) return { puede: false, motivo: `Sobran jugadores: ${n}, el máximo es ${max}.` };
  const sinListo = Object.values(p.invitados).filter((i) => i.respuesta === "acepta" && !i.listo);
  if (sinListo.length) return { puede: false, motivo: `Esperando a: ${sinListo.map((i) => i.nombre).join(", ")}.` };
  return { puede: true, motivo: "Todos listos." };
}

/** Asigna asientos, genera el código de sala del juego y pasa a "jugando". */
export async function lanzar(sala: string, p: Partida) {
  const cambios: Record<string, unknown> = {
    estado: "jugando",
    iniciada: serverTimestamp(),
    codigoJuego: generarCodigo(),
  };
  jugadoresAceptados(p).forEach(([uid], asiento) => {
    cambios[`invitados.${uid}.asiento`] = asiento;
  });
  await updateDoc(refPartida(sala, p.id), cambios);
}

export async function terminar(sala: string, id: string) {
  await updateDoc(refPartida(sala, id), { estado: "terminada", terminada: serverTimestamp() });
}

export async function cancelar(sala: string, id: string) {
  await updateDoc(refPartida(sala, id), { estado: "cancelada", terminada: serverTimestamp() });
}
