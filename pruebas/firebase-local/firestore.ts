// Firestore simulado: solo lo que usa el lobby. Las pestañas se sincronizan por el evento `storage`.
type Datos = Record<string, any>;
type Ref = { ruta: string; id: string };
type Coleccion = { coleccion: string };
type Consulta = { coleccion: string; orden?: string; ultimos?: number };

const CLAVE = "lobby_local_db";
const SERVER = { __servidor: true };
const BORRAR = { __borrar: true };
type Incremento = { __incremento: number };

export class Timestamp {
  static now() { return new Timestamp(Date.now()); }
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
export const increment = (n: number): Incremento => ({ __incremento: n });
export const doc = (base: any, ...partes: string[]): Ref => {
  // doc(coleccion) sin id: Firestore genera uno nuevo.
  if (base && typeof base === "object" && "coleccion" in base) {
    const id = partes[0] ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return { ruta: `${base.coleccion}/${id}`, id };
  }
  return { ruta: partes.join("/"), id: partes[partes.length - 1] };
};
export const collection = (_db: unknown, ...partes: string[]): Coleccion => ({ coleccion: partes.join("/") });
export const orderBy = (campo: string) => ({ orden: campo });
export const limitToLast = (n: number) => ({ ultimos: n });
export const query = (c: Coleccion, ...mods: any[]): Consulta => Object.assign({ coleccion: c.coleccion }, ...mods);

function snap(r: Ref) {
  const d = leerDB()[r.ruta];
  return {
    id: r.id,
    metadata: { hasPendingWrites: false, fromCache: false },
    exists: () => d !== undefined,
    data: () => (d === undefined ? undefined : revivir(d)),
  };
}
export const getDoc = async (r: Ref) => snap(r);

// Mezcla profunda como `setDoc(..., { merge: true })`, con soporte de increment().
function mezclar(actual: any, nuevo: any): any {
  if (nuevo && typeof nuevo === "object" && "__incremento" in nuevo) return (typeof actual === "number" ? actual : 0) + nuevo.__incremento;
  if (nuevo === SERVER || nuevo?.__servidor || nuevo === BORRAR || nuevo?.__borrar || Array.isArray(nuevo)) return nuevo;
  if (nuevo && typeof nuevo === "object") {
    const o: any = actual && typeof actual === "object" && !Array.isArray(actual) && !("__ms" in actual) ? { ...actual } : {};
    for (const k of Object.keys(nuevo)) o[k] = mezclar(o[k], nuevo[k]);
    return o;
  }
  return nuevo;
}
function escribir(r: Ref, datos: Datos, merge: boolean) {
  const db = leerDB();
  db[r.ruta] = resolver(merge ? mezclar(db[r.ruta] ?? {}, datos) : mezclar({}, datos));
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

export async function deleteDoc(r: Ref) {
  const db = leerDB();
  delete db[r.ruta];
  guardarDB(db);
}

export async function addDoc(c: Coleccion, d: Datos) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  escribir({ ruta: `${c.coleccion}/${id}`, id }, d, false);
  return { id };
}

export function writeBatch(_db?: unknown) {
  const ops: (() => void | Promise<void>)[] = [];
  return {
    set(r: Ref, d: Datos, o?: { merge?: boolean }) { ops.push(() => escribir(r, d, Boolean(o?.merge))); return this; },
    delete(r: Ref) { ops.push(() => deleteDoc(r)); return this; },
    async commit() { for (const op of ops) await op(); },
  };
}

export async function runTransaction<T>(_db: unknown, fn: (tx: any) => Promise<T>): Promise<T> {
  return fn({ get: async (r: Ref) => snap(r), set: (r: Ref, d: Datos, o?: { merge?: boolean }) => escribir(r, d, Boolean(o?.merge)) });
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

export function onSnapshot(r: Ref | Consulta, ...args: any[]) {
  const cb: (s: any) => void = args.find((a) => typeof a === "function");
  const emitir = () => cb("ruta" in r ? snap(r) : resultado(r));
  oyentes.add(emitir);
  queueMicrotask(emitir);
  return () => { oyentes.delete(emitir); };
}

// Referencia con la cadena de padres (documento → colección → documento …), como en Firestore.
function refDe(partes: string[]): any {
  if (!partes.length) return null;
  const coleccion = (p: string[]): any => ({ id: p[p.length - 1], parent: p.length > 1 ? refDe(p.slice(0, -1)) : null });
  return { id: partes[partes.length - 1], parent: coleccion(partes.slice(0, -1)) };
}

// Consultas de grupo y lecturas puntuales (panel de playtest).
export const collectionGroup = (_db: unknown, nombre: string) => ({ grupo: nombre });
export async function getDocs(q: Consulta | { grupo: string }) {
  if (!("grupo" in q)) return resultado(q);
  const db = leerDB();
  const docs = Object.keys(db)
    .map((k) => k.split("/"))
    .filter((partes) => partes.length >= 2 && partes[partes.length - 2] === q.grupo)
    .map((partes) => {
      const ruta = partes.join("/");
      return {
        id: partes[partes.length - 1],
        ref: refDe(partes),
        data: () => revivir(db[ruta]),
      };
    });
  return { docs };
}
