/** Escucha en tiempo real una sala y sus últimos mensajes, y mantiene vivo el "conectado". */
import { useEffect, useState } from "react";
import { collection, doc, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { latido } from "../firebase/salas";
import type { Mensaje, Sala } from "../firebase/tipos";

/** Cada cuánto se avisa "sigo aquí", y cuánto silencio cuenta como desconectado. */
export const LATIDO_MS = 40_000;
export const DESCONECTADO_MS = 100_000;

export function useSala(codigo: string, uid: string | null) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [estado, setEstado] = useState<"cargando" | "lista" | "no-existe" | "error">("cargando");

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "salas", codigo),
      (snap) => {
        if (!snap.exists()) {
          setEstado("no-existe");
          return;
        }
        setSala(snap.data() as Sala);
        setEstado("lista");
      },
      () => setEstado("error"),
    );
  }, [codigo, uid]);

  const soyMiembro = Boolean(uid && sala?.miembros?.[uid]);

  useEffect(() => {
    if (!uid || !soyMiembro) return;
    const tick = () => {
      if (document.visibilityState === "visible") latido(codigo, uid).catch(() => {});
    };
    const id = window.setInterval(tick, LATIDO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [codigo, uid, soyMiembro]);

  return { sala, estado, soyMiembro };
}

export function useMensajes(codigo: string, activo: boolean) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  useEffect(() => {
    if (!activo) return;
    const q = query(collection(db, "salas", codigo, "mensajes"), orderBy("hora"), limitToLast(100));
    return onSnapshot(q, (snap) =>
      setMensajes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mensaje, "id">) }))),
    );
  }, [codigo, activo]);

  return mensajes;
}

/** Hora actual que se renueva cada `cadaMs`, para calcular quién sigue conectado. */
export function useAhora(cadaMs = 15_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
