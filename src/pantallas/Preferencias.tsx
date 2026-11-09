/** Perfil → Preferencias: ajustes que se aplican al abrir los juegos (hoy, la letra grande). */
import { useState } from "react";
import type { Perfil } from "../firebase/tipos";
import { useIdioma } from "../i18n";
import { abrirAlEmpezar, guardarAbrirAlEmpezar, guardarPreferencias, guardarSonido, preferencias, sonidoActivo } from "../preferencias";
import { sonarAviso } from "../sonido";

export function Preferencias({ uid, perfil }: { uid: string; perfil: Perfil | null | undefined }) {
  const { t } = useIdioma();
  const [letraGrande, setLetraGrande] = useState(perfil?.preferencias?.letraGrande ?? preferencias.letraGrande);
  const [error, setError] = useState("");
  const [abrir, setAbrir] = useState(abrirAlEmpezar);
  const [sonido, setSonido] = useState(sonidoActivo);

  const cambiar = async (si: boolean) => {
    setLetraGrande(si);
    setError("");
    try {
      await guardarPreferencias(uid, { letraGrande: si });
    } catch (e) {
      console.warn(e);
      setError(t.errCuenta);
    }
  };

  return (
    <section className="tarjeta preferencias" aria-labelledby="t-preferencias">
      <h2 id="t-preferencias">{t.preferenciasTitulo}</h2>
      <label className="check">
        <input type="checkbox" checked={letraGrande} onChange={(e) => cambiar(e.target.checked)} />
        <span>
          <strong>{t.letraGrande}</strong>
          <br />
          <span className="suave chico-texto">{t.letraGrandeTexto}</span>
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={abrir}
          onChange={(e) => {
            setAbrir(e.target.checked);
            guardarAbrirAlEmpezar(e.target.checked);
          }}
        />
        <span>
          <strong>{t.abrirAlEmpezarTitulo}</strong>
          <br />
          <span className="suave chico-texto">{t.abrirAlEmpezarTexto}</span>
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={sonido}
          onChange={(e) => {
            setSonido(e.target.checked);
            guardarSonido(e.target.checked);
            if (e.target.checked) sonarAviso(); // para oír cómo suena
          }}
        />
        <span>
          <strong>{t.sonidosTitulo}</strong>
          <br />
          <span className="suave chico-texto">{t.sonidosTexto}</span>
        </span>
      </label>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
