/**
 * Textos del lobby en español e inglés. `en` debe tener exactamente las mismas claves que `es`
 * (TypeScript avisa si falta alguna). Uso: const { t, idioma } = useIdioma();
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Juego } from "./datos/catalogo";

export type Idioma = "es" | "en";

const es = {
  nombreApp: "Lobby de juegos",
  lema: "Reúne a tu grupo en una sala y elijan a qué jugar.",
  conectando: "Conectando…",
  errorConexionTitulo: "No pudimos conectarte",
  errorConexionTexto: "Revisa tu conexión a internet y recarga la página.",
  idioma: "Idioma",

  // Nombre y privacidad
  comoTeLlamamos: "¿Cómo te llamamos?",
  nombrePlaceholder: "Tu nombre o apodo",
  errorNombre: "Escribe un nombre para que tus amigos te reconozcan.",
  avisoPrivacidad:
    "No necesitas cuenta. Guardamos el nombre que elijas, los mensajes del chat de tu sala, los resultados y encuestas de tus partidas y el país desde el que te conectas (nunca la dirección IP). Las estadísticas de visitas son anónimas y sin cookies.",
  continuar: "Continuar",

  // Inicio
  hola: "Hola,",
  cambiarNombre: "Cambiar nombre",
  salasRecientes: "Tus salas recientes",
  crearSala: "Crear una sala",
  crearSalaTexto: "Una sala reúne a tu grupo para toda la sesión de juego.",
  nombreSalaLabel: "Nombre de la sala (opcional)",
  salaDe: (n: string) => `Sala de ${n}`,
  botonCrearSala: "Crear sala",
  creando: "Creando…",
  errorCrearSala: "No se pudo crear la sala. Revisa tu conexión e intenta de nuevo.",
  unirse: "Unirse con un código",
  unirseTexto: "Si te pasaron un enlace, ábrelo directamente.",
  codigoLabel: "Código de la sala",
  entrar: "Entrar",
  errorCodigo: (n: number) => `El código tiene ${n} letras o números, como K7Q2M.`,

  // Perfil
  perfilAnonimo: "Entraste sin cuenta: tu perfil vive solo en este navegador.",
  guardarGoogle: "Guardarlo con Google",
  perfilAnonimoFin: "para usarlo también en otros dispositivos.",
  errorGoogle: "No se pudo conectar con Google. Intenta de nuevo.",
  perfilGuardado: "Perfil guardado con",
  panel: "Panel de playtest",
  cerrarSesion: "Cerrar sesión",

  // Sala
  errorUnirseSala: "No se pudo entrar a la sala. Recarga la página para intentarlo de nuevo.",
  noEncontramos: (c: string) => `No encontramos la sala ${c}`,
  revisaCodigo: "Revisa el código con quien te invitó; puede que lo hayas escrito mal.",
  volverInicio: "Volver al inicio",
  errorCargarSala: "No se pudo cargar la sala. Revisa tu conexión y recarga la página.",
  invitadoTexto: "Te invitaron a esta sala. Elige tu nombre para entrar.",
  entrarSala: "Entrar a la sala",
  entrandoSala: "Entrando a la sala…",
  uneteA: (n: string) => `Únete a ${n}`,
  copiaEnlace: "Copia este enlace:",
  confirmarSalir: "¿Salir de la sala? Podrás volver con el mismo enlace.",
  sala: "Sala",
  codigo: "Código",
  enlaceCopiado: "¡Enlace copiado!",
  invitar: "Invitar",
  salir: "Salir",
  enLaSala: "En la sala",
  conectados: (n: number) => `${n} ${n === 1 ? "conectado" : "conectados"}`,
  tu: "tú",
  anfitrion: "anfitrión",
  conectado: "conectado",
  desconectado: "desconectado",
  juegos: "Juegos",
  categorias: {
    listo: { titulo: "Listos para jugar", nota: "Reglas estables" },
    prueba: { titulo: "En prueba", nota: "Las reglas pueden cambiar entre partidas" },
  },
  enPrueba: "en prueba",
  jugadores: (min: number, max: number) => (min === max ? `${min} jugadores` : `${min}–${max} jugadores`),
  conEspectadores: "con espectadores",
  crearPartida: "Crear partida",
  chat: "Chat",
  escribeAlgo: "Escribe algo antes de enviar.",
  errorEnviar: "No se pudo enviar. Intenta de nuevo.",
  sinMensajes: "Aún no hay mensajes. ¡Saluda!",
  tuMayus: "Tú",
  mensaje: "Mensaje",
  escribeMensaje: "Escribe un mensaje…",
  enviar: "Enviar",

  // Crear partida
  nuevaPartidaDe: (j: string) => `Nueva partida de ${j}`,
  cancelar: "Cancelar",
  modo: "Modo",
  aQuienInvitas: "A quién invitas",
  invitarTodos: "Invitar a toda la sala",
  tuParen: " (tú)",
  desconectadoPunto: " · desconectado",
  rolDe: (n: string) => `Rol de ${n}`,
  jugador: "Jugador",
  espectador: "Espectador",
  nadieMas: 'Aún no hay nadie más en la sala. Usa "Invitar" arriba para compartir el enlace.',
  necesitaMin: (j: string, min: number, falta: number) => `${j} necesita al menos ${min} jugadores; invita a ${falta} más.`,
  admiteMax: (j: string, max: number, conEsp: boolean) =>
    `${j} admite como máximo ${max} jugadores.` + (conEsp ? " Pon al resto como espectadores." : " Quita a alguien de la lista."),
  errorCrearPartida: "No se pudo crear la partida. Intenta de nuevo.",
  enviando: "Enviando…",
  enviarInvitaciones: "Enviar invitaciones",

  // Invitaciones y partidas
  tituloInvitacion: (n: number) => `(${n}) Invitación · Lobby de juegos`,
  invitacionesAria: "Invitaciones",
  alguien: "Alguien",
  teInvitaA: "te invita a",
  verboJugar: "jugar",
  verboMirar: "mirar",
  jugar: "Jugar",
  mirar: "Mirar",
  soloMirar: "Solo mirar",
  ahoraNo: "Ahora no",
  partidas: "Partidas",
  recientes: "Recientes",
  revancha: "revancha",
  creandoMin: "creando…",
  noSePudoCrear: "no se pudo crear",
  gano: (n: string) => `ganó ${n}`,
  ganaron: (nombres: string[]) => `ganaron ${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`,
  empate: "empate",
  sinGanador: "sin ganador",
  equipos: ["Equipo A", "Equipo B"] as [string, string],
  chipDesconectado: "desconectado",
  chipMira: "mira",
  chipAsiento: (n: number) => `asiento ${n}`,
  chipNoVa: "no va",
  chipSinResponder: "sin responder",
  chipListo: "listo",
  chipPreparandose: "preparándose",
  porEquipos: "por equipos",
  enJuego: "en juego",
  preparando: "preparando",
  organiza: "organiza",
  quitar: "quitar",
  seDesconectoOrganizador: (n: string) => `${n} se desconectó. Si no vuelve, puedes organizar tú la partida.`,
  quienCreo: "Quien creó la partida",
  tomarControl: "Tomar el control",
  yaNoListo: "Ya no estoy listo",
  estoyListo: "Estoy listo",
  salirme: "Salirme",
  lanzar: "Lanzar partida",
  cancelarPartida: "Cancelar partida",
  terminarPartida: "Terminar partida",
  juegasAsiento: (n: number, equipo: string | null) => `Juegas en el asiento ${n}` + (equipo ? `, en el ${equipo}.` : "."),
  entrasEspectador: "Entras como espectador.",
  noConectado: 'Este juego aún no está conectado al lobby: ábranlo por su cuenta y, al acabar, quien organiza marca "Terminar partida".',
  abrir: (j: string) => `Abrir ${j}`,
  otraPestana: "Se abre en otra pestaña. El resultado llega solo al terminar.",
  rotuloEquipos: "Equipos",
  alAzar: "Al azar",
  elegirlos: "Elegirlos",
  comoEquipos: "Cómo se forman los equipos",
  seSortean: "se sortean al lanzar",
  elegidosPorOrganizador: "elegidos por quien organiza",
  seSorteanLargo: "Se sortean al lanzar la partida.",
  cambiarEquipo: "Cambiar de equipo",
  tocaNombre: "Toca un nombre para cambiarlo de equipo.",
  motivoFaltan: (n: number, min: number) => `Faltan jugadores: ${n} de al menos ${min}.`,
  motivoSobran: (n: number, max: number) => `Sobran jugadores: ${n}, el máximo es ${max}.`,
  motivoDesconectados: (nombres: string[]) => `Se desconectó: ${nombres.join(", ")}. Espera a que vuelva o quítalo.`,
  motivoEsperando: (nombres: string[]) => `Esperando a: ${nombres.join(", ")}.`,
  motivoEquipos: (m: number) => `Los equipos deben quedar de ${m} y ${m}.`,
  motivoListos: "Todos listos.",
  motivoDesconocido: "Juego desconocido.",

  // Encuesta
  encuestaTitulo: (j: string) => `¿Qué tal la partida de ${j}?`,
  encuestaTextoPrueba: "Este juego está en prueba: tus respuestas deciden qué reglas cambian. Toma menos de un minuto.",
  encuestaTextoListo: "Toma menos de un minuto y ayuda a mejorar el juego.",
  qDiversion: "¿Qué tan divertida fue?",
  qClaridad: "¿Qué tan claras fueron las reglas?",
  qDuracion: "La duración se sintió…",
  nada: "Nada",
  muchisimo: "Muchísimo",
  confusas: "Confusas",
  muyClaras: "Muy claras",
  corta: "Corta",
  justa: "Justa",
  larga: "Larga",
  si: "Sí",
  no: "No",
  qComentario: "Algo confuso, un momento memorable o un error (opcional)",
  audienciaLeyenda: "Solo esta vez, si quieres (para saber quién prueba los juegos)",
  qEdad: "Edad",
  edades: ["Menos de 13", "13–17", "18–24", "25–34", "35–44", "45 o más", "Prefiero no decir"],
  qComoLlego: "¿Cómo llegaste a estos juegos?",
  comoLlego: ["Un amigo", "Una convención", "Redes sociales", "Otro", "Prefiero no decir"],
  qExperiencia: "¿Cuánto juegas juegos de mesa?",
  experiencia: ["De vez en cuando", "Seguido", "Muchísimo", "Prefiero no decir"],
  errorDiversion: "Marca al menos qué tan divertida fue (del 1 al 5).",
  gracias: "¡Gracias! Tu opinión ya está guardada.",
};

export type Textos = typeof es;

const en: Textos = {
  nombreApp: "Game Lobby",
  lema: "Gather your group in a room and pick a game to play.",
  conectando: "Connecting…",
  errorConexionTitulo: "We couldn't connect you",
  errorConexionTexto: "Check your internet connection and reload the page.",
  idioma: "Language",

  comoTeLlamamos: "What should we call you?",
  nombrePlaceholder: "Your name or nickname",
  errorNombre: "Type a name so your friends recognize you.",
  avisoPrivacidad:
    "No account needed. We store the name you choose, your room's chat messages, the results and surveys of your games, and the country you connect from (never your IP address). Visit statistics are anonymous and cookie-free.",
  continuar: "Continue",

  hola: "Hi,",
  cambiarNombre: "Change name",
  salasRecientes: "Your recent rooms",
  crearSala: "Create a room",
  crearSalaTexto: "A room brings your group together for the whole game session.",
  nombreSalaLabel: "Room name (optional)",
  salaDe: (n: string) => `${n}'s room`,
  botonCrearSala: "Create room",
  creando: "Creating…",
  errorCrearSala: "Couldn't create the room. Check your connection and try again.",
  unirse: "Join with a code",
  unirseTexto: "If you got a link, just open it.",
  codigoLabel: "Room code",
  entrar: "Join",
  errorCodigo: (n: number) => `The code has ${n} letters or numbers, like K7Q2M.`,

  perfilAnonimo: "You joined without an account: your profile only lives in this browser.",
  guardarGoogle: "Save it with Google",
  perfilAnonimoFin: "to use it on other devices too.",
  errorGoogle: "Couldn't connect to Google. Try again.",
  perfilGuardado: "Profile saved with",
  panel: "Playtest panel",
  cerrarSesion: "Sign out",

  errorUnirseSala: "Couldn't join the room. Reload the page to try again.",
  noEncontramos: (c: string) => `We couldn't find room ${c}`,
  revisaCodigo: "Check the code with whoever invited you; it may have a typo.",
  volverInicio: "Back to start",
  errorCargarSala: "Couldn't load the room. Check your connection and reload the page.",
  invitadoTexto: "You've been invited to this room. Choose your name to join.",
  entrarSala: "Join the room",
  entrandoSala: "Joining the room…",
  uneteA: (n: string) => `Join ${n}`,
  copiaEnlace: "Copy this link:",
  confirmarSalir: "Leave the room? You can come back with the same link.",
  sala: "Room",
  codigo: "Code",
  enlaceCopiado: "Link copied!",
  invitar: "Invite",
  salir: "Leave",
  enLaSala: "In the room",
  conectados: (n: number) => `${n} online`,
  tu: "you",
  anfitrion: "host",
  conectado: "online",
  desconectado: "offline",
  juegos: "Games",
  categorias: {
    listo: { titulo: "Ready to play", nota: "Stable rules" },
    prueba: { titulo: "In testing", nota: "Rules may change between games" },
  },
  enPrueba: "in testing",
  jugadores: (min: number, max: number) => (min === max ? `${min} players` : `${min}–${max} players`),
  conEspectadores: "spectators allowed",
  crearPartida: "New game",
  chat: "Chat",
  escribeAlgo: "Type something before sending.",
  errorEnviar: "Couldn't send. Try again.",
  sinMensajes: "No messages yet. Say hi!",
  tuMayus: "You",
  mensaje: "Message",
  escribeMensaje: "Type a message…",
  enviar: "Send",

  nuevaPartidaDe: (j: string) => `New game of ${j}`,
  cancelar: "Cancel",
  modo: "Mode",
  aQuienInvitas: "Who are you inviting",
  invitarTodos: "Invite the whole room",
  tuParen: " (you)",
  desconectadoPunto: " · offline",
  rolDe: (n: string) => `${n}'s role`,
  jugador: "Player",
  espectador: "Spectator",
  nadieMas: 'Nobody else is in the room yet. Use "Invite" above to share the link.',
  necesitaMin: (j: string, min: number, falta: number) => `${j} needs at least ${min} players; invite ${falta} more.`,
  admiteMax: (j: string, max: number, conEsp: boolean) =>
    `${j} allows at most ${max} players.` + (conEsp ? " Make the rest spectators." : " Remove someone from the list."),
  errorCrearPartida: "Couldn't create the game. Try again.",
  enviando: "Sending…",
  enviarInvitaciones: "Send invitations",

  tituloInvitacion: (n: number) => `(${n}) Invitation · Game Lobby`,
  invitacionesAria: "Invitations",
  alguien: "Someone",
  teInvitaA: "invites you to",
  verboJugar: "play",
  verboMirar: "watch",
  jugar: "Play",
  mirar: "Watch",
  soloMirar: "Just watch",
  ahoraNo: "Not now",
  partidas: "Matches",
  recientes: "Recent",
  revancha: "rematch",
  creandoMin: "creating…",
  noSePudoCrear: "couldn't create",
  gano: (n: string) => `${n} won`,
  ganaron: (nombres: string[]) => `${nombres.slice(0, -1).join(", ")} and ${nombres.at(-1)} won`,
  empate: "tie",
  sinGanador: "no winner",
  equipos: ["Team A", "Team B"],
  chipDesconectado: "offline",
  chipMira: "watching",
  chipAsiento: (n: number) => `seat ${n}`,
  chipNoVa: "not going",
  chipSinResponder: "no answer",
  chipListo: "ready",
  chipPreparandose: "getting ready",
  porEquipos: "teams",
  enJuego: "playing",
  preparando: "setting up",
  organiza: "organizer",
  quitar: "remove",
  seDesconectoOrganizador: (n: string) => `${n} disconnected. If they don't come back, you can run the game.`,
  quienCreo: "The organizer",
  tomarControl: "Take over",
  yaNoListo: "I'm not ready",
  estoyListo: "I'm ready",
  salirme: "Leave game",
  lanzar: "Start game",
  cancelarPartida: "Cancel game",
  terminarPartida: "End game",
  juegasAsiento: (n: number, equipo: string | null) => `You play in seat ${n}` + (equipo ? `, on ${equipo}.` : "."),
  entrasEspectador: "You join as a spectator.",
  noConectado: 'This game isn\'t connected to the lobby yet: open it on your own and, when you finish, the organizer clicks "End game".',
  abrir: (j: string) => `Open ${j}`,
  otraPestana: "Opens in another tab. The result comes back automatically when you finish.",
  rotuloEquipos: "Teams",
  alAzar: "Random",
  elegirlos: "Pick",
  comoEquipos: "How teams are formed",
  seSortean: "drawn at start",
  elegidosPorOrganizador: "picked by the organizer",
  seSorteanLargo: "They're drawn when the game starts.",
  cambiarEquipo: "Switch team",
  tocaNombre: "Tap a name to switch teams.",
  motivoFaltan: (n: number, min: number) => `Not enough players: ${n} of at least ${min}.`,
  motivoSobran: (n: number, max: number) => `Too many players: ${n}, the maximum is ${max}.`,
  motivoDesconectados: (nombres: string[]) => `Disconnected: ${nombres.join(", ")}. Wait for them or remove them.`,
  motivoEsperando: (nombres: string[]) => `Waiting for: ${nombres.join(", ")}.`,
  motivoEquipos: (m: number) => `Teams must be ${m} and ${m}.`,
  motivoListos: "Everyone is ready.",
  motivoDesconocido: "Unknown game.",

  encuestaTitulo: (j: string) => `How was your ${j} game?`,
  encuestaTextoPrueba: "This game is in testing: your answers decide which rules change. It takes less than a minute.",
  encuestaTextoListo: "It takes less than a minute and helps improve the game.",
  qDiversion: "How fun was it?",
  qClaridad: "How clear were the rules?",
  qDuracion: "The length felt…",
  nada: "Not at all",
  muchisimo: "A lot",
  confusas: "Confusing",
  muyClaras: "Very clear",
  corta: "Short",
  justa: "Just right",
  larga: "Long",
  si: "Yes",
  no: "No",
  qComentario: "Anything confusing, a memorable moment or a bug (optional)",
  audienciaLeyenda: "Just this once, if you like (to know who tests the games)",
  qEdad: "Age",
  edades: ["Under 13", "13–17", "18–24", "25–34", "35–44", "45 or older", "Prefer not to say"],
  qComoLlego: "How did you find these games?",
  comoLlego: ["A friend", "A convention", "Social media", "Other", "Prefer not to say"],
  qExperiencia: "How often do you play board games?",
  experiencia: ["Now and then", "Often", "A lot", "Prefer not to say"],
  errorDiversion: "At least mark how fun it was (1 to 5).",
  gracias: "Thanks! Your feedback is saved.",
};

const TEXTOS: Record<Idioma, Textos> = { es, en };
const CLAVE = "lobby_idioma";

function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {
    /* sin almacenamiento */
  }
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

interface Valor {
  idioma: Idioma;
  t: Textos;
  cambiarIdioma: (i: Idioma) => void;
}

const Contexto = createContext<Valor | null>(null);

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);
  useEffect(() => {
    document.documentElement.lang = idioma;
    try {
      localStorage.setItem(CLAVE, idioma);
    } catch {
      /* sin almacenamiento */
    }
  }, [idioma]);
  return <Contexto.Provider value={{ idioma, t: TEXTOS[idioma], cambiarIdioma: setIdioma }}>{children}</Contexto.Provider>;
}

export function useIdioma(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useIdioma debe usarse dentro de <IdiomaProvider>");
  return v;
}

/** Selector compacto ES | EN. */
export function SelectorIdioma() {
  const { idioma, cambiarIdioma, t } = useIdioma();
  return (
    <div className="segmentado selector-idioma" role="radiogroup" aria-label={t.idioma}>
      {(["es", "en"] as Idioma[]).map((i) => (
        <button key={i} role="radio" aria-checked={idioma === i} onClick={() => cambiarIdioma(i)}>
          {i.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Textos de un juego del catálogo en el idioma elegido (el catálogo está en español). */
export function textosJuego(j: Juego, idioma: Idioma) {
  const en = idioma === "en" ? j.en : undefined;
  return {
    descripcion: en?.descripcion ?? j.descripcion,
    duracion: en?.duracion ?? j.duracion,
    variante: (id: string | null) => {
      const v = j.variantes.find((x) => x.id === id);
      return v ? (en?.variantes?.[v.id] ?? v.nombre) : null;
    },
    pregunta: (id: string) => {
      const q = j.preguntas?.find((x) => x.id === id);
      return q ? (en?.preguntas?.[q.id] ?? q.texto) : id;
    },
  };
}
