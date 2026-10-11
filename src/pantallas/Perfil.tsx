/** Guardar el perfil con Google (opcional) para conservarlo en otros dispositivos. */
import { useState } from "react";
import { cerrarSesion, guardarConGoogle, type Usuario } from "../hooks/useUsuario";
import { irA } from "../navegacion";
import { useIdioma } from "../i18n";

export function Perfil({ usuario }: { usuario: Usuario }) {
  const { t } = useIdioma();
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const vincular = async () => {
    setError("");
    setTrabajando(true);
    try {
      await guardarConGoogle();
    } catch (e) {
      const codigo = (e as { code?: string }).code ?? "";
      if (!codigo.includes("popup-closed") && !codigo.includes("cancelled-popup")) {
        setError(t.errorGoogle);
      }
    } finally {
      setTrabajando(false);
    }
  };

  if (usuario.anonimo) {
    return (
      <p className="perfil suave">
        {t.perfilAnonimo}{" "}
        <button className="enlace" onClick={vincular} disabled={trabajando}>
          {trabajando ? t.conectando : t.guardarGoogle}
        </button>{" "}
        {t.perfilAnonimoFin}
        {error && <span className="error"> {error}</span>}
      </p>
    );
  }
  return (
    <p className="perfil suave">
      {t.perfilGuardado} <strong>{usuario.email}</strong>.{" "}
      <button className="enlace" onClick={() => irA({ pantalla: "panel" })}>
        {t.panel}
      </button>
      {" · "}
      <button className="enlace" onClick={() => cerrarSesion()}>
        {t.cerrarSesion}
      </button>
    </p>
  );
}
