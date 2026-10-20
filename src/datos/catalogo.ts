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
  /** false si el juego no avisa el resultado solo (quien organiza marca "Terminar partida"). */
  informaResultado?: boolean;
  /** Si se puede jugar solo contra la máquina, y con qué niveles (el primero es el predeterminado). */
  solo?: { niveles: { id: "hard" | "easy"; es: string; en: string }[] };
  /** Si el juego tiene retos en solitario con semilla (reto del día y retos entre amigos). */
  retos?: { variante: string; dificultad: "hard" | "easy"; puntaje: { es: string; en: string } };
  /** Condecoraciones que el juego puede otorgar (id → icono y nombre). */
  logros?: Record<string, Logro>;
}

export interface Logro {
  icono: string;
  es: string;
  en: string;
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
    solo: {
      niveles: [
        // Desde la v2026.10.29 Split Loyalty en solitario es solo contra Contrainteligencia automática.
        { id: "hard", es: "Contrainteligencia", en: "Counter-Intel" },
      ],
    },
    retos: {
      variante: "special",
      dificultad: "hard",
      puntaje: {
        es: "En solitario contra Contrainteligencia (difícil), con mapas especiales. Cuenta el puntaje final.",
        en: "Solo against Counter-Intel (hard), with special maps. Your final score counts.",
      },
    },
    logros: {
      "dossier-completo": { icono: "🗂️", es: "Dossier completo", en: "Full dossier" },
      "primero-en-llegar": { icono: "🥇", es: "Primero en llegar", en: "First on the scene" },
      "mano-limpia": { icono: "🧤", es: "Mano limpia", en: "Clean hands" },
      "gran-red": { icono: "🌐", es: "Gran red", en: "Grand network" },
      "cadena-larga": { icono: "⛓️", es: "Cadena larga", en: "Long chain" },
      "doble-agente": { icono: "🎭", es: "Doble agente", en: "Double agent" },
      "sin-ayuda": { icono: "🧠", es: "Sin ayuda", en: "No help needed" },
      "cuatro-agencias": { icono: "🏛️", es: "Cuatro agencias", en: "Four agencies" },
      leyenda: { icono: "👑", es: "Leyenda", en: "Legend" },
    },
  },
  {
    id: "astrolabe",
    nombre: "Astrolabe",
    descripcion: "Deduce la órbita secreta de tu casa entre las estrellas. Con 4, en equipos de dos.",
    categoria: "listo",
    jugadores: { min: 2, max: 4 },
    duracion: "Por medir",
    espectadores: true,
    // Los modos que Astrolabe ofrece ahora (MODOS_DISPONIBLES en src/game/orbitas.ts de Astrolabe):
    // normal y extendido quedaron ocultos mientras se prueba el mazo nuevo.
    variantes: [{ id: "corto", nombre: "Corto (3 estrellas)" }, { id: "tutorial", nombre: "Tutorial" }],
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
    solo: {
      niveles: [
        { id: "hard", es: "Ordenador normal", en: "Computer: normal" },
        { id: "easy", es: "Ordenador fácil", en: "Computer: easy" },
      ],
    },
    retos: {
      variante: "corto",
      dificultad: "hard",
      puntaje: {
        es: "Contra el ordenador, viaje corto: mismo mapa, mismo viaje de tu familia y mismas paradas para todos. 100 puntos si la encuentras en tu primer turno y 5 menos por cada turno más (mínimo 10); 0 si el ordenador encuentra a la suya antes.",
        en: "Against the computer, short trip: same map, same family trip and same stops for everyone. 100 points if you find your family on your first turn, 5 fewer for each extra turn (minimum 10); 0 if the computer finds its family first.",
      },
    },
    logros: {
      reencuentro: { icono: "🏠", es: "Reencuentro", en: "Reunion" },
      tocToc: { icono: "🚪", es: "Al primer toc, toc", en: "First knock" },
      pocasPalabras: { icono: "🎯", es: "Pocas palabras", en: "Few words" },
      cazador: { icono: "🚀", es: "Cazador de naves", en: "Ship hunter" },
      superviviente: { icono: "☀️", es: "Superviviente", en: "Survivor" },
      astronomo: { icono: "🔭", es: "Astrónomo", en: "Astronomer" },
      colaDeCometa: { icono: "☄️", es: "Cola de cometa", en: "Comet tail" },
      maquina: { icono: "🤖", es: "Más listo que la máquina", en: "Smarter than the machine" },
      tripulacion: { icono: "👨‍👩‍👧‍👦", es: "Gran tripulación", en: "Big crew" },
    },
  },
  {
    id: "double-cross",
    nombre: "Split Loyalty: Double Cross",
    descripcion: "Recluta agentes con dados, archívalos en tu dossier y cobra objetivos antes que las demás agencias.",
    categoria: "listo",
    jugadores: { min: 2, max: 4 },
    duracion: "Por medir",
    espectadores: false,
    variantes: [
      { id: "1", nombre: "Dossier 1 · Corredor (primera partida)" },
      { id: "2", nombre: "Dossier 2 · Espejo (para enseñar)" },
      { id: "3", nombre: "Dossier 3 · Triángulo (perdona más)" },
      { id: "4", nombre: "Dossier 4 · Puerto (variedad)" },
      { id: "5", nombre: "Dossier 5 · Cruce (con experiencia)" },
    ],
    preguntas: [
      { id: "quemar-red", texto: "¿Quemar la red se sintió tentador o demasiado arriesgado? ¿Por qué?", tipo: "texto" },
      { id: "puentes", texto: "¿Los puentes cambiaron cómo armabas tu dossier?", tipo: "si-no" },
    ],
    en: {
      descripcion: "Recruit agents with dice, file them in your dossier and claim objectives before the other agencies.",
      duracion: "Not measured yet",
      variantes: {
        "1": "Dossier 1 · Corridor (first game)",
        "2": "Dossier 2 · Mirror (for teaching)",
        "3": "Dossier 3 · Triangle (more forgiving)",
        "4": "Dossier 4 · Harbor (variety)",
        "5": "Dossier 5 · Crossing (experienced)",
      },
      preguntas: {
        "quemar-red": "Did burning the network feel tempting or too risky? Why?",
        puentes: "Did the bridges change how you built your dossier?",
      },
    },
    url: env.VITE_URL_DOUBLE_CROSS ?? "https://split-loyalty-double-cross.vercel.app/",
    // En solitario: tú contra un bot (el juego no tiene niveles; «hard» es solo el identificador).
    solo: { niveles: [{ id: "hard", es: "Un bot", en: "One bot" }] },
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
    url: env.VITE_URL_BLINDSPOT ?? "https://matchmaking-one-gamma.vercel.app/",
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
    url: env.VITE_URL_BST_ANIMALS ?? "https://bst-firebase.vercel.app/",
    informaResultado: false,
  },
];

export function juegoPorId(id: string): Juego | undefined {
  return JUEGOS.find((j) => j.id === id);
}

/** Busca una condecoración en todos los juegos (los ids se guardan como "juego:id"). */
export function logroPorClave(clave: string): Logro | null {
  const [juego, id] = clave.split(":");
  return juegoPorId(juego)?.logros?.[id] ?? null;
}

/** Orígenes de los juegos conectados: solo de ellos se aceptan resultados. */
export const ORIGENES_JUEGOS = new Set(
  JUEGOS.filter((j) => j.url).map((j) => new URL(j.url).origin),
);
