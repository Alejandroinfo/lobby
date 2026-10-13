/**
 * «Llave de identidad» para los juegos: verifica tu sesión del lobby y devuelve un token con el que
 * el juego te reconoce siempre como la misma persona, en cualquier aparato (si entras al lobby con
 * tu cuenta). Hoy lo usa Astrolabe: su usuario pasa a ser «lobby-<tu uid del lobby>».
 *
 * Variables en Vercel: FIREBASE_SERVICE_ACCOUNT (proyecto del lobby, para verificar la sesión) y
 * FIREBASE_SERVICE_ACCOUNT_ASTROLABE (proyecto de Astrolabe, para firmar la llave).
 * POST con «Authorization: Bearer <token de sesión del lobby>» y { juego: "astrolabe" }.
 */
import { leerCuerpo } from "./_avisos.js";

const PROYECTOS = { astrolabe: "FIREBASE_SERVICE_ACCOUNT_ASTROLABE" };
const apps = {};

async function app(nombre, variable) {
  if (apps[nombre]) return apps[nombre];
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const ya = getApps().find((a) => a.name === nombre);
  apps[nombre] = ya ?? initializeApp({ credential: cert(JSON.parse(process.env[variable])) }, nombre);
  return apps[nombre];
}

export async function POST(request) {
  const no = (estado) => Response.json({ token: null }, { status: estado, headers: { "Cache-Control": "no-store" } });
  const d = await leerCuerpo(request);
  const variable = PROYECTOS[d?.juego];
  if (!variable) return no(400);
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env[variable]) return no(501); // sin configurar: el juego sigue como antes
  const sesion = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!sesion) return no(401);
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const { uid } = await getAuth(await app("lobby", "FIREBASE_SERVICE_ACCOUNT")).verifyIdToken(sesion);
    const token = await getAuth(await app(d.juego, variable)).createCustomToken(`lobby-${uid}`.slice(0, 128));
    return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.warn("token-juego", e?.code ?? e);
    return no(401);
  }
}
