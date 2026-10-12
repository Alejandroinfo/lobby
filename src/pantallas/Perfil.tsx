/**
 * Cuenta (opcional): se puede jugar sin cuenta. Crear una con correo y contraseña, o con Google,
 * guarda el perfil para entrar desde otros dispositivos sin perder nada de lo jugado.
 */
import { useState, type FormEvent } from "react";
import { cerrarSesion, crearCuentaConCorreo, entrarConCorreo, guardarConGoogle, recuperarClave, type Usuario } from "../hooks/useUsuario";
import { irA } from "../navegacion";
import { useIdioma, type Textos } from "../i18n";

function mensajeError(e: unknown, t: Textos): string {
  const codigo = (e as { code?: string }).code ?? "";
  if (codigo.includes("popup-closed") || codigo.includes("cancelled-popup")) return "";
  if (codigo === "auth/email-already-in-use" || codigo === "auth/credential-already-in-use") return t.errCorreoEnUso;
  if (codigo === "auth/invalid-email") return t.errCorreoInvalido;
  if (codigo === "auth/weak-password") return t.errClaveDebil;
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(codigo)) return t.errCredenciales;
  if (codigo === "auth/too-many-requests") return t.errDemasiados;
  if (codigo === "auth/network-request-failed") return t.errRed;
  if (codigo === "auth/operation-not-allowed") return t.errNoHabilitado;
  return t.errCuenta;
}

/** Línea corta del estado de la cuenta (inicio). */
export function Perfil({ usuario }: { usuario: Usuario }) {
  const { t } = useIdioma();
  if (usuario.anonimo) {
    return (
      <p className="perfil suave">
        {t.perfilAnonimoCorto}{" "}
        <button className="enlace" onClick={() => irA({ pantalla: "perfil" })}>{t.crearCuentaEnlace}</button>
      </p>
    );
  }
  return (
    <p className="perfil suave">
      {t.perfilGuardado} <strong>{usuario.email}</strong>.
    </p>
  );
}

/** Bloque de cuenta de la página de perfil. */
export function Cuenta({ usuario }: { usuario: Usuario }) {
  const { t } = useIdioma();
  const [modo, setModo] = useState<"crear" | "entrar">("crear");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const correr = async (f: () => Promise<void>, ok?: string) => {
    setError("");
    setAviso("");
    setTrabajando(true);
    try {
      await f();
      if (ok) setAviso(ok);
      setClave("");
    } catch (e) {
      setError(mensajeError(e, t));
    } finally {
      setTrabajando(false);
    }
  };

  if (!usuario.anonimo) {
    return (
      <section className="tarjeta cuenta" aria-labelledby="t-cuenta">
        <h2 id="t-cuenta">{t.tuCuenta}</h2>
        <p>
          {usuario.proveedor === "google" ? t.cuentaGoogle : t.cuentaCorreo} <strong>{usuario.email}</strong>
        </p>
        {usuario.proveedor === "correo" && !usuario.verificado && <p className="suave chico-texto">{t.verificaCorreo}</p>}
        <p className="suave chico-texto">{t.cuentaTexto}</p>
        <div className="botones">
          <button className="secundario" onClick={() => cerrarSesion()}>{t.cerrarSesion}</button>
        </div>
      </section>
    );
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (modo === "crear") correr(() => crearCuentaConCorreo(correo, clave), t.cuentaCreada);
    else correr(() => entrarConCorreo(correo, clave));
  };

  return (
    <section className="tarjeta cuenta" aria-labelledby="t-cuenta">
      <h2 id="t-cuenta">{t.guardaTuPerfil}</h2>
      <p className="suave">{t.guardaTuPerfilTexto}</p>
      <div className="segmentado" role="tablist" aria-label={t.tuCuenta}>
        <button role="tab" aria-selected={modo === "crear"} aria-checked={modo === "crear"} onClick={() => { setModo("crear"); setError(""); }}>{t.crearCuenta}</button>
        <button role="tab" aria-selected={modo === "entrar"} aria-checked={modo === "entrar"} onClick={() => { setModo("entrar"); setError(""); }}>{t.yaTengoCuenta}</button>
      </div>
      <form onSubmit={enviar} noValidate className="form-cuenta">
        <label htmlFor="correo">{t.correo}</label>
        <input id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        <label htmlFor="clave">{t.clave}</label>
        <input
          id="clave"
          type="password"
          autoComplete={modo === "crear" ? "new-password" : "current-password"}
          value={clave}
          minLength={6}
          onChange={(e) => setClave(e.target.value)}
          aria-describedby={modo === "crear" ? "clave-ayuda" : undefined}
          required
        />
        {modo === "crear" && <p id="clave-ayuda" className="suave chico-texto">{t.claveAyuda}</p>}
        {modo === "entrar" && <p className="suave chico-texto">{t.entrarAviso}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {aviso && <p className="listo-texto" role="status">{aviso}</p>}
        <div className="botones">
          <button type="submit" className="primario" disabled={trabajando || !correo || !clave}>
            {trabajando ? t.conectando : modo === "crear" ? t.crearCuenta : t.iniciarSesion}
          </button>
          {modo === "entrar" && (
            <button
              type="button"
              className="enlace"
              disabled={trabajando}
              onClick={() => (correo ? correr(() => recuperarClave(correo), t.recuperarEnviado) : setError(t.escribeCorreo))}
            >
              {t.olvideClave}
            </button>
          )}
        </div>
      </form>
      <div className="separador-o"><span>{t.o}</span></div>
      <button className="secundario ancho" disabled={trabajando} onClick={() => correr(() => guardarConGoogle())}>
        {t.continuarGoogle}
      </button>
    </section>
  );
}
