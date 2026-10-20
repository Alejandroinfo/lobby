import { IconoJuego, colorDe } from "../datos/iconos";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { codigoValido, crearSala, guardarPerfil, LARGO_CODIGO, normalizarCodigo } from "../firebase/salas";
import { crearPartida } from "../firebase/partidas";
import { JUEGOS, type Juego } from "../datos/catalogo";
import { EnlaceReportar } from "./Reportar";
import { irA } from "../navegacion";
import { leerRecientes } from "../datos/recientes";
import { FormNombre } from "./FormNombre";
import { InstalarApp } from "./InstalarApp";
import { PartidasEnCurso, TarjetaAvisos } from "./EnCurso";
import { Perfil } from "./Perfil";
import { PanelAmigos } from "./Amigos";
import { rangoDe } from "./Carrera";
import { AvatarCirculo } from "./PaginaPerfil";
import { avatarPorDefecto } from "../firebase/perfil";
import type { Perfil as TPerfil } from "../firebase/tipos";
import { SelectorIdioma, textosJuego, useIdioma } from "../i18n";
import type { Usuario } from "../hooks/useUsuario";

interface Props {
  uid: string;
  usuario: Usuario;
  nombre: string;
  setNombre: (n: string) => void;
  perfil: TPerfil | null | undefined;
}

export function Inicio({ uid, usuario, nombre, setNombre, perfil }: Props) {
  const { t, idioma } = useIdioma();
  const [editando, setEditando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorCrear, setErrorCrear] = useState("");
  const [creando, setCreando] = useState<string | null>(null);
  const [recientes] = useState(leerRecientes);

  // Atajo de la app instalada (mantener pulsado el icono → «Jugar Split Loyalty»): /?jugar=<juego>
  // hace la partida rápida en cuanto hay nombre.
  const atajo = useRef(new URLSearchParams(window.location.search).get("jugar"));
  useEffect(() => {
    const id = atajo.current;
    if (!id || !nombre || editando) return;
    atajo.current = null;
    window.history.replaceState(null, "", "/");
    const juego = JUEGOS.find((j) => j.id === id && j.url);
    if (juego) rapida(juego);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, editando]);

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

  const crearVacia = async () => {
    setErrorCrear("");
    setCreando("vacia");
    try {
      const nuevo = await crearSala(uid, nombre, t.salaDe(nombre));
      irA({ pantalla: "sala", codigo: nuevo });
    } catch (err) {
      setErrorCrear(t.errorCrearSala);
      console.error(err);
      setCreando(null);
    }
  };

  // Partida rápida: sala + partida con enlace en un toque; la sala abre la hoja «Invitar».
  const rapida = async (juego: Juego) => {
    setErrorCrear("");
    setCreando(juego.id);
    try {
      const sala = await crearSala(uid, nombre, t.salaDe(nombre));
      const id = await crearPartida(sala, uid, juego, juego.variantes[0]?.id ?? null, [{ uid, nombre, rol: "jugador" }], undefined, true);
      window.history.pushState(null, "", `/s/${sala}?invitar=${encodeURIComponent(id)}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err) {
      setErrorCrear(t.errorCrearSala);
      console.error(err);
      setCreando(null);
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

  const avatar = perfil?.avatar ?? avatarPorDefecto(uid);
  const rango = t.rangos[rangoDe(perfil?.carrera?.partidas ?? 0).indice];

  return (
    <main className="inicio">
      <header className="barra-inicio">
        <h1>{t.nombreApp}</h1>
        <SelectorIdioma />
        <button className="boton-avatar" onClick={() => irA({ pantalla: "perfil" })} aria-label={t.verMiPerfil} title={t.verMiPerfil}>
          <AvatarCirculo avatar={avatar} tam="sm" />
        </button>
      </header>
      <p className="saludo">
        {t.hola} <strong>{nombre}</strong> · <span className="suave">{rango}</span>{" "}
        <button type="button" className="enlace chico-texto" onClick={() => setEditando(true)}>
          {t.cambiarNombre}
        </button>
      </p>
      <TarjetaAvisos uid={uid} />
      <InstalarApp invitado={usuario.anonimo} />

      <div className="inicio-cuerpo">
        <div className="inicio-principal">
          <section className="tarjeta jugar-ya" aria-labelledby="t-jugar-ya">
            <h2 id="t-jugar-ya">{t.aQueJugamos}</h2>
            <p className="suave chico-texto">{t.aQueJugamosNota}</p>
            <ul className="juegos-rapidos">
              {JUEGOS.filter((j) => j.url).map((j) => (
                <li key={j.id}>
                  <button
                    className={`juego-rapido ${j.categoria} ${creando === j.id ? "creando" : ""}`}
                    style={{ "--juego": colorDe(j.id) } as CSSProperties}
                    disabled={creando !== null}
                    onClick={() => rapida(j)}
                  >
                    <IconoJuego id={j.id} tam={40} />
                    <strong>{j.nombre}</strong>
                    <span className="suave chico-texto">
                      {creando === j.id
                        ? t.creandoPartida
                        : `${t.jugadores(j.jugadores.min, j.jugadores.max)} · ${textosJuego(j, idioma).duracion}`}
                    </span>
                    {j.categoria === "prueba" && <span className="insignia prueba">{t.enPrueba}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {errorCrear && <p className="error">{errorCrear}</p>}
            <form className="tengo-codigo" onSubmit={unirse} noValidate>
              <label htmlFor="codigo">{t.tengoCodigo}</label>
              <div className="fila">
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
                <button type="submit" className="secundario">
                  {t.entrar}
                </button>
              </div>
              {errorCodigo && <p className="error">{errorCodigo}</p>}
            </form>
            <button className="enlace chico-texto sala-vacia" disabled={creando !== null} onClick={crearVacia}>
              {creando === "vacia" ? t.creando : t.salaVacia}
            </button>
          </section>

          <PartidasEnCurso perfil={perfil} uid={uid} />
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
        </div>
        <div className="inicio-lateral">
          <div className="amigos-inicio">
            <PanelAmigos />
          </div>
          <button className="tarjeta mini-perfil en-este-celular" onClick={() => irA({ pantalla: "en-este-celular" })}>
            <span aria-hidden="true" className="carrera-icono">
              📱
            </span>
            <span className="mini-perfil-texto">
              <strong>{t.enEsteCelularTitulo}</strong>
              <span className="suave chico-texto">{t.enEsteCelularResumen}</span>
            </span>
            <span className="mini-perfil-ir">→</span>
          </button>
        </div>
      </div>
      <footer className="pie-inicio">
        <Perfil usuario={usuario} />
        <EnlaceReportar />
      </footer>
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
