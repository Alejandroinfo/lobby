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

/** Documento `salas/{codigo}/mensajes/{id}`. */
export interface Mensaje {
  id: string;
  uid: string;
  nombre: string;
  texto: string;
  hora: Timestamp | null;
}
