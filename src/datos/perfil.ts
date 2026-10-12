/** Cálculos de la página de perfil a partir de tu historial. */
import type { EntradaHistorial } from "../firebase/tipos";

export interface EstadisticaJuego {
  juego: string;
  partidas: number;
  victorias: number;
  empates: number;
  mejorPuntaje: number | null;
  retos: number;
  mejorReto: number | null;
  mediaReto: number | null;
  ultima: number;
}

export function porJuego(historial: EntradaHistorial[]): EstadisticaJuego[] {
  const m = new Map<string, EstadisticaJuego & { sumaReto: number }>();
  for (const e of historial) {
    const f = m.get(e.juego) ?? { juego: e.juego, partidas: 0, victorias: 0, empates: 0, mejorPuntaje: null, retos: 0, mejorReto: null, mediaReto: null, ultima: 0, sumaReto: 0 };
    f.ultima = Math.max(f.ultima, e.fecha?.toMillis() ?? 0);
    if (e.tipo === "reto") {
      f.retos++;
      if (e.puntaje !== null) {
        f.sumaReto += e.puntaje;
        f.mejorReto = Math.max(f.mejorReto ?? -Infinity, e.puntaje);
      }
    } else {
      f.partidas++;
      if (e.gano) f.victorias++;
      if (e.empate) f.empates++;
      if (e.puntaje !== null) f.mejorPuntaje = Math.max(f.mejorPuntaje ?? -Infinity, e.puntaje);
    }
    m.set(e.juego, f);
  }
  return [...m.values()]
    .map(({ sumaReto, ...f }) => ({ ...f, mediaReto: f.retos ? Math.round(sumaReto / f.retos) : null }))
    .sort((a, b) => b.partidas + b.retos - (a.partidas + a.retos) || b.ultima - a.ultima);
}

export interface Rival {
  uid: string;
  nombre: string;
  partidas: number;
  /** Partidas donde ganaste tú y no esa persona. */
  ganadas: number;
  /** Partidas donde ganó esa persona y no tú. */
  perdidas: number;
  /** Partidas donde ganaron los dos (mismo equipo). */
  juntos: number;
}

/** Récord cara a cara contra cada persona con la que jugaste, de más a menos partidas juntos. */
export function caraACara(historial: EntradaHistorial[], uid: string): Rival[] {
  const m = new Map<string, Rival>();
  for (const e of historial) {
    if (e.tipo !== "partida") continue;
    for (const j of e.jugadores) {
      if (j.uid === uid) continue;
      const r = m.get(j.uid) ?? { uid: j.uid, nombre: j.nombre, partidas: 0, ganadas: 0, perdidas: 0, juntos: 0 };
      r.partidas++;
      if (e.gano && !j.gano) r.ganadas++;
      else if (j.gano && !e.gano) r.perdidas++;
      else if (j.gano && e.gano) r.juntos++;
      m.set(j.uid, r);
    }
  }
  return [...m.values()].sort((a, b) => b.partidas - a.partidas || b.ganadas - a.ganadas);
}

export function resumenGeneral(historial: EntradaHistorial[]) {
  const partidas = historial.filter((e) => e.tipo === "partida");
  const victorias = partidas.filter((e) => e.gano).length;
  const juegos = porJuego(historial);
  return {
    partidas: partidas.length,
    victorias,
    porcentaje: partidas.length ? Math.round((victorias / partidas.length) * 100) : null,
    retos: historial.length - partidas.length,
    favorito: juegos[0]?.juego ?? null,
  };
}
