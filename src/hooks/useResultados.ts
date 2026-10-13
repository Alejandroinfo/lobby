/**
 * Recibe el resultado que avisa un juego conectado al terminar:
 *  - por mensaje desde la pestaña del juego (si se abrió desde aquí), o
 *  - por la URL (?resultado=…) si el juego volvió a la sala en esta misma pestaña.
 */
import { useEffect, useRef } from "react";
import { ORIGENES_JUEGOS, juegoPorId } from "../datos/catalogo";
import { asegurarRonda, guardarResultado, idRonda } from "../firebase/partidas";
import { guardarMarca, logrosDe } from "../firebase/retos";
import { registrarEnHistorial, sumarAlPerfil } from "../firebase/perfil";
import { useIdioma } from "../i18n";
import type { Partida, ResultadoJuego } from "../firebase/tipos";

interface Aviso {
  partida: string;
  asiento: number;
  resultado: ResultadoJuego;
  /** Número de partida en una serie de «Jugar de nuevo» (sin él, la 1: la original). */
  ronda?: number;
  /** Código de sala del juego de esta ronda (Astrolabe crea una sala nueva en cada revancha). */
  codigo?: string;
}

const rondaDe = (a: { ronda?: unknown }) => (Number.isInteger(a.ronda) && (a.ronda as number) > 1 ? (a.ronda as number) : 1);

function decodificar<T = Aviso>(texto: string): T | null {
  try {
    const bytes = Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function useResultados(sala: string, uid: string, nombre: string, partidas: Partida[], activo: boolean) {
  const { t } = useIdioma();
  const textos = useRef(t);
  textos.current = t;
  const actuales = useRef(partidas);
  actuales.current = partidas;
  const pendientes = useRef<Aviso[]>([]);

  const procesar = (aviso: Aviso) => {
    if (!aviso.resultado || typeof aviso.partida !== "string") return;
    // Reto en solitario: se guarda la marca (solo el primer intento) en vez de un resultado de partida.
    if (aviso.partida.startsWith("reto:")) {
      // «reto:juego:id» (o «reto:id» de antes, que era siempre Split Loyalty).
      const resto = aviso.partida.slice(5);
      const [juegoId, retoId] = resto.includes(":") ? resto.split(":", 2) : ["split-loyalty", resto];
      if (!/^[A-Za-z0-9-]{1,48}$/.test(retoId)) return;
      const puntaje = Number(aviso.resultado.puntajes?.["0"]);
      const juego = juegoPorId(juegoId);
      if (!juego?.retos) return;
      const texto = retoId.startsWith("diario-") ? textos.current.avisoRetoDiario(juego.nombre, puntaje) : textos.current.avisoReto(juego.nombre, puntaje);
      guardarMarca(sala, retoId, uid, nombre, aviso.resultado, texto)
        .then((nueva) => {
          if (!nueva) return;
          return Promise.all([
            sumarAlPerfil(uid, {
              juego: juego.id,
              tipo: "reto",
              gano: false,
              empate: false,
              puntaje: Number.isFinite(puntaje) ? puntaje : null,
              logros: logrosDe(aviso.resultado, 0),
              jugadores: [],
              fechaReto: retoId.startsWith("diario-") ? retoId.slice(7) : undefined,
            }),
            registrarEnHistorial(uid, `reto-${retoId}`, {
              tipo: "reto",
              juego: juego.id,
              sala,
              gano: false,
              empate: false,
              puntaje: Number.isFinite(puntaje) ? puntaje : null,
              variante: juego.retos?.variante ?? null,
              jugadores: [],
              diario: retoId.startsWith("diario-"),
            }),
          ]);
        })
        .catch((e) => console.warn("No se pudo guardar la marca del reto", e));
      return;
    }
    const ronda = rondaDe(aviso);
    if (ronda > 1) {
      // «Jugar de nuevo» dentro del juego: se registra como una partida más de la sala.
      asegurarRonda(sala, aviso.partida, ronda, aviso.codigo)
        .then((p) => p && guardar(p, aviso))
        .catch((e) => console.warn("No se pudo registrar la revancha", e));
      return;
    }
    const p = actuales.current.find((x) => x.id === aviso.partida);
    if (!p) {
      pendientes.current.push(aviso); // las partidas aún no cargaron: se reintenta al llegar
      return;
    }
    guardar(p, aviso);
  };

  const guardar = (p: Partida, aviso: Aviso) => {
    const yo = p.invitados[uid];
    if (!yo || yo.respuesta !== "acepta" || yo.rol !== "jugador") return;
    if (!aviso.resultado || !Array.isArray(aviso.resultado.ganadores)) return;
    const asiento = yo.asiento ?? aviso.asiento;
    guardarResultado(sala, p.id, uid, asiento, aviso.resultado)
      .then((nuevo) => {
        if (!nuevo) return;
        const ganadores = aviso.resultado.ganadores;
        const sentados = Object.entries(p.invitados).filter(([, i]) => i.respuesta === "acepta" && i.rol === "jugador");
        // Un empate de todos no cuenta como victoria.
        // En solitario no hay empate: ganaste si tu asiento está entre los ganadores.
        const empate = !p.nivel && ganadores.length >= sentados.length;
        const gano = ganadores.includes(asiento) && !empate;
        const puntaje = aviso.resultado.puntajes?.[String(asiento)];
        return Promise.all([
          sumarAlPerfil(uid, {
            juego: p.juego,
            tipo: "partida",
            gano,
            empate,
            puntaje: typeof puntaje === "number" && Number.isFinite(puntaje) ? puntaje : null,
            logros: logrosDe(aviso.resultado, asiento),
            jugadores: sentados.slice(0, 12).map(([u, i]) => ({ uid: u, nombre: i.nombre, gano: i.asiento !== null && ganadores.includes(i.asiento) && !empate })),
          }),
          registrarEnHistorial(uid, p.id, {
            tipo: "partida",
            juego: p.juego,
            sala,
            gano,
            empate,
            puntaje: typeof puntaje === "number" && Number.isFinite(puntaje) ? puntaje : null,
            variante: p.variante ?? null,
            jugadores: sentados.slice(0, 12).map(([u, i]) => ({
              uid: u,
              nombre: i.nombre,
              gano: i.asiento !== null && ganadores.includes(i.asiento) && !empate,
            })),
          }),
        ]);
      })
      .catch((e) => console.warn("No se pudo guardar el resultado", e));
  };

  // Mensajes desde la pestaña del juego.
  useEffect(() => {
    if (!activo) return;
    const alRecibir = (e: MessageEvent) => {
      if (!ORIGENES_JUEGOS.has(e.origin)) return;
      const d = e.data as { tipo?: string; sala?: string } & Aviso;
      if (!d || d.sala !== sala || typeof d.partida !== "string") return;
      // El juego empezó otra partida con «Jugar de nuevo»: aparece ya en juego en la sala.
      if (d.tipo === "lobby:ronda") {
        const ronda = rondaDe(d);
        if (ronda > 1 && !actuales.current.some((p) => p.id === idRonda(d.partida, ronda)))
          asegurarRonda(sala, d.partida, ronda, d.codigo).catch((e) => console.warn("No se pudo registrar la revancha", e));
        return;
      }
      if (d.tipo !== "lobby:resultado") return;
      procesar({ partida: d.partida, asiento: d.asiento, resultado: d.resultado, ronda: d.ronda, codigo: d.codigo });
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala, uid, nombre, activo]);

  // Resultado en la URL al volver a la sala en la misma pestaña.
  useEffect(() => {
    if (!activo) return;
    const url = new URL(window.location.href);
    const texto = url.searchParams.get("resultado");
    // Varias partidas seguidas («Jugar de nuevo») sin la pestaña del lobby abierta (app instalada):
    // el juego trae todos los resultados juntos.
    const varios = url.searchParams.get("resultados");
    if (!texto && !varios) return;
    url.searchParams.delete("resultado");
    url.searchParams.delete("resultados");
    window.history.replaceState(null, "", url.pathname + url.search);
    const avisos = [...(texto ? [decodificar(texto)] : []), ...(varios ? (decodificar<Aviso[]>(varios) ?? []) : [])];
    // Uno tras otro (y no a la vez): cada uno suma al mismo perfil.
    avisos
      .filter((a): a is Aviso => Boolean(a && typeof a === "object"))
      .forEach((a, i) => window.setTimeout(() => procesar(a), i * 1200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  // Avisos que llegaron antes de cargar las partidas.
  useEffect(() => {
    if (!pendientes.current.length) return;
    const lista = pendientes.current;
    pendientes.current = [];
    lista.filter((a) => partidas.some((p) => p.id === a.partida)).forEach(procesar);
    // (las marcas de retos no esperan a las partidas: se procesan al llegar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidas]);
}
