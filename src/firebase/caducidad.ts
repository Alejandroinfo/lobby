/**
 * Datos que se borran solos. Firestore elimina cada documento cuando pasa la fecha de su campo
 * `expira` (política de «tiempo de vida», TTL, que se activa a mano en la consola: ver README).
 * Un documento sin `expira` (o con `expira` en null) no se borra nunca.
 *
 * - Mensajes del chat de la sala: 30 días después de enviados.
 * - Salas: 90 días después de la última vez que alguien la abrió (a los 60 ya se ve «cerrada»,
 *   así que hay un mes de margen). Cada visita corre la fecha.
 * - Partidas que nunca se jugaron (invitaciones abandonadas o canceladas): 30 días después de
 *   crearse. Al lanzarla se le quita `expira`: las partidas jugadas, sus resultados y encuestas se
 *   quedan (son el historial de la sala y los datos del panel de playtest).
 */
import { Timestamp } from "firebase/firestore";

export const DIAS_MENSAJE = 30;
export const DIAS_SALA = 90;
export const DIAS_PARTIDA_SIN_JUGAR = 30;

/** Fecha de borrado dentro de `dias` días (con el reloj del aparato: un par de minutos no importa). */
export const expiraEn = (dias: number) => Timestamp.fromMillis(Date.now() + dias * 86_400_000);
