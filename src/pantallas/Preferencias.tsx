/** Perfil → Preferencias: ajustes que se aplican al abrir los juegos (hoy, la letra grande). */
import { useState } from "react";
import type { Perfil } from "../firebase/tipos";
import { useIdioma } from "../i18n";
import { guardarPreferencias, preferencias } from "../preferencias";

export function Preferencias({ uid, perfil }: { uid: string; perfil: Perfil | null | undefined }) {
  const { t } = useIdioma();
  const [letraGrande, setLetraGrande] = useState(perfil?.preferencias?.letraGrande ?? preferencias.letraGrande);
  const [error, setError] = useState("");

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
      {error && <p className="error">{error}</p>}
    </section>
  );
}
