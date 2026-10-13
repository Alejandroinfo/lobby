/**
 * App instalable (PWA): registro del service worker, detección de "abierta como app" y el aviso
 * de instalación que ofrecen Chrome/Edge/Samsung Internet (en iPhone no existe: se explica a mano).
 */
import { useEffect, useState } from "react";

interface AvisoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let avisoGuardado: AvisoInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  // Llega una sola vez y temprano: se guarda aunque el componente que lo usa aún no exista.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    avisoGuardado = e as AvisoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    avisoGuardado = null;
    avisar();
  });
}

export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Sin service worker", e));
  });
}

/** ¿Se abrió desde el ícono de la pantalla de inicio (app instalada)? */
export function esApp(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function esIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function esAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** El aviso de instalación del navegador, si lo ofrece (Android, Chrome/Edge de escritorio). */
export function useAvisoInstalacion() {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((x) => x + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);
  return {
    disponible: Boolean(avisoGuardado),
    instalar: async () => {
      const aviso = avisoGuardado;
      if (!aviso) return false;
      await aviso.prompt();
      const { outcome } = await aviso.userChoice;
      avisoGuardado = null;
      avisar();
      return outcome === "accepted";
    },
  };
}

/**
 * Abre un juego. En el navegador, en otra pestaña (el lobby sigue abierto y recibe el resultado).
 * En la app instalada, en la misma ventana: así "Volver a la sala" regresa a la app (otra pestaña
 * se abriría fuera de ella, en el navegador) y el resultado vuelve en la dirección.
 */
export function abrirJuego(url: string, ventana = "_blank"): void {
  if (esApp()) {
    window.location.assign(url);
    return;
  }
  const w = window.open(url, ventana);
  if (!w) window.location.href = url; // el navegador bloqueó la pestaña
}
