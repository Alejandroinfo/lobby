/**
 * Errores técnicos de la página (los últimos 10), para adjuntarlos a un reporte. Al primer error
 * de verdad se ofrece reportarlo (una vez por visita). Se ignora el ruido conocido.
 */
const ULTIMOS: string[] = [];
// El error que tumbó una pantalla (ver RedDeSeguridad) sobrevive a la recarga para ir en el reporte.
const CLAVE_PANTALLA = "lobby_error_pantalla";
try {
  const previo = sessionStorage.getItem(CLAVE_PANTALLA);
  if (previo) ULTIMOS.push(previo);
} catch {
  /* sin almacenamiento */
}
const oyentes = new Set<(mensaje: string) => void>();
let avisado = false;

const RUIDO = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed/i, /Failed to fetch/i, /NetworkError/i, /network-request-failed/i, /unavailable/i];

function anotar(texto: string, avisar: boolean) {
  const limpio = texto.slice(0, 600);
  if (RUIDO.some((r) => r.test(limpio))) return;
  ULTIMOS.push(`${new Date().toISOString()} ${limpio}`);
  if (ULTIMOS.length > 10) ULTIMOS.shift();
  if (avisar && !avisado) {
    avisado = true;
    oyentes.forEach((f) => f(limpio));
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    const pila = e.error instanceof Error && e.error.stack ? `\n${e.error.stack.split("\n").slice(0, 4).join("\n")}` : "";
    anotar(`${e.message} (${e.filename?.split("/").pop() ?? "?"}:${e.lineno})${pila}`, true);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; code?: string } | undefined;
    anotar(`Promesa rechazada: ${r?.code ? `[${r.code}] ` : ""}${r?.message ?? String(e.reason)}`, false);
  });
}

export const erroresRecientes = () => [...ULTIMOS];

/** Un error que React atrapó al dibujar una pantalla (no pasa por window.onerror). */
export function anotarErrorDePantalla(error: unknown, componentes?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const pila = e.stack ? `\n${e.stack.split("\n").slice(0, 4).join("\n")}` : "";
  const donde = componentes ? `\nEn: ${componentes.trim().split("\n").slice(0, 3).join(" ← ")}` : "";
  const texto = `${new Date().toISOString()} Pantalla caída: ${e.message}${pila}${donde}`.slice(0, 1200);
  ULTIMOS.push(texto);
  if (ULTIMOS.length > 10) ULTIMOS.shift();
  try {
    sessionStorage.setItem(CLAVE_PANTALLA, texto);
  } catch {
    /* sin almacenamiento */
  }
}

/** Avisa (una vez por visita) cuando la página tiene un error técnico. */
export function alFallar(f: (mensaje: string) => void): () => void {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
