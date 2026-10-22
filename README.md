# Game Lobby

**▶ Live demo: [lobby-navy.vercel.app](https://lobby-navy.vercel.app)**

A web lobby where a group of friends meets, chats, and picks which of my original board games to play online. I design these games as tabletop games and build digital versions to playtest them, with the goal of eventually producing them as physical games.

*Versión en español: [README.es.md](README.es.md)*

## Try it in 2 minutes

1. Open the [live demo](https://lobby-navy.vercel.app) and enter any name (no account needed).
2. Create a room.
3. **To play alone:** create a match of *Astrolabe*, *Split Loyalty*, or *Split Loyalty: Double Cross* and choose to play against the computer.
4. **To try multiplayer:** copy the room link and open it in a second browser tab (or send it to a friend). Each tab joins as a different player.

The interface is available in English and Spanish.

## The games

| Game | Players | Description | Play directly |
|---|---|---|---|
| Split Loyalty | 2–4 | Recruit agents and decide whether each one serves their nation or their rank. | [Open](https://split-loyalty.vercel.app/app/online.html) |
| Split Loyalty: Double Cross | 2–4 | Recruit agents with dice, file them in your dossier, and claim objectives before the other agencies. | [Open](https://split-loyalty-double-cross.vercel.app/) |
| Astrolabe | 2–4 | Deduce your home's secret orbit among the stars. With 4 players, in teams of two. | [Open](https://astrolabebg.vercel.app/) |
| Blindspot | 3–6 | Everyone sees your personality except you. Figure it out before the Soulmate. | [Open](https://matchmaking-one-gamma.vercel.app/) |
| BST Animals | 2–5 | Build trees in silence, without saying which cards you hold. | [Open](https://bst-firebase.vercel.app/) |

## Features

- **Rooms and matches:** join by link, see who is online, chat, create matches, invite players or spectators, mark "ready", and launch. The game opens directly in each player's seat and reports the result back to the lobby.
- **Social layer:** friend codes, friend requests, direct messages, online presence, and room invitations between friends.
- **Engagement features:** daily challenges with a shared leaderboard, player profiles with stats and achievements, and push notifications on mobile.
- **Playtesting tools:** after each match, players can rate fun and clarity (1–5), say whether the game felt too short or too long, and answer game-specific questions. A private admin panel aggregates match results, surveys, and bug reports.
- **Bug reporting** from inside the lobby and the games.
- **Installable** as a progressive web app (PWA).

## Measurement

Because the lobby exists to playtest games, it records what is needed to evaluate them:

- **Match outcomes:** winners, scores, and duration for each match.
- **Playtest surveys:** fun, clarity, perceived length, and open feedback per game.
- **Optional audience data**, in ranges only: country, age range, how the player found the lobby, and gaming experience.
- **Traffic:** Vercel Web Analytics (cookie-free).

Security rules ensure each player can only read and change their own data, and only room members can see a room's chat and matches. See [`firestore.rules`](firestore.rules).

## Tech stack

- React 19 + TypeScript + Vite
- Firebase: anonymous Authentication + Firestore (real-time data)
- Vercel: hosting, serverless functions (`api/`), and Web Analytics
- Web Push for mobile notifications

## Development

```bash
npm install
npm run dev        # against the real Firebase project
npm run dev:local  # no Firebase: everything runs in the browser, each tab is a player
npm run build      # type-checks and builds dist/
```

Deployment and configuration steps (Vercel, Firebase authorized domains, and publishing the Firestore rules) are described in the [Spanish README](README.es.md#puesta-en-marcha-una-sola-vez).

Code comments and identifiers are mostly in Spanish.
