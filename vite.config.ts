import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase ocupa la mayor parte del paquete; es normal que pase de 500 kB.
    chunkSizeWarningLimit: 1000,
  },
});
