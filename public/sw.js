/*
 * Service worker del lobby (app instalable). Deliberadamente simple:
 *  - Páginas: primero la red (así cada publicación en main llega al instante); sin red, la última
 *    copia guardada, para que la app al menos abra.
 *  - /assets/: archivos con huella en el nombre (no cambian nunca): de la caché si ya están.
 *  - Todo lo demás (Firebase, /api/, otros sitios): ni se toca.
 */
const CACHE = "lobby-v1";
const BASICOS = ["/", "/manifest.webmanifest", "/icono.svg", "/icono-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(BASICOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const pedido = e.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (pedido.mode === "navigate") {
    // La app es una sola página: cualquier ruta (/s/K7Q2M, /perfil…) usa el mismo index.html.
    e.respondWith(
      fetch(pedido)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put("/", copia));
          }
          return resp;
        })
        .catch(() => caches.match("/")),
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
