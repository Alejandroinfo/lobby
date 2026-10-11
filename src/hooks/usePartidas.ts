/** Partidas de una sala, en tiempo real (las 20 más recientes). */
import { useEffect, useState } from "react";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import type { Partida } from "../firebase/tipos";

export function usePartidas(sala: string) {
  const [partidas, setPartidas] = useState<Partida[]>([]);

  useEffect(() => {
    const q = query(collection(db, "salas", sala, "partidas"), orderBy("creada"), limitToLast(20));
    return onSnapshot(q, (snap) =>
      setPartidas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Partida, "id">) })).reverse()),
    );
  }, [sala]);

  return partidas;
}
