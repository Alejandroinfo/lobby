import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import "./estilos/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {/* Visitas anónimas y sin cookies (Vercel Web Analytics). */}
    <Analytics />
  </StrictMode>,
);
