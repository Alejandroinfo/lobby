import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Versión que se adjunta a los reportes de problemas (commit que publicó Vercel).
  define: {
    __VERSION__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)),
  },
  build: {
    // Firebase ocupa la mayor parte del paquete; es normal que pase de 500 kB.
    chunkSizeWarningLimit: 1000,
  },
});
