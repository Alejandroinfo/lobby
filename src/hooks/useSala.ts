/** Escucha en tiempo real una sala y sus últimos mensajes, y mantiene vivo el "conectado". */
import { useEffect, useRef, useState } from "react";
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
  // true solo cuando el servidor ya confirmó que soy miembro (no solo mi copia local).
  // Hasta entonces las reglas rechazan leer el chat y las partidas.
  const [confirmado, setConfirmado] = useState(false);
  const intento = useReintento();

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "salas", codigo),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) {
          setEstado("no-existe");
          return;
        }
        intento.exito();
        const datos = snap.data() as Sala;
        setSala(datos);
        setEstado("lista");
        if (datos.miembros?.[uid] && !snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
          setConfirmado(true);
        }
      },
      (e) => {
        console.warn("Sala: escucha interrumpida, reintentando", e);
        intento.reintentar(() => setEstado("error"));
      },
    );
  }, [codigo, uid, intento.n]);

  const soyMiembro = Boolean(uid && sala?.miembros?.[uid]);

  useEffect(() => {
    if (!uid || !soyMiembro) return;
    // También en segundo plano: así "desconectado" significa que cerró el lobby,
    // no que cambió de pestaña para leer las reglas.
    const tick = () => {
      latido(codigo, uid).catch(() => {});
    };
    const id = window.setInterval(tick, LATIDO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [codigo, uid, soyMiembro]);

  return { sala, estado, soyMiembro, confirmado: confirmado && soyMiembro };
}

export function useMensajes(codigo: string, activo: boolean) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const intento = useReintento();

  useEffect(() => {
    if (!activo) return;
    const q = query(collection(db, "salas", codigo, "mensajes"), orderBy("hora"), limitToLast(100));
    return onSnapshot(
      q,
      (snap) => {
        intento.exito();
        setMensajes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mensaje, "id">) })));
      },
      (e) => {
        console.warn("Chat: escucha interrumpida, reintentando", e);
        intento.reintentar();
      },
    );
  }, [codigo, activo, intento.n]);

  return mensajes;
}

/**
 * Si Firestore corta una escucha (permiso aún no confirmado, red caída), la vuelve a abrir
 * a los 1, 2, 4… segundos (hasta 1 minuto) en vez de dejarla apagada hasta recargar la página.
 */
export function useReintento() {
  const [n, setN] = useState(0);
  const espera = useRef(1000);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    n,
    exito: () => {
      espera.current = 1000;
    },
    reintentar: (siSeRinde?: () => void) => {
      window.clearTimeout(timer.current);
      if (espera.current > 30_000 && siSeRinde) {
        siSeRinde();
        return;
      }
      timer.current = window.setTimeout(() => setN((x) => x + 1), espera.current);
      espera.current = Math.min(espera.current * 2, 60_000);
    },
  };
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
