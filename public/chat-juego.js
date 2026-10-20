/*
 * Chat de la sala dentro de los juegos.
 *
 * Lo carga el puente de cada juego (lobby-puente.js / puente.ts) cuando la partida viene de una sala
 * del lobby:
 *   <script src="https://lobby-navy.vercel.app/chat-juego.js" data-sala="K7Q2M" data-nombre="Ana"
 *           data-idioma="es" data-llave="…" async></script>
 * `data-llave` es la «llave del chat» que el lobby agrega al enlace del juego (#lc=…): con ella el
 * juego entra al proyecto del lobby como tú, y las reglas solo le dejan leer y escribir en tu sala.
 *
 * Qué hace, sin estorbar la partida:
 *  - un botón 💬 pequeño abajo a la izquierda, con los mensajes sin leer;
 *  - cada mensaje nuevo de otra persona asoma unos segundos junto al botón (no tapa el tablero:
 *    es pequeño, semitransparente y deja pasar los toques);
 *  - al tocar el botón o el aviso, se abre un panel para leer y contestar (con respuestas rápidas);
 *  - «Silenciar» deja solo el contador, sin avisos.
 * Todo vive dentro de un Shadow DOM: los estilos del juego no lo tocan y él no toca los del juego.
 */
(function () {
  var script = document.currentScript;
  if (!script || window.__chatSalaLobby) return;
  window.__chatSalaLobby = true;
  var SALA = (script.dataset.sala || "").toUpperCase();
  var NOMBRE = (script.dataset.nombre || "").slice(0, 24);
  var EN = script.dataset.idioma === "en";
  var LLAVE = script.dataset.llave || "";
  if (!/^[A-HJ-NP-Z2-9]{5}$/.test(SALA) || !NOMBRE) return;

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2";
  var CONFIG = {
    apiKey: "AIzaSyBYKkH1KULlJNdaLoC0meDju6B0cIV-2uE",
    authDomain: "lobby-games.firebaseapp.com",
    projectId: "lobby-games",
    appId: "1:841353806445:web:90cd4f5da4e3a0c8b37564",
  };
  var T = EN
    ? { chat: "Room chat", abrir: "Open the room chat", cerrar: "Close", escribe: "Message the room…", enviar: "Send", vacio: "No messages yet.",
        silenciar: "Mute pop-ups", activar: "Show pop-ups", error: "Couldn't send. Try again.", rapidas: ["👋 Hi!", "😄", "👍", "🤔 Hmm…", "🔥 Nice move!"] }
    : { chat: "Chat de la sala", abrir: "Abrir el chat de la sala", cerrar: "Cerrar", escribe: "Escribe a la sala…", enviar: "Enviar", vacio: "Todavía no hay mensajes.",
        silenciar: "Silenciar avisos", activar: "Mostrar avisos", error: "No se pudo enviar. Prueba otra vez.", rapidas: ["👋 ¡Hola!", "😄", "👍", "🤔 Mmm…", "🔥 ¡Buena jugada!"] };

  function guardado(k, porDefecto) { try { var v = localStorage.getItem(k); return v === null ? porDefecto : v; } catch (e) { return porDefecto; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var claveLeido = "lobby_chat_juego_leido:" + SALA;
  var silencio = guardado("lobby_chat_juego_silencio", "0") === "1";
  var leido = Number(guardado(claveLeido, "0")) || 0;

  // ── Interfaz ───────────────────────────────────────────────────────────────
  var anfitrion = document.createElement("div");
  anfitrion.id = "chat-sala-lobby";
  var raiz = anfitrion.attachShadow({ mode: "open" });
  raiz.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".boton{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;" +
    "width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(22,27,24,.82);color:#fff;font-size:20px;cursor:pointer;" +
    "display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.3);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.8;transition:opacity .2s}" +
    ".boton:hover,.boton:focus-visible,.boton.nuevo{opacity:1}" +
    ".boton:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #f0b43c;outline-offset:2px}" +
    ".insignia{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#d9534f;color:#fff;font:700 11px/20px system-ui;text-align:center}" +
    ".avisos{position:fixed;left:calc(64px + env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:grid;gap:6px;pointer-events:none;max-width:min(300px,calc(100vw - 80px))}" +
    ".aviso{pointer-events:auto;cursor:pointer;background:rgba(22,27,24,.86);color:#f5f0e6;border:1px solid rgba(255,255,255,.14);border-radius:14px 14px 14px 4px;" +
    "padding:7px 11px;font-size:13.5px;line-height:1.3;box-shadow:0 6px 18px rgba(0,0,0,.3);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
    "overflow-wrap:anywhere;animation:entra .25s ease-out both}" +
    ".aviso b{color:#f0b43c;font-weight:700}" +
    ".aviso.sale{animation:sale .35s ease-in both}" +
    "@keyframes entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    "@keyframes sale{to{opacity:0;transform:translateY(6px)}}" +
    "@media (prefers-reduced-motion:reduce){.aviso,.aviso.sale{animation:none}}" +
    ".panel{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(64px + env(safe-area-inset-bottom,0px));z-index:2147483001;" +
    "width:min(340px,calc(100vw - 24px));height:min(440px,calc(100vh - 96px));display:flex;flex-direction:column;background:rgba(22,27,24,.96);color:#f5f0e6;" +
    "border:1px solid rgba(255,255,255,.16);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden}" +
    ".panel[hidden]{display:none}" +
    ".cabeza{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:700;font-size:14px}" +
    ".cabeza span{flex:1}" +
    ".chico{background:none;border:1px solid rgba(255,255,255,.18);color:#f5f0e6;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer}" +
    ".lista{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain}" +
    ".m{max-width:85%;padding:6px 10px;border-radius:14px;background:rgba(255,255,255,.09);font-size:13.5px;line-height:1.35;overflow-wrap:anywhere;align-self:flex-start}" +
    ".m.mio{align-self:flex-end;background:#2c6a4c}" +
    ".m small{display:block;color:#f0b43c;font-weight:700;font-size:11px;margin-bottom:1px}" +
    ".vacio{margin:auto;color:rgba(245,240,230,.6);font-size:13px}" +
    ".rapidas{display:flex;gap:5px;overflow-x:auto;padding:6px 10px 0;scrollbar-width:none}" +
    ".rapidas button{flex:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#f5f0e6;border-radius:99px;padding:4px 9px;font-size:12.5px;cursor:pointer}" +
    "form{display:flex;gap:6px;padding:8px 10px 10px}" +
    "input{flex:1;min-width:0;border-radius:99px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;padding:8px 12px;font-size:14px}" +
    "form button{border:0;border-radius:99px;background:#f0b43c;color:#211f1c;font-weight:700;padding:0 14px;cursor:pointer}" +
    ".error{color:#ff9b8f;font-size:12px;padding:0 12px 6px}" +
    "</style>" +
    "<button class='boton' type='button'>💬<span class='insignia' hidden></span></button>" +
    "<div class='avisos' aria-live='polite'></div>" +
    "<section class='panel' role='dialog' hidden>" +
    "<div class='cabeza'><span></span><button class='chico silencio' type='button'></button><button class='chico cerrar' type='button'>✕</button></div>" +
    "<div class='lista'></div><div class='rapidas'></div>" +
    "<form><input maxlength='500' autocomplete='off' enterkeyhint='send'><button type='submit'></button></form><div class='error' hidden></div>" +
    "</section>";
  var $ = function (s) { return raiz.querySelector(s); };
  var boton = $(".boton"), insignia = $(".insignia"), avisos = $(".avisos"), panel = $(".panel"), lista = $(".lista");
  var campo = $("input"), errorEl = $(".error");
  boton.setAttribute("aria-label", T.abrir);
  boton.title = T.chat;
  $(".cabeza span").textContent = T.chat;
  $(".cerrar").setAttribute("aria-label", T.cerrar);
  $("form button").textContent = T.enviar;
  campo.placeholder = T.escribe;
  panel.setAttribute("aria-label", T.chat);
  function textoSilencio() { $(".silencio").textContent = silencio ? "🔔 " + T.activar : "🔕 " + T.silenciar; }
  textoSilencio();

  var mensajes = [], yo = null, enviarFn = null;
  function abierto() { return !panel.hidden; }
  function noLeidos() { return mensajes.filter(function (m) { return m.uid !== yo && m.ms > leido; }).length; }
  function marcarLeidos() {
    var ultimo = mensajes.length ? mensajes[mensajes.length - 1].ms : 0;
    if (ultimo > leido) { leido = ultimo; guardar(claveLeido, String(leido)); }
  }
  function pintarInsignia() {
    var n = abierto() ? 0 : noLeidos();
    insignia.hidden = !n;
    insignia.textContent = n > 9 ? "9+" : String(n);
    boton.classList.toggle("nuevo", n > 0);
  }
  function pintarLista() {
    lista.textContent = "";
    if (!mensajes.length) { var v = document.createElement("p"); v.className = "vacio"; v.textContent = T.vacio; lista.appendChild(v); return; }
    mensajes.forEach(function (m) {
      var el = document.createElement("div");
      el.className = "m" + (m.uid === yo ? " mio" : "");
      if (m.uid !== yo) { var q = document.createElement("small"); q.textContent = m.nombre; el.appendChild(q); }
      el.appendChild(document.createTextNode(m.texto));
      lista.appendChild(el);
    });
    lista.scrollTop = lista.scrollHeight;
  }
  function abrir(si) {
    panel.hidden = !si;
    if (si) { marcarLeidos(); pintarLista(); avisos.textContent = ""; setTimeout(function () { campo.focus(); }, 30); }
    pintarInsignia();
  }
  boton.addEventListener("click", function () { abrir(!abierto()); });
  $(".cerrar").addEventListener("click", function () { abrir(false); });
  $(".silencio").addEventListener("click", function () { silencio = !silencio; guardar("lobby_chat_juego_silencio", silencio ? "1" : "0"); textoSilencio(); if (silencio) avisos.textContent = ""; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && abierto()) abrir(false); });

  // Un mensaje nuevo asoma unos segundos (como mucho 2 a la vez) y se va solo.
  function asomar(m) {
    if (silencio || abierto()) return;
    var el = document.createElement("div");
    el.className = "aviso";
    var b = document.createElement("b"); b.textContent = m.nombre + ": ";
    el.appendChild(b); el.appendChild(document.createTextNode(m.texto.length > 140 ? m.texto.slice(0, 140) + "…" : m.texto));
    el.addEventListener("click", function () { abrir(true); });
    avisos.appendChild(el);
    while (avisos.children.length > 2) avisos.removeChild(avisos.firstChild);
    setTimeout(function () { el.classList.add("sale"); setTimeout(function () { el.remove(); }, 380); }, 5500);
  }

  function enviar(texto) {
    texto = texto.trim().slice(0, 500);
    if (!texto || !enviarFn) return;
    errorEl.hidden = true;
    enviarFn(texto).catch(function (e) { console.warn("chat de la sala", e); errorEl.textContent = T.error; errorEl.hidden = false; campo.value = campo.value || texto; });
  }
  $("form").addEventListener("submit", function (e) { e.preventDefault(); var t = campo.value; campo.value = ""; enviar(t); });
  T.rapidas.forEach(function (r) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = r;
    b.addEventListener("click", function () { enviar(r); });
    $(".rapidas").appendChild(b);
  });

  // ── Conexión con el lobby ──────────────────────────────────────────────────
  function arrancar() {
    Promise.all([import(SDK + "/firebase-app.js"), import(SDK + "/firebase-auth.js"), import(SDK + "/firebase-firestore.js")])
      .then(function (mods) {
        var A = mods[0], U = mods[1], F = mods[2];
        var app = A.getApps().find(function (a) { return a.name === "chat-sala-lobby"; }) || A.initializeApp(CONFIG, "chat-sala-lobby");
        var auth = U.getAuth(app), db = F.getFirestore(app);
        var entrar = LLAVE ? U.signInWithCustomToken(auth, LLAVE).catch(function () { return null; }) : Promise.resolve(null);
        return entrar.then(function () { return auth.authStateReady ? auth.authStateReady() : null; }).then(function () {
          if (!auth.currentUser) return; // sin llave ni sesión guardada: no hay chat (el juego sigue igual)
          yo = auth.currentUser.uid;
          var inicio = Date.now();
          // Lo que se escribió antes de abrir el juego ya se vio en la sala: solo cuenta lo nuevo.
          if (leido < inicio - 5000) leido = inicio - 5000;
          enviarFn = function (texto) {
            return F.addDoc(F.collection(db, "salas", SALA, "mensajes"), { uid: yo, nombre: NOMBRE, texto: texto, hora: F.serverTimestamp() });
          };
          var q = F.query(F.collection(db, "salas", SALA, "mensajes"), F.orderBy("hora"), F.limitToLast(40));
          F.onSnapshot(q, function (snap) {
            var antes = {};
            mensajes.forEach(function (m) { antes[m.id] = true; });
            mensajes = snap.docs.map(function (d) {
              var x = d.data();
              return { id: d.id, uid: x.uid, nombre: x.nombre || "?", texto: x.texto || "", ms: x.hora && x.hora.toMillis ? x.hora.toMillis() : Date.now() };
            });
            mensajes.forEach(function (m) { if (!antes[m.id] && m.uid !== yo && m.ms >= inicio - 5000) asomar(m); });
            if (abierto()) { marcarLeidos(); pintarLista(); }
            pintarInsignia();
            if (!anfitrion.isConnected) document.body.appendChild(anfitrion); // aparece cuando ya hay conexión
          }, function (e) { console.warn("chat de la sala", e); });
        });
      })
      .catch(function (e) { console.warn("chat de la sala: sin conexión", e); });
  }
  if (document.body) arrancar(); else document.addEventListener("DOMContentLoaded", arrancar);
})();
