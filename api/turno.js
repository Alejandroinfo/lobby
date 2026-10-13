/**
 * Los juegos avisan de quién es el turno en una partida de la sala (o que terminó). Ver api/_avisos.js.
 * Se llama con navigator.sendBeacon (texto JSON): { sala, partida, ronda, asientos: [..], fin }.
 */
import { conectar, leerCuerpo, procesarTurno, responder } from "./_avisos.js";

export async function POST(request) {
  const origen = request.headers.get("origin");
  const d = await leerCuerpo(request);
  if (!d) return responder({ estado: 400 }, origen);
  try {
    return responder(await procesarTurno(await conectar(), d), origen);
  } catch (e) {
    console.error("turno", e);
    return responder({ estado: 500 }, origen);
  }
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": request.headers.get("origin") || "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
