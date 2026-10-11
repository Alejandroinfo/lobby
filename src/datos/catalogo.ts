/**
 * Catálogo de juegos del lobby. Para mover un juego de categoría basta con
 * cambiar `categoria`.
 */
export type Categoria = "listo" | "prueba";

export interface Juego {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: Categoria;
  jugadores: { min: number; max: number };
  duracion: string;
  espectadores: boolean;
  /** Opciones de partida; la primera es la predeterminada. */
  variantes: { id: string; nombre: string }[];
  url: string;
}

export const CATEGORIAS: Record<Categoria, { titulo: string; nota: string }> = {
  listo: { titulo: "Listos para jugar", nota: "Reglas estables" },
  prueba: { titulo: "En prueba", nota: "Las reglas pueden cambiar entre partidas" },
};

export const JUEGOS: Juego[] = [
  {
    id: "split-loyalty",
    nombre: "Split Loyalty",
    descripcion: "Recluta agentes y decide si cada uno sirve a su nación o a su rango.",
    categoria: "listo",
    jugadores: { min: 1, max: 4 },
    duracion: "20–35 min",
    espectadores: true,
    variantes: [{ id: "simple", nombre: "Mapas simples" }, { id: "especiales", nombre: "Mapas especiales" }],
    url: "",
  },
  {
    id: "astrolabe",
    nombre: "Astrolabe",
    descripcion: "Deduce la órbita secreta de tu casa entre las estrellas antes que tu rival.",
    categoria: "listo",
    jugadores: { min: 2, max: 2 },
    duracion: "Por medir",
    espectadores: true,
    variantes: [{ id: "normal", nombre: "Normal (4 estrellas)" }, { id: "corto", nombre: "Corto (3 estrellas)" }, { id: "extendido", nombre: "Extendido (5 estrellas)" }, { id: "tutorial", nombre: "Tutorial" }],
    url: "https://astrolabebg.vercel.app",
  },
  {
    id: "blindspot",
    nombre: "Blindspot",
    descripcion: "Todos ven tu personalidad menos tú. Descúbrela antes del Soulmate.",
    categoria: "prueba",
    jugadores: { min: 3, max: 6 },
    duracion: "45–75 min",
    espectadores: false,
    variantes: [],
    url: "",
  },
  {
    id: "bst-animals",
    nombre: "BST Animals",
    descripcion: "Construyan árboles en silencio, sin poder decir qué cartas tienen.",
    categoria: "prueba",
    jugadores: { min: 2, max: 5 },
    duracion: "45–75 min",
    espectadores: false,
    variantes: [{ id: "A", nombre: "Escenario A: Información mixta" }, { id: "B", nombre: "Escenario B: Revelación tardía" }],
    url: "",
  },
];

export function juegoPorId(id: string): Juego | undefined {
  return JUEGOS.find((j) => j.id === id);
}
