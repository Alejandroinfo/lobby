/**
 * Aviso por correo de cada reporte nuevo («Reportar un problema»). El reporte ya quedó guardado
 * en Firestore; esto solo avisa. Usa Resend (https://resend.com, gratis hasta 100 correos al día):
 * en Vercel → Settings → Environment Variables, `RESEND_API_KEY` (y opcionalmente
 * `REPORTES_CORREO`, a quién llega). Sin la clave no hace nada.
 */
const PARA = process.env.REPORTES_CORREO || "alejandro.armasb@gmail.com";
const TIPOS = { trabado: "Se trabó", reglas: "Reglas", visual: "Se ve mal", otro: "Otro" };

// Freno simple ante abusos (por instancia): como mucho 20 correos por hora.
let ventana = 0;
let enviados = 0;

const texto = (v, n) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").slice(0, n) : "");

export async function POST(request) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return Response.json({ enviado: false, motivo: "sin-configurar" });
  const d = await request.json().catch(() => null);
  if (!d || typeof d.id !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(d.id)) return Response.json({ enviado: false }, { status: 400 });

  const ahora = Date.now();
  if (ahora - ventana > 3600_000) {
    ventana = ahora;
    enviados = 0;
  }
  if (++enviados > 20) return Response.json({ enviado: false, motivo: "limite" }, { status: 429 });

  const origen = new URL(request.url).origin;
  const juego = texto(d.juego, 40) || "lobby";
  const cuerpo = [
    `Nuevo reporte (${TIPOS[d.tipo] ?? "Otro"}) en ${juego}${d.version ? ` · versión ${texto(d.version, 40)}` : ""}`,
    `De: ${texto(d.nombre, 40) || "sin nombre"}`,
    "",
    `Qué pasó: ${texto(d.que, 600)}`,
    d.esperaba ? `Qué esperaba: ${texto(d.esperaba, 300)}` : "",
    "",
    `${d.conRegistro ? "Con registro de la partida. " : ""}${d.conCaptura ? "Con captura. " : ""}`,
    `Verlo en el panel: ${origen}/panel#reporte-${d.id}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORTES_REMITENTE || "Lobby de juegos <onboarding@resend.dev>",
      to: [PARA],
      subject: `[Reporte] ${juego} · ${TIPOS[d.tipo] ?? "Otro"}: ${texto(d.que, 60)}`,
      text: cuerpo,
    }),
  }).catch(() => null);
  return Response.json({ enviado: !!resp?.ok }, { headers: { "Cache-Control": "no-store" } });
}
