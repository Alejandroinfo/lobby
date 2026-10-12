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
import { leerRecientes } from "../datos/recientes";
import { FormNombre } from "./FormNombre";
import { Perfil } from "./Perfil";
import { PanelAmigos } from "./Amigos";
import { rangoDe } from "./Carrera";
import { AvatarCirculo } from "./PaginaPerfil";
import { avatarPorDefecto } from "../firebase/perfil";
import type { Perfil as TPerfil } from "../firebase/tipos";
import { SelectorIdioma, useIdioma } from "../i18n";
import type { Usuario } from "../hooks/useUsuario";

interface Props {
  uid: string;
  usuario: Usuario;
  nombre: string;
  setNombre: (n: string) => void;
  perfil: TPerfil | null | undefined;
}

export function Inicio({ uid, usuario, nombre, setNombre, perfil }: Props) {
  const { t } = useIdioma();
  const [editando, setEditando] = useState(false);
  const [nombreSala, setNombreSala] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorCrear, setErrorCrear] = useState("");
  const [creando, setCreando] = useState(false);
  const [recientes] = useState(leerRecientes);

  if (!nombre || editando) {
    return (
      <main className="inicio">
        <Portada />
        <FormNombre
          inicial={nombre}
          boton={t.continuar}
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
      const nuevo = await crearSala(uid, nombre, limpiarNombre(nombreSala) || t.salaDe(nombre));
      irA({ pantalla: "sala", codigo: nuevo });
    } catch (err) {
      setErrorCrear(t.errorCrearSala);
      console.error(err);
      setCreando(false);
    }
  };

  const unirse = (e: FormEvent) => {
    e.preventDefault();
    const limpio = normalizarCodigo(codigo);
    if (!codigoValido(limpio)) {
      setErrorCodigo(t.errorCodigo(LARGO_CODIGO));
      return;
    }
    irA({ pantalla: "sala", codigo: limpio });
  };

  return (
    <main className="inicio">
      <Portada />
      <p className="saludo">
        {t.hola} <strong>{nombre}</strong>.{" "}
        <button type="button" className="enlace" onClick={() => setEditando(true)}>
          {t.cambiarNombre}
        </button>
      </p>
      <button className="tarjeta mini-perfil" onClick={() => irA({ pantalla: "perfil" })}>
        <AvatarCirculo avatar={perfil?.avatar ?? avatarPorDefecto(uid)} />
        <span className="mini-perfil-texto">
          <span className="etiqueta">{t.tuRango}</span>
          <strong>{t.rangos[rangoDe(perfil?.carrera?.partidas ?? 0).indice]}</strong>
          <span className="suave chico-texto">{t.carreraResumen((perfil?.carrera?.partidas ?? 0) - (perfil?.carrera?.retos ?? 0), perfil?.carrera?.victorias ?? 0, perfil?.carrera?.retos ?? 0)}</span>
        </span>
        <span className="mini-perfil-ir">{t.verPerfil} →</span>
      </button>
      <Perfil usuario={usuario} />
      <div className="amigos-inicio"><PanelAmigos /></div>
      {recientes.length > 0 && (
        <section className="tarjeta recientes-salas" aria-labelledby="t-recientes">
          <h2 id="t-recientes">{t.salasRecientes}</h2>
          <ul>
            {recientes.map((r) => (
              <li key={r.codigo}>
                <button className="enlace-sala" onClick={() => irA({ pantalla: "sala", codigo: r.codigo })}>
                  <span>{r.nombre}</span>
                  <span className="mono suave">{r.codigo}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="opciones">
        <form className="tarjeta" onSubmit={crear} noValidate>
          <h2>{t.crearSala}</h2>
          <p className="suave">{t.crearSalaTexto}</p>
          <label htmlFor="nombre-sala">{t.nombreSalaLabel}</label>
          <input
            id="nombre-sala"
            maxLength={40}
            value={nombreSala}
            placeholder={t.salaDe(nombre)}
            onChange={(e) => setNombreSala(e.target.value)}
          />
          {errorCrear && <p className="error">{errorCrear}</p>}
          <button type="submit" className="primario" disabled={creando}>
            {creando ? t.creando : t.botonCrearSala}
          </button>
        </form>
        <form className="tarjeta" onSubmit={unirse} noValidate>
          <h2>{t.unirse}</h2>
          <p className="suave">{t.unirseTexto}</p>
          <label htmlFor="codigo">{t.codigoLabel}</label>
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
            {t.entrar}
          </button>
        </form>
      </div>
    </main>
  );
}

function Portada() {
  const { t } = useIdioma();
  return (
    <header className="portada">
      <div className="idioma-portada">
        <SelectorIdioma />
      </div>
      <h1>{t.nombreApp}</h1>
      <p>{t.lema}</p>
    </header>
  );
}
