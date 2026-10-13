/**
 * Abrir un juego como «la misma persona» en cualquier aparato: el lobby pide a api/token-juego.js
 * una llave para ese juego y la agrega al enlace (después de #, así no viaja a ningún servidor).
 * Si no está configurado o falla, el juego se abre igual que antes.
 */
import { auth } from "./config";

const JUEGOS_CON_LLAVE = new Set(["astrolabe"]);
const guardadas = new Map<string, { token: string; hasta: number }>();

async function llave(juego: string): Promise<string | null> {
  const g = guardadas.get(juego);
  if (g && g.hasta > Date.now()) return g.token;
  const usuario = auth.currentUser;
  if (!usuario) return null;
  const sesion = await usuario.getIdToken();
  const r = await fetch("/api/token-juego", {
    method: "POST",
    headers: { Authorization: `Bearer ${sesion}`, "Content-Type": "application/json" },
    body: JSON.stringify({ juego }),
  });
  if (!r.ok) return null;
  const { token } = (await r.json()) as { token: string | null };
  // La llave sirve para entrar durante 1 hora; se reusa 45 min.
  if (token) guardadas.set(juego, { token, hasta: Date.now() + 45 * 60_000 });
  return token;
}

/** El enlace del juego con la llave (o tal cual, si el juego no la usa o no se pudo obtener). */
export async function conLlave(juego: string, url: string): Promise<string> {
  if (!JUEGOS_CON_LLAVE.has(juego)) return url;
  const token = await Promise.race([llave(juego).catch(() => null), new Promise<null>((ok) => setTimeout(() => ok(null), 4000))]);
  return token ? `${url}#lt=${encodeURIComponent(token)}` : url;
}
