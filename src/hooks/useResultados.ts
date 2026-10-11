/**
 * Recibe el resultado que avisa un juego conectado al terminar:
 *  - por mensaje desde la pestaña del juego (si se abrió desde aquí), o
 *  - por la URL (?resultado=…) si el juego volvió a la sala en esta misma pestaña.
 */
import { useEffect, useRef } from "react";
import { ORIGENES_JUEGOS } from "../datos/catalogo";
import { guardarResultado } from "../firebase/partidas";
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

export function useResultados(sala: string, uid: string, partidas: Partida[], activo: boolean) {
  const actuales = useRef(partidas);
  actuales.current = partidas;
  const pendientes = useRef<Aviso[]>([]);

  const procesar = (aviso: Aviso) => {
    const p = actuales.current.find((x) => x.id === aviso.partida);
    if (!p) {
      pendientes.current.push(aviso); // las partidas aún no cargaron: se reintenta al llegar
      return;
    }
    const yo = p.invitados[uid];
    if (!yo || yo.respuesta !== "acepta" || yo.rol !== "jugador") return;
    if (!aviso.resultado || !Array.isArray(aviso.resultado.ganadores)) return;
    guardarResultado(sala, p.id, uid, yo.asiento ?? aviso.asiento, aviso.resultado).catch((e) =>
      console.warn("No se pudo guardar el resultado", e),
    );
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
  }, [sala, uid, activo]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidas]);
}
