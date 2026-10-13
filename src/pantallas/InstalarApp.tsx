/**
 * Invitación a instalar el lobby como app (ícono en la pantalla de inicio). Con el aviso del
 * navegador (Android, Chrome/Edge) basta un botón; en iPhone se explican los dos toques.
 * No aparece si ya estás en la app, ni durante 30 días si dices "ahora no".
 */
import { useState } from "react";
import { esAndroid, esApp, esIOS, useAvisoInstalacion } from "../pwa";
import { useIdioma } from "../i18n";

const CLAVE = "lobby_instalar_oculto";
const DIAS_OCULTO = 30;

function oculto(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(CLAVE) ?? 0) < DIAS_OCULTO * 86_400_000;
  } catch {
    return false;
  }
}

/** El ícono de "Compartir" de Safari (cuadro con flecha hacia arriba), para reconocerlo. */
function IconoCompartir() {
  return (
    <svg className="icono-compartir" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function InstalarApp({ invitado }: { invitado: boolean }) {
  const { t } = useIdioma();
  const aviso = useAvisoInstalacion();
  const [cerrado, setCerrado] = useState(oculto);
  const [instalada, setInstalada] = useState(false);
  const ios = esIOS();
  const android = esAndroid();

  if (esApp() || cerrado || instalada) return null;
  // En una computadora solo tiene sentido si el navegador ofrece instalarla.
  if (!aviso.disponible && !ios && !android) return null;

  const ahoraNo = () => {
    try {
      localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    setCerrado(true);
  };

  return (
    <section className="tarjeta instalar-app" aria-labelledby="t-instalar">
      <img src="/icono-192.png" alt="" width="56" height="56" className="instalar-icono" />
      <div className="instalar-texto">
        <h2 id="t-instalar">{t.instalarTitulo}</h2>
        <p className="suave">{t.instalarTexto}</p>
        {aviso.disponible ? null : ios ? (
          <ol className="instalar-pasos">
            <li>
              {t.instalarIos1} <IconoCompartir /> <span className="suave">({t.compartir})</span>
            </li>
            <li>{t.instalarIos2}</li>
          </ol>
        ) : (
          <ol className="instalar-pasos">
            <li>{t.instalarAndroid1}</li>
            <li>{t.instalarAndroid2}</li>
          </ol>
        )}
        {ios && invitado && <p className="chico-texto aviso-invitado">{t.instalarInvitadoIos}</p>}
        <div className="botones">
          {aviso.disponible && (
            <button className="primario" onClick={() => aviso.instalar().then((si) => si && setInstalada(true))}>
              {t.instalar}
            </button>
          )}
          <button className="secundario" onClick={ahoraNo}>
            {t.ahoraNo}
          </button>
        </div>
      </div>
    </section>
  );
}
