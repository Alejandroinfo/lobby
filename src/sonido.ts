/**
 * Sonido del lobby: un solo AudioContext para toda la app.
 *
 * Los celulares (sobre todo el iPhone) solo dejan sonar un AudioContext creado o reanudado
 * durante un toque. El aviso de invitación llega sin que nadie toque nada (de Firebase), así que
 * crearlo en ese momento lo deja mudo. Por eso se crea y se «desbloquea» con el primer toque o
 * tecla, y después todos los sonidos usan ese mismo.
 */
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

/** Un «ding» corto sin archivos de audio (si el navegador lo permite). */
export function sonarAviso() {
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
