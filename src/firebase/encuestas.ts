/** Encuesta de playtest al terminar una partida, y el perfil anónimo de audiencia. */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./config";
import type { Duracion, Encuesta, Perfil } from "./tipos";

export const refEncuesta = (sala: string, partida: string, uid: string) =>
  doc(db, "salas", sala, "partidas", partida, "encuestas", uid);

export async function guardarEncuesta(
  sala: string,
  partida: string,
  uid: string,
  datos: Omit<Encuesta, "hora">,
) {
  await setDoc(refEncuesta(sala, partida, uid), {
    juego: datos.juego,
    diversion: datos.diversion,
    claridad: datos.claridad,
    duracion: datos.duracion as Duracion | null,
    comentario: datos.comentario.slice(0, 1000),
    extra: Object.fromEntries(Object.entries(datos.extra).map(([k, v]) => [k.slice(0, 40), v.slice(0, 500)])),
    hora: serverTimestamp(),
  });
}

export async function yaRespondio(sala: string, partida: string, uid: string): Promise<boolean> {
  try {
    return (await getDoc(refEncuesta(sala, partida, uid))).exists();
  } catch {
    return false;
  }
}

export async function leerPerfil(uid: string): Promise<Perfil | null> {
  try {
    const snap = await getDoc(doc(db, "jugadores", uid));
    return snap.exists() ? (snap.data() as Perfil) : null;
  } catch {
    return null;
  }
}

/** Guarda solo los campos de audiencia que la persona contestó. */
export async function guardarAudiencia(uid: string, datos: Partial<Perfil>) {
  await setDoc(doc(db, "jugadores", uid), datos, { merge: true });
}

/**
 * País de la visita (código de 2 letras) según Vercel. Se pide una vez por sesión y se guarda
 * en el perfil; nunca se guarda la IP. En `npm run dev` no hay función y simplemente no hay país.
 */
export async function registrarPais(uid: string) {
  const clave = "lobby_pais_registrado";
  try {
    if (sessionStorage.getItem(clave)) return;
    sessionStorage.setItem(clave, "1");
    const r = await fetch("/api/pais", { cache: "no-store" });
    if (!r.ok) return;
    const { pais } = (await r.json()) as { pais: string | null };
    if (pais) await setDoc(doc(db, "jugadores", uid), { pais }, { merge: true });
  } catch {
    /* sin país: no pasa nada */
  }
}
