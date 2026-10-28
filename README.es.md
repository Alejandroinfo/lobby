# Lobby de juegos

*English version: [README.md](README.md)* · **Demo: [lobby-navy.vercel.app](https://lobby-navy.vercel.app)**

Una sala web donde un grupo de amigos se reúne, conversa y elige a cuál de los juegos jugar.
Diseño completo: documento "Lobby central: diseño técnico (fase 1)".

**Estado:** pasos 1 y 2 del plan — entrar con nombre, crear sala, unirse por enlace (`/s/CODIGO`),
ver quién está conectado, chatear, y crear partidas: elegir juego y modo, invitar a toda la sala
o a algunas personas como jugador o espectador, marcar "listo" y lanzar. Con los juegos
conectados (Astrolabe y Split Loyalty), "Abrir juego" entra directo a la partida en su asiento y
el resultado vuelve solo al lobby.

## Stack

- React 19 + TypeScript + Vite (igual que Astrolabe).
- Firebase, proyecto `lobby-games`: Authentication anónima + Firestore.
- Vercel para publicar, con Web Analytics (sin cookies).

## Puesta en marcha (una sola vez)

1. **Vercel:** Add New → Project → importar este repo → Deploy (detecta Vite solo).
   Luego, en el proyecto: pestaña **Analytics → Enable**.
2. **Firebase → Authentication → Configuración → Dominios autorizados:** agregar el dominio
   de Vercel (por ejemplo `lobby-xxxx.vercel.app`).
3. **Firebase → Firestore Database → Reglas:** pegar el contenido de `firestore.rules` y **Publicar**.
   Repetir cada vez que cambie ese archivo.

## Juegos conectados

La dirección de cada juego está en `src/datos/catalogo.ts` y se puede cambiar sin tocar código con
variables de entorno (Vercel → Settings → Environment Variables, o `.env.local`):

| Variable | Juego |
| --- | --- |
| `VITE_URL_ASTROLABE` | Astrolabe (por defecto `https://astrolabebg.vercel.app/`) |
| `VITE_URL_SPLIT_LOYALTY` | Split Loyalty (por defecto `https://split-loyalty.vercel.app/app/online.html`) |
| `VITE_URL_BLINDSPOT` | Blindspot, la página de inicio (sin valor = no conectado) |
| `VITE_URL_BST_ANIMALS` | BST Animals, la página de inicio (sin valor = no conectado) |

Cada juego conectado incluye un "puente" (`src/lobby/puente.ts` en Astrolabe, `app/lobby-puente.js`
en Split Loyalty) que lee los parámetros `?lobby=1&codigo=…&asiento=…&rol=…` y, al terminar, avisa el
resultado a la pestaña del lobby o vuelve a la sala con `?resultado=…`.

## Datos en Firestore

| Ruta | Qué guarda |
| --- | --- |
| `jugadores/{uid}` | `nombre`, `ultimaVez` |
| `salas/{codigo}` | `nombre`, `anfitrion`, `miembros: {uid: {nombre, entrada, ultimaVez}}`, `creada` |
| `salas/{codigo}/mensajes/{id}` | `uid`, `nombre`, `texto`, `hora`, `expira` |
| `salas/{codigo}/partidas/{id}/resultados/{uid}` | `asiento`, `ganadores`, `puntajes`, `duracionSeg`, `version`, `detalleJson`, `recibido` |
| `salas/{codigo}/partidas/{id}` | `juego`, `variante`, `anfitrion`, `estado` (invitando → jugando → terminada / cancelada), `invitados: {uid: {nombre, rol, respuesta, listo, respondio, asiento}}`, `codigoJuego`, `creada`, `iniciada`, `terminada` |

Cada miembro solo puede modificar su propia entrada en `miembros`; el chat y las partidas solo
los ven los miembros. Quien crea una partida la controla; cada invitado solo cambia su respuesta. Detalle en `firestore.rules`.

### Borrado automático (campo `expira`)

Firestore borra solo los documentos cuya fecha `expira` ya pasó (ver `src/firebase/caducidad.ts`):

- **Mensajes del chat de la sala:** 30 días después de enviados.
- **Las salas no se borran:** ocupan poquísimo y sirven para contar cuántas se crearon.
- **Partidas que nunca se jugaron:** 30 días después de crearse. Al lanzarlas se les quita `expira`,
  así que las partidas jugadas, sus resultados y encuestas se conservan. El historial y los
  récords de cada persona viven en `jugadores/{uid}` y no se tocan.

Se activa una vez a mano: Firebase → lobby-games → Firestore Database → pestaña **Tiempo de vida
(TTL)** → **Crear política**, con grupo de colecciones `mensajes` y campo `expira`; lo mismo para
`partidas`. **No** crear una para `salas`. Los mensajes directos (`charlas/…/mensajes`) no llevan `expira` y no se borran.

## Desarrollo

```bash
npm install
npm run dev        # contra el Firebase real
npm run dev:local  # sin Firebase: todo en el navegador, cada pestaña es un jugador
npm run build      # revisa tipos y genera dist/
```
