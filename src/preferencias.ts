/**
 * Preferencias que el lobby pasa a los juegos al abrirlos (la letra grande y los sonidos). La letra se guarda
 * en tu perfil (te siguen a otro aparato) y en este navegador (para abrir juegos sin internet).
 * Cada juego decide qué hacer con ellas; hoy la usa Split Loyalty (`?letra=grande`).
 */
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase/config";
import type { Perfil } from "./firebase/tipos";

const CLAVE = "lobby_letra_grande";

function leerLocal(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export const preferencias = { letraGrande: leerLocal() };

function recordar(letraGrande: boolean) {
  preferencias.letraGrande = letraGrande;
  try {
    localStorage.setItem(CLAVE, letraGrande ? "1" : "0");
    // Los juegos servidos desde el lobby (sin internet) comparten este navegador: Split Loyalty la lee aquí.
    localStorage.setItem("splitLoyaltyBigText", letraGrande ? "1" : "0");
  } catch {
    /* sin almacenamiento */
  }
}

/** Al cargar tu perfil: lo guardado en él manda. */
export function aplicarPreferencias(perfil: Perfil | null | undefined) {
  const p = perfil?.preferencias;
  if (p && typeof p.letraGrande === "boolean") recordar(p.letraGrande);
}

export async function guardarPreferencias(uid: string, cambios: { letraGrande: boolean }) {
  recordar(cambios.letraGrande);
  await setDoc(doc(db, "jugadores", uid), { preferencias: { letraGrande: cambios.letraGrande } }, { merge: true });
}

/**
 * Abrir el juego solo cuando quien organiza lanza la partida (en este aparato; por defecto sí).
 * Solo en este navegador: en la app instalada y en la computadora se puede querer distinto.
 */
const CLAVE_ABRIR = "lobby_abrir_al_empezar";
export function abrirAlEmpezar(): boolean {
  try {
    return localStorage.getItem(CLAVE_ABRIR) !== "0";
  } catch {
    return true;
  }
}
export function guardarAbrirAlEmpezar(si: boolean) {
  try {
    localStorage.setItem(CLAVE_ABRIR, si ? "1" : "0");
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Sonidos sí/no: en el lobby (aviso de invitaciones) y en los juegos que abras desde aquí
 * (`?sonido=si|no`; el juego lo toma al empezar y su propio botón lo sigue cambiando). Solo en
 * este aparato, sin pasar por tu perfil: en el celular se puede querer distinto que en la computadora.
 */
const CLAVE_SONIDO = "lobby_sonido";
export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDO) !== "0";
  } catch {
    return true;
  }
}
export function guardarSonido(si: boolean) {
  try {
    localStorage.setItem(CLAVE_SONIDO, si ? "1" : "0");
    // Los juegos servidos desde el lobby (sin internet) comparten este navegador: se deja también su clave.
    localStorage.setItem("splitLoyaltyMuted", si ? "0" : "1");
    localStorage.setItem("dc-mute", si ? "0" : "1");
    localStorage.setItem("hso-silencio", si ? "0" : "1");
  } catch {
    /* sin almacenamiento */
  }
}

/** Parámetros que se suman al enlace de cada juego. */
export function parametrosPreferencias(): Record<string, string> {
  return { letra: preferencias.letraGrande ? "grande" : "normal", sonido: sonidoActivo() ? "si" : "no" };
}
