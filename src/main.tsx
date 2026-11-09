import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { IdiomaProvider } from "./i18n";
import "./estilos/base.css";
import { registrarServiceWorker } from "./pwa";
import { RedDeSeguridad } from "./pantallas/RedDeSeguridad";

registrarServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IdiomaProvider>
      <RedDeSeguridad>
        <App />
      </RedDeSeguridad>
    </IdiomaProvider>
    {/* Visitas anónimas y sin cookies (Vercel Web Analytics). */}
    <Analytics />
  </StrictMode>,
);
