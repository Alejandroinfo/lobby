/** Partidas de una sala, en tiempo real (las 20 más recientes). */
import { useEffect, useState } from "react";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import type { Partida } from "../firebase/tipos";
import { useReintento } from "./useSala";

export function usePartidas(sala: string, activo: boolean) {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    const q = query(collection(db, "salas", sala, "partidas"), orderBy("creada"), limitToLast(20));
    return onSnapshot(
      q,
      (snap) => {
        intento.exito();
        setPartidas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Partida, "id">) })).reverse());
      },
      (e) => {
        console.warn("Partidas: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [sala, activo, intento.n]);

  return partidas;
}
