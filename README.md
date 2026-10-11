# Lobby de juegos

Una sala web donde un grupo de amigos se reúne, conversa y elige a cuál de los juegos jugar.
Diseño completo: documento "Lobby central: diseño técnico (fase 1)".

**Estado:** pasos 1 y 2 del plan — entrar con nombre, crear sala, unirse por enlace (`/s/CODIGO`),
ver quién está conectado, chatear, y crear partidas: elegir juego y modo, invitar a toda la sala
o a algunas personas como jugador o espectador, marcar "listo" y lanzar. Abrir el juego
automáticamente llega en los pasos 4 y 5.

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

## Datos en Firestore

| Ruta | Qué guarda |
| --- | --- |
| `jugadores/{uid}` | `nombre`, `ultimaVez` |
| `salas/{codigo}` | `nombre`, `anfitrion`, `miembros: {uid: {nombre, entrada, ultimaVez}}`, `creada` |
| `salas/{codigo}/mensajes/{id}` | `uid`, `nombre`, `texto`, `hora` |
| `salas/{codigo}/partidas/{id}` | `juego`, `variante`, `anfitrion`, `estado` (invitando → jugando → terminada / cancelada), `invitados: {uid: {nombre, rol, respuesta, listo, respondio, asiento}}`, `codigoJuego`, `creada`, `iniciada`, `terminada` |

Cada miembro solo puede modificar su propia entrada en `miembros`; el chat y las partidas solo
los ven los miembros. Quien crea una partida la controla; cada invitado solo cambia su respuesta. Detalle en `firestore.rules`.

## Desarrollo

```bash
npm install
npm run dev        # contra el Firebase real
npm run dev:local  # sin Firebase: todo en el navegador, cada pestaña es un jugador
npm run build      # revisa tipos y genera dist/
```
