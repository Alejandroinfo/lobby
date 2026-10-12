/** Privacidad y datos: ficha visible, tipo de jugador, descargar y borrar tus datos. */
import { useState } from "react";
import { borrarMisDatos, esMenor, exportarMisDatos, fichaEsVisible, guardarPreferencias } from "../firebase/perfil";
import type { Perfil, TipoJugador } from "../firebase/tipos";
import { olvidarEsteDispositivo } from "../hooks/useUsuario";
import { useIdioma } from "../i18n";

const TIPOS: TipoJugador[] = ["estratega", "social", "competitivo", "casual", "no-dice"];

export function Privacidad({ uid, perfil }: { uid: string; perfil: Perfil | null | undefined }) {
  const { t } = useIdioma();
  const [trabajando, setTrabajando] = useState<"" | "descargar" | "borrar">("");
  const [error, setError] = useState("");
  const menor = esMenor(perfil);
  const visible = fichaEsVisible(perfil);

  const descargar = async () => {
    setError("");
    setTrabajando("descargar");
    try {
      const datos = await exportarMisDatos(uid);
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-lobby-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      setError(t.errCuenta);
    } finally {
      setTrabajando("");
    }
  };

  const borrar = async () => {
    if (!window.confirm(t.confirmarBorrar1)) return;
    if (!window.confirm(t.confirmarBorrar2)) return;
    setError("");
    setTrabajando("borrar");
    try {
      await borrarMisDatos(uid);
      await olvidarEsteDispositivo();
      window.location.assign("/");
    } catch (e) {
      console.error(e);
      setError(t.errCuenta);
      setTrabajando("");
    }
  };

  return (
    <section className="tarjeta privacidad" aria-labelledby="t-privacidad">
      <h2 id="t-privacidad">{t.privacidadTitulo}</h2>

      <label className="interruptor">
        <input
          type="checkbox"
          checked={visible}
          disabled={menor}
          onChange={(e) => guardarPreferencias(uid, { fichaVisible: e.target.checked }).catch(() => setError(t.errCuenta))}
        />
        <span>
          <strong>{t.fichaVisible}</strong>
          <span className="suave chico-texto">{menor ? t.fichaMenor : t.fichaVisibleTexto}</span>
        </span>
      </label>

      <p className="rotulo" id="q-tipo">{t.qTipoJugador}</p>
      <div className="opciones-chip" role="radiogroup" aria-labelledby="q-tipo">
        {TIPOS.map((v, i) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={perfil?.tipoJugador === v}
            className={perfil?.tipoJugador === v ? "elegido" : ""}
            onClick={() => guardarPreferencias(uid, { tipoJugador: v }).catch(() => setError(t.errCuenta))}
          >
            {t.tiposJugador[i]}
          </button>
        ))}
      </div>
      <p className="suave chico-texto">{t.tipoJugadorTexto}</p>

      <h3>{t.tusDatos}</h3>
      <p className="suave chico-texto">{t.tusDatosTexto}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="botones">
        <button className="secundario" onClick={descargar} disabled={Boolean(trabajando)}>
          {trabajando === "descargar" ? t.preparandoDatos : t.descargarDatos}
        </button>
        <button className="peligro" onClick={borrar} disabled={Boolean(trabajando)}>
          {trabajando === "borrar" ? t.borrando : t.borrarDatos}
        </button>
      </div>
    </section>
  );
}
