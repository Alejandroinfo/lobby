/** Rutas del lobby: `/` (inicio) y `/s/CODIGO` (una sala). Sin librerías de rutas. */
import { useEffect, useState } from "react";
import { normalizarCodigo } from "./firebase/salas";

export type Ruta = { pantalla: "inicio" } | { pantalla: "sala"; codigo: string };

export function leerRuta(path = window.location.pathname): Ruta {
  const m = path.match(/^\/s\/([^/]+)\/?$/i);
  if (m) return { pantalla: "sala", codigo: normalizarCodigo(decodeURIComponent(m[1])) };
  return { pantalla: "inicio" };
}

export function irA(ruta: Ruta) {
  const path = ruta.pantalla === "sala" ? `/s/${ruta.codigo}` : "/";
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function enlaceSala(codigo: string): string {
  return `${window.location.origin}/s/${codigo}`;
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta());
    window.addEventListener("popstate", alCambiar);
    return () => window.removeEventListener("popstate", alCambiar);
  }, []);
  return ruta;
}
