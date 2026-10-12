/** Retos de una sala y las marcas de cada uno, en tiempo real. */
import { useEffect, useState } from "react";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import type { FilaRanking, Marca, ResumenDia, Reto } from "../firebase/tipos";
import { diasAntes, filasResumen, rankingDelDia, refResumenDia } from "../firebase/retos";
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

/** Ranking del reto del día (un solo documento), en tiempo real. */
export function useRankingDelDia(fecha: string, activo: boolean) {
  const [filas, setFilas] = useState<FilaRanking[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    return onSnapshot(
      refResumenDia(fecha),
      (d) => {
        intento.exito();
        setFilas(filasResumen(d.exists() ? (d.data() as ResumenDia) : null));
      },
      (e) => {
        console.warn("Reto del día: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [fecha, activo, intento.n]);

  return filas;
}

export interface DiaHistorial {
  fecha: string;
  filas: FilaRanking[];
}

/** Rankings de los días anteriores (sin hoy): una lectura por día. Se carga al abrir el historial. */
export function useHistorialRetos(hoy: string, activo: boolean, dias = 13) {
  const [datos, setDatos] = useState<DiaHistorial[] | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const fechas = Array.from({ length: dias }, (_, i) => diasAntes(hoy, i + 1));
    Promise.all(fechas.map(async (fecha) => ({ fecha, filas: await rankingDelDia(fecha).catch(() => []) }))).then((d) => {
      if (vivo) setDatos(d);
    });
    return () => {
      vivo = false;
    };
  }, [hoy, activo, dias]);
  return datos;
}
