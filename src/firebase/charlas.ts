/**
 * Mensajes directos entre amigos.
 *
 *  charlas/{par}/mensajes/{id}         → { uid, texto, hora }          (par = los dos uid ordenados, unidos por «_»)
 *  jugadores/{uid}/charlas/{amigo}     → { ultimo, de, hora, leido }   (índice de cada uno: último mensaje y hasta dónde leyó)
 *
 * Quien escribe deja el mensaje y pone al día los dos índices (el suyo, ya leído; el del amigo,
 * sin `leido`, que solo cambia su dueño). Así cada uno escucha una sola colección para saber qué
 * tiene sin leer.
 */
import { useEffect, useState } from "react";
import { collection, doc, limitToLast, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch, type Timestamp } from "firebase/firestore";
import { db } from "./config";
import { pedirAviso } from "./avisos";
import type { MensajeChat } from "../pantallas/Globos";

export const LARGO_MENSAJE_DIRECTO = 500;

export interface IndiceCharla {
  /** uid del amigo (id del documento). */
  uid: string;
  ultimo: string;
  de: string;
  hora: Timestamp | null;
  leido?: Timestamp | null;
}

export const parDe = (a: string, b: string) => [a, b].sort().join("_");

export function sinLeer(c: IndiceCharla | undefined): boolean {
  if (!c || c.de !== c.uid || !c.hora) return false; // el último lo escribí yo
  return !c.leido || c.leido.toMillis() < c.hora.toMillis();
}

export async function enviarMensajeDirecto(yo: string, amigo: string, texto: string) {
  const limpio = texto.trim().slice(0, LARGO_MENSAJE_DIRECTO);
  if (!limpio) return;
  const lote = writeBatch(db);
  lote.set(doc(collection(db, "charlas", parDe(yo, amigo), "mensajes")), { uid: yo, texto: limpio, hora: serverTimestamp() });
  const ultimo = limpio.slice(0, 80);
  lote.set(doc(db, "jugadores", yo, "charlas", amigo), { ultimo, de: yo, hora: serverTimestamp(), leido: serverTimestamp() }, { merge: true });
  lote.set(doc(db, "jugadores", amigo, "charlas", yo), { ultimo, de: yo, hora: serverTimestamp() }, { merge: true });
  await lote.commit();
  pedirAviso({ tipo: "mensaje", de: yo, para: amigo });
}

export async function marcarLeida(yo: string, amigo: string) {
  await setDoc(doc(db, "jugadores", yo, "charlas", amigo), { leido: serverTimestamp() }, { merge: true });
}

/** Tus charlas (una por amigo con quien hablaste), para los no leídos. */
export function useCharlas(uid: string | null) {
  const [mapa, setMapa] = useState<Record<string, IndiceCharla>>({});
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, "jugadores", uid, "charlas"),
      (snap) => setMapa(Object.fromEntries(snap.docs.map((d) => [d.id, { uid: d.id, ...(d.data() as Omit<IndiceCharla, "uid">) }]))),
      () => setMapa({}),
    );
  }, [uid]);
  return mapa;
}

/** Los últimos mensajes con un amigo, mientras la charla está abierta. */
export function useMensajesDirectos(yo: string, amigo: string | null) {
  const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null);
  useEffect(() => {
    setMensajes(null);
    if (!amigo) return;
    const q = query(collection(db, "charlas", parDe(yo, amigo), "mensajes"), orderBy("hora"), limitToLast(150));
    return onSnapshot(
      q,
      (snap) => setMensajes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MensajeChat, "id">) }))),
      (e) => {
        console.warn(e);
        setMensajes([]);
      },
    );
  }, [yo, amigo]);
  return mensajes;
}
