/** Salas visitadas en este navegador, para volver sin buscar el enlace. */
export interface SalaReciente {
  codigo: string;
  nombre: string;
  visitada: number;
}

const CLAVE = "lobby_salas_recientes";
const MAXIMO = 6;

export function leerRecientes(): SalaReciente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as SalaReciente[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function recordarSala(codigo: string, nombre: string) {
  const lista = [{ codigo, nombre, visitada: Date.now() }, ...leerRecientes().filter((s) => s.codigo !== codigo)];
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAXIMO)));
  } catch {
    /* sin almacenamiento */
  }
}

export function olvidarSala(codigo: string) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(leerRecientes().filter((s) => s.codigo !== codigo)));
  } catch {
    /* sin almacenamiento */
  }
}
