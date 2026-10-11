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
