/** Cálculos del panel de playtest a partir de partidas, resultados, encuestas y perfiles. */
import type { Encuesta, Partida, Perfil } from "../firebase/tipos";

export interface PartidaPanel extends Partida {
  sala: string;
}
export interface ResultadoPanel {
  partida: string;
  uid: string;
  asiento: number;
  ganadores: number[];
  puntajes: Record<string, number>;
  duracionSeg: number | null;
  version: string | null;
  detalleJson: string;
}
export interface EncuestaPanel extends Encuesta {
  partida: string;
  uid: string;
}

/** Primer intento de una persona en un reto (en solitario, con semilla). */
export interface MarcaPanel {
  sala: string;
  reto: string;
  uid: string;
  nombre: string;
  puntaje: number;
  version: string | null;
  detalleJson: string;
  hora: { toMillis(): number; toDate(): Date } | null;
}

export interface DatosPanel {
  partidas: PartidaPanel[];
  resultados: ResultadoPanel[];
  encuestas: EncuestaPanel[];
  perfiles: Record<string, Perfil>;
  marcas: MarcaPanel[];
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Minutos reales de una partida: de "Lanzar" a la llegada del resultado (o a "Terminar"). */
export function minutos(p: Partida): number | null {
  const ini = p.iniciada?.toMillis();
  const fin = p.terminada?.toMillis();
  if (!ini || !fin || fin <= ini) return null;
  return (fin - ini) / 60_000;
}

export function versionDe(p: PartidaPanel, resultados: ResultadoPanel[]): string {
  return resultados.find((r) => r.partida === p.id && r.version)?.version ?? "sin versión";
}

export function contar<T extends string>(valores: (T | null | undefined)[]): [T, number][] {
  const m = new Map<T, number>();
  for (const v of valores) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export interface Resumen {
  partidas: number;
  minutosMediana: number | null;
  diversion: number | null;
  claridad: number | null;
  encuestas: number;
  personas: number;
  paises: number;
}

export function resumen(d: DatosPanel): Resumen {
  const terminadas = d.partidas.filter((p) => p.estado === "terminada");
  const personas = new Set(terminadas.flatMap((p) => Object.entries(p.invitados).filter(([, i]) => i.respuesta === "acepta").map(([u]) => u)));
  const paises = new Set([...personas].map((u) => d.perfiles[u]?.pais).filter(Boolean));
  return {
    partidas: terminadas.length,
    minutosMediana: mediana(terminadas.map(minutos).filter((x): x is number => x !== null)),
    diversion: media(d.encuestas.map((e) => e.diversion).filter((x): x is number => x !== null)),
    claridad: media(d.encuestas.map((e) => e.claridad).filter((x): x is number => x !== null)),
    encuestas: d.encuestas.length,
    personas: personas.size,
    paises: paises.size,
  };
}

/** Por versión de reglas: cuántas partidas, minutos y notas medias. */
export function porVersion(d: DatosPanel) {
  const grupos = new Map<string, PartidaPanel[]>();
  for (const p of d.partidas.filter((x) => x.estado === "terminada")) {
    const v = versionDe(p, d.resultados);
    grupos.set(v, [...(grupos.get(v) ?? []), p]);
  }
  return [...grupos.entries()]
    .map(([version, ps]) => {
      const ids = new Set(ps.map((p) => p.id));
      const enc = d.encuestas.filter((e) => ids.has(e.partida));
      return {
        version,
        partidas: ps.length,
        minutos: mediana(ps.map(minutos).filter((x): x is number => x !== null)),
        diversion: media(enc.map((e) => e.diversion).filter((x): x is number => x !== null)),
        claridad: media(enc.map((e) => e.claridad).filter((x): x is number => x !== null)),
        encuestas: enc.length,
      };
    })
    .sort((a, b) => b.version.localeCompare(a.version));
}

/** Victorias por asiento (¿hay ventaja por jugar primero?), separado por número de jugadores. */
export function victoriasPorAsiento(d: DatosPanel) {
  const filas = new Map<number, { partidas: number; victorias: number[] }>();
  for (const p of d.partidas) {
    if (p.estado !== "terminada" || !p.resultado) continue;
    const n = Object.values(p.invitados).filter((i) => i.respuesta === "acepta" && i.rol === "jugador").length;
    if (!n) continue;
    const fila = filas.get(n) ?? { partidas: 0, victorias: Array(n).fill(0) };
    fila.partidas++;
    // Empate de todos = no cuenta como victoria de nadie.
    if (p.resultado.ganadores.length < n) for (const a of p.resultado.ganadores) if (a < n) fila.victorias[a]++;
    filas.set(n, fila);
  }
  return [...filas.entries()].sort((a, b) => a[0] - b[0]).map(([jugadores, f]) => ({ jugadores, ...f }));
}

// ── Habilidades (juegos que informan qué habilidad tuvo cada jugador, p. ej. Split Loyalty) ──

interface JugadorResumen {
  abilityIds?: unknown;
  abilities?: unknown;
  abilitiesUsed?: Record<string, number>;
  totalScore?: unknown;
}
function jugadoresDe(detalleJson: string): JugadorResumen[] {
  try {
    const d = JSON.parse(detalleJson) as { players?: JugadorResumen[]; testMode?: boolean } | null;
    if (!d || d.testMode || !Array.isArray(d.players)) return [];
    return d.players;
  } catch {
    return [];
  }
}
/** Lista de [clave, nombre visible] de las habilidades de un jugador. */
function habilidadesDe(j: JugadorResumen): [string, string][] {
  const nombres = Array.isArray(j.abilities) ? j.abilities.filter((x): x is string => typeof x === "string") : [];
  const ids = Array.isArray(j.abilityIds) ? j.abilityIds.filter((x): x is string => typeof x === "string") : [];
  if (ids.length) return ids.map((id, i) => [id, nombres[i] ?? id]);
  return nombres.map((n) => [n, n]);
}

export interface FilaHabilidad {
  clave: string;
  nombre: string;
  /** Veces que alguien la tuvo (partidas + retos). */
  elegida: number;
  partidas: number;
  victorias: number;
  /** % de victorias que se esperaría por azar (1 / jugadores), promediado. */
  esperado: number | null;
  puntajePartidas: number | null;
  puntajeRetos: number | null;
  usosMedios: number | null;
}

export function habilidades(d: DatosPanel): FilaHabilidad[] {
  const filas = new Map<string, { nombre: string; elegida: number; partidas: number; victorias: number; esperado: number[]; pp: number[]; pr: number[]; usos: number[] }>();
  const fila = (clave: string, nombre: string) => {
    let f = filas.get(clave);
    if (!f) filas.set(clave, (f = { nombre, elegida: 0, partidas: 0, victorias: 0, esperado: [], pp: [], pr: [], usos: [] }));
    return f;
  };
  // Partidas: un resultado por partida basta (todos los jugadores reciben el mismo resumen).
  const vistas = new Set<string>();
  const porId = new Map(d.partidas.map((p) => [p.id, p]));
  for (const r of d.resultados) {
    if (vistas.has(r.partida)) continue;
    vistas.add(r.partida);
    const jugadores = jugadoresDe(r.detalleJson);
    const ganadores = porId.get(r.partida)?.resultado?.ganadores ?? r.ganadores ?? [];
    jugadores.forEach((j, asiento) => {
      for (const [clave, nombre] of habilidadesDe(j)) {
        const f = fila(clave, nombre);
        f.elegida++;
        f.partidas++;
        if (ganadores.includes(asiento) && ganadores.length < jugadores.length) f.victorias++;
        f.esperado.push(1 / jugadores.length);
        if (typeof j.totalScore === "number") f.pp.push(j.totalScore);
        f.usos.push(j.abilitiesUsed?.[clave] ?? 0);
      }
    });
  }
  // Retos: solo el jugador humano (asiento 0).
  for (const m of d.marcas) {
    const j = jugadoresDe(m.detalleJson)[0];
    if (!j) continue;
    for (const [clave, nombre] of habilidadesDe(j)) {
      const f = fila(clave, nombre);
      f.elegida++;
      f.pr.push(m.puntaje);
      f.usos.push(j.abilitiesUsed?.[clave] ?? 0);
    }
  }
  return [...filas.entries()]
    .map(([clave, f]) => ({
      clave,
      nombre: f.nombre,
      elegida: f.elegida,
      partidas: f.partidas,
      victorias: f.victorias,
      esperado: media(f.esperado),
      puntajePartidas: media(f.pp),
      puntajeRetos: media(f.pr),
      usosMedios: media(f.usos),
    }))
    .sort((a, b) => b.elegida - a.elegida || a.nombre.localeCompare(b.nombre));
}

export interface ResumenRetos {
  intentos: number;
  personas: number;
  retos: number;
  media: number | null;
  mejor: number | null;
}
export function resumenRetos(d: DatosPanel): ResumenRetos {
  const puntajes = d.marcas.map((m) => m.puntaje);
  return {
    intentos: d.marcas.length,
    personas: new Set(d.marcas.map((m) => m.uid)).size,
    retos: new Set(d.marcas.map((m) => `${m.sala}/${m.reto}`)).size,
    media: media(puntajes),
    mejor: puntajes.length ? Math.max(...puntajes) : null,
  };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

function celda(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(cabecera: string[], filas: unknown[][]): string {
  return [cabecera, ...filas].map((f) => f.map(celda).join(",")).join("\n") + "\n";
}

export function csvPartidas(d: DatosPanel): string {
  const filas = d.partidas
    .filter((p) => p.estado === "terminada")
    .map((p) => {
      const jugadores = Object.values(p.invitados)
        .filter((i) => i.respuesta === "acepta" && i.rol === "jugador")
        .sort((a, b) => (a.asiento ?? 0) - (b.asiento ?? 0));
      const res = d.resultados.find((r) => r.partida === p.id);
      return [
        p.id,
        p.sala,
        p.juego,
        p.variante ?? "",
        versionDe(p, d.resultados),
        p.iniciada?.toDate().toISOString() ?? "",
        minutos(p)?.toFixed(1) ?? "",
        jugadores.length,
        jugadores.map((i) => i.nombre).join(" | "),
        (p.resultado?.ganadores ?? []).map((a) => a + 1).join(" "),
        jugadores.map((i) => p.resultado?.puntajes?.[String(i.asiento)] ?? "").join(" | "),
        res?.detalleJson ?? "",
      ];
    });
  return csv(
    ["partida", "sala", "juego", "modo", "version", "inicio", "minutos", "jugadores", "nombres_por_asiento", "asientos_ganadores", "puntajes_por_asiento", "detalle_json"],
    filas,
  );
}

export function csvEncuestas(d: DatosPanel): string {
  const porId = new Map(d.partidas.map((p) => [p.id, p]));
  const filas = d.encuestas.map((e) => {
    const p = porId.get(e.partida);
    const perfil = d.perfiles[e.uid];
    return [
      e.partida,
      e.juego,
      p ? versionDe(p, d.resultados) : "",
      e.hora?.toDate().toISOString() ?? "",
      e.diversion ?? "",
      e.claridad ?? "",
      e.duracion ?? "",
      Object.entries(e.extra ?? {}).map(([k, v]) => `${k}=${v}`).join("; "),
      e.comentario,
      perfil?.pais ?? "",
      perfil?.rangoEdad ?? "",
      perfil?.experiencia ?? "",
    ];
  });
  return csv(["partida", "juego", "version", "hora", "diversion", "claridad", "duracion", "preguntas_propias", "comentario", "pais", "edad", "experiencia"], filas);
}

export function descargar(nombre: string, contenido: string) {
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
