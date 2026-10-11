/** Guardar el perfil con Google (opcional) para conservarlo en otros dispositivos. */
import { useState } from "react";
import { cerrarSesion, guardarConGoogle, type Usuario } from "../hooks/useUsuario";
import { irA } from "../navegacion";

export function Perfil({ usuario }: { usuario: Usuario }) {
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
        setError("No se pudo conectar con Google. Intenta de nuevo.");
      }
    } finally {
      setTrabajando(false);
    }
  };

  if (usuario.anonimo) {
    return (
      <p className="perfil suave">
        Entraste sin cuenta: tu perfil vive solo en este navegador.{" "}
        <button className="enlace" onClick={vincular} disabled={trabajando}>
          {trabajando ? "Conectando…" : "Guardarlo con Google"}
        </button>{" "}
        para usarlo también en otros dispositivos.
        {error && <span className="error"> {error}</span>}
      </p>
    );
  }
  return (
    <p className="perfil suave">
      Perfil guardado con <strong>{usuario.email}</strong>.{" "}
      <button className="enlace" onClick={() => irA({ pantalla: "panel" })}>
        Panel de playtest
      </button>
      {" · "}
      <button className="enlace" onClick={() => cerrarSesion()}>
        Cerrar sesión
      </button>
    </p>
  );
}
