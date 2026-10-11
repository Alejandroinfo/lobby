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
  /** Con cuántos jugadores se juega en dos equipos (asientos pares contra impares). */
  equiposCon?: number[];
  /** Textos en inglés (el resto del catálogo está en español). */
  en?: {
    descripcion: string;
    duracion?: string;
    variantes?: Record<string, string>;
    preguntas?: Record<string, string>;
  };
  /** Hasta dos preguntas propias del juego en la encuesta de playtest. */
  preguntas?: Pregunta[];
  /**
   * Página del juego que entiende los parámetros del lobby (?lobby=1&codigo=…).
   * Vacío = el juego aún no está conectado: cada uno lo abre por su cuenta.
   */
  url: string;
}

export interface Pregunta {
  id: string;
  texto: string;
  tipo: "si-no" | "texto";
}

export const CATEGORIAS: Record<Categoria, { titulo: string; nota: string }> = {
  listo: { titulo: "Listos para jugar", nota: "Reglas estables" },
  prueba: { titulo: "En prueba", nota: "Las reglas pueden cambiar entre partidas" },
};

/** Dirección de cada juego; se puede cambiar con variables de entorno (en Vercel o en .env.local). */
const env = import.meta.env;

export const JUEGOS: Juego[] = [
  {
    id: "split-loyalty",
    nombre: "Split Loyalty",
    descripcion: "Recluta agentes y decide si cada uno sirve a su nación o a su rango.",
    categoria: "listo",
    jugadores: { min: 2, max: 4 },
    duracion: "20–35 min",
    espectadores: true,
    variantes: [{ id: "simple", nombre: "Mapas simples" }, { id: "special", nombre: "Mapas especiales" }],
    preguntas: [
      { id: "habilidad-fuerte", texto: "¿Alguna habilidad o misión se sintió demasiado fuerte o débil? ¿Cuál?", tipo: "texto" },
    ],
    en: {
      descripcion: "Recruit agents and decide whether each one serves their nation or their rank.",
      variantes: { simple: "Simple maps", special: "Special maps" },
      preguntas: { "habilidad-fuerte": "Did any ability or mission feel too strong or too weak? Which one?" },
    },
    url: env.VITE_URL_SPLIT_LOYALTY ?? "https://split-loyalty.vercel.app/app/online.html",
  },
  {
    id: "astrolabe",
    nombre: "Astrolabe",
    descripcion: "Deduce la órbita secreta de tu casa entre las estrellas. Con 4, en equipos de dos.",
    categoria: "listo",
    jugadores: { min: 2, max: 4 },
    duracion: "Por medir",
    espectadores: true,
    variantes: [{ id: "normal", nombre: "Normal (4 estrellas)" }, { id: "corto", nombre: "Corto (3 estrellas)" }, { id: "extendido", nombre: "Extendido (5 estrellas)" }, { id: "tutorial", nombre: "Tutorial" }],
    equiposCon: [4],
    preguntas: [
      { id: "bitacora-clara", texto: "¿Se entendió bien la bitácora por paradas?", tipo: "si-no" },
      { id: "momento-deduccion", texto: "¿Hubo un momento de «¡ya lo vi!»? ¿Cuál?", tipo: "texto" },
    ],
    en: {
      descripcion: "Deduce your home's secret orbit among the stars. With 4, in teams of two.",
      duracion: "Not measured yet",
      variantes: { normal: "Normal (4 stars)", corto: "Short (3 stars)", extendido: "Extended (5 stars)", tutorial: "Tutorial" },
      preguntas: {
        "bitacora-clara": "Was the logbook by stops easy to understand?",
        "momento-deduccion": "Was there an \"I see it!\" moment? Which one?",
      },
    },
    url: env.VITE_URL_ASTROLABE ?? "https://astrolabebg.vercel.app/",
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
    preguntas: [
      { id: "adivino-rivals", texto: "¿Adivinaste quiénes eran los Rivals?", tipo: "si-no" },
      { id: "rol-equilibrado", texto: "¿Algún rol se sintió injusto o demasiado fácil?", tipo: "texto" },
    ],
    en: {
      descripcion: "Everyone sees your personality except you. Figure it out before the Soulmate.",
      preguntas: {
        "adivino-rivals": "Did you guess who the Rivals were?",
        "rol-equilibrado": "Did any role feel unfair or too easy?",
      },
    },
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
    preguntas: [
      { id: "zona-comun-senales", texto: "En el Escenario B, ¿la zona común reemplazó a las señales?", tipo: "si-no" },
      { id: "silencio", texto: "¿El silencio se sintió como un reto divertido o como una frustración?", tipo: "texto" },
    ],
    en: {
      descripcion: "Build trees in silence, without saying which cards you hold.",
      variantes: { A: "Scenario A: Mixed information", B: "Scenario B: Late reveal" },
      preguntas: {
        "zona-comun-senales": "In Scenario B, did the common zone replace the signals?",
        silencio: "Did the silence feel like a fun challenge or a frustration?",
      },
    },
    url: "",
  },
];

export function juegoPorId(id: string): Juego | undefined {
  return JUEGOS.find((j) => j.id === id);
}

/** Orígenes de los juegos conectados: solo de ellos se aceptan resultados. */
export const ORIGENES_JUEGOS = new Set(
  JUEGOS.filter((j) => j.url).map((j) => new URL(j.url).origin),
);
