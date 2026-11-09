/**
 * Red de seguridad: si una pantalla del lobby falla al dibujarse, en vez de quedar en blanco se
 * muestra «Algo falló» con tres salidas (recargar, ir al inicio, contarnos qué pasó). El error se
 * guarda para que vaya en el reporte (ver reportes/errores.ts).
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useIdioma } from "../i18n";
import { anotarErrorDePantalla } from "../reportes/errores";

function Caida() {
  const { t } = useIdioma();
  return (
    <main className="centro">
      <div className="tarjeta red-de-seguridad" role="alert">
        <p className="red-de-seguridad__icono" aria-hidden="true">
          😵
        </p>
        <h1>{t.algoFallo}</h1>
        <p className="suave">{t.algoFalloTexto}</p>
        <div className="botones">
          <button className="primario" onClick={() => window.location.reload()}>
            {t.recargar}
          </button>
          <button className="secundario" onClick={() => window.location.assign("/")}>
            {t.irAlInicio}
          </button>
        </div>
        <p>
          <a className="enlace" href="/reportar">
            ⚠️ {t.contarQuePaso}
          </a>
        </p>
      </div>
    </main>
  );
}

export class RedDeSeguridad extends Component<{ children: ReactNode }, { caida: boolean }> {
  state = { caida: false };

  static getDerivedStateFromError() {
    return { caida: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error);
    anotarErrorDePantalla(error, info.componentStack ?? undefined);
  }

  render() {
    return this.state.caida ? <Caida /> : this.props.children;
  }
}
