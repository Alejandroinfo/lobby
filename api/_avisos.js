/**
 * Lógica compartida de las funciones de turnos y avisos (api/turno.js y api/aviso.js).
 * No es una ruta (los archivos que empiezan con «_» no se publican como función en Vercel).
 *
 * Usa la cuenta de servicio de Firebase (variable FIREBASE_SERVICE_ACCOUNT en Vercel) para leer y
 * escribir Firestore desde el servidor, y Web Push (VAPID_PRIVATE_KEY) para avisar al celular.
 * Las funciones de lógica reciben `db` y `enviar` para poder probarlas sin Firebase.
 */

export const VAPID_PUBLICA = "BORxHxET5grSLZGCuMd2BTxslI8p1ZkInmcBwOTp0IKKMAG8_EPsXeMcDlLMaXS6M1bBtiWDz-fveO9k21feEcM";
const JUEGOS = { "split-loyalty": "Split Loyalty", astrolabe: "Astrolabe" };
const nombreJuego = (id) => JUEGOS[id] ?? id;
const CODIGO = /^[A-Z0-9]{4,8}$/;
const ID = /^[A-Za-z0-9-]{6,48}$/;
const UID = /^[A-Za-z0-9_-]{6,128}$/;

// ── Conexiones (solo en Vercel) ───────────────────────────────────────────────

let conexion = null;
export async function conectar() {
  if (conexion) return conexion;
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cuenta) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT");
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(cuenta)) });
  const webpush = (await import("web-push")).default;
  if (process.env.VAPID_PRIVATE_KEY) webpush.setVapidDetails("mailto:alejandro.armasb@gmail.com", VAPID_PUBLICA, process.env.VAPID_PRIVATE_KEY);
  const db = getFirestore(app);
  conexion = { db, FieldValue, enviar: (uid, mensaje) => enviarPush(db, webpush, uid, mensaje) };
  return conexion;
}

/** Manda el aviso a todos los celulares de esa persona; las suscripciones vencidas se borran. */
async function enviarPush(db, webpush, uid, mensaje) {
  if (!process.env.VAPID_PRIVATE_KEY) return 0;
  const subs = await db.collection(`jugadores/${uid}/avisos`).get();
  let enviados = 0;
  await Promise.all(
    subs.docs.map(async (d) => {
      const s = d.data();
      const texto = s.idioma === "en" && mensaje.en ? mensaje.en : mensaje;
      try {
        await webpush.sendNotification(
          s.suscripcion,
          JSON.stringify({ titulo: texto.titulo, cuerpo: texto.cuerpo, url: mensaje.url, etiqueta: mensaje.etiqueta }),
          { TTL: 12 * 3600, urgency: "high", topic: mensaje.etiqueta?.slice(0, 32) },
        );
        enviados++;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await d.ref.delete().catch(() => {});
        else console.warn("Push falló", e?.statusCode, e?.body);
      }
    }),
  );
  return enviados;
}

// ── Turnos ────────────────────────────────────────────────────────────────────

/**
 * Un juego avisa de quién es el turno (`asientos`: quiénes tienen que jugar ahora) o que la
 * partida terminó (`fin`). Se guarda en la partida, en «Tus partidas en curso» de cada jugador
 * (jugadores/{uid}.enCurso) y se avisa al celular de quien le acaba de tocar.
 */
export async function procesarTurno({ db, FieldValue, enviar }, d) {
  const ronda = Number.isInteger(d?.ronda) && d.ronda > 1 && d.ronda <= 500 ? d.ronda : 1;
  const asientos = Array.isArray(d?.asientos) ? [...new Set(d.asientos.filter((a) => Number.isInteger(a) && a >= 0 && a < 8))].sort() : [];
  if (!CODIGO.test(d?.sala ?? "") || !ID.test(d?.partida ?? "")) return { estado: 400 };
  const id = ronda > 1 ? `${d.partida}-r${ronda}` : d.partida;
  const ref = db.doc(`salas/${d.sala}/partidas/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return { estado: 404 };
  const p = snap.data();
  if (p.nivel) return { estado: 200, motivo: "solitario" }; // contra la máquina: no hay a quién avisar
  const jugadores = Object.entries(p.invitados ?? {}).filter(([, i]) => i.respuesta === "acepta" && i.rol === "jugador" && Number.isInteger(i.asiento));
  const lote = db.batch();

  if (d.fin || p.estado === "terminada" || p.estado === "cancelada") {
    for (const [uid] of jugadores) lote.set(db.doc(`jugadores/${uid}`), { enCurso: { [id]: FieldValue.delete() } }, { merge: true });
    await lote.commit();
    return { estado: 200, motivo: "fin" };
  }
  if (p.estado !== "jugando") return { estado: 409 };

  const antes = p.turno?.asientos ?? [];
  if (antes.length === asientos.length && antes.every((a, i) => a === asientos[i])) return { estado: 200, motivo: "sin-cambio" };

  const sala = (await db.doc(`salas/${d.sala}`).get()).data() ?? {};
  const nombreSala = sala.nombre ?? d.sala;
  const esperando = jugadores.filter(([, i]) => asientos.includes(i.asiento)).map(([, i]) => i.nombre);
  const ahora = Date.now();
  lote.update(ref, { turno: { asientos, hora: FieldValue.serverTimestamp() } });
  for (const [uid, i] of jugadores) {
    lote.set(
      db.doc(`jugadores/${uid}`),
      { enCurso: { [id]: { sala: d.sala, nombreSala, juego: p.juego, miTurno: asientos.includes(i.asiento), esperando, hora: ahora } } },
      { merge: true },
    );
  }
  await lote.commit();

  // Aviso solo a quien le empieza a tocar (no a quien ya le tocaba).
  const nuevos = jugadores.filter(([, i]) => asientos.includes(i.asiento) && !antes.includes(i.asiento));
  await Promise.all(
    nuevos.map(([uid]) =>
      enviar(uid, {
        titulo: `Te toca en ${nombreJuego(p.juego)}`,
        cuerpo: `${nombreSala}: es tu turno.`,
        en: { titulo: `Your turn in ${nombreJuego(p.juego)}`, cuerpo: `${nombreSala}: it's your move.` },
        url: `/s/${d.sala}`,
        etiqueta: `turno-${id}`,
      }),
    ),
  );
  return { estado: 200, avisados: nuevos.length };
}

// ── Invitaciones y solicitudes ─────────────────────────────────────────────────

const RECIENTE_MS = 15 * 60_000;
const reciente = (t) => t && Date.now() - t.toMillis() < RECIENTE_MS;

/**
 * El lobby avisa que acaba de invitar o pedir amistad; aquí se comprueba que de verdad existe (y
 * que es reciente) antes de avisar al celular de la otra persona. Cada aviso se manda una vez.
 */
export async function procesarAviso({ db, enviar }, d) {
  if (!UID.test(d?.para ?? "")) return { estado: 400 };

  if (d.tipo === "sala") {
    if (!UID.test(d.de ?? "") || !CODIGO.test(d.sala ?? "")) return { estado: 400 };
    const ref = db.doc(`invitaciones/${d.para}/de/${d.de}`);
    const inv = (await ref.get()).data();
    if (!inv || inv.sala !== d.sala || !reciente(inv.hora) || inv.avisada) return { estado: 404 };
    await ref.update({ avisada: true });
    await enviar(d.para, {
      titulo: `${inv.nombre} te invita a su sala`,
      cuerpo: `«${inv.nombreSala}»: toca para entrar.`,
      en: { titulo: `${inv.nombre} invites you to their room`, cuerpo: `“${inv.nombreSala}”: tap to join.` },
      url: `/s/${d.sala}`,
      etiqueta: `sala-${d.sala}`,
    });
    return { estado: 200 };
  }

  if (d.tipo === "partida") {
    if (!CODIGO.test(d.sala ?? "") || !ID.test(d.partida ?? "")) return { estado: 400 };
    const ref = db.doc(`salas/${d.sala}/partidas/${d.partida}`);
    const p = (await ref.get()).data();
    const yo = p?.invitados?.[d.para];
    if (!p || p.estado !== "invitando" || yo?.respuesta !== "pendiente" || !reciente(p.creada) || p.avisados?.[d.para]) return { estado: 404 };
    await ref.update({ [`avisados.${d.para}`]: true });
    const quien = p.invitados?.[p.anfitrion]?.nombre ?? "Alguien";
    await enviar(d.para, {
      titulo: `${quien} te invita a jugar ${nombreJuego(p.juego)}`,
      cuerpo: "Toca para responder en la sala.",
      en: { titulo: `${quien} invites you to play ${nombreJuego(p.juego)}`, cuerpo: "Tap to answer in the room." },
      url: `/s/${d.sala}`,
      etiqueta: `partida-${d.partida}`,
    });
    return { estado: 200 };
  }

  if (d.tipo === "solicitud") {
    if (!UID.test(d.de ?? "")) return { estado: 400 };
    const ref = db.doc(`solicitudes/${d.para}/de/${d.de}`);
    const s = (await ref.get()).data();
    if (!s || !reciente(s.hora) || s.avisada) return { estado: 404 };
    await ref.update({ avisada: true });
    await enviar(d.para, {
      titulo: `${s.nombre} quiere agregarte como amigo`,
      cuerpo: "Toca para aceptar o rechazar.",
      en: { titulo: `${s.nombre} wants to add you as a friend`, cuerpo: "Tap to accept or decline." },
      url: "/",
      etiqueta: `amigo-${d.de}`,
    });
    return { estado: 200 };
  }
  return { estado: 400 };
}

/** Respuesta con CORS: los juegos (otros sitios) llaman a /api/turno. */
export function responder(r, origen) {
  return Response.json(r, {
    status: r.estado ?? 200,
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": origen || "*", Vary: "Origin" },
  });
}

/** Cuerpo JSON aunque llegue como texto (sendBeacon y peticiones simples sin CORS previo). */
export async function leerCuerpo(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}
