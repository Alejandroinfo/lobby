/**
 * Sesión del jugador. Por defecto anónima (sin cuenta): se puede jugar al instante.
 * Opcionalmente se crea una cuenta (correo y contraseña, o Google) para conservar el perfil
 * en otros dispositivos. Crear la cuenta vincula la sesión actual: mismo uid, no se pierde nada.
 */
import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  deleteUser,
  onIdTokenChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "../firebase/config";

export interface Usuario {
  uid: string;
  email: string | null;
  anonimo: boolean;
  nombreGoogle: string | null;
  /** Cómo entra: con Google, con correo y contraseña, o sin cuenta. */
  proveedor: "google" | "correo" | null;
  verificado: boolean;
}

function aUsuario(u: User): Usuario {
  const ids = (u.providerData ?? []).map((p) => p.providerId);
  const proveedor = ids.includes("google.com") ? "google" : ids.includes("password") ? "correo" : null;
  return { uid: u.uid, email: u.email, anonimo: u.isAnonymous, nombreGoogle: u.displayName, proveedor, verificado: u.emailVerified };
}

export function useUsuario() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      // onIdTokenChanged (no onAuthStateChanged): también avisa al vincular con Google (mismo uid).
      onIdTokenChanged(auth, (u) => {
        if (u) setUsuario(aUsuario(u));
        else signInAnonymously(auth).catch((e) => setError(String(e?.message ?? e)));
      }),
    [],
  );

  return { uid: usuario?.uid ?? null, usuario, error };
}

/**
 * Vincula la sesión anónima actual con una cuenta de Google (mismo uid: se conservan salas y
 * partidas). Si esa cuenta de Google ya se usó en otro dispositivo, entra con ella.
 */
export async function guardarConGoogle(): Promise<void> {
  const proveedor = new GoogleAuthProvider();
  const actual = auth.currentUser;
  if (!actual) throw new Error("Sin sesión");
  try {
    await linkWithPopup(actual, proveedor);
    await actual.reload();
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "auth/credential-already-in-use") {
      const credencial = GoogleAuthProvider.credentialFromError(e as never);
      if (credencial) {
        await signInWithCredential(auth, credencial);
        return;
      }
    }
    throw e;
  }
}

/**
 * Crea una cuenta con correo y contraseña a partir de la sesión actual (mismo uid: se conserva
 * todo lo jugado). Manda un correo para verificar la dirección.
 */
export async function crearCuentaConCorreo(correo: string, clave: string): Promise<void> {
  const actual = auth.currentUser;
  if (!actual) throw new Error("Sin sesión");
  await linkWithCredential(actual, EmailAuthProvider.credential(correo.trim(), clave));
  await sendEmailVerification(actual).catch(() => {});
  await actual.reload();
  await actual.getIdToken(true); // para que el resto de la app vea el correo nuevo
}

/** Entra con una cuenta ya creada (p. ej. en otro dispositivo). */
export async function entrarConCorreo(correo: string, clave: string): Promise<void> {
  await signInWithEmailAndPassword(auth, correo.trim(), clave);
}

/** Manda el correo para elegir una contraseña nueva. */
export async function recuperarClave(correo: string): Promise<void> {
  await sendPasswordResetEmail(auth, correo.trim());
}

/** Cierra la sesión; se abre otra anónima nueva. */
export async function cerrarSesion(): Promise<void> {
  await signOut(auth);
}

/**
 * Tras borrar tus datos: elimina también la cuenta (si la sesión es reciente; si no, Firebase pide
 * volver a entrar y solo se cierra la sesión) y olvida lo guardado en este navegador.
 */
export async function olvidarEsteDispositivo(): Promise<void> {
  const actual = auth.currentUser;
  try {
    localStorage.removeItem("lobby_nombre");
    localStorage.removeItem("lobby_salas_recientes");
  } catch {
    /* sin almacenamiento */
  }
  if (actual) await deleteUser(actual).catch(() => signOut(auth));
  else await signOut(auth);
}
