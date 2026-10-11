/** Retos de una sala y las marcas de cada uno, en tiempo real. */
import { useEffect, useState } from "react";
import { collection, getDoc, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import type { Marca, Reto } from "../firebase/tipos";
import { coleccionMarcasDiarias, diasAntes, marcasDelDia, ordenarMarcas, refMarcaDiaria } from "../firebase/retos";
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

/** Marcas del reto del día (globales), en tiempo real. */
export function useMarcasDelDia(fecha: string, activo: boolean) {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    return onSnapshot(
      coleccionMarcasDiarias(fecha),
      (snap) => {
        intento.exito();
        setMarcas(ordenarMarcas(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Marca, "uid">) }))));
      },
      (e) => {
        console.warn("Reto del día: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [fecha, activo, intento.n]);

  return marcas;
}

export interface DiaHistorial {
  fecha: string;
  marcas: Marca[];
}

/**
 * Días anteriores del reto (sin hoy) y tus marcas de los últimos `diasPropios` días, para la liga,
 * la racha y tu historial. Se carga una vez, al abrir el historial.
 */
export function useHistorialRetos(hoy: string, uid: string, activo: boolean, dias = 13, diasPropios = 60) {
  const [datos, setDatos] = useState<{ dias: DiaHistorial[]; propias: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const fechas = Array.from({ length: dias }, (_, i) => diasAntes(hoy, i + 1));
    const propiasFechas = Array.from({ length: diasPropios }, (_, i) => diasAntes(hoy, i + 1));
    Promise.all([
      Promise.all(fechas.map(async (fecha) => ({ fecha, marcas: await marcasDelDia(fecha).catch(() => []) }))),
      Promise.all(propiasFechas.map(async (f) => [f, await getDoc(refMarcaDiaria(f, uid)).then((d) => (d.exists() ? (d.data() as Marca).puntaje : null)).catch(() => null)] as const)),
    ]).then(([diasCargados, propias]) => {
      if (!vivo) return;
      setDatos({ dias: diasCargados, propias: Object.fromEntries(propias.filter(([, p]) => p !== null)) as Record<string, number> });
    });
    return () => {
      vivo = false;
    };
  }, [hoy, uid, activo, dias, diasPropios]);
  return datos;
}
