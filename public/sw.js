/*
 * Service worker del lobby (app instalable).
 *  - Páginas del lobby: primero la red (cada publicación en main llega al instante); sin red, la
 *    última copia guardada.
 *  - /assets/ del lobby: archivos con huella en el nombre (no cambian): de la caché si ya están.
 *  - /juegos/…: los juegos que se pueden jugar sin internet (Vercel los sirve desde sus propios
 *    sitios). Se guardan en el celular en cuanto hay conexión; con red se usa siempre lo último.
 *  - Todo lo demás (Firebase, /api/, otros sitios): ni se toca.
 */
const CACHE = "lobby-v2";
const JUEGOS = "lobby-juegos-v1";
const BASICOS = ["/", "/manifest.webmanifest", "/icono.svg", "/icono-192.png"];

/**
 * Juegos sin internet. `lista`: archivo que el juego publica con todos sus archivos (Astrolabe);
 * sin lista, se guardan la página y lo que ella carga del mismo sitio (Split Loyalty).
 */
const SIN_CONEXION = [
  { base: "/juegos/split-loyalty/", entrada: "index.html" },
  { base: "/juegos/astrolabe/offline/", entrada: "index.html", lista: "archivos.json" },
];

function referenciasLocales(html) {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)/g)) {
    const r = m[1];
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(r)) continue; // otros sitios, data:, rutas absolutas
    refs.add(r.replace(/^\.\//, ""));
  }
  return [...refs];
}

async function bajar(url) {
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
  return resp;
}

/** Guarda (o pone al día) los juegos sin internet. Lo que ya no usan, se borra. */
async function precargarJuegos() {
  const cache = await caches.open(JUEGOS);
  for (const juego of SIN_CONEXION) {
    try {
      const entrada = await bajar(juego.base + juego.entrada);
      let archivos;
      if (juego.lista) {
        archivos = (await (await bajar(juego.base + juego.lista)).json()).archivos;
      } else {
        archivos = referenciasLocales(await entrada.clone().text());
      }
      const nuevos = new Set([juego.entrada, ...archivos].map((f) => new URL(juego.base + f, self.location.origin).href));
      await cache.put(juego.base + juego.entrada, entrada);
      await Promise.all(
        [...nuevos]
          .filter((u) => !u.endsWith("/" + juego.entrada))
          .map(async (u) => cache.put(u, await bajar(u))),
      );
      for (const pedido of await cache.keys()) {
        if (pedido.url.startsWith(self.location.origin + juego.base) && !nuevos.has(pedido.url)) await cache.delete(pedido);
      }
    } catch (e) {
      // Sin red o el juego no responde: se queda la copia anterior.
      console.warn("No se pudo guardar el juego sin conexión", juego.base, e);
    }
  }
}

/** La página del lobby y sus archivos (/assets/…), para que la app abra sin red desde la primera vez. */
async function guardarLobby() {
  const cache = await caches.open(CACHE);
  await cache.addAll(BASICOS);
  const html = await (await cache.match("/")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(assets);
}

self.addEventListener("install", (e) => {
  e.waitUntil(guardarLobby().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE && k !== JUEGOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => precargarJuegos()),
  );
});

// La app pide poner al día los juegos sin internet al abrirse con conexión.
self.addEventListener("message", (e) => {
  if (e.data === "precargar-juegos") e.waitUntil(precargarJuegos());
});

/** Red con límite de tiempo (una conexión mala no debe dejar la pantalla en blanco). */
function redOCache(pedido, buscar) {
  const red = fetch(pedido);
  const limite = new Promise((_, no) => setTimeout(() => no(new Error("lenta")), 6000));
  return Promise.race([red, limite]).catch(async () => (await buscar()) || red);
}

self.addEventListener("fetch", (e) => {
  const pedido = e.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/juegos/")) {
    const ruta = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
    e.respondWith(redOCache(pedido, () => caches.match(url.origin + ruta, { cacheName: JUEGOS })));
    return;
  }

  if (pedido.mode === "navigate") {
    // La app es una sola página: cualquier ruta (/s/K7Q2M, /perfil…) usa el mismo index.html.
    e.respondWith(
      redOCache(pedido, () => caches.match("/", { cacheName: CACHE })).then((resp) => {
        if (resp && resp.ok && !resp.redirected && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
        }
        return resp;
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(pedido).then(
        (guardado) =>
          guardado ||
          fetch(pedido).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(pedido, copia));
            }
            return resp;
          }),
      ),
    );
  }
});
