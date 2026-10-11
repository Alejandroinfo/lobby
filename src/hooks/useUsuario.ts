/**
 * Sesión del jugador. Por defecto anónima (sin cuenta), igual que en Astrolabe.
 * Opcionalmente se puede vincular con Google para conservar el perfil en otros dispositivos.
 */
import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  linkWithPopup,
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
}

function aUsuario(u: User): Usuario {
  return { uid: u.uid, email: u.email, anonimo: u.isAnonymous, nombreGoogle: u.displayName };
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

/** Cierra la sesión de Google; se abre otra anónima nueva. */
export async function cerrarSesion(): Promise<void> {
  await signOut(auth);
}
