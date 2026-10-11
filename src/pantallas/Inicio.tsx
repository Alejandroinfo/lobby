import { useState, type FormEvent } from "react";
import {
  codigoValido,
  crearSala,
  guardarPerfil,
  LARGO_CODIGO,
  limpiarNombre,
  normalizarCodigo,
} from "../firebase/salas";
import { irA } from "../navegacion";
import { FormNombre } from "./FormNombre";

interface Props {
  uid: string;
  nombre: string;
  setNombre: (n: string) => void;
}

export function Inicio({ uid, nombre, setNombre }: Props) {
  const [editando, setEditando] = useState(false);
  const [nombreSala, setNombreSala] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorCrear, setErrorCrear] = useState("");
  const [creando, setCreando] = useState(false);

  if (!nombre || editando) {
    return (
      <main className="inicio">
        <Portada />
        <FormNombre
          inicial={nombre}
          boton="Continuar"
          alGuardar={(n) => {
            setNombre(n);
            setEditando(false);
            guardarPerfil(uid, n).catch(() => {});
          }}
        />
      </main>
    );
  }

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setErrorCrear("");
    setCreando(true);
    try {
      const nuevo = await crearSala(uid, nombre, limpiarNombre(nombreSala));
      irA({ pantalla: "sala", codigo: nuevo });
    } catch (err) {
      setErrorCrear("No se pudo crear la sala. Revisa tu conexión e intenta de nuevo.");
      console.error(err);
      setCreando(false);
    }
  };

  const unirse = (e: FormEvent) => {
    e.preventDefault();
    const limpio = normalizarCodigo(codigo);
    if (!codigoValido(limpio)) {
      setErrorCodigo(`El código tiene ${LARGO_CODIGO} letras o números, como K7Q2M.`);
      return;
    }
    irA({ pantalla: "sala", codigo: limpio });
  };

  return (
    <main className="inicio">
      <Portada />
      <p className="saludo">
        Hola, <strong>{nombre}</strong>.{" "}
        <button type="button" className="enlace" onClick={() => setEditando(true)}>
          Cambiar nombre
        </button>
      </p>
      <div className="opciones">
        <form className="tarjeta" onSubmit={crear} noValidate>
          <h2>Crear una sala</h2>
          <p className="suave">Una sala reúne a tu grupo para toda la sesión de juego.</p>
          <label htmlFor="nombre-sala">Nombre de la sala (opcional)</label>
          <input
            id="nombre-sala"
            maxLength={40}
            value={nombreSala}
            placeholder={`Sala de ${nombre}`}
            onChange={(e) => setNombreSala(e.target.value)}
          />
          {errorCrear && <p className="error">{errorCrear}</p>}
          <button type="submit" className="primario" disabled={creando}>
            {creando ? "Creando…" : "Crear sala"}
          </button>
        </form>
        <form className="tarjeta" onSubmit={unirse} noValidate>
          <h2>Unirse con un código</h2>
          <p className="suave">Si te pasaron un enlace, ábrelo directamente.</p>
          <label htmlFor="codigo">Código de la sala</label>
          <input
            id="codigo"
            className="codigo"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={LARGO_CODIGO + 2}
            value={codigo}
            placeholder="K7Q2M"
            aria-invalid={Boolean(errorCodigo)}
            onChange={(e) => {
              setCodigo(normalizarCodigo(e.target.value));
              setErrorCodigo("");
            }}
          />
          {errorCodigo && <p className="error">{errorCodigo}</p>}
          <button type="submit" className="secundario">
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

function Portada() {
  return (
    <header className="portada">
      <h1>Lobby de juegos</h1>
      <p>Reúne a tu grupo en una sala y elijan a qué jugar.</p>
    </header>
  );
}
