/**
 * Recibe el resultado que avisa un juego conectado al terminar:
 *  - por mensaje desde la pestaña del juego (si se abrió desde aquí), o
 *  - por la URL (?resultado=…) si el juego volvió a la sala en esta misma pestaña.
 */
import { useEffect, useRef } from "react";
import { ORIGENES_JUEGOS, juegoPorId } from "../datos/catalogo";
import { guardarResultado } from "../firebase/partidas";
import { guardarMarca, logrosDe } from "../firebase/retos";
import { registrarEnHistorial, sumarAlPerfil } from "../firebase/perfil";
import { useIdioma } from "../i18n";
import type { Partida, ResultadoJuego } from "../firebase/tipos";

interface Aviso {
  partida: string;
  asiento: number;
  resultado: ResultadoJuego;
}

function decodificar(texto: string): Aviso | null {
  try {
    const bytes = Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Aviso;
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
    const p = actuales.current.find((x) => x.id === aviso.partida);
    if (!p) {
      pendientes.current.push(aviso); // las partidas aún no cargaron: se reintenta al llegar
      return;
    }
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
        const empate = ganadores.length >= sentados.length;
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
      if (d?.tipo !== "lobby:resultado" || d.sala !== sala) return;
      procesar({ partida: d.partida, asiento: d.asiento, resultado: d.resultado });
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
    if (!texto) return;
    url.searchParams.delete("resultado");
    window.history.replaceState(null, "", url.pathname + url.search);
    const aviso = decodificar(texto);
    if (aviso) procesar(aviso);
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
