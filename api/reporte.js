/**
 * Correo por cada reporte nuevo («Reportar un problema»), con todo lo necesario para reproducirlo:
 * el texto, dónde estaba, el aparato, los errores y, como adjuntos, el registro de la partida, la
 * captura y el reporte completo (JSON). Así se puede reenviar tal cual.
 *
 * Lee el reporte de Firestore con la cuenta de servicio (FIREBASE_SERVICE_ACCOUNT): solo se manda
 * correo de reportes que de verdad existen. Envía con Resend (RESEND_API_KEY; gratis hasta 100 al
 * día). REPORTES_CORREO cambia el destinatario.
 */
import { conectar } from "./_avisos.js";

const PARA = process.env.REPORTES_CORREO || "alejandro.armasb@gmail.com";
const TIPOS = { trabado: "Se trabó", reglas: "Reglas", visual: "Se ve mal", otro: "Otro" };
const JUEGOS = { "split-loyalty": "Split Loyalty", astrolabe: "Home Sweet Orbit", "double-cross": "Double Cross" };
const base64 = (texto) => Buffer.from(texto, "utf8").toString("base64");
const pares = (o) =>
  Object.entries(o ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

export async function POST(request) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return Response.json({ enviado: false, motivo: "sin-configurar" });
  const d = await request.json().catch(() => null);
  if (!d || typeof d.id !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(d.id)) return Response.json({ enviado: false }, { status: 400 });

  let r;
  try {
    const { db } = await conectar();
    const ref = db.doc(`reportes/${d.id}`);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ enviado: false }, { status: 404 });
    r = snap.data();
    // Cada reporte manda un correo; desde el panel se puede pedir otra vez («Enviar por correo»).
    if (r.correoEnviado && d.reenviar !== true) return Response.json({ enviado: false, motivo: "ya-enviado" });
    await ref.update({ correoEnviado: true });
  } catch (e) {
    console.error("reporte: no se pudo leer", e);
    return Response.json({ enviado: false }, { status: 500 });
  }

  const origen = new URL(request.url).origin;
  const juego = r.juego ? (JUEGOS[r.juego] ?? r.juego) : "Lobby";
  const fecha = r.creado?.toDate?.().toLocaleString("es", { timeZone: "America/New_York" }) ?? "";
  const cuerpo = [
    `Reporte (${TIPOS[r.tipo] ?? r.tipo}) en ${juego}${r.version ? ` · versión ${r.version}` : ""}`,
    `De: ${r.nombre || "sin nombre"} (${r.uid}) · ${fecha}`,
    "",
    `QUÉ PASÓ:\n${r.que}`,
    r.esperaba ? `\nQUÉ ESPERABA:\n${r.esperaba}` : "",
    `\nDÓNDE:\n${pares(r.donde)}`,
    `\nAPARATO:\n${pares(r.dispositivo)}`,
    r.errores?.length ? `\nERRORES TÉCNICOS:\n${r.errores.join("\n")}` : "",
    "",
    `Adjuntos: ${[r.registro && "registro de la partida", r.captura && "captura", "reporte completo (JSON)"].filter(Boolean).join(", ")}.`,
    `En el panel: ${origen}/panel#reporte-${d.id}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const adjuntos = [];
  if (r.registro) adjuntos.push({ filename: r.nombreRegistro || `registro-${d.id}.txt`, content: base64(r.registro) });
  if (typeof r.captura === "string" && r.captura.startsWith("data:image/")) {
    adjuntos.push({ filename: `captura-${d.id}.jpg`, content: r.captura.split(",")[1] });
  }
  const completo = { id: d.id, ...r, creado: r.creado?.toDate?.().toISOString() ?? null, captura: r.captura ? "(adjunta aparte)" : null };
  adjuntos.push({ filename: `reporte-${d.id}.json`, content: base64(JSON.stringify(completo, null, 1)) });

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORTES_REMITENTE || "Lobby de juegos <onboarding@resend.dev>",
      to: [PARA],
      subject: `[Reporte] ${juego} · ${TIPOS[r.tipo] ?? r.tipo}: ${String(r.que).replace(/\s+/g, " ").slice(0, 60)}`,
      text: cuerpo,
      attachments: adjuntos,
    }),
  }).catch(() => null);
  if (!resp?.ok) console.warn("reporte: Resend respondió", resp?.status, await resp?.text().catch(() => ""));
  return Response.json({ enviado: !!resp?.ok }, { headers: { "Cache-Control": "no-store" } });
}
