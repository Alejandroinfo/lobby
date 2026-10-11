// Cada pestaña es un jugador distinto (uid en sessionStorage). Google no existe aquí.
type Usuario = { uid: string; email: string | null; isAnonymous: boolean; displayName: string | null };
export const getAuth = (..._: unknown[]) => ({ currentUser: null as Usuario | null });
export const connectAuthEmulator = (..._: unknown[]) => {};

function usuario(): Usuario {
  let uid = sessionStorage.getItem("local_uid");
  if (!uid) {
    uid = "local_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("local_uid", uid);
  }
  return { uid, email: null, isAnonymous: true, displayName: null };
}

export function onIdTokenChanged(_auth: unknown, cb: (u: Usuario | null) => void) {
  queueMicrotask(() => cb(usuario()));
  return () => {};
}
export const onAuthStateChanged = onIdTokenChanged;
export async function signInAnonymously() {
  return { user: usuario() };
}
export class GoogleAuthProvider {
  static credentialFromError() {
    return null;
  }
}
export async function linkWithPopup(): Promise<never> {
  throw Object.assign(new Error("Google no está disponible en el modo local"), { code: "auth/operation-not-supported" });
}
export const signInWithCredential = linkWithPopup;
export async function signOut() {
  sessionStorage.removeItem("local_uid");
  location.reload();
}
export type User = Usuario;
