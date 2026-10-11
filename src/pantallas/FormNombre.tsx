import { useState, type FormEvent } from "react";
import { LARGO_NOMBRE, limpiarNombre } from "../firebase/salas";
import { useIdioma } from "../i18n";

interface Props {
  inicial: string;
  boton: string;
  alGuardar: (nombre: string) => void;
}

/** Pide el nombre con el que te verán los demás, con el aviso de privacidad. */
export function FormNombre({ inicial, boton, alGuardar }: Props) {
  const { t } = useIdioma();
  const [texto, setTexto] = useState(inicial);
  const [error, setError] = useState("");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const nombre = limpiarNombre(texto);
    if (!nombre) {
      setError(t.errorNombre);
      return;
    }
    alGuardar(nombre);
  };

  return (
    <form className="tarjeta form-nombre" onSubmit={enviar} noValidate>
      <label htmlFor="nombre">{t.comoTeLlamamos}</label>
      <input
        id="nombre"
        autoFocus
        autoComplete="nickname"
        maxLength={LARGO_NOMBRE}
        value={texto}
        placeholder={t.nombrePlaceholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "nombre-error" : undefined}
        onChange={(e) => {
          setTexto(e.target.value);
          setError("");
        }}
      />
      {error && (
        <p id="nombre-error" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="primario">
        {boton}
      </button>
      <p className="aviso">{t.avisoPrivacidad}</p>
    </form>
  );
}
