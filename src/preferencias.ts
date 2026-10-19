/**
 * Preferencias que el lobby pasa a los juegos al abrirlos (por ahora, la letra grande). Se guardan
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

/** Parámetros que se suman al enlace de cada juego. */
export function parametrosPreferencias(): Record<string, string> {
  return { letra: preferencias.letraGrande ? "grande" : "normal" };
}
