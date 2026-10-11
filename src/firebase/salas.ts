/** Operaciones sobre salas y chat. Cada una corresponde a algo que permite `firestore.rules`. */
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";

/** Sin I, O, 0 ni 1 para que el código se pueda dictar sin confusiones. */
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 5;
export const LARGO_NOMBRE = 24;
export const LARGO_MENSAJE = 500;

export function generarCodigo(): string {
  const azar = crypto.getRandomValues(new Uint32Array(LARGO_CODIGO));
  return Array.from(azar, (n) => LETRAS[n % LETRAS.length]).join("");
}

export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LARGO_CODIGO);
}

export function codigoValido(codigo: string): boolean {
  return new RegExp(`^[${LETRAS}]{${LARGO_CODIGO}}$`).test(codigo);
}

export function limpiarNombre(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, LARGO_NOMBRE);
}

const refSala = (codigo: string) => doc(db, "salas", codigo);

/** Guarda el perfil del jugador (`jugadores/{uid}`). */
export async function guardarPerfil(uid: string, nombre: string) {
  await setDoc(
    doc(db, "jugadores", uid),
    { nombre, ultimaVez: serverTimestamp() },
    { merge: true },
  );
}

/** Crea una sala nueva con un código libre y devuelve el código. */
export async function crearSala(uid: string, nombre: string, nombreSala: string): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigo();
    const creada = await runTransaction(db, async (tx) => {
      const actual = await tx.get(refSala(codigo));
      if (actual.exists()) return false;
      tx.set(refSala(codigo), {
        codigo,
        nombre: nombreSala || `Sala de ${nombre}`,
        anfitrion: uid,
        miembros: {
          [uid]: { nombre, entrada: serverTimestamp(), ultimaVez: serverTimestamp() },
        },
        creada: serverTimestamp(),
      });
      return true;
    });
    if (creada) return codigo;
  }
  throw new Error("No se pudo generar un código libre. Intenta de nuevo.");
}

export class SalaNoExiste extends Error {}

/** Agrega al jugador a la sala, o actualiza su nombre si ya estaba. */
export async function unirseASala(codigo: string, uid: string, nombre: string) {
  const sala = await getDoc(refSala(codigo));
  if (!sala.exists()) throw new SalaNoExiste(codigo);
  const yaEstaba = Boolean(sala.data().miembros?.[uid]);
  await updateDoc(refSala(codigo), {
    [`miembros.${uid}.nombre`]: nombre,
    [`miembros.${uid}.ultimaVez`]: serverTimestamp(),
    ...(yaEstaba ? {} : { [`miembros.${uid}.entrada`]: serverTimestamp() }),
  });
}

/** Marca al jugador como conectado. Se llama periódicamente mientras la sala está abierta. */
export async function latido(codigo: string, uid: string) {
  await updateDoc(refSala(codigo), { [`miembros.${uid}.ultimaVez`]: serverTimestamp() });
}

export async function salirDeSala(codigo: string, uid: string) {
  await updateDoc(refSala(codigo), { [`miembros.${uid}`]: deleteField() });
}

export async function enviarMensaje(codigo: string, uid: string, nombre: string, texto: string) {
  await addDoc(collection(db, "salas", codigo, "mensajes"), {
    uid,
    nombre,
    texto: texto.slice(0, LARGO_MENSAJE),
    hora: serverTimestamp(),
  });
}
