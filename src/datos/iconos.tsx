/**
 * Icono y color de cada juego (dibujados aquí, en SVG: pesan nada y se ven nítidos a cualquier tamaño).
 * Para un juego nuevo: agrega su dibujo en DIBUJOS y su color en COLORES. Sin dibujo, se usa uno genérico.
 */
import type { ReactNode } from "react";

/** Color de cada juego (bordes, fondos suaves). Se combina con el tema claro y oscuro. */
export const COLORES: Record<string, string> = {
  "split-loyalty": "#c58a2b",
  astrolabe: "#3d5a8a",
  "double-cross": "#a3362e",
  blindspot: "#b0457a",
  "bst-animals": "#4f8a3c",
};

export const colorDe = (id: string) => COLORES[id] ?? "#5b6b61";

// Todos en una caja de 48×48. Formas simples y gruesas: tienen que leerse a 24 px.
const DIBUJOS: Record<string, ReactNode> = {
  // Un dado partido en dos lealtades.
  "split-loyalty": (
    <>
      <rect x="6" y="6" width="36" height="36" rx="9" fill="#f4e3c1" />
      <path d="M15 6h18a9 9 0 0 1 9 9v18a9 9 0 0 1-9 9H24z" fill="#c58a2b" />
      <path d="M24 3v42" stroke="#2a2724" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4" />
      <circle cx="15" cy="15" r="3.4" fill="#2a2724" />
      <circle cx="15" cy="33" r="3.4" fill="#2a2724" />
      <circle cx="33" cy="15" r="3.4" fill="#fff8ea" />
      <circle cx="33" cy="24" r="3.4" fill="#fff8ea" />
      <circle cx="33" cy="33" r="3.4" fill="#fff8ea" />
    </>
  ),
  // Home Sweet Orbit (antes Astrolabe): su estrella-brújula sobre el cielo, la de su favicon.
  astrolabe: (
    <>
      <circle cx="24" cy="24" r="21" fill="#1f2e4a" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#6c86b8" strokeWidth="1.5" strokeDasharray="2 3" />
      <g fill="#e8c75a" stroke="#1f2e4a" strokeWidth="1.5" strokeLinejoin="round">
        <polygon points="24,4 27.5,20.5 44,24 27.5,27.5 24,44 20.5,27.5 4,24 20.5,20.5" />
      </g>
      <circle cx="24" cy="24" r="4.5" fill="#1f2e4a" stroke="#e8c75a" strokeWidth="2" />
      <circle cx="37" cy="11" r="1.6" fill="#e8c75a" />
      <circle cx="11" cy="37" r="1.2" fill="#e8c75a" />
    </>
  ),
  // Un expediente sellado con la equis de la doble traición.
  "double-cross": (
    <>
      <path d="M7 12a3 3 0 0 1 3-3h10l4 4h14a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill="#e7d9b8" />
      <path d="M7 18h34v20a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill="#d8c69c" />
      <rect x="13" y="20" width="22" height="18" rx="3" fill="none" stroke="#a3362e" strokeWidth="2.5" transform="rotate(-8 24 29)" />
      <path d="M17 23l14 12M31 23L17 35" stroke="#a3362e" strokeWidth="4.5" strokeLinecap="round" transform="rotate(-8 24 29)" />
    </>
  ),
  // Un ojo con su punto ciego.
  blindspot: (
    <>
      <path d="M3 24C9 13 16 9 24 9s15 4 21 15c-6 11-13 15-21 15S9 35 3 24z" fill="#f7dbe8" stroke="#b0457a" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="9" fill="#b0457a" />
      <circle cx="24" cy="24" r="3.5" fill="#2b1420" />
      <path d="M30 13l7 7" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 13l7 7" stroke="#b0457a" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
    </>
  ),
  // Un árbol binario con hojas.
  "bst-animals": (
    <>
      <path d="M24 12L13 26M24 12l11 14M13 26l-5 12M13 26l5 12M35 26l5 12" stroke="#6b4f2a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="11" r="6.5" fill="#4f8a3c" />
      <circle cx="13" cy="26" r="5.5" fill="#6aa84f" />
      <circle cx="35" cy="26" r="5.5" fill="#6aa84f" />
      <circle cx="8" cy="39" r="4" fill="#8cc06b" />
      <circle cx="18" cy="39" r="4" fill="#8cc06b" />
      <circle cx="40" cy="39" r="4" fill="#8cc06b" />
    </>
  ),
};

const GENERICO = (
  <>
    <rect x="7" y="7" width="34" height="34" rx="8" fill="#e1eee6" stroke="#2c6a4c" strokeWidth="2.5" />
    <circle cx="17" cy="17" r="3.2" fill="#2c6a4c" />
    <circle cx="24" cy="24" r="3.2" fill="#2c6a4c" />
    <circle cx="31" cy="31" r="3.2" fill="#2c6a4c" />
  </>
);

/** Icono del juego. Decorativo: el nombre siempre va al lado como texto. */
export function IconoJuego({ id, tam = 32, className = "" }: { id: string; tam?: number; className?: string }) {
  return (
    <svg className={`icono-juego ${className}`} width={tam} height={tam} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {DIBUJOS[id] ?? GENERICO}
    </svg>
  );
}
