/**
 * El lobby avisa que acaba de invitar a alguien (a la sala o a una partida) o de pedir amistad:
 * se comprueba en Firestore y se avisa al celular de la otra persona. Ver api/_avisos.js.
 */
import { conectar, leerCuerpo, procesarAviso, responder } from "./_avisos.js";

export async function POST(request) {
  const d = await leerCuerpo(request);
  if (!d) return responder({ estado: 400 });
  try {
    return responder(await procesarAviso(await conectar(), d));
  } catch (e) {
    console.error("aviso", e);
    return responder({ estado: 500 });
  }
}
