/** Nombre del jugador, recordado en este navegador. */
import { useState } from "react";

const CLAVE = "lobby_nombre";

function leer(): string {
  try {
    return localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

export function useNombre() {
  const [nombre, setNombre] = useState(leer);
  const guardar = (nuevo: string) => {
    setNombre(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* navegación privada: se recuerda solo en esta pestaña */
    }
  };
  return [nombre, guardar] as const;
}
