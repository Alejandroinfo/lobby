/** Aviso «Próximamente» para los juegos que todavía no se pueden jugar desde el lobby. */
import { useEffect, useRef, type CSSProperties } from "react";
import type { Juego } from "../datos/catalogo";
import { colorDe, IconoJuego } from "../datos/iconos";
import { textosJuego, useIdioma } from "../i18n";

export function AvisoProximamente({ juego, alCerrar }: { juego: Juego; alCerrar: () => void }) {
  const { t, idioma } = useIdioma();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="hoja-invitar aviso-pronto"
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="t-pronto"
      style={{ "--juego": colorDe(juego.id) } as CSSProperties}
    >
      <div className="pronto-cuerpo">
        <IconoJuego id={juego.id} tam={72} />
        <span className="insignia pronto">{t.proximamente}</span>
        <h2 id="t-pronto">{juego.nombre}</h2>
        <p className="suave">{textosJuego(juego, idioma).descripcion}</p>
        <p>{t.prontoTexto}</p>
        <button className="primario" onClick={() => ref.current?.close()}>
          {t.entendido}
        </button>
      </div>
    </dialog>
  );
}
