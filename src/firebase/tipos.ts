import type { Timestamp } from "firebase/firestore";

/** Una persona dentro de una sala. La clave del mapa `miembros` es su uid. */
export interface Miembro {
  nombre: string;
  avatar?: Avatar;
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
  /** Partida en solitario contra la máquina: su nivel. */
  nivel?: "hard" | "easy";
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
  /** Condecoraciones ganadas en la partida, por asiento (ids del catálogo del juego). */
  logros?: Record<string, string[]>;
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
  carrera?: Carrera;
  avatar?: Avatar;
  /** Si otros pueden ver tu ficha (rango, condecoraciones). Menores de 18: siempre privada. */
  fichaVisible?: boolean;
  /** Pregunta opcional para el playtest: qué tipo de jugador eres. */
  tipoJugador?: TipoJugador;
  /** Totales por juego (se suman al terminar cada partida o reto; así el perfil no relee el historial). */
  estadisticas?: Record<string, EstadisticaGuardada>;
  /** Récord contra cada persona con la que jugaste (uid → totales). */
  rivales?: Record<string, RivalGuardado>;
  /** Tus marcas del reto del día (fecha → puntaje): racha, mejor marca y promedio sin lecturas extra. */
  retosDiarios?: Record<string, number>;
  /** Tu código para que te agreguen como amigo (8 caracteres). */
  codigoAmigo?: string;
}

export interface EstadisticaGuardada {
  partidas: number;
  victorias: number;
  empates: number;
  mejor: number | null;
  retos: number;
  mejorReto: number | null;
  sumaReto: number;
}

export interface RivalGuardado {
  /** Su nombre la última vez que jugaron. */
  n: string;
  partidas: number;
  ganadas: number;
  perdidas: number;
  juntos: number;
}

/** Documento `retosDiarios/{fecha}`: el ranking del día en un solo documento (uid → nombre y puntaje). */
export interface ResumenDia {
  jugadores?: Record<string, { n: string; p: number }>;
}

/** Una fila de ranking. */
export interface FilaRanking {
  uid: string;
  nombre: string;
  puntaje: number;
}

export type TipoJugador = "estratega" | "social" | "competitivo" | "casual" | "no-dice";

/** Documento `perfiles/{uid}`: la ficha que ven los demás (solo si la persona la hizo visible). */
export interface Ficha {
  visible: boolean;
  nombre?: string;
  avatar?: Avatar;
  partidas?: number;
  victorias?: number;
  retos?: number;
  logros?: Record<string, number>;
}

/** Emoji y color con los que se te ve en las salas. */
export interface Avatar {
  emoji: string;
  color: string;
}

/** Documento `jugadores/{uid}/historial/{id}`: una partida o un reto que terminaste. */
export interface EntradaHistorial {
  id: string;
  tipo: "partida" | "reto";
  juego: string;
  sala: string;
  fecha: Timestamp | null;
  /** Partida: si ganaste (con equipos, si ganó tu equipo). */
  gano: boolean;
  /** Partida: todos empataron (no cuenta como victoria de nadie). */
  empate: boolean;
  puntaje: number | null;
  variante: string | null;
  /** Partida: quienes jugaron (sin espectadores). */
  jugadores: { uid: string; nombre: string; gano: boolean }[];
  /** Reto: si fue el reto del día. */
  diario?: boolean;
}

/** Trayectoria de la persona en el lobby (todas las partidas y retos que terminó). */
export interface Carrera {
  partidas?: number;
  victorias?: number;
  retos?: number;
  /** id de condecoración → cuántas veces la ganó. */
  logros?: Record<string, number>;
}

/**
 * Documento `salas/{codigo}/retos/{id}`: una misma operación (semilla) que todos juegan en
 * solitario. El reto del día no tiene documento: su id y su semilla salen de la fecha.
 */
export interface Reto {
  id: string;
  juego: string;
  tipo: "diario" | "directo";
  semilla: string;
  variante: string;
  dificultad: "hard" | "easy";
  creador: string | null;
  creadorNombre: string;
  creado: Timestamp | null;
}

/** Documento `salas/{codigo}/retos/{id}/marcas/{uid}`: el primer intento de cada persona. */
export interface Marca {
  uid: string;
  nombre: string;
  puntaje: number;
  version: string | null;
  detalleJson: string;
  hora: Timestamp | null;
  /** Reto del día: sala desde la que se jugó. */
  sala?: string;
}
