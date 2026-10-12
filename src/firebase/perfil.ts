/** Perfil personal: avatar e historial de partidas y retos (`jugadores/{uid}` y su historial). */
import { collection, doc, limitToLast, onSnapshot, orderBy, query, serverTimestamp, setDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";
import type { Avatar, EntradaHistorial, Perfil } from "./tipos";

export const EMOJIS = ["🕵️", "🚀", "🦊", "🐙", "🦉", "🐉", "🌙", "⭐", "🎲", "🃏", "🧭", "🔭", "🎩", "🐺", "🦜", "🍀"];
export const COLORES = ["#2f6b4f", "#3a6ea5", "#7d5ba6", "#c9648f", "#d97a3e", "#b8801f", "#4c9a6a", "#5f6268"];

/** Avatar por defecto: se deriva del uid, así cada persona tiene uno distinto desde el principio. */
export function avatarPorDefecto(uid: string): Avatar {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { emoji: EMOJIS[h % EMOJIS.length], color: COLORES[(h >>> 4) % COLORES.length] };
}

/** Tu perfil en tiempo real (se actualiza al ganar condecoraciones, cambiar avatar, etc.). */
export function usePerfil(uid: string | null) {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "jugadores", uid),
      (d) => setPerfil(d.exists() ? (d.data() as Perfil) : null),
      () => setPerfil(null),
    );
  }, [uid]);
  return perfil;
}

export async function guardarAvatar(uid: string, avatar: Avatar) {
  await setDoc(doc(db, "jugadores", uid), { avatar }, { merge: true });
}

export async function registrarEnHistorial(uid: string, id: string, e: Omit<EntradaHistorial, "id" | "fecha">) {
  await setDoc(doc(db, "jugadores", uid, "historial", id.slice(0, 100)), { ...e, fecha: serverTimestamp() });
}

/** Las últimas `n` entradas de tu historial, de la más nueva a la más vieja. */
export async function leerHistorial(uid: string, n = 300): Promise<EntradaHistorial[]> {
  const snap = await getDocs(query(collection(db, "jugadores", uid, "historial"), orderBy("fecha"), limitToLast(n)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EntradaHistorial, "id">) })).reverse();
}
