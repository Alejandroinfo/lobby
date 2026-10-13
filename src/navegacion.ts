/** Rutas del lobby: `/` (inicio), `/s/CODIGO` (una sala), `/perfil` y `/panel` (playtest). Sin librerías de rutas. */
import { useEffect, useState } from "react";
import { normalizarCodigo } from "./firebase/salas";

export type Ruta =
  | { pantalla: "inicio" }
  | { pantalla: "panel" }
  | { pantalla: "perfil" }
  | { pantalla: "en-este-celular" }
  | { pantalla: "sala"; codigo: string };

export function leerRuta(path = window.location.pathname): Ruta {
  const m = path.match(/^\/s\/([^/]+)\/?$/i);
  if (m) return { pantalla: "sala", codigo: normalizarCodigo(decodeURIComponent(m[1])) };
  if (/^\/panel\/?$/i.test(path)) return { pantalla: "panel" };
  if (/^\/perfil\/?$/i.test(path)) return { pantalla: "perfil" };
  if (/^\/en-este-celular\/?$/i.test(path)) return { pantalla: "en-este-celular" };
  return { pantalla: "inicio" };
}

export function irA(ruta: Ruta) {
  const path = ruta.pantalla === "sala" ? `/s/${ruta.codigo}` : ruta.pantalla === "inicio" ? "/" : `/${ruta.pantalla}`;
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
