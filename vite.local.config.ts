/**
 * Versión LOCAL para probar sin Firebase: `npm run dev:local`.
 * Todo se guarda en este navegador; cada pestaña es un jugador distinto.
 */
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

const falso = (f: string) => fileURLToPath(new URL(`./pruebas/firebase-local/${f}`, import.meta.url));

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        "firebase/app": falso("app.ts"),
        "firebase/auth": falso("auth.ts"),
        "firebase/firestore": falso("firestore.ts"),
      },
    },
  }),
);
