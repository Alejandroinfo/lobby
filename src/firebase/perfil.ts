/** Perfil personal: avatar e historial de partidas y retos (`jugadores/{uid}` y su historial). */
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limitToLast, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";
import { borrarDatosSociales } from "./amigos";
import type { Avatar, Carrera, EntradaHistorial, EstadisticaGuardada, Ficha, Perfil, RivalGuardado, TipoJugador } from "./tipos";

export const EMOJIS = ["🕵️", "🚀", "🦊", "🐙", "🦉", "🐉", "🌙", "⭐", "🎲", "🃏", "🧭", "🔭", "🎩", "🐺", "🦜", "🍀"];
export const COLORES = ["#2f6b4f", "#3a6ea5", "#7d5ba6", "#c9648f", "#d97a3e", "#b8801f", "#4c9a6a", "#5f6268"];

/** Avatar por defecto: se deriva del uid, así cada persona tiene uno distinto desde el principio. */
export function avatarPorDefecto(uid: string): Avatar {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { emoji: EMOJIS[h % EMOJIS.length], color: COLORES[(h >>> 4) % COLORES.length] };
}

/** Tu perfil en tiempo real (se actualiza al ganar condecoraciones, cambiar avatar, etc.). */
export function usePerfil(uid: string | null) {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "jugadores", uid),
      (d) => setPerfil(d.exists() ? (d.data() as Perfil) : null),
      () => setPerfil(null),
    );
  }, [uid]);
  return perfil;
}

export async function guardarAvatar(uid: string, avatar: Avatar) {
  await setDoc(doc(db, "jugadores", uid), { avatar }, { merge: true });
}

export async function registrarEnHistorial(uid: string, id: string, e: Omit<EntradaHistorial, "id" | "fecha">) {
  await setDoc(doc(db, "jugadores", uid, "historial", id.slice(0, 100)), { ...e, fecha: serverTimestamp() });
}

/** Las últimas `n` entradas de tu historial, de la más nueva a la más vieja. */
export async function leerHistorial(uid: string, n = 300): Promise<EntradaHistorial[]> {
  const snap = await getDocs(query(collection(db, "jugadores", uid, "historial"), orderBy("fecha"), limitToLast(n)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EntradaHistorial, "id">) })).reverse();
}

// ── Ficha visible para otros ───────────────────────────────────────────────────

/** Menores de 18 tienen la ficha siempre privada. */
export function esMenor(p: Perfil | null | undefined): boolean {
  return p?.rangoEdad === "menos-13" || p?.rangoEdad === "13-17";
}
export function fichaEsVisible(p: Perfil | null | undefined): boolean {
  return !esMenor(p) && p?.fichaVisible !== false;
}

/**
 * Copia en `perfiles/{uid}` lo que otros pueden ver de ti (o solo `visible: false`).
 * Se llama cada vez que cambia tu perfil; si no cambió nada, no escribe.
 */
let ultimaFicha = "";
export async function publicarFicha(uid: string, p: Perfil, nombre: string) {
  const visible = fichaEsVisible(p);
  const ficha: Ficha = visible
    ? {
        visible: true,
        nombre: nombre || p.nombre,
        avatar: p.avatar ?? avatarPorDefecto(uid),
        partidas: p.carrera?.partidas ?? 0,
        victorias: p.carrera?.victorias ?? 0,
        retos: p.carrera?.retos ?? 0,
        logros: p.carrera?.logros ?? {},
      }
    : { visible: false };
  const clave = uid + JSON.stringify(ficha);
  if (clave === ultimaFicha) return;
  ultimaFicha = clave;
  await setDoc(doc(db, "perfiles", uid), ficha); // sin merge: al ocultarla se borra todo lo demás
}

/** La ficha de otra persona, o null si es privada o no existe. */
export async function leerFicha(uid: string): Promise<Ficha | null> {
  try {
    const d = await getDoc(doc(db, "perfiles", uid));
    const f = d.exists() ? (d.data() as Ficha) : null;
    return f?.visible ? f : null;
  } catch {
    return null; // privada: las reglas no dejan leerla
  }
}

export async function guardarPreferencias(uid: string, cambios: { fichaVisible?: boolean; tipoJugador?: TipoJugador }) {
  await setDoc(doc(db, "jugadores", uid), cambios, { merge: true });
}

// ── Tus datos: descargar y borrar ──────────────────────────────────────────────

/** Fechas en las que pudiste jugar el reto del día: las de tu historial y los últimos días. */
function fechasDeRetos(historial: EntradaHistorial[], ultimos = 14, delPerfil: string[] = []): string[] {
  const hoy = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  const recientes = Array.from({ length: ultimos }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  });
  const delHistorial = historial.filter((e) => e.id.startsWith("reto-diario-")).map((e) => e.id.slice(12));
  return [...new Set([...delPerfil, ...delHistorial, ...recientes])];
}

/** Todo lo que el lobby guarda asociado a tu cuenta y que puedes leer, en un objeto. */
export async function exportarMisDatos(uid: string) {
  const perfil = await getDoc(doc(db, "jugadores", uid));
  const ficha = await getDoc(doc(db, "perfiles", uid)).catch(() => null);
  const historial = await leerHistorial(uid, 10_000);
  const marcas = (
    await Promise.all(fechasDeRetos(historial, 14, Object.keys((perfil.data() as Perfil | undefined)?.retosDiarios ?? {})).map(async (f) => {
      const m = await getDoc(doc(db, "retosDiarios", f, "marcas", uid)).catch(() => null);
      return m?.exists() ? { fecha: f, ...m.data() } : null;
    }))
  ).filter(Boolean);
  const plano = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v, (_k, x) => (x && typeof x === "object" && typeof (x as { toDate?: unknown }).toDate === "function" ? (x as { toDate(): Date }).toDate().toISOString() : x)));
  return plano({
    exportado: new Date().toISOString(),
    uid,
    perfil: perfil.exists() ? perfil.data() : null,
    ficha: ficha?.exists() ? ficha.data() : null,
    historial,
    retosDelDia: marcas,
  });
}

/**
 * Borra tu perfil, tu ficha, tu historial y tus marcas del reto del día. Los resultados y
 * encuestas de partidas quedan para el playtest, sin nombre (solo ligados a un uid sin perfil).
 */
export async function borrarMisDatos(uid: string) {
  const historial = await leerHistorial(uid, 10_000);
  const perfil = (await getDoc(doc(db, "jugadores", uid))).data() as Perfil | undefined;
  const fechas = fechasDeRetos(historial, 14, Object.keys(perfil?.retosDiarios ?? {}));
  await Promise.all(fechas.map((f) => deleteDoc(doc(db, "retosDiarios", f, "marcas", uid)).catch(() => {})));
  // y tu fila en el ranking de cada día
  await Promise.all(fechas.map((f) => setDoc(doc(db, "retosDiarios", f), { jugadores: { [uid]: deleteField() } }, { merge: true }).catch(() => {})));
  await Promise.all(historial.map((e) => deleteDoc(doc(db, "jugadores", uid, "historial", e.id)).catch(() => {})));
  await borrarDatosSociales(uid, perfil?.codigoAmigo).catch(() => {});
  // Los avisos al celular de todos tus aparatos.
  const avisos = await getDocs(collection(db, "jugadores", uid, "avisos")).catch(() => null);
  await Promise.all((avisos?.docs ?? []).map((d) => deleteDoc(d.ref).catch(() => {})));
  await deleteDoc(doc(db, "perfiles", uid)).catch(() => {});
  await deleteDoc(doc(db, "jugadores", uid));
  ultimaFicha = "";
}

// ── Totales del perfil: se suman al terminar (una transacción, sin releer el historial) ──

const VACIA: EstadisticaGuardada = { partidas: 0, victorias: 0, empates: 0, mejor: null, retos: 0, mejorReto: null, sumaReto: 0 };

export interface FinDePartida {
  juego: string;
  tipo: "partida" | "reto";
  gano: boolean;
  empate: boolean;
  puntaje: number | null;
  logros: string[];
  jugadores: { uid: string; nombre: string; gano: boolean }[];
  /** Reto del día: su fecha ("AAAA-MM-DD"). */
  fechaReto?: string;
}

/** Aplica una partida o reto terminado a los totales (carrera, estadísticas, rivales, retos del día). */
export function aplicarFin(p: Perfil, uid: string, f: FinDePartida) {
  const carrera: Carrera = { ...(p.carrera ?? {}) };
  carrera.partidas = (carrera.partidas ?? 0) + 1;
  if (f.gano) carrera.victorias = (carrera.victorias ?? 0) + 1;
  if (f.tipo === "reto") carrera.retos = (carrera.retos ?? 0) + 1;
  if (f.logros.length) {
    carrera.logros = { ...(carrera.logros ?? {}) };
    for (const id of f.logros) carrera.logros[`${f.juego}:${id}`] = (carrera.logros[`${f.juego}:${id}`] ?? 0) + 1;
  }
  const estadisticas = { ...(p.estadisticas ?? {}) };
  const e = { ...VACIA, ...(estadisticas[f.juego] ?? {}) };
  if (f.tipo === "reto") {
    e.retos++;
    if (f.puntaje !== null) {
      e.sumaReto += f.puntaje;
      e.mejorReto = Math.max(e.mejorReto ?? -Infinity, f.puntaje);
    }
  } else {
    e.partidas++;
    if (f.gano) e.victorias++;
    if (f.empate) e.empates++;
    if (f.puntaje !== null) e.mejor = Math.max(e.mejor ?? -Infinity, f.puntaje);
  }
  estadisticas[f.juego] = e;
  const rivales = { ...(p.rivales ?? {}) };
  for (const j of f.jugadores) {
    if (j.uid === uid) continue;
    const r: RivalGuardado = { ...{ n: j.nombre, partidas: 0, ganadas: 0, perdidas: 0, juntos: 0 }, ...(rivales[j.uid] ?? {}), n: j.nombre };
    r.partidas++;
    if (f.gano && !j.gano) r.ganadas++;
    else if (j.gano && !f.gano) r.perdidas++;
    else if (j.gano && f.gano) r.juntos++;
    rivales[j.uid] = r;
  }
  const cambios: Partial<Perfil> = { carrera, estadisticas, rivales };
  if (f.fechaReto && f.puntaje !== null) cambios.retosDiarios = { ...(p.retosDiarios ?? {}), [f.fechaReto]: f.puntaje };
  return cambios;
}

export async function sumarAlPerfil(uid: string, f: FinDePartida) {
  const ref = doc(db, "jugadores", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const p = (snap.exists() ? snap.data() : {}) as Perfil;
    tx.set(ref, aplicarFin(p, uid, f), { merge: true });
  });
}

/**
 * Perfiles creados antes de los totales: se calculan una vez desde el historial (y las marcas del
 * reto del día que haya) y se guardan. Después ya no se relee el historial.
 */
export async function completarTotales(uid: string, p: Perfil) {
  if (p.estadisticas) return;
  const historial = await leerHistorial(uid, 300);
  let base: Perfil = { nombre: p.nombre, carrera: p.carrera };
  for (const h of [...historial].reverse()) {
    const fin: FinDePartida = {
      juego: h.juego,
      tipo: h.tipo,
      gano: h.gano,
      empate: h.empate,
      puntaje: h.puntaje,
      logros: [],
      jugadores: h.jugadores,
      fechaReto: h.id.startsWith("reto-diario-") ? h.id.slice(12) : undefined,
    };
    const c = aplicarFin(base, uid, fin);
    base = { ...base, ...c, carrera: p.carrera }; // la carrera ya estaba sumada: no se toca
  }
  await setDoc(
    doc(db, "jugadores", uid),
    { estadisticas: base.estadisticas ?? {}, rivales: base.rivales ?? {}, retosDiarios: { ...(base.retosDiarios ?? {}), ...(p.retosDiarios ?? {}) } },
    { merge: true },
  );
}
