/**
 * Sonido del lobby: un solo AudioContext para toda la app.
 *
 * Los celulares (sobre todo el iPhone) solo dejan sonar un AudioContext creado o reanudado
 * durante un toque. El aviso de invitación llega sin que nadie toque nada (de Firebase), así que
 * crearlo en ese momento lo deja mudo. Por eso se crea y se «desbloquea» con el primer toque o
 * tecla, y después todos los sonidos usan ese mismo.
 */
import { sonidoActivo } from "./preferencias";

type ConWebkit = { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as ConWebkit).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Crea o reanuda el contexto en el primer toque o tecla (una sola vez). */
function desbloquearAlTocar() {
  const desbloquear = () => {
    contexto();
    window.removeEventListener("pointerdown", desbloquear, true);
    window.removeEventListener("keydown", desbloquear, true);
  };
  window.addEventListener("pointerdown", desbloquear, true);
  window.addEventListener("keydown", desbloquear, true);
}
if (typeof window !== "undefined") desbloquearAlTocar();

/** Un tono con subida rápida y caída suave. `variar` cambia un poco tono y volumen (±5 %). */
function tono(c: AudioContext, desde: number, dur: number, frec: number, vol = 0.18, tipo: OscillatorType = "sine", hasta?: number) {
  const t = c.currentTime + desde;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
const variar = (x: number) => x * (1 + (Math.random() * 2 - 1) * 0.05);

/**
 * Sonidos del lobby, de menor a mayor importancia:
 *  - «mensaje»: un plop corto cuando escribe otra persona en el chat de la sala (chico);
 *  - «llega»: dos notas suaves cuando alguien entra a la sala (chico);
 *  - «cuenta»: una nota por segundo en la cuenta atrás 3-2-1, cada una más aguda (mediano).
 * Todos respetan Perfil → Preferencias → Sonidos.
 */
export type SonidoLobby = "mensaje" | "llega" | "cuenta3" | "cuenta2" | "cuenta1";
const SONIDOS: Record<SonidoLobby, (c: AudioContext) => void> = {
  mensaje: (c) => tono(c, 0, 0.12, variar(700), 0.12, "sine", 380),
  llega: (c) => {
    tono(c, 0, 0.14, 587, 0.1, "triangle");
    tono(c, 0.11, 0.22, 880, 0.1, "triangle");
  },
  cuenta3: (c) => tono(c, 0, 0.16, 523, 0.14, "triangle"),
  cuenta2: (c) => tono(c, 0, 0.16, 659, 0.14, "triangle"),
  cuenta1: (c) => tono(c, 0, 0.16, 784, 0.14, "triangle"),
};

export function sonar(s: SonidoLobby) {
  if (!sonidoActivo()) return;
  const c = contexto();
  if (!c) return;
  try {
    SONIDOS[s](c);
  } catch {
    /* sin audio */
  }
}

/** Un «ding» corto sin archivos de audio (si el navegador lo permite). */
export function sonarAviso() {
  if (!sonidoActivo()) return;
  const c = contexto();
  if (!c) return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1320, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.42);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  } catch {
    /* sin audio */
  }
}
