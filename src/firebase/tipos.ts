import type { Timestamp } from "firebase/firestore";

/** Una persona dentro de una sala. La clave del mapa `miembros` es su uid. */
export interface Miembro {
  nombre: string;
  entrada: Timestamp | null;
  /** Se renueva cada pocos segundos mientras la pestaña está abierta. */
  ultimaVez: Timestamp | null;
}

/** Documento `salas/{codigo}`. */
export interface Sala {
  codigo: string;
  nombre: string;
  anfitrion: string;
  miembros: Record<string, Miembro>;
  creada: Timestamp | null;
}

export type Rol = "jugador" | "espectador";
export type Respuesta = "pendiente" | "acepta" | "rechaza";
export type EstadoPartida = "invitando" | "jugando" | "terminada" | "cancelada";

/** Una persona invitada a una partida. La clave del mapa `invitados` es su uid. */
export interface Invitado {
  nombre: string;
  rol: Rol;
  respuesta: Respuesta;
  listo: boolean;
  /** Cuándo respondió; ordena los asientos al lanzar. */
  respondio: Timestamp | null;
  /** Se asigna al lanzar; `null` para espectadores. */
  asiento: number | null;
  /** Se asigna al lanzar en juegos por equipos. */
  equipo?: 0 | 1;
}

/** Documento `salas/{codigo}/partidas/{id}`. */
export interface Partida {
  id: string;
  juego: string;
  variante: string | null;
  /** Quien creó la partida (puede ser cualquier miembro de la sala). */
  anfitrion: string;
  estado: EstadoPartida;
  invitados: Record<string, Invitado>;
  /** Solo en juegos por equipos: al azar, o elegidos por quien creó la partida (uid → equipo 0 o 1). */
  equipos?: { modo: "azar" | "manual"; de?: Record<string, 0 | 1> };
  /** Resumen del resultado (lo escribe el primer jugador que lo recibe del juego). */
  resultado?: { ganadores: number[]; puntajes?: Record<string, number> };
  /** Código de sala dentro del juego; se genera al lanzar. */
  codigoJuego: string | null;
  creada: Timestamp | null;
  iniciada: Timestamp | null;
  terminada: Timestamp | null;
}

/** Documento `salas/{codigo}/mensajes/{id}`. */
export interface Mensaje {
  id: string;
  uid: string;
  nombre: string;
  texto: string;
  hora: Timestamp | null;
}

/** Lo que un juego conectado informa al terminar (ver lobby-puente en cada juego). */
export interface ResultadoJuego {
  ganadores: number[];
  puntajes?: Record<string, number>;
  duracionSeg?: number;
  version?: string;
  detalle?: unknown;
}

export type Duracion = "corta" | "justa" | "larga";

/** Documento `salas/{codigo}/partidas/{id}/encuestas/{uid}`. */
export interface Encuesta {
  juego: string;
  diversion: number | null;
  claridad: number | null;
  duracion: Duracion | null;
  comentario: string;
  extra: Record<string, string>;
  hora: Timestamp | null;
}

export type RangoEdad = "menos-13" | "13-17" | "18-24" | "25-34" | "35-44" | "45-mas" | "no-dice";
export type ComoLlego = "amigo" | "convencion" | "redes" | "otro" | "no-dice";
export type Experiencia = "casual" | "frecuente" | "muy-frecuente" | "no-dice";

/** Documento `jugadores/{uid}`: el nombre y, si la persona quiso contestarlo, su perfil anónimo. */
export interface Perfil {
  nombre: string;
  pais?: string | null;
  rangoEdad?: RangoEdad;
  comoLlego?: ComoLlego;
  experiencia?: Experiencia;
  salaOrigen?: string;
}
