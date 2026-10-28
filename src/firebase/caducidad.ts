/**
 * Datos que se borran solos. Firestore elimina cada documento cuando pasa la fecha de su campo
 * `expira` (política de «tiempo de vida», TTL, que se activa a mano en la consola: ver README).
 * Un documento sin `expira` (o con `expira` en null) no se borra nunca.
 *
 * - Mensajes del chat de la sala: 30 días después de enviados.
 * - Las salas NO se borran: ocupan poquísimo y sirven para contar cuántas se crearon (panel, CV).
 * - Partidas que nunca se jugaron (invitaciones abandonadas o canceladas): 30 días después de
 *   crearse. Al lanzarla se le quita `expira`: las partidas jugadas, sus resultados y encuestas se
 *   quedan (son el historial de la sala y los datos del panel de playtest).
 */
import { Timestamp } from "firebase/firestore";

export const DIAS_MENSAJE = 30;
export const DIAS_PARTIDA_SIN_JUGAR = 30;

/** Fecha de borrado dentro de `dias` días (con el reloj del aparato: un par de minutos no importa). */
export const expiraEn = (dias: number) => Timestamp.fromMillis(Date.now() + dias * 86_400_000);

/**
 * Mientras las reglas publicadas en Firebase no acepten `expira` (o si se vuelve a una versión
 * anterior), escribir con ese campo da «permission-denied». Para que crear salas, entrar, chatear
 * y crear partidas siga funcionando igual, se reintenta una vez sin el campo y, desde ahí, ya no
 * se manda en esta sesión. Nada más se pierde la fecha de borrado de lo escrito así.
 */
let reglasAceptanExpira = true;

export async function conCaducidad<T>(escribir: (conExpira: boolean) => Promise<T>): Promise<T> {
  if (!reglasAceptanExpira) return escribir(false);
  try {
    return await escribir(true);
  } catch (e) {
    if ((e as { code?: string })?.code !== "permission-denied") throw e;
    const r = await escribir(false);
    // Solo si sin el campo sí funcionó era culpa de `expira`.
    reglasAceptanExpira = false;
    console.warn("Las reglas de Firestore todavía no aceptan «expira»: se escribe sin fecha de borrado.");
    return r;
  }
}

/** `{ expira }` o nada, según lo que acepten las reglas. */
export const campoExpira = (conExpira: boolean, dias: number) => (conExpira ? { expira: expiraEn(dias) } : {});
