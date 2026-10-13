/**
 * Amigos: solicitudes, código de amigo, presencia (en línea / en qué sala) e invitaciones a sala.
 *
 *  codigosAmigo/{codigo}            → { uid }                       (para agregar con un código)
 *  solicitudes/{para}/de/{de}       → { nombre, avatar, hora }       (solicitud pendiente)
 *  jugadores/{uid}/amigos/{amigo}   → { nombre, avatar, desde }      (cada lado guarda su lista)
 *  presencia/{uid}                  → { nombre, avatar, sala, nombreSala, jugando, ultimaVez } (solo la ven tus amigos)
 *  invitaciones/{para}/de/{de}      → { nombre, avatar, sala, nombreSala, hora } (solo entre amigos)
 */
import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { pedirAviso } from "./avisos";
import type { Avatar } from "./tipos";

export interface Amigo {
  uid: string;
  nombre: string;
  avatar?: Avatar;
  desde: Timestamp | null;
}
export interface Solicitud {
  uid: string;
  nombre: string;
  avatar?: Avatar;
  hora: Timestamp | null;
}
export interface Presencia {
  nombre: string;
  avatar?: Avatar;
  sala: string | null;
  nombreSala: string | null;
  /** Nombre del juego que está jugando (desde una sala). */
  jugando?: string | null;
  ultimaVez: Timestamp | null;
}
export interface Invitacion {
  uid: string;
  nombre: string;
  avatar?: Avatar;
  sala: string;
  nombreSala: string;
  hora: Timestamp | null;
}

/** Cuánto tiempo sin señales para dejar de mostrar a alguien "en línea". */
export const EN_LINEA_MS = 5 * 60_000;
/** Cada cuánto se renueva tu presencia mientras el lobby está abierto. */
export const LATIDO_PRESENCIA_MS = 3 * 60_000;

// ── Código de amigo ────────────────────────────────────────────────────────────

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const normalizarCodigoAmigo = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export const formatoCodigoAmigo = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

/** Tu código de amigo (se crea la primera vez). Se guarda también en tu perfil. */
export async function obtenerCodigoAmigo(uid: string, actual: string | undefined): Promise<string> {
  if (actual) return actual;
  for (let intento = 0; intento < 5; intento++) {
    const azar = crypto.getRandomValues(new Uint32Array(8));
    const codigo = Array.from(azar, (n) => LETRAS[n % LETRAS.length]).join("");
    const ref = doc(db, "codigosAmigo", codigo);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, { uid });
    await setDoc(doc(db, "jugadores", uid), { codigoAmigo: codigo }, { merge: true });
    return codigo;
  }
  throw new Error("No se pudo crear el código");
}

export async function uidDeCodigo(codigo: string): Promise<string | null> {
  const d = await getDoc(doc(db, "codigosAmigo", normalizarCodigoAmigo(codigo)));
  return d.exists() ? (d.data() as { uid: string }).uid : null;
}

// ── Solicitudes ────────────────────────────────────────────────────────────────

export type ResultadoSolicitud = "enviada" | "aceptada" | "ya-amigos" | "eres-tu";

/**
 * Pide amistad a `para`. Si esa persona ya te había pedido amistad a ti, se aceptan las dos
 * de una vez (así nadie queda esperando).
 */
export async function pedirAmistad(yo: { uid: string; nombre: string; avatar?: Avatar }, para: string): Promise<ResultadoSolicitud> {
  if (para === yo.uid) return "eres-tu";
  if ((await getDoc(doc(db, "jugadores", yo.uid, "amigos", para))).exists()) return "ya-amigos";
  const inversa = await getDoc(doc(db, "solicitudes", yo.uid, "de", para));
  if (inversa.exists()) {
    const s = inversa.data() as Omit<Solicitud, "uid">;
    await aceptarSolicitud(yo, { uid: para, nombre: s.nombre, avatar: s.avatar, hora: null });
    return "aceptada";
  }
  await setDoc(doc(db, "solicitudes", para, "de", yo.uid), {
    nombre: yo.nombre,
    ...(yo.avatar ? { avatar: yo.avatar } : {}),
    hora: serverTimestamp(),
  });
  pedirAviso({ tipo: "solicitud", de: yo.uid, para });
  return "enviada";
}

/** Acepta: cada uno queda en la lista del otro y la solicitud se borra (todo junto). */
export async function aceptarSolicitud(yo: { uid: string; nombre: string; avatar?: Avatar }, s: Solicitud) {
  const lote = writeBatch(db);
  lote.set(doc(db, "jugadores", yo.uid, "amigos", s.uid), { nombre: s.nombre, ...(s.avatar ? { avatar: s.avatar } : {}), desde: serverTimestamp() });
  lote.set(doc(db, "jugadores", s.uid, "amigos", yo.uid), { nombre: yo.nombre, ...(yo.avatar ? { avatar: yo.avatar } : {}), desde: serverTimestamp() });
  lote.delete(doc(db, "solicitudes", yo.uid, "de", s.uid));
  await lote.commit();
}

export async function rechazarSolicitud(yo: string, de: string) {
  await deleteDoc(doc(db, "solicitudes", yo, "de", de));
}

export async function cancelarSolicitud(yo: string, para: string) {
  await deleteDoc(doc(db, "solicitudes", para, "de", yo));
}

/** Quita la amistad de los dos lados. */
export async function quitarAmigo(yo: string, amigo: string) {
  const lote = writeBatch(db);
  lote.delete(doc(db, "jugadores", yo, "amigos", amigo));
  lote.delete(doc(db, "jugadores", amigo, "amigos", yo));
  await lote.commit();
}

/** ¿Hay una solicitud tuya pendiente hacia `para`? (para mostrar «Solicitud enviada»). */
export async function solicitudEnviada(yo: string, para: string): Promise<boolean> {
  return (await getDoc(doc(db, "solicitudes", para, "de", yo)).catch(() => null))?.exists() ?? false;
}

// ── Presencia ──────────────────────────────────────────────────────────────────

export async function publicarPresencia(
  uid: string,
  p: { nombre: string; avatar?: Avatar; sala: string | null; nombreSala: string | null; jugando?: string | null },
) {
  await setDoc(doc(db, "presencia", uid), {
    nombre: p.nombre,
    ...(p.avatar ? { avatar: p.avatar } : {}),
    sala: p.sala,
    nombreSala: p.nombreSala,
    jugando: p.jugando?.slice(0, 40) ?? null,
    ultimaVez: serverTimestamp(),
  });
}

export function enLinea(p: Presencia | null | undefined, ahora = Date.now()): boolean {
  return Boolean(p?.ultimaVez && ahora - p.ultimaVez.toMillis() < EN_LINEA_MS);
}

/** Mientras juega, el lobby deja de avisar (pestaña en segundo plano o cerrada): lo último que dijo vale 4 h. */
const JUGANDO_MS = 4 * 3600_000;
export function jugandoAhora(p: Presencia | null | undefined, ahora = Date.now()): string | null {
  return p?.jugando && p.ultimaVez && ahora - p.ultimaVez.toMillis() < JUGANDO_MS ? p.jugando : null;
}

/**
 * Avisar a tus amigos «estoy jugando X» justo al abrir un juego (lo usa abrirJuego antes de dejar
 * el lobby). Lo conecta SocialProvider; sin amigos no hace nada.
 */
export const presenciaAlJugar: { publicar: ((juego: string) => Promise<void>) | null } = { publicar: null };

// ── Invitaciones a sala ────────────────────────────────────────────────────────

export async function invitarASala(yo: { uid: string; nombre: string; avatar?: Avatar }, amigo: string, sala: string, nombreSala: string) {
  await setDoc(doc(db, "invitaciones", amigo, "de", yo.uid), {
    nombre: yo.nombre,
    ...(yo.avatar ? { avatar: yo.avatar } : {}),
    sala,
    nombreSala: nombreSala.slice(0, 40),
    hora: serverTimestamp(),
  });
  pedirAviso({ tipo: "sala", de: yo.uid, para: amigo, sala });
}

export async function descartarInvitacion(yo: string, de: string) {
  await deleteDoc(doc(db, "invitaciones", yo, "de", de));
}

// ── Escuchas ───────────────────────────────────────────────────────────────────

function useColeccion<T>(ruta: string[] | null) {
  const [lista, setLista] = useState<T[] | null>(null);
  const clave = ruta?.join("/") ?? "";
  useEffect(() => {
    if (!ruta) return;
    return onSnapshot(
      collection(db, ruta[0], ...ruta.slice(1)),
      (snap) => setLista(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as object) }) as T)),
      () => setLista([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return lista;
}

export const useAmigos = (uid: string | null) => useColeccion<Amigo>(uid ? ["jugadores", uid, "amigos"] : null);
export const useSolicitudes = (uid: string | null) => useColeccion<Solicitud>(uid ? ["solicitudes", uid, "de"] : null);
export const useInvitacionesASala = (uid: string | null) => useColeccion<Invitacion>(uid ? ["invitaciones", uid, "de"] : null);

/** Presencia de tus amigos (una escucha por amigo; solo mientras la lista está a la vista). */
export function usePresencias(uids: string[], activo: boolean) {
  const [mapa, setMapa] = useState<Record<string, Presencia | null>>({});
  const clave = [...uids].sort().join(",");
  useEffect(() => {
    if (!activo || !uids.length) return;
    const bajas = uids.map((u) =>
      onSnapshot(
        doc(db, "presencia", u),
        (d) => setMapa((m) => ({ ...m, [u]: d.exists() ? (d.data() as Presencia) : null })),
        () => setMapa((m) => ({ ...m, [u]: null })),
      ),
    );
    return () => bajas.forEach((b) => b());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo]);
  return mapa;
}

// ── Borrar mis datos ───────────────────────────────────────────────────────────

/** Quita tus amistades (de los dos lados), solicitudes, invitaciones, presencia y código. */
export async function borrarDatosSociales(uid: string, codigo: string | undefined) {
  const amigos = await getDocs(collection(db, "jugadores", uid, "amigos")).catch(() => null);
  await Promise.all((amigos?.docs ?? []).map((d) => quitarAmigo(uid, d.id).catch(() => {})));
  for (const ruta of [["solicitudes", uid, "de"], ["invitaciones", uid, "de"]]) {
    const s = await getDocs(collection(db, ruta[0], ...ruta.slice(1))).catch(() => null);
    await Promise.all((s?.docs ?? []).map((d) => deleteDoc(d.ref).catch(() => {})));
  }
  await deleteDoc(doc(db, "presencia", uid)).catch(() => {});
  if (codigo) await deleteDoc(doc(db, "codigosAmigo", codigo)).catch(() => {});
}
