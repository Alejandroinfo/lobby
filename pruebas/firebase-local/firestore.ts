// Firestore simulado: solo lo que usa el lobby. Las pestañas se sincronizan por el evento `storage`.
type Datos = Record<string, any>;
type Ref = { ruta: string; id: string };
type Coleccion = { coleccion: string };
type Consulta = { coleccion: string; orden?: string; ultimos?: number };

const CLAVE = "lobby_local_db";
const SERVER = { __servidor: true };
const BORRAR = { __borrar: true };

class Timestamp {
  constructor(private ms: number) {}
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
}

function leerDB(): Record<string, Datos> {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? "{}"); } catch { return {}; }
}
function revivir(v: any): any {
  if (v && typeof v === "object") {
    if ("__ms" in v) return new Timestamp(v.__ms);
    const o: any = Array.isArray(v) ? [] : {};
    for (const k of Object.keys(v)) o[k] = revivir(v[k]);
    return o;
  }
  return v;
}
function resolver(v: any): any {
  if (v === SERVER || v?.__servidor) return { __ms: Date.now() };
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o: any = {};
    for (const k of Object.keys(v)) if (!(v[k] === BORRAR || v[k]?.__borrar)) o[k] = resolver(v[k]);
    return o;
  }
  return v;
}

const oyentes = new Set<() => void>();
function guardarDB(db: Record<string, Datos>) {
  localStorage.setItem(CLAVE, JSON.stringify(db));
  oyentes.forEach((f) => f());
}
window.addEventListener("storage", (e) => { if (e.key === CLAVE) oyentes.forEach((f) => f()); });

export const getFirestore = (..._: unknown[]) => ({});
export const connectFirestoreEmulator = (..._: unknown[]) => {};
export const serverTimestamp = () => SERVER;
export const deleteField = () => BORRAR;
export const doc = (_db: unknown, ...partes: string[]): Ref => ({ ruta: partes.join("/"), id: partes[partes.length - 1] });
export const collection = (_db: unknown, ...partes: string[]): Coleccion => ({ coleccion: partes.join("/") });
export const orderBy = (campo: string) => ({ orden: campo });
export const limitToLast = (n: number) => ({ ultimos: n });
export const query = (c: Coleccion, ...mods: any[]): Consulta => Object.assign({ coleccion: c.coleccion }, ...mods);

function snap(r: Ref) {
  const d = leerDB()[r.ruta];
  return { id: r.id, exists: () => d !== undefined, data: () => (d === undefined ? undefined : revivir(d)) };
}
export const getDoc = async (r: Ref) => snap(r);

function escribir(r: Ref, datos: Datos, merge: boolean) {
  const db = leerDB();
  db[r.ruta] = resolver(merge ? { ...(db[r.ruta] ?? {}), ...datos } : datos);
  guardarDB(db);
}
export const setDoc = async (r: Ref, d: Datos, o?: { merge?: boolean }) => escribir(r, d, Boolean(o?.merge));

export async function updateDoc(r: Ref, cambios: Datos) {
  const db = leerDB();
  const actual = db[r.ruta];
  if (!actual) throw new Error("not-found");
  for (const [ruta, valor] of Object.entries(cambios)) {
    const partes = ruta.split(".");
    let o = actual;
    for (const p of partes.slice(0, -1)) o = o[p] ??= {};
    const ultima = partes[partes.length - 1];
    if (valor === BORRAR) delete o[ultima];
    else o[ultima] = resolver(valor);
  }
  guardarDB(db);
}

export async function addDoc(c: Coleccion, d: Datos) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  escribir({ ruta: `${c.coleccion}/${id}`, id }, d, false);
  return { id };
}

export async function runTransaction<T>(_db: unknown, fn: (tx: any) => Promise<T>): Promise<T> {
  return fn({ get: async (r: Ref) => snap(r), set: (r: Ref, d: Datos) => escribir(r, d, false) });
}

function resultado(q: Consulta) {
  const db = leerDB();
  const prefijo = q.coleccion + "/";
  let docs = Object.keys(db)
    .filter((k) => k.startsWith(prefijo) && !k.slice(prefijo.length).includes("/"))
    .map((k) => ({ id: k.slice(prefijo.length), d: db[k] }));
  if (q.orden) docs.sort((a, b) => (a.d[q.orden!]?.__ms ?? 0) - (b.d[q.orden!]?.__ms ?? 0));
  if (q.ultimos) docs = docs.slice(-q.ultimos);
  return { docs: docs.map((x) => ({ id: x.id, data: () => revivir(x.d) })) };
}

export function onSnapshot(r: Ref | Consulta, cb: (s: any) => void) {
  const emitir = () => cb("ruta" in r ? snap(r) : resultado(r));
  oyentes.add(emitir);
  queueMicrotask(emitir);
  return () => { oyentes.delete(emitir); };
}
