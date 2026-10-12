// Cada pestaña es un jugador distinto (uid en sessionStorage). Google no existe aquí; las cuentas
// con correo se simulan en localStorage (compartidas entre pestañas, como en Firebase).
type Usuario = {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  displayName: string | null;
  emailVerified: boolean;
  providerData: { providerId: string }[];
  reload: () => Promise<void>;
  getIdToken: (forzar?: boolean) => Promise<string>;
};
export const getAuth = (..._: unknown[]) => ({ get currentUser() { return usuario(); } });
export const connectAuthEmulator = (..._: unknown[]) => {};

const CUENTAS = "local_cuentas"; // correo → { clave, uid }
const leerCuentas = (): Record<string, { clave: string; uid: string }> => JSON.parse(localStorage.getItem(CUENTAS) ?? "{}");
const error = (code: string) => Object.assign(new Error(code), { code });

function usuario(): Usuario {
  let uid = sessionStorage.getItem("local_uid");
  if (!uid) {
    uid = "local_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("local_uid", uid);
  }
  const correo = Object.entries(leerCuentas()).find(([, c]) => c.uid === uid)?.[0] ?? null;
  return {
    uid,
    email: correo,
    isAnonymous: !correo,
    displayName: null,
    emailVerified: false,
    providerData: correo ? [{ providerId: "password" }] : [],
    reload: async () => {},
    getIdToken: async () => "token",
  };
}

const oyentes = new Set<(u: Usuario | null) => void>();
const avisar = () => queueMicrotask(() => oyentes.forEach((cb) => cb(usuario())));

export function onIdTokenChanged(_auth: unknown, cb: (u: Usuario | null) => void) {
  oyentes.add(cb);
  queueMicrotask(() => cb(usuario()));
  return () => oyentes.delete(cb);
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
  throw error("auth/operation-not-supported-in-this-environment");
}
export const signInWithCredential = linkWithPopup;

export const EmailAuthProvider = {
  credential: (correo: string, clave: string) => ({ correo: correo.trim().toLowerCase(), clave }),
  credentialWithLink: (correo: string, enlace: string) => ({ correo: correo.trim().toLowerCase(), clave: "", enlace }),
};
// Acceso con enlace: el "correo" se simula guardando el último enlace en localStorage.
export async function sendSignInLinkToEmail(_auth: unknown, correo: string, ajustes: { url: string }) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) throw error("auth/invalid-email");
  const u = new URL(ajustes.url);
  u.searchParams.set("mode", "signIn");
  u.searchParams.set("oobCode", "local-" + correo.trim().toLowerCase());
  localStorage.setItem("local_ultimo_enlace", u.toString());
}
export const isSignInWithEmailLink = (_auth: unknown, enlace: string) => new URL(enlace).searchParams.get("mode") === "signIn";
function correoDelEnlace(enlace: string) {
  return (new URL(enlace).searchParams.get("oobCode") ?? "").replace(/^local-/, "");
}
export async function signInWithEmailLink(_auth: unknown, correo: string, enlace: string) {
  if (correoDelEnlace(enlace) !== correo.trim().toLowerCase()) throw error("auth/invalid-email");
  const cuentas = leerCuentas();
  const c = cuentas[correo.trim().toLowerCase()];
  if (c) sessionStorage.setItem("local_uid", c.uid);
  else {
    sessionStorage.removeItem("local_uid");
    cuentas[correo.trim().toLowerCase()] = { clave: "", uid: usuario().uid };
    localStorage.setItem(CUENTAS, JSON.stringify(cuentas));
  }
  avisar();
  return { user: usuario() };
}
export async function linkWithCredential(u: Usuario, cred: { correo: string; clave: string; enlace?: string }) {
  const cuentas = leerCuentas();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cred.correo)) throw error("auth/invalid-email");
  if (cred.enlace) {
    if (correoDelEnlace(cred.enlace) !== cred.correo) throw error("auth/invalid-email");
    if (cuentas[cred.correo]) throw error("auth/email-already-in-use");
    cuentas[cred.correo] = { clave: "", uid: u.uid };
    localStorage.setItem(CUENTAS, JSON.stringify(cuentas));
    avisar();
    return { user: usuario() };
  }
  if (cred.clave.length < 6) throw error("auth/weak-password");
  if (cuentas[cred.correo]) throw error("auth/email-already-in-use");
  cuentas[cred.correo] = { clave: cred.clave, uid: u.uid };
  localStorage.setItem(CUENTAS, JSON.stringify(cuentas));
  avisar();
  return { user: usuario() };
}
export async function signInWithEmailAndPassword(_auth: unknown, correo: string, clave: string) {
  const c = leerCuentas()[correo.trim().toLowerCase()];
  if (!c || c.clave !== clave) throw error("auth/invalid-credential");
  sessionStorage.setItem("local_uid", c.uid);
  avisar();
  return { user: usuario() };
}
export async function sendEmailVerification() {}
export async function sendPasswordResetEmail(_auth: unknown, correo: string) {
  if (!leerCuentas()[correo.trim().toLowerCase()]) return; // Firebase tampoco dice si existe
}
export async function deleteUser(u: Usuario) {
  const cuentas = leerCuentas();
  for (const [correo, c] of Object.entries(cuentas)) if (c.uid === u.uid) delete cuentas[correo];
  localStorage.setItem(CUENTAS, JSON.stringify(cuentas));
  await signOut();
}
export async function signOut() {
  sessionStorage.removeItem("local_uid");
  avisar();
}
export type User = Usuario;
