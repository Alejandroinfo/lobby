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

export interface DatosPanel {
  partidas: PartidaPanel[];
  resultados: ResultadoPanel[];
  encuestas: EncuestaPanel[];
  perfiles: Record<string, Perfil>;
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
