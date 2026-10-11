/** Retos de una sala y las marcas de cada uno, en tiempo real. */
import { useEffect, useState } from "react";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import type { Marca, Reto } from "../firebase/tipos";
import { useReintento } from "./useSala";

/** Los retos directos más recientes de la sala (los 6 últimos). */
export function useRetos(sala: string, activo: boolean) {
  const [retos, setRetos] = useState<Reto[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    const q = query(collection(db, "salas", sala, "retos"), orderBy("creado"), limitToLast(6));
    return onSnapshot(
      q,
      (snap) => {
        intento.exito();
        setRetos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reto, "id">) })).reverse());
      },
      (e) => {
        console.warn("Retos: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [sala, activo, intento.n]);

  return retos;
}

/** Marcas de un reto, de mayor a menor puntaje (empate: quien llegó primero). */
export function useMarcas(sala: string, retoId: string, activo: boolean) {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    return onSnapshot(
      collection(db, "salas", sala, "retos", retoId, "marcas"),
      (snap) => {
        intento.exito();
        const lista = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Marca, "uid">) }));
        lista.sort((a, b) => b.puntaje - a.puntaje || (a.hora?.toMillis() ?? Infinity) - (b.hora?.toMillis() ?? Infinity));
        setMarcas(lista);
      },
      (e) => {
        console.warn("Marcas: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [sala, retoId, activo, intento.n]);

  return marcas;
}
