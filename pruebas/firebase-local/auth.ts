// Cada pestaña es un jugador distinto (uid en sessionStorage).
type Usuario = { uid: string };
export const getAuth = (..._: unknown[]) => ({});
export const connectAuthEmulator = (..._: unknown[]) => {};

function usuario(): Usuario {
  let uid = sessionStorage.getItem("local_uid");
  if (!uid) {
    uid = "local_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("local_uid", uid);
  }
  return { uid };
}

export function onAuthStateChanged(_auth: unknown, cb: (u: Usuario | null) => void) {
  queueMicrotask(() => cb(usuario()));
  return () => {};
}
export async function signInAnonymously() {
  return { user: usuario() };
}
