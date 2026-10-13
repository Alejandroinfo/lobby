/**
 * Reportes de problemas: lo que escribe la persona + lo que se adjunta solo (dónde estaba, con qué
 * aparato, errores técnicos y, desde un juego, su registro completo para reproducir la partida).
 * Se guardan en `reportes/{id}` (solo los lee el panel). Sin conexión, quedan en el celular y se
 * envían al volver. Cada reporte nuevo avisa por correo (api/reporte.js).
 */
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from "firebase/firestore";
import { db } from "./config";

export type TipoReporte = "reglas" | "trabado" | "visual" | "otro";
export type EstadoReporte = "nuevo" | "visto" | "resuelto";

/** Lo que aporta quien abre el formulario (el lobby o un juego). */
export interface ContextoReporte {
  juego: string | null;
  version: string | null;
  donde: Record<string, string | number | null>;
  /** Registro de la partida (texto o JSON) y el nombre con que se descarga. */
  registro: string | null;
  nombreRegistro: string | null;
  errores: string[];
  /** Nombre de quien juega (desde un juego: el que trae del lobby). */
  nombre?: string;
}

export interface DatosReporte extends ContextoReporte {
  tipo: TipoReporte;
  que: string;
  esperaba: string;
  captura: string | null;
}

export interface Reporte extends DatosReporte {
  id: string;
  uid: string;
  nombre: string;
  dispositivo: Record<string, string | number | boolean | null>;
  estado: EstadoReporte;
  creado: Timestamp | null;
}

const MAX_REGISTRO = 600_000;
const CLAVE_COLA = "lobby_reportes_pendientes";

/** Un registro muy largo se guarda con el principio y lo más reciente (que es lo que más sirve). */
function recortar(texto: string | null): string | null {
  if (!texto) return null;
  if (texto.length <= MAX_REGISTRO) return texto;
  const corte = "\n\n[… registro recortado: era demasiado largo …]\n\n";
  return texto.slice(0, 80_000) + corte + texto.slice(-(MAX_REGISTRO - 80_000 - corte.length));
}

export function dispositivo(): Reporte["dispositivo"] {
  const app = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    navegador: navigator.userAgent.slice(0, 300),
    pantalla: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    app: Boolean(app),
    enLinea: navigator.onLine,
    idioma: navigator.language,
    url: (window.location.pathname + window.location.search).slice(0, 300),
  };
}

function documento(uid: string, nombre: string, d: DatosReporte, disp: Reporte["dispositivo"]) {
  return {
    uid,
    nombre: (d.nombre || nombre || "").slice(0, 40),
    tipo: d.tipo,
    que: d.que.trim().slice(0, 2000),
    esperaba: d.esperaba.trim().slice(0, 2000),
    juego: d.juego,
    version: d.version?.slice(0, 40) ?? null,
    donde: d.donde,
    dispositivo: disp,
    errores: d.errores.slice(-10).map((e) => e.slice(0, 1200)),
    registro: recortar(d.registro),
    nombreRegistro: d.nombreRegistro?.slice(0, 80) ?? null,
    captura: d.captura,
    estado: "nuevo",
    creado: serverTimestamp(),
  };
}

/** Avisa por correo (si está configurado en Vercel). No importa si falla: el reporte ya está guardado. */
function avisarPorCorreo(id: string, d: DatosReporte, nombre: string) {
  fetch("/api/reporte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, tipo: d.tipo, juego: d.juego, version: d.version, que: d.que.slice(0, 600), esperaba: d.esperaba.slice(0, 300), nombre, conRegistro: !!d.registro, conCaptura: !!d.captura }),
    keepalive: true,
  }).catch(() => {});
}

export async function enviarReporte(uid: string, nombre: string, d: DatosReporte): Promise<string> {
  const ref = await addDoc(collection(db, "reportes"), documento(uid, nombre, d, dispositivo()));
  avisarPorCorreo(ref.id, d, d.nombre || nombre);
  return ref.id;
}

/** Sin conexión: el reporte se guarda en el celular y se envía al volver. */
export function guardarParaDespues(d: DatosReporte) {
  try {
    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? "[]");
    cola.push({ d: { ...d, registro: recortar(d.registro) }, disp: dispositivo(), hora: Date.now() });
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-5)));
  } catch {
    /* sin espacio: se pierde (es raro) */
  }
}

export async function enviarPendientes(uid: string, nombre: string) {
  let cola: { d: DatosReporte; disp: Reporte["dispositivo"]; hora: number }[] = [];
  try {
    cola = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? "[]");
  } catch {
    return;
  }
  while (cola.length) {
    const { d, disp, hora } = cola[0];
    try {
      const ref = await addDoc(collection(db, "reportes"), {
        ...documento(uid, nombre, d, { ...disp, sinConexionDesde: new Date(hora).toISOString() }),
      });
      avisarPorCorreo(ref.id, d, d.nombre || nombre);
    } catch (e) {
      console.warn("No se pudo enviar un reporte guardado (se reintentará)", e);
      return;
    }
    cola.shift();
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export async function leerReportes(n = 60): Promise<Reporte[]> {
  const snap = await getDocs(query(collection(db, "reportes"), orderBy("creado", "desc"), limit(n)));
  return snap.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<Reporte, "id">) }));
}

export async function cambiarEstado(id: string, estado: EstadoReporte) {
  await updateDoc(doc(db, "reportes", id), { estado });
}

/** Achica una foto a ~1000 px en JPEG para que el reporte pese poco. */
export async function achicarCaptura(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = url;
    });
    for (const [lado, calidad] of [[1000, 0.72], [800, 0.6], [600, 0.5]] as const) {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      const datos = lienzo.toDataURL("image/jpeg", calidad);
      if (datos.length <= 330_000) return datos;
    }
    throw new Error("captura demasiado grande");
  } finally {
    URL.revokeObjectURL(url);
  }
}
