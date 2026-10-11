import { useState, type FormEvent } from "react";
import { LARGO_NOMBRE, limpiarNombre } from "../firebase/salas";

interface Props {
  inicial: string;
  boton: string;
  alGuardar: (nombre: string) => void;
}

/** Pide el nombre con el que te verán los demás, con el aviso de privacidad. */
export function FormNombre({ inicial, boton, alGuardar }: Props) {
  const [texto, setTexto] = useState(inicial);
  const [error, setError] = useState("");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const nombre = limpiarNombre(texto);
    if (!nombre) {
      setError("Escribe un nombre para que tus amigos te reconozcan.");
      return;
    }
    alGuardar(nombre);
  };

  return (
    <form className="tarjeta form-nombre" onSubmit={enviar} noValidate>
      <label htmlFor="nombre">¿Cómo te llamamos?</label>
      <input
        id="nombre"
        autoFocus
        autoComplete="nickname"
        maxLength={LARGO_NOMBRE}
        value={texto}
        placeholder="Tu nombre o apodo"
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
      <p className="aviso">
        No necesitas cuenta. Solo guardamos el nombre que elijas y los mensajes que escribas en el chat
        de tu sala, para que el lobby funcione. Las estadísticas de visitas son anónimas y sin cookies.
      </p>
    </form>
  );
}
