/**
 * Avisos al celular (Web Push): «te toca», invitaciones y solicitudes de amistad. Cada aparato que
 * los activa guarda su suscripción en `jugadores/{uid}/avisos/{id}`; las funciones de Vercel
 * (api/turno.js, api/aviso.js) la leen para mandar el aviso. El service worker lo muestra.
 */
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./config";

/** Clave pública VAPID (la privada vive solo en Vercel: VAPID_PRIVATE_KEY). Igual que en api/_avisos.js. */
const VAPID_PUBLICA = "BORxHxET5grSLZGCuMd2BTxslI8p1ZkInmcBwOTp0IKKMAG8_EPsXeMcDlLMaXS6M1bBtiWDz-fveO9k21feEcM";
const CLAVE_LOCAL = "lobby_avisos_id";

export type EstadoAvisos = "sin-soporte" | "falta-instalar" | "bloqueados" | "apagados" | "activos";

const esIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const esApp = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function estadoAvisos(): Promise<EstadoAvisos> {
  // En iPhone los avisos solo existen con la app instalada en la pantalla de inicio.
  if (esIOS() && !esApp()) return "falta-instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "sin-soporte";
  if (Notification.permission === "denied") return "bloqueados";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "activos" : "apagados";
}

function aBytes(base64: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function idDe(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Pide permiso y registra este aparato. Devuelve el nuevo estado. */
export async function activarAvisos(uid: string, idioma: string): Promise<EstadoAvisos> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueados" : "apagados";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA).buffer as ArrayBuffer }));
  const datos = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const id = await idDe(datos.endpoint);
  await setDoc(doc(db, "jugadores", uid, "avisos", id), {
    suscripcion: { endpoint: datos.endpoint, keys: { p256dh: datos.keys.p256dh, auth: datos.keys.auth } },
    idioma: idioma === "en" ? "en" : "es",
    aparato: navigator.userAgent.slice(0, 160),
    creado: serverTimestamp(),
  });
  try {
    localStorage.setItem(CLAVE_LOCAL, id);
  } catch {
    /* sin almacenamiento */
  }
  return "activos";
}

export async function desactivarAvisos(uid: string): Promise<EstadoAvisos> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deleteDoc(doc(db, "jugadores", uid, "avisos", await idDe(sub.endpoint))).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "apagados";
}

/** Pide al servidor que avise al celular de otra persona (invitación o solicitud recién hecha). */
export function pedirAviso(datos: { tipo: "sala" | "partida" | "solicitud"; para: string; de?: string; sala?: string; partida?: string }) {
  fetch("/api/aviso", { method: "POST", body: JSON.stringify(datos), keepalive: true }).catch(() => {});
}

/** Avisa al servidor que una partida terminó (para quitarla de «Tus partidas en curso» de todos). */
export function avisarFinDePartida(sala: string, partida: string) {
  const base = partida.replace(/-r(\d+)$/, "");
  const ronda = Number(partida.match(/-r(\d+)$/)?.[1] ?? 1);
  fetch("/api/turno", { method: "POST", body: JSON.stringify({ sala, partida: base, ronda, fin: true }), keepalive: true }).catch(() => {});
}
